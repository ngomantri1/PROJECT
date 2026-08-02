from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import RoundRecord
from src.models import BetSide
from src.pattern_analyzer import CASE2_ID, CASE1_PATTERNS, get_active_signal
from src.patterns_config import all_pattern_ids, disabled_pattern_ids, normalize_pattern_enabled
from src.progression import BANKER_COMMISSION, StakeProgression


@dataclass
class BacktestConfig:
    stakes: list[int]
    skip_tie: bool = True
    pattern_enabled: dict[str, bool] | None = None
    stop_loss: float = 0.0
    take_profit: float = 0.0
    banker_commission: float = BANKER_COMMISSION
    label: str = ""


@dataclass
class BacktestBet:
    round_index: int
    pattern_id: str
    pattern_name: str
    side: BetSide
    stake: int
    stake_index: int
    result: BetSide
    outcome: str
    profit: float


@dataclass
class BacktestResult:
    config: BacktestConfig
    bets: list[BacktestBet] = field(default_factory=list)
    total_profit: float = 0.0
    max_drawdown: float = 0.0
    peak_profit: float = 0.0
    limit_hit: str = ""
    stopped_at_index: int | None = None

    @property
    def bet_count(self) -> int:
        return len(self.bets)

    @property
    def wins(self) -> int:
        return sum(1 for b in self.bets if b.outcome == "win")

    @property
    def losses(self) -> int:
        return sum(1 for b in self.bets if b.outcome == "loss")

    @property
    def pushes(self) -> int:
        return sum(1 for b in self.bets if b.outcome == "push")

    @property
    def resolved(self) -> int:
        return self.wins + self.losses

    @property
    def win_rate(self) -> float | None:
        if self.resolved <= 0:
            return None
        return self.wins / self.resolved

    @property
    def roi(self) -> float | None:
        staked = sum(b.stake for b in self.bets)
        if staked <= 0:
            return None
        return self.total_profit / staked

    @property
    def profit_per_bet(self) -> float | None:
        if not self.bets:
            return None
        return self.total_profit / len(self.bets)

    def profit_by_pattern(self) -> dict[str, float]:
        out: dict[str, float] = {}
        for b in self.bets:
            out[b.pattern_id] = out.get(b.pattern_id, 0.0) + b.profit
        return out

    def count_by_pattern(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for b in self.bets:
            out[b.pattern_id] = out.get(b.pattern_id, 0) + 1
        return out


def _parse_result(value: str) -> BetSide | None:
    v = (value or "").strip().lower()
    if v == "player":
        return BetSide.PLAYER
    if v == "banker":
        return BetSide.BANKER
    if v == "tie":
        return BetSide.TIE
    return None


def load_round_results(
    session: Session,
    *,
    table_name: str | None = None,
    hall_id: str | None = None,
) -> list[BetSide]:
    stmt = select(RoundRecord).order_by(RoundRecord.id)
    if table_name:
        stmt = stmt.where(RoundRecord.table_name == table_name)
    if hall_id:
        stmt = stmt.where(RoundRecord.hall_id == hall_id)
    rows = session.scalars(stmt).all()
    out: list[BetSide] = []
    for row in rows:
        side = _parse_result(row.result)
        if side is not None:
            out.append(side)
    return out


def run_backtest(history: list[BetSide], config: BacktestConfig) -> BacktestResult:
    """Mo phong logic live: tin hieu tu prefix, cuoc van tiep theo."""
    enabled = normalize_pattern_enabled(config.pattern_enabled)
    disabled = disabled_pattern_ids(enabled)
    progression = StakeProgression(
        list(config.stakes), banker_commission=config.banker_commission
    )
    result = BacktestResult(config=config)

    session_profit = 0.0
    peak = 0.0
    max_dd = 0.0
    prefix: list[BetSide] = []
    limit_hit = ""

    for round_index, round_result in enumerate(history):
        if limit_hit:
            result.stopped_at_index = round_index
            break

        signal = get_active_signal(prefix, config.skip_tie, disabled_patterns=disabled)
        if signal and signal.bet_side:
            stake = progression.current_stake
            stake_index = progression.index
            outcome, _, profit = progression.apply_result(signal.bet_side, round_result)
            session_profit += profit
            result.bets.append(
                BacktestBet(
                    round_index=round_index,
                    pattern_id=signal.pattern_id,
                    pattern_name=signal.pattern_name,
                    side=signal.bet_side,
                    stake=stake,
                    stake_index=stake_index,
                    result=round_result,
                    outcome=outcome,
                    profit=profit,
                )
            )
            if session_profit > peak:
                peak = session_profit
            dd = peak - session_profit
            if dd > max_dd:
                max_dd = dd

            if config.take_profit > 0 and session_profit >= config.take_profit:
                limit_hit = "take_profit"
            elif config.stop_loss > 0 and session_profit <= -config.stop_loss:
                limit_hit = "stop_loss"

        prefix.append(round_result)

    result.total_profit = session_profit
    result.peak_profit = peak
    result.max_drawdown = max_dd
    result.limit_hit = limit_hit
    if limit_hit and result.stopped_at_index is None:
        result.stopped_at_index = len(history)
    return result


def only_pattern_enabled(pattern_id: str) -> dict[str, bool]:
    enabled = {pid: False for pid in all_pattern_ids()}
    if pattern_id in enabled:
        enabled[pattern_id] = True
    return enabled


def pattern_name_map() -> dict[str, str]:
    names = {p.id: p.name for p in CASE1_PATTERNS}
    names[CASE2_ID] = "Bet×2"
    return names


def summarize_result(result: BacktestResult) -> dict:
    wr = result.win_rate
    roi = result.roi
    return {
        "label": result.config.label,
        "bets": result.bet_count,
        "wins": result.wins,
        "losses": result.losses,
        "pushes": result.pushes,
        "win_rate": f"{wr * 100:.1f}%" if wr is not None else "n/a",
        "profit": round(result.total_profit, 1),
        "max_drawdown": round(result.max_drawdown, 1),
        "roi": f"{roi * 100:.1f}%" if roi is not None else "n/a",
        "profit_per_bet": round(result.profit_per_bet, 2) if result.profit_per_bet is not None else None,
        "limit_hit": result.limit_hit or "",
        "stakes": result.config.stakes,
    }


def compare_single_patterns(
    history: list[BetSide],
    stakes: list[int],
    *,
    skip_tie: bool = True,
    stop_loss: float = 0.0,
    take_profit: float = 0.0,
) -> list[BacktestResult]:
    results: list[BacktestResult] = []
    names = pattern_name_map()
    for pid in all_pattern_ids():
        cfg = BacktestConfig(
            stakes=stakes,
            skip_tie=skip_tie,
            pattern_enabled=only_pattern_enabled(pid),
            stop_loss=stop_loss,
            take_profit=take_profit,
            label=names.get(pid, pid),
        )
        results.append(run_backtest(history, cfg))
    results.sort(key=lambda r: r.total_profit, reverse=True)
    return results


def compare_stake_progressions(
    history: list[BetSide],
    stake_sets: Iterable[list[int]],
    *,
    pattern_enabled: dict[str, bool] | None = None,
    skip_tie: bool = True,
    stop_loss: float = 0.0,
    take_profit: float = 0.0,
) -> list[BacktestResult]:
    results: list[BacktestResult] = []
    for stakes in stake_sets:
        label = str(stakes)
        cfg = BacktestConfig(
            stakes=list(stakes),
            skip_tie=skip_tie,
            pattern_enabled=pattern_enabled,
            stop_loss=stop_loss,
            take_profit=take_profit,
            label=label,
        )
        results.append(run_backtest(history, cfg))
    results.sort(key=lambda r: r.total_profit, reverse=True)
    return results


def walk_forward_split(
    history: list[BetSide], train_ratio: float = 0.7
) -> tuple[list[BetSide], list[BetSide]]:
    if not history:
        return [], []
    cut = max(1, int(len(history) * train_ratio))
    if cut >= len(history):
        cut = len(history) - 1
    return history[:cut], history[cut:]


def recommend_patterns(
    train: list[BetSide],
    test: list[BetSide],
    stakes: list[int],
    *,
    min_bets: int = 30,
    skip_tie: bool = True,
) -> dict:
    """Chon mau co profit duong tren train, xac nhan tren test."""
    singles = compare_single_patterns(train, stakes, skip_tie=skip_tie)
    picks = [r for r in singles if r.bet_count >= min_bets and r.total_profit > 0]
    pick_ids = {r.bets[0].pattern_id for r in picks if r.bets}

    enabled = {pid: pid in pick_ids for pid in all_pattern_ids()}
    if not any(enabled.values()):
        enabled = normalize_pattern_enabled(None)

    combo_cfg = BacktestConfig(
        stakes=stakes,
        skip_tie=skip_tie,
        pattern_enabled=enabled,
        label="combo_train_picks",
    )
    train_combo = run_backtest(train, combo_cfg)
    test_combo = run_backtest(test, combo_cfg)

    all_cfg = BacktestConfig(stakes=stakes, skip_tie=skip_tie, label="all_patterns")
    train_all = run_backtest(train, all_cfg)
    test_all = run_backtest(test, all_cfg)

    return {
        "train_picks": [r.config.label for r in picks],
        "enabled": enabled,
        "train_combo": summarize_result(train_combo),
        "test_combo": summarize_result(test_combo),
        "train_all": summarize_result(train_all),
        "test_all": summarize_result(test_all),
        "single_train": [summarize_result(r) for r in singles],
    }
