"""Evidence-first unlock engine. Providers may return normalized events; no event is fabricated."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from django.utils import timezone as django_timezone
from ..models import UnlockOfficialSchedule, UnlockProviderSnapshot
import json
from hashlib import sha256
from decimal import Decimal
from .calculator import calculate_windows
from .reconciliation import reconcile_events


class OfficialScheduleProvider:
    name = "OFFICIAL_SCHEDULE"

    def fetch(self, identity, now):
        identity_key = f"coingecko:{identity['coingecko_id']}"
        cached = UnlockProviderSnapshot.objects.filter(identity_key=identity_key, provider=self.name, expires_at__gt=now).order_by("-fetched_at").first()
        if cached:
            result = cached.normalized_payload
            for event in result.get("events", []):
                event["event_date"] = datetime.fromisoformat(event["event_date"].replace("Z", "+00:00"))
            for schedule in result.get("schedules", []):
                schedule["start_date"] = datetime.fromisoformat(schedule["start_date"].replace("Z", "+00:00"))
                schedule["end_date"] = datetime.fromisoformat(schedule["end_date"].replace("Z", "+00:00"))
            return result
        row = UnlockOfficialSchedule.objects.filter(coingecko_id=identity["coingecko_id"], is_active=True).order_by("-verified_at").first()
        if not row:
            result = {"status": "UNKNOWN", "events": [], "source": {"provider": self.name, "source_family": "PROJECT_OFFICIAL", "status": "SKIPPED_NO_VERIFIED_SCHEDULE"}}
            UnlockProviderSnapshot.objects.create(identity_key=identity_key, provider=self.name, status="UNKNOWN", fetched_at=now, expires_at=now + timedelta(hours=24), normalized_payload=result)
            return result
        payload = row.schedule_payload if isinstance(row.schedule_payload, dict) else {}
        coverage_end = payload.get("coverage_end") or payload.get("coverage", {}).get("end")
        if not coverage_end:
            return {"status": "UNKNOWN", "events": [], "source": {"provider": self.name, "status": "INSUFFICIENT_COVERAGE", "source_url": row.source_url}}
        if coverage_end:
            try:
                coverage_end = datetime.fromisoformat(str(coverage_end).replace("Z", "+00:00"))
                if coverage_end < now + timedelta(days=90):
                    return {"status": "UNKNOWN", "events": [], "source": {"provider": self.name, "status": "INSUFFICIENT_COVERAGE", "source_url": row.source_url}}
            except ValueError:
                return {"status": "UNKNOWN", "events": [], "source": {"provider": self.name, "status": "PROVIDER_CONTRACT_ERROR"}}
        events = []
        raw_events = list(payload.get("events", []))
        raw_schedules = list(payload.get("schedules", []))
        for component in payload.get("components", []):
            raw_events.extend({"event_date": e.get("date"), "token_amount": e.get("tokens"), "allocation": component.get("allocation"), "event_type": "DISCRETE"} for e in component.get("events", []))
            if component.get("linear_start") and component.get("linear_end"):
                raw_schedules.append({"start_date": component["linear_start"], "end_date": component["linear_end"], "total_tokens": component.get("total_tokens", 0), "allocation": component.get("allocation")})
        for event in raw_events:
            try:
                parsed = dict(event)
                parsed["event_date"] = datetime.fromisoformat(str(event["event_date"]).replace("Z", "+00:00"))
                events.append(parsed)
            except (KeyError, TypeError, ValueError):
                return {"status": "UNKNOWN", "events": [], "source": {"provider": self.name, "status": "PROVIDER_CONTRACT_ERROR"}}
        schedules = []
        for schedule in raw_schedules:
            try:
                item = dict(schedule)
                item["start_date"] = datetime.fromisoformat(str(item["start_date"]).replace("Z", "+00:00"))
                item["end_date"] = datetime.fromisoformat(str(item["end_date"]).replace("Z", "+00:00"))
                schedules.append(item)
            except (KeyError, TypeError, ValueError):
                return {"status": "UNKNOWN", "events": [], "source": {"provider": self.name, "status": "PROVIDER_CONTRACT_ERROR"}}
        result = {"status": "PASS", "events": [{**e, "event_date": e["event_date"].isoformat()} for e in events], "schedules": [{**s, "start_date": s["start_date"].isoformat(), "end_date": s["end_date"].isoformat()} for s in schedules], "coverage_end": coverage_end.isoformat(), "source": {"provider": self.name, "source_family": "PROJECT_OFFICIAL", "status": "PASS", "source_url": row.source_url, "verified_at": row.verified_at.isoformat()}}
        UnlockProviderSnapshot.objects.create(identity_key=identity_key, provider=self.name, status="PASS", evidence_type="OFFICIAL_SCHEDULE", confidence="HIGH", source_url=row.source_url, observed_at=row.verified_at, fetched_at=now, expires_at=now + timedelta(hours=24), payload_hash=sha256(json.dumps(result, sort_keys=True).encode()).hexdigest(), normalized_payload=result)
        for event in result["events"]:
            event["event_date"] = datetime.fromisoformat(event["event_date"].replace("Z", "+00:00"))
        return result


class UnlockEvidenceService:
    def __init__(self, providers=()):
        self.providers = providers

    @staticmethod
    def identity(candidate):
        snapshot = candidate.details.get("market_snapshot", {})
        if not candidate.coingecko_id or not candidate.name or not candidate.symbol:
            return None
        return {"coingecko_id": candidate.coingecko_id, "symbol": candidate.symbol,
                "project": candidate.name, "binance_base_asset": candidate.binance_pair.removesuffix("USDT"),
                "chain": snapshot.get("asset_platform_id"), "contract": None,
                "unlock_urls": candidate.details.get("unlock_urls", [])}

    @staticmethod
    def _risk(windows, circulating, cfg):
        codes, status = [], "CLEAR"
        if not circulating or circulating <= 0:
            return "REVIEW", codes
        for days, code, threshold in ((7, "TOK-01", cfg["unlock_7d_block_pct"]), (30, "TOK-02", cfg["unlock_30d_no_buy_pct"]), (90, "TOK-03", cfg["unlock_90d_warn_pct"])):
            if windows[str(days)]["pct_circulating"] is not None and windows[str(days)]["pct_circulating"] > threshold:
                codes.append(code)
                if days == 7:
                    status = "BLOCKED"
                elif status != "BLOCKED":
                    status = "WATCH_RISK"
        return status, codes

    def collect(self, candidate, tokenomics, now=None):
        now = now or datetime.now(timezone.utc)
        identity = self.identity(candidate)
        if not identity:
            return {"status": "CONFLICT", "confidence": "POOR", "evidence_type": "CONFLICT", "risk_status": "BLOCKED", "risk_codes": ["TOK-12"], "reason": "Asset identity is incomplete"}
        events, schedules, sources, provider_results = [], [], [], []
        for provider in self.providers:
            try:
                result = provider.fetch(identity, now)
            except Exception as exc:  # candidate-level isolation; provider errors remain evidence
                sources.append({"provider": provider.name, "status": "UNAVAILABLE", "reason": type(exc).__name__})
                continue
            if not isinstance(result, dict):
                sources.append({"provider": getattr(provider, "name", "UNKNOWN"), "status": "UNKNOWN", "reason": "PROVIDER_CONTRACT_ERROR"})
                continue
            sources.append(result.get("source", {"provider": provider.name, "status": result.get("status", "UNKNOWN")}))
            events.extend(result.get("events", []))
            schedules.extend(result.get("schedules", []))
            provider_results.append({"events": result.get("events", []), "source": result.get("source", {})})
        reconciled = reconcile_events(provider_results)
        if reconciled["conflicts"]:
            return {"status": "CONFLICT", "confidence": "POOR", "evidence_type": "CONFLICT", "asset_identity": identity, "sources": sources, "conflicts": reconciled["conflicts"], "reason": "Independent unlock sources disagree", "risk_status": "BLOCKED", "risk_codes": ["TOK-12"]}
        events = reconciled["events"]
        if not events and not schedules:
            return {"status": "UNKNOWN", "confidence": "POOR", "evidence_type": "UNKNOWN", "asset_identity": identity, "sources": sources, "reason": "No verified unlock schedule found from configured providers", "risk_status": "REVIEW", "risk_codes": []}
        circulating = Decimal(str(candidate.details.get("market_snapshot", {}).get("circulating_supply") or 0))
        windows_raw = calculate_windows(events, schedules, now)
        windows = {str(days): {"tokens": str(windows_raw[str(days)]), "pct_circulating": float(round(windows_raw[str(days)] / circulating * Decimal("100"), 6)) if circulating else None} for days in (7, 30, 90)}
        next_events = sorted((e for e in events if e["event_date"] > now), key=lambda e: e["event_date"])
        risk_status, risk_codes = self._risk(windows, circulating, tokenomics)
        official = any(source.get("source_family") == "PROJECT_OFFICIAL" for source in sources)
        return {"status": "PASS" if official else "PROVISIONAL", "confidence": "HIGH" if official else "MEDIUM", "evidence_type": "VERIFIED_EVENT" if official else "PUBLIC_WEB", "asset_identity": identity,
                "unlock_7d": windows["7"], "unlock_30d": windows["30"], "unlock_90d": windows["90"],
                "next_unlock": next_events[0] if next_events else None, "sources": sources, "risk_status": risk_status, "risk_codes": risk_codes}
