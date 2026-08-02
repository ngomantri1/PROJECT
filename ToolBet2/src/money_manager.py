"""Money-management contracts and legacy progression adapter."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping, Protocol, runtime_checkable

from src.models import BetSide
from src.progression import GroupProgressionState, GroupStakeProgression


class MoneyOutcome(str, Enum):
    WIN = "win"
    LOSS = "loss"
    PUSH = "push"


@dataclass(frozen=True, slots=True)
class MoneyQuote:
    """Stake proposed by a money manager before risk checks."""

    manager_id: str
    stake: int
    level_index: int
    total_levels: int
    reason: str
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.manager_id.strip():
            raise ValueError("manager_id must not be empty")
        if self.stake < 0:
            raise ValueError("stake must not be negative")
        if self.total_levels <= 0:
            raise ValueError("total_levels must be positive")
        if not 0 <= self.level_index < self.total_levels:
            raise ValueError("level_index is outside the configured levels")
        if not self.reason.strip():
            raise ValueError("reason must not be empty")
        object.__setattr__(self, "manager_id", self.manager_id.strip())
        object.__setattr__(self, "reason", self.reason.strip())
        object.__setattr__(
            self,
            "metadata",
            MappingProxyType(dict(self.metadata or {})),
        )

    @property
    def is_virtual(self) -> bool:
        return self.stake == 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "manager_id": self.manager_id,
            "stake": self.stake,
            "level_index": self.level_index,
            "level_number": self.level_index + 1,
            "total_levels": self.total_levels,
            "is_virtual": self.is_virtual,
            "reason": self.reason,
            "metadata": dict(self.metadata),
        }


@dataclass(frozen=True, slots=True)
class MoneyStateSnapshot:
    manager_id: str
    stakes: tuple[int, ...]
    group_pnl: float
    loss_count: int
    level_index: int
    groups_closed: int
    last_group_close: str
    last_closed_group_pnl: float
    last_closed_loss_count: int
    group_results: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "manager_id": self.manager_id,
            "stakes": list(self.stakes),
            "group_pnl": self.group_pnl,
            "loss_count": self.loss_count,
            "level_index": self.level_index,
            "groups_closed": self.groups_closed,
            "last_group_close": self.last_group_close,
            "last_closed_group_pnl": self.last_closed_group_pnl,
            "last_closed_loss_count": self.last_closed_loss_count,
            "group_results": list(self.group_results),
        }


@dataclass(frozen=True, slots=True)
class MoneyUpdate:
    manager_id: str
    outcome: MoneyOutcome
    profit: float
    previous_quote: MoneyQuote
    next_quote: MoneyQuote
    group_closed: bool = False
    group_close_reason: str = ""
    closed_group_pnl: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "manager_id": self.manager_id,
            "outcome": self.outcome.value,
            "profit": self.profit,
            "previous_quote": self.previous_quote.to_dict(),
            "next_quote": self.next_quote.to_dict(),
            "group_closed": self.group_closed,
            "group_close_reason": self.group_close_reason,
            "closed_group_pnl": self.closed_group_pnl,
        }


@runtime_checkable
class MoneyManager(Protocol):
    @property
    def manager_id(self) -> str: ...

    def quote(self) -> MoneyQuote: ...

    def apply_result(self, bet_side: BetSide, result: BetSide) -> MoneyUpdate: ...

    def reset(self) -> None: ...

    def snapshot(self) -> MoneyStateSnapshot: ...

    def restore(self, snapshot: MoneyStateSnapshot) -> None: ...


class ProgressionMoneyManager:
    """Adapter that preserves all current GroupStakeProgression behavior."""

    def __init__(
        self,
        stakes: list[int],
        *,
        mode: str,
        group_take_profit: float = 0.0,
        group_stop_loss: float = 0.0,
        banker_commission: float = 0.05,
        loss_watch_recover: bool = False,
    ):
        self._progression = GroupStakeProgression(
            list(stakes),
            mode=mode,
            group_take_profit=group_take_profit,
            group_stop_loss=group_stop_loss,
            banker_commission=banker_commission,
            loss_watch_recover=loss_watch_recover,
        )

    @classmethod
    def from_progression(
        cls,
        progression: GroupStakeProgression,
    ) -> ProgressionMoneyManager:
        """Clone a legacy progression for read-only shadow evaluation."""

        manager = cls(
            list(progression.stakes),
            mode=progression.mode,
            group_take_profit=progression.group_take_profit,
            group_stop_loss=progression.group_stop_loss,
            banker_commission=progression.banker_commission,
            loss_watch_recover=progression.loss_watch_recover,
        )
        state = progression.state
        manager.restore(
            MoneyStateSnapshot(
                manager_id=progression.mode,
                stakes=tuple(int(value) for value in progression.stakes),
                group_pnl=float(state.group_pnl),
                loss_count=int(state.loss_count),
                level_index=int(state.index),
                groups_closed=int(state.groups_closed),
                last_group_close=state.last_group_close,
                last_closed_group_pnl=float(state.last_closed_group_pnl),
                last_closed_loss_count=int(state.last_closed_loss_count),
                group_results=tuple(state.group_results),
            )
        )
        return manager

    @property
    def manager_id(self) -> str:
        return self._progression.mode

    @property
    def progression(self) -> GroupStakeProgression:
        """Temporary compatibility access while BettingSession is migrated."""

        return self._progression

    def quote(self) -> MoneyQuote:
        progression = self._progression
        return MoneyQuote(
            manager_id=self.manager_id,
            stake=int(progression.current_stake),
            level_index=int(progression.index),
            total_levels=len(progression.stakes),
            reason=(
                f"Mức {progression.index + 1}/{len(progression.stakes)} "
                f"theo {self.manager_id}"
            ),
            metadata={
                "group_pnl": float(progression.group_pnl),
                "loss_count": int(progression.loss_count),
                "stakes": list(progression.stakes),
            },
        )

    def apply_result(self, bet_side: BetSide, result: BetSide) -> MoneyUpdate:
        previous = self.quote()
        closed_before = self._progression.state.groups_closed
        outcome_raw, _next_stake, profit = self._progression.apply_result(
            bet_side,
            result,
        )
        outcome = MoneyOutcome(outcome_raw)
        group_closed = self._progression.state.groups_closed > closed_before
        return MoneyUpdate(
            manager_id=self.manager_id,
            outcome=outcome,
            profit=float(profit),
            previous_quote=previous,
            next_quote=self.quote(),
            group_closed=group_closed,
            group_close_reason=(
                self._progression.state.last_group_close if group_closed else ""
            ),
            closed_group_pnl=(
                float(self._progression.state.last_closed_group_pnl)
                if group_closed
                else 0.0
            ),
        )

    def reset(self) -> None:
        self._progression.reset()

    def snapshot(self) -> MoneyStateSnapshot:
        state = self._progression.state
        return MoneyStateSnapshot(
            manager_id=self.manager_id,
            stakes=tuple(int(value) for value in self._progression.stakes),
            group_pnl=float(state.group_pnl),
            loss_count=int(state.loss_count),
            level_index=int(state.index),
            groups_closed=int(state.groups_closed),
            last_group_close=state.last_group_close,
            last_closed_group_pnl=float(state.last_closed_group_pnl),
            last_closed_loss_count=int(state.last_closed_loss_count),
            group_results=tuple(state.group_results),
        )

    def restore(self, snapshot: MoneyStateSnapshot) -> None:
        expected_stakes = tuple(int(value) for value in self._progression.stakes)
        if snapshot.manager_id != self.manager_id:
            raise ValueError(
                f"snapshot manager {snapshot.manager_id!r} does not match "
                f"{self.manager_id!r}"
            )
        if snapshot.stakes != expected_stakes:
            raise ValueError("snapshot stakes do not match current configuration")
        if not 0 <= snapshot.level_index < len(expected_stakes):
            raise ValueError("snapshot level_index is outside current stakes")
        if snapshot.loss_count < 0 or snapshot.groups_closed < 0:
            raise ValueError("snapshot counters must not be negative")

        self._progression.state = GroupProgressionState(
            group_pnl=float(snapshot.group_pnl),
            loss_count=int(snapshot.loss_count),
            index=int(snapshot.level_index),
            groups_closed=int(snapshot.groups_closed),
            last_group_close=snapshot.last_group_close,
            last_closed_group_pnl=float(snapshot.last_closed_group_pnl),
            last_closed_loss_count=int(snapshot.last_closed_loss_count),
            group_results=list(snapshot.group_results),
        )
