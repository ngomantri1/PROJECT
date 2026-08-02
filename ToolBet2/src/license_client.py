"""License client: remote authentication, signed lease verification and grace."""

from __future__ import annotations

import json
import logging
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable, Protocol
from urllib.parse import urlparse

from src.device_identity import device_fingerprint
from src.license_contracts import (
    LicenseDecision,
    LicenseLease,
    LicenseStatus,
    SignedLease,
    format_utc,
    utc_now,
    verify_signed_lease,
)
from src.secure_token_store import SecureTokenStore


logger = logging.getLogger(__name__)


class LicenseBackendError(RuntimeError):
    def __init__(self, message: str, *, code: str = "unavailable"):
        super().__init__(message)
        self.code = str(code or "unavailable")


@dataclass(frozen=True, slots=True)
class LicenseBackendResponse:
    signed_lease: dict
    refresh_token: str


class LicenseBackend(Protocol):
    def login(
        self, username: str, password: str, device_id: str
    ) -> LicenseBackendResponse: ...

    def refresh(
        self, refresh_token: str, device_id: str
    ) -> LicenseBackendResponse: ...

    def logout(self, refresh_token: str, device_id: str) -> None: ...


class HttpLicenseBackend:
    def __init__(self, api_url: str, *, timeout_seconds: float = 8.0):
        base = str(api_url or "").strip().rstrip("/")
        parsed = urlparse(base)
        is_local = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
        if parsed.scheme != "https" and not (
            parsed.scheme == "http" and is_local
        ):
            raise ValueError("license api_url must use HTTPS (HTTP only for localhost)")
        self.api_url = base
        self.timeout_seconds = max(1.0, float(timeout_seconds))

    def _post(self, path: str, payload: dict) -> dict:
        request = urllib.request.Request(
            f"{self.api_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(
                request,
                timeout=self.timeout_seconds,
                context=ssl.create_default_context(),
            ) as response:
                raw = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode("utf-8"))
            except Exception:
                detail = {}
            raise LicenseBackendError(
                str(detail.get("error") or f"License server HTTP {exc.code}"),
                code=str(detail.get("code") or "rejected"),
            ) from exc
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            raise LicenseBackendError(
                "Không kết nối được license server", code="unavailable"
            ) from exc
        if not isinstance(raw, dict):
            raise LicenseBackendError("License server trả dữ liệu không hợp lệ")
        return raw

    @staticmethod
    def _response(raw: dict) -> LicenseBackendResponse:
        signed = raw.get("lease")
        token = str(raw.get("refresh_token") or "")
        if not isinstance(signed, dict) or not token:
            raise LicenseBackendError("License server response thiếu lease/token")
        return LicenseBackendResponse(signed_lease=signed, refresh_token=token)

    def login(
        self, username: str, password: str, device_id: str
    ) -> LicenseBackendResponse:
        return self._response(
            self._post(
                "/v1/auth/login",
                {
                    "username": username,
                    "password": password,
                    "device_id": device_id,
                },
            )
        )

    def refresh(
        self, refresh_token: str, device_id: str
    ) -> LicenseBackendResponse:
        return self._response(
            self._post(
                "/v1/auth/refresh",
                {
                    "refresh_token": refresh_token,
                    "device_id": device_id,
                },
            )
        )

    def logout(self, refresh_token: str, device_id: str) -> None:
        self._post(
            "/v1/auth/logout",
            {"refresh_token": refresh_token, "device_id": device_id},
        )


