from __future__ import annotations

import unittest

from src.models import BetSide
from src.money_manager import MoneyQuote
from src.risk_decision import (
    ExecutionMode,
    RiskCode,
    RiskContext,
    RiskDecision,
    RiskManager,
)
from src.strategy_decision import StrategyDecision


def bet_decision() -> StrategyDecision:
    return StrategyDecision.bet(
        strategy_id="test",
        strategy_name="Test strategy",
        side=BetSide.PLAYER,
        reason="Test signal",
    )


def skip_decision() -> StrategyDecision:
    return StrategyDecision.skip(
        strategy_id="test",
        strategy_name="Test strategy",
        reason="No signal",
    )


def money_quote(stake: int = 100) -> MoneyQuote:
    return MoneyQuote(
        manager_id="test-money",
        stake=stake,
        level_index=0,
        total_levels=1,
        reason="Fixed test stake",
    )


class RiskDecisionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manager = RiskManager(minimum_countdown=3)

    def evaluate(self, **overrides) -> RiskDecision:
        values = {
            "strategy": bet_decision(),
            "money": money_quote(),
            "auto_bet": True,
            "countdown": 10,
        }
        values.update(overrides)
        return self.manager.evaluate(RiskContext(**values))

    def test_approves_real_bet_when_all_checks_pass(self) -> None:
        decision = self.evaluate()
        self.assertTrue(decision.allowed)
        self.assertEqual(decision.code, RiskCode.APPROVED)
        self.assertEqual(decision.execution_mode, ExecutionMode.REAL)

    def test_strategy_skip_is_first_gate(self) -> None:
        decision = self.evaluate(
            strategy=skip_decision(),
            auto_bet=False,
            pending_main=True,
        )
        self.assertEqual(decision.code, RiskCode.STRATEGY_SKIP)

    def test_auto_bet_and_license_are_separate_gates(self) -> None:
        self.assertEqual(
            self.evaluate(auto_bet=False).code,
            RiskCode.AUTO_BET_OFF,
        )
        license_decision = self.evaluate(license_allowed=False)
        self.assertEqual(license_decision.code, RiskCode.LICENSE_BLOCKED)
        self.assertFalse(license_decision.recoverable)

    def test_daily_limits_block_new_bets(self) -> None:
        self.assertEqual(
            self.evaluate(daily_profit=100, take_profit=100).code,
            RiskCode.TAKE_PROFIT,
        )
        self.assertEqual(
            self.evaluate(daily_profit=-200, stop_loss=200).code,
            RiskCode.STOP_LOSS,
        )
        self.assertEqual(
            self.evaluate(limit_hit="take_profit").code,
            RiskCode.TAKE_PROFIT,
        )

    def test_pending_or_duplicate_round_is_blocked(self) -> None:
        self.assertEqual(
            self.evaluate(pending_main=True).code,
            RiskCode.PENDING_BET,
        )
        self.assertEqual(
            self.evaluate(round_already_placed=True).code,
            RiskCode.ROUND_ALREADY_PLACED,
        )

    def test_runtime_health_gates_real_bet(self) -> None:
        self.assertEqual(
            self.evaluate(shuffling=True).code,
            RiskCode.SHUFFLING,
        )
        self.assertEqual(
            self.evaluate(source_allowed=False).code,
            RiskCode.SOURCE_NOT_ALLOWED,
        )
        self.assertEqual(
            self.evaluate(ui_healthy=False).code,
            RiskCode.UI_UNHEALTHY,
        )
        self.assertEqual(
            self.evaluate(countdown=2).code,
            RiskCode.BETTING_WINDOW_LATE,
        )

    def test_zero_stake_is_virtual_and_does_not_require_live_ui(self) -> None:
        decision = self.evaluate(
            money=money_quote(0),
            ui_healthy=False,
            countdown=0,
        )

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.execution_mode, ExecutionMode.VIRTUAL)

    def test_virtual_bet_still_respects_pending_and_source_gates(self) -> None:
        quote = money_quote(0)
        self.assertEqual(
            self.evaluate(money=quote, pending_tie=True).code,
            RiskCode.PENDING_BET,
        )
        self.assertEqual(
            self.evaluate(money=quote, source_allowed=False).code,
            RiskCode.SOURCE_NOT_ALLOWED,
        )


if __name__ == "__main__":
    unittest.main()
