from __future__ import annotations

import unittest

from src.models import BetSide
from src.pattern_analyzer import PatternAnalysis
from src.strategy_decision import (
    BetStrategy,
    StrategyAction,
    StrategyContext,
    StrategyDecision,
)


class FollowLastStrategy:
    strategy_id = "follow-last"
    display_name = "Theo ván cuối"

    def evaluate(self, context: StrategyContext) -> StrategyDecision:
        if not context.history:
            return StrategyDecision.skip(
                strategy_id=self.strategy_id,
                strategy_name=self.display_name,
                reason="Chưa có lịch sử",
            )
        return StrategyDecision.bet(
            strategy_id=self.strategy_id,
            strategy_name=self.display_name,
            side=context.history[-1],
            reason="Theo ván cuối",
            history_size=context.history_size,
        )


class StrategyDecisionTests(unittest.TestCase):
    def test_bet_factory_creates_valid_signal(self) -> None:
        decision = StrategyDecision.bet(
            strategy_id="s1",
            strategy_name="Strategy 1",
            side=BetSide.PLAYER,
            reason="Matched",
            confidence=0.75,
            history_size=10,
        )

        self.assertTrue(decision.wants_bet)
        self.assertEqual(decision.action, StrategyAction.BET)
        self.assertEqual(decision.side, BetSide.PLAYER)
        self.assertEqual(decision.to_dict()["confidence"], 0.75)

    def test_skip_cannot_contain_side_and_bet_requires_side(self) -> None:
        with self.assertRaises(ValueError):
            StrategyDecision(
                strategy_id="s1",
                strategy_name="Strategy 1",
                action=StrategyAction.BET,
                reason="invalid",
            )
        with self.assertRaises(ValueError):
            StrategyDecision(
                strategy_id="s1",
                strategy_name="Strategy 1",
                action=StrategyAction.SKIP,
                side=BetSide.BANKER,
                reason="invalid",
            )

    def test_confidence_is_bounded(self) -> None:
        with self.assertRaises(ValueError):
            StrategyDecision.bet(
                strategy_id="s1",
                strategy_name="Strategy 1",
                side=BetSide.BANKER,
                reason="invalid",
                confidence=1.01,
            )

    def test_context_and_metadata_are_immutable_copies(self) -> None:
        metadata = {"window": 10}
        context = StrategyContext(
            history=[BetSide.PLAYER],
            table_name="C01",
            metadata=metadata,
        )
        metadata["window"] = 20

        self.assertEqual(context.history, (BetSide.PLAYER,))
        self.assertEqual(context.metadata["window"], 10)
        with self.assertRaises(TypeError):
            context.metadata["window"] = 30

    def test_pattern_analysis_adapter_preserves_identity(self) -> None:
        analysis = PatternAnalysis(
            pattern_id="mau_1_1",
            pattern_name="1-1",
            status="matched",
            bet_side=BetSide.BANKER,
            progress="2/2",
            sequence_text="xanh - đỏ",
            reason="Khớp 1-1",
        )

        decision = StrategyDecision.from_pattern_analysis(
            analysis,
            history_size=12,
        )

        self.assertTrue(decision.wants_bet)
        self.assertEqual(decision.side, BetSide.BANKER)
        self.assertEqual(decision.signal_id, "mau_1_1")
        self.assertEqual(decision.metadata["pattern_name"], "1-1")

    def test_strategy_protocol_accepts_conforming_object(self) -> None:
        strategy = FollowLastStrategy()
        self.assertIsInstance(strategy, BetStrategy)
        result = strategy.evaluate(
            StrategyContext(history=(BetSide.PLAYER, BetSide.BANKER))
        )
        self.assertEqual(result.side, BetSide.BANKER)


if __name__ == "__main__":
    unittest.main()
