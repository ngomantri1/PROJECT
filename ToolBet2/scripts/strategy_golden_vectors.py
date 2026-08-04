"""Evaluate shared deterministic strategy vectors through ToolBet production code."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.capital_managers import create_money_manager
from src.models import BetSide
from src.statistical_strategies import evaluate_statistical_strategy
from src.strategy_tabs import SimulationTabConfig, decision_for_strategy_tab


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests" / "golden_vectors" / "strategy_cases.json"
SIDE_BY_CODE = {"B": BetSide.BANKER, "P": BetSide.PLAYER, "T": BetSide.TIE}
HEURISTIC_IDS = {"smart_prev", "smart_prev_advanced"}
SCHEDULE_IDS = {"time_sliced_hedge", "dual_schedule_hedge"}


def load_cases(path: Path = DEFAULT_CASES) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _decision(strategy_id: str, history: list[BetSide], schedule_index: int):
    if strategy_id in HEURISTIC_IDS:
        return decision_for_strategy_tab(
            SimulationTabConfig(strategy_id=strategy_id),
            history,
            skip_tie=True,
        )
    return evaluate_statistical_strategy(
        strategy_id,
        history,
        schedule_round_index=schedule_index,
    )


def evaluate_cases(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    output: dict[str, list[dict[str, Any]]] = {}
    for case in payload["cases"]:
        strategy_id = case["strategy_id"]
        history = [SIDE_BY_CODE[value] for value in case["history"]]
        manager = create_money_manager(case["manager_id"], case["stakes"])
        schedule_index = int(case.get("schedule_index", 0)) % 10
        rows: list[dict[str, Any]] = []
        for round_index, result_code in enumerate(case["results"], start=1):
            decision = _decision(strategy_id, history, schedule_index)
            if decision.side not in (BetSide.BANKER, BetSide.PLAYER):
                raise AssertionError(f"{case['id']} round {round_index} did not choose B/P")
            update = manager.apply_result(decision.side, SIDE_BY_CODE[result_code])
            snapshot = manager.snapshot()
            rows.append({
                "round": round_index,
                "side": "B" if decision.side == BetSide.BANKER else "P",
                "result": result_code,
                "stake": update.previous_quote.stake,
                "pnl": update.profit,
                "level_index": snapshot.level_index,
                "next_stake": update.next_quote.stake,
                "schedule_index": schedule_index,
            })
            if result_code in "BP":
                history.append(SIDE_BY_CODE[result_code])
            if strategy_id in SCHEDULE_IDS:
                schedule_index = (schedule_index + 1) % 10
        output[case["id"]] = rows
    return output


if __name__ == "__main__":
    print(json.dumps(evaluate_cases(load_cases()), ensure_ascii=False, indent=2))
