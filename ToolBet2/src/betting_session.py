from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from src.models import BetSide, SIDE_LABEL
from src.progression import (
    GroupStakeProgression,
    PROGRESSION_MODE_LOSS_UP_WIN_RESET,
)


@dataclass
class PendingBet:
    bet_id: int
    round_id: str
    side: BetSide
    stake: int
    stake_index: int
    pattern_id: str
    pattern_name: str
    reason: str
    target_round_index: int
    placed_at: datetime


@dataclass
class BettingSessionState:
    auto_bet: bool = False
    stop_loss: float = 0.0
    take_profit: float = 0.0
    group_take_profit: float = 0.0
    group_stop_loss: float = 0.0
    progression_mode: str = PROGRESSION_MODE_LOSS_UP_WIN_RESET
    loss_watch_recover: bool = False
    session_profit: float = 0.0
    limit_hit: str = ""
    last_bet_summary: str = ""
    pending: PendingBet | None = None
    total_bets: int = 0
    wins: int = 0
    losses: int = 0
    pushes: int = 0
    # ID nhom dang mo trong DB (bet_groups.id); None = chua mo / vua dong
    current_group_id: int | None = None
    current_group_seq: int | None = None
    last_group_closed: bool = False
    last_group_close_reason: str = ""
    last_group_close_pnl: float = 0.0


