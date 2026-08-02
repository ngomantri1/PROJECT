from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, sessionmaker

from src.database import BetGroupRecord, BetRecord

MIN_CONFIDENCE_SAMPLES = 30


@dataclass(frozen=True)
class PnlSummary:
    profit: float
    total: int
    wins: int
    losses: int
    pushes: int
    pending: int

    @property
    def resolved(self) -> int:
        return self.wins + self.losses + self.pushes


@dataclass(frozen=True)
class PatternStatRow:
    pattern_id: str
    pattern_name: str
    session_date: str | None
    total: int
    wins: int
    losses: int
    pushes: int
    pending: int
    profit: float

    @property
    def resolved(self) -> int:
        return self.wins + self.losses + self.pushes

    @property
    def win_rate(self) -> float | None:
        if self.resolved <= 0:
            return None
        return self.wins / self.resolved


def _outcome_count(outcome: str):
    return func.sum(case((BetRecord.outcome == outcome, 1), else_=0))


def _pending_count():
    return func.sum(case((BetRecord.outcome.is_(None), 1), else_=0))


def _date_expr():
    return func.coalesce(
        BetRecord.session_date,
        func.date(BetRecord.resolved_at),
        func.date(BetRecord.placed_at),
    )


def pnl_for_period(
    session: Session,
    *,
    start_date: str,
    end_date: str | None = None,
) -> PnlSummary:
    """Tong PnL theo ngay lich (session_date / resolved_at), khong theo phien tool."""
    end_date = end_date or start_date
    date_col = _date_expr()
    stmt = (
        select(
            func.count().label("total"),
            _outcome_count("win").label("wins"),
            _outcome_count("loss").label("losses"),
            _outcome_count("push").label("pushes"),
            _pending_count().label("pending"),
            func.coalesce(
                func.sum(
                    case(
                        (BetRecord.outcome.in_(("win", "loss", "push")), BetRecord.profit),
                        else_=0,
                    )
                ),
                0,
            ).label("profit"),
        )
        .select_from(BetRecord)
        .where(date_col >= start_date)
        .where(date_col <= end_date)
    )
    row = session.execute(stmt).one()
    return PnlSummary(
        profit=float(row.profit or 0),
        total=int(row.total or 0),
        wins=int(row.wins or 0),
        losses=int(row.losses or 0),
        pushes=int(row.pushes or 0),
        pending=int(row.pending or 0),
    )


def pnl_today(session: Session, *, today: str | None = None) -> PnlSummary:
    day = today or date.today().isoformat()
    return pnl_for_period(session, start_date=day, end_date=day)


def pnl_last_days(session: Session, *, today: str | None = None, days: int = 7) -> PnlSummary:
    end = date.fromisoformat(today or date.today().isoformat())
    start = end - timedelta(days=max(1, days) - 1)
    return pnl_for_period(session, start_date=start.isoformat(), end_date=end.isoformat())


def format_pnl_summary_line(summary: PnlSummary, *, label: str) -> str:
    cls = "profit-pos" if summary.profit > 0 else "profit-neg" if summary.profit < 0 else "zero"
    resolved = summary.wins + summary.losses
    return (
        f'<div>{label}: <span class="{cls}">{summary.profit:+.0f}</span> '
        f"<span class=\"tb-pnl-meta\">({resolved} ket qua / {summary.total} cuoc)</span></div>"
    )


def _aggregate_rows(rows: list[PatternStatRow]) -> list[PatternStatRow]:
    return sorted(
        rows,
        key=lambda r: (
            r.session_date or "",
            -(r.win_rate or -1),
            r.pattern_name,
        ),
    )


