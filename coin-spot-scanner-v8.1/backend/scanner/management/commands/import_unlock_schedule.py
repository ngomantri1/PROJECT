import json
from hashlib import sha256
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from scanner.models import UnlockOfficialSchedule

class Command(BaseCommand):
    help = "Validate/import an official unlock schedule JSON; use --dry-run to validate only."

    def add_arguments(self, parser):
        parser.add_argument("file")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        path = Path(options["file"])
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f"Invalid JSON file: {exc}")
        asset = payload.get("asset", {})
        coverage = payload.get("coverage", {})
        required = [asset.get("coingecko_id"), asset.get("symbol"), asset.get("project"), payload.get("schema_version"), coverage.get("end"), payload.get("source_url")]
        if not all(required):
            raise CommandError("Required fields: schema_version, asset.coingecko_id/symbol/project, coverage.end")
        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("Unlock schedule valid (dry-run)"))
            return
        coverage_end = timezone.datetime.fromisoformat(str(coverage["end"]).replace("Z", "+00:00"))
        coverage_start = timezone.datetime.fromisoformat(str(coverage["start"]).replace("Z", "+00:00")) if coverage.get("start") else None
        row = UnlockOfficialSchedule.objects.create(
            coingecko_id=asset["coingecko_id"], symbol=asset["symbol"], project_name=asset["project"],
            chain=asset.get("chain") or "", contract=asset.get("contract") or "", source_url=payload.get("source_url", ""),
            verified_at=timezone.now(), coverage_start=coverage_start, coverage_end=coverage_end, is_complete_schedule=bool(coverage.get("complete_through_end")), schedule_payload=payload, payload_hash=sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(), is_active=True,
            verification_state="MANUAL_VERIFIED", evidence_type=payload.get("evidence_type", "OFFICIAL_SCHEDULE"), confidence=payload.get("confidence", "HIGH"),
        )
        self.stdout.write(self.style.SUCCESS(f"Imported UnlockOfficialSchedule id={row.id}"))
