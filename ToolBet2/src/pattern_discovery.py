"""Bao cao mau theo ngay + tim quy tac suffix 'luon thang' tren lich su van trong ngay."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from html import escape
from typing import Any, Callable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.backtest import BacktestConfig, compare_single_patterns, pattern_name_map, run_backtest
from src.bet_analytics import MIN_CONFIDENCE_SAMPLES, PatternStatRow, pattern_stats_daily
from src.database import RoundRecord
from src.models import BetSide, SIDE_LABEL
from src.pattern_analyzer import filter_history
from src.patterns_config import normalize_pattern_enabled


_SIDE_CHAR = {BetSide.BANKER: "B", BetSide.PLAYER: "P"}
_CHAR_SIDE = {"B": BetSide.BANKER, "P": BetSide.PLAYER}


@dataclass
class RuleStats:
    prefix: tuple[BetSide, ...]
    rule_id: str
    rule_label: str
    wins: int = 0
    losses: int = 0
    positions: list[int] = field(default_factory=list)

    @property
    def hits(self) -> int:
        return self.wins + self.losses

    @property
    def win_rate(self) -> float | None:
        if self.hits <= 0:
            return None
        return self.wins / self.hits

    @property
    def is_perfect(self) -> bool:
        return self.hits > 0 and self.losses == 0

    def prefix_text(self) -> str:
        return "".join(_SIDE_CHAR.get(s, "?") for s in self.prefix)

    def prefix_labels(self) -> str:
        return "-".join(SIDE_LABEL.get(s, s.value) for s in self.prefix)


def load_day_round_results(
    session: Session,
    session_date: str,
    *,
    table_name: str | None = None,
) -> list[BetSide]:
    date_col = func.coalesce(RoundRecord.session_date, func.date(RoundRecord.occurred_at))
    stmt = select(RoundRecord).where(date_col == session_date).order_by(RoundRecord.id)
    if table_name:
        stmt = stmt.where(RoundRecord.table_name == table_name)
    out: list[BetSide] = []
    for row in session.scalars(stmt):
        v = (row.result or "").strip().lower()
        if v == "player":
            out.append(BetSide.PLAYER)
        elif v == "banker":
            out.append(BetSide.BANKER)
        elif v == "tie":
            out.append(BetSide.TIE)
    return out


def _opposite(side: BetSide) -> BetSide:
    return BetSide.PLAYER if side == BetSide.BANKER else BetSide.BANKER


def _bet_rules() -> dict[str, tuple[str, Callable[[list[BetSide]], BetSide]]]:
    return {
        "follow": ("Cuoc theo mau cuoi", lambda p: p[-1]),
        "opposite": ("Cuoc nguoc mau cuoi", lambda p: _opposite(p[-1])),
        "player": ("Cuoc Con", lambda _p: BetSide.PLAYER),
        "banker": ("Cuoc Cai", lambda _p: BetSide.BANKER),
    }


def _streak_rules(
    history: list[BetSide],
    *,
    min_streak: int = 2,
    max_streak: int = 5,
) -> list[RuleStats]:
    """Quy tac: sau N van cung mau lien tiep -> cuoc theo mau do."""
    rules: dict[tuple[int, BetSide], RuleStats] = {}
    for streak_len in range(min_streak, max_streak + 1):
        for side in (BetSide.BANKER, BetSide.PLAYER):
            rules[(streak_len, side)] = RuleStats(
                prefix=(),
                rule_id=f"streak_{streak_len}_{_SIDE_CHAR[side]}",
                rule_label=f"Sau {streak_len} {_SIDE_CHAR[side]} lien tiep -> cuoc {_SIDE_CHAR[side]}",
            )

    for i in range(min_streak, len(history)):
        for streak_len in range(min_streak, max_streak + 1):
            if i < streak_len:
                continue
            chunk = history[i - streak_len : i]
            if len(set(chunk)) != 1:
                continue
            side = chunk[0]
            bet = side
            nxt = history[i]
            key = (streak_len, side)
            st = rules[key]
            st.positions.append(i)
            if bet == nxt:
                st.wins += 1
            else:
                st.losses += 1

    return [r for r in rules.values() if r.hits > 0]


def discover_suffix_rules(
    history: list[BetSide],
    *,
    skip_tie: bool = True,
    min_prefix_len: int = 2,
    max_prefix_len: int = 6,
    min_hits: int = 2,
    include_streaks: bool = True,
) -> list[RuleStats]:
    """Tim quy tac dang: sau chuoi PREFIX -> cuoc theo RULE; thong ke W/L trong ngay."""
    h = filter_history(history, skip_tie)
    if len(h) < min_prefix_len + 1:
        return []

    buckets: dict[tuple[tuple[BetSide, ...], str], RuleStats] = {}
    bet_rules = _bet_rules()

    for length in range(min_prefix_len, max_prefix_len + 1):
        for i in range(length, len(h)):
            prefix = tuple(h[i - length : i])
            nxt = h[i]
            for rule_id, (rule_label, pick_side) in bet_rules.items():
                key = (prefix, rule_id)
                if key not in buckets:
                    buckets[key] = RuleStats(
                        prefix=prefix,
                        rule_id=rule_id,
                        rule_label=rule_label,
                    )
                st = buckets[key]
                st.positions.append(i)
                bet = pick_side(list(prefix))
                if bet == nxt:
                    st.wins += 1
                else:
                    st.losses += 1

    found = [s for s in buckets.values() if s.hits >= min_hits]
    if include_streaks:
        found.extend(_streak_rules(h))
    found.sort(key=lambda r: (-int(r.is_perfect), -(r.win_rate or 0), -r.hits, r.prefix_text()))
    return found


def perfect_rules(rules: list[RuleStats]) -> list[RuleStats]:
    return [r for r in rules if r.is_perfect]


def catalog_pattern_report_on_day(
    history: list[BetSide],
    *,
    stakes: list[int] | None = None,
    skip_tie: bool = True,
) -> list[dict[str, Any]]:
    """Backtest tung mau catalog tren lich su van trong ngay."""
    stakes = stakes or [20]
    singles = compare_single_patterns(history, stakes, skip_tie=skip_tie)
    names = pattern_name_map()
    rows: list[dict[str, Any]] = []
    for r in singles:
        pid = r.bets[0].pattern_id if r.bets else ""
        rows.append(
            {
                "pattern_id": pid,
                "pattern_name": names.get(pid, r.config.label),
                "bets": r.bet_count,
                "wins": r.wins,
                "losses": r.losses,
                "pushes": r.pushes,
                "win_rate": r.win_rate,
                "profit": round(r.total_profit, 1),
            }
        )
    rows.sort(key=lambda x: (-(x["win_rate"] or 0), x["pattern_name"]))
    return rows


def live_pattern_report_on_day(rows: list[PatternStatRow]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        resolved = row.wins + row.losses
        out.append(
            {
                "pattern_id": row.pattern_id,
                "pattern_name": row.pattern_name,
                "bets": row.total,
                "wins": row.wins,
                "losses": row.losses,
                "win_rate": row.win_rate,
                "profit": round(row.profit, 1),
                "low_confidence": resolved < MIN_CONFIDENCE_SAMPLES,
            }
        )
    return out


def analyze_day_patterns(
    session: Session,
    *,
    session_date: str,
    table_name: str | None = None,
    stakes: list[int] | None = None,
    skip_tie: bool = True,
    min_rule_hits: int = 2,
) -> dict[str, Any]:
    history = load_day_round_results(session, session_date, table_name=table_name)
    h_no_tie = filter_history(history, skip_tie)
    live_rows = pattern_stats_daily(session, session_date=session_date)

    rules = discover_suffix_rules(
        history,
        skip_tie=skip_tie,
        min_hits=min_rule_hits,
    )
    perfect = perfect_rules(rules)

    combo = run_backtest(
        history,
        BacktestConfig(
            stakes=stakes or [20],
            skip_tie=skip_tie,
            pattern_enabled=normalize_pattern_enabled(None),
            label="combo",
        ),
    )

    warnings: list[str] = []
    if len(h_no_tie) < 30:
        warnings.append(f"Chi {len(h_no_tie)} van (bo hoa) — thong ke ngay chua du tin cay")
    if not perfect:
        warnings.append("Khong tim thay quy tac 100% thang trong ngay (voi nguong hits da dat)")
    else:
        warnings.append(
            "Quy tac 100% chi dung cho NGAY NAY (hindsight) — khong dam bao ngay sau"
        )

    return {
        "session_date": session_date,
        "round_count": len(history),
        "round_count_no_tie": len(h_no_tie),
        "history_preview": " ".join(_SIDE_CHAR.get(s, "T") for s in h_no_tie[-40:]),
        "catalog_backtest": catalog_pattern_report_on_day(history, stakes=stakes, skip_tie=skip_tie),
        "live_bets": live_pattern_report_on_day(live_rows),
        "combo_backtest": {
            "bets": combo.bet_count,
            "wins": combo.wins,
            "losses": combo.losses,
            "win_rate": combo.win_rate,
            "profit": round(combo.total_profit, 1),
        },
        "discovered_rules": rules[:20],
        "perfect_rules": perfect[:15],
        "warnings": warnings,
        "min_rule_hits": min_rule_hits,
    }


def format_rule_line(r: RuleStats) -> str:
    prefix = r.prefix_text() or "(streak)"
    if r.prefix:
        prefix = f"{r.prefix_labels()} [{prefix}]"
    wr = f"{r.win_rate * 100:.0f}%" if r.win_rate is not None else "n/a"
    tag = " PERFECT" if r.is_perfect else ""
    return (
        f"  {prefix} | {r.rule_label} | {r.wins}W/{r.losses}L ({wr}) | "
        f"{r.hits} lan gap{tag}"
    )


def format_daily_pattern_report(data: dict[str, Any]) -> str:
    lines = [
        f"=== BAO CAO MAU THEO NGAY {data['session_date']} ===",
        f"Van: {data['round_count']} (bo hoa: {data['round_count_no_tie']})",
        f"Chuoi gan day: {data.get('history_preview', '')}",
        "",
        "--- MAU CATALOG (backtest tren van trong ngay) ---",
    ]
    for row in data.get("catalog_backtest") or []:
        wr = f"{row['win_rate'] * 100:.0f}%" if row.get("win_rate") is not None else "n/a"
        lines.append(
            f"  {row['pattern_name']:12} {row['wins']}W/{row['losses']}L | "
            f"win={wr} | {row['bets']} cuoc | PnL {row['profit']:+.0f}"
        )

    live = data.get("live_bets") or []
    if live:
        lines.append("")
        lines.append("--- MAU (cuoc that trong ngay) ---")
        for row in live:
            wr = f"{row['win_rate'] * 100:.0f}%" if row.get("win_rate") is not None else "n/a"
            flag = "~" if row.get("low_confidence") else ""
            lines.append(
                f"  {flag}{row['pattern_name']:12} {row['wins']}W/{row['losses']}L | "
                f"win={wr} | PnL {row['profit']:+.0f}"
            )

    cb = data.get("combo_backtest") or {}
    if cb.get("bets"):
        wr = f"{cb['win_rate'] * 100:.0f}%" if cb.get("win_rate") is not None else "n/a"
        lines.append("")
        lines.append(f"--- COMBO tat ca mau bat: {cb['wins']}W/{cb['losses']}L win={wr} PnL {cb['profit']:+.0f} ---")

    perfect = data.get("perfect_rules") or []
    lines.append("")
    if perfect:
        lines.append(f"--- QUY TAC 100% THANG TRONG NGAY (hits >= {data.get('min_rule_hits', 2)}) ---")
        for r in perfect:
            if isinstance(r, RuleStats):
                lines.append(format_rule_line(r))
            else:
                lines.append(f"  {r}")
    else:
        lines.append("--- KHONG CO QUY TAC 100% THANG (voi nguong hits da chon) ---")

    top = data.get("discovered_rules") or []
    non_perfect = [r for r in top if isinstance(r, RuleStats) and not r.is_perfect][:8]
    if non_perfect:
        lines.append("")
        lines.append("--- Quy tac manh nhat (chua 100%) ---")
        for r in non_perfect:
            lines.append(format_rule_line(r))

    for w in data.get("warnings") or []:
        lines.append(f"! {w}")

    lines.append("")
    lines.append(
        "Ghi chu: 'Quy tac 100%' la khai pha hindsight tren 1 ngay — de tham khao, khong phai mau du doan."
    )
    return "\n".join(lines)


def render_daily_pattern_html(data: dict[str, Any]) -> str:
    parts = [
        '<div class="tb-rec-title">Bao cao mau trong ngay</div>',
        f'<div>{data["round_count_no_tie"]} van (bo hoa) | {escape(data.get("history_preview", "")[-60:])}</div>',
    ]
    perfect = data.get("perfect_rules") or []
    if perfect:
        parts.append('<div class="tb-rec-metric"><b>Quy tac 100% thang:</b></div>')
        for r in perfect[:6]:
            if isinstance(r, RuleStats):
                parts.append(
                    f'<div>• [{escape(r.prefix_text() or "streak")}] {escape(r.rule_label)} '
                    f'— {r.hits} lan</div>'
                )
    else:
        parts.append('<div class="tb-rec-metric">Khong co quy tac 100% thang (nguong hits da dat)</div>')

    parts.append('<div class="tb-rec-metric" style="margin-top:6px"><b>Catalog (backtest ngay):</b></div>')
    for row in (data.get("catalog_backtest") or [])[:5]:
        wr = f"{row['win_rate'] * 100:.0f}%" if row.get("win_rate") is not None else "n/a"
        parts.append(
            f'<div>{escape(row["pattern_name"])}: {row["wins"]}W/{row["losses"]}L ({wr}) '
            f'PnL {row["profit"]:+.0f}</div>'
        )

    for w in data.get("warnings") or []:
        parts.append(f'<div class="tb-rec-warn">! {escape(w)}</div>')
    parts.append(
        '<div class="tb-rec-hint">Quy tac tim duoc chi dung cho ngay nay — khong ap dung tu dong.</div>'
    )
    return "".join(parts)
