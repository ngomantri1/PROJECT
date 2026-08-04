"""Python reimplementation of the eight reference money-management rules."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from src.models import BetSide
from src.money_manager import MoneyOutcome, MoneyQuote, MoneyUpdate
from src.progression import win_profit


MONEY_MANAGER_OPTIONS = (
    {"id": "IncreaseWhenLose", "label": "1. Thua tăng, thắng về đầu"},
    {"id": "IncreaseWhenWin", "label": "2. Thắng tăng, thua về đầu"},
    {"id": "Victor2", "label": "3. Victor 2"},
    {"id": "ReverseFibo", "label": "4. Fibonacci ngược"},
    {"id": "MultiChain", "label": "5. Đa tầng chuỗi tiền"},
    {"id": "IncreaseEveryRound", "label": "6. Thắng/thua đều tăng"},
    {"id": "WinUpLoseKeep", "label": "7. Thắng tăng, thua giữ"},
    {"id": "WinUpLoseDown", "label": "8. Thắng tăng, thua giảm"},
)
MONEY_MANAGER_IDS = frozenset(item["id"] for item in MONEY_MANAGER_OPTIONS)


@dataclass(frozen=True, slots=True)
class CapitalStateSnapshot:
    manager_id: str
    stakes: tuple[int, ...]
    stake_chains: tuple[tuple[int, ...], ...]
    level_index: int
    chain_index: int
    need_double_next: bool
    used_double_this_round: bool
    chain_profit: float
    session_pnl: float
    wins: int
    losses: int
    pushes: int
    limit_hit: str
    stop_loss: float
    take_profit: float
    banker_commission: float
    recovery_pnl: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["stakes"] = list(self.stakes)
        data["stake_chains"] = [list(chain) for chain in self.stake_chains]
        return data

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "CapitalStateSnapshot":
        values = dict(raw or {})
        values["stakes"] = tuple(int(value) for value in values.get("stakes") or ())
        values["stake_chains"] = tuple(
            tuple(int(value) for value in chain)
            for chain in values.get("stake_chains") or ()
        )
        values.setdefault("recovery_pnl", 0.0)
        return cls(**values)


def _normalize_stakes(stakes: list[int]) -> list[int]:
    values = [int(value) for value in stakes if int(value) >= 0]
    return values or [0]


def _normalize_chains(
    stakes: list[int], stake_chains: list[list[int]] | None
) -> list[list[int]]:
    chains = [
        _normalize_stakes(list(chain))
        for chain in (stake_chains or [])
        if list(chain)
    ]
    return chains or [_normalize_stakes(stakes)]


class ReferenceMoneyManager:
    """Stateful manager matching the active reference runtime behavior."""

    def __init__(
        self,
        manager_id: str,
        stakes: list[int],
        *,
        stake_chains: list[list[int]] | None = None,
        stop_loss: float = 0.0,
        take_profit: float = 0.0,
        banker_commission: float = 0.05,
        auto_reset_on_nonnegative_pnl: bool = False,
    ):
        self._manager_id = (
            manager_id if manager_id in MONEY_MANAGER_IDS else "IncreaseWhenLose"
        )
        self._stakes = _normalize_stakes(stakes)
        self._chains = _normalize_chains(self._stakes, stake_chains)
        self.stop_loss = max(0.0, float(stop_loss))
        self.take_profit = max(0.0, float(take_profit))
        self.banker_commission = min(1.0, max(0.0, float(banker_commission)))
        self.auto_reset_on_nonnegative_pnl = bool(auto_reset_on_nonnegative_pnl)
        self.reset()

    @property
    def manager_id(self) -> str:
        return self._manager_id

    @property
    def stakes(self) -> tuple[int, ...]:
        return tuple(self._stakes)

    @property
    def stake_chains(self) -> tuple[tuple[int, ...], ...]:
        return tuple(tuple(chain) for chain in self._chains)

    @property
    def level_index(self) -> int:
        return self._level_index

    @property
    def chain_index(self) -> int:
        return self._chain_index

    @property
    def limit_hit(self) -> str:
        return self._limit_hit

    def _active_sequence(self) -> list[int]:
        if self.manager_id == "MultiChain":
            return self._chains[self._chain_index]
        return self._stakes

    def quote(self) -> MoneyQuote:
        sequence = self._active_sequence()
        base = sequence[min(self._level_index, len(sequence) - 1)]
        doubled = self.manager_id == "Victor2" and self._need_double_next
        stake = base * 2 if doubled else base
        return MoneyQuote(
            manager_id=self.manager_id,
            stake=int(stake),
            level_index=self._level_index,
            total_levels=len(sequence),
            reason=(
                f"{self.manager_id}: mức {self._level_index + 1}/{len(sequence)}"
                + (
                    f", chuỗi {self._chain_index + 1}/{len(self._chains)}"
                    if self.manager_id == "MultiChain"
                    else ""
                )
                + (" ×2" if doubled else "")
            ),
            metadata={
                "chain_index": self._chain_index,
                "chain_count": len(self._chains),
                "chain_profit": self._chain_profit,
                "session_pnl": self._session_pnl,
                "recovery_pnl": self._recovery_pnl,
                "limit_hit": self._limit_hit,
            },
        )

    def _outcome_profit(
        self, bet_side: BetSide, result: BetSide, stake: int
    ) -> tuple[MoneyOutcome, float]:
        if result == BetSide.TIE:
            return MoneyOutcome.PUSH, 0.0
        if result != bet_side:
            return MoneyOutcome.LOSS, -float(stake)
        if bet_side == BetSide.BANKER:
            return MoneyOutcome.WIN, win_profit(
                stake, bet_side, commission=self.banker_commission
            )
        return MoneyOutcome.WIN, float(stake)

    def apply_result(self, bet_side: BetSide, result: BetSide) -> MoneyUpdate:
        previous = self.quote()
        self._used_double_this_round = (
            self.manager_id == "Victor2" and self._need_double_next
        )
        outcome, profit = self._outcome_profit(
            bet_side, result, previous.stake
        )
        self._session_pnl += profit
        previous_recovery_pnl = self._recovery_pnl
        self._recovery_pnl += profit
        if outcome == MoneyOutcome.WIN:
            self._wins += 1
            self._advance(True, round_profit=profit)
        elif outcome == MoneyOutcome.LOSS:
            self._losses += 1
            self._advance(False, round_profit=profit)
        else:
            self._pushes += 1
        if (
            self.auto_reset_on_nonnegative_pnl
            and previous_recovery_pnl < 0 <= self._recovery_pnl
        ):
            self._reset_stake_levels()
        self._apply_limits()
        return MoneyUpdate(
            manager_id=self.manager_id,
            outcome=outcome,
            profit=profit,
            previous_quote=previous,
            next_quote=self.quote(),
            group_closed=bool(self._limit_hit),
            group_close_reason=self._limit_hit,
            closed_group_pnl=self._session_pnl if self._limit_hit else 0.0,
        )

    def _advance(self, won: bool, *, round_profit: float) -> None:
        if self.manager_id == "MultiChain":
            self._advance_multi_chain(won, round_profit=round_profit)
            return
        count = len(self._stakes)
        if self.manager_id == "IncreaseWhenLose":
            self._need_double_next = False
            self._level_index = 0 if won else (self._level_index + 1) % count
        elif self.manager_id == "IncreaseWhenWin":
            self._need_double_next = False
            self._level_index = (self._level_index + 1) % count if won else 0
        elif self.manager_id == "Victor2":
            if won:
                if self._used_double_this_round:
                    self._level_index = 0
                    self._need_double_next = False
                elif self._level_index == 0:
                    self._need_double_next = False
                else:
                    self._need_double_next = True
            else:
                self._need_double_next = False
                self._level_index = (self._level_index + 1) % count
        elif self.manager_id == "ReverseFibo":
            self._need_double_next = False
            self._level_index = 0 if won else min(self._level_index + 1, count - 1)
        elif self.manager_id == "IncreaseEveryRound":
            self._need_double_next = False
            self._level_index = (self._level_index + 1) % count
        elif self.manager_id == "WinUpLoseKeep":
            self._need_double_next = False
            if won:
                self._level_index = (self._level_index + 1) % count
        elif self.manager_id == "WinUpLoseDown":
            self._need_double_next = False
            self._level_index = (
                (self._level_index + 1) % count
                if won
                else max(0, self._level_index - 1)
            )

    def _advance_multi_chain(self, won: bool, *, round_profit: float) -> None:
        sequence = self._chains[self._chain_index]
        if won:
            won_level = self._level_index
            self._level_index = 0
            if self._chain_index == 0:
                self._chain_profit = 0.0
                return
            spent = sum(sequence[:won_level])
            self._chain_profit += max(0.0, float(round_profit) - spent)
            previous_total = sum(self._chains[self._chain_index - 1])
            if self._chain_profit >= previous_total:
                self._chain_index -= 1
                self._chain_profit = 0.0
            return
        if self._level_index + 1 < len(sequence):
            self._level_index += 1
        elif self._chain_index + 1 < len(self._chains):
            self._chain_index += 1
            self._level_index = 0
            self._chain_profit = 0.0
        else:
            self._chain_index = 0
            self._level_index = 0
            self._chain_profit = 0.0

    def _apply_limits(self) -> None:
        if self.take_profit > 0 and self._session_pnl >= self.take_profit:
            self._limit_hit = "take_profit"
        elif self.stop_loss > 0 and self._session_pnl <= -self.stop_loss:
            self._limit_hit = "stop_loss"

    def _reset_stake_levels(self) -> None:
        """Reset only progression after a recovered P&L; keep statistics intact."""

        self._level_index = 0
        self._chain_index = 0
        self._need_double_next = False
        self._used_double_this_round = False
        self._chain_profit = 0.0
        self._recovery_pnl = 0.0

    def snapshot(self) -> CapitalStateSnapshot:
        return CapitalStateSnapshot(
            manager_id=self.manager_id,
            stakes=tuple(self._stakes),
            stake_chains=self.stake_chains,
            level_index=self._level_index,
            chain_index=self._chain_index,
            need_double_next=self._need_double_next,
            used_double_this_round=self._used_double_this_round,
            chain_profit=self._chain_profit,
            session_pnl=self._session_pnl,
            wins=self._wins,
            losses=self._losses,
            pushes=self._pushes,
            limit_hit=self._limit_hit,
            stop_loss=self.stop_loss,
            take_profit=self.take_profit,
            banker_commission=self.banker_commission,
            recovery_pnl=self._recovery_pnl,
        )

    def restore(self, snapshot: CapitalStateSnapshot) -> None:
        if snapshot.manager_id != self.manager_id:
            raise ValueError("money manager id does not match snapshot")
        if snapshot.stakes != tuple(self._stakes):
            raise ValueError("stakes do not match snapshot")
        if snapshot.stake_chains != self.stake_chains:
            raise ValueError("stake chains do not match snapshot")
        if abs(snapshot.banker_commission - self.banker_commission) > 1e-9:
            raise ValueError("banker commission does not match snapshot")
        self._chain_index = min(
            max(0, snapshot.chain_index), len(self._chains) - 1
        )
        sequence = self._active_sequence()
        self._level_index = min(
            max(0, snapshot.level_index), len(sequence) - 1
        )
        self._need_double_next = bool(snapshot.need_double_next)
        self._used_double_this_round = bool(snapshot.used_double_this_round)
        self._chain_profit = float(snapshot.chain_profit)
        self._session_pnl = float(snapshot.session_pnl)
        self._wins = int(snapshot.wins)
        self._losses = int(snapshot.losses)
        self._pushes = int(snapshot.pushes)
        self._limit_hit = str(snapshot.limit_hit or "")
        self._recovery_pnl = float(snapshot.recovery_pnl)

    def reset(self) -> None:
        self._level_index = 0
        self._chain_index = 0
        self._need_double_next = False
        self._used_double_this_round = False
        self._chain_profit = 0.0
        self._session_pnl = 0.0
        self._recovery_pnl = 0.0
        self._wins = 0
        self._losses = 0
        self._pushes = 0
        self._limit_hit = ""


def create_money_manager(
    manager_id: str,
    stakes: list[int],
    *,
    stake_chains: list[list[int]] | None = None,
    stop_loss: float = 0.0,
    take_profit: float = 0.0,
    banker_commission: float = 0.05,
    auto_reset_on_nonnegative_pnl: bool = False,
) -> ReferenceMoneyManager:
    return ReferenceMoneyManager(
        manager_id,
        stakes,
        stake_chains=stake_chains,
        stop_loss=stop_loss,
        take_profit=take_profit,
        banker_commission=banker_commission,
        auto_reset_on_nonnegative_pnl=auto_reset_on_nonnegative_pnl,
    )
