from datetime import timedelta
from celery import shared_task
from django.db import transaction
from django.utils import timezone
from .models import ChecklistProfile, ScanRun, ScanStepRun, StepSchedule
from .orchestrator import ScanOrchestrator
from .services import STEP_DEFINITIONS

@shared_task(bind=True, autoretry_for=(), retry_backoff=False)
def run_scan(self, run_id: str):
    run = ScanRun.objects.select_related("profile").get(id=run_id)
    ScanOrchestrator(run).execute()
    return str(run.id)

@shared_task
def dispatch_due_schedules():
    now = timezone.now()
    due = StepSchedule.objects.select_related("profile").filter(auto_enabled=True, next_run_at__lte=now, profile__is_active=True)
    dispatched = 0
    for schedule in due:
        already = ScanRun.objects.filter(status__in=[ScanRun.STATUS_QUEUED, ScanRun.STATUS_RUNNING], requested_steps__contains=[schedule.step_key]).exists()
        schedule.next_run_at = now + timedelta(minutes=schedule.interval_minutes)
        schedule.save(update_fields=["next_run_at"])
        if already:
            continue
        run = create_scan_run(schedule.profile, [schedule.step_key], "STEP_SCHEDULE")
        run_scan.delay(str(run.id))
        dispatched += 1
    return dispatched

def create_scan_run(profile: ChecklistProfile, requested_steps=None, mode="FULL_SCAN_EXECUTION") -> ScanRun:
    if requested_steps:
        requested_set = set(requested_steps)
        max_sequence = max((seq for seq, key, _ in STEP_DEFINITIONS if key in requested_set), default=1)
        # Bản nền tảng tự chạy các bước tiên quyết để một bước riêng không dùng dữ liệu rỗng.
        steps = [key for seq, key, _ in STEP_DEFINITIONS if seq <= max_sequence]
    else:
        steps = [key for _, key, _ in STEP_DEFINITIONS]
    with transaction.atomic():
        run = ScanRun.objects.create(profile=profile, profile_snapshot=profile.config, requested_steps=steps, mode_requested=mode)
        schedules = {s.step_key:s for s in profile.step_schedules.all()}
        ScanStepRun.objects.bulk_create([
            ScanStepRun(scan_run=run, step_key=key, sequence=sequence, policy=(schedules.get(key).total_scan_policy if schedules.get(key) else "REFRESH_IF_STALE"))
            for sequence, key, _ in STEP_DEFINITIONS
        ])
    return run
