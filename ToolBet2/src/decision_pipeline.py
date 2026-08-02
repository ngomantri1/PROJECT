"""Shadow decision pipeline.

This module runs the new contracts next to the legacy arm decision. Its report
is diagnostic only and must never be used to mutate pending/armed bet state.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from src.models import BetSide
from src.money_manager import MoneyQuote, ProgressionMoneyManager
from src.pattern_analyzer import PatternAnalysis, get_active_signal
from src.progression import GroupStakeProgression
from src.risk_decision import RiskContext, RiskDecision, RiskManager
from src.strategy_decision import (
    BetStrategy,
    StrategyContext,
    StrategyDecision,
)


class LegacyPatternStrategy:
    """New strategy contract backed by the current pattern analyzer."""

    strategy_id = "legacy-patterns"
    display_name = "Mẫu ToolBet v2"

    def __init__(
        self,
        *,
        skip_tie: bool,
        disabled_patterns: frozenset[str] | set[str] | None = None,
        pattern_lengths: dict[str, int] | None = None,
    ):
        self.skip_tie = bool(skip_tie)
        self.disabled_patterns = frozenset(disabled_patterns or ())
        self.pattern_lengths = dict(pattern_lengths or {})

    def evaluate(self, context: StrategyContext) -> StrategyDecision:
        analysis = get_active_signal(
            list(context.history),
            skip_tie=self.skip_tie,
            disabled_patterns=self.disabled_patterns,
            pattern_lengths=self.pattern_lengths,
        )
        return StrategyDecision.from_pattern_analysis(
            analysis,
            history_size=context.history_size,
            strategy_id=self.strategy_id,
            strategy_name=self.display_name,
        )


@dataclass(frozen=True, slots=True)
class LegacyArmSnapshot:
    """Minimal, redacted view of what the old arm path would decide."""

    can_place_bet: bool
    signal: PatternAnalysis | None
    stake: int
    blocked_by_shuffle: bool = False
    pending_main: bool = False
    pending_tie: bool = False
    source_allowed: bool = True

    @property
    def wants_arm(self) -> bool:
        return bool(
            self.can_place_bet
            and self.signal
            and self.signal.bet_side
            and not self.blocked_by_shuffle
            and not self.pending_main
            and not self.pending_tie
            and self.source_allowed
        )


@dataclass(frozen=True, slots=True)
class ShadowDecisionReport:
    strategy: StrategyDecision
    money: MoneyQuote
    risk: RiskDecision
    legacy: LegacyArmSnapshot
    mismatches: tuple[str, ...]

    @property
    def matched(self) -> bool:
        return not self.mismatches

    def to_event_payload(
        self,
        *,
        table_name: str,
        source: str,
    ) -> dict[str, Any]:
        """Redacted diagnostic payload; history contents are intentionally absent."""

        legacy_signal = self.legacy.signal
        return {
            "table_name": table_name,
            "source": source,
            "history_size": self.strategy.history_size,
            "mismatches": list(self.mismatches),
            "legacy": {
                "can_place_bet": self.legacy.can_place_bet,
                "wants_arm": self.legacy.wants_arm,
                "signal_id": legacy_signal.pattern_id if legacy_signal else "",
                "side": (
                    legacy_signal.bet_side.value
                    if legacy_signal and legacy_signal.bet_side
                    else None
                ),
                "stake": self.legacy.stake,
            },
            "shadow": {
                "strategy": self.strategy.to_dict(),
                "money": self.money.to_dict(),
                "risk": self.risk.to_dict(),
                "wants_arm": self.strategy.wants_bet and self.risk.allowed,
            },
        }


@dataclass(slots=True)
class ShadowDecisionStats:
    evaluations: int = 0
    matches: int = 0
    mismatches: int = 0
    errors: int = 0
    last_mismatches: tuple[str, ...] = ()
    last_table: str = ""
    last_history_size: int = 0

    def record(self, report: ShadowDecisionReport, *, table_name: str) -> None:
        self.evaluations += 1
        if report.matched:
            self.matches += 1
        else:
            self.mismatches += 1
        self.last_mismatches = report.mismatches
        self.last_table = table_name
        self.last_history_size = report.strategy.history_size

    def record_error(self, *, table_name: str, history_size: int) -> None:
        self.evaluations += 1
        self.errors += 1
        self.last_mismatches = ("shadow_error",)
        self.last_table = table_name
        self.last_history_size = history_size

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": True,
            "evaluations": self.evaluations,
            "matches": self.matches,
            "mismatches": self.mismatches,
            "errors": self.errors,
            "last_mismatches": list(self.last_mismatches),
            "last_table": self.last_table,
            "last_history_size": self.last_history_size,
        }


class ShadowDecisionPipeline:
    """Runs strategy -> money -> risk and compares it with the legacy snapshot."""

    def __init__(
        self,
        strategy: BetStrategy,
        *,
        risk_manager: RiskManager | None = None,
    ):
        self.strategy = strategy
        self.risk_manager = risk_manager or RiskManager()

    def evaluate(
        self,
        *,
        context: StrategyContext,
        progression: GroupStakeProgression,
        legacy: LegacyArmSnapshot,
        auto_bet: bool,
        license_allowed: bool = True,
        daily_profit: float = 0.0,
        stop_loss: float = 0.0,
        take_profit: float = 0.0,
        limit_hit: str = "",
    ) -> ShadowDecisionReport:
        strategy_decision = self.strategy.evaluate(context)
        money = ProgressionMoneyManager.from_progression(progression).quote()
        risk = self.risk_manager.evaluate(
            RiskContext(
                strategy=strategy_decision,
                money=money,
                auto_bet=auto_bet,
                license_allowed=license_allowed,
                daily_profit=daily_profit,
                stop_loss=stop_loss,
                take_profit=take_profit,
                limit_hit=limit_hit,
                pending_main=legacy.pending_main,
                pending_tie=legacy.pending_tie,
                shuffling=legacy.blocked_by_shuffle,
                source_allowed=legacy.source_allowed,
            )
        )
        mismatches = self._compare(
            strategy=strategy_decision,
            money=money,
            risk=risk,
            legacy=legacy,
        )
        return ShadowDecisionReport(
            strategy=strategy_decision,
            money=money,
            risk=risk,
            legacy=legacy,
            mismatches=mismatches,
        )

    @staticmethod
    def _compare(
        *,
        strategy: StrategyDecision,
        money: MoneyQuote,
        risk: RiskDecision,
        legacy: LegacyArmSnapshot,
    ) -> tuple[str, ...]:
        mismatches: list[str] = []
        old_signal = legacy.signal
        old_has_signal = bool(old_signal and old_signal.bet_side)
        if strategy.wants_bet != old_has_signal:
            mismatches.append("signal_presence")
        if old_has_signal and strategy.wants_bet:
            if strategy.side != old_signal.bet_side:
                mismatches.append("side")
            if strategy.signal_id != old_signal.pattern_id:
                mismatches.append("signal_id")
        if money.stake != legacy.stake:
            mismatches.append("stake")
        shadow_wants_arm = strategy.wants_bet and risk.allowed
        if shadow_wants_arm != legacy.wants_arm:
            mismatches.append("arm_allowed")
        return tuple(mismatches)
