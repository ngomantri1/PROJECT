"""Read-only evidence for a controlled stake-zero pilot window."""

from __future__ import annotations

import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class StakeZeroEvidence:
    after_bet_id: int
    newest_bet_id: int
    bets: int
    allocations: int
    resolved_bets: int
    virtual_bets: int
    passed: bool
    errors: tuple[str, ...]
    created_at_utc: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def latest_bet_id(database: str | Path) -> int:
    path = Path(database).resolve()
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        row = connection.execute("SELECT COALESCE(MAX(id), 0) FROM bets").fetchone()
        return int(row[0] or 0)
    finally:
        connection.close()


def inspect_stake_zero_window(
    database: str | Path, *, after_bet_id: int
) -> StakeZeroEvidence:
    """Prove that every new durable bet/allocation was virtual and resolved."""

    path = Path(database).resolve()
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        connection.row_factory = sqlite3.Row
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(bets)")
        }
        errors: list[str] = []
        if "execution_mode" not in columns:
            errors.append("Schema thiếu bets.execution_mode")
            bets: list[sqlite3.Row] = []
        else:
            bets = list(
                connection.execute(
                    "SELECT id, stake, outcome, status, execution_mode "
                    "FROM bets WHERE id > ? ORDER BY id",
                    (max(0, int(after_bet_id)),),
                )
            )
        if not bets:
            errors.append("Không có bet mới trong cửa sổ stake-zero")

        virtual_bets = 0
        resolved_bets = 0
        for bet in bets:
            bet_id = int(bet["id"])
            if str(bet["execution_mode"] or "") != "virtual":
                errors.append(f"Bet #{bet_id} không phải execution_mode=virtual")
            else:
                virtual_bets += 1
            if float(bet["stake"] or 0) != 0:
                errors.append(f"Bet #{bet_id} có stake khác 0")
            if bet["outcome"] is None or str(bet["status"] or "") != "resolved":
                errors.append(f"Bet #{bet_id} chưa resolve hoàn chỉnh")
            else:
                resolved_bets += 1

        table_names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        allocations: list[sqlite3.Row] = []
        if bets and "bet_allocations" in table_names:
            placeholders = ",".join("?" for _ in bets)
            allocations = list(
                connection.execute(
                    "SELECT bet_id, tab_id, stake, placement_status "
                    f"FROM bet_allocations WHERE bet_id IN ({placeholders})",
                    tuple(int(bet["id"]) for bet in bets),
                )
            )
        for allocation in allocations:
            if float(allocation["stake"] or 0) != 0:
                errors.append(
                    f"Allocation {allocation['tab_id']} của bet "
                    f"#{allocation['bet_id']} có stake khác 0"
                )
            if str(allocation["placement_status"] or "") != "virtual":
                errors.append(
                    f"Allocation {allocation['tab_id']} của bet "
                    f"#{allocation['bet_id']} không phải virtual"
                )

        newest = max((int(bet["id"]) for bet in bets), default=int(after_bet_id))
        return StakeZeroEvidence(
            after_bet_id=max(0, int(after_bet_id)),
            newest_bet_id=newest,
            bets=len(bets),
            allocations=len(allocations),
            resolved_bets=resolved_bets,
            virtual_bets=virtual_bets,
            passed=not errors,
            errors=tuple(errors),
            created_at_utc=datetime.now(timezone.utc).isoformat(),
        )
    finally:
        connection.close()