def _row_from_group(
    pattern_id: str | None,
    pattern_name: str | None,
    session_date: str | None,
    total: int,
    wins: int,
    losses: int,
    pushes: int,
    pending: int,
    profit: float | None,
) -> PatternStatRow:
    return PatternStatRow(
        pattern_id=pattern_id or "",
        pattern_name=pattern_name or pattern_id or "?",
        session_date=session_date,
        total=int(total or 0),
        wins=int(wins or 0),
        losses=int(losses or 0),
        pushes=int(pushes or 0),
        pending=int(pending or 0),
        profit=float(profit or 0),
    )


def pattern_stats_daily(session: Session, *, session_date: str | None = None) -> list[PatternStatRow]:
    date_col = _date_expr().label("day")
    stmt = (
        select(
            BetRecord.pattern_id,
            BetRecord.rule_name,
            date_col,
            func.count().label("total"),
            _outcome_count("win").label("wins"),
            _outcome_count("loss").label("losses"),
            _outcome_count("push").label("pushes"),
            _pending_count().label("pending"),
            func.coalesce(func.sum(BetRecord.profit), 0).label("profit"),
        )
        .where(BetRecord.pattern_id.is_not(None))
        .group_by(BetRecord.pattern_id, BetRecord.rule_name, date_col)
        .order_by(date_col.desc(), BetRecord.rule_name)
    )
    if session_date:
        stmt = stmt.having(date_col == session_date)

    rows: list[PatternStatRow] = []
    for row in session.execute(stmt):
        rows.append(
            _row_from_group(
                row.pattern_id,
                row.rule_name,
                str(row.day) if row.day else None,
                row.total,
                row.wins,
                row.losses,
                row.pushes,
                row.pending,
                row.profit,
            )
        )
    return _aggregate_rows(rows)


def pattern_stats_overall(session: Session) -> list[PatternStatRow]:
    stmt = (
        select(
            BetRecord.pattern_id,
            BetRecord.rule_name,
            func.count().label("total"),
            _outcome_count("win").label("wins"),
            _outcome_count("loss").label("losses"),
            _outcome_count("push").label("pushes"),
            _pending_count().label("pending"),
            func.coalesce(func.sum(BetRecord.profit), 0).label("profit"),
        )
        .where(BetRecord.pattern_id.is_not(None))
        .group_by(BetRecord.pattern_id, BetRecord.rule_name)
        .order_by(BetRecord.rule_name)
    )
    rows: list[PatternStatRow] = []
    for row in session.execute(stmt):
        rows.append(
            _row_from_group(
                row.pattern_id,
                row.rule_name,
                None,
                row.total,
                row.wins,
                row.losses,
                row.pushes,
                row.pending,
                row.profit,
            )
        )
    return sorted(rows, key=lambda r: (-(r.win_rate or -1), r.pattern_name))


def pattern_stats_range(
    session: Session,
    *,
    start_date: str,
    end_date: str,
) -> list[PatternStatRow]:
    """Thong ke mau theo khoang ngay (vd 7 ngay gan nhat)."""
    date_col = _date_expr()
    stmt = (
        select(
            BetRecord.pattern_id,
            BetRecord.rule_name,
            func.count().label("total"),
            _outcome_count("win").label("wins"),
            _outcome_count("loss").label("losses"),
            _outcome_count("push").label("pushes"),
            _pending_count().label("pending"),
            func.coalesce(func.sum(BetRecord.profit), 0).label("profit"),
        )
        .where(BetRecord.pattern_id.is_not(None))
        .where(date_col >= start_date)
        .where(date_col <= end_date)
        .group_by(BetRecord.pattern_id, BetRecord.rule_name)
        .order_by(BetRecord.rule_name)
    )
    rows: list[PatternStatRow] = []
    for row in session.execute(stmt):
        rows.append(
            _row_from_group(
                row.pattern_id,
                row.rule_name,
                None,
                row.total,
                row.wins,
                row.losses,
                row.pushes,
                row.pending,
                row.profit,
            )
        )
    return sorted(rows, key=lambda r: (-(r.win_rate or -1), r.pattern_name))


