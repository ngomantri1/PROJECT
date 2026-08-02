"""Engine nuoi Hoa: gap → chu ky cuoc Hoa, PnL rieng, khong dung GroupStakeProgression."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

from src.config import TieNurtureConfig
from src.models import BetSide

logger = logging.getLogger(__name__)

PATTERN_ID = "tie_nurture"
PATTERN_NAME = "Nuoi Hoa"


@dataclass
class TiePending:
    bet_id: int
    round_id: str
    stake: float
    target_round_index: int
    placed_at: datetime
    table_name: str = ""
    game_shoe: int = 0
    game_round: int = 0


class TieNurtureEngine:
    """
    Sau gap_min phien khong Hoa → active: dat Hoa stake den Hoa / gap_max / max_bets.
    Khi active: doc quyen — AutoBettor bo qua pattern P/B.
    """

    def __init__(self, cfg: TieNurtureConfig | None = None):
        self.cfg = (cfg or TieNurtureConfig()).model_copy(deep=True)
        self.gap = 0
        self.active = False
        self.bets_in_cycle = 0
        self.pending: TiePending | None = None
        self.session_pnl = 0.0
        self.stopped_sl = False
        self.wins = 0
        self.losses = 0
        self.total_bets = 0

    def configure(self, cfg: TieNurtureConfig) -> None:
        was = self.cfg.enabled
        self.cfg = cfg.model_copy(deep=True)
        if not self.cfg.enabled:
            self.active = False
            self.bets_in_cycle = 0
            # giu pending de resolve ket qua dang cho
        if self.cfg.enabled and not was:
            self.stopped_sl = False
        sl = float(self.cfg.session_stop_loss or 0)
        if sl > 0 and self.session_pnl <= -sl:
            self.stopped_sl = True
            self.active = False

    @property
    def has_pending(self) -> bool:
        return self.pending is not None

    def wants_bet(self) -> bool:
        if not self.cfg.enabled or self.stopped_sl or self.pending:
            return False
        return bool(self.active)

    def status(self) -> dict:
        return {
            "enabled": self.cfg.enabled,
            "active": self.active,
            "gap": self.gap,
            "bets_in_cycle": self.bets_in_cycle,
            "pending": self.pending is not None,
            "session_pnl": self.session_pnl,
            "stopped_sl": self.stopped_sl,
            "stake": self.cfg.stake,
            "gap_min": self.cfg.gap_min,
            "gap_max": self.cfg.gap_max,
            "max_bets": self.cfg.max_bets,
        }

    def sync_from_history(self, history: list[BetSide]) -> None:
        """Tinh gap/active tu chuoi hien tai (vao ban / bat toggle) — khong gia PnL."""
        if self.pending:
            return
        gap = 0
        for r in reversed(history or []):
            if r == BetSide.TIE:
                break
            gap += 1
        self.gap = gap
        self.bets_in_cycle = 0
        self.active = False
        if not self.cfg.enabled or self.stopped_sl:
            return
        if gap >= int(self.cfg.gap_min):
            gmax = int(self.cfg.gap_max or 0)
            if gmax <= 0 or gap <= gmax:
                self.active = True
                logger.info(
                    "[HOA] SYNC gap=%d → active (min=%d max=%s)",
                    gap,
                    self.cfg.gap_min,
                    gmax or "OFF",
                )

    def _end_cycle(self) -> None:
        self.active = False
        self.bets_in_cycle = 0

    def _check_session_sl(self) -> None:
        sl = float(self.cfg.session_stop_loss or 0)
        if sl > 0 and self.session_pnl <= -sl:
            self.stopped_sl = True
            self.active = False
            logger.warning(
                "[HOA] Cham SL session %.0f — tat nuoi (PnL %+.0f)",
                sl,
                self.session_pnl,
            )

    def observe_result(self, result: BetSide) -> None:
        """Cap nhat gap khi khong co cuoc Hoa pending (da resolve xong neu co)."""
        if self.pending:
            return
        if self.active:
            # Miss cua cuoc — van theo doi gap de cat theo gap_max
            if result == BetSide.TIE:
                self.gap = 0
                self._end_cycle()
                return
            self.gap += 1
            gmax = int(self.cfg.gap_max or 0)
            if gmax > 0 and self.gap > gmax:
                logger.info("[HOA] Cat chu ky (miss cua) gap=%d > max=%d", self.gap, gmax)
                self._end_cycle()
            return

        if result == BetSide.TIE:
            self.gap = 0
            return

        self.gap += 1
        if not self.cfg.enabled or self.stopped_sl:
            return
        if self.gap >= int(self.cfg.gap_min):
            gmax = int(self.cfg.gap_max or 0)
            if gmax <= 0 or self.gap <= gmax:
                self.active = True
                logger.info(
                    "[HOA] BAT CHU KY gap=%d (min=%d max=%s stake=%s)",
                    self.gap,
                    self.cfg.gap_min,
                    gmax or "OFF",
                    self.cfg.stake,
                )

    def begin_pending(
        self,
        *,
        round_id: str,
        stake: float,
        target_round_index: int,
        table_name: str = "",
        bet_id: int = 0,
        game_shoe: int = 0,
        game_round: int = 0,
    ) -> TiePending:
        pending = TiePending(
            bet_id=bet_id,
            round_id=round_id,
            stake=float(stake),
            target_round_index=target_round_index,
            placed_at=datetime.now(),
            table_name=table_name,
            game_shoe=game_shoe,
            game_round=game_round,
        )
        self.pending = pending
        self.total_bets += 1
        return pending

    def attach_bet_id(self, bet_id: int) -> None:
        if self.pending:
            self.pending.bet_id = bet_id

    def clear_pending(self) -> None:
        self.pending = None

    def resolve_pending(self, result: BetSide) -> tuple[str, float] | None:
        pending = self.pending
        if not pending:
            return None
        self.pending = None
        stake = float(pending.stake)
        payout = float(self.cfg.payout or 8.0)
        self.bets_in_cycle += 1

        if result == BetSide.TIE:
            profit = stake * payout
            outcome = "win"
            self.wins += 1
            self.session_pnl += profit
            self.gap = 0
            self._end_cycle()
            logger.info(
                "[HOA] THANG stake=%.0f profit=%+.0f | PnL hoa %+.0f",
                stake,
                profit,
                self.session_pnl,
            )
        else:
            profit = -stake
            outcome = "loss"
            self.losses += 1
            self.session_pnl += profit
            self.gap += 1
            stop = False
            gmax = int(self.cfg.gap_max or 0)
            if gmax > 0 and self.gap > gmax:
                stop = True
            mb = int(self.cfg.max_bets or 0)
            if mb > 0 and self.bets_in_cycle >= mb:
                stop = True
            if stop:
                logger.info(
                    "[HOA] Cat chu ky sau thua | gap=%d bets=%d max_gap=%s max_bets=%s",
                    self.gap,
                    self.bets_in_cycle,
                    gmax or "OFF",
                    mb or "OFF",
                )
                self._end_cycle()
            # else: van active → nuoi tiep
            logger.info(
                "[HOA] THUA stake=%.0f | gap=%d bets_in=%d active=%s | PnL hoa %+.0f",
                stake,
                self.gap,
                self.bets_in_cycle,
                self.active,
                self.session_pnl,
            )

        self._check_session_sl()
        return outcome, profit
