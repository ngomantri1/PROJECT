from datetime import timedelta
from copy import deepcopy
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from .models import ChecklistProfile, Notification, ScanRun, StepSchedule
from .serializers import ChecklistProfileSerializer, NotificationSerializer, ScanRunSerializer, StepScheduleSerializer
from .services import STEP_DEFINITIONS, checksum_json, default_config
from .tasks import create_scan_run, run_scan

@api_view(["GET"])
def health(request):
    return Response({"status":"ok","service":"coin-spot-scanner-v8.1","time":timezone.now()})

@api_view(["GET"])
def dashboard(request):
    profile = ChecklistProfile.objects.filter(is_active=True).first()
    latest = ScanRun.objects.first()
    latest_successful = ScanRun.objects.filter(
        status__in=[ScanRun.STATUS_COMPLETED, ScanRun.STATUS_WARNINGS]
    ).first()
    notifications = Notification.objects.all()[:8]
    return Response({
        "profile": ChecklistProfileSerializer(profile).data if profile else None,
        "latest_run": ScanRunSerializer(latest).data if latest else None,
        "latest_successful_run": ScanRunSerializer(latest_successful).data if latest_successful else None,
        "notifications": NotificationSerializer(notifications, many=True).data,
    })

class ChecklistProfileViewSet(viewsets.ModelViewSet):
    queryset = ChecklistProfile.objects.all()
    serializer_class = ChecklistProfileSerializer

    def perform_update(self, serializer):
        instance = serializer.save(version=serializer.instance.version + 1)
        instance.checksum = checksum_json(instance.config)
        instance.save(update_fields=["checksum"])

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        source = self.get_object()
        name = request.data.get("name") or f"{source.name} — Bản sao"
        slug = slugify(name)
        base = slug
        n = 2
        while ChecklistProfile.objects.filter(slug=slug).exists():
            slug = f"{base}-{n}"; n += 1
        profile = ChecklistProfile.objects.create(name=name, slug=slug, config=deepcopy(source.config), checksum=source.checksum)
        for s in source.step_schedules.all():
            StepSchedule.objects.create(profile=profile, step_key=s.step_key, sequence=s.sequence, auto_enabled=s.auto_enabled, interval_minutes=s.interval_minutes, total_scan_policy=s.total_scan_policy, notify_on_complete=s.notify_on_complete)
        return Response(ChecklistProfileSerializer(profile).data, status=201)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        profile = self.get_object()
        with transaction.atomic():
            ChecklistProfile.objects.update(is_active=False)
            profile.is_active = True
            profile.save(update_fields=["is_active"])
        return Response(ChecklistProfileSerializer(profile).data)

    @action(detail=True, methods=["post"])
    def reset_default(self, request, pk=None):
        profile = self.get_object()
        if profile.is_default:
            return Response({"detail":"Cấu hình mặc định không cần reset."}, status=400)
        profile.config = default_config()
        profile.version += 1
        profile.checksum = checksum_json(profile.config)
        profile.save()
        return Response(ChecklistProfileSerializer(profile).data)

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Persistent notification history, newest first, bounded for the local dashboard."""
    serializer_class = NotificationSerializer

    def get_queryset(self):
        try:
            limit = min(max(int(self.request.query_params.get("limit", 200)), 1), 200)
        except (TypeError, ValueError):
            limit = 200
        return Notification.objects.select_related("scan_run").all()[:limit]

class ScanRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ScanRun.objects.select_related("profile").prefetch_related("steps","candidates")
    serializer_class = ScanRunSerializer

    @action(detail=False, methods=["post"])
    def start(self, request):
        if ScanRun.objects.filter(status__in=[ScanRun.STATUS_QUEUED, ScanRun.STATUS_RUNNING]).exists():
            return Response({"detail":"Đang có một quy trình quét hoạt động. Hãy chờ hoàn tất hoặc hủy trước."}, status=409)
        profile_id = request.data.get("profile_id")
        profile = ChecklistProfile.objects.filter(id=profile_id).first() if profile_id else ChecklistProfile.objects.filter(is_active=True).first()
        if not profile:
            return Response({"detail":"Không tìm thấy cấu hình đang dùng."}, status=400)
        requested = request.data.get("requested_steps") or None
        run = create_scan_run(profile, requested, request.data.get("mode", "FULL_SCAN_EXECUTION"))
        run_scan.delay(str(run.id))
        return Response(ScanRunSerializer(run).data, status=201)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        run = self.get_object()
        if run.status not in [ScanRun.STATUS_QUEUED, ScanRun.STATUS_RUNNING, ScanRun.STATUS_PAUSED]:
            return Response({"detail":"Scan Run không còn hoạt động."}, status=400)
        run.status = ScanRun.STATUS_CANCELLED
        run.finished_at = timezone.now()
        run.save(update_fields=["status","finished_at"])
        return Response(ScanRunSerializer(run).data)

@api_view(["PATCH"])
def update_step_schedule(request, pk):
    schedule = get_object_or_404(StepSchedule, pk=pk)
    serializer = StepScheduleSerializer(schedule, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    schedule = serializer.save()
    if schedule.auto_enabled and not schedule.next_run_at:
        schedule.next_run_at = timezone.now() + timedelta(minutes=schedule.interval_minutes)
        schedule.save(update_fields=["next_run_at"])
    return Response(StepScheduleSerializer(schedule).data)
