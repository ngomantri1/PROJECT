from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from src.ae_sexy_betting import (
    BetPlacementUncertain,
    _execute_bet_clicks_inner,
    wait_and_place_bet,
)
from src.database import init_db
from src.db_store import GameDataStore
from src.models import BetSide
from src.stake_zero_audit import inspect_stake_zero_window, latest_bet_id


class StakeZeroExecutionTests(unittest.IsolatedAsyncioTestCase):
    async def test_inner_guard_returns_before_any_page_or_chip_access(self) -> None:
        self.assertTrue(
            await _execute_bet_clicks_inner(None, BetSide.PLAYER, 0)  # type: ignore[arg-type]
        )

    async def test_wait_path_never_calls_click_executor_for_zero_stake(self) -> None:
        page = AsyncMock()
        click = AsyncMock(return_value=True)
        with (
            patch(
                "src.ae_sexy_betting.probe_betting_phase",
                AsyncMock(return_value={"closed": False, "cdText": "12"}),
            ),
            patch(
                "src.ae_sexy_betting._betting_ready",
                AsyncMock(return_value=True),
            ),
            patch(
                "src.ae_sexy_betting.side_zone_visible",
                AsyncMock(return_value=(True, "chipBoxPlayer")),
            ),
            patch("src.ae_sexy_betting._execute_bet_clicks", click),
        ):
            result = await wait_and_place_bet(
                page, BetSide.PLAYER, 0, timeout_sec=1
            )

        self.assertTrue(result)
        click.assert_not_awaited()

    async def test_failed_zone_attempt_is_reported_as_uncertain(self) -> None:
        page = AsyncMock()
        with (
            patch(
                "src.ae_sexy_betting._chip_tray_info",
                AsyncMock(return_value={"chipCount": 2, "chipValues": [50, 100]}),
            ),
            patch(
                "src.ae_sexy_betting._find_chip_index_for_value",
                AsyncMock(return_value=1),
            ),
            patch(
                "src.ae_sexy_betting._select_chip_value_js",
                AsyncMock(return_value=False),
            ),
            patch(
                "src.ae_sexy_betting._select_chip_value_mouse",
                AsyncMock(return_value=False),
            ),
            patch(
                "src.ae_sexy_betting._playwright_click_bet",
                AsyncMock(return_value=False),
            ),
            patch(
                "src.ae_sexy_betting._viewport_click_bet",
                AsyncMock(return_value=False),
            ),
            patch(
                "src.ae_sexy_betting._chip_selected",
                AsyncMock(return_value=False),
            ),
            patch(
                "src.ae_sexy_betting._bet_placed_detail",
                AsyncMock(return_value={"ok": False}),
            ),
        ):
            with self.assertRaises(BetPlacementUncertain):
                await _execute_bet_clicks_inner(page, BetSide.PLAYER, 100)


class StakeZeroAuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.database = Path(self.tmp.name) / "stake-zero.db"
        self.session_factory = init_db(str(self.database))
        self.store = GameDataStore(self.session_factory, "ae_sexy")

    def tearDown(self) -> None:
        self.session_factory.kw["bind"].dispose()
        self.tmp.cleanup()

    def save_bet(
        self,
        *,
        round_id: str,
        stake: float,
        execution_mode: str,
    ):
        return self.store.save_bet(
            round_id=round_id,
            table_name="Baccarat C01",
            side="player",
            stake=stake,
            stake_index=0,
            pattern_id="mau_1_1",
            pattern_name="Test",
            reason="stake-zero audit",
            target_round_index=1,
            game_shoe=1,
            game_round=1,
            status="placed",
            execution_mode=execution_mode,
        )

    def test_resolved_virtual_window_passes(self) -> None:
        baseline = latest_bet_id(self.database)
        bet = self.save_bet(
            round_id="ae_sexy:C01:1:1", stake=0, execution_mode="virtual"
        )
        self.store.resolve_bet(
            bet.id, outcome="win", profit=0, session_profit_after=0
        )

        evidence = inspect_stake_zero_window(
            self.database, after_bet_id=baseline
        )

        self.assertTrue(evidence.passed)
        self.assertEqual(1, evidence.bets)
        self.assertEqual(1, evidence.virtual_bets)
        self.assertEqual(1, evidence.resolved_bets)

    def test_real_or_unresolved_bet_fails_evidence(self) -> None:
        baseline = latest_bet_id(self.database)
        self.save_bet(
            round_id="ae_sexy:C01:1:2", stake=100, execution_mode="real"
        )

        evidence = inspect_stake_zero_window(
            self.database, after_bet_id=baseline
        )

        self.assertFalse(evidence.passed)
        self.assertTrue(any("execution_mode" in item for item in evidence.errors))
        self.assertTrue(any("chưa resolve" in item for item in evidence.errors))

    def test_legacy_zero_stake_rows_are_backfilled_virtual(self) -> None:
        legacy = Path(self.tmp.name) / "legacy.db"
        connection = sqlite3.connect(legacy)
        connection.executescript(
            """
            CREATE TABLE bets (
                id INTEGER PRIMARY KEY,
                round_id TEXT,
                rule_name TEXT,
                side TEXT,
                stake FLOAT,
                outcome TEXT,
                profit FLOAT,
                stake_index INTEGER,
                reason TEXT,
                created_at DATETIME
            );
            INSERT INTO bets VALUES
                (1, 'legacy:1', 'Legacy', 'player', 0, NULL, NULL, 0, '', CURRENT_TIMESTAMP);
            """
        )
        connection.commit()
        connection.close()

        factory = init_db(str(legacy))
        connection = sqlite3.connect(legacy)
        try:
            mode = connection.execute(
                "SELECT execution_mode FROM bets WHERE id=1"
            ).fetchone()[0]
            self.assertEqual("virtual", mode)
        finally:
            connection.close()
            factory.kw["bind"].dispose()


if __name__ == "__main__":
    unittest.main()
