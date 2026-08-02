from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from src.auto_bettor import AutoBettor
from src.betting_session import BettingSession
from src.database import init_db
from src.models import BetSide
from src.risk_decision import ExecutionMode, RiskCode, RiskDecision
from src.strategy_decision import StrategyDecision
from src.strategy_lifecycle import (
    ShadowPolicy,
    StrategyLifecycleService,
    TabAuthorityDecision,
    TabLifecycleMode,
)
from src.strategy_tab_store import StrategyTabStore
from src.strategy_tabs import SimulationTabConfig, StrategyTabsConfig


class StrategyLifecycleServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "toolbet.db"
        self.session_factory = init_db(str(self.db_path))
        self.engine = self.session_factory.kw["bind"]
        self.store = StrategyTabStore(self.session_factory)
        self.store.save_config(
            StrategyTabsConfig(
                selected_tab_id="one",
                tabs=[
                    SimulationTabConfig(id="one", name="Một", stakes=[0, 100]),
                    SimulationTabConfig(id="two", name="Hai", stakes=[0, 200]),
                ],
            )
        )
        self.lifecycle = StrategyLifecycleService(
            self.session_factory,
            policy=ShadowPolicy(
                minimum_evaluations=3,
                maximum_mismatch_rate=0.34,
                maximum_errors=0,
            ),
        )

    def tearDown(self):
        self.engine.dispose()
        self.temp.cleanup()

    def qualify(self, tab_id: str):
        self.lifecycle.start_shadow(tab_id)
        self.lifecycle.record_shadow(tab_id, matched=True)
        self.lifecycle.record_shadow(tab_id, matched=True)
        return self.lifecycle.record_shadow(tab_id, matched=False)

    def test_tab_switches_directly_to_live_without_shadow_threshold(self):
        status = self.lifecycle.set_live("one", live=True)

        self.assertEqual("live", status["mode"])
        self.assertEqual(0, status["shadow_evaluations"])

    def test_multiple_tabs_can_be_live_at_the_same_time(self):
        self.lifecycle.set_live("one", live=True)
        self.lifecycle.set_live("two", live=True)
        status = self.lifecycle.status()

        self.assertEqual("live", status["one"]["mode"])
        self.assertEqual("live", status["two"]["mode"])
        self.assertEqual(
            ["one", "two"],
            [
                tab.id
                for tab in self.lifecycle.tabs_in_mode(
                    TabLifecycleMode.LIVE
                )
            ],
        )

    def test_config_save_persists_simple_simulation_or_live_mode(self):
        config = self.store.load_or_import(StrategyTabsConfig())
        config.tabs[0].mode = "live"
        saved = self.store.save_config(config)
        self.assertEqual("live", saved.tabs[0].mode)

        changed = self.store.load_or_import(StrategyTabsConfig())
        changed.tabs[0].strategy_id = "follow_last"
        saved = self.store.save_config(changed)
        self.assertEqual("live", saved.tabs[0].mode)

    def test_unsafe_runtime_demotes_live(self):
        self.lifecycle.set_live("one", live=True)

        changed = self.lifecycle.demote_live(reason="Browser disconnected")

        self.assertEqual(["one"], changed)
        status = self.lifecycle.status()["one"]
        self.assertEqual("simulation", status["mode"])
        self.assertEqual("Browser disconnected", status["demote_reason"])

    def test_strategy_without_pool_data_cannot_be_set_live(self):
        config = self.store.load_or_import(StrategyTabsConfig())
        config.tabs[0].strategy_id = "sequence_major_minor"
        self.store.save_config(config)
        with self.assertRaisesRegex(ValueError, "chưa đủ dữ liệu"):
            self.lifecycle.set_live("one", live=True)


class FakeStore:
    def __init__(self):
        self.saved_bets = []
        self.resolved_bets = []
        self.events = []

    def save_event(self, *_args, **_kwargs):
        self.events.append((_args, _kwargs))
        return None

    def reserve_round(
        self,
        _table_name,
        _target_index,
        *,
        game_shoe,
        game_round,
    ):
        return SimpleNamespace(
            round_id=f"round-{game_shoe}-{game_round}",
            session_date="2026-08-02",
            session_no=game_round,
            game_shoe=game_shoe,
            game_round=game_round,
        )

    def save_bet(self, **kwargs):
        self.saved_bets.append(kwargs)
        return SimpleNamespace(id=101)

    def resolve_bet(self, bet_id, **kwargs):
        self.resolved_bets.append((bet_id, kwargs))


class AutoBettorLiveAuthorityTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def authority(
        tab_id: str,
        side: BetSide,
        stake: int,
    ) -> TabAuthorityDecision:
        return TabAuthorityDecision(
            tab_id=tab_id,
            tab_name=tab_id,
            mode=TabLifecycleMode.LIVE,
            strategy=StrategyDecision.bet(
                strategy_id="follow-last",
                strategy_name=tab_id,
                side=side,
                reason="Live decision",
                signal_id=f"signal-{tab_id}",
                history_size=2,
            ),
            risk=RiskDecision.approve(
                execution_mode=ExecutionMode.REAL,
                reason="Approved",
            ),
            stake=stake,
        )

    async def test_opposite_live_tabs_are_armed_in_one_transaction(self):
        session = BettingSession([100])
        session.configure(auto_bet=True)
        bettor = AutoBettor(session, FakeStore())
        authorities = [
            self.authority("player-tab", BetSide.PLAYER, 100),
            self.authority("banker-tab", BetSide.BANKER, 200),
        ]
        bettor.set_strategy_tab_live_evaluator(
            lambda **_kwargs: authorities
        )

        with patch.object(bettor, "_schedule_bet_on_open_poll"):
            await bettor._arm_bet_signal(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="C01",
                skip_tie=True,
                source="gp-winner",
            )

        self.assertEqual(
            ["player-tab", "banker-tab"],
            [
                item.tab_id
                for item in bettor._armed_bet["live_authorities"]
            ],
        )

    async def test_multi_live_places_player_and_banker_then_resolves_each_tab(self):
        session = BettingSession([100])
        session.configure(auto_bet=True)
        store = FakeStore()
        bettor = AutoBettor(session, store)
        authorities = [
            self.authority("player-tab", BetSide.PLAYER, 100),
            self.authority("banker-tab", BetSide.BANKER, 200),
        ]
        bettor._armed_bet = {
            "live_authorities": authorities,
            "armed_at_len": 2,
            "table_name": "C01",
        }
        bettor.set_round_meta_provider(
            lambda _table, _index: {
                "game_shoe": 7,
                "game_round": 12,
            }
        )
        result_handler = lambda allocations, _result: [
            {
                **item,
                "outcome": (
                    "win" if item["side"] == "player" else "loss"
                ),
                "profit": (
                    item["stake"]
                    if item["side"] == "player"
                    else -item["stake"]
                ),
            }
            for item in allocations
        ]
        bettor.set_multi_live_result_handler(result_handler)
        place = AsyncMock(return_value=True)

        with (
            patch(
                "src.auto_bettor.read_account_balance",
                AsyncMock(return_value=1000.0),
            ),
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
            patch("src.auto_bettor.wait_and_place_bet", place),
        ):
            placed = await bettor._try_place_multi_live(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="C01",
                source="cuoc-mo-multi-live",
                bet_timeout_sec=30,
            )

        self.assertTrue(placed)
        self.assertEqual(2, place.await_count)
        self.assertEqual(BetSide.PLAYER, place.await_args_list[0].args[1])
        self.assertEqual(100, place.await_args_list[0].args[2])
        self.assertEqual(BetSide.BANKER, place.await_args_list[1].args[1])
        self.assertEqual(200, place.await_args_list[1].args[2])
        self.assertEqual("multi", store.saved_bets[0]["side"])
        self.assertEqual(300, session.state.pending.stake)

        await bettor._resolve_if_needed(BetSide.PLAYER, "C01")

        self.assertIsNone(session.state.pending)
        self.assertEqual(-100.0, session.state.session_profit)
        self.assertEqual(-100.0, store.resolved_bets[0][1]["profit"])
    async def test_live_tab_decision_is_authority_even_when_legacy_disagrees(self):
        session = BettingSession([100])
        session.configure(auto_bet=True)
        bettor = AutoBettor(session, FakeStore())
        live = TabAuthorityDecision(
            tab_id="live-one",
            tab_name="Live One",
            mode=TabLifecycleMode.LIVE,
            strategy=StrategyDecision.bet(
                strategy_id="follow-last",
                strategy_name="Follow",
                side=BetSide.BANKER,
                reason="Live tab chose banker",
                signal_id="follow_last",
                history_size=2,
            ),
            risk=RiskDecision.approve(
                execution_mode=ExecutionMode.REAL,
                reason="Approved",
            ),
            stake=100,
        )
        bettor.set_strategy_tab_live_evaluator(lambda **_kwargs: live)

        with patch.object(bettor, "_schedule_bet_on_open_poll"):
            await bettor._arm_bet_signal(
                object(),
                [BetSide.PLAYER, BetSide.BANKER],
                table_name="C01",
                skip_tie=True,
                source="gp-winner",
            )

        self.assertTrue(bettor.has_armed_bet)
        self.assertEqual(BetSide.BANKER, bettor._armed_bet["signal"].bet_side)
        self.assertEqual("follow_last", bettor._armed_bet["signal"].pattern_id)

    async def test_stake_zero_live_decision_arms_virtual_round_without_click(self):
        session = BettingSession([0, 100])
        session.configure(auto_bet=True)
        bettor = AutoBettor(session, FakeStore())
        virtual = TabAuthorityDecision(
            tab_id="live-one",
            tab_name="Live One",
            mode=TabLifecycleMode.LIVE,
            strategy=StrategyDecision.bet(
                strategy_id="follow-last",
                strategy_name="Follow",
                side=BetSide.PLAYER,
                reason="Virtual trial",
            ),
            risk=RiskDecision.approve(
                execution_mode=ExecutionMode.VIRTUAL,
                reason="Stake 0",
            ),
            stake=0,
        )
        bettor.set_strategy_tab_live_evaluator(lambda **_kwargs: virtual)

        with patch.object(bettor, "_schedule_bet_on_open_poll") as schedule:
            await bettor._arm_bet_signal(
                object(),
                [BetSide.BANKER],
                table_name="C01",
                skip_tie=True,
                source="gp-winner",
            )

        self.assertTrue(bettor.has_armed_bet)
        self.assertEqual(0, bettor._armed_bet["live_authorities"][0].stake)
        schedule.assert_called_once()
