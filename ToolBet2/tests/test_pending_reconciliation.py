from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sqlalchemy import select

from src.database import BetAllocationRecord, BetRecord, EventRecord, init_db
from src.db_store import GameDataStore
from src.pending_reconciliation import (
    RECONCILIATION_ACK,
    ReconciliationError,
    backup_database,
    reconcile_pending_bet,
)


class PendingReconciliationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.database = Path(self.tmp.name) / "reconcile.db"
        self.session_factory = init_db(str(self.database))
        self.store = GameDataStore(self.session_factory, "ae_sexy")

    def tearDown(self) -> None:
        self.session_factory.kw["bind"].dispose()
        self.tmp.cleanup()

    def create_bet(
        self,
        *,
        round_id: str = "ae_sexy:C03:24963:39",
        side: str = "player",
        stake: float = 0,
        pattern_id: str = "mau_1_1",
        status: str = "placed",
        group_id: int | None = None,
    ):
        return self.store.save_bet(
            round_id=round_id,
            table_name="Baccarat C03",
            side=side,
            stake=stake,
            stake_index=0,
            pattern_id=pattern_id,
            pattern_name="Test",
            reason="test",
            target_round_index=38,
            game_shoe=24963,
            game_round=39,
            status=status,
            group_id=group_id,
        )

    def reconcile(self, bet, **overrides):
        values = {
            "bet_id": bet.id,
            "expected_round_id": bet.round_id,
            "result": "player",
            "evidence": "Trusted WS archive event 24963/39",
            "acknowledgement": RECONCILIATION_ACK,
        }
        values.update(overrides)
        return reconcile_pending_bet(self.session_factory, **values)

    def test_confirmed_stake_zero_pending_resolves_with_audit_event(self) -> None:
        group = self.store.open_bet_group(
            session_date="2026-08-02",
            table_name="Baccarat C03",
            stakes=[0, 100],
        )
        bet = self.create_bet(group_id=group.id)

        result = self.reconcile(bet)

        self.assertEqual("win", result.outcome)
        self.assertEqual(0.0, result.profit)
        db = self.session_factory()
        try:
            persisted = db.get(BetRecord, bet.id)
            event = db.scalar(
                select(EventRecord).where(
                    EventRecord.event_type == "pending_reconciled"
                )
            )
            refreshed_group = db.get(type(group), group.id)
            self.assertEqual("resolved", persisted.status)
            self.assertEqual("win", persisted.outcome)
            self.assertIsNotNone(event)
            self.assertIn("Trusted WS archive", event.payload)
            self.assertEqual(1, refreshed_group.bet_count)
            self.assertEqual(1, refreshed_group.wins)
        finally:
            db.close()

    def test_backup_is_verified_and_preserves_pending(self) -> None:
        bet = self.create_bet()

        backup = backup_database(self.database)
        backup_factory = init_db(str(backup))
        db = backup_factory()
        try:
            copied = db.get(BetRecord, bet.id)
            self.assertEqual(bet.round_id, copied.round_id)
            self.assertIsNone(copied.outcome)
        finally:
            db.close()
            backup_factory.kw["bind"].dispose()

    def test_wrong_round_or_ack_rolls_back_without_audit_event(self) -> None:
        bet = self.create_bet()
        for overrides in (
            {"expected_round_id": "wrong"},
            {"acknowledgement": "yes"},
        ):
            with self.assertRaises(ReconciliationError):
                self.reconcile(bet, **overrides)

        db = self.session_factory()
        try:
            persisted = db.get(BetRecord, bet.id)
            self.assertIsNone(persisted.outcome)
            self.assertEqual(0, db.query(EventRecord).count())
        finally:
            db.close()

    def test_ambiguous_placement_cannot_be_resolved_from_round_result(self) -> None:
        bet = self.create_bet(status="uncertain", stake=100)

        with self.assertRaisesRegex(ReconciliationError, "placement"):
            self.reconcile(bet)

    def test_aggregate_requires_every_allocation_confirmed(self) -> None:
        bet = self.create_bet(
            side="multi", stake=300, pattern_id="multi_live"
        )
        self.store.save_bet_allocations(
            bet.id,
            [
                {"tab_id": "p", "side": "player", "stake": 100, "placement_status": "placed"},
                {"tab_id": "b", "side": "banker", "stake": 200, "placement_status": "uncertain"},
            ],
        )

        with self.assertRaisesRegex(ReconciliationError, "chưa xác nhận"):
            self.reconcile(bet)

    def test_confirmed_aggregate_resolves_allocations_and_total(self) -> None:
        bet = self.create_bet(
            side="multi", stake=300, pattern_id="multi_live"
        )
        self.store.save_bet_allocations(
            bet.id,
            [
                {"tab_id": "p", "side": "player", "stake": 100, "placement_status": "placed"},
                {"tab_id": "b", "side": "banker", "stake": 200, "placement_status": "placed"},
            ],
        )

        result = self.reconcile(bet, result="banker")

        self.assertEqual("win", result.outcome)
        self.assertEqual(90.0, result.profit)
        db = self.session_factory()
        try:
            allocations = {
                row.tab_id: (row.outcome, row.profit)
                for row in db.scalars(select(BetAllocationRecord))
            }
            self.assertEqual(("loss", -100.0), allocations["p"])
            self.assertEqual(("win", 190.0), allocations["b"])
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
