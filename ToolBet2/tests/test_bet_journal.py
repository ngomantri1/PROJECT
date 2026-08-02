from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from src.auto_bettor import AutoBettor
from src.betting_session import BettingSession, PendingBet
from src.database import BetAllocationRecord, BetRecord, init_db
from src.db_store import GameDataStore
from src.models import BetSide
from src.risk_decision import ExecutionMode, RiskDecision
from src.strategy_decision import StrategyDecision
from src.strategy_lifecycle import TabAuthorityDecision, TabLifecycleMode


class BetJournalTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        db_path = Path(self.tmp.name) / "journal.db"
        self.session_factory = init_db(str(db_path))
        self.store = GameDataStore(self.session_factory, "ae_sexy")

    def tearDown(self) -> None:
        self.session_factory.kw["bind"].dispose()
        self.tmp.cleanup()

    @staticmethod
    def authority(tab_id: str, side: BetSide, stake: int) -> TabAuthorityDecision:
        return TabAuthorityDecision(
            tab_id=tab_id,
            tab_name=tab_id,
            mode=TabLifecycleMode.LIVE,
            strategy=StrategyDecision.bet(
                strategy_id="follow-last",
                strategy_name=tab_id,
                side=side,
                reason="journal test",
                signal_id=f"signal-{tab_id}",
                history_size=2,
            ),
            risk=RiskDecision.approve(
                execution_mode=(
                    ExecutionMode.REAL if stake > 0 else ExecutionMode.VIRTUAL
                ),
                reason="approved",
            ),
            stake=stake,
        )

    def make_bettor(self) -> tuple[BettingSession, AutoBettor]:
        session = BettingSession([100])
        session.configure(auto_bet=True)
        bettor = AutoBettor(session, self.store)
        bettor._armed_bet = {
            "live_authorities": [
                self.authority("player-tab", BetSide.PLAYER, 100),
                self.authority("banker-tab", BetSide.BANKER, 200),
            ],
            "armed_at_len": 2,
            "table_name": "Baccarat C01",
        }
        bettor.set_round_meta_provider(
            lambda _table, _index: {"game_shoe": 7, "game_round": 12}
        )
        return session, bettor

    async def test_intent_and_allocations_exist_before_first_click(self) -> None:
        session, bettor = self.make_bettor()

        async def inspect_before_click(*_args, **_kwargs) -> bool:
            db = self.session_factory()
            try:
                bet = db.scalar(select(BetRecord))
                allocations = list(db.scalars(select(BetAllocationRecord)))
                self.assertIsNotNone(bet)
                self.assertEqual("placing", bet.status)
                self.assertEqual(2, len(allocations))
            finally:
                db.close()
            return True

        with (
            patch(
                "src.auto_bettor.probe_betting_phase",
                AsyncMock(
                    return_value={
                        "chipsVisible": True,
                        "zoneVisible": True,
                        "closed": False,
                        "cdText": "12",
                    }
                ),
            ),
            patch(
                "src.auto_bettor.read_account_balance",
                AsyncMock(return_value=1000.0),
            ),
            patch(
                "src.auto_bettor.wait_and_place_bet",
                side_effect=inspect_before_click,
            ),
        ):
            placed = await bettor._try_place_multi_live(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="Baccarat C01",
                source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )

        self.assertTrue(placed)
        self.assertIsNotNone(session.state.pending)

    async def test_canary_guard_blocks_before_executor_and_before_intent(self) -> None:
        session, bettor = self.make_bettor()

        async def deny(**_kwargs):
            return False, "lease expired"

        bettor.set_real_bet_guard(deny)
        executor = AsyncMock(return_value=True)
        with (
            patch("src.auto_bettor.wait_and_place_bet", executor),
            patch("src.auto_bettor.probe_betting_phase", AsyncMock()),
        ):
            placed = await bettor._try_place_multi_live(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="Baccarat C01",
                source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )
        self.assertFalse(placed)
        executor.assert_not_awaited()
        self.assertIsNone(session.state.pending)
        db = self.session_factory()
        try:
            self.assertIsNone(db.scalar(select(BetRecord)))
        finally:
            db.close()

    async def test_partial_multi_placement_is_durable_and_fail_closed(self) -> None:
        session, bettor = self.make_bettor()
        with (
            patch(
                "src.auto_bettor.probe_betting_phase",
                AsyncMock(
                    return_value={
                        "chipsVisible": True,
                        "zoneVisible": True,
                        "closed": False,
                        "cdText": "12",
                    }
                ),
            ),
            patch(
                "src.auto_bettor.read_account_balance",
                AsyncMock(return_value=1000.0),
            ),
            patch(
                "src.auto_bettor.wait_and_place_bet",
                AsyncMock(side_effect=[True, False]),
            ),
        ):
            await bettor._try_place_multi_live(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="Baccarat C01",
                source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )

        db = self.session_factory()
        try:
            bet = db.scalar(select(BetRecord))
            statuses = {
                row.side: row.placement_status
                for row in db.scalars(select(BetAllocationRecord))
            }
            self.assertEqual("uncertain", bet.status)
            self.assertEqual({"player": "placed", "banker": "uncertain"}, statuses)
        finally:
            db.close()
        self.assertIsNotNone(session.state.pending)
        self.assertTrue(bettor.durable_block_reason)
        self.assertFalse(session.state.auto_bet)

    async def test_write_failure_after_click_keeps_pending_and_blocks(self) -> None:
        session, bettor = self.make_bettor()
        original = self.store.update_bet_allocation_status

        def fail_after_click(bet_id: int, side: str, status: str) -> None:
            if status == "placed":
                raise OSError("simulated sqlite write failure")
            original(bet_id, side, status)

        with (
            patch(
                "src.auto_bettor.probe_betting_phase",
                AsyncMock(
                    return_value={
                        "chipsVisible": True,
                        "zoneVisible": True,
                        "closed": False,
                        "cdText": "12",
                    }
                ),
            ),
            patch(
                "src.auto_bettor.read_account_balance",
                AsyncMock(return_value=1000.0),
            ),
            patch(
                "src.auto_bettor.wait_and_place_bet",
                AsyncMock(return_value=True),
            ),
            patch.object(
                self.store,
                "update_bet_allocation_status",
                side_effect=fail_after_click,
            ),
        ):
            placed = await bettor._try_place_multi_live(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="Baccarat C01",
                source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )

        self.assertTrue(placed)
        self.assertIsNotNone(session.state.pending)
        self.assertTrue(bettor.durable_block_reason)
        self.assertFalse(session.state.auto_bet)

    def test_restart_defers_confirmed_aggregate_pending(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C01:7:12",
            table_name="Baccarat C01",
            side="multi",
            stake=300,
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Nhieu tab Live",
            reason="2 allocations",
            target_round_index=2,
            game_shoe=7,
            game_round=12,
            status="placed",
        )
        self.store.save_bet_allocations(
            bet.id,
            [
                {"tab_id": "p", "side": "player", "stake": 100, "placement_status": "placed"},
                {"tab_id": "b", "side": "banker", "stake": 200, "placement_status": "placed"},
            ],
        )

        session = BettingSession([100])
        session.configure(auto_bet=True)
        bettor = AutoBettor(session, self.store)
        reason = bettor.restore_durable_pending()

        self.assertEqual("", reason)
        self.assertIsNone(session.state.pending)
        db = self.session_factory()
        try:
            persisted = db.get(BetRecord, bet.id)
            self.assertEqual("deferred", persisted.status)
            self.assertIsNone(persisted.outcome)
        finally:
            db.close()

    async def test_other_table_defers_without_using_its_result(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C03:9:4",
            table_name="Baccarat C03",
            side="player",
            stake=100,
            stake_index=0,
            pattern_id="mau_1_1",
            pattern_name="Mau 1-1",
            reason="test",
            target_round_index=4,
            game_shoe=9,
            game_round=4,
            status="placed",
        )
        session = BettingSession([100])
        session.set_pending(PendingBet(
            bet_id=bet.id, round_id=bet.round_id, side=BetSide.PLAYER,
            stake=100, stake_index=0, pattern_id="mau_1_1",
            pattern_name="Mau 1-1", reason="test", target_round_index=4,
            placed_at=bet.placed_at, table_name="Baccarat C03",
            game_shoe=9, game_round=4,
        ))
        bettor = AutoBettor(session, self.store)

        await bettor._resolve_if_needed(
            BetSide.BANKER, "Baccarat C01", {"game_shoe": 9, "game_round": 4}
        )

        self.assertIsNone(session.state.pending)
        db = self.session_factory()
        try:
            persisted = db.get(BetRecord, bet.id)
            self.assertEqual("deferred", persisted.status)
            self.assertIsNone(persisted.outcome)
        finally:
            db.close()

    def test_deferred_resolves_only_exact_authoritative_round(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C03:9:4",
            table_name="Baccarat C03",
            side="player",
            stake=100,
            stake_index=0,
            pattern_id="mau_1_1",
            pattern_name="Mau 1-1",
            reason="test",
            target_round_index=4,
            game_shoe=9,
            game_round=4,
            status="placed",
        )
        self.assertTrue(self.store.defer_bet(bet.id, reason="table_changed"))
        self.assertEqual([], self.store.resolve_deferred_bet(
            table_name="Baccarat C03", game_shoe=9, game_round=5,
            result=BetSide.PLAYER, source="gp-winner",
        ))
        self.assertEqual([bet.id], self.store.resolve_deferred_bet(
            table_name="Baccarat C03", game_shoe=9, game_round=4,
            result=BetSide.PLAYER, source="gp-winner",
        ))
        db = self.session_factory()
        try:
            persisted = db.get(BetRecord, bet.id)
            self.assertEqual("resolved", persisted.status)
            self.assertEqual("win", persisted.outcome)
            self.assertEqual(100.0, persisted.profit)
        finally:
            db.close()

    def test_restart_blocks_ambiguous_intent_and_reenable(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C01:7:13",
            table_name="Baccarat C01",
            side="player",
            stake=100,
            stake_index=0,
            pattern_id="mau_1_1",
            pattern_name="Mau 1-1",
            reason="test",
            target_round_index=3,
            game_shoe=7,
            game_round=13,
            status="placing",
        )
        session = BettingSession([100])
        session.configure(auto_bet=True)
        bettor = AutoBettor(session, self.store)

        reason = bettor.restore_durable_pending()

        self.assertIn(str(bet.id), reason)
        self.assertEqual(bet.id, session.state.pending.bet_id)
        self.assertFalse(bettor.on_toggle(True))
        self.assertFalse(session.state.auto_bet)


if __name__ == "__main__":
    unittest.main()