def format_win_rate_display(row: PatternStatRow, *, low_confidence: bool = False) -> str:
    resolved = row.wins + row.losses
    if resolved <= 0:
        return "—"
    pct = row.wins / resolved * 100
    suffix = f" ({row.total})"
    if low_confidence or resolved < MIN_CONFIDENCE_SAMPLES:
        return f"~{pct:.0f}%{suffix}"
    return f"{pct:.0f}%{suffix}"


def _row_to_rate_dict(row: PatternStatRow) -> dict[str, Any]:
    resolved = row.wins + row.losses
    rate = (row.wins / resolved) if resolved > 0 else None
    low = resolved < MIN_CONFIDENCE_SAMPLES
    profit = float(row.profit)
    return {
        "display": format_win_rate_display(row, low_confidence=low),
        "pnl_display": format_pnl_display(row),
        "win_rate": rate,
        "profit": profit,
        "total": row.total,
        "resolved": resolved,
        "wins": row.wins,
        "losses": row.losses,
        "low_confidence": low,
    }


def pattern_win_rates_by_id(
    session: Session,
    *,
    session_date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, dict[str, Any]]:
    """Thong ke theo pattern_id — hom nay, khoang ngay, hoac tat ca lich su."""
    if session_date:
        rows = pattern_stats_daily(session, session_date=session_date)
    elif start_date and end_date:
        rows = pattern_stats_range(session, start_date=start_date, end_date=end_date)
    else:
        rows = pattern_stats_overall(session)
    return {row.pattern_id: _row_to_rate_dict(row) for row in rows}


@dataclass(frozen=True)
class StakeIndexStatRow:
    stake_index: int
    total: int
    wins: int
    losses: int
    pushes: int
    profit: float

    @property
    def resolved(self) -> int:
        return self.wins + self.losses

    @property
    def win_rate(self) -> float | None:
        if self.resolved <= 0:
            return None
        return self.wins / self.resolved


def stake_index_stats_daily(session: Session, *, session_date: str) -> dict[int, StakeIndexStatRow]:
    """Thong ke W/L theo stake_index trong mot ngay."""
    date_col = _date_expr().label("day")
    stmt = (
        select(
            BetRecord.stake_index,
            func.count().label("total"),
            _outcome_count("win").label("wins"),
            _outcome_count("loss").label("losses"),
            _outcome_count("push").label("pushes"),
            func.coalesce(func.sum(BetRecord.profit), 0).label("profit"),
        )
        .where(BetRecord.outcome.is_not(None))
        .where(BetRecord.outcome.in_(("win", "loss", "push")))
        .group_by(BetRecord.stake_index, date_col)
        .having(date_col == session_date)
    )
    out: dict[int, StakeIndexStatRow] = {}
    for row in session.execute(stmt):
        idx = int(row.stake_index or 0)
        out[idx] = StakeIndexStatRow(
            stake_index=idx,
            total=int(row.total or 0),
            wins=int(row.wins or 0),
            losses=int(row.losses or 0),
            pushes=int(row.pushes or 0),
            profit=float(row.profit or 0),
        )
    return out


MIN_STAKE_STEP_SAMPLES = 3


def stake_steps_for_overlay(
    stakes: list[int],
    by_index: dict[int, StakeIndexStatRow],
) -> list[dict[str, Any]]:
    """Gan thong ke tung buoc progression cho overlay (hom nay)."""
    steps: list[dict[str, Any]] = []
    for i, stake in enumerate(stakes):
        row = by_index.get(i)
        if not row or row.resolved <= 0:
            steps.append(
                {
                    "index": i,
                    "step": i + 1,
                    "stake": stake,
                    "display": "—",
                    "win_rate": None,
                    "wins": 0,
                    "losses": 0,
                    "total": 0,
                    "profit": 0,
                    "low_confidence": True,
                }
            )
            continue
        rate = row.win_rate
        low = row.resolved < MIN_STAKE_STEP_SAMPLES
        pct = f"{rate * 100:.0f}%" if rate is not None else "—"
        if low and rate is not None:
            pct = f"~{pct}"
        steps.append(
            {
                "index": i,
                "step": i + 1,
                "stake": stake,
                "display": pct,
                "win_rate": rate,
                "wins": row.wins,
                "losses": row.losses,
                "total": row.total,
                "profit": round(row.profit, 1),
                "low_confidence": low,
                "detail": f"{row.wins}W/{row.losses}L",
            }
        )
    return steps


