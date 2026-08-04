from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP

from src.models import BetSide

BANKER_COMMISSION = 0.05
PROGRESSION_MODE_LOSS_UP_WIN_RESET = "loss_up_win_reset"
PROGRESSION_MODE_WIN_UP_LOSS_RESET = "win_up_loss_reset"
PROGRESSION_MODE_BOTH_UP = "both_up"
PROGRESSION_MODE_WIN_UP_LOSS_HOLD = "win_up_loss_hold"
# Mode 5 (toi uu tren W/L that): thang + pnl>0 → ve dau; thang am → leo; thua → leo 1 bac
PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP = "profit_lock_loss_up"

PROGRESSION_MODES = {
    PROGRESSION_MODE_LOSS_UP_WIN_RESET,
    PROGRESSION_MODE_WIN_UP_LOSS_RESET,
    PROGRESSION_MODE_BOTH_UP,
    PROGRESSION_MODE_WIN_UP_LOSS_HOLD,
    PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP,
}


def win_profit(stake: int, bet_side: BetSide, *, commission: float = BANKER_COMMISSION) -> float:
    """Lai thang: Player 1:1; Banker tru commission (mac dinh 5%). Stake 0 → 0."""
    if stake <= 0:
        return 0.0
    if bet_side == BetSide.BANKER:
        return float(
            (Decimal(stake) * (Decimal("1") - Decimal(str(commission)))).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
    return float(stake)


@dataclass
class GroupProgressionState:
    group_pnl: float = 0.0
    loss_count: int = 0
    index: int = 0
    groups_closed: int = 0
    last_group_close: str = ""  # take_profit | stop_loss | ""
    last_closed_group_pnl: float = 0.0  # PnL nhom truoc khi reset (de luu DB)
    last_closed_loss_count: int = 0
    # Ket qua tung van trong nhom dang mo: "W" | "L" | "T"
    group_results: list[str] = field(default_factory=list)


class GroupStakeProgression:
    """
    Chuoi cuoc theo nhom (ToolBet v2):
    - stakes[0] thuong = 0: danh ao (khong dat chip) nhung van tinh thang/thua
    - Thua (ke ca stake 0) → loss_count += 1; index theo mode
    - mode loss_up_win_reset (1): thua → index=loss_count; thang pnl<0 → leo;
      thang pnl>=0 → ve dau + reset lc
    - mode win_up_loss_reset (2): thua → ve dau; thang o 0 → nhay theo lc;
      thang muc that → reset lc + leo 1 bac
    - mode both_up (3): win/loss deu leo
    - mode win_up_loss_hold (4): thang leo, thua giu nguyen
    - mode profit_lock_loss_up (5): thang + pnl>0 → ve dau; thang pnl<=0 → leo;
      thua → leo 1 bac (toi uu tren chuoi W/L that + classic_0)

    loss_watch_recover (nut overlay) — TAT: dung dung mode o tren, khong chen them.
    BAT:
      - Mode 1/2: moi lan mode sap "ve dau" chi thuc hien khi group_pnl > 0;
        group_pnl <= 0 → giu nguyen index
      - Mode 3/4: khi thang, neu group_pnl > 0 → ve dau; neu <= 0 → de mode xu ly
      - Mode 5: da khoa lai san — nut khong doi rule mode 5
    - Dong nhom khi group_take_profit / group_stop_loss (reset index + loss_count)
    """

    def __init__(
        self,
        stakes: list[int],
        *,
        group_take_profit: float = 0.0,
        group_stop_loss: float = 0.0,
        banker_commission: float = BANKER_COMMISSION,
        mode: str = PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        loss_watch_recover: bool = False,
    ):
        if not stakes:
            raise ValueError("stakes không được rỗng")
        if any(s < 0 for s in stakes):
            raise ValueError("stakes không được âm")
        self.stakes = stakes
        self.group_take_profit = group_take_profit
        self.group_stop_loss = group_stop_loss
        self.banker_commission = banker_commission
        self.mode = (
            mode
            if mode in PROGRESSION_MODES
            else PROGRESSION_MODE_LOSS_UP_WIN_RESET
        )
        self.loss_watch_recover = bool(loss_watch_recover)
        self.state = GroupProgressionState()

    @property
    def index(self) -> int:
        return self.state.index

    @property
    def group_pnl(self) -> float:
        return self.state.group_pnl

    @property
    def loss_count(self) -> int:
        return self.state.loss_count

    @property
    def current_stake(self) -> int:
        return self.stakes[self.state.index]

    def _stake_index_for_loss_count(self) -> int:
        return min(self.state.loss_count, len(self.stakes) - 1)

    def _inc_index(self) -> None:
        self.state.index = min(self.state.index + 1, len(self.stakes) - 1)

    def _index_for_win_at_first_step(self) -> int:
        """
        Thang o muc dau (thuong stake 0):
        - loss_count == 0 → bac ke (index 1)
        - loss_count  >= 1 → buoc 1-based = loss_count, nhung khong o lai stake 0
          (index = max(loss_count - 1, 1); vd lc=1→50, lc=3→100)
        """
        n = len(self.stakes)
        if n <= 0:
            return 0
        lc = int(self.state.loss_count)
        if lc <= 0:
            return min(1, n - 1)
        return min(max(lc - 1, 1), n - 1)

    def _win_reset_to_first(self) -> None:
        self.state.index = 0
        self.state.loss_count = 0

    def _allow_reset_to_start(self) -> bool:
        """Cho phep 've dau'. TAT nut → luon cho; BAT → chi khi group_pnl > 0."""
        if not self.loss_watch_recover:
            return True
        return self.state.group_pnl >= 0

    def _try_reset_to_start(self, *, clear_loss_count: bool) -> bool:
        """Thuc hien ve dau neu duoc phep. False = giu nguyen index."""
        if not self._allow_reset_to_start():
            return False
        self.state.index = 0
        if clear_loss_count:
            self.state.loss_count = 0
        return True

    def _apply_win_by_group_pnl(self) -> None:
        """
        Mode1 sau khi da cong profit:
        - group_pnl < 0  → leo 1 bac
        - group_pnl >= 0 → ve dau (neu watch BAT ma pnl==0 → giu nguyen)
        """
        if self.state.group_pnl < 0:
            self._inc_index()
            return
        self._try_reset_to_start(clear_loss_count=True)

    def _apply_next_index(self, outcome: str, *, at_first_step: bool) -> None:
        """
        TAT loss_watch_recover: dung dung rule mode, khong nhanh phu.
        BAT: mode1/2 loc moi lan 've dau'; mode3/4 thang+pnl>0 → ve dau.
        """
        if self.mode == PROGRESSION_MODE_LOSS_UP_WIN_RESET:
            if outcome == "loss":
                self.state.index = self._stake_index_for_loss_count()
            elif outcome == "win":
                self._apply_win_by_group_pnl()
            return

        if self.mode == PROGRESSION_MODE_WIN_UP_LOSS_RESET:
            if outcome == "loss":
                # Classic: ve dau. Watch BAT + pnl<=0 → giu nguyen bac.
                self._try_reset_to_start(clear_loss_count=False)
                return
            if outcome == "win":
                if at_first_step:
                    self.state.index = self._index_for_win_at_first_step()
                else:
                    self.state.loss_count = 0
                    self._inc_index()
            return

        if self.mode == PROGRESSION_MODE_BOTH_UP:
            if outcome == "win" and self.loss_watch_recover and self.state.group_pnl > 0:
                self._win_reset_to_first()
                return
            if outcome in ("win", "loss"):
                self._inc_index()
            return

        if self.mode == PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP:
            # Mode 5: thang + lai → ve dau; thang am/0 → leo; thua → leo 1 bac
            if outcome == "win":
                if self.state.group_pnl > 0:
                    self._win_reset_to_first()
                else:
                    self._inc_index()
            elif outcome == "loss":
                self._inc_index()
            return

        # PROGRESSION_MODE_WIN_UP_LOSS_HOLD
        if outcome == "win":
            if self.loss_watch_recover and self.state.group_pnl > 0:
                self._win_reset_to_first()
            else:
                self._inc_index()

    def _close_group(self, reason: str) -> None:
        self.state.groups_closed += 1
        self.state.last_group_close = reason
        self.state.last_closed_group_pnl = self.state.group_pnl
        self.state.last_closed_loss_count = self.state.loss_count
        self.state.group_pnl = 0.0
        self.state.loss_count = 0
        self.state.index = 0
        self.state.group_results = []

    def _maybe_close_group(self) -> bool:
        if self.group_take_profit > 0 and self.state.group_pnl >= self.group_take_profit:
            self._close_group("take_profit")
            return True
        if self.group_stop_loss > 0 and self.state.group_pnl <= -self.group_stop_loss:
            self._close_group("stop_loss")
            return True
        return False

    def reset(self) -> None:
        self.state = GroupProgressionState()

    def configure(
        self,
        *,
        group_take_profit: float | None = None,
        group_stop_loss: float | None = None,
        mode: str | None = None,
        loss_watch_recover: bool | None = None,
    ) -> None:
        if group_take_profit is not None:
            self.group_take_profit = group_take_profit
        if group_stop_loss is not None:
            self.group_stop_loss = group_stop_loss
        if mode is not None and mode in PROGRESSION_MODES:
            self.mode = mode
        if loss_watch_recover is not None:
            self.loss_watch_recover = bool(loss_watch_recover)

    def resolve_outcome(self, bet_side: BetSide, result: BetSide) -> str:
        if result == BetSide.TIE:
            return "push"
        if bet_side == result:
            return "win"
        return "loss"

    def apply_result(self, bet_side: BetSide, result: BetSide) -> tuple[str, int, float]:
        outcome = self.resolve_outcome(bet_side, result)
        stake = self.current_stake
        at_first_step = self.state.index == 0
        mark = {"win": "W", "loss": "L", "push": "T"}.get(outcome, "?")
        self.state.group_results.append(mark)
        if outcome == "win":
            profit = win_profit(stake, bet_side, commission=self.banker_commission)
            self.state.group_pnl += profit
        elif outcome == "loss":
            profit = -float(stake)
            self.state.group_pnl += profit
            self.state.loss_count += 1
        else:
            profit = 0.0
            # Hoa: giu muc cuoc hien tai, khong doi index
            return outcome, self.current_stake, profit

        if not self._maybe_close_group():
            self._apply_next_index(outcome, at_first_step=at_first_step)

        return outcome, self.current_stake, profit


StakeProgression = GroupStakeProgression
