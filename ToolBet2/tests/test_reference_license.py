from __future__ import annotations

from datetime import datetime, timedelta, timezone
import unittest

from src.license_contracts import LicenseStatus
from src.license_client import LicenseBackendError
from src.reference_license import _valid_client_id, ReferenceLicenseService


class ReferenceLicenseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 8, 7, 12, 0, tzinfo=timezone.utc)
        self.actions: list[tuple[str, str, dict]] = []
        self.expiry = self.now + timedelta(hours=2)

    def make_service(self, *, worker=None, github=None):
        return ReferenceLicenseService(
            github_raw_base_url="https://raw.example.test",
            github_owner="owner",
            github_repo="licenses",
            github_branch="main",
            github_license_path="auto",
            lease_base_url="https://lease.example.test/lease/auto",
            app_id="ToolBet2",
            device_id="device-hash",
            client_id="client-id",
            session_id="session-id",
            now_provider=lambda: self.now,
            github_fetcher=github or (lambda _url: {"exp": self.expiry.isoformat(), "pass": "secret"}),
            lease_requester=worker or (lambda action, username, payload: self.actions.append((action, username, payload)) or {}),
        )

    def test_login_acquires_and_allows_live(self):
        service = self.make_service()
        self.assertEqual(self.now, service.current_time())
        lease = service.login("alice", "secret")
        self.assertEqual("alice", lease.username)
        self.assertTrue(service.decision("live_bet").allowed)
        self.assertEqual("acquire", self.actions[0][0])
        self.assertEqual("ToolBet2", self.actions[0][2]["appId"])
        self.assertNotIn("secret", repr(self.actions))

    def test_conflict_blocks_account(self):
        def worker(action, username, payload):
            raise LicenseBackendError("busy", code="account_in_use")

        service = self.make_service(worker=worker)
        with self.assertRaises(LicenseBackendError):
            service.login("alice", "secret")
        self.assertEqual(LicenseStatus.ACCOUNT_IN_USE, service.decision().status)
        self.assertFalse(service.decision("live_bet").allowed)

    def test_heartbeat_failure_fails_closed(self):
        calls = []

        def worker(action, username, payload):
            calls.append(action)
            if action == "heartbeat":
                raise LicenseBackendError("offline", code="unavailable")
            return {}

        service = self.make_service(worker=worker)
        service.login("alice", "secret")
        self.assertFalse(service.refresh(force=True))
        self.assertFalse(service.decision("live_bet").allowed)
        self.assertEqual(LicenseStatus.UNAVAILABLE, service.decision().status)

    def test_expired_license_is_denied(self):
        service = self.make_service(
            github=lambda _url: {"exp": (self.now - timedelta(seconds=1)).isoformat(), "pass": "secret"}
        )
        with self.assertRaises(LicenseBackendError):
            service.login("alice", "secret")
        self.assertEqual(LicenseStatus.EXPIRED, service.decision().status)

    def test_logout_releases_lease(self):
        service = self.make_service()
        service.login("alice", "secret")
        service.logout()
        self.assertEqual("release", self.actions[-1][0])
        self.assertEqual(LicenseStatus.LOGGED_OUT, service.decision().status)

    def test_client_id_validation_matches_reference_guid_shape(self):
        self.assertTrue(_valid_client_id("a" * 32))
        self.assertFalse(_valid_client_id("not-a-client-id"))


if __name__ == "__main__":
    unittest.main()
