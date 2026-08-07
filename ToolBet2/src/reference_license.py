"""Adapter for the BaccaratChromeAgent2 GitHub license and Worker lease.

The reference service exposes a small ``{exp, pass}`` JSON document and a
single-active-device lease.  This adapter deliberately keeps the password,
lease identifiers and device fingerprint in memory only; none are logged or
written to the ToolBet database.
"""

from __future__ import annotations

import hmac
import json
import logging
import os
import secrets
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote, urlparse

from src.device_identity import baccarat_chrome_agent_device_fingerprint
from src.license_client import LicenseBackendError
from src.license_contracts import (
    LicenseDecision,
    LicenseLease,
    LicenseStatus,
    format_utc,
    utc_now,
)


logger = logging.getLogger(__name__)

# Cloudflare's edge rules reject urllib's automatic ``Python-urllib/...``
# signature.  BaccaratChromeAgent2 uses .NET HttpClient, so identify requests
# with the same application family instead of exposing the Python runtime.
REFERENCE_USER_AGENT = "BaccaratChromeAgent"


def _valid_client_id(value: str) -> bool:
    normalized = str(value or "").strip().casefold()
    return len(normalized) == 32 and all(ch in "0123456789abcdef" for ch in normalized)


def _baccarat_chrome_agent_client_id() -> str:
    """Read the existing reference client identity without exposing its value."""

    app_data = os.environ.get("LOCALAPPDATA")
    if not app_data:
        return ""
    source = Path(app_data) / "BaccaratChromeAgent" / "config.json"
    try:
        raw = json.loads(source.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError, json.JSONDecodeError):
        return ""

    def find(value: Any) -> str:
        if isinstance(value, dict):
            candidate = str(value.get("LeaseClientId") or "").strip()
            if _valid_client_id(candidate):
                return candidate
            for child in value.values():
                found = find(child)
                if found:
                    return found
        elif isinstance(value, list):
            for child in value:
                found = find(child)
                if found:
                    return found
        return ""

    return find(raw)


def _persistent_client_id(path: str | None) -> str:
    """Use the same stable-per-install client identity as the C# reference."""

    target = Path(str(path or "").strip()) if path else None
    imported = _baccarat_chrome_agent_client_id()
    if imported:
        if target is not None:
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(imported, encoding="utf-8")
            except OSError:
                pass
        logger.info("[REFERENCE_LICENSE] imported reference client identity")
        return imported
    if target is not None:
        try:
            saved = target.read_text(encoding="utf-8").strip()
            if _valid_client_id(saved):
                return saved
        except OSError:
            pass
    value = secrets.token_hex(16)
    if target is not None:
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(value, encoding="utf-8")
        except OSError:
            pass
    return value


