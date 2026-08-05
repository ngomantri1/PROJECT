from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from sqlalchemy import select

from src.ae_sexy_betting import BetPlacementUncertain
from src.auto_bettor import AutoBettor
from src.betting_session import BettingSession, PendingBet
from src.database import (
    BetAllocationRecord,
    BetPlacementAttemptAllocationRecord,
    BetPlacementAttemptRecord,
    BetRecord,
    EventRecord,
    init_db,
)
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

    async def test_running_simulation_keeps_stake_but_never_clicks_chip(self) -> None:
        session, bettor = self.make_bettor()
        bettor._armed_bet["live_authorities"] = [
            self.authority("player-tab", BetSide.PLAYER, 100)
        ]
        bettor.set_tab_execution_mode_resolver(lambda _tab_id: "simulation")
        executor = AsyncMock(return_value=True)

        with patch("src.auto_bettor.wait_and_place_bet", executor):
            placed = await bettor._try_place_multi_live(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="Baccarat C01",
                source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )

        self.assertTrue(placed)
        executor.assert_not_awaited()
        db = self.session_factory()
        try:
            bet = db.scalar(select(BetRecord))
            allocation = db.scalar(select(BetAllocationRecord))
            self.assertEqual(100, bet.stake)
            self.assertEqual("virtual", bet.execution_mode)
            self.assertEqual(100, allocation.stake)
            self.assertEqual("virtual", allocation.placement_status)
        finally:
            db.close()

    async def test_mode_change_while_waiting_converts_live_allocation_to_virtual(self) -> None:
        _session, bettor = self.make_bettor()
        bettor._armed_bet["live_authorities"] = [
            self.authority("player-tab", BetSide.PLAYER, 100)
        ]
        mode = {"value": "live"}
        bettor.set_tab_execution_mode_resolver(lambda _tab_id: mode["value"])

        async def mode_changes_before_zone_click(*_args, **kwargs):
            mode["value"] = "simulation"
            allowed, reason = await kwargs["pre_click_guard"]()
            self.assertFalse(allowed)
            self.assertEqual("simulation_mode", reason)
            from src.ae_sexy_betting import PreClickGuardRejected

            raise PreClickGuardRejected(reason)

        with (
            patch(
                "src.auto_bettor.probe_betting_phase",
                AsyncMock(return_value={
                    "chipsVisible": True, "zoneVisible": True,
                    "closed": False, "cdText": "12",
                }),
            ),
            patch(
                "src.auto_bettor.wait_and_place_bet",
                side_effect=mode_changes_before_zone_click,
            ),
        ):
            placed = await bettor._try_place_multi_live(
                object(), [BetSide.PLAYER, BetSide.BANKER],
                table_name="Baccarat C01", source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )

        self.assertTrue(placed)
        db = self.session_factory()
        try:
            self.assertEqual("virtual", db.scalar(select(BetRecord)).execution_mode)
            self.assertEqual(
                "virtual", db.scalar(select(BetAllocationRecord)).placement_status
            )
        finally:
            db.close()

    def test_attempt_journal_is_idempotent_and_effective_stake_is_additive(self) -> None:
        """A logical round stays one bet while Start epochs add audited attempts."""
        bet = self.store.save_bet(
            round_id="ae_sexy:C01:7:12", table_name="Baccarat C01", side="player",
            stake=20, stake_index=0, pattern_id="multi_live", pattern_name="test",
            reason="first", target_round_index=2, game_shoe=7, game_round=12,
            status="placed",
        )
        assert bet is not None
        self.store.save_bet_allocations(bet.id, [{
            "tab_id": "player-tab", "tab_name": "Player", "side": "player", "stake": 20,
            "placement_status": "placed",
        }])
        first = self.store.begin_placement_attempt(bet.id, "epoch-1", [{
            "tab_id": "player-tab", "side": "player", "stake": 20,
        }])
        self.assertEqual(first.id, self.store.begin_placement_attempt(bet.id, "epoch-1", [{
            "tab_id": "player-tab", "side": "player", "stake": 20,
        }]).id)
        second = self.store.begin_placement_attempt(bet.id, "epoch-2", [{
            "tab_id": "player-tab", "side": "player", "stake": 20,
        }])
        self.store.complete_placement_attempt(second.id, status="placed")
        self.store.add_effective_allocations(bet.id, [{
            "tab_id": "player-tab", "side": "player", "stake": 20,
        }])
        db = self.session_factory()
        try:
            self.assertEqual(1, db.scalar(select(BetRecord).where(BetRecord.id == bet.id)).id)
            self.assertEqual(2, len(list(db.scalars(select(BetPlacementAttemptRecord)))))
            self.assertEqual(2, len(list(db.scalars(select(BetPlacementAttemptAllocationRecord)))))
            allocation = db.scalar(select(BetAllocationRecord).where(BetAllocationRecord.bet_id == bet.id))
            self.assertEqual(40, allocation.stake)
            self.assertEqual(40, db.get(BetRecord, bet.id).stake)
        finally:
            db.close()

    def test_operator_epoch_changes_only_when_explicitly_started(self) -> None:
        _session, bettor = self.make_bettor()
        first = bettor.begin_run_epoch()
        self.assertEqual(first, bettor.run_epoch)
        second = bettor.begin_run_epoch()
        self.assertNotEqual(first, second)

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

    async def test_multi_live_combined_risk_is_advisory_before_waiting_executor(self) -> None:
        session, bettor = self.make_bettor()
        bettor.set_license_checker(lambda: False)
        bettor.set_ui_alive_checker(AsyncMock(return_value=(False, "not ready")))
        bettor.set_shuffle_checker(lambda _table: True)
        executor = AsyncMock(return_value=True)

        with (
            patch(
                "src.auto_bettor.probe_betting_phase",
                AsyncMock(
                    return_value={
                        "chipsVisible": False,
                        "zoneVisible": False,
                        "closed": True,
                        "cdText": "1",
                    }
                ),
            ),
            patch("src.auto_bettor.wait_and_place_bet", executor),
        ):
            placed = await bettor._try_place_multi_live(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="Baccarat C01",
                source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )

        self.assertTrue(placed)
        self.assertEqual(2, executor.await_count)
        self.assertIsNotNone(session.state.pending)

    async def test_false_before_zone_cancels_side_without_placed_event(self) -> None:
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
            events = [
                row.event_type for row in db.scalars(select(EventRecord))
            ]
            self.assertEqual("placed", bet.status)
            self.assertEqual({"player": "placed", "banker": "cancelled"}, statuses)
            self.assertNotIn("multi_live_placed", events)
            self.assertIn("multi_live_partial", events)
        finally:
            db.close()
        self.assertIsNotNone(session.state.pending)
        self.assertFalse(bettor.durable_block_reason)

    async def test_possible_zone_click_is_uncertain_and_has_no_placed_event(self) -> None:
        session, bettor = self.make_bettor()
        with (
            patch(
                "src.auto_bettor.probe_betting_phase",
                AsyncMock(return_value={"chipsVisible": True, "zoneVisible": True}),
            ),
            patch(
                "src.auto_bettor.wait_and_place_bet",
                AsyncMock(
                    side_effect=BetPlacementUncertain("zone click may have occurred")
                ),
            ),
        ):
            placed = await bettor._try_place_multi_live(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="Baccarat C01",
                source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )

        self.assertFalse(placed)
        db = self.session_factory()
        try:
            bet = db.scalar(select(BetRecord))
            events = [row.event_type for row in db.scalars(select(EventRecord))]
            self.assertEqual("deferred", bet.status)
            self.assertNotIn("multi_live_placed", events)
            self.assertIn("multi_live_uncertain", events)
        finally:
            db.close()
        self.assertIsNone(session.state.pending)
        self.assertFalse(bettor.durable_block_reason)

    async def test_unconfirmed_intent_is_parked_not_resolved(self) -> None:
        session = BettingSession([20])
        session.configure(auto_bet=True)
        bettor = AutoBettor(session, self.store)
        bet = self.store.save_bet(
            round_id="ae_sexy:C01:7:12",
            table_name="Baccarat C01",
            side="banker",
            stake=20,
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Nhieu tab Live",
            reason="intent before click",
            target_round_index=2,
            game_shoe=7,
            game_round=12,
            status="placing",
        )
        self.store.save_bet_allocations(
            bet.id,
            [{"tab_id": "one", "side": "banker", "stake": 20,
              "placement_status": "placing"}],
        )
        session.set_pending(PendingBet(
            bet_id=bet.id,
            round_id=bet.round_id,
            side=BetSide.BANKER,
            stake=20,
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Nhieu tab Live",
            reason="intent before click",
            target_round_index=2,
            placed_at=bet.placed_at,
            table_name="Baccarat C01",
            game_shoe=7,
            game_round=12,
        ))
        result_handler = Mock(return_value=[])
        bettor.set_multi_live_result_handler(result_handler)
        bettor._multi_live_pending = {
            "round_id": bet.round_id,
            "bet_id": bet.id,
            "allocations": [{"tab_id": "one", "side": "banker", "stake": 20}],
            "ready_to_resolve": False,
        }

        await bettor._resolve_if_needed(
            BetSide.PLAYER,
            "Baccarat C01",
            {"game_shoe": 7, "game_round": 12},
        )

        db = self.session_factory()
        try:
            parked = db.get(BetRecord, bet.id)
            allocation = db.scalar(select(BetAllocationRecord))
            self.assertEqual("deferred", parked.status)
            self.assertIsNone(parked.outcome)
            self.assertEqual("deferred", allocation.placement_status)
        finally:
            db.close()
        self.assertIsNone(session.state.pending)
        self.assertEqual(0.0, session.state.session_profit)
        result_handler.assert_not_called()

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

    def test_uncertain_restart_is_parked_without_unlocking_exact_round(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C01:9:4",
            table_name="Baccarat C01",
            side="player",
            stake=20,
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Nhieu tab Live",
            reason="possible click",
            target_round_index=4,
            game_shoe=9,
            game_round=4,
            status="uncertain",
            execution_mode="real",
        )
        session = BettingSession([20])
        bettor = AutoBettor(session, self.store)
        restored = bettor.restore_durable_pending()

        self.assertEqual("", restored)
        self.assertEqual("", bettor.durable_block_reason)
        self.assertIsNone(session.state.pending)
        self.assertTrue(self.store.has_bet_for_exact_round(
            table_name="Baccarat C01", game_shoe=9, game_round=4
        ))
        self.assertEqual(0, self.store.pending_status_summary(
            table_name="Baccarat C02"
        )["active"])
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

    def test_deferred_blocks_only_its_exact_round(self) -> None:
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
        self.assertTrue(self.store.defer_bet(bet.id, reason="restart"))

        self.assertTrue(self.store.has_bet_for_exact_round(
            table_name="Baccarat C03", game_shoe=9, game_round=4
        ))
        self.assertFalse(self.store.has_bet_for_exact_round(
            table_name="Baccarat C03", game_shoe=9, game_round=5
        ))

    def test_restart_parks_ambiguous_intent_and_reenables_like_legacy(self) -> None:
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

        self.assertEqual("", reason)
        self.assertIsNone(session.state.pending)
        self.assertTrue(bettor.on_toggle(True))
        self.assertTrue(session.state.auto_bet)
        db = self.session_factory()
        try:
            self.assertEqual("deferred", db.get(BetRecord, bet.id).status)
        finally:
            db.close()

    def test_restart_defers_virtual_zero_intent_without_global_block(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C03:9:27",
            table_name="Baccarat C03",
            side="player",
            stake=0,
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Virtual",
            reason="stake zero",
            target_round_index=27,
            game_shoe=9,
            game_round=27,
            status="placing",
            execution_mode="virtual",
        )
        session = BettingSession([0])
        bettor = AutoBettor(session, self.store)

        self.assertEqual("", bettor.restore_durable_pending())
        self.assertIsNone(session.state.pending)
        db = self.session_factory()
        try:
            persisted = db.get(BetRecord, bet.id)
            self.assertEqual("deferred", persisted.status)
            self.assertIsNone(persisted.outcome)
        finally:
            db.close()

    def test_authoritative_advance_quarantines_ambiguous_and_unlocks(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C01:7:13",
            table_name="Baccarat C01",
            side="player",
            stake=100,
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Live aggregate",
            reason="test",
            target_round_index=13,
            game_shoe=7,
            game_round=13,
            status="uncertain",
            execution_mode="real",
        )
        self.store.save_bet_allocations(bet.id, [{
            "tab_id": "live-tab",
            "side": "player",
            "stake": 100,
            "placement_status": "uncertain",
        }])
        session = BettingSession([100])
        bettor = AutoBettor(session, self.store)
        recovered = []
        bettor.set_recovery_handler(
            lambda bet_id, tabs, reason: (
                recovered.append((bet_id, tabs, reason)) or {"live-tab": 1}
            )
        )

        changed = bettor.classify_stale_pending(
            table_name="Baccarat C01",
            game_shoe=7,
            game_round=14,
            source="gp-winner",
        )

        self.assertEqual([bet.id], changed)
        self.assertIsNone(session.state.pending)
        self.assertEqual("", bettor.durable_block_reason)
        self.assertEqual((bet.id, ["live-tab"], "authoritative_round_advanced"), recovered[0])
        db = self.session_factory()
        try:
            persisted = db.get(BetRecord, bet.id)
            allocation = db.scalar(select(BetAllocationRecord))
            self.assertEqual("quarantined", persisted.status)
            self.assertIsNone(persisted.outcome)
            self.assertEqual("quarantined", allocation.placement_status)
            self.assertEqual(1, allocation.recovery_epoch)
        finally:
            db.close()

    def test_non_authoritative_metadata_cannot_quarantine(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C01:7:13",
            table_name="Baccarat C01",
            side="player",
            stake=100,
            stake_index=0,
            pattern_id="mau_1_1",
            pattern_name="Mau 1-1",
            reason="test",
            target_round_index=13,
            game_shoe=7,
            game_round=13,
            status="placing",
        )
        bettor = AutoBettor(BettingSession([100]), self.store)
        self.assertEqual([], bettor.classify_stale_pending(
            table_name="Baccarat C01",
            game_shoe=7,
            game_round=14,
            source="marker-roads",
        ))
        db = self.session_factory()
        try:
            self.assertEqual("placing", db.get(BetRecord, bet.id).status)
        finally:
            db.close()

    def test_other_table_metadata_cannot_quarantine_ambiguous_bet(self) -> None:
        bet = self.store.save_bet(
            round_id="ae_sexy:C01:7:13",
            table_name="Baccarat C01",
            side="player",
            stake=20,
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Live aggregate",
            reason="test",
            target_round_index=13,
            game_shoe=7,
            game_round=13,
            status="uncertain",
            execution_mode="real",
        )
        bettor = AutoBettor(BettingSession([20]), self.store)

        self.assertEqual([], bettor.classify_stale_pending(
            table_name="Baccarat C02",
            game_shoe=99,
            game_round=99,
            source="gp-winner",
        ))
        db = self.session_factory()
        try:
            self.assertEqual("uncertain", db.get(BetRecord, bet.id).status)
        finally:
            db.close()

    def test_tab_run_outcomes_include_only_settled_allocations_in_epoch(self) -> None:
        def save_settled(round_number: int, epoch: str, outcome: str) -> None:
            bet = self.store.save_bet(
                round_id=f"ae_sexy:C01:7:{round_number}",
                table_name="Baccarat C01", side="player", stake=100,
                stake_index=0, pattern_id="multi_live", pattern_name="test",
                reason="outcome history", target_round_index=round_number,
                game_shoe=7, game_round=round_number, status="placed",
            )
            self.store.save_bet_allocations(bet.id, [{
                "tab_id": "tab-1", "tab_name": "Tab 1", "side": "player",
                "stake": 100, "placement_status": "virtual",
            }])
            self.store.begin_placement_attempt(bet.id, epoch, [{
                "tab_id": "tab-1", "side": "player", "stake": 100,
                "execution_mode": "simulation", "placement_status": "virtual",
            }])
            self.store.resolve_bet_allocations(bet.id, [{
                "tab_id": "tab-1", "outcome": outcome,
                "profit": 100 if outcome == "win" else (-100 if outcome == "loss" else 0),
            }])

        save_settled(11, "old-epoch", "loss")
        save_settled(12, "current-epoch", "win")
        save_settled(13, "current-epoch", "push")

        pending = self.store.save_bet(
            round_id="ae_sexy:C01:7:14", table_name="Baccarat C01", side="player",
            stake=100, stake_index=0, pattern_id="multi_live", pattern_name="test",
            reason="pending", target_round_index=14, game_shoe=7, game_round=14,
            status="placed",
        )
        self.store.save_bet_allocations(pending.id, [{
            "tab_id": "tab-1", "tab_name": "Tab 1", "side": "player",
            "stake": 100, "placement_status": "placed",
        }])
        self.store.begin_placement_attempt(pending.id, "current-epoch", [{
            "tab_id": "tab-1", "side": "player", "stake": 100,
        }])

        outcomes = self.store.load_tab_run_outcomes("tab-1", "current-epoch")

        self.assertEqual(["win", "push"], [row["outcome"] for row in outcomes])
        self.assertEqual([12, 13], [row["round"] for row in outcomes])
        self.assertTrue(all(row["execution_mode"] == "virtual" for row in outcomes))

    def test_tab_run_bet_history_includes_pending_and_only_current_epoch(self) -> None:
        def save_allocation(
            round_number: int,
            epoch: str,
            *,
            execution_mode: str,
            placement_status: str,
            outcome: str | None = None,
        ) -> None:
            bet = self.store.save_bet(
                round_id=f"ae_sexy:C01:8:{round_number}",
                table_name="Baccarat C01", side="player", stake=100,
                stake_index=round_number, pattern_id="multi_live",
                pattern_name="test", reason="bet history",
                target_round_index=round_number, game_shoe=8,
                game_round=round_number, status=placement_status,
            )
            self.store.save_bet_allocations(bet.id, [{
                "tab_id": "tab-1", "tab_name": "Tab 1", "side": "player",
                "stake": 100, "stake_index": round_number,
                "placement_status": placement_status,
            }])
            self.store.begin_placement_attempt(bet.id, epoch, [{
                "tab_id": "tab-1", "side": "player", "stake": 100,
                "execution_mode": execution_mode,
                "placement_status": placement_status,
            }])
            if outcome is not None:
                self.store.resolve_bet_allocations(bet.id, [{
                    "tab_id": "tab-1", "outcome": outcome,
                    "profit": 100 if outcome == "win" else -100,
                }])

        save_allocation(
            21, "old-epoch", execution_mode="real", placement_status="placed",
            outcome="loss",
        )
        save_allocation(
            22, "current-epoch", execution_mode="simulation",
            placement_status="virtual", outcome="win",
        )
        save_allocation(
            23, "current-epoch", execution_mode="real",
            placement_status="placed",
        )

        page = self.store.load_tab_run_bet_history(
            "tab-1", "current-epoch", page=1, page_size=10
        )

        self.assertEqual(2, page["total"])
        self.assertEqual([23, 22], [row["round"] for row in page["items"]])
        pending, settled = page["items"]
        self.assertEqual("real", pending["execution_mode"])
        self.assertEqual("placed", pending["placement_status"])
        self.assertIsNone(pending["outcome"])
        self.assertEqual("virtual", settled["execution_mode"])
        self.assertEqual("win", settled["outcome"])
        self.assertEqual(100.0, settled["profit"])

    def test_journal_statistics_use_only_settled_allocations_and_durable_signals(self) -> None:
        def save_settled(
            round_number: int, outcome: str, execution_mode: str
        ) -> None:
            bet = self.store.save_bet(
                round_id=f"ae_sexy:C01:9:{round_number}",
                table_name="Baccarat C01", side="player", stake=100,
                stake_index=0, pattern_id="multi_live", pattern_name="test",
                reason="statistics", target_round_index=round_number,
                game_shoe=9, game_round=round_number, status="placed",
            )
            self.store.save_bet_allocations(bet.id, [{
                "tab_id": "tab-stat", "tab_name": "Stats", "side": "player",
                "stake": 100, "placement_status": "virtual"
                if execution_mode == "simulation" else "placed",
            }])
            self.store.begin_placement_attempt(bet.id, "run", [{
                "tab_id": "tab-stat", "side": "player", "stake": 100,
                "execution_mode": execution_mode,
            }])
            self.store.resolve_bet_allocations(bet.id, [{
                "tab_id": "tab-stat", "outcome": outcome,
                "profit": 100 if outcome == "win" else (-50 if outcome == "loss" else 0),
            }])

        save_settled(31, "win", "simulation")
        save_settled(32, "loss", "real")
        save_settled(33, "push", "real")
        self.assertTrue(self.store.record_strategy_signal(
            tab_id="tab-stat", run_epoch="run", table_name="Baccarat C01",
            history_size=31, side="player", reason="signal",
        ))
        self.assertFalse(self.store.record_strategy_signal(
            tab_id="tab-stat", run_epoch="run", table_name="Baccarat C01",
            history_size=31, side="player", reason="duplicate",
        ))
        self.assertTrue(self.store.record_strategy_signal(
            tab_id="tab-stat", run_epoch="run", table_name="Baccarat C01",
            history_size=32, side="banker", reason="signal",
        ))

        stats = self.store.load_tab_journal_statistics("tab-stat")

        self.assertEqual({
            "signals": 2, "virtual_bets": 1, "wins": 1, "losses": 1,
            "pushes": 1, "valid_bets": 2, "max_win_streak": 1,
            "max_loss_streak": 1, "statistics_profit": 50.0,
        }, stats)
        self.assertEqual({
            "signals": 0, "virtual_bets": 0, "wins": 0, "losses": 0,
            "pushes": 0, "valid_bets": 0, "max_win_streak": 0,
            "max_loss_streak": 0, "statistics_profit": 0.0,
        }, self.store.load_tab_journal_statistics(
            "tab-stat", reset_after_allocation_id=99999,
            reset_after_signal_id=99999,
        ))


if __name__ == "__main__":
    unittest.main()
