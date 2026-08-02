from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from src.license_client import LicenseBackendError, LicenseService


_PBKDF2_ITERATIONS = 310_000


@dataclass(frozen=True)
class ToolSession:
    username: str
    session_id: str
    expires_at: datetime
    plan: str = "local"


class ToolAuthService:
    """Local Tool-account authentication; game credentials are intentionally separate."""

    def __init__(
        self,
        *,
        store_path: str | Path = "data/tool_accounts.json",
        bootstrap_username: str = "toolbet",
        bootstrap_password: str = "toolbet",
        session_timeout_minutes: int = 480,
        enabled: bool = True,
        license_service: LicenseService | None = None,
    ):
        self.enabled = bool(enabled)
        self._store_path = Path(store_path)
        self._bootstrap_username = (bootstrap_username or "").strip()
        self._bootstrap_password = bootstrap_password or ""
        self._timeout = timedelta(minutes=max(1, int(session_timeout_minutes)))
        self._session: ToolSession | None = None
        self._license = license_service
        self._last_error = ""
        if self._license is not None:
            decision = self._license.decision("workspace")
            lease = decision.lease
            if decision.allowed and lease is not None:
                self._session = ToolSession(
                    username=lease.username,
                    session_id=secrets.token_urlsafe(24),
                    expires_at=lease.refresh_until.astimezone().replace(
                        tzinfo=None
                    ),
                    plan=lease.plan,
                )

    @property
    def suggested_username(self) -> str:
        if self._license and self._license.suggested_username:
            return self._license.suggested_username
        return self._bootstrap_username

    @property
    def license_enabled(self) -> bool:
        return self._license is not None

    @property
    def last_error(self) -> str:
        return self._last_error or (
            self._license.last_error if self._license else ""
        )

    @property
    def session(self) -> ToolSession | None:
        return self._session if self.is_authenticated() else None

    def _read_store(self) -> dict:
        if not self._store_path.exists():
            return {"version": 1, "accounts": {}}
        try:
            raw = json.loads(self._store_path.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and isinstance(raw.get("accounts"), dict):
                return raw
        except (OSError, json.JSONDecodeError):
            pass
        return {"version": 1, "accounts": {}}

    def _write_store(self, store: dict) -> None:
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        self._store_path.write_text(
            json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    @staticmethod
    def _hash_password(password: str, salt: bytes) -> str:
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
        )
        return base64.b64encode(digest).decode("ascii")

    @staticmethod
    def _account_key(username: str) -> str:
        return username.strip().casefold()

    def _ensure_bootstrap_account(self) -> None:
        if not self.enabled or not self._bootstrap_username or not self._bootstrap_password:
            return
        store = self._read_store()
        accounts = store.setdefault("accounts", {})
        key = self._account_key(self._bootstrap_username)
        if key in accounts:
            return
        salt = secrets.token_bytes(16)
        accounts[key] = {
            "username": self._bootstrap_username,
            "salt": base64.b64encode(salt).decode("ascii"),
            "password_hash": self._hash_password(self._bootstrap_password, salt),
            "created_at": datetime.now().isoformat(timespec="seconds"),
        }
        self._write_store(store)

    def authenticate(self, username: str, password: str) -> ToolSession | None:
        user = (username or "").strip()
        if self._license is not None:
            if not user or not password:
                return None
            try:
                lease = self._license.login(user, password)
            except LicenseBackendError as exc:
                self._last_error = str(exc)
                return None
            self._last_error = ""
            self._session = ToolSession(
                username=lease.username,
                session_id=secrets.token_urlsafe(24),
                expires_at=lease.refresh_until.astimezone().replace(tzinfo=None),
                plan=lease.plan,
            )
            return self._session
        if not self.enabled:
            self._session = ToolSession(
                username="disabled-auth",
                session_id="disabled-auth",
                expires_at=datetime.max,
            )
            return self._session
        if not user or not password:
            return None
        self._ensure_bootstrap_account()
        account = self._read_store().get("accounts", {}).get(self._account_key(user))
        if not isinstance(account, dict):
            return None
        try:
            salt = base64.b64decode(str(account.get("salt") or ""), validate=True)
            expected = str(account.get("password_hash") or "")
            actual = self._hash_password(password, salt)
        except Exception:
            return None
        if not expected or not hmac.compare_digest(actual, expected):
            return None
        self._session = ToolSession(
            username=str(account.get("username") or user),
            session_id=secrets.token_urlsafe(24),
            expires_at=datetime.now() + self._timeout,
        )
        return self._session

    def is_authenticated(self) -> bool:
        local_valid = bool(
            self._session and self._session.expires_at > datetime.now()
        )
        if not local_valid:
            return False
        return self.can("workspace")

    def can(self, capability: str) -> bool:
        if self._session is None:
            return False
        if self._license is None:
            return self._session.expires_at > datetime.now()
        return self._license.decision(capability).allowed

    def license_status(self) -> dict:
        if self._license is None:
            return {
                "allowed": self.is_authenticated(),
                "status": "disabled",
                "reason": "Đang dùng Tool account local",
                "capability": "",
                "username": self._session.username if self._session else "",
                "plan": "local",
                "capabilities": ["workspace", "simulation", "live_bet"],
                "expires_at": (
                    self._session.expires_at.isoformat()
                    if self._session
                    else ""
                ),
            }
        return self._license.status()

    def refresh_license(self, *, force: bool = False) -> bool:
        if self._license is None:
            return self.is_authenticated()
        return self._license.refresh(force=force)

    def require_session(self) -> ToolSession:
        session = self.session
        if session is None:
            raise PermissionError("Tool session chưa hợp lệ")
        return session

    def logout(self) -> None:
        if self._license is not None:
            self._license.logout()
        self._session = None
