from __future__ import annotations

import json
import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from src.kill_switch import is_kill_switch_active, live_bet_allowed
from src.release_support import (
    PilotRuntimeState,
    create_integrity_manifest,
    export_diagnostics,
    inspect_license_readiness,
    inspect_pilot_runtime,
    pilot_preflight,
    redact_mapping,
    redact_text,
    verify_integrity_manifest,
)
from src.license_contracts import generate_ed25519_keypair, sign_lease
from src.secure_token_store import SecureTokenStore


class ReleaseSupportTests(unittest.TestCase):
    def test_text_and_mapping_redaction_remove_credentials(self):
        text = redact_text(
            "password=hunter2 token:abc https://alice:secret@example.test"
        )
        self.assertNotIn("hunter2", text)
        self.assertNotIn("abc", text)
        self.assertNotIn("alice:secret", text)
        mapped = redact_mapping({
            "username": "alice",
            "password": "hunter2",
            "nested": {"refresh_token": "abc"},
        })
        self.assertEqual("***", mapped["password"])
        self.assertEqual("***", mapped["nested"]["refresh_token"])
        self.assertEqual("***", mapped["username"])

    def test_runtime_redaction_removes_login_identifier(self):
        redacted = redact_text(
            "Dang nhap vipbet thanh cong: private_user username=private_user"
        )
        self.assertNotIn("private_user", redacted)

    def test_manifest_detects_changed_and_missing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = root / "ToolBet2.exe"
            second = root / "ui.css"
            first.write_bytes(b"exe")
            second.write_text("css", encoding="utf-8")
            manifest = create_integrity_manifest(root)
            self.assertEqual([], verify_integrity_manifest(root, manifest))
            second.write_text("changed", encoding="utf-8")
            first.unlink()
            errors = verify_integrity_manifest(root, manifest)
            self.assertIn("missing:ToolBet2.exe", errors)
            self.assertIn("changed:ui.css", errors)

    def test_diagnostics_contains_only_redacted_config_and_log(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "logs").mkdir()
            (root / "config.yaml").write_text(
                "account:\n  username: alice\n  password: hunter2\n"
                "license:\n  refresh_token: abc\n",
                encoding="utf-8",
            )
            (root / "logs" / "toolbet.log").write_text(
                "password=hunter2 token=abc "
                "Dang nhap vipbet thanh cong: private_user",
                encoding="utf-8",
            )
            output = export_diagnostics(
                root / "diag.zip",
                config_path=root / "config.yaml",
                database_path=root / "missing.db",
                log_dir=root / "logs",
            )
            import zipfile
            with zipfile.ZipFile(output) as archive:
                combined = b"\n".join(archive.read(name) for name in archive.namelist())
            self.assertNotIn(b"hunter2", combined)
            self.assertNotIn(b"token=abc", combined)
            self.assertNotIn(b"private_user", combined)

    def test_pilot_preflight_is_fail_closed(self):
        config = {
            "betting": {"auto_bet": True, "stakes": [0, 100, 200]},
            "license": {"enabled": False},
        }
        self.assertTrue(
            pilot_preflight(
                config,
                stage="shadow",
                runtime=PilotRuntimeState(database_exists=True),
            )
        )
        errors = pilot_preflight(
            config,
            stage="small_stake",
            runtime=PilotRuntimeState(
                database_exists=True,
                pending_bets=1,
                live_tabs=0,
                authoritative_stakes=(0, 100, 200),
            ),
            maximum_small_stake=100, kill_switch_active=True,
            license_errors=("license blocked",),
        )
        self.assertGreaterEqual(len(errors), 4)

    def test_sqlite_money_config_is_authoritative_over_yaml_and_tab_stakes(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "runtime.db"
            connection = sqlite3.connect(database)
            connection.executescript(
                """
                CREATE TABLE bets (id INTEGER PRIMARY KEY, outcome TEXT);
                CREATE TABLE strategy_tabs (
                    id TEXT PRIMARY KEY, ordinal INTEGER, active INTEGER,
                    mode TEXT, money_manager_id TEXT, stakes_json TEXT,
                    stake_chains_json TEXT
                );
                CREATE TABLE strategy_money_configs (
                    id INTEGER PRIMARY KEY, tab_id TEXT, manager_id TEXT,
                    stakes_json TEXT, stake_chains_json TEXT
                );
                INSERT INTO strategy_tabs VALUES
                    ('tab-live', 0, 1, 'live', 'IncreaseWhenLose',
                     '[0, 50]', '[]');
                INSERT INTO strategy_money_configs VALUES
                    (1, 'tab-live', 'IncreaseWhenLose', '[0, 500]', '[]');
                """
            )
            connection.commit()
            connection.close()
            runtime = inspect_pilot_runtime(database)
            self.assertEqual(1, runtime.live_tabs)
            self.assertEqual(500, runtime.maximum_stake)
            config = {
                "betting": {"auto_bet": False, "stakes": [0, 10]},
                "license": {"enabled": True},
            }
            errors = pilot_preflight(
                config,
                stage="small_stake",
                runtime=runtime,
                maximum_small_stake=100,
            )
            self.assertIn("Stake vượt ngưỡng pilot 100", errors)

    def test_victor2_preflight_includes_possible_double_stake(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "runtime.db"
            connection = sqlite3.connect(database)
            connection.executescript(
                """
                CREATE TABLE bets (id INTEGER PRIMARY KEY, outcome TEXT);
                CREATE TABLE strategy_tabs (
                    id TEXT PRIMARY KEY, ordinal INTEGER, active INTEGER,
                    mode TEXT, money_manager_id TEXT, stakes_json TEXT,
                    stake_chains_json TEXT
                );
                CREATE TABLE strategy_money_configs (
                    id INTEGER PRIMARY KEY, tab_id TEXT, manager_id TEXT,
                    stakes_json TEXT, stake_chains_json TEXT
                );
                INSERT INTO strategy_tabs VALUES
                    ('victor', 0, 1, 'live', 'Victor2', '[0, 60]', '[]');
                """
            )
            connection.commit()
            connection.close()
            runtime = inspect_pilot_runtime(database)
            self.assertEqual(120, runtime.maximum_stake)

    def test_license_readiness_verifies_signed_live_capability(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            private_key, public_key = generate_ed25519_keypair()
            (root / "public.pem").write_bytes(public_key)
            now = datetime(2026, 8, 2, tzinfo=timezone.utc)
            signed = sign_lease(
                private_key,
                lease_id="lease-1",
                account_id="account-1",
                username="pilot",
                plan="pilot",
                capabilities=("workspace", "live_bet"),
                device_id="device-1",
                issued_at=now - timedelta(minutes=1),
                expires_at=now + timedelta(minutes=15),
                refresh_until=now + timedelta(days=1),
            )
            SecureTokenStore(
                root / "cache.bin", allow_plaintext_for_tests=True
            ).save(
                {
                    "device_id": "device-1",
                    "lease": signed.to_dict(),
                    "refresh_token": "refresh",
                }
            )
            config = {
                "license": {
                    "enabled": True,
                    "api_url": "https://license.example.test",
                    "public_key_path": "public.pem",
                    "cache_path": "cache.bin",
                    "grace_minutes": 60,
                }
            }
            self.assertEqual(
                (),
                inspect_license_readiness(
                    config,
                    config_dir=root,
                    now=now,
                    device_id="device-1",
                    allow_plaintext_cache_for_tests=True,
                ),
            )

    def test_local_or_environment_kill_switch_blocks_live(self):
        with tempfile.TemporaryDirectory() as directory:
            switch = Path(directory) / "KILL_SWITCH"
            with patch.dict(os.environ, {"TOOLBET_KILL_SWITCH": str(switch)}, clear=False):
                self.assertFalse(is_kill_switch_active())
                self.assertTrue(live_bet_allowed(True))
                switch.write_text("stop", encoding="utf-8")
                self.assertTrue(is_kill_switch_active())
                self.assertFalse(live_bet_allowed(True))
            with patch.dict(os.environ, {"TOOLBET_DISABLE_LIVE": "1"}, clear=False):
                self.assertTrue(is_kill_switch_active())
