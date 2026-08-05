from __future__ import annotations

import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from main import HistoryWatcher
from src.auto_bettor import AutoBettor, BET_TRIGGER_SOURCES
from src.betting_session import BettingSession, PendingBet
from src.database import init_db
from src.db_store import GameDataStore
from src.live_run_limits import LiveRunLimitTracker
from src.ae_sexy_betting import (
    PreClickGuardRejected,
    resolve_chip_values,
    wait_and_place_bet,
)
from src.config import AppConfig
from src.models import BetSide
from src.strategy_lifecycle import TabLifecycleMode
from src.ui_contracts import UiCommand, UiCommandType


class _ToolAuth:
    def __init__(self, allowed: bool = True):
        self.allowed = allowed

    def can(self, capability: str) -> bool:
        return self.allowed and capability == "live_bet"


class LiveExecutionPolicyTests(unittest.IsolatedAsyncioTestCase):
    def test_journal_change_refreshes_only_strategy_tabs_overlay(self):
        overlay = Mock()
        watcher = SimpleNamespace(
            overlay=overlay,
            _overlay_strategy_tabs_payload=Mock(return_value={"tabs": []}),
        )

        HistoryWatcher._on_bet_journal_changed_refresh_overlay(watcher)

        watcher._overlay_strategy_tabs_payload.assert_called_once_with(
            record_runtime=False
        )
        overlay.set_strategy_tabs.assert_called_once_with({"tabs": []})

    def test_auto_bettor_notifies_after_committed_journal_change(self):
        handler = Mock()
        bettor = AutoBettor(BettingSession([10]), SimpleNamespace())
        bettor.set_bet_journal_changed_handler(handler)

        bettor._notify_bet_journal_changed()

        handler.assert_called_once_with()

    def test_same_table_history_refresh_keeps_valid_workspace_ready(self):
        watcher = SimpleNamespace(
            _workspace_loading=False,
            state=SimpleNamespace(
                table_name="Baccarat C01",
                table_id="Baccarat C01",
                history=[BetSide.BANKER],
            ),
        )

        self.assertFalse(
            HistoryWatcher._history_reload_needs_loading(watcher, "Baccarat C01")
        )
        self.assertTrue(
            HistoryWatcher._history_reload_needs_loading(watcher, "Baccarat C02")
        )
        watcher._workspace_loading = True
        self.assertTrue(
            HistoryWatcher._history_reload_needs_loading(watcher, "Baccarat C01")
        )

    def test_partial_dom_chip_values_never_fall_back_to_fake_tray(self):
        self.assertEqual(
            [10, 50, 100, 500, 0],
            resolve_chip_values(5, [10, 50, 100, 500, 0]),
        )

    async def test_result_before_multi_live_click_expires_the_intent(self):
        session = BettingSession([10, 100])
        pending = PendingBet(
            bet_id=99,
            round_id="ae_sexy:C02:26965:2",
            side=BetSide.BANKER,
            stake=10,
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Multi live",
            reason="test",
            target_round_index=1,
            placed_at=datetime.now(),
            table_name="Baccarat C02",
            game_shoe=26965,
            game_round=2,
        )
        session.set_pending(pending)
        bettor = AutoBettor(session, SimpleNamespace())
        bettor._multi_live_pending = {
            "round_id": pending.round_id,
            "bet_id": pending.bet_id,
            "ready_to_resolve": False,
        }
        bettor._real_bet_guard_allowed = AsyncMock(return_value=(True, "ok"))

        bettor._note_result_arrival_before_placement(
            table_name="Baccarat C02",
            result_meta={"game_shoe": 26965, "game_round": 2},
        )
        allowed, reason = await bettor._multi_live_pre_click_guard(
            bet_id=99,
            stake=10,
            tab_ids=["tab-1"],
        )

        self.assertFalse(allowed)
        self.assertEqual("result_before_placement_confirmation", reason)
        bettor._real_bet_guard_allowed.assert_not_awaited()

    def watcher(self, mode: str, *, allowed: bool = True):
        return SimpleNamespace(
            config=AppConfig.model_validate({"live_execution": {"mode": mode}}),
            tool_auth=_ToolAuth(allowed),
            small_stake_guard=SimpleNamespace(
                evaluate=lambda **_kwargs: SimpleNamespace(
                    allowed=False, reason="lease missing"
                )
            ),
        )

    @staticmethod
    def run_watcher():
        session = BettingSession([100])

        class Bettor:
            durable_block_reason = ""

            def on_toggle(self, enabled, *, ignore_durable=False):
                session.configure(auto_bet=enabled)
                return bool(enabled)

        watcher = SimpleNamespace(
            auto_bettor=Bettor(),
            betting_session=session,
            overlay=SimpleNamespace(
                set_betting_ui=lambda **_kwargs: None,
                set_run_enabled=lambda _enabled: None,
            ),
            config=AppConfig(),
            _run_enabled=True,
        )
        watcher._apply_execution_enabled = lambda enabled, ignore_durable=False: (
            HistoryWatcher._apply_execution_enabled(
                watcher, enabled, ignore_durable=ignore_durable
            )
        )
        return watcher

    def test_internal_execution_pause_keeps_operator_run_latch(self):
        watcher = self.run_watcher()
        watcher.betting_session.configure(auto_bet=True)

        actual = HistoryWatcher._apply_execution_enabled(watcher, False)

        self.assertFalse(actual)
        self.assertFalse(watcher.betting_session.state.auto_bet)
        self.assertTrue(watcher._run_enabled)

    def test_saving_config_while_clicking_keeps_execution_enabled(self):
        saved = SimpleNamespace(tabs=[SimpleNamespace(
            id="live-tab", enabled=True,
        )])
        save_config = Mock(return_value=saved)
        apply_execution = Mock()
        watcher = SimpleNamespace(
            strategy_tab_store=SimpleNamespace(save_config=save_config),
            config=SimpleNamespace(strategy_tabs=None),
            _sync_live_money_managers=Mock(),
            _run_enabled=True,
            _running_tab_id="live-tab",
            auto_bettor=SimpleNamespace(is_busy=True),
            _apply_execution_enabled=apply_execution,
            betting_session=SimpleNamespace(active_money_manager=None),
            _overlay_strategy_tabs_payload=lambda: {"tabs": []},
            overlay=SimpleNamespace(set_strategy_tabs=Mock()),
        )
        payload = {"selected_tab_id": "live-tab", "tabs": []}

        with patch("main.normalize_strategy_tabs", return_value="normalized"):
            result = HistoryWatcher._handle_save_strategy_tabs(watcher, payload)

        self.assertTrue(result["ok"])
        save_config.assert_called_once_with("normalized")
        watcher._sync_live_money_managers.assert_called_once_with()
        apply_execution.assert_not_called()

    def test_explicit_stop_is_the_only_path_that_clears_run_latch(self):
        watcher = self.run_watcher()

        response = HistoryWatcher._handle_set_run_enabled(watcher, False)

        self.assertFalse(response["run_enabled"])
        self.assertFalse(watcher._run_enabled)

    def test_new_start_resets_money_manager_once_but_start_retry_does_not(self):
        session = BettingSession([10, 100])

        class Bettor:
            durable_block_reason = ""

            def on_toggle(self, enabled, *, ignore_durable=False):
                session.configure(auto_bet=enabled)
                return bool(enabled)

            def begin_run_epoch(self):
                return "epoch"

        class Manager:
            def __init__(self):
                self.reset_calls = 0

            def reset(self):
                self.reset_calls += 1

        manager = Manager()
        store = SimpleNamespace(saved=[])
        store.save = lambda tab_id, saved_manager: store.saved.append((tab_id, saved_manager))
        live_tab = SimpleNamespace(id="live-tab", enabled=True)
        watcher = SimpleNamespace(
            auto_bettor=Bettor(), betting_session=session,
            overlay=SimpleNamespace(set_betting_ui=lambda **_kwargs: None, set_run_enabled=lambda _enabled: None),
            config=AppConfig(), _run_enabled=False,
            strategy_lifecycle=SimpleNamespace(tabs_in_mode=lambda _mode: [live_tab]),
            _live_money_managers={"live-tab": manager},
            money_state_store=store, _active_money_tab_id="",
        )
        watcher._apply_execution_enabled = lambda enabled, ignore_durable=False: (
            HistoryWatcher._apply_execution_enabled(watcher, enabled, ignore_durable=ignore_durable)
        )
        watcher._running_tab_id = ""
        watcher._reset_live_money_for_new_run = lambda tab_id: (
            HistoryWatcher._reset_live_money_for_new_run(watcher, tab_id)
        )
        watcher._live_run_limits = SimpleNamespace(reset_tab=Mock())

        HistoryWatcher._handle_set_run_enabled(
            watcher, True, tab_id="live-tab"
        )
        HistoryWatcher._handle_set_run_enabled(
            watcher, True, tab_id="live-tab"
        )

        self.assertEqual(1, manager.reset_calls)
        self.assertEqual([("live-tab", manager)], store.saved)
        watcher._live_run_limits.reset_tab.assert_called_once_with("live-tab")

    def test_running_tab_status_uses_live_money_manager_quote(self):
        quote = SimpleNamespace(stake=10, level_index=0, total_levels=16)
        watcher = SimpleNamespace(
            _live_money_managers={
                "live-tab": SimpleNamespace(quote=lambda: quote)
            }
        )

        status = HistoryWatcher._status_with_live_quote(
            watcher,
            "live-tab",
            {"current": {"side": "player", "stake": 140, "level": 4}},
        )

        self.assertEqual("player", status["current"]["side"])
        self.assertEqual(10, status["current"]["stake"])
        self.assertEqual(1, status["current"]["level"])
        self.assertEqual(16, status["current"]["total_levels"])

    def test_runtime_issue_never_demotes_the_operator_live_tab(self):
        lifecycle = SimpleNamespace(
            tabs_in_mode=Mock(return_value=[SimpleNamespace(id="live-tab")]),
            demote_live=Mock(),
        )
        watcher = SimpleNamespace(strategy_lifecycle=lifecycle)

        HistoryWatcher._report_live_runtime_issue(watcher, "UI tạm thời chưa sẵn sàng")

        lifecycle.tabs_in_mode.assert_called_once_with(TabLifecycleMode.LIVE)
        lifecycle.demote_live.assert_not_called()

    async def test_production_does_not_require_pilot_lease(self):
        watcher = self.watcher("production")
        allowed, reason = await HistoryWatcher._check_small_stake_guard(
            watcher,
            stake=100,
            tab_ids=["live-tab"],
            bet_kind="main",
            current_bet_id=None,
        )
        self.assertTrue(allowed)
        self.assertIn("production", reason)

    async def test_explicit_start_arms_loaded_history_without_new_result(self):
        self.assertIn("operator-start", BET_TRIGGER_SOURCES)
        live_tab = SimpleNamespace(id="live-tab")
        arm_current = AsyncMock(return_value=True)
        live_tab = SimpleNamespace(id="live-tab", mode="live")
        watcher = SimpleNamespace(
            _require_tool_session=lambda: None,
            _effective_table_name=lambda: "Baccarat C01",
            config=SimpleNamespace(strategy_tabs=SimpleNamespace(tabs=[live_tab])),
            _live_preflight_status=lambda **_kwargs: {
                "enabled_live_tabs": 1,
                "allowed": True,
                "blockers": [],
            },
            _enabled_tabs=lambda mode: (
                [live_tab] if mode == TabLifecycleMode.LIVE else []
            ),
            _handle_set_run_enabled=lambda enabled, **_kwargs: {
                "run_enabled": bool(enabled),
                "running": bool(enabled),
                "auto_bet": bool(enabled),
            },
            _overlay_strategy_tabs_payload=lambda: {
                "tabs": [{"id": "live-tab", "status": {}, "run_profit": 0}]
            },
            overlay=SimpleNamespace(set_strategy_tabs=lambda _payload: None),
            _arm_current_history_after_start=arm_current,
        )

        result = await HistoryWatcher._handle_ui_command(
            watcher,
            UiCommand(
                type=UiCommandType.SET_RUN_STATE,
                payload={"tab_id": "live-tab", "running": True},
            ),
        )

        self.assertTrue(result["ok"])
        self.assertTrue(result["data"]["run_enabled"])
        arm_current.assert_awaited_once_with()

    async def test_start_cancels_and_parks_previous_click_before_arming_new_run(self):
        live_tab = SimpleNamespace(id="live-tab", mode="live")
        arm_current = AsyncMock(return_value=True)
        abandon = AsyncMock(return_value=[42])
        watcher = SimpleNamespace(
            _require_tool_session=lambda: None,
            _effective_table_name=lambda: "Baccarat C01",
            config=SimpleNamespace(strategy_tabs=SimpleNamespace(tabs=[live_tab])),
            auto_bettor=SimpleNamespace(
                is_busy=True,
                abandon_for_operator_restart=abandon,
                park_pending_for_table=lambda _table: [],
            ),
            betting_session=SimpleNamespace(state=SimpleNamespace(pending=None)),
            state=SimpleNamespace(history=[BetSide.PLAYER]),
            _live_preflight_status=lambda **_kwargs: {
                "enabled_live_tabs": 1,
                "allowed": False,
                "blockers": [{
                    "code": "CLICK_IN_PROGRESS",
                    "message": "Pipeline click đang hoạt động",
                }],
            },
            _handle_set_run_enabled=lambda enabled, **_kwargs: {
                "run_enabled": bool(enabled),
                "running": bool(enabled),
                "auto_bet": bool(enabled),
            },
            _overlay_strategy_tabs_payload=lambda: {
                "tabs": [{"id": "live-tab", "status": {}, "run_profit": 0}]
            },
            overlay=SimpleNamespace(set_strategy_tabs=lambda _payload: None),
            _arm_current_history_after_start=arm_current,
        )

        result = await HistoryWatcher._handle_ui_command(
            watcher,
            UiCommand(
                type=UiCommandType.SET_RUN_STATE,
                payload={"tab_id": "live-tab", "running": True},
            ),
        )

        self.assertTrue(result["ok"])
        self.assertFalse(result["data"]["restart_pending"])
        abandon.assert_awaited_once_with("Baccarat C01")
        arm_current.assert_awaited_once_with()

    def test_old_run_result_does_not_advance_restarted_money_manager(self):
        manager = SimpleNamespace(apply_result=Mock())
        watcher = SimpleNamespace(
            _live_tab_run_epochs={"live-tab": "new-run"},
            _live_money_managers={"live-tab": manager},
        )

        resolved = HistoryWatcher._resolve_multi_live_allocations(
            watcher,
            [{
                "tab_id": "live-tab",
                "side": "player",
                "stake": 10,
                "run_epoch": "old-run",
            }],
            BetSide.PLAYER,
        )

        manager.apply_result.assert_not_called()
        self.assertEqual("win", resolved[0]["outcome"])
        self.assertEqual(10.0, resolved[0]["profit"])
        self.assertTrue(resolved[0]["progression_ignored"])

    def test_auto_reset_keeps_statistics_but_resets_run_profit_and_money_level(self):
        manager = Mock()
        manager.apply_result.return_value = SimpleNamespace(
            profit=10.0,
            outcome=SimpleNamespace(value="win"),
            next_quote=SimpleNamespace(stake=20, level_index=1),
        )
        run_limits = LiveRunLimitTracker()
        money_state_store = SimpleNamespace(save=Mock())
        watcher = SimpleNamespace(
            _live_tab_run_epochs={"tab-1": "run-1"},
            _live_money_managers={"tab-1": manager},
            config=SimpleNamespace(strategy_tabs=SimpleNamespace(tabs=[
                SimpleNamespace(
                    id="tab-1", auto_reset_on_nonnegative_pnl=True,
                    take_profit=0, stop_loss=0,
                ),
            ])),
            _live_run_limits=run_limits,
            money_state_store=money_state_store,
            strategy_lifecycle=SimpleNamespace(record_settled_bet=Mock()),
            state=SimpleNamespace(history=[BetSide.PLAYER]),
        )

        resolved = HistoryWatcher._resolve_multi_live_allocations(
            watcher,
            [{"tab_id": "tab-1", "side": "player", "stake": 10, "run_epoch": "run-1"}],
            BetSide.PLAYER,
        )

        manager.reset.assert_called_once_with()
        money_state_store.save.assert_called_once_with("tab-1", manager)
        self.assertEqual(0, run_limits.status_for("tab-1").profit)
        self.assertEqual("win", resolved[0]["outcome"])
        self.assertEqual(10.0, resolved[0]["profit"])

    async def test_pilot_still_requires_finite_lease(self):
        watcher = self.watcher("pilot")
        allowed, reason = await HistoryWatcher._check_small_stake_guard(
            watcher,
            stake=100,
            tab_ids=["live-tab"],
            bet_kind="main",
            current_bet_id=None,
        )
        self.assertFalse(allowed)
        self.assertEqual("lease missing", reason)

    async def test_disabled_mode_and_missing_capability_block_physical_execution(self):
        disabled = self.watcher("disabled")
        self.assertFalse((await HistoryWatcher._check_small_stake_guard(
            disabled,
            stake=100,
            tab_ids=["live-tab"],
            bet_kind="main",
            current_bet_id=None,
        ))[0])

        production = self.watcher("production", allowed=False)
        allowed, reason = await HistoryWatcher._check_small_stake_guard(
            production,
            stake=100,
            tab_ids=["live-tab"],
            bet_kind="main",
            current_bet_id=None,
        )
        self.assertFalse(allowed)
        self.assertIn("capability", reason)

    async def test_final_guard_rejects_before_executor_clicks(self):
        executor = AsyncMock(return_value=True)
        guard = AsyncMock(return_value=(False, "production authorization revoked"))
        with (
            patch(
                "src.ae_sexy_betting.probe_betting_phase",
                AsyncMock(return_value={"closed": False}),
            ),
            patch(
                "src.ae_sexy_betting._betting_ready",
                AsyncMock(return_value=True),
            ),
            patch(
                "src.ae_sexy_betting.side_zone_visible",
                AsyncMock(return_value=(True, "player-zone")),
            ),
            patch("src.ae_sexy_betting._execute_bet_clicks", executor),
        ):
            with self.assertRaises(PreClickGuardRejected):
                await wait_and_place_bet(
                    object(),
                    BetSide.PLAYER,
                    100,
                    timeout_sec=1,
                    pre_click_guard=guard,
                )
        guard.assert_awaited_once()
        executor.assert_not_awaited()

    async def test_simulation_only_never_falls_back_to_legacy_executor(self):
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as directory:
            factory = init_db(str(Path(directory) / "simulation.db"))
            try:
                session = BettingSession([100])
                session.configure(auto_bet=True)
                bettor = AutoBettor(session, GameDataStore(factory, "ae_sexy"))
                bettor.set_decision_shadow_enabled(False)
                bettor.set_strategy_tab_live_evaluator(lambda **_kwargs: [])
                with patch(
                    "src.auto_bettor.get_active_signal",
                    side_effect=AssertionError("legacy fallback must not run"),
                ):
                    await bettor._arm_bet_signal(
                        object(),
                        [BetSide.PLAYER, BetSide.BANKER],
                        table_name="Baccarat C01",
                        skip_tie=True,
                        source="gp-winner",
                    )
                self.assertFalse(bettor.has_armed_bet)
            finally:
                factory.kw["bind"].dispose()


if __name__ == "__main__":
    unittest.main()
