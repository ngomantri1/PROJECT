from __future__ import annotations

import unittest

from src.models import BetSide
from src.statistical_strategies import (
    EnsembleRuntime,
    ExpertPanelRuntime,
    OnlineNgramRuntime,
    ParityHotbackRuntime,
    STATISTICAL_STRATEGIES,
    Top10PatternRuntime,
    advance_statistical_runtime,
    create_statistical_runtime,
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

    def test_time_sliced_schedule_uses_runtime_counter_not_history_size(self):
        history = sides("BPBPBP")

        first = evaluate_statistical_strategy(
            "time_sliced_hedge", history, schedule_round_index=0
        )
        sixth = evaluate_statistical_strategy(
            "time_sliced_hedge", history, schedule_round_index=5
        )

        self.assertEqual(BetSide.PLAYER, first.side)
        self.assertEqual(BetSide.BANKER, sixth.side)

    def test_dual_schedule_matches_reference_ten_round_slots(self):
        history = sides("BBPBBPBB")
        expected = {
            0: BetSide.BANKER,
            3: BetSide.PLAYER,
            4: BetSide.PLAYER,
            7: BetSide.PLAYER,
            8: BetSide.BANKER,
            9: BetSide.PLAYER,
        }

        for position, side in expected.items():
            with self.subTest(position=position):
                decision = evaluate_statistical_strategy(
                    "dual_schedule_hedge",
                    history,
                    schedule_round_index=position,
                )
                self.assertEqual(side, decision.side)

    def test_dual_schedule_uses_reference_ai_tie_break(self):
        # For BPBB the longest suffix has one B and one P successor. The
        # reference DualSchedule AiStatMini reverses the last result.
        for position in (4, 5, 6, 9):
            with self.subTest(position=position):
                decision = evaluate_statistical_strategy(
                    "dual_schedule_hedge",
                    sides("BPBB"),
                    schedule_round_index=position,
                )
                self.assertEqual(BetSide.PLAYER, decision.side)

    def test_major_minor_fails_closed_without_pool_data(self):
        for strategy_id in ("sequence_major_minor", "pattern_major_minor"):
            with self.subTest(strategy_id=strategy_id):
                decision = evaluate_statistical_strategy(strategy_id, sides("BPBP"))

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

    def test_top10_runtime_switches_only_after_a_win_and_advances_after_loss(self):
        pattern_b = "B" * 10
        pattern_p = "P" * 10
        runtime = Top10PatternRuntime(
            counts={pattern_b: (2, 1), pattern_p: (3, 2)},
            tick=2,
            last_seen_cl50="B" * 50,
            pattern=pattern_b,
            pattern_count=2,
            pattern_index=9,
        )

        advance_statistical_runtime(
            "top10_pattern", runtime, sides("B" * 50), won=False
        )
        self.assertEqual(pattern_b, runtime.pattern)
        self.assertEqual(0, runtime.pattern_index)

        advance_statistical_runtime(
            "top10_pattern", runtime, sides("B" * 50), won=True
        )
        self.assertEqual(pattern_p, runtime.pattern)
        self.assertEqual(0, runtime.pattern_index)
        self.assertEqual(3, runtime.pattern_count)

    def test_top10_runtime_adds_newest_window_once_per_settlement(self):
        runtime = create_statistical_runtime("top10_pattern", sides("B" * 50))
        self.assertIsInstance(runtime, Top10PatternRuntime)
        newest_pattern = "B" * 9 + "P"
        before = runtime.counts.get(newest_pattern, (0, 0))[0]

        advance_statistical_runtime(
            "top10_pattern", runtime, sides("B" * 50 + "P"), won=None
        )
        once = runtime.counts[newest_pattern][0]
        advance_statistical_runtime(
            "top10_pattern", runtime, sides("B" * 50 + "P"), won=None
        )

        self.assertEqual(before + 1, once)
        self.assertEqual(once, runtime.counts[newest_pattern][0])

    def test_top10_does_not_add_sliding_window_before_fifty_bp_results(self):
        runtime = create_statistical_runtime("top10_pattern", sides("B" * 10))
        self.assertIsInstance(runtime, Top10PatternRuntime)
        before = dict(runtime.counts)

        advance_statistical_runtime(
            "top10_pattern", runtime, sides("B" * 10 + "P"), won=None
        )

        self.assertEqual(before, runtime.counts)

    def test_hotback_runtime_resets_pattern_only_on_loss(self):
        runtime = ParityHotbackRuntime(
            candidates={"BBBBB": 2, "PPPPP": 1},
            pattern="BBBBB",
            pattern_index=2,
        )

        advance_statistical_runtime(
            "parity_hotback", runtime, sides("PBBBBB"), won=None
        )
        self.assertEqual("BBBBB", runtime.pattern)
        self.assertEqual(3, runtime.pattern_index)
        self.assertEqual(3, runtime.candidates["BBBBB"])
        self.assertNotIn("PPPPP", runtime.candidates)

        advance_statistical_runtime(
            "parity_hotback", runtime, sides("PBBBBB"), won=False
        )
        self.assertEqual("", runtime.pattern)
        self.assertEqual(0, runtime.pattern_index)

    def test_ensemble_tracks_only_the_predictions_from_the_settled_round(self):
        history = sides("BPBPBPBPBPBP")
        runtime = create_statistical_runtime("ensemble_majority", history, seed="one")
        self.assertIsInstance(runtime, EnsembleRuntime)
        decision = evaluate_statistical_strategy(
            "ensemble_majority", history, runtime_state=runtime
        )

        advance_statistical_runtime(
            "ensemble_majority", runtime, history + [BetSide.BANKER], won=True
        )

        self.assertEqual(1, len(runtime.experts[0].recent))
        self.assertIn(runtime.experts[0].recent[0], (0, 1))
        self.assertEqual(BetSide.BANKER, decision.side)

    def test_online_ngram_warm_start_then_learns_the_settled_result(self):
        history = sides("BPBPBPBPBPBPBPBPBPBP")
        runtime = create_statistical_runtime("online_ngram", history, seed="one")
        self.assertIsInstance(runtime, OnlineNgramRuntime)
        before = sum(
            banker + player
            for table in runtime.tables for banker, player in table.values()
        )
        evaluate_statistical_strategy("online_ngram", history, runtime_state=runtime)

        advance_statistical_runtime(
            "online_ngram", runtime, history + [BetSide.BANKER], won=True
        )
        after = sum(
            banker + player
            for table in runtime.tables for banker, player in table.values()
        )

        self.assertEqual(before + 6, after)

    def test_online_ngram_tie_keeps_safety_decay_state_unchanged(self):
        history = sides("BPBPBPBPBPBP")
        runtime = create_statistical_runtime("online_ngram", history, seed="one")
        self.assertIsInstance(runtime, OnlineNgramRuntime)
        evaluate_statistical_strategy("online_ngram", history, runtime_state=runtime)
        runtime.safety_escalations = 1
        runtime.safe_rounds = 29
        runtime.safe_cooldown_left = 0

        advance_statistical_runtime(
            "online_ngram", runtime, history + [BetSide.TIE], won=None
        )

        self.assertEqual(1, runtime.safety_escalations)
        self.assertEqual(29, runtime.safe_rounds)
        self.assertEqual(0, runtime.safe_cooldown_left)

    def test_expert_panel_places_contrarian_and_trains_from_panel_result(self):
        history = sides("BBBPBBBP")
        runtime = create_statistical_runtime("expert_panel", history, seed="one")
        self.assertIsInstance(runtime, ExpertPanelRuntime)
        decision = evaluate_statistical_strategy(
            "expert_panel", history, runtime_state=runtime
        )

        self.assertNotEqual(runtime.last_panel_pick, decision.side.value[0].upper())
        actual = BetSide.BANKER if runtime.last_panel_pick == "B" else BetSide.PLAYER
        advance_statistical_runtime(
            "expert_panel", runtime, history + [actual], won=False
        )
        self.assertEqual(1, runtime.win_streak)
        self.assertEqual(0, runtime.loss_streak)

    def test_sequence_follow_uses_its_configured_bp_cycle(self):
        history = sides("BPBP")
        runtime = create_statistical_runtime(
            "sequence_follow", history, strategy_input="B-P-P"
        )
        first = evaluate_statistical_strategy(
            "sequence_follow", history, runtime_state=runtime,
            strategy_input="B-P-P",
        )
        advance_statistical_runtime(
            "sequence_follow", runtime, history + [BetSide.BANKER], won=True
        )
        second = evaluate_statistical_strategy(
            "sequence_follow", history, runtime_state=runtime,
            strategy_input="B-P-P",
        )

        self.assertEqual(BetSide.BANKER, first.side)
        self.assertEqual(BetSide.PLAYER, second.side)

    def test_pattern_follow_queues_the_configured_right_hand_side(self):
        history = sides("BPBPP")
        runtime = create_statistical_runtime(
            "pattern_follow", history, strategy_input="BPP-BP"
        )
        first = evaluate_statistical_strategy(
            "pattern_follow", history, runtime_state=runtime,
            strategy_input="BPP-BP",
        )
        advance_statistical_runtime(
            "pattern_follow", runtime, history + [BetSide.BANKER], won=True
        )
        second = evaluate_statistical_strategy(
            "pattern_follow", history, runtime_state=runtime,
            strategy_input="BPP-BP",
        )

        self.assertEqual(BetSide.BANKER, first.side)
        self.assertEqual(BetSide.PLAYER, second.side)

    def test_random_side_keeps_one_pick_until_the_round_settles(self):
        history = sides("BPBP")
        runtime = create_statistical_runtime("random_side", history, seed="one")
        first = evaluate_statistical_strategy("random_side", history, runtime_state=runtime)
        repeated = evaluate_statistical_strategy("random_side", history, runtime_state=runtime)
        advance_statistical_runtime(
            "random_side", runtime, history + [BetSide.BANKER], won=True
        )

        self.assertEqual(first.side, repeated.side)
        self.assertFalse(runtime.planned)
