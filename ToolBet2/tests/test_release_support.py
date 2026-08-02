from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.kill_switch import is_kill_switch_active, live_bet_allowed
from src.release_support import (
    create_integrity_manifest,
    export_diagnostics,
    pilot_preflight,
    redact_mapping,
    redact_text,
    verify_integrity_manifest,
)


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
                "password=hunter2 token=abc", encoding="utf-8"
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

    def test_pilot_preflight_is_fail_closed(self):
        config = {
            "betting": {"auto_bet": True, "stakes": [0, 100, 200]},
            "license": {"enabled": False},
        }
        self.assertTrue(pilot_preflight(config, stage="shadow"))
        errors = pilot_preflight(
            config, stage="small_stake", pending_bets=1,
            maximum_small_stake=100, kill_switch_active=True,
        )
        self.assertGreaterEqual(len(errors), 4)

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

