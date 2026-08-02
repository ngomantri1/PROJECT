"""Pure strategy contracts.

Strategy implementations analyze immutable input and return a StrategyDecision.
They do not choose stake, inspect account balance, persist data, or click the UI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping, Protocol, runtime_checkable

from src.models import BetSide
from src.pattern_analyzer import PatternAnalysis


class StrategyAction(str, Enum):
    BET = "bet"
    SKIP = "skip"


def _metadata_copy(metadata: Mapping[str, Any] | None) -> Mapping[str, Any]:
    return MappingProxyType(dict(metadata or {}))


@dataclass(frozen=True, slots=True)
class StrategyContext:
    """Immutable inputs available to one strategy evaluation."""

    history: tuple[BetSide, ...]
    table_name: str = ""
    table_id: int | None = None
    game_shoe: int | None = None
    game_round: int | None = None
    source: str = ""
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "history", tuple(self.history))
        object.__setattr__(self, "metadata", _metadata_copy(self.metadata))

    @property
    def history_size(self) -> int:
        return len(self.history)

    @property
    def round_key(self) -> tuple[str, int | None, int | None]:
        return (self.table_name, self.game_shoe, self.game_round)


@dataclass(frozen=True, slots=True)
class StrategyDecision:
    """A strategy recommendation, before money and risk evaluation."""

    strategy_id: str
    strategy_name: str
    action: StrategyAction
    reason: str
    side: BetSide | None = None
    confidence: float = 0.0
    history_size: int = 0
    signal_id: str = ""
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        strategy_id = self.strategy_id.strip()
        strategy_name = self.strategy_name.strip()
        reason = self.reason.strip()
        if not strategy_id:
            raise ValueError("strategy_id must not be empty")
        if not strategy_name:
            raise ValueError("strategy_name must not be empty")
        if not reason:
            raise ValueError("reason must not be empty")
        if not 0.0 <= float(self.confidence) <= 1.0:
            raise ValueError("confidence must be between 0 and 1")
        if self.history_size < 0:
            raise ValueError("history_size must not be negative")
        if self.action == StrategyAction.BET and self.side is None:
            raise ValueError("a bet decision requires a side")
        if self.action == StrategyAction.SKIP and self.side is not None:
            raise ValueError("a skip decision must not contain a side")

        object.__setattr__(self, "strategy_id", strategy_id)
        object.__setattr__(self, "strategy_name", strategy_name)
        object.__setattr__(self, "reason", reason)
        object.__setattr__(self, "confidence", float(self.confidence))
        object.__setattr__(self, "signal_id", self.signal_id.strip())
        object.__setattr__(self, "metadata", _metadata_copy(self.metadata))

    @property
    def wants_bet(self) -> bool:
        return self.action == StrategyAction.BET

    @classmethod
    def bet(
        cls,
        *,
        strategy_id: str,
        strategy_name: str,
        side: BetSide,
        reason: str,
        confidence: float = 1.0,
        history_size: int = 0,
        signal_id: str = "",
        metadata: Mapping[str, Any] | None = None,
    ) -> StrategyDecision:
        return cls(
            strategy_id=strategy_id,
            strategy_name=strategy_name,
            action=StrategyAction.BET,
            side=side,
            reason=reason,
            confidence=confidence,
            history_size=history_size,
            signal_id=signal_id,
            metadata=metadata or {},
        )

    @classmethod
    def skip(
        cls,
        *,
        strategy_id: str,
        strategy_name: str,
        reason: str,
        confidence: float = 0.0,
        history_size: int = 0,
        metadata: Mapping[str, Any] | None = None,
    ) -> StrategyDecision:
        return cls(
            strategy_id=strategy_id,
            strategy_name=strategy_name,
            action=StrategyAction.SKIP,
            reason=reason,
            confidence=confidence,
            history_size=history_size,
            metadata=metadata or {},
        )

    @classmethod
    def from_pattern_analysis(
        cls,
        analysis: PatternAnalysis | None,
        *,
        history_size: int,
        strategy_id: str = "legacy-patterns",
        strategy_name: str = "Mẫu ToolBet v2",
    ) -> StrategyDecision:
        """Compatibility adapter for the current pattern analyzer."""

        if analysis is None or analysis.status != "matched" or analysis.bet_side is None:
            return cls.skip(
                strategy_id=strategy_id,
                strategy_name=strategy_name,
                reason="Không có mẫu đã khớp",
                history_size=history_size,
            )
        return cls.bet(
            strategy_id=strategy_id,
            strategy_name=strategy_name,
            side=analysis.bet_side,
            reason=analysis.reason,
            confidence=1.0,
            history_size=history_size,
            signal_id=analysis.pattern_id,
            metadata={
                "pattern_id": analysis.pattern_id,
                "pattern_name": analysis.pattern_name,
                "progress": analysis.progress,
                "sequence_text": analysis.sequence_text,
            },
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "strategy_id": self.strategy_id,
            "strategy_name": self.strategy_name,
            "action": self.action.value,
            "side": self.side.value if self.side else None,
            "reason": self.reason,
            "confidence": self.confidence,
            "history_size": self.history_size,
            "signal_id": self.signal_id,
            "metadata": dict(self.metadata),
        }


@runtime_checkable
class BetStrategy(Protocol):
    """Contract implemented by every future strategy plugin."""

    @property
    def strategy_id(self) -> str: ...

    @property
    def display_name(self) -> str: ...

    def evaluate(self, context: StrategyContext) -> StrategyDecision: ...
