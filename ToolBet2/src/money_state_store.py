"""SQLite persistence for one money-manager state per strategy tab."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime

from src.capital_managers import CapitalStateSnapshot, ReferenceMoneyManager
from src.database import StrategyMoneyStateRecord


def money_config_fingerprint(manager: ReferenceMoneyManager) -> str:
    snapshot = manager.snapshot()
    payload = {
        "manager_id": snapshot.manager_id,
        "stakes": list(snapshot.stakes),
        "stake_chains": [list(chain) for chain in snapshot.stake_chains],
        "stop_loss": snapshot.stop_loss,
        "take_profit": snapshot.take_profit,
        "banker_commission": snapshot.banker_commission,
    }
    encoded = json.dumps(
        payload, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class MoneyStateStore:
    def __init__(self, session_factory):
        self._session_factory = session_factory

    def save(self, tab_id: str, manager: ReferenceMoneyManager) -> None:
        tab_id = str(tab_id or "").strip()
        if not tab_id:
            raise ValueError("tab_id must not be empty")
        session = self._session_factory()
        try:
            row = (
                session.query(StrategyMoneyStateRecord)
                .filter(
                    StrategyMoneyStateRecord.tab_id == tab_id,
                    StrategyMoneyStateRecord.manager_id == manager.manager_id,
                )
                .one_or_none()
            )
            if row is None:
                row = StrategyMoneyStateRecord(
                    tab_id=tab_id,
                    manager_id=manager.manager_id,
                )
                session.add(row)
            row.config_fingerprint = money_config_fingerprint(manager)
            row.state_json = json.dumps(
                manager.snapshot().to_dict(),
                ensure_ascii=False,
                sort_keys=True,
            )
            row.updated_at = datetime.now()
            session.commit()
        finally:
            session.close()

    def restore(
        self, tab_id: str, manager: ReferenceMoneyManager
    ) -> bool:
        session = self._session_factory()
        try:
            row = (
                session.query(StrategyMoneyStateRecord)
                .filter(
                    StrategyMoneyStateRecord.tab_id == str(tab_id or ""),
                    StrategyMoneyStateRecord.manager_id == manager.manager_id,
                )
                .one_or_none()
            )
            if row is None:
                return False
            if row.config_fingerprint != money_config_fingerprint(manager):
                return False
            try:
                snapshot = CapitalStateSnapshot.from_dict(
                    json.loads(row.state_json or "{}")
                )
                manager.restore(snapshot)
            except (TypeError, ValueError, json.JSONDecodeError):
                return False
            return True
        finally:
            session.close()

    def delete_for_tab(self, tab_id: str) -> int:
        session = self._session_factory()
        try:
            count = (
                session.query(StrategyMoneyStateRecord)
                .filter(StrategyMoneyStateRecord.tab_id == str(tab_id or ""))
                .delete(synchronize_session=False)
            )
            session.commit()
            return int(count)
        finally:
            session.close()