class LicenseService:
    """Fail-closed capability gate backed by a server-signed short lease."""

    def __init__(
        self,
        backend: LicenseBackend,
        *,
        public_key_pem: bytes,
        cache_path: str | Path = "data/license_session.bin",
        device_id: str | None = None,
        grace_minutes: int = 60,
        refresh_before_minutes: int = 5,
        now_provider: Callable[[], datetime] = utc_now,
        allow_plaintext_cache_for_tests: bool = False,
    ):
        self.backend = backend
        self.public_key_pem = bytes(public_key_pem)
        self.device_id = device_id or device_fingerprint()
        self.grace = timedelta(minutes=max(0, int(grace_minutes)))
        self.refresh_before = timedelta(
            minutes=max(1, int(refresh_before_minutes))
        )
        self._now = now_provider
        self._store = SecureTokenStore(
            cache_path,
            allow_plaintext_for_tests=allow_plaintext_cache_for_tests,
        )
        self._signed: SignedLease | None = None
        self._lease: LicenseLease | None = None
        self._refresh_token = ""
        self._last_error = ""
        self._explicit_block: LicenseStatus | None = None
        self.restore()

    @property
    def suggested_username(self) -> str:
        return self._lease.username if self._lease else ""

    @property
    def lease(self) -> LicenseLease | None:
        return self._lease

    @property
    def last_error(self) -> str:
        return self._last_error

    def _validate_envelope(self, raw: dict) -> tuple[SignedLease, LicenseLease]:
        signed = SignedLease.from_dict(raw)
        lease = verify_signed_lease(signed, self.public_key_pem)
        if lease.device_id != self.device_id:
            raise LicenseBackendError(
                "License không thuộc thiết bị này", code="device_mismatch"
            )
        return signed, lease

    def _save(self) -> None:
        if not self._signed or not self._refresh_token:
            return
        self._store.save(
            {
                "device_id": self.device_id,
                "lease": self._signed.to_dict(),
                "refresh_token": self._refresh_token,
            }
        )

    def restore(self) -> bool:
        payload = self._store.load()
        if not isinstance(payload, dict):
            return False
        if str(payload.get("device_id") or "") != self.device_id:
            self._store.clear()
            self._explicit_block = LicenseStatus.DEVICE_MISMATCH
            self._last_error = "Dữ liệu license được tạo trên thiết bị khác"
            return False
        try:
            signed, lease = self._validate_envelope(payload.get("lease") or {})
            token = str(payload.get("refresh_token") or "")
            if not token:
                raise ValueError("missing refresh token")
        except (TypeError, ValueError, LicenseBackendError):
            self._store.clear()
            self._explicit_block = LicenseStatus.INVALID_SIGNATURE
            self._last_error = "Cache license không hợp lệ"
            return False
        self._signed = signed
        self._lease = lease
        self._refresh_token = token
        return True

    def login(self, username: str, password: str) -> LicenseLease:
        response = self.backend.login(username, password, self.device_id)
        signed, lease = self._validate_envelope(response.signed_lease)
        now = self._now()
        if lease.expires_at <= now:
            raise LicenseBackendError("License server cấp lease đã hết hạn")
        self._signed = signed
        self._lease = lease
        self._refresh_token = response.refresh_token
        self._last_error = ""
        self._explicit_block = None
        self._save()
        return lease

    def _mark_backend_rejection(self, exc: LicenseBackendError) -> None:
        self._last_error = str(exc)
        mapping = {
            "revoked": LicenseStatus.REVOKED,
            "expired": LicenseStatus.EXPIRED,
            "device_mismatch": LicenseStatus.DEVICE_MISMATCH,
        }
        blocked = mapping.get(exc.code)
        if blocked:
            self._explicit_block = blocked
            self._signed = None
            self._lease = None
            self._refresh_token = ""
            self._store.clear()

    def refresh(self, *, force: bool = False) -> bool:
        lease = self._lease
        if not lease or not self._refresh_token:
            return False
        now = self._now()
        if not force and now < lease.expires_at - self.refresh_before:
            return True
        try:
            response = self.backend.refresh(
                self._refresh_token, self.device_id
            )
            signed, refreshed = self._validate_envelope(response.signed_lease)
        except LicenseBackendError as exc:
            self._mark_backend_rejection(exc)
            return False
        except (TypeError, ValueError):
            self._last_error = "License server trả lease có chữ ký không hợp lệ"
            self._explicit_block = LicenseStatus.INVALID_SIGNATURE
            self._signed = None
            self._lease = None
            self._refresh_token = ""
            self._store.clear()
            return False
        self._signed = signed
        self._lease = refreshed
        self._refresh_token = response.refresh_token
        self._last_error = ""
        self._explicit_block = None
        self._save()
        return True

    def decision(self, capability: str = "workspace") -> LicenseDecision:
        capability = str(capability or "").strip()
        if self._explicit_block:
            return LicenseDecision(
                False,
                self._explicit_block,
                self._last_error or "License đã bị chặn",
                capability,
            )
        lease = self._lease
        if lease is None:
            return LicenseDecision(
                False,
                LicenseStatus.LOGGED_OUT,
                "Chưa đăng nhập license",
                capability,
            )
        now = self._now()
        grace_until = min(lease.refresh_until, lease.expires_at + self.grace)
        if now > grace_until:
            return LicenseDecision(
                False,
                LicenseStatus.EXPIRED,
                "License/khung offline đã hết hạn",
                capability,
                lease,
            )
        if capability and capability not in lease.capabilities:
            return LicenseDecision(
                False,
                LicenseStatus.CAPABILITY_MISSING,
                f"Gói {lease.plan} không có quyền {capability}",
                capability,
                lease,
            )
        if now > lease.expires_at:
            return LicenseDecision(
                True,
                LicenseStatus.GRACE,
                f"Đang dùng offline grace đến {format_utc(grace_until)}",
                capability,
                lease,
            )
        return LicenseDecision(
            True,
            LicenseStatus.VALID,
            "License hợp lệ",
            capability,
            lease,
        )

    def status(self) -> dict:
        return self.decision("workspace").to_dict()

    def logout(self) -> None:
        token = self._refresh_token
        if token:
            try:
                self.backend.logout(token, self.device_id)
            except LicenseBackendError:
                pass
        self._signed = None
        self._lease = None
        self._refresh_token = ""
        self._last_error = ""
        self._explicit_block = None
        self._store.clear()
