"""Phan tich counterfactual: neu doi chuoi stake thi PnL ngay hom do thay doi the nao."""

from __future__ import annotations

from dataclasses import dataclass, field
from html import escape
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.ae_sexy_betting import validate_progression_stakes
from src.backtest import BacktestConfig, load_round_results, run_backtest
from src.database import BetRecord
from src.models import BetSide
from src.progression import BANKER_COMMISSION, StakeProgression, win_profit


def _parse_side(value: str | None) -> BetSide | None:
    v = (value or "").strip().lower()
    if v == "player":
        return BetSide.PLAYER
    if v == "banker":
        return BetSide.BANKER
    if v == "tie":
        return BetSide.TIE
    return None


def _parse_result_from_outcome(outcome: str | None, side: BetSide) -> BetSide | None:
    o = (outcome or "").strip().lower()
    if o == "push":
        return BetSide.TIE
    if o == "win":
        return side
    if o == "loss":
        return BetSide.PLAYER if side == BetSide.BANKER else BetSide.BANKER
    return None


@dataclass(frozen=True)
class ReplayBet:
    id: int
    pattern_id: str
    pattern_name: str
    side: BetSide
    outcome: str
    result: BetSide
    stake_index: int
    stake: int
    profit: float
    placed_at: str | None
    session_date: str | None


@dataclass
class ReplayStep:
    bet_id: int
    pattern_id: str
    stake_index: int
    stake: int
    outcome: str
    profit: float
    cumulative: float


@dataclass
class ReplayResult:
    stakes: list[int]
    steps: list[ReplayStep] = field(default_factory=list)
    total_profit: float = 0.0
    wins: int = 0
    losses: int = 0
    pushes: int = 0

    @property
    def bet_count(self) -> int:
        return len(self.steps)


def load_resolved_bets(
    session: Session,
    *,
    session_date: str | None = None,
    table_name: str | None = None,
) -> list[ReplayBet]:
    stmt = (
        select(BetRecord)
        .where(BetRecord.outcome.is_not(None))
        .where(BetRecord.outcome.in_(("win", "loss", "push")))
        .order_by(BetRecord.placed_at, BetRecord.id)
    )
    if session_date:
        stmt = stmt.where(BetRecord.session_date == session_date)
    if table_name:
        stmt = stmt.where(BetRecord.table_name == table_name)

    out: list[ReplayBet] = []
    for row in session.scalars(stmt):
        side = _parse_side(row.side)
        if side is None:
            continue
        result = _parse_result_from_outcome(row.outcome, side)
        if result is None:
            continue
        out.append(
            ReplayBet(
                id=int(row.id),
                pattern_id=row.pattern_id or "",
                pattern_name=row.rule_name or row.pattern_id or "?",
                side=side,
                outcome=row.outcome or "",
                result=result,
                stake_index=int(row.stake_index or 0),
                stake=int(round(row.stake or 0)),
                profit=float(row.profit or 0),
                placed_at=row.placed_at.isoformat(sep=" ") if row.placed_at else None,
                session_date=row.session_date,
            )
        )
    return out


def replay_bets_with_stakes(
    bets: list[ReplayBet],
    stakes: list[int],
    *,
    banker_commission: float = BANKER_COMMISSION,
) -> ReplayResult:
    """Giu nguyen thu tu va ket qua cuoc; chi doi gia tri stake progression."""
    if not stakes:
        raise ValueError("stakes khong duoc rong")

    prog = StakeProgression(stakes, banker_commission=banker_commission)
    result = ReplayResult(stakes=list(stakes))
    cumulative = 0.0

    for bet in bets:
        stake_index = prog.index
        stake = prog.current_stake
        outcome = prog.resolve_outcome(bet.side, bet.result)
        if outcome == "win":
            profit = win_profit(stake, bet.side, commission=banker_commission)
            prog.on_win()
        elif outcome == "loss":
            profit = -float(stake)
            prog.on_loss()
        else:
            profit = 0.0
            prog.on_push()

        cumulative += profit
        result.steps.append(
            ReplayStep(
                bet_id=bet.id,
                pattern_id=bet.pattern_id,
                stake_index=stake_index,
                stake=stake,
                outcome=outcome,
                profit=profit,
                cumulative=cumulative,
            )
        )
        if outcome == "win":
            result.wins += 1
        elif outcome == "loss":
            result.losses += 1
        else:
            result.pushes += 1

    result.total_profit = cumulative
    return result