def pattern_win_rates_today_and_overall(
    session: Session,
    today: str,
) -> dict[str, dict[str, Any]]:
    """Tra ve ca hom nay va tat ca cho overlay toggle."""
    today_map = pattern_win_rates_by_id(session, session_date=today)
    overall_map = pattern_win_rates_by_id(session)
    all_ids = set(today_map) | set(overall_map)
    out: dict[str, dict[str, Any]] = {}
    for pid in all_ids:
        out[pid] = {
            "today": today_map.get(pid),
            "overall": overall_map.get(pid),
        }
    return out


def format_pnl_display(row: PatternStatRow) -> str:
    if row.total <= 0:
        return "—"
    profit = int(round(row.profit))
    if profit > 0:
        return f"+{profit}"
    if profit < 0:
        return str(profit)
    return "0"


def list_bets(
    session: Session,
    *,
    limit: int = 200,
    session_date: str | None = None,
) -> list[dict[str, Any]]:
    stmt = select(BetRecord).order_by(BetRecord.id.desc()).limit(limit)
    if session_date:
        stmt = stmt.where(BetRecord.session_date == session_date)
    bets = session.scalars(stmt).all()
    return [_bet_to_dict(b) for b in reversed(bets)]


def _bet_to_dict(bet: BetRecord) -> dict[str, Any]:
    return {
        "id": bet.id,
        "round_id": bet.round_id,
        "hall_id": bet.hall_id,
        "hall_name": bet.hall_name,
        "table_name": bet.table_name,
        "pattern_id": bet.pattern_id,
        "pattern_name": bet.rule_name,
        "reason": bet.reason,
        "side": bet.side,
        "stake": bet.stake,
        "stake_index": bet.stake_index,
        "outcome": bet.outcome,
        "profit": bet.profit,
        "status": bet.status,
        "game_shoe": bet.game_shoe,
        "game_round": bet.game_round,
        "target_round_index": bet.target_round_index,
        "session_date": bet.session_date,
        "group_id": bet.group_id,
        "group_pnl_after": bet.group_pnl_after,
        "placed_at": bet.placed_at.isoformat(sep=" ") if bet.placed_at else None,
        "resolved_at": bet.resolved_at.isoformat(sep=" ") if bet.resolved_at else None,
    }


def format_pattern_stat_row(row: PatternStatRow) -> str:
    day = row.session_date or "TAT CA"
    rate = f"{row.win_rate * 100:.1f}%" if row.win_rate is not None else "n/a"
    return (
        f"{day} | {row.pattern_name} ({row.pattern_id}) | "
        f"{row.wins}W/{row.losses}L/{row.pushes}P/{row.pending}? | "
        f"win={rate} | profit={row.profit:+.0f} | n={row.total}"
    )


def run_pattern_stats_report(session_factory: sessionmaker, *, session_date: str | None = None) -> str:
    session = session_factory()
    try:
        lines = ["=== TY LE THANG THEO MAU (TAT CA) ==="]
        for row in pattern_stats_overall(session):
            lines.append(format_pattern_stat_row(row))
        lines.append("")
        lines.append("=== TY LE THANG THEO MAU (THEO NGAY) ===")
        for row in pattern_stats_daily(session, session_date=session_date):
            lines.append(format_pattern_stat_row(row))
        return "\n".join(lines)
    finally:
        session.close()


