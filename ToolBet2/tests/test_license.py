from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from src.license_client import (
    LicenseBackendError,
    LicenseBackendResponse,
    LicenseService,
)
from src.license_contracts import (
    LicenseStatus,
    SignedLease,
    generate_ed25519_keypair,
    verify_signed_lease,
)
from src.license_server import LicenseAuthorityError, LicenseAuthorityStore
from src.tool_auth import ToolAuthService


class Clock:
    def __init__(self):
        self.value = datetime(2026, 8, 2, 8, 0, tzinfo=timezone.utc)

    def now(self):
        return self.value

    def advance(self, **kwargs):
        self.value += timedelta(**kwargs)


class AuthorityBackend:
    def __init__(self, authority: LicenseAuthorityStore):
        self.authority = authority
        self.unavailable = False
        self.tamper_refresh = False

    def _check(self):
        if self.unavailable:
            raise LicenseBackendError(
                "offline", code="unavailable"
            )

    def login(self, username, password, device_id):
        self._check()
        try:
            result = self.authority.authenticate(
                username, password, device_id
            )
        except LicenseAuthorityError as exc:
            raise LicenseBackendError(str(exc), code=exc.code) from exc
        return LicenseBackendResponse(
            result.lease.to_dict(), result.refresh_token
        )

    def refresh(self, refresh_token, device_id):
        self._check()
        try:
            result = self.authority.refresh(refresh_token, device_id)
        except LicenseAuthorityError as exc:
            raise LicenseBackendError(str(exc), code=exc.code) from exc
        lease = result.lease.to_dict()
        if self.tamper_refresh:
            lease["claims"]["plan"] = "forged"
        return LicenseBackendResponse(lease, result.refresh_token)

    def logout(self, refresh_token, device_id):
        self.authority.logout(refresh_token, device_id)


class LicensePhaseFTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.clock = Clock()
        self.private_key, self.public_key = generate_ed25519_keypair()
        self.authority = LicenseAuthorityStore(
            self.root / "server.db",
            private_key_pem=self.private_key,
            lease_minutes=5,
            refresh_days=2,
            now_provider=self.clock.now,
        )
        self.authority.upsert_account(
            "operator",
            "secret-pass",
            plan="pilot",
            capabilities=["workspace", "simulation", "live_bet"],
            expires_at=self.clock.now() + timedelta(days=1),
            max_devices=1,
        )
        self.backend = AuthorityBackend(self.authority)

    def tearDown(self):
        self.temp.cleanup()

    def service(self, device_id="device-A", cache="client.bin"):
        return LicenseService(
            self.backend,
            public_key_pem=self.public_key,
            cache_path=self.root / cache,
            device_id=device_id,
            grace_minutes=10,
            refresh_before_minutes=1,
            now_provider=self.clock.now,
            allow_plaintext_cache_for_tests=True,
        )

    def test_login_issues_signed_capabilities_without_plaintext_password(self):
        service = self.service()

        lease = service.login("operator", "secret-pass")

        self.assertEqual("pilot", lease.plan)
        self.assertTrue(service.decision("workspace").allowed)
        self.assertTrue(service.decision("live_bet").allowed)
        database_bytes = (self.root / "server.db").read_bytes()
        self.assertNotIn(b"secret-pass", database_bytes)

    def test_tampered_lease_signature_is_rejected(self):
        response = self.authority.authenticate(
            "operator", "secret-pass", "device-A"
        )
        raw = response.lease.to_dict()
        raw["claims"]["plan"] = "forged-unlimited"

        with self.assertRaises(ValueError):
            verify_signed_lease(SignedLease.from_dict(raw), self.public_key)

    def test_max_device_and_copied_cache_are_rejected(self):
        first = self.service("device-A")
        first.login("operator", "secret-pass")

        copied = self.service("device-B")

        self.assertEqual(
            LicenseStatus.DEVICE_MISMATCH,
            copied.decision("workspace").status,
        )
        with self.assertRaises(LicenseBackendError):
            copied.login("operator", "secret-pass")

    def test_revoke_is_fail_closed_on_next_server_check(self):
        service = self.service()
        service.login("operator", "secret-pass")
        self.authority.revoke_account("operator")

        self.assertFalse(service.refresh(force=True))

        decision = service.decision("live_bet")
        self.assertFalse(decision.allowed)
        self.assertEqual(LicenseStatus.REVOKED, decision.status)

    def test_offline_grace_is_limited_and_then_expires(self):
        service = self.service()
        service.login("operator", "secret-pass")
        self.backend.unavailable = True
        self.clock.advance(minutes=6)

        self.assertFalse(service.refresh(force=True))
        grace = service.decision("live_bet")
        self.assertTrue(grace.allowed)
        self.assertEqual(LicenseStatus.GRACE, grace.status)

        self.clock.advance(minutes=10)
        expired = service.decision("live_bet")
        self.assertFalse(expired.allowed)
        self.assertEqual(LicenseStatus.EXPIRED, expired.status)

    def test_capability_missing_blocks_only_that_feature(self):
        self.authority.upsert_account(
            "viewer",
            "viewer-pass",
            plan="simulation",
            capabilities=["workspace", "simulation"],
            expires_at=self.clock.now() + timedelta(days=1),
        )
        service = self.service("viewer-device", "viewer.bin")
        service.login("viewer", "viewer-pass")

        self.assertTrue(service.decision("workspace").allowed)
        live = service.decision("live_bet")
        self.assertFalse(live.allowed)
        self.assertEqual(LicenseStatus.CAPABILITY_MISSING, live.status)

    def test_refresh_token_rotates_and_old_token_cannot_be_reused(self):
        initial = self.authority.authenticate(
            "operator", "secret-pass", "device-A"
        )

        refreshed = self.authority.refresh(
            initial.refresh_token, "device-A"
        )

        self.assertNotEqual(initial.refresh_token, refreshed.refresh_token)
        with self.assertRaises(LicenseAuthorityError):
            self.authority.refresh(initial.refresh_token, "device-A")

    def test_tool_session_restores_from_valid_signed_cache(self):
        first = self.service()
        first.login("operator", "secret-pass")
        restarted_license = self.service()

        auth = ToolAuthService(
            enabled=True,
            license_service=restarted_license,
        )

        self.assertTrue(auth.is_authenticated())
        self.assertEqual("operator", auth.require_session().username)
        self.assertTrue(auth.can("live_bet"))

    def test_invalid_refresh_signature_clears_cache_fail_closed(self):
        service = self.service()
        service.login("operator", "secret-pass")
        self.backend.tamper_refresh = True

        self.assertFalse(service.refresh(force=True))
        self.assertEqual(
            LicenseStatus.INVALID_SIGNATURE,
            service.decision("workspace").status,
        )

        restarted = self.service()
        self.assertEqual(
            LicenseStatus.LOGGED_OUT,
            restarted.decision("workspace").status,
        )


if __name__ == "__main__":
    unittest.main()