class BettingSession:
    """Quan ly progression theo nhom, P&L phien, gioi han lai/lo theo ngay."""

    def __init__(
        self,
        stakes: list[int],
        *,
        stop_loss: float = 0,
        take_profit: float = 0,
        group_take_profit: float = 0,
        group_stop_loss: float = 0,
        progression_mode: str = PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        loss_watch_recover: bool = False,
    ):
        self.progression = GroupStakeProgression(
            stakes,
            group_take_profit=group_take_profit,
            group_stop_loss=group_stop_loss,
            mode=progression_mode,
            loss_watch_recover=loss_watch_recover,
        )
        self.state = BettingSessionState(
            stop_loss=stop_loss,
            take_profit=take_profit,
            group_take_profit=group_take_profit,
            group_stop_loss=group_stop_loss,
            progression_mode=progression_mode,
            loss_watch_recover=loss_watch_recover,
        )
        self._profit_for_limits: Callable[[], float] | None = None

    def set_profit_for_limits(self, provider: Callable[[], float] | None) -> None:
        self._profit_for_limits = provider

    def _effective_profit(self) -> float:
        if self._profit_for_limits is not None:
            return float(self._profit_for_limits())
        return self.state.session_profit

    def set_stakes(self, stakes: list[int]) -> None:
        gtp = self.state.group_take_profit
        gsl = self.state.group_stop_loss
        mode = self.state.progression_mode
        watch = self.state.loss_watch_recover
        self.progression = GroupStakeProgression(
            stakes,
            group_take_profit=gtp,
            group_stop_loss=gsl,
            mode=mode,
            loss_watch_recover=watch,
        )

    def configure(
        self,
        *,
        auto_bet: bool | None = None,
        stop_loss: float | None = None,
        take_profit: float | None = None,
        group_take_profit: float | None = None,
        group_stop_loss: float | None = None,
        progression_mode: str | None = None,
        loss_watch_recover: bool | None = None,
    ) -> None:
        if auto_bet is not None:
            self.state.auto_bet = auto_bet
            if auto_bet:
                self.state.limit_hit = ""
        if stop_loss is not None:
            self.state.stop_loss = stop_loss
        if take_profit is not None:
            self.state.take_profit = take_profit
        if group_take_profit is not None:
            self.state.group_take_profit = group_take_profit
            self.progression.configure(group_take_profit=group_take_profit)
        if group_stop_loss is not None:
            self.state.group_stop_loss = group_stop_loss
            self.progression.configure(group_stop_loss=group_stop_loss)
        if progression_mode is not None:
            self.state.progression_mode = progression_mode
            self.progression.configure(mode=progression_mode)
        if loss_watch_recover is not None:
            self.state.loss_watch_recover = bool(loss_watch_recover)
            self.progression.configure(loss_watch_recover=loss_watch_recover)

    @property
    def current_stake(self) -> int:
        return self.progression.current_stake

    def can_place_bet(self) -> bool:
        return self.state.auto_bet and not self.state.limit_hit and self.state.pending is None

    def check_limits(self) -> str | None:
        profit = self._effective_profit()
        if self.state.take_profit > 0 and profit >= self.state.take_profit:
            return "take_profit"
        if self.state.stop_loss > 0 and profit <= -self.state.stop_loss:
            return "stop_loss"
        return None

    def apply_limit_if_hit(self) -> str | None:
        hit = self.check_limits()
        if hit:
            self.state.limit_hit = hit
            self.state.auto_bet = False
        return hit

    def try_reserve_pending(self, pending: PendingBet) -> bool:
        if self.state.pending is not None:
            return False
        self.state.pending = pending
        self.state.total_bets += 1
        return True

    def attach_bet_id(self, bet_id: int) -> None:
        if self.state.pending:
            self.state.pending.bet_id = bet_id

    def set_pending(self, pending: PendingBet) -> None:
        self.state.pending = pending
        self.state.total_bets += 1

    def clear_pending(self) -> None:
        self.state.pending = None

    def resolve_pending(self, result: BetSide) -> tuple[str, float] | None:
        pending = self.state.pending
        if not pending:
            return None

        close_count_before = self.progression.state.groups_closed
        outcome, _next_stake, profit = self.progression.apply_result(pending.side, result)
        self.state.session_profit += profit
        if outcome == "win":
            self.state.wins += 1
        elif outcome == "loss":
            self.state.losses += 1
        else:
            self.state.pushes += 1

        closed = self.progression.state.groups_closed > close_count_before
        self.state.last_group_closed = closed
        if closed:
            self.state.last_group_close_reason = self.progression.state.last_group_close
            self.state.last_group_close_pnl = self.progression.state.last_closed_group_pnl
            display_group_pnl = self.state.last_group_close_pnl
        else:
            self.state.last_group_close_reason = ""
            self.state.last_group_close_pnl = 0.0
            display_group_pnl = self.progression.group_pnl

        label = SIDE_LABEL.get(pending.side, pending.side.value)
        res_label = SIDE_LABEL.get(result, result.value)
        group_note = ""
        if closed:
            if self.state.last_group_close_reason == "take_profit":
                group_note = " | Dong nhom: dat LAI nhom"
            else:
                group_note = " | Dong nhom: dat LO nhom"
        self.state.last_bet_summary = (
            f"{label} {pending.stake} — {outcome.upper()} ({res_label}) "
            f"P&L van: {profit:+.0f} | P&L nhom: {display_group_pnl:+.0f}"
            f"{group_note}"
        )
        self.state.pending = None
        self.apply_limit_if_hit()
        return outcome, profit

    def group_pnl_after_resolve(self) -> float:
        """PnL nhom sau van vua resolve (neu vua dong = PnL cuoi nhom)."""
        if self.state.last_group_closed:
            return self.state.last_group_close_pnl
        return self.progression.group_pnl

    def clear_current_group(self) -> None:
        self.state.current_group_id = None
        self.state.current_group_seq = None

    def overlay_status(self) -> dict:
        s = self.state
        p = self.progression
        stakes = list(p.stakes)
        idx = int(p.index)
        n = len(stakes)
        current = int(p.current_stake)
        mode = s.progression_mode
        watch = bool(s.loss_watch_recover)
        # Preview buoc tiep theo — TAT watch = rule mode thuan; BAT = loc ve dau theo pnl.
        gpnl = float(p.group_pnl)
        if n <= 0:
            next_idx = 0
            win_idx = 0
        elif mode == "loss_up_win_reset":
            next_idx = min(int(p.loss_count) + 1, n - 1)
            est = gpnl + float(current)
            if est < 0:
                win_idx = min(idx + 1, n - 1)
            elif watch and est <= 0:
                win_idx = idx  # pnl==0 + watch → giu nguyen
            else:
                win_idx = 0
        elif mode == "win_up_loss_reset":
            # Thua → ve 0 (watch BAT + pnl<=0 sau thua → giu bac — uoc luong gpnl-current)
            loss_est = gpnl - float(current)
            if watch and loss_est <= 0:
                next_idx = idx
            else:
                next_idx = 0
            if idx == 0:
                lc = int(p.loss_count)
                win_idx = min(1, n - 1) if lc <= 0 else min(max(lc - 1, 1), n - 1)
            else:
                win_idx = min(idx + 1, n - 1)
        elif mode == "both_up":
            next_idx = min(idx + 1, n - 1)
            win_est = gpnl + float(current)
            if watch and win_est > 0:
                win_idx = 0
            else:
                win_idx = next_idx
        elif mode == "win_up_loss_hold":
            next_idx = idx
            win_est = gpnl + float(current)
            if watch and win_est > 0:
                win_idx = 0
            else:
                win_idx = min(idx + 1, n - 1)
        elif mode == "profit_lock_loss_up":
            next_idx = min(idx + 1, n - 1)
            win_est = gpnl + float(current)
            win_idx = 0 if win_est > 0 else next_idx
        else:
            next_idx = min(int(p.loss_count) + 1, n - 1)
            win_idx = 0
        next_stake = int(stakes[next_idx]) if n else 0
        if (
            next_idx == idx
            and idx < n - 1
            and mode not in ("win_up_loss_hold", "win_up_loss_reset", "profit_lock_loss_up")
            and not (mode == "loss_up_win_reset" and watch)
        ):
            next_idx = idx + 1
            next_stake = int(stakes[next_idx])
        win_stake = int(stakes[win_idx]) if n else 0
        limit_text = ""
        if s.limit_hit == "take_profit":
            limit_text = "Da dat muc LAI hom nay — tu tat cuoc"
        elif s.limit_hit == "stop_loss":
            limit_text = "Da dat muc LO hom nay — tu tat cuoc"
        return {
            "auto_bet": s.auto_bet,
            "stop_loss": s.stop_loss,
            "take_profit": s.take_profit,
            "group_take_profit": s.group_take_profit,
            "group_stop_loss": s.group_stop_loss,
            "progression_mode": s.progression_mode,
            "loss_watch_recover": watch,
            "group_pnl": p.group_pnl,
            "group_loss_count": p.loss_count,
            "group_results": list(p.state.group_results or []),
            "group_wins": sum(1 for x in (p.state.group_results or []) if x == "W"),
            "group_losses": sum(1 for x in (p.state.group_results or []) if x == "L"),
            "group_pushes": sum(1 for x in (p.state.group_results or []) if x == "T"),
            "groups_closed": p.state.groups_closed,
            "current_group_id": s.current_group_id,
            "current_group_seq": s.current_group_seq,
            "session_profit": s.session_profit,
            "current_stake": current,
            "stake_index": idx,
            "stake_step": idx + 1,
            "stake_total_steps": n,
            "next_stake": next_stake,
            "next_stake_step": next_idx + 1,
            "next_stake_on_win": win_stake,
            "next_stake_step_on_win": win_idx + 1,
            "stakes": stakes,
            "limit_hit": s.limit_hit,
            "limit_text": limit_text,
            "last_bet": s.last_bet_summary,
            "pending": bool(s.pending),
            "total_bets": s.total_bets,
            "wins": s.wins,
            "losses": s.losses,
            "pushes": s.pushes,
        }
