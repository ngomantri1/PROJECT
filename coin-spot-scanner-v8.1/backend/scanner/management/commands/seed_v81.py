from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from scanner.models import ChecklistProfile, StepSchedule
from scanner.services import STEP_DEFINITIONS, checksum_json, default_config

class Command(BaseCommand):
    help = "Khởi tạo cấu hình V8.1 mặc định và lịch sáu bước."

    def handle(self, *args, **options):
        config = default_config()
        profile, created = ChecklistProfile.objects.get_or_create(
            slug="v8-1-default-execution-integrity",
            defaults={"name":"V8.1 DEFAULT — EXECUTION INTEGRITY","version":1,"is_default":True,"is_active":True,"config":config,"checksum":checksum_json(config)},
        )
        if not ChecklistProfile.objects.filter(is_active=True).exists():
            profile.is_active = True
            profile.save(update_fields=["is_active"])
        defaults = {
            "UNIVERSE_SCAN": (240, "REFRESH_IF_STALE"),
            "MARKET_REGIME": (30, "ALWAYS_REFRESH"),
            "RESEARCH_SHORTLIST": (240, "REFRESH_IF_STALE"),
            "EXECUTION_VERIFICATION": (60, "ALWAYS_REFRESH"),
            "SCORING_VALIDATION": (60, "REFRESH_IF_STALE"),
            "INVESTMENT_RESULTS": (60, "REFRESH_IF_STALE"),
        }
        for sequence, key, _ in STEP_DEFINITIONS:
            interval, policy = defaults[key]
            StepSchedule.objects.get_or_create(profile=profile, step_key=key, defaults={"sequence":sequence,"auto_enabled":False,"interval_minutes":interval,"total_scan_policy":policy,"notify_on_complete":True,"next_run_at":timezone.now()+timedelta(minutes=interval)})
        self.stdout.write(self.style.SUCCESS(f"Profile sẵn sàng: {profile.name}"))