@dataclass(frozen=True)
class GroupStatRow:
    group_id: int
    seq_no: int
    session_date: str | None
    hall_id: str | None
    hall_name: str | None
    table_name: str | None
    status: str
    close_reason: str | None
    bet_count: int
    wins: int
    losses: int
    pushes: int
    pnl: float
    max_stake_index: int
    max_loss_count: int
    opened_at: str | None
    closed_at: str | None


def list_bet_groups(
    session: Session,
    *,
    session_date: str | None = None,
    hall_id: str | None = None,
    table_name: str | None = None,
    limit: int = 200,
) -> list[GroupStatRow]:
    """Lich su nhom — loc theo ngay / sanh / ban giong list_bets."""
    stmt = select(BetGroupRecord).order_by(BetGroupRecord.id.desc()).limit(limit)
    if session_date:
        stmt = stmt.where(BetGroupRecord.session_date == session_date)
    if hall_id:
        stmt = stmt.where(BetGroupRecord.hall_id == hall_id)
    if table_name:
        stmt = stmt.where(BetGroupRecord.table_name == table_name)
    rows = session.scalars(stmt).all()
    out: list[GroupStatRow] = []
    for g in reversed(rows):
        out.append(
            GroupStatRow(
                group_id=g.id,
                seq_no=g.seq_no,
                session_date=g.session_date,
                hall_id=g.hall_id,
                hall_name=g.hall_name,
                table_name=g.table_name,
                status=g.status,
                close_reason=g.close_reason,
                bet_count=int(g.bet_count or 0),
                wins=int(g.wins or 0),
                losses=int(g.losses or 0),
                pushes=int(g.pushes or 0),
                pnl=float(g.pnl or 0),
                max_stake_index=int(g.max_stake_index or 0),
                max_loss_count=int(g.max_loss_count or 0),
                opened_at=g.opened_at.isoformat(sep=" ") if g.opened_at else None,
                closed_at=g.closed_at.isoformat(sep=" ") if g.closed_at else None,
            )
        )
    return out


def group_stats_daily_summary(
    session: Session,
    *,
    session_date: str,
    hall_id: str | None = None,
    table_name: str | None = None,
) -> dict[str, Any]:
    """Tong hop cuoi ngay: so nhom, PnL tung nhom, TP/SL."""
    groups = list_bet_groups(
        session,
        session_date=session_date,
        hall_id=hall_id,
        table_name=table_name,
        limit=500,
    )
    closed = [g for g in groups if g.status != "open"]
    open_groups = [g for g in groups if g.status == "open"]
    tp = sum(1 for g in closed if g.status == "take_profit")
    sl = sum(1 for g in closed if g.status == "stop_loss")
    total_pnl = sum(g.pnl for g in groups)
    return {
        "session_date": session_date,
        "total_groups": len(groups),
        "closed": len(closed),
        "open": len(open_groups),
        "take_profit": tp,
        "stop_loss": sl,
        "total_pnl": total_pnl,
        "groups": groups,
    }


def format_group_daily_report(data: dict[str, Any]) -> str:
    day = data.get("session_date", "?")
    lines = [
        f"=== NHOM CUOC NGAY {day} ===",
        (
            f"Tong: {data.get('total_groups', 0)} nhom | "
            f"dong: {data.get('closed', 0)} "
            f"(TP {data.get('take_profit', 0)} / SL {data.get('stop_loss', 0)}) | "
            f"dang mo: {data.get('open', 0)} | "
            f"PnL: {float(data.get('total_pnl', 0)):+.0f}"
        ),
    ]
    for g in data.get("groups") or []:
        lines.append(
            f"  #{g.seq_no} id={g.group_id} | {g.hall_name or g.hall_id or '?'} / "
            f"{g.table_name or '?'} | {g.status} | "
            f"{g.wins}W/{g.losses}L/{g.pushes}P n={g.bet_count} | "
            f"PnL {g.pnl:+.0f}"
        )
    if not data.get("groups"):
        lines.append("(khong co nhom)")
    return "\n".join(lines)
