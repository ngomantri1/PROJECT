"""Small, conservative public-web fetch/parser helpers for unlock evidence.

The parser intentionally accepts only explicit, machine-readable or tabular
data. It never infers an unlock from prose and never bypasses anti-bot gates.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx


DATE_RE = re.compile(r"(?<!\d)(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?!\d)")


class _TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._anchor_text: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._anchor_text = []
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []

    def handle_data(self, data):
        if self._anchor_text is not None:
            self._anchor_text.append(data)
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href:
            self.links.append((self._href, " ".join("".join(self._anchor_text or []).split())))
            self._href = None
            self._anchor_text = None
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None


def _parse_date(value: str):
    match = DATE_RE.search(value or "")
    if not match:
        return None
    try:
        return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def parse_public_unlock_html(html: str) -> list[dict]:
    """Extract only rows with an explicit date and token amount.

    Expected columns are identified by header names; arbitrary prose is
    ignored. This makes parser failures visible as UNKNOWN rather than false
    positives when a site changes its layout.
    """
    parser = _TableParser()
    parser.feed(html)
    rows = parser.rows
    if not rows:
        return []
    headers = [cell.lower() for cell in rows[0]]
    date_index = next((i for i, h in enumerate(headers) if "date" in h or "time" in h), None)
    amount_index = next((i for i, h in enumerate(headers) if "token" in h or "amount" in h or "unlock" in h), None)
    if date_index is None or amount_index is None:
        return []
    events = []
    for row in rows[1:]:
        if max(date_index, amount_index) >= len(row):
            continue
        event_date = _parse_date(row[date_index])
        amount = row[amount_index].replace(",", "").strip()
        if event_date is None or not re.fullmatch(r"\d+(?:\.\d+)?", amount):
            continue
        allocation = row[1] if len(row) > 1 and row[1] != row[date_index] else "UNKNOWN"
        events.append({"event_date": event_date.isoformat() + "+00:00", "token_amount": amount, "allocation": allocation, "event_type": "CLIFF"})
    return events


def parse_public_unlock_document(html: str) -> list[dict]:
    """Prefer explicit embedded JSON, then fall back to an explicit table."""
    for match in re.finditer(r"<script[^>]*>(.*?)</script>", html or "", re.I | re.S):
        text = match.group(1).strip()
        if not text or not text.startswith(("{", "[")):
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue
        candidates = payload if isinstance(payload, list) else payload.get("events", []) if isinstance(payload, dict) else []
        events = []
        for item in candidates:
            if not isinstance(item, dict):
                continue
            date = item.get("event_date") or item.get("date") or item.get("time")
            amount = item.get("token_amount") or item.get("amount") or item.get("tokens")
            if date and amount is not None and _parse_date(str(date)) is not None:
                events.append({"event_date": str(date).replace("Z", "+00:00"), "token_amount": str(amount), "allocation": item.get("allocation", "UNKNOWN"), "event_type": item.get("event_type", "CLIFF")})
        if events:
            return events
    return parse_public_unlock_html(html)


def discover_unlock_links(html: str) -> list[str]:
    parser = _TableParser()
    parser.feed(html or "")
    keywords = ("tokenomics", "tokenomic", "vesting", "unlock", "token schedule", "supply schedule")
    links = []
    for href, text in parser.links:
        if href.startswith(("http://", "https://")) and any(keyword in f"{href} {text}".lower() for keyword in keywords):
            if href not in links:
                links.append(href)
    return links[:10]


class PublicWebCrawler:
    def __init__(self, *, timeout=10.0, user_agent="CoinSpotScanner/8.1 public-evidence"):
        self.timeout = timeout
        self.headers = {"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml"}

    def fetch(self, url: str) -> dict:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return {"status": "UNKNOWN", "error_code": "INVALID_URL", "url": url}
        try:
            response = httpx.get(url, headers=self.headers, timeout=self.timeout, follow_redirects=True)
        except httpx.HTTPError as exc:
            return {"status": "UNKNOWN", "error_code": type(exc).__name__, "url": url}
        if response.status_code in {401, 403, 429}:
            return {"status": "UNKNOWN", "error_code": f"HTTP_{response.status_code}", "url": str(response.url)}
        if response.status_code >= 400:
            return {"status": "UNKNOWN", "error_code": f"HTTP_{response.status_code}", "url": str(response.url)}
        return {"status": "FETCHED", "url": str(response.url), "content_type": response.headers.get("content-type", ""), "body": response.text}

    @staticmethod
    def parse(result: dict) -> list[dict]:
        if result.get("status") != "FETCHED":
            return []
        return parse_public_unlock_document(result.get("body", ""))
