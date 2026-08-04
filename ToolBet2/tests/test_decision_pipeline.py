from __future__ import annotations

import unittest
from unittest.mock import patch

from src.auto_bettor import AutoBettor
from src.betting_session import BettingSession
from src.decision_pipeline import (
    LegacyArmSnapshot,
    LegacyPatternStrategy,
    ShadowDecisionReport,
    ShadowDecisionPipeline,
    ShadowDecisionStats,
)
from src.money_manager import MoneyQuote
from src.models import BetSide
from src.pattern_analyzer import PatternAnalysis, get_active_signal
from src.progression import GroupStakeProgression, PROGRESSION_MODE_LOSS_UP_WIN_RESET
from src.risk_decision import ExecutionMode, RiskDecision
from src.strategy_decision import StrategyContext, StrategyDecision


class FakeStore:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    def save_event(self, event_type: str, payload: dict | None = None, **_kwargs) -> None:
        self.events.append((event_type, dict(payload or {})))


def matched_analysis(
    *,
    side: BetSide = BetSide.PLAYER,
    pattern_id: str = "mau_1_1",
) -> PatternAnalysis:
    return PatternAnalysis(
        pattern_id=pattern_id,
        pattern_name="Test",
        status="matched",
        bet_side=side,
        progress="2/2",
        sequence_text="test",
        reason="Test signal",
    )


def forced_mismatch_report() -> ShadowDecisionReport:
    return ShadowDecisionReport(
        strategy=StrategyDecision.bet(
            strategy_id="shadow-test",
            strategy_name="Shadow test",
            side=BetSide.PLAYER,
            reason="Forced new decision",
            signal_id="new-signal",
            history_size=2,
        ),
        money=MoneyQuote(
            manager_id="shadow-money",
            stake=0,
            level_index=0,
            total_levels=1,
            reason="Forced quote",
        ),
        risk=RiskDecision.approve(
            execution_mode=ExecutionMode.VIRTUAL,
            reason="Forced approval",
        ),
        legacy=LegacyArmSnapshot(
            can_place_bet=False,
            signal=matched_analysis(
                side=BetSide.BANKER,
                pattern_id="old-signal",
            ),
            stake=100,
        ),
        mismatches=("side", "signal_id", "stake", "arm_allowed"),
    )


class ShadowDecisionPipelineTests(unittest.TestCase):
    def test_matching_legacy_pipeline_has_no_mismatch(self) -> None:
        history = [BetSide.PLAYER, BetSide.BANKER]
        old_signal = get_active_signal(history)
        progression = GroupStakeProgression(
            [0, 100],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )
        pipeline = ShadowDecisionPipeline(
            LegacyPatternStrategy(skip_tie=True)
        )

        report = pipeline.evaluate(
            context=StrategyContext(history=tuple(history), table_name="C01"),
            progression=progression,
            legacy=LegacyArmSnapshot(
                can_place_bet=True,
                signal=old_signal,
                stake=0,
            ),
            auto_bet=True,
        )

        self.assertTrue(report.matched)
        self.assertEqual(report.mismatches, ())
        self.assertTrue(report.risk.allowed)
        self.assertTrue(report.money.is_virtual)

    def test_detects_side_stake_and_arm_mismatch(self) -> None:
        history = [BetSide.PLAYER, BetSide.BANKER]
        progression = GroupStakeProgression(
            [0, 100],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )
        pipeline = ShadowDecisionPipeline(
            LegacyPatternStrategy(skip_tie=True)
        )

        report = pipeline.evaluate(
            context=StrategyContext(history=tuple(history), table_name="C01"),
            progression=progression,
            legacy=LegacyArmSnapshot(
                can_place_bet=False,
                signal=matched_analysis(side=BetSide.BANKER),
                stake=100,
            ),
            auto_bet=True,
        )

        self.assertFalse(report.matched)
        self.assertEqual(
            report.mismatches,
            ("side", "stake", "arm_allowed"),
        )

    def test_pipeline_does_not_mutate_legacy_progression(self) -> None:
        history = [BetSide.PLAYER, BetSide.BANKER]
        progression = GroupStakeProgression(
            [0, 100],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )
        before = progression.state
        before_values = (
            before.index,
            before.loss_count,
            before.group_pnl,
            list(before.group_results),
        )

        ShadowDecisionPipeline(
            LegacyPatternStrategy(skip_tie=True)
        ).evaluate(
            context=StrategyContext(history=tuple(history)),
            progression=progression,
            legacy=LegacyArmSnapshot(
                can_place_bet=True,
                signal=get_active_signal(history),
                stake=0,
            ),
            auto_bet=True,
        )

        after = progression.state
        self.assertEqual(
            (
                after.index,
                after.loss_count,
                after.group_pnl,
                list(after.group_results),
            ),
            before_values,
        )

    def test_stats_count_matches_mismatches_and_errors(self) -> None:
        stats = ShadowDecisionStats()
        history = [BetSide.PLAYER, BetSide.BANKER]
        report = ShadowDecisionPipeline(
            LegacyPatternStrategy(skip_tie=True)
        ).evaluate(
            context=StrategyContext(history=tuple(history)),
            progression=GroupStakeProgression([0, 100]),
            legacy=LegacyArmSnapshot(
                can_place_bet=True,
                signal=get_active_signal(history),
                stake=0,
            ),
            auto_bet=True,
        )

        stats.record(report, table_name="C01")
        stats.record_error(table_name="C01", history_size=2)

        self.assertEqual(stats.evaluations, 2)
        self.assertEqual(stats.matches, 1)
        self.assertEqual(stats.errors, 1)


class AutoBettorShadowIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = FakeStore()
        self.session = BettingSession([0, 100])
        self.session.configure(auto_bet=True)
        self.bettor = AutoBettor(self.session, self.store)
        self.bettor.set_decision_shadow_enabled(True)

    def test_shadow_match_does_not_arm_or_mutate_session(self) -> None:
        history = [BetSide.PLAYER, BetSide.BANKER]
        before_index = self.session.progression.index

        self.bettor._run_decision_shadow(
            history,
            table_name="C01",
            skip_tie=True,
            source="gp-winner",
            shuffling=False,
        )

        status = self.bettor.decision_shadow_status()
        self.assertEqual(status["evaluations"], 1)
        self.assertEqual(status["matches"], 1)
        self.assertEqual(status["mismatches"], 0)
        self.assertEqual(self.store.events, [])
        self.assertFalse(self.bettor.has_armed_bet)
        self.assertIsNone(self.session.state.pending)
        self.assertEqual(self.session.progression.index, before_index)

    def test_shadow_exception_is_contained(self) -> None:
        with self.assertLogs("src.auto_bettor", level="ERROR"):
            with patch(
                "src.auto_bettor.ShadowDecisionPipeline.evaluate",
                side_effect=RuntimeError("shadow test failure"),
            ):
                self.bettor._run_decision_shadow(
                    [BetSide.PLAYER, BetSide.BANKER],
                    table_name="C01",
                    skip_tie=True,
                    source="gp-winner",
                    shuffling=False,
                )

        status = self.bettor.decision_shadow_status()
        self.assertEqual(status["errors"], 1)
        self.assertFalse(self.bettor.has_armed_bet)
        self.assertIsNone(self.session.state.pending)

    def test_shadow_can_be_disabled(self) -> None:
        self.bettor.set_decision_shadow_enabled(False)
        self.bettor._run_decision_shadow(
            [BetSide.PLAYER, BetSide.BANKER],
            table_name="C01",
            skip_tie=True,
            source="gp-winner",
            shuffling=False,
        )

        status = self.bettor.decision_shadow_status()
        self.assertFalse(status["enabled"])
        self.assertEqual(status["evaluations"], 0)

    def test_repeated_mismatch_writes_only_one_event(self) -> None:
        report = forced_mismatch_report()
        with patch(
            "src.auto_bettor.ShadowDecisionPipeline.evaluate",
            return_value=report,
        ):
            for _ in range(2):
                self.bettor._run_decision_shadow(
                    [BetSide.PLAYER, BetSide.BANKER],
                    table_name="C01",
                    skip_tie=True,
                    source="gp-winner",
                    shuffling=False,
                )

        self.assertEqual(
            [event_type for event_type, _payload in self.store.events],
            ["decision_shadow_mismatch"],
        )
        payload = self.store.events[0][1]
        self.assertNotIn("history", payload)
        self.assertEqual(
            payload["mismatches"],
            ["side", "signal_id", "stake", "arm_allowed"],
        )


class AutoBettorShadowAuthorityTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_strategy_evaluator_never_falls_back_to_legacy_arm(self) -> None:
        store = FakeStore()
        session = BettingSession([0, 100])
        session.configure(auto_bet=True)
        bettor = AutoBettor(session, store)
        bettor.set_decision_shadow_enabled(True)

        with patch.object(bettor, "_schedule_bet_on_open_poll"):
            with patch(
                "src.auto_bettor.ShadowDecisionPipeline.evaluate",
                return_value=forced_mismatch_report(),
            ):
                await bettor._arm_bet_signal(
                    object(),
                    [BetSide.PLAYER, BetSide.BANKER],
                    table_name="C01",
                    skip_tie=True,
                    source="gp-winner",
                )

        self.assertFalse(bettor.has_armed_bet)
        self.assertEqual(
            store.events[0][0],
            "decision_shadow_mismatch",
        )


if __name__ == "__main__":
    unittest.main()
