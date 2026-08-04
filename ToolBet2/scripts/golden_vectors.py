"""Shared golden-vector evaluator using ToolBet's real money-manager code."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.capital_managers import create_money_manager
from src.models import BetSide


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests" / "golden_vectors" / "cases.json"
SIDE_BY_CODE = {"B": BetSide.BANKER, "P": BetSide.PLAYER, "T": BetSide.TIE}


def load_cases(path: Path = DEFAULT_CASES) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def evaluate_cases(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {}
    for case in payload["cases"]:
        manager = create_money_manager(
            case["manager_id"],
            case["stakes"],
            stake_chains=case.get("stake_chains"),
        )
        rows: list[dict[str, Any]] = []
        for index, (side, outcome) in enumerate(case["rounds"], start=1):
            update = manager.apply_result(SIDE_BY_CODE[side], SIDE_BY_CODE[outcome])
            snapshot = manager.snapshot()
            rows.append(
                {
                    "round": index,
                    "side": side,
                    "result": outcome,
                    "stake": update.previous_quote.stake,
                    "pnl": update.profit,
                    "session_pnl": snapshot.session_pnl,
                    "level_index": snapshot.level_index,
                    "chain_index": snapshot.chain_index,
                    "next_stake": update.next_quote.stake,
                }
            )
        result[case["id"]] = rows
    return result


if __name__ == "__main__":
    print(json.dumps(evaluate_cases(load_cases()), ensure_ascii=False, indent=2))
