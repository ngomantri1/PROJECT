"""Standalone license authority. This module must not be shipped to clients."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from src.license_contracts import (
    SignedLease,
    format_utc,
    parse_utc,
    sign_lease,
    utc_now,
)


_PBKDF2_ITERATIONS = 310_000


class LicenseAuthorityError(RuntimeError):
    def __init__(self, message: str, *, code: str, http_status: int = 403):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


@dataclass(frozen=True, slots=True)
class AuthorityResponse:
    lease: SignedLease
    refresh_token: str

    def to_dict(self) -> dict:
        return {
            "lease": self.lease.to_dict(),
            "refresh_token": self.refresh_token,
        }


class LicenseAuthorityStore:
    """SQLite authority with password hashing, device slots and token rotation."""

    def __init__(
        self,
        database_path: str | Path,
        *,
        private_key_pem: bytes,
        lease_minutes: int = 15,
        refresh_days: int = 30,
        now_provider: Callable[[], datetime] = utc_now,
    ):
        self.database_path = Path(database_path)
        self.private_key_pem = bytes(private_key_pem)
        self.lease_duration = timedelta(minutes=max(1, int(lease_minutes)))
        self.refresh_duration = timedelta(days=max(1, int(refresh_days)))
        self._now = now_provider
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.database_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS license_accounts (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    salt TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    disabled INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS license_entitlements (
                    account_id TEXT PRIMARY KEY REFERENCES license_accounts(id),
                    plan TEXT NOT NULL,
                    capabilities_json TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    max_devices INTEGER NOT NULL DEFAULT 1,
                    revoked INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS license_devices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id TEXT NOT NULL REFERENCES license_accounts(id),
                    device_id TEXT NOT NULL,
                    activated_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    revoked INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(account_id, device_id)
                );
                CREATE TABLE IF NOT EXISTS license_refresh_tokens (
                    token_hash TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL REFERENCES license_accounts(id),
                    device_id TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    revoked INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    replaced_by TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS license_audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id TEXT NOT NULL DEFAULT '',
                    device_id TEXT NOT NULL DEFAULT '',
                    event_type TEXT NOT NULL,
                    detail_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                );
                """
            )

    @staticmethod
    def _hash_password(password: str, salt: bytes) -> str:
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt, _PBKDF2_ITERATIONS
        )
        return base64.b64encode(digest).decode("ascii")

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _audit(
        self,
        conn: sqlite3.Connection,
        event_type: str,
        *,
        account_id: str = "",
        device_id: str = "",
        detail: dict | None = None,
    ) -> None:
        conn.execute(
            """
            INSERT INTO license_audit
                (account_id, device_id, event_type, detail_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                account_id,
                device_id,
                event_type,
                json.dumps(detail or {}, sort_keys=True),
                format_utc(self._now()),
            ),
        )

    def upsert_account(
        self,
        username: str,
        password: str,
        *,
        plan: str,
        capabilities: list[str],
        expires_at: datetime,
        max_devices: int = 1,
    ) -> str:
        username = str(username or "").strip()
        if not username or not password:
            raise ValueError("username and password are required")
        account_id = uuid.uuid4().hex
        salt = secrets.token_bytes(16)
        now = format_utc(self._now())
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id FROM license_accounts WHERE username = ? COLLATE NOCASE",
                (username,),
            ).fetchone()
            if existing:
                account_id = str(existing["id"])
                conn.execute(
                    """
                    UPDATE license_accounts
                    SET salt=?, password_hash=?, disabled=0
                    WHERE id=?
                    """,
                    (
                        base64.b64encode(salt).decode("ascii"),
                        self._hash_password(password, salt),
                        account_id,
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO license_accounts
                        (id, username, salt, password_hash, disabled, created_at)
                    VALUES (?, ?, ?, ?, 0, ?)
                    """,
                    (
                        account_id,
                        username,
                        base64.b64encode(salt).decode("ascii"),
                        self._hash_password(password, salt),
                        now,
                    ),
                )
            conn.execute(
                """
                INSERT INTO license_entitlements
                    (account_id, plan, capabilities_json, expires_at,
                     max_devices, revoked, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT(account_id) DO UPDATE SET
                    plan=excluded.plan,
                    capabilities_json=excluded.capabilities_json,
                    expires_at=excluded.expires_at,
                    max_devices=excluded.max_devices,
                    revoked=0,
                    updated_at=excluded.updated_at
                """,
                (
                    account_id,
                    plan,
                    json.dumps(sorted(set(capabilities))),
                    format_utc(expires_at),
                    max(1, int(max_devices)),
                    now,
                ),
            )
            self._audit(
                conn,
                "account_upsert",
                account_id=account_id,
                detail={"plan": plan, "max_devices": max_devices},
            )
        return account_id

    def _load_identity(
        self, conn: sqlite3.Connection, account_id: str
    ) -> sqlite3.Row:
        row = conn.execute(
            """
            SELECT a.id, a.username, a.disabled, e.plan,
                   e.capabilities_json, e.expires_at,
                   e.max_devices, e.revoked
            FROM license_accounts a
            JOIN license_entitlements e ON e.account_id = a.id
            WHERE a.id = ?
            """,
            (account_id,),
        ).fetchone()
        if row is None:
            raise LicenseAuthorityError(
                "Tài khoản chưa có license", code="expired"
            )
        if row["disabled"] or row["revoked"]:
            raise LicenseAuthorityError(
                "License đã bị thu hồi", code="revoked"
            )
        if parse_utc(str(row["expires_at"])) <= self._now():
            raise LicenseAuthorityError("License đã hết hạn", code="expired")
        return row

    def _activate_device(
        self, conn: sqlite3.Connection, row: sqlite3.Row, device_id: str
    ) -> None:
        current = conn.execute(
            """
            SELECT revoked FROM license_devices
            WHERE account_id=? AND device_id=?
            """,
            (row["id"], device_id),
        ).fetchone()
        now = format_utc(self._now())
        if current:
            if current["revoked"]:
                raise LicenseAuthorityError(
                    "Thiết bị đã bị thu hồi", code="device_mismatch"
                )
            conn.execute(
                """
                UPDATE license_devices SET last_seen_at=?
                WHERE account_id=? AND device_id=?
                """,
                (now, row["id"], device_id),
            )
            return
        active_count = conn.execute(
            """
            SELECT COUNT(*) FROM license_devices
            WHERE account_id=? AND revoked=0
            """,
            (row["id"],),
        ).fetchone()[0]
        if int(active_count) >= int(row["max_devices"]):
            raise LicenseAuthorityError(
                "Tài khoản đã đủ số thiết bị được phép",
                code="device_mismatch",
            )
        conn.execute(
            """
            INSERT INTO license_devices
                (account_id, device_id, activated_at, last_seen_at, revoked)
            VALUES (?, ?, ?, ?, 0)
            """,
            (row["id"], device_id, now, now),
        )
        self._audit(
            conn,
            "device_activated",
            account_id=row["id"],
            device_id=device_id,
        )

    def _issue(
        self,
        conn: sqlite3.Connection,
        row: sqlite3.Row,
        device_id: str,
        *,
        old_token_hash: str = "",
    ) -> AuthorityResponse:
        now = self._now()
        entitlement_expires = parse_utc(str(row["expires_at"]))
        refresh_until = min(entitlement_expires, now + self.refresh_duration)
        expires_at = min(entitlement_expires, now + self.lease_duration)
        token = secrets.token_urlsafe(48)
        token_hash = self._token_hash(token)
        conn.execute(
            """
            INSERT INTO license_refresh_tokens
                (token_hash, account_id, device_id, expires_at,
                 revoked, created_at, replaced_by)
            VALUES (?, ?, ?, ?, 0, ?, '')
            """,
            (
                token_hash,
                row["id"],
                device_id,
                format_utc(refresh_until),
                format_utc(now),
            ),
        )
        if old_token_hash:
            conn.execute(
                """
                UPDATE license_refresh_tokens
                SET revoked=1, replaced_by=?
                WHERE token_hash=?
                """,
                (token_hash, old_token_hash),
            )
        lease = sign_lease(
            self.private_key_pem,
            lease_id=uuid.uuid4().hex,
            account_id=str(row["id"]),
            username=str(row["username"]),
            plan=str(row["plan"]),
            capabilities=json.loads(row["capabilities_json"] or "[]"),
            device_id=device_id,
            issued_at=now,
            expires_at=expires_at,
            refresh_until=refresh_until,
        )
        self._audit(
            conn,
            "lease_issued",
            account_id=row["id"],
            device_id=device_id,
            detail={"expires_at": format_utc(expires_at)},
        )
        return AuthorityResponse(lease=lease, refresh_token=token)

    def authenticate(
        self, username: str, password: str, device_id: str
    ) -> AuthorityResponse:
        if not username or not password or not device_id:
            raise LicenseAuthorityError(
                "Thiếu thông tin đăng nhập", code="invalid_credentials", http_status=400
            )
        with self._connect() as conn:
            account = conn.execute(
                """
                SELECT id, salt, password_hash
                FROM license_accounts WHERE username=? COLLATE NOCASE
                """,
                (username,),
            ).fetchone()
            if account is None:
                raise LicenseAuthorityError(
                    "Tài khoản hoặc mật khẩu không đúng",
                    code="invalid_credentials",
                    http_status=401,
                )
            try:
                salt = base64.b64decode(account["salt"], validate=True)
                actual = self._hash_password(password, salt)
            except Exception:
                actual = ""
            if not hmac.compare_digest(actual, str(account["password_hash"])):
                self._audit(
                    conn,
                    "login_failed",
                    account_id=account["id"],
                    device_id=device_id,
                )
                conn.commit()
                raise LicenseAuthorityError(
                    "Tài khoản hoặc mật khẩu không đúng",
                    code="invalid_credentials",
                    http_status=401,
                )
            row = self._load_identity(conn, str(account["id"]))
            self._activate_device(conn, row, device_id)
            response = self._issue(conn, row, device_id)
            self._audit(
                conn,
                "login_success",
                account_id=row["id"],
                device_id=device_id,
            )
            return response

    def refresh(self, token: str, device_id: str) -> AuthorityResponse:
        token_hash = self._token_hash(str(token or ""))
        with self._connect() as conn:
            token_row = conn.execute(
                """
                SELECT account_id, device_id, expires_at, revoked
                FROM license_refresh_tokens WHERE token_hash=?
                """,
                (token_hash,),
            ).fetchone()
            if token_row is None or token_row["revoked"]:
                raise LicenseAuthorityError(
                    "Refresh token đã bị thu hồi", code="revoked", http_status=401
                )
            if not hmac.compare_digest(str(token_row["device_id"]), device_id):
                raise LicenseAuthorityError(
                    "Refresh token không thuộc thiết bị này",
                    code="device_mismatch",
                )
            if parse_utc(str(token_row["expires_at"])) <= self._now():
                raise LicenseAuthorityError(
                    "Refresh token đã hết hạn", code="expired", http_status=401
                )
            row = self._load_identity(conn, str(token_row["account_id"]))
            self._activate_device(conn, row, device_id)
            return self._issue(
                conn,
                row,
                device_id,
                old_token_hash=token_hash,
            )

    def logout(self, token: str, device_id: str) -> None:
        token_hash = self._token_hash(str(token or ""))
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT account_id, device_id FROM license_refresh_tokens
                WHERE token_hash=?
                """,
                (token_hash,),
            ).fetchone()
            if row and hmac.compare_digest(str(row["device_id"]), device_id):
                conn.execute(
                    """
                    UPDATE license_refresh_tokens SET revoked=1
                    WHERE token_hash=?
                    """,
                    (token_hash,),
                )
                self._audit(
                    conn,
                    "logout",
                    account_id=row["account_id"],
                    device_id=device_id,
                )

    def revoke_account(self, username: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id FROM license_accounts WHERE username=? COLLATE NOCASE",
                (username,),
            ).fetchone()
            if row is None:
                return False
            conn.execute(
                "UPDATE license_entitlements SET revoked=1 WHERE account_id=?",
                (row["id"],),
            )
            conn.execute(
                "UPDATE license_refresh_tokens SET revoked=1 WHERE account_id=?",
                (row["id"],),
            )
            self._audit(conn, "account_revoked", account_id=row["id"])
            return True

    def release_device(self, username: str, device_id: str) -> bool:
        with self._connect() as conn:
            account = conn.execute(
                "SELECT id FROM license_accounts WHERE username=? COLLATE NOCASE",
                (username,),
            ).fetchone()
            if account is None:
                return False
            changed = conn.execute(
                """
                DELETE FROM license_devices
                WHERE account_id=? AND device_id=?
                """,
                (account["id"], device_id),
            ).rowcount
            conn.execute(
                """
                UPDATE license_refresh_tokens SET revoked=1
                WHERE account_id=? AND device_id=?
                """,
                (account["id"], device_id),
            )
            if changed:
                self._audit(
                    conn,
                    "device_released",
                    account_id=account["id"],
                    device_id=device_id,
                )
            return bool(changed)
