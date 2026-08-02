from __future__ import annotations

import unittest

from src.models import BetSide
from src.pattern_analyzer import (
    analyze_patterns,
    filter_history,
    normalize_pattern_lengths,
)
from src.stakes_config import format_stakes, parse_stakes_text


class StakeParsingTests(unittest.TestCase):
    def test_parses_bracketed_and_plain_stakes(self) -> None:
        expected = [0, 100, 200]
        self.assertEqual(parse_stakes_text("[0, 100, 200]"), expected)
        self.assertEqual(parse_stakes_text("0, 100; 200"), expected)

    def test_rejects_empty_and_negative_stakes(self) -> None:
        with self.assertRaises(ValueError):
            parse_stakes_text("")
        with self.assertRaises(ValueError):
            parse_stakes_text("0, -100")

    def test_format_is_stable(self) -> None:
        self.assertEqual(format_stakes([0, 100, 200]), "[0, 100, 200]")


class PatternAnalysisTests(unittest.TestCase):
    def test_tie_is_removed_when_skip_tie_is_enabled(self) -> None:
        history = [BetSide.PLAYER, BetSide.TIE, BetSide.BANKER]
        self.assertEqual(
            filter_history(history, skip_tie=True),
            [BetSide.PLAYER, BetSide.BANKER],
        )

    def test_alternating_pattern_has_priority_over_streak(self) -> None:
        analyses = analyze_patterns([BetSide.PLAYER, BetSide.BANKER])

        self.assertEqual(len(analyses), 1)
        self.assertEqual(analyses[0].pattern_id, "mau_1_1")
        self.assertEqual(analyses[0].status, "matched")
        self.assertEqual(analyses[0].bet_side, BetSide.PLAYER)

    def test_streak_pattern_follows_same_side(self) -> None:
        analyses = analyze_patterns([BetSide.BANKER, BetSide.BANKER])

        self.assertEqual(len(analyses), 1)
        self.assertEqual(analyses[0].pattern_id, "mau_bet_2")
        self.assertEqual(analyses[0].bet_side, BetSide.BANKER)

    def test_disabling_pattern_removes_its_signal(self) -> None:
        analyses = analyze_patterns(
            [BetSide.PLAYER, BetSide.BANKER],
            disabled_patterns={"mau_1_1"},
        )
        self.assertEqual(analyses, [])

    def test_pattern_lengths_only_accept_supported_values(self) -> None:
        normalized = normalize_pattern_lengths(
            {"mau_1_1": 4, "mau_bet_2": 99}
        )
        self.assertEqual(normalized, {"mau_1_1": 4, "mau_bet_2": 2})


if __name__ == "__main__":
    unittest.main()
