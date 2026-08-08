"""Optional public-web unlock provider.

It is deliberately disabled unless UNLOCK_WEB_CRAWL_ENABLED=true. A public
page is secondary evidence; it is never upgraded to verified official data.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json

from ..models import UnlockProviderSnapshot
from .web import PublicWebCrawler, discover_unlock_links


class PublicWebUnlockProvider:
    name = "PUBLIC_WEB_UNLOCK"

    def __init__(self, crawler=None):
        self.crawler = crawler or PublicWebCrawler()

    @staticmethod
    def enabled():
        return os.getenv("UNLOCK_WEB_CRAWL_ENABLED", "false").lower() in {"1", "true", "yes"}

    @staticmethod
    def urls(identity):
        urls = identity.get("unlock_urls") or []
        if isinstance(urls, str):
            urls = [urls]
        return [url for url in urls if isinstance(url, str) and url.startswith(("http://", "https://"))]

    def discover_urls(self, identity):
        coingecko_url = f"https://www.coingecko.com/en/coins/{identity['coingecko_id']}"
        fetched = self.crawler.fetch(coingecko_url)
        if fetched.get("status") != "FETCHED":
            return []
        return [url for url in discover_unlock_links(fetched.get("body", "")) if "coingecko.com" not in url]

    def fetch(self, identity, now):
        identity_key = f"coingecko:{identity['coingecko_id']}"
        cached = UnlockProviderSnapshot.objects.filter(identity_key=identity_key, provider=self.name, expires_at__gt=now).order_by("-fetched_at").first()
        if cached:
            return cached.normalized_payload
        urls = self.urls(identity) or self.discover_urls(identity)
        if not urls:
            result = {"status": "UNKNOWN", "events": [], "source": {"provider": self.name, "status": "NO_DISCOVERED_UNLOCK_URL"}}
            UnlockProviderSnapshot.objects.create(identity_key=identity_key, provider=self.name, status="UNKNOWN", fetched_at=now, expires_at=now + timedelta(hours=1), normalized_payload=result)
            return result
        for url in urls:
            fetched = self.crawler.fetch(url)
            events = self.crawler.parse(fetched)
            if not events:
                continue
            # A public page must expose a schedule far enough ahead; a single
            # near-term event is not evidence that the future is covered.
            future_dates = [datetime.fromisoformat(event["event_date"]) for event in events]
            if max(future_dates) < now + timedelta(days=90):
                continue
            result = {"status": "PROVISIONAL", "events": events, "schedules": [], "source": {"provider": self.name, "source_family": "PUBLIC_WEB", "source_type": "PUBLIC_WEB", "source_url": fetched["url"], "status": "PARSED"}}
            UnlockProviderSnapshot.objects.create(identity_key=identity_key, provider=self.name, status="PROVISIONAL", evidence_type="PUBLIC_WEB", confidence="MEDIUM", source_url=fetched["url"], fetched_at=now, expires_at=now + timedelta(hours=6), payload_hash=sha256(json.dumps(result, sort_keys=True).encode()).hexdigest(), normalized_payload=result)
            return result
        result = {"status": "UNKNOWN", "events": [], "source": {"provider": self.name, "status": "NO_PARSEABLE_UNLOCK_DATA"}}
        UnlockProviderSnapshot.objects.create(identity_key=identity_key, provider=self.name, status="UNKNOWN", fetched_at=now, expires_at=now + timedelta(hours=1), normalized_payload=result)
        return result
