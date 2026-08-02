from __future__ import annotations

from dataclasses import dataclass, field
from html import escape
from typing import Any

from sqlalchemy.orm import Session

from src.ae_sexy_betting import validate_progression_stakes
from src.backtest import (
    BacktestConfig,
    BacktestResult,
    compare_single_patterns,
    compare_stake_progressions,
    load_round_results,
    only_pattern_enabled,
    pattern_name_map,
    run_backtest,
    summarize_result,
    walk_forward_split,
)
from src.bet_analytics import pattern_win_rates_by_id
from src.pattern_analyzer import pattern_catalog
from src.patterns_config import all_pattern_ids, normalize_pattern_enabled
from src.stakes_config import format_stakes


STAKE_CANDIDATES = [
    [20],
    [10, 20, 40, 80, 200],
    [20, 40, 80, 200],
    [10, 20, 40, 80, 200, 100, 50, 50],
    [20, 40, 20, 100, 200],
]

MIN_PATTERN_BETS = 25


@dataclass
class ConfigRecommendation:
    patterns: dict[str, bool]
    stakes: list[int]
    stop_loss: float
    take_profit: float
    notes: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "patterns": self.patterns,
            "stakes": self.stakes,
            "stakes_display": format_stakes(self.stakes),
            "stop_loss": self.stop_loss,
            "take_profit": self.take_profit,
            "notes": self.notes,
            "warnings": self.warnings,
            "metrics": self.metrics,
            "html": self.render_html(),
        }

    def render_html(self) -> str:
        names = pattern_name_map()
        lines: list[str] = []
        lines.append('<div class="tb-rec-title">De xuat config (backtest + live)</div>')

        on_names = [names.get(pid, pid) for pid, v in self.patterns.items() if v]
        off_names = [names.get(pid, pid) for pid, v in self.patterns.items() if not v]
        lines.append(f'<div><b>Mau BAT:</b> {escape(", ".join(on_names) or "(khong)")}</div>')
        if off_names:
            lines.append(f'<div><b>Mau TAT:</b> {escape(", ".join(off_names))}</div>')
        lines.append(f'<div><b>Stakes:</b> <code>{escape(format_stakes(self.stakes))}</code></div>')

        m = self.metrics
        if m.get("backtest"):
            b = m["backtest"]
            lines.append(
                f'<div class="tb-rec-metric">Backtest: profit <b>{b.get("profit", 0):+.0f}</b> | '
                f'DD {b.get("max_drawdown", 0):.0f} | {b.get("bets", 0)} cuoc | win {b.get("win_rate", "?")}</div>'
            )
        if m.get("current"):
            c = m["current"]
            lines.append(
                f'<div class="tb-rec-metric">Hien tai: profit <b>{c.get("profit", 0):+.0f}</b> | '
                f'DD {c.get("max_drawdown", 0):.0f}</div>'
            )

        if self.notes:
            lines.append('<div class="tb-rec-notes">')
            for n in self.notes[:8]:
                lines.append(f'<div>• {escape(n)}</div>')
            lines.append("</div>")

        if self.warnings:
            lines.append('<div class="tb-rec-warn">')
            for w in self.warnings[:4]:
                lines.append(f'<div>! {escape(w)}</div>')
            lines.append("</div>")

        lines.append('<div class="tb-rec-hint">Tu chinh va Luu — tool khong tu ap dung.</div>')
        return "".join(lines)


def _stats_by_stake_index(bets) -> list[dict]:
    buckets: dict[int, dict] = {}
    for b in bets:
        idx = b.stake_index
        if idx not in buckets:
            buckets[idx] = {"idx": idx, "stake": b.stake, "n": 0, "w": 0, "l": 0, "pnl": 0.0}
        buckets[idx]["n"] += 1
        buckets[idx]["pnl"] += b.profit
        if b.outcome == "win":
            buckets[idx]["w"] += 1
        elif b.outcome == "loss":
            buckets[idx]["l"] += 1
    rows = []
    for idx in sorted(buckets):
        r = buckets[idx]
        resolved = r["w"] + r["l"]
        r["win_rate"] = r["w"] / resolved * 100 if resolved else None
        rows.append(r)
    return rows


def _score_result(r: BacktestResult) -> float:
    return r.total_profit - 0.25 * r.max_drawdown


def _recommend_patterns(
    singles: list[BacktestResult],
    live_rates: dict[str, dict[str, Any]],
    current: dict[str, bool],
) -> tuple[dict[str, bool], list[str]]:
    names = pattern_name_map()
    notes: list[str] = []
    enabled: dict[str, bool] = {}

    for pid in all_pattern_ids():
        single = next((r for r in singles if r.bets and r.bets[0].pattern_id == pid), None)
        live = live_rates.get(pid, {})
        live_n = int(live.get("total") or 0)
        live_profit = float(live.get("profit") or 0)
        bt_profit = single.total_profit if single else 0
        bt_n = single.bet_count if single else 0

        keep = True
        if bt_n >= MIN_PATTERN_BETS and bt_profit < -50:
            keep = False
            notes.append(f"Tat {names.get(pid, pid)}: backtest {bt_profit:+.0f} ({bt_n} cuoc)")
        elif live_n >= 30 and live_profit < -100 and bt_profit <= 0:
            keep = False
            notes.append(f"Tat {names.get(pid, pid)}: live {live_profit:+.0f} + backtest yeu")
        elif bt_n >= MIN_PATTERN_BETS and bt_profit > 100:
            notes.append(f"Giu {names.get(pid, pid)}: backtest {bt_profit:+.0f}")

        enabled[pid] = keep

    if not any(enabled.values()):
        enabled = normalize_pattern_enabled(None)
        notes.append("Khong mau nao dat nguong — bat lai mac dinh tru Betx2")
        enabled["mau_bet_2"] = False

    if enabled.get("mau_bet_2") and singles:
        bet2 = next((r for r in singles if r.bets and r.bets[0].pattern_id == "mau_bet_2"), None)
        if bet2 and bet2.bet_count >= 20 and bet2.total_profit < 0:
            enabled["mau_bet_2"] = False
            notes.append(f"Tat Betx2: backtest {bet2.total_profit:+.0f}")

    return enabled, notes


