"""Pure risk-gate contracts.

RiskManager evaluates already-computed strategy and money decisions. It has no
side effects: callers decide how to log, stop Auto, persist, or update the UI.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from src.money_manager import MoneyQuote
from src.strategy_decision import StrategyDecision


class ExecutionMode(str, Enum):
    NONE = "none"
    VIRTUAL = "virtual"
    REAL = "real"


class RiskCode(str, Enum):
    APPROVED = "approved"
    STRATEGY_SKIP = "strategy_skip"
    AUTO_BET_OFF = "auto_bet_off"
    LICENSE_BLOCKED = "license_blocked"
    TAKE_PROFIT = "take_profit"
    STOP_LOSS = "stop_loss"
    PENDING_BET = "pending_bet"
    ROUND_ALREADY_PLACED = "round_already_placed"
    SHUFFLING = "shuffling"
    SOURCE_NOT_ALLOWED = "source_not_allowed"
    UI_UNHEALTHY = "ui_unhealthy"
    BETTING_WINDOW_LATE = "betting_window_late"
    BALANCE_UNAVAILABLE = "balance_unavailable"
    INSUFFICIENT_BALANCE = "insufficient_balance"


@dataclass(frozen=True, slots=True)
class RiskDecision:
    allowed: bool
    code: RiskCode
    reason: str
    execution_mode: ExecutionMode = ExecutionMode.NONE
    recoverable: bool = True

    def __post_init__(self) -> None:
        if not self.reason.strip():
            raise ValueError("reason must not be empty")
        if self.allowed and self.code != RiskCode.APPROVED:
            raise ValueError("allowed risk decisions must use code=approved")
        if not self.allowed and self.execution_mode != ExecutionMode.NONE:
            raise ValueError("blocked risk decisions cannot have an execution mode")
        if self.allowed and self.execution_mode == ExecutionMode.NONE:
            raise ValueError("approved decisions require an execution mode")
        object.__setattr__(self, "reason", self.reason.strip())

    @classmethod
    def approve(
        cls,
        *,
        execution_mode: ExecutionMode,
        reason: str,
    ) -> RiskDecision:
        return cls(
            allowed=True,
            code=RiskCode.APPROVED,
            reason=reason,
            execution_mode=execution_mode,
            recoverable=True,
        )

    @classmethod
    def block(
        cls,
        *,
        code: RiskCode,
        reason: str,
        recoverable: bool = True,
    ) -> RiskDecision:
        if code == RiskCode.APPROVED:
            raise ValueError("blocked decision cannot use code=approved")
        return cls(
            allowed=False,
            code=code,
            reason=reason,
            execution_mode=ExecutionMode.NONE,
            recoverable=recoverable,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "allowed": self.allowed,
            "code": self.code.value,
            "reason": self.reason,
            "execution_mode": self.execution_mode.value,
            "recoverable": self.recoverable,
        }


@dataclass(frozen=True, slots=True)
class RiskContext:
    strategy: StrategyDecision
    money: MoneyQuote
    auto_bet: bool
    license_allowed: bool = True
    daily_profit: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    limit_hit: str = ""
    pending_main: bool = False
    pending_tie: bool = False
    round_already_placed: bool = False
    shuffling: bool = False
    source_allowed: bool = True
    ui_healthy: bool = True
    countdown: int | None = None
    balance: float | None = None
    balance_buffer: float = 0.0
    require_balance: bool = False

    def __post_init__(self) -> None:
        if self.stop_loss < 0 or self.take_profit < 0:
            raise ValueError("risk limits must not be negative")
        if self.balance_buffer < 0:
            raise ValueError("balance_buffer must not be negative")


class RiskManager:
    """Deterministic gate with a stable first-failure order."""

    def __init__(self, *, minimum_countdown: int = 3):
        if minimum_countdown < 0:
            raise ValueError("minimum_countdown must not be negative")
        self.minimum_countdown = minimum_countdown

    def evaluate(self, context: RiskContext) -> RiskDecision:
        if not context.strategy.wants_bet:
            return RiskDecision.block(
                code=RiskCode.STRATEGY_SKIP,
                reason=context.strategy.reason,
            )
        if not context.auto_bet:
            return RiskDecision.block(
                code=RiskCode.AUTO_BET_OFF,
                reason="Auto bet đang tắt",
            )
        if not context.license_allowed:
            return RiskDecision.block(
                code=RiskCode.LICENSE_BLOCKED,
                reason="License không cho phép tạo cược mới",
                recoverable=False,
            )
        if context.limit_hit == "take_profit":
            return RiskDecision.block(
                code=RiskCode.TAKE_PROFIT,
                reason="Đã đạt giới hạn lãi",
                recoverable=False,
            )
        if context.limit_hit == "stop_loss":
            return RiskDecision.block(
                code=RiskCode.STOP_LOSS,
                reason="Đã đạt giới hạn lỗ",
                recoverable=False,
            )
        if context.take_profit > 0 and context.daily_profit >= context.take_profit:
            return RiskDecision.block(
                code=RiskCode.TAKE_PROFIT,
                reason="Đã đạt giới hạn lãi",
                recoverable=False,
            )
        if context.stop_loss > 0 and context.daily_profit <= -context.stop_loss:
            return RiskDecision.block(
                code=RiskCode.STOP_LOSS,
                reason="Đã đạt giới hạn lỗ",
                recoverable=False,
            )
        if context.pending_main or context.pending_tie:
            return RiskDecision.block(
                code=RiskCode.PENDING_BET,
                reason="Đang có cược chờ kết quả",
            )
        if context.round_already_placed:
            return RiskDecision.block(
                code=RiskCode.ROUND_ALREADY_PLACED,
                reason="Round hiện tại đã được đặt",
                recoverable=False,
            )
        if context.shuffling:
            return RiskDecision.block(
                code=RiskCode.SHUFFLING,
                reason="Bàn đang xào bài",
            )
        if not context.source_allowed:
            return RiskDecision.block(
                code=RiskCode.SOURCE_NOT_ALLOWED,
                reason="Nguồn kết quả không được phép kích hoạt cược",
            )

        if context.money.is_virtual:
            return RiskDecision.approve(
                execution_mode=ExecutionMode.VIRTUAL,
                reason="Stake 0: theo dõi ảo, không click chip",
            )

        if not context.ui_healthy:
            return RiskDecision.block(
                code=RiskCode.UI_UNHEALTHY,
                reason="UI đặt cược chưa sẵn sàng",
            )
        if (
            context.countdown is not None
            and context.countdown < self.minimum_countdown
        ):
            return RiskDecision.block(
                code=RiskCode.BETTING_WINDOW_LATE,
                reason=(
                    f"Chỉ còn {context.countdown}s, yêu cầu tối thiểu "
                    f"{self.minimum_countdown}s"
                ),
            )
        if context.require_balance and context.balance is None:
            return RiskDecision.block(
                code=RiskCode.BALANCE_UNAVAILABLE,
                reason="Không đọc được số dư tài khoản",
            )
        required_balance = float(context.money.stake) + float(context.balance_buffer)
        if context.balance is not None and context.balance < required_balance:
            return RiskDecision.block(
                code=RiskCode.INSUFFICIENT_BALANCE,
                reason=(
                    f"Số dư {context.balance:.0f} nhỏ hơn mức cần "
                    f"{required_balance:.0f}"
                ),
            )

        return RiskDecision.approve(
            execution_mode=ExecutionMode.REAL,
            reason="Đủ điều kiện tạo cược thật",
        )