def stats_by_stake_index(steps: list[ReplayStep]) -> list[dict[str, Any]]:
    buckets: dict[int, dict[str, Any]] = {}
    for s in steps:
        idx = s.stake_index
        if idx not in buckets:
            buckets[idx] = {"stake_index": idx, "stake": s.stake, "n": 0, "w": 0, "l": 0, "pnl": 0.0}
        buckets[idx]["n"] += 1
        buckets[idx]["pnl"] += s.profit
        if s.outcome == "win":
            buckets[idx]["w"] += 1
        elif s.outcome == "loss":
            buckets[idx]["l"] += 1
    rows = []
    for idx in sorted(buckets):
        r = buckets[idx]
        resolved = r["w"] + r["l"]
        r["win_rate"] = r["w"] / resolved * 100 if resolved else None
        rows.append(r)
    return rows


def optimize_stakes_greedy(
    bets: list[ReplayBet],
    base_stakes: list[int],
    *,
    multipliers: list[float] | None = None,
    banker_commission: float = BANKER_COMMISSION,
    chip_values: list[int] | None = None,
) -> tuple[list[int], ReplayResult]:
    """Toi uu tung vi tri stake theo replay cuoc thuc te trong ngay."""
    multipliers = multipliers or [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
    best = list(base_stakes)
    best_result = replay_bets_with_stakes(bets, best, banker_commission=banker_commission)

    for i in range(len(base_stakes)):
        local_best = best_result.total_profit
        local_stakes = list(best)
        for m in multipliers:
            trial = list(best)
            trial[i] = max(10, int(round(base_stakes[i] * m / 10) * 10))
            if trial[i] == best[i]:
                continue
            if chip_values and validate_progression_stakes(trial, chip_values):
                continue
            r = replay_bets_with_stakes(bets, trial, banker_commission=banker_commission)
            if r.total_profit > local_best:
                local_best = r.total_profit
                local_stakes = trial
                best_result = r
        best = local_stakes

    return best, best_result


def analyze_daily_stakes(
    session: Session,
    *,
    session_date: str,
    current_stakes: list[int],
    table_name: str | None = None,
    chip_values: list[int] | None = None,
    banker_commission: float = BANKER_COMMISSION,
) -> dict[str, Any]:
    """Phan tich cuoi ngay: PnL thuc te vs neu doi progression."""
    bets = load_resolved_bets(session, session_date=session_date, table_name=table_name)
    actual_profit = sum(b.profit for b in bets)

    warnings: list[str] = []
    notes: list[str] = []
    if len(bets) < 5:
        warnings.append(f"Mau nho: chi {len(bets)} cuoc — goi y stake khong dang tin cay")

    current_replay = replay_bets_with_stakes(
        bets, current_stakes, banker_commission=banker_commission
    )
    opt_stakes, opt_replay = optimize_stakes_greedy(
        bets,
        current_stakes,
        banker_commission=banker_commission,
        chip_values=chip_values,
    )

    step_stats = stats_by_stake_index(current_replay.steps)
    for row in step_stats:
        if row["n"] < 3:
            continue
        wr = row["win_rate"]
        if wr is not None and wr < 45:
            notes.append(f"Buoc {row['stake_index'] + 1}: win {wr:.0f}% — nen giam stake")
        elif wr is not None and wr >= 55:
            notes.append(f"Buoc {row['stake_index'] + 1}: win {wr:.0f}% — co the tang stake")

    backtest_gap: dict[str, Any] | None = None
    if table_name:
        history = load_round_results(session, table_name=table_name)
        if len(history) >= 50:
            bt = run_backtest(
                history,
                BacktestConfig(stakes=current_stakes, label="day_backtest"),
            )
            backtest_gap = {
                "backtest_profit": round(bt.total_profit, 1),
                "live_profit": round(actual_profit, 1),
                "gap": round(actual_profit - bt.total_profit, 1),
                "backtest_bets": bt.bet_count,
                "live_bets": len(bets),
            }
            if abs(backtest_gap["gap"]) > 200:
                warnings.append(
                    f"Live vs backtest chenh {backtest_gap['gap']:+.0f} — kiem tra tin hieu / thoi diem cuoc"
                )

    return {
        "session_date": session_date,
        "bet_count": len(bets),
        "actual_profit": round(actual_profit, 1),
        "current_stakes": current_stakes,
        "replay_current": {
            "profit": round(current_replay.total_profit, 1),
            "wins": current_replay.wins,
            "losses": current_replay.losses,
            "steps_by_index": step_stats,
        },
        "recommended_stakes": opt_stakes,
        "replay_optimized": {
            "profit": round(opt_replay.total_profit, 1),
            "wins": opt_replay.wins,
            "losses": opt_replay.losses,
            "delta": round(opt_replay.total_profit - current_replay.total_profit, 1),
        },
        "notes": notes,
        "warnings": warnings,
        "backtest_gap": backtest_gap,
        "banker_commission": banker_commission,
    }


def format_daily_stake_report(data: dict[str, Any]) -> str:
    lines = [
        f"=== PHAN TICH CHUOI CUOC — {data['session_date']} ===",
        f"Cuoc: {data['bet_count']} | PnL thuc te (DB): {data['actual_profit']:+.0f}",
        f"Commission banker: {data.get('banker_commission', 0.05) * 100:.0f}%",
        "",
        f"Chuoi hien tai: {data['current_stakes']}",
        f"Replay voi chuoi hien tai: {data['replay_current']['profit']:+.0f} "
        f"({data['replay_current']['wins']}W/{data['replay_current']['losses']}L)",
        "",
        f"Chuoi de xuat (counterfactual): {data['recommended_stakes']}",
        f"Replay toi uu: {data['replay_optimized']['profit']:+.0f} "
        f"(chenh {data['replay_optimized']['delta']:+.0f} so voi chuoi hien tai)",
    ]

    steps = data["replay_current"].get("steps_by_index") or []
    if steps:
        lines.append("")
        lines.append("Win% / PnL theo buoc (replay ngay):")
        for r in steps:
            wr = f"{r['win_rate']:.0f}%" if r.get("win_rate") is not None else "n/a"
            lines.append(
                f"  Buoc {r['stake_index'] + 1} stake={r['stake']} n={r['n']} win={wr} pnl={r['pnl']:+.0f}"
            )

    gap = data.get("backtest_gap")
    if gap:
        lines.append("")
        lines.append(
            f"Live vs backtest (toan lich su ban): live {gap['live_profit']:+.0f} | "
            f"backtest {gap['backtest_profit']:+.0f} | chenh {gap['gap']:+.0f}"
        )

    for n in data.get("notes") or []:
        lines.append(f"• {n}")
    for w in data.get("warnings") or []:
        lines.append(f"! {w}")

    lines.append("")
    lines.append(
        "Luu y: toi uu dua tren CUNG danh sach cuoc trong ngay — khong them/bot tin hieu. "
        "Mau nho de overfit; dung de dieu chinh progression, khong dam bao lai mai."
    )
    return "\n".join(lines)


def render_daily_stake_html(data: dict[str, Any]) -> str:
    lines = [
        '<div class="tb-rec-title">Phan tich chuoi cuoc hom nay</div>',
        f'<div>Cuoc: <b>{data["bet_count"]}</b> | PnL thuc te: <b>{data["actual_profit"]:+.0f}</b></div>',
        f'<div class="tb-rec-metric">Chuoi hien tai: <code>{escape(str(data["current_stakes"]))}</code></div>',
        f'<div class="tb-rec-metric">Replay hien tai: <b>{data["replay_current"]["profit"]:+.0f}</b></div>',
        f'<div class="tb-rec-metric">Chuoi de xuat: <code>{escape(str(data["recommended_stakes"]))}</code></div>',
        f'<div class="tb-rec-metric">Replay toi uu: <b>{data["replay_optimized"]["profit"]:+.0f}</b> '
        f'(chenh {data["replay_optimized"]["delta"]:+.0f})</div>',
    ]
    for n in data.get("notes") or []:
        lines.append(f'<div>• {escape(n)}</div>')
    for w in data.get("warnings") or []:
        lines.append(f'<div class="tb-rec-warn">! {escape(w)}</div>')
    lines.append(
        '<div class="tb-rec-hint">Counterfactual: cung danh sach cuoc, khong them/bot tin hieu. '
        'Tu chinh config neu muon ap dung.</div>'
    )
    return "".join(lines)