def _pick_stakes(
    history: list,
    pattern_enabled: dict[str, bool],
    current_stakes: list[int],
    skip_tie: bool,
    chip_values: list[int] | None,
) -> tuple[list[int], list[str]]:
    notes: list[str] = []
    candidates = [current_stakes] + [s for s in STAKE_CANDIDATES if s != current_stakes]
    valid: list[list[int]] = []
    for stakes in candidates:
        bad = validate_progression_stakes(stakes, chip_values)
        if not bad:
            valid.append(stakes)

    if not valid:
        valid = [current_stakes]

    results = compare_stake_progressions(
        history, valid, pattern_enabled=pattern_enabled, skip_tie=skip_tie
    )
    best = max(results, key=_score_result)
    notes.append(
        f"Stakes {best.config.stakes}: profit {best.total_profit:+.0f}, DD {best.max_drawdown:.0f}"
    )

    step_notes = _stats_by_stake_index(best.bets)
    for row in step_notes:
        if row["n"] < 10:
            continue
        wr = row["win_rate"]
        if wr is not None and wr < 45:
            notes.append(f"Buoc {row['idx']+1} (stake {row['stake']}): win {wr:.0f}% — can giam")
        elif wr is not None and wr >= 58 and row["idx"] >= 3:
            notes.append(f"Buoc {row['idx']+1} (stake {row['stake']}): win {wr:.0f}% — buoc manh")

    return list(best.config.stakes), notes


def generate_config_recommendation(
    session: Session,
    *,
    table_name: str,
    current_patterns: dict[str, bool] | None,
    current_stakes: list[int],
    stop_loss: float = 500.0,
    take_profit: float = 5000.0,
    skip_tie: bool = True,
    chip_values: list[int] | None = None,
) -> ConfigRecommendation:
    history = load_round_results(session, table_name=table_name)
    if len(history) < 80:
        return ConfigRecommendation(
            patterns=normalize_pattern_enabled(current_patterns),
            stakes=list(current_stakes),
            stop_loss=stop_loss,
            take_profit=take_profit,
            warnings=[f"Chua du du lieu: {len(history)} van — can >= 80 van"],
        )

    live_rates = pattern_win_rates_by_id(session)
    current_enabled = normalize_pattern_enabled(current_patterns)

    singles = compare_single_patterns(history, current_stakes, skip_tie=skip_tie)
    patterns, pat_notes = _recommend_patterns(singles, live_rates, current_enabled)
    stakes, stake_notes = _pick_stakes(
        history, patterns, current_stakes, skip_tie, chip_values
    )

    current_result = run_backtest(
        history,
        BacktestConfig(
            stakes=current_stakes,
            skip_tie=skip_tie,
            pattern_enabled=current_enabled,
            label="current",
        ),
    )
    recommended_result = run_backtest(
        history,
        BacktestConfig(
            stakes=stakes,
            skip_tie=skip_tie,
            pattern_enabled=patterns,
            stop_loss=stop_loss,
            take_profit=take_profit,
            label="recommended",
        ),
    )

    train, test = walk_forward_split(history)
    wf_test = run_backtest(
        test,
        BacktestConfig(stakes=stakes, skip_tie=skip_tie, pattern_enabled=patterns, label="wf_test"),
    )

    warnings: list[str] = []
    if wf_test.total_profit < 0:
        warnings.append(f"Walk-forward test (30% cuoi): profit {wf_test.total_profit:+.0f} — co the overfit")
    warnings.append("Backtest da tinh commission banker 5%")

    notes = pat_notes + stake_notes
    if recommended_result.total_profit > current_result.total_profit:
        notes.insert(
            0,
            f"Cai thien backtest: {current_result.total_profit:+.0f} -> {recommended_result.total_profit:+.0f}",
        )

    return ConfigRecommendation(
        patterns=patterns,
        stakes=stakes,
        stop_loss=stop_loss,
        take_profit=take_profit,
        notes=notes,
        warnings=warnings,
        metrics={
            "rounds": len(history),
            "current": summarize_result(current_result),
            "backtest": summarize_result(recommended_result),
            "walk_forward_test": summarize_result(wf_test),
            "pattern_rank": [
                {
                    "name": r.config.label,
                    "profit": round(r.total_profit, 1),
                    "bets": r.bet_count,
                }
                for r in singles[:5]
            ],
        },
    )
