"""Explicit, audited reconciliation for durable pending bets.

This module never guesses whether an ambiguous click was accepted. It only
resolves a bet already confirmed as placed and requires operator-supplied
trusted-result evidence.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, text

from src.database import (
    BetAllocationRecord,
    BetGroupRecord,
    BetRecord,
    EventRecord,
)


RECONCILIATION_ACK = "I VERIFIED TRUSTED ROUND RESULT"
VALID_RESULTS = frozenset({"player", "banker", "tie"})
CONFIRMED_ALLOCATION_STATUSES = frozenset({"placed", "virtual"})


class ReconciliationError(ValueError):
    pass


@dataclass(frozen=True)
class ReconciliationResult:
    bet_id: int
    round_id: str
    result: str
    outcome: str
    profit: float
    event_id: int


def list_pending_bets(database: str | Path) -> list[tuple]:
    path = Path(database).resolve()
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        return list(
            connection.execute(
                "SELECT id, round_id, table_name, side, stake, pattern_id, status "
                "FROM bets WHERE outcome IS NULL ORDER BY created_at, id"
            )
        )
    finally:
        connection.close()


def backup_database(database: str | Path) -> Path:
    path = Path(database).resolve()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = path.parent / "backups" / f"{path.stem}-pre-reconcile-{stamp}.db"
    target.parent.mkdir(parents=True, exist_ok=True)
    source_conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    target_conn = sqlite3.connect(target)
    try:
        source_conn.backup(target_conn)
        check = target_conn.execute("PRAGMA quick_check").fetchone()
        if not check or check[0] != "ok":
            raise RuntimeError("backup quick_check failed")
    finally:
        target_conn.close()
        source_conn.close()
    return target


def _side_result(side: str, stake: float, result: str) -> tuple[str, float]:
    if side not in {"player", "banker"}:
        raise ReconciliationError(
            f"Không hỗ trợ tự tính payout cho cửa {side!r}; cần workflow riêng"
        )
    if result == "tie":
        return "push", 0.0
    if result == side:
        return "win", stake * (0.95 if side == "banker" else 1.0)
    return "loss", -stake


def _refresh_group(session, group_id: int | None) -> None:
    if not group_id:
        return
    group = session.get(BetGroupRecord, group_id)
    if group is None:
        return
    bets = list(
        session.scalars(
            select(BetRecord)
            .where(
                BetRecord.group_id == group_id,
                BetRecord.outcome.in_(("win", "loss", "push")),
            )
            .order_by(BetRecord.id)
        )
    )
    group.bet_count = len(bets)
    group.wins = sum(b.outcome == "win" for b in bets)
    group.losses = sum(b.outcome == "loss" for b in bets)
    group.pushes = sum(b.outcome == "push" for b in bets)
    group.pnl = float(sum(float(b.profit or 0) for b in bets))
    group.max_stake_index = max((int(b.stake_index or 0) for b in bets), default=0)
    loss_run = 0
    max_loss_run = 0
    for bet in bets:
        if bet.outcome == "loss":
            loss_run += 1
            max_loss_run = max(max_loss_run, loss_run)
        elif bet.outcome == "win":
            loss_run = 0
    group.max_loss_count = max_loss_run


def reconcile_pending_bet(
    session_factory,
    *,
    bet_id: int,
    expected_round_id: str,
    result: str,
    evidence: str,
    acknowledgement: str,
) -> ReconciliationResult:
    """Resolve one confirmed placement in a single audited DB transaction."""

    normalized_result = result.strip().lower()
    evidence = evidence.strip()
    if acknowledgement != RECONCILIATION_ACK:
        raise ReconciliationError("Thiếu câu xác nhận đối chiếu chính xác")
    if normalized_result not in VALID_RESULTS:
        raise ReconciliationError("Kết quả phải là player, banker hoặc tie")
    if len(evidence) < 8:
        raise ReconciliationError("Evidence phải mô tả nguồn kết quả tin cậy")
    if not expected_round_id.strip():
        raise ReconciliationError("Phải nhập expected round_id")

    session = session_factory()
    try:
        session.execute(text("BEGIN IMMEDIATE"))
        bet = session.get(BetRecord, int(bet_id))
        if bet is None:
            raise ReconciliationError(f"Không có bet #{bet_id}")
        if bet.round_id != expected_round_id:
            raise ReconciliationError("round_id không khớp; từ chối ghi")
        if bet.outcome is not None:
            raise ReconciliationError(f"Bet #{bet_id} đã có outcome")
        if bet.status != "placed":
            raise ReconciliationError(
                f"Bet #{bet_id} có status={bet.status!r}; "
                "phải xác minh placement trước khi đối chiếu kết quả"
            )

        allocations = list(
            session.scalars(
                select(BetAllocationRecord)
                .where(BetAllocationRecord.bet_id == bet.id)
                .order_by(BetAllocationRecord.id)
            )
        )
        allocation_payload: list[dict] = []
        if bet.pattern_id == "multi_live":
            if not allocations:
                raise ReconciliationError("Aggregate bet thiếu allocation journal")
            invalid = [
                row.tab_id
                for row in allocations
                if row.placement_status not in CONFIRMED_ALLOCATION_STATUSES
            ]
            if invalid:
                raise ReconciliationError(
                    "Aggregate còn allocation chưa xác nhận placement: "
                    + ", ".join(invalid)
                )
            total_profit = 0.0
            for row in allocations:
                outcome, profit = _side_result(
                    row.side, float(row.stake), normalized_result
                )
                row.outcome = outcome
                row.profit = profit
                row.updated_at = datetime.now()
                total_profit += profit
                allocation_payload.append(
                    {
                        "tab_id": row.tab_id,
                        "side": row.side,
                        "stake": row.stake,
                        "outcome": outcome,
                        "profit": profit,
                    }
                )
            outcome = (
                "win" if total_profit > 0 else "loss" if total_profit < 0 else "push"
            )
            profit = total_profit
        else:
            outcome, profit = _side_result(
                str(bet.side), float(bet.stake), normalized_result
            )

        now = datetime.now()
        bet.outcome = outcome
        bet.profit = float(profit)
        bet.status = "resolved"
        bet.resolved_at = now
        _refresh_group(session, bet.group_id)
        event = EventRecord(
            round_id=bet.round_id,
            event_type="pending_reconciled",
            payload=json.dumps(
                {
                    "bet_id": bet.id,
                    "result": normalized_result,
                    "outcome": outcome,
                    "profit": profit,
                    "evidence": evidence[:500],
                    "previous_status": "placed",
                    "allocations": allocation_payload,
                },
                ensure_ascii=False,
            ),
            created_at=now,
        )
        session.add(event)
        session.commit()
        session.refresh(event)
        return ReconciliationResult(
            bet_id=bet.id,
            round_id=bet.round_id,
            result=normalized_result,
            outcome=outcome,
            profit=float(profit),
            event_id=event.id,
        )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
