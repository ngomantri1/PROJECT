from __future__ import annotations

import unittest

from src.models import BetSide
from src.statistical_strategies import (
    STATISTICAL_STRATEGIES,
    evaluate_statistical_strategy,
)
from src.strategy_tabs import (
    SIMULATION_STRATEGIES,
    SimulationTabConfig,
    decision_for_strategy_tab,
    simulate_strategy_tab,
)


def sides(text: str) -> list[BetSide]:
    mapping = {"B": BetSide.BANKER, "P": BetSide.PLAYER, "T": BetSide.TIE}
    return [mapping[value] for value in text]


class StatisticalStrategyTests(unittest.TestCase):
    def test_all_specs_are_exposed_in_workspace_registry(self):
        exposed = {item["id"] for item in SIMULATION_STRATEGIES}
        self.assertTrue({item.id for item in STATISTICAL_STRATEGIES} <= exposed)

    def test_ai_stat_uses_longest_matching_suffix(self):
        decision = evaluate_statistical_strategy(
            "ai_stat_parity", sides("BBPBBPBB")
        )
        self.assertEqual(BetSide.PLAYER, decision.side)
        self.assertIn("k=5", decision.reason)

    def test_transition_follows_when_same_is_not_less_than_flip(self):
        decision = evaluate_statistical_strategy(
            "state_transition", sides("BBBB")
        )
        self.assertEqual(BetSide.BANKER, decision.side)

    def test_run_length_reverses_at_three(self):
        decision = evaluate_statistical_strategy("run_length", sides("PBBB"))
        self.assertEqual(BetSide.PLAYER, decision.side)

    def test_knn_and_ngram_are_deterministic(self):
        history = sides("BBPBPBBPBPBBPBP")
        for strategy_id in ("knn_subsequence", "online_ngram", "ensemble_majority"):
            first = evaluate_statistical_strategy(strategy_id, history)
            second = evaluate_statistical_strategy(strategy_id, history)
            self.assertEqual(first.to_dict(), second.to_dict())

    def test_ties_do_not_advance_bp_strategy(self):
        plain = evaluate_statistical_strategy("run_length", sides("PBBB"))
        with_tie = evaluate_statistical_strategy("run_length", sides("PTBTBBT"))
        self.assertEqual(plain.side, with_tie.side)

    def test_major_minor_fails_closed_without_pool_data(self):
        decision = evaluate_statistical_strategy(
            "sequence_major_minor", sides("BPBP")
        )
        self.assertFalse(decision.wants_bet)
        self.assertFalse(decision.metadata["live_eligible"])
        self.assertIn("pool", decision.reason)

    def test_new_strategy_runs_through_existing_simulation_pipeline(self):
        tab = SimulationTabConfig(
            strategy_id="run_length", enabled=True, stakes=[10, 20]
        )
        status = simulate_strategy_tab(tab, sides("PBBBBP"), skip_tie=True)
        self.assertGreater(status["signals"], 0)
        self.assertGreater(status["virtual_bets"], 0)
        current = decision_for_strategy_tab(tab, sides("PBBBBP"), skip_tie=True)
        self.assertEqual("run_length", current.strategy_id)
