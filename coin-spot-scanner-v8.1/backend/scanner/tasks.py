from datetime import timedelta
from celery import shared_task
from django.db import transaction
from django.utils import timezone
from .models import ChecklistProfile, ScanRun, ScanStepRun, StepSchedule
from .orchestrator import ScanOrchestrator
from .services import STEP_DEFINITIONS, default_config
from .models import Candidate
from .unlock.factory import build_unlock_providers
from .unlock.service import UnlockEvidenceService

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


@shared_task(bind=True, autoretry_for=(), queue="crawl")
def refresh_unlock_web_evidence(self, candidate_ids=None):
    """Refresh only candidates that explicitly opted into public-web URLs."""
    if not any(getattr(provider, "name", "") == "PUBLIC_WEB_UNLOCK" for provider in build_unlock_providers()):
        return {"status": "SKIPPED", "reason": "UNLOCK_WEB_CRAWL_ENABLED=false", "refreshed": 0}
    queryset = Candidate.objects.exclude(coingecko_id="").order_by("-id")
    if candidate_ids:
        queryset = queryset.filter(id__in=candidate_ids)
    queryset = queryset[:50]
    service = UnlockEvidenceService(providers=tuple(provider for provider in build_unlock_providers() if getattr(provider, "name", "") == "PUBLIC_WEB_UNLOCK"))
    refreshed = 0
    for candidate in queryset.iterator(chunk_size=50):
        service.collect(candidate, default_config()["tokenomics"], timezone.now())
        refreshed += 1
    return {"status": "PASS", "refreshed": refreshed}

def create_scan_run(profile: ChecklistProfile, requested_steps=None, mode="FULL_SCAN_EXECUTION") -> ScanRun:
    all_steps = [key for _, key, _ in STEP_DEFINITIONS]
    if requested_steps:
        requested_set = {key for key in requested_steps if key in all_steps}
        explicit_steps = [key for _, key, _ in STEP_DEFINITIONS if key in requested_set]
        max_sequence = max((seq for seq, key, _ in STEP_DEFINITIONS if key in requested_set), default=1)
        # Một lần chạy bước riêng vẫn chạy prerequisite, nhưng phải giữ lại phạm vi
        # người dùng thật sự yêu cầu để notification/status không giả thành full scan.
        steps = [key for seq, key, _ in STEP_DEFINITIONS if seq <= max_sequence]
    else:
        explicit_steps = list(all_steps)
        steps = list(all_steps)

    # FULL_SCAN_EXECUTION chỉ hợp lệ khi phạm vi được yêu cầu đi tới B6.
    # Caller cũ có thể không truyền mode khi bấm "Chạy bước này"; backend tự
    # phòng thủ để B4-only không bị ghi nhãn như một full execution scan.
    effective_mode = mode
    if requested_steps and len(steps) < len(all_steps) and mode == "FULL_SCAN_EXECUTION":
        effective_mode = "FULL_SCAN_RESEARCH"

    prerequisite_steps = [key for key in steps if key not in explicit_steps]
    run_scope = {
        "explicit_requested_steps": explicit_steps,
        "planned_steps": steps,
        "prerequisite_steps": prerequisite_steps,
        "requested_full_pipeline": explicit_steps == all_steps,
        "prerequisite_expanded": bool(prerequisite_steps),
        "mode_received": mode,
        "mode_effective": effective_mode,
    }

    with transaction.atomic():
        run = ScanRun.objects.create(
            profile=profile,
            profile_snapshot=profile.config,
            requested_steps=steps,
            mode_requested=effective_mode,
            results={"run_scope": run_scope},
        )
        schedules = {s.step_key:s for s in profile.step_schedules.all()}
        ScanStepRun.objects.bulk_create([
            ScanStepRun(scan_run=run, step_key=key, sequence=sequence, policy=(schedules.get(key).total_scan_policy if schedules.get(key) else "REFRESH_IF_STALE"))
            for sequence, key, _ in STEP_DEFINITIONS
        ])
    return run
