from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from src.release_support import inspect_pilot_runtime
from src.small_stake_guard import (
    SMALL_STAKE_ACK,
    SmallStakePilotGuard,
    arm_small_stake_pilot,
)


class SmallStakePilotGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.database = self.root / "pilot.db"
        self.lease_path = self.root / "SMALL_STAKE_PILOT.json"
        connection = sqlite3.connect(self.database)
        connection.executescript(
            """
            CREATE TABLE bets (
                id INTEGER PRIMARY KEY, stake REAL, outcome TEXT, profit REAL,
                status TEXT, execution_mode TEXT
            );
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
                ('pilot-tab', 0, 1, 'live', 'IncreaseWhenLose', '[50,100]', '[]');
            """
        )
        connection.commit()
        connection.close()
        runtime = inspect_pilot_runtime(self.database)
        self.issued = datetime(2026, 8, 3, 10, 0, tzinfo=timezone.utc)
        self.lease = arm_small_stake_pilot(
            self.database,
            self.lease_path,
            runtime=runtime,
            max_stake=100,
            max_bets=2,
            max_loss=100,
            duration_minutes=30,
            acknowledgement=SMALL_STAKE_ACK,
            now=self.issued,
        )
        self.guard = SmallStakePilotGuard(self.database, self.lease_path)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def evaluate(self, **overrides):
        values = {
            "stake": 50,
            "tab_ids": ["pilot-tab"],
            "bet_kind": "main",
            "now": self.issued + timedelta(minutes=1),
        }
        values.update(overrides)
        with patch("src.small_stake_guard.is_kill_switch_active", return_value=False):
            return self.guard.evaluate(**values)

    def add_bet(
        self, bet_id: int, *, outcome: str | None, profit: float | None, stake: int = 50
    ) -> None:
        connection = sqlite3.connect(self.database)
        connection.execute(
            "INSERT INTO bets VALUES (?, ?, ?, ?, 'placed', 'real')",
            (bet_id, stake, outcome, profit),
        )
        connection.commit()
        connection.close()

    def test_lease_binds_tab_cap_and_expiry(self) -> None:
        self.assertTrue(self.evaluate().allowed)
        self.assertFalse(self.evaluate(stake=101).allowed)
        self.assertFalse(self.evaluate(tab_ids=["other-tab"]).allowed)
        self.assertFalse(self.evaluate(bet_kind="tie").allowed)
        self.assertFalse(
            self.evaluate(now=self.issued + timedelta(minutes=31)).allowed
        )

    def test_pending_max_bets_and_stop_loss_fail_closed(self) -> None:
        self.add_bet(1, outcome="loss", profit=-50)
        self.assertTrue(self.evaluate().allowed)
        self.add_bet(2, outcome=None, profit=None)
        self.assertFalse(self.evaluate().allowed)
        self.assertTrue(self.evaluate(current_bet_id=2).allowed)
        self.add_bet(3, outcome="loss", profit=-50)
        self.assertFalse(self.evaluate(current_bet_id=2).allowed)

    def test_missing_or_changed_lease_blocks(self) -> None:
        self.lease_path.unlink()
        self.assertFalse(self.evaluate().allowed)
        payload = {"schema_version": 1, "pilot_id": "tampered"}
        self.lease_path.write_text(json.dumps(payload), encoding="utf-8")
        self.assertFalse(self.evaluate().allowed)

    def test_finish_evidence_requires_resolved_bet_within_limits(self) -> None:
        self.assertFalse(self.guard.finish_evidence().passed)
        self.add_bet(1, outcome="win", profit=50)
        evidence = self.guard.finish_evidence()
        self.assertTrue(evidence.passed)
        self.assertEqual(1, evidence.bet_count)
        self.assertEqual(50, evidence.pnl)