def _parse_expiry(value: Any) -> datetime:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    text = str(value or "").strip()
    if not text:
        raise ValueError("license expiry is missing")
    if text.isdigit():
        return datetime.fromtimestamp(float(text), tz=timezone.utc)
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    return (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


class ReferenceLicenseService:
    """Fail-closed client for the operational BaccaratChromeAgent2 backend."""

    def __init__(
        self,
        *,
        github_raw_base_url: str,
        github_owner: str,
        github_repo: str,
        github_branch: str,
        github_license_path: str,
        lease_base_url: str,
        app_id: str,
        timeout_seconds: float = 8.0,
        heartbeat_seconds: int = 60,
        client_id_path: str | None = "data/reference_license_client_id.txt",
        device_id: str | None = None,
        client_id: str | None = None,
        session_id: str | None = None,
        now_provider: Callable[[], datetime] = utc_now,
        github_fetcher: Callable[[str], dict[str, Any]] | None = None,
        lease_requester: Callable[[str, str, dict[str, Any]], dict[str, Any]] | None = None,
    ):
        self.github_base = str(github_raw_base_url or "").rstrip("/")
        self.github_owner = str(github_owner or "").strip()
        self.github_repo = str(github_repo or "").strip()
        self.github_branch = str(github_branch or "").strip()
        self.github_path = str(github_license_path or "auto").strip("/")
        self.lease_base = str(lease_base_url or "").rstrip("/")
        self.app_id = str(app_id or "BaccaratChromeAgent").strip() or "BaccaratChromeAgent"
        self.timeout_seconds = max(1.0, float(timeout_seconds))
        self.heartbeat_seconds = max(15, int(heartbeat_seconds))
        self.device_id = device_id or baccarat_chrome_agent_device_fingerprint()
        self.client_id = client_id or _persistent_client_id(client_id_path)
        self.session_id = session_id or secrets.token_hex(16)
        self._now = now_provider
        self._github_fetcher = github_fetcher
        self._lease_requester = lease_requester
        self._lease: LicenseLease | None = None
        self._username = ""
        self._last_error = ""
        self._explicit_block: LicenseStatus | None = None
        self._last_heartbeat: datetime | None = None

        for url, name in ((self.github_base, "github_raw_base_url"), (self.lease_base, "lease_base_url")):
            parsed = urlparse(url)
            if parsed.scheme != "https" or not parsed.netloc:
                raise ValueError(f"{name} must use HTTPS")

    @property
    def suggested_username(self) -> str:
        return self._username

    @property
    def lease(self) -> LicenseLease | None:
        return self._lease

    @property
    def last_error(self) -> str:
        return self._last_error

    def _license_url(self, username: str) -> str:
        return "/".join((self.github_base, self.github_owner, self.github_repo, self.github_branch, self.github_path, f"{quote(username, safe='')}.json"))

    def _fetch_license(self, username: str) -> dict[str, Any]:
        url = self._license_url(username)
        if self._github_fetcher:
            raw = self._github_fetcher(url)
        else:
            request = urllib.request.Request(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": REFERENCE_USER_AGENT,
                },
                method="GET",
            )
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_seconds, context=ssl.create_default_context()) as response:
                    raw = json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                raise LicenseBackendError("License không tồn tại hoặc đã bị từ chối", code="rejected") from exc
            except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
                raise LicenseBackendError("Không kết nối được nguồn license", code="unavailable") from exc
        if not isinstance(raw, dict):
            raise LicenseBackendError("License trả dữ liệu không hợp lệ", code="rejected")
        return raw

    def _worker(self, action: str, username: str) -> dict[str, Any]:
        payload = {"clientId": self.client_id, "sessionId": self.session_id, "deviceId": self.device_id, "appId": self.app_id}
        url = f"{self.lease_base}/{action}/{quote(username, safe='')}"
        if self._lease_requester:
            try:
                return self._lease_requester(action, username, payload)
            except LicenseBackendError:
                raise
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": REFERENCE_USER_AGENT,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds, context=ssl.create_default_context()) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            code = "account_in_use" if exc.code == 409 else "rejected"
            # The Worker may return the exact policy reason in JSON.  Keep only
            # non-sensitive diagnostic fields; never log the response body
            # wholesale because it may contain lease identifiers.
            reason = ""
            try:
                body = exc.read().decode("utf-8", errors="replace")
                parsed = json.loads(body) if body else {}
                if isinstance(parsed, dict):
                    for key in ("code", "error", "reason", "message"):
                        value = parsed.get(key)
                        if isinstance(value, (str, int, float, bool)):
                            reason = str(value)[:160]
                            if reason:
                                break
            except (OSError, UnicodeError, ValueError, json.JSONDecodeError):
                pass
            logger.warning(
                "[REFERENCE_LICENSE] worker=%s http_status=%s reason=%s",
                action,
                exc.code,
                reason or "unknown",
            )
            message = (
                "Tài khoản đang được sử dụng trên thiết bị khác (HTTP 409)"
                if exc.code == 409
                else f"Lease license bị từ chối (HTTP {exc.code})"
            )
            raise LicenseBackendError(message, code=code) from exc
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            logger.warning("[REFERENCE_LICENSE] worker=%s unavailable", action)
            raise LicenseBackendError("Không kết nối được máy chủ lease", code="unavailable") from exc

    def _build_lease(self, username: str, expiry: datetime) -> LicenseLease:
        now = self._now().astimezone(timezone.utc)
        if expiry <= now:
            raise LicenseBackendError("License đã hết hạn", code="expired")
        return LicenseLease(lease_id=secrets.token_hex(16), account_id=username.casefold(), username=username, plan="reference", capabilities=frozenset({"workspace", "simulation", "live_bet"}), device_id=self.device_id, issued_at=now, expires_at=expiry, refresh_until=expiry)

    def login(self, username: str, password: str) -> LicenseLease:
        user = str(username or "").strip()
        if not user or not password:
            raise LicenseBackendError("Thiếu tài khoản hoặc mật khẩu", code="rejected")
        raw = self._fetch_license(user)
        expected = str(raw.get("pass") or "")
        if not expected or not hmac.compare_digest(expected, str(password)):
            raise LicenseBackendError("Tài khoản hoặc mật khẩu không đúng", code="rejected")
        expiry = _parse_expiry(raw.get("exp"))
        try:
            self._worker("acquire", user)
        except LicenseBackendError as exc:
            self._mark_error(exc)
            raise
        try:
            self._lease = self._build_lease(user, expiry)
        except LicenseBackendError as exc:
            self._mark_error(exc)
            raise
        self._username = user
        self._last_error = ""
        self._explicit_block = None
        self._last_heartbeat = self._now()
        return self._lease

    def _mark_error(self, exc: LicenseBackendError) -> None:
        self._last_error = str(exc)
        self._explicit_block = LicenseStatus.ACCOUNT_IN_USE if exc.code == "account_in_use" else LicenseStatus.EXPIRED if exc.code == "expired" else LicenseStatus.UNAVAILABLE

    def refresh(self, *, force: bool = False) -> bool:
        lease = self._lease
        if lease is None:
            return False
        now = self._now().astimezone(timezone.utc)
        if now >= lease.expires_at:
            self._mark_error(LicenseBackendError("License đã hết hạn", code="expired"))
            return False
        if not force and self._last_heartbeat and (now - self._last_heartbeat).total_seconds() < self.heartbeat_seconds:
            return True
        try:
            self._worker("heartbeat", self._username)
            raw = self._fetch_license(self._username)
            expiry = _parse_expiry(raw.get("exp"))
            if expiry <= now:
                raise LicenseBackendError("License đã hết hạn", code="expired")
            self._lease = LicenseLease(lease_id=lease.lease_id, account_id=lease.account_id, username=lease.username, plan=lease.plan, capabilities=lease.capabilities, device_id=lease.device_id, issued_at=lease.issued_at, expires_at=expiry, refresh_until=expiry)
            self._last_heartbeat = now
            self._last_error = ""
            self._explicit_block = None
            return True
        except (LicenseBackendError, ValueError) as exc:
            error = exc if isinstance(exc, LicenseBackendError) else LicenseBackendError("License trả ngày hết hạn không hợp lệ", code="rejected")
            self._mark_error(error)
            return False

    def decision(self, capability: str = "workspace") -> LicenseDecision:
        capability = str(capability or "").strip()
        if self._explicit_block:
            return LicenseDecision(False, self._explicit_block, self._last_error or "License bị chặn", capability, self._lease)
        lease = self._lease
        if lease is None:
            return LicenseDecision(False, LicenseStatus.LOGGED_OUT, "Chưa đăng nhập license", capability)
        now = self._now().astimezone(timezone.utc)
        if now >= lease.expires_at:
            return LicenseDecision(False, LicenseStatus.EXPIRED, "License đã hết hạn", capability, lease)
        if capability and capability not in lease.capabilities:
            return LicenseDecision(False, LicenseStatus.CAPABILITY_MISSING, f"Gói {lease.plan} không có quyền {capability}", capability, lease)
        return LicenseDecision(True, LicenseStatus.VALID, "License hợp lệ và lease đang hoạt động", capability, lease)

    def status(self) -> dict[str, Any]:
        return self.decision("workspace").to_dict()

    def logout(self) -> None:
        if self._username:
            try:
                self._worker("release", self._username)
            except LicenseBackendError:
                pass
        self._lease = None
        self._username = ""
        self._last_error = ""
        self._explicit_block = None
        self._last_heartbeat = None
