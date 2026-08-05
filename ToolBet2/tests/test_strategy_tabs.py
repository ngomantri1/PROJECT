from __future__ import annotations

import unittest

from src.models import BetSide
from src.overlay import build_overlay_payload
from src.strategy_tabs import (
    SIMULATION_STRATEGIES,
    SimulationTabConfig,
    StrategyTabsConfig,
    normalize_strategy_tabs,
    simulate_strategy_tab,
    strategy_tabs_to_overlay,
)


class StrategyTabsTests(unittest.TestCase):
    def test_base_overlay_no_longer_publishes_legacy_pattern_signals(self):
        payload = build_overlay_payload(
            [BetSide.PLAYER, BetSide.BANKER], skip_tie=True
        )
        self.assertFalse(payload["has_signal"])
        self.assertIsNone(payload["signal_key"])
        self.assertEqual([], payload["matched"])
        self.assertEqual([], payload["patterns"])

    def test_legacy_patterns_are_removed_and_old_tabs_migrate_to_follow_last(self):
        self.assertNotIn(
            "legacy_patterns", {item["id"] for item in SIMULATION_STRATEGIES}
        )
        config = normalize_strategy_tabs({
            "tabs": [{"id": "old", "strategy_id": "legacy_patterns"}],
        })
        self.assertEqual("follow_last", config.tabs[0].strategy_id)

    def test_normalization_keeps_at_least_one_unique_tab(self):
        config = normalize_strategy_tabs({
            "selected_tab_id": "same",
            "tabs": [
                {"id": "same", "name": " A ", "stakes": [0, 100]},
                {"id": "same", "name": "B", "stakes": [-5]},
            ],
        })

        self.assertEqual(2, len(config.tabs))
        self.assertEqual("A", config.tabs[0].name)
        self.assertNotEqual(config.tabs[0].id, config.tabs[1].id)
        self.assertEqual([0, 100], config.tabs[0].stakes)
        self.assertEqual([0, 100, 110, 120, 130], config.tabs[1].stakes)

    def test_bet_when_remaining_seconds_defaults_to_ten_and_minimum_three(self):
        config = normalize_strategy_tabs({
            "tabs": [
                {"id": "default"},
                {"id": "too-low", "bet_when_remaining_seconds": 1},
            ],
        })

        self.assertEqual(10, config.tabs[0].bet_when_remaining_seconds)
        self.assertEqual(3, config.tabs[1].bet_when_remaining_seconds)

    def test_legacy_disabled_tab_is_upgraded_to_start_controlled_tab(self):
        tab = SimulationTabConfig(
            enabled=False,
            strategy_id="follow_last",
            stakes=[10, 20],
        )
        status = simulate_strategy_tab(
            tab,
            [BetSide.PLAYER, BetSide.BANKER, BetSide.BANKER],
            skip_tie=True,
        )

        self.assertTrue(tab.normalized().enabled)
        self.assertGreater(status["signals"], 0)
        self.assertGreater(status["virtual_bets"], 0)

    def test_follow_last_replay_is_virtual_and_reports_current_signal(self):
        tab = SimulationTabConfig(
            name="Bám", strategy_id="follow_last", stakes=[10, 20], enabled=True
        )
        status = simulate_strategy_tab(
            tab,
            [BetSide.PLAYER, BetSide.BANKER, BetSide.BANKER],
            skip_tie=True,
        )

        self.assertEqual(2, status["virtual_bets"])
        self.assertEqual(1, status["wins"])
        self.assertEqual(1, status["losses"])
        self.assertEqual(BetSide.BANKER.value, status["current"]["side"])

    def test_statistics_include_valid_bets_and_max_win_loss_streaks(self):
        tab = SimulationTabConfig(
            strategy_id="follow_last", stakes=[10], enabled=True
        )
        status = simulate_strategy_tab(
            tab,
            [
                BetSide.PLAYER,
                BetSide.PLAYER,
                BetSide.PLAYER,
                BetSide.PLAYER,
                BetSide.BANKER,
                BetSide.PLAYER,
                BetSide.BANKER,
                BetSide.PLAYER,
                BetSide.BANKER,
            ],
            skip_tie=True,
        )

        self.assertEqual(status["wins"] + status["losses"], status["valid_bets"])
        self.assertGreaterEqual(status["max_win_streak"], 3)
        self.assertGreaterEqual(status["max_loss_streak"], 3)

    def test_reverse_last_ignores_tie_and_chooses_opposite_side(self):
        tab = SimulationTabConfig(strategy_id="reverse_last", stakes=[0, 10])
        status = simulate_strategy_tab(
            tab, [BetSide.BANKER, BetSide.TIE, BetSide.PLAYER], skip_tie=True
        )

        self.assertEqual(BetSide.BANKER.value, status["current"]["side"])
        self.assertIn("Đảo", status["current"]["reason"])

    def test_schedule_replay_advances_for_each_settled_round_including_ties(self):
        tab = SimulationTabConfig(
            strategy_id="time_sliced_hedge", stakes=[10], enabled=True
        )
        status = simulate_strategy_tab(
            tab,
            [
                BetSide.BANKER,
                BetSide.BANKER,
                BetSide.TIE,
                BetSide.TIE,
                BetSide.BANKER,
                BetSide.BANKER,
            ],
            skip_tie=True,
        )

        self.assertEqual(BetSide.PLAYER.value, status["current"]["side"])

    def test_smart_prev_reverses_when_outer_runs_are_equal(self):
        tab = SimulationTabConfig(strategy_id="smart_prev", stakes=[0, 10])
        status = simulate_strategy_tab(
            tab,
            [BetSide.BANKER, BetSide.PLAYER, BetSide.BANKER, BetSide.PLAYER],
            skip_tie=True,
        )

        self.assertEqual(BetSide.BANKER.value, status["current"]["side"])
        self.assertIn("Đảo", status["current"]["reason"])

    def test_smart_prev_advanced_follows_on_a_run_longer_than_one(self):
        tab = SimulationTabConfig(strategy_id="smart_prev_advanced", stakes=[0, 10])
        status = simulate_strategy_tab(
            tab,
            [BetSide.BANKER, BetSide.PLAYER, BetSide.PLAYER],
            skip_tie=True,
        )

        self.assertEqual(BetSide.PLAYER.value, status["current"]["side"])
        self.assertIn("Bám", status["current"]["reason"])

    def test_overlay_payload_is_explicitly_simulation_only(self):
        payload = strategy_tabs_to_overlay(
            StrategyTabsConfig().normalized(), [BetSide.PLAYER], skip_tie=True
        )

        self.assertEqual("managed", payload["mode"])
        self.assertIn("không click chip", payload["message"])
        self.assertEqual(1, len(payload["tabs"]))
