from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.exc import IntegrityError

from src.database import (
    StrategyMoneyConfigRecord,
    StrategyTabHistoryRecord,
    StrategyTabRecord,
    StrategyTabRuntimeRecord,
)
from src.capital_managers import MONEY_MANAGER_OPTIONS
from src.strategy_tabs import StrategyTabsConfig, normalize_strategy_tabs


class StrategyTabStore:
    """SQLite persistence for simulation tab config, runtime and statistics history."""

    def __init__(self, session_factory):
        self._session_factory = session_factory
        self._runtime_signatures: dict[str, tuple[str, int, str]] = {}

    def load_or_import(self, fallback: StrategyTabsConfig) -> StrategyTabsConfig:
        session = self._session_factory()
        try:
            rows = (
                session.query(StrategyTabRecord)
                .filter(StrategyTabRecord.active == 1)
                .order_by(StrategyTabRecord.ordinal.asc())
                .all()
            )
            if not rows:
                config = fallback.normalized()
                session.close()
                self.save_config(config)
                return config
            seeded = False
            for row in rows:
                seeded = self._seed_missing_money_configs(
                    session, row.id, datetime.now()
                ) or seeded
            if seeded:
                session.commit()
            selected = next((row.id for row in rows if row.selected), rows[0].id)
            return normalize_strategy_tabs(
                {
                    "selected_tab_id": selected,
                    "tabs": [
                        {
                            "id": row.id,
                            "name": row.name,
                            "enabled": bool(row.enabled),
                            "strategy_id": row.strategy_id,
                            "stakes": json.loads(row.stakes_json or "[]"),
                            "progression_mode": row.progression_mode,
                            "money_manager_id": row.money_manager_id
                            or "IncreaseWhenLose",
                            "stake_chains": json.loads(
                                row.stake_chains_json or "[]"
                            ),
                            "stop_loss": row.stop_loss,
                            "take_profit": row.take_profit,
                            "auto_reset_on_nonnegative_pnl": bool(
                                row.auto_reset_on_nonnegative_pnl
                            ),
                            "strategy_input": row.strategy_input or "",
                            "mode": row.mode or "simulation",
                        }
                        for row in rows
                    ],
                }
            )
        finally:
            session.close()

    def save_config(self, data: Any) -> StrategyTabsConfig:
        config = normalize_strategy_tabs(
            data.model_dump() if isinstance(data, StrategyTabsConfig) else data
        )
        now = datetime.now()
        session = self._session_factory()
        try:
            for row in session.query(StrategyTabRecord).all():
                row.active = 0
                row.selected = 0
                row.updated_at = now
            for ordinal, tab in enumerate(config.tabs):
                row = session.get(StrategyTabRecord, tab.id)
                if row is None:
                    row = StrategyTabRecord(id=tab.id, created_at=now)
                    session.add(row)
                row.mode = "live" if tab.mode == "live" else "simulation"
                tab.mode = row.mode
                row.ordinal = ordinal
                row.name = tab.name
                row.enabled = int(tab.enabled)
                row.active = 1
                row.selected = int(tab.id == config.selected_tab_id)
                row.strategy_id = tab.strategy_id
                row.stakes_json = json.dumps(tab.stakes)
                row.progression_mode = tab.progression_mode
                row.money_manager_id = tab.money_manager_id
                row.stake_chains_json = json.dumps(tab.stake_chains)
                row.stop_loss = tab.stop_loss
                row.take_profit = tab.take_profit
                row.auto_reset_on_nonnegative_pnl = int(
                    tab.auto_reset_on_nonnegative_pnl
                )
                row.strategy_input = tab.strategy_input
                row.updated_at = now
                money_config = (
                    session.query(StrategyMoneyConfigRecord)
                    .filter(
                        StrategyMoneyConfigRecord.tab_id == tab.id,
                        StrategyMoneyConfigRecord.manager_id
                        == tab.money_manager_id,
                    )
                    .one_or_none()
                )
                if money_config is None:
                    money_config = StrategyMoneyConfigRecord(
                        tab_id=tab.id,
                        manager_id=tab.money_manager_id,
                    )
                    session.add(money_config)
                money_config.stakes_json = json.dumps(tab.stakes)
                money_config.stake_chains_json = json.dumps(tab.stake_chains)
                money_config.updated_at = now
                self._seed_missing_money_configs(session, tab.id, now)
            session.commit()
            return config
        finally:
            session.close()

    @staticmethod
    def _seed_missing_money_configs(session, tab_id: str, now: datetime) -> bool:
        """Give every MoneyManager an independent, safe initial stake chain."""
        existing = {
            row.manager_id
            for row in session.query(StrategyMoneyConfigRecord.manager_id)
            .filter(StrategyMoneyConfigRecord.tab_id == tab_id)
            .all()
        }
        seeded = False
        for option in MONEY_MANAGER_OPTIONS:
            manager_id = option["id"]
            if manager_id in existing:
                continue
            session.add(
                StrategyMoneyConfigRecord(
                    tab_id=tab_id,
                    manager_id=manager_id,
                    stakes_json="[0]",
                    stake_chains_json="[[0]]" if manager_id == "MultiChain" else "[]",
                    updated_at=now,
                )
            )
            seeded = True
        return seeded

    def money_configs_for_tabs(
        self, tab_ids: list[str]
    ) -> dict[str, dict[str, dict[str, Any]]]:
        ids = [str(tab_id) for tab_id in tab_ids if str(tab_id)]
        result: dict[str, dict[str, dict[str, Any]]] = {
            tab_id: {} for tab_id in ids
        }
        if not ids:
            return result
        session = self._session_factory()
        try:
            rows = (
                session.query(StrategyMoneyConfigRecord)
                .filter(StrategyMoneyConfigRecord.tab_id.in_(ids))
                .all()
            )
            for row in rows:
                result.setdefault(row.tab_id, {})[row.manager_id] = {
                    "stakes": json.loads(row.stakes_json or "[]"),
                    "stake_chains": json.loads(row.stake_chains_json or "[]"),
                }
            return result
        finally:
            session.close()

    def record_overlay(self, payload: dict[str, Any], *, table_name: str = "") -> None:
        tabs = payload.get("tabs") if isinstance(payload, dict) else None
        if not isinstance(tabs, list):
            return
        session = self._session_factory()
        now = datetime.now()
        changed = False
        try:
            for tab in tabs:
                if not isinstance(tab, dict) or not tab.get("id"):
                    continue
                tab_id = str(tab["id"])
                status = tab.get("status") if isinstance(tab.get("status"), dict) else {}
                history_size = int(status.get("history_size") or 0)
                status_json = json.dumps(status, ensure_ascii=False, sort_keys=True)
                signature = (table_name or "", history_size, status_json)
                if self._runtime_signatures.get(tab_id) == signature:
                    continue
                self._runtime_signatures[tab_id] = signature
                changed = True
                runtime = session.get(StrategyTabRuntimeRecord, tab_id)
                if runtime is None:
                    runtime = StrategyTabRuntimeRecord(tab_id=tab_id)
                    session.add(runtime)
                runtime.table_name = table_name or ""
                runtime.history_size = history_size
                runtime.status_json = status_json
                runtime.updated_at = now
                if history_size <= 0:
                    continue
                exists = (
                    session.query(StrategyTabHistoryRecord.id)
                    .filter(
                        StrategyTabHistoryRecord.tab_id == tab_id,
                        StrategyTabHistoryRecord.table_name == (table_name or ""),
                        StrategyTabHistoryRecord.history_size == history_size,
                    )
                    .first()
                )
                if exists:
                    continue
                session.add(
                    StrategyTabHistoryRecord(
                        tab_id=tab_id,
                        table_name=table_name or "",
                        history_size=history_size,
                        signals=int(status.get("signals") or 0),
                        virtual_bets=int(status.get("virtual_bets") or 0),
                        wins=int(status.get("wins") or 0),
                        losses=int(status.get("losses") or 0),
                        pushes=int(status.get("pushes") or 0),
                        pnl=float(status.get("pnl") or 0),
                        current_json=json.dumps(status.get("current") or {}, ensure_ascii=False),
                        created_at=now,
                    )
                )
            if changed:
                session.commit()
        except IntegrityError:
            session.rollback()
        finally:
            session.close()

    def history_for_tabs(self, tab_ids: list[str], *, limit: int = 20) -> dict[str, list[dict]]:
        result: dict[str, list[dict]] = {tab_id: [] for tab_id in tab_ids}
        session = self._session_factory()
        try:
            for tab_id in tab_ids:
                rows = (
                    session.query(StrategyTabHistoryRecord)
                    .filter(StrategyTabHistoryRecord.tab_id == tab_id)
                    .order_by(StrategyTabHistoryRecord.id.desc())
                    .limit(max(1, min(100, limit)))
                    .all()
                )
                result[tab_id] = [
                    {
                        "history_size": row.history_size,
                        "table_name": row.table_name,
                        "signals": row.signals,
                        "virtual_bets": row.virtual_bets,
                        "wins": row.wins,
                        "losses": row.losses,
                        "pushes": row.pushes,
                        "pnl": row.pnl,
                        "current": json.loads(row.current_json or "{}"),
                        "created_at": row.created_at.isoformat(timespec="seconds"),
                    }
                    for row in reversed(rows)
                ]
            return result
        finally:
            session.close()

    def history_page(self, tab_id: str, *, page: int = 1, page_size: int = 10) -> dict[str, Any]:
        page_size = page_size if page_size in (10, 20, 50) else 10
        page = max(1, int(page))
        session = self._session_factory()
        try:
            query = session.query(StrategyTabHistoryRecord).filter(
                StrategyTabHistoryRecord.tab_id == tab_id
            )
            total = query.count()
            page_count = max(1, (total + page_size - 1) // page_size)
            page = min(page, page_count)
            rows = query.order_by(StrategyTabHistoryRecord.id.desc()).offset(
                (page - 1) * page_size
            ).limit(page_size).all()
            return {
                "items": [
                    {
                        "history_size": row.history_size,
                        "table_name": row.table_name,
                        "signals": row.signals,
                        "virtual_bets": row.virtual_bets,
                        "wins": row.wins,
                        "losses": row.losses,
                        "pushes": row.pushes,
                        "pnl": row.pnl,
                        "current": json.loads(row.current_json or "{}"),
                        "created_at": row.created_at.isoformat(timespec="seconds"),
                    }
                    for row in rows
                ],
                "page": page,
                "page_size": page_size,
                "total": total,
                "page_count": page_count,
            }
        finally:
            session.close()
