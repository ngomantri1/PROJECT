"""Fail-closed lifecycle for strategy tabs that may become betting authority."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from src.database import StrategyTabRecord
from src.models import BetSide
from src.money_manager import ProgressionMoneyManager
from src.pattern_analyzer import PatternAnalysis
from src.risk_decision import ExecutionMode, RiskContext, RiskDecision, RiskManager
from src.strategy_decision import StrategyDecision
from src.strategy_tabs import SimulationTabConfig, decision_for_strategy_tab
from src.statistical_strategies import SPEC_BY_ID


class TabLifecycleMode(str, Enum):
    SIMULATION = "simulation"
    SHADOW = "shadow"
    LIVE_CANDIDATE = "live_candidate"
    LIVE = "live"


@dataclass(frozen=True, slots=True)
class ShadowPolicy:
    minimum_evaluations: int = 20
    maximum_mismatch_rate: float = 0.05
    maximum_errors: int = 0

    def qualifies(
        self, *, evaluations: int, mismatches: int, errors: int
    ) -> bool:
        if evaluations < self.minimum_evaluations or errors > self.maximum_errors:
            return False
        return mismatches / max(1, evaluations) <= self.maximum_mismatch_rate


@dataclass(frozen=True, slots=True)
class TabAuthorityDecision:
    tab_id: str
    tab_name: str
    mode: TabLifecycleMode
    strategy: StrategyDecision
    risk: RiskDecision
    stake: int

    @property
    def may_arm(self) -> bool:
        return (
            self.mode == TabLifecycleMode.LIVE
            and self.strategy.wants_bet
            and self.risk.allowed
            and self.risk.execution_mode == ExecutionMode.REAL
        )

    @property
    def may_participate(self) -> bool:
        return (
            self.mode == TabLifecycleMode.LIVE
            and self.strategy.wants_bet
            and self.risk.allowed
            and self.risk.execution_mode
            in (ExecutionMode.REAL, ExecutionMode.VIRTUAL)
        )

    def as_pattern(self) -> PatternAnalysis | None:
        if not self.may_participate or self.strategy.side is None:
            return None
        return PatternAnalysis(
            pattern_id=self.strategy.signal_id or f"tab:{self.tab_id}",
            pattern_name=self.tab_name,
            status="matched",
            bet_side=self.strategy.side,
            progress=f"tab={self.tab_id}",
            sequence_text="",
            reason=self.strategy.reason,
        )


class StrategyLifecycleService:
    """Owns the simple simulation/live switch for every strategy tab."""

    def __init__(
        self,
        session_factory,
        *,
        policy: ShadowPolicy | None = None,
    ):
        self._session_factory = session_factory
        self.policy = policy or ShadowPolicy()

    @staticmethod
    def _tab_from_row(row: StrategyTabRecord) -> SimulationTabConfig:
        import json

        return SimulationTabConfig(
            id=row.id,
            name=row.name,
            enabled=bool(row.enabled),
            strategy_id=row.strategy_id,
            stakes=json.loads(row.stakes_json or "[]"),
            progression_mode=row.progression_mode,
            money_manager_id=row.money_manager_id or "IncreaseWhenLose",
            stake_chains=json.loads(row.stake_chains_json or "[]"),
            stop_loss=row.stop_loss,
            take_profit=row.take_profit,
            mode=row.mode or "simulation",
        ).normalized()

    def status(self) -> dict[str, Any]:
        session = self._session_factory()
        try:
            rows = (
                session.query(StrategyTabRecord)
                .filter(StrategyTabRecord.active == 1)
                .order_by(StrategyTabRecord.ordinal.asc())
                .all()
            )
            return {
                row.id: {
                    "mode": (
                        TabLifecycleMode.LIVE.value
                        if row.mode == TabLifecycleMode.LIVE.value
                        else TabLifecycleMode.SIMULATION.value
                    ),
                    "shadow_evaluations": int(row.shadow_evaluations or 0),
                    "shadow_matches": int(row.shadow_matches or 0),
                    "shadow_mismatches": int(row.shadow_mismatches or 0),
                    "shadow_errors": int(row.shadow_errors or 0),
                    "demote_reason": row.demote_reason or "",
                    "qualifies": self.policy.qualifies(
                        evaluations=int(row.shadow_evaluations or 0),
                        mismatches=int(row.shadow_mismatches or 0),
                        errors=int(row.shadow_errors or 0),
                    ),
                    "minimum_evaluations": self.policy.minimum_evaluations,
                    "maximum_mismatch_rate": self.policy.maximum_mismatch_rate,
                }
                for row in rows
            }
        finally:
            session.close()

    def set_live(self, tab_id: str, *, live: bool) -> dict[str, Any]:
        """Switch one tab directly between simulation and live.

        Multiple tabs may be live at the same time. Runtime risk gates and the
        global AutoBettor switch remain independent.
        """

        session = self._session_factory()
        try:
            row = session.get(StrategyTabRecord, str(tab_id or ""))
            if row is None or not row.active:
                raise ValueError("Không tìm thấy tab")
            if live:
                spec = SPEC_BY_ID.get(row.strategy_id)
                if spec is not None and not spec.live_eligible:
                    raise ValueError(
                        "Chiến lược chưa đủ dữ liệu để chạy thật: "
                        f"{spec.unavailable_reason}"
                    )
            row.mode = (
                TabLifecycleMode.LIVE.value
                if live
                else TabLifecycleMode.SIMULATION.value
            )
            row.demote_reason = ""
            session.commit()
            return self.status()[row.id]
        finally:
            session.close()

    def start_shadow(self, tab_id: str) -> dict[str, Any]:
        session = self._session_factory()
        try:
            row = session.get(StrategyTabRecord, tab_id)
            if row is None or not row.active:
                raise ValueError("Không tìm thấy tab")
            if row.mode == TabLifecycleMode.LIVE.value:
                raise ValueError("Phải demote tab live trước khi chạy lại shadow")
            row.mode = TabLifecycleMode.SHADOW.value
            row.shadow_evaluations = 0
            row.shadow_matches = 0
            row.shadow_mismatches = 0
            row.shadow_errors = 0
            row.demote_reason = ""
            session.commit()
            return self.status()[tab_id]
        finally:
            session.close()

    def record_shadow(
        self, tab_id: str, *, matched: bool = False, error: bool = False
    ) -> dict[str, Any]:
        session = self._session_factory()
        try:
            row = session.get(StrategyTabRecord, tab_id)
            if row is None or row.mode not in (
                TabLifecycleMode.SHADOW.value,
                TabLifecycleMode.LIVE_CANDIDATE.value,
            ):
                return {}
            row.shadow_evaluations = int(row.shadow_evaluations or 0) + 1
            if error:
                row.shadow_errors = int(row.shadow_errors or 0) + 1
            elif matched:
                row.shadow_matches = int(row.shadow_matches or 0) + 1
            else:
                row.shadow_mismatches = int(row.shadow_mismatches or 0) + 1
            if self.policy.qualifies(
                evaluations=row.shadow_evaluations,
                mismatches=row.shadow_mismatches,
                errors=row.shadow_errors,
            ):
                row.mode = TabLifecycleMode.LIVE_CANDIDATE.value
            elif row.mode == TabLifecycleMode.LIVE_CANDIDATE.value:
                row.mode = TabLifecycleMode.SHADOW.value
            session.commit()
            return self.status().get(tab_id, {})
        finally:
            session.close()

    def promote_live(self, tab_id: str, *, confirmation: str) -> dict[str, Any]:
        session = self._session_factory()
        try:
            row = session.get(StrategyTabRecord, tab_id)
            if row is None or not row.active:
                raise ValueError("Không tìm thấy tab")
            spec = SPEC_BY_ID.get(row.strategy_id)
            if spec is not None and not spec.live_eligible:
                raise ValueError(
                    f"Chiến lược chưa đủ dữ liệu để chạy live: {spec.unavailable_reason}"
                )
            if row.mode != TabLifecycleMode.LIVE_CANDIDATE.value:
                raise ValueError("Tab chưa đạt trạng thái live_candidate")
            if confirmation.strip() != f"LIVE {row.name}":
                raise ValueError(f'Xác nhận phải là "LIVE {row.name}"')
            if not self.policy.qualifies(
                evaluations=int(row.shadow_evaluations or 0),
                mismatches=int(row.shadow_mismatches or 0),
                errors=int(row.shadow_errors or 0),
            ):
                raise ValueError("Shadow chưa đạt ngưỡng")
            for other in (
                session.query(StrategyTabRecord)
                .filter(StrategyTabRecord.mode == TabLifecycleMode.LIVE.value)
                .all()
            ):
                if other.id != row.id:
                    other.mode = TabLifecycleMode.SIMULATION.value
                    other.demote_reason = "Tab khác được promote live"
            row.mode = TabLifecycleMode.LIVE.value
            row.demote_reason = ""
            session.commit()
            return self.status()[tab_id]
        finally:
            session.close()

    def demote(self, tab_id: str, *, reason: str) -> dict[str, Any]:
        session = self._session_factory()
        try:
            row = session.get(StrategyTabRecord, tab_id)
            if row is None:
                return {}
            row.mode = TabLifecycleMode.SIMULATION.value
            row.demote_reason = (reason or "Demote thủ công")[:255]
            session.commit()
            return self.status().get(tab_id, {})
        finally:
            session.close()

    def demote_live(self, *, reason: str) -> list[str]:
        session = self._session_factory()
        changed: list[str] = []
        try:
            rows = (
                session.query(StrategyTabRecord)
                .filter(StrategyTabRecord.mode == TabLifecycleMode.LIVE.value)
                .all()
            )
            for row in rows:
                row.mode = TabLifecycleMode.SIMULATION.value
                row.demote_reason = (reason or "Runtime không an toàn")[:255]
                changed.append(row.id)
            if changed:
                session.commit()
            return changed
        finally:
            session.close()

    def tab_in_mode(
        self, *modes: TabLifecycleMode
    ) -> SimulationTabConfig | None:
        tabs = self.tabs_in_mode(*modes)
        return tabs[0] if tabs else None

    def tabs_in_mode(
        self, *modes: TabLifecycleMode
    ) -> list[SimulationTabConfig]:
        wanted = [mode.value for mode in modes]
        session = self._session_factory()
        try:
            rows = (
                session.query(StrategyTabRecord)
                .filter(
                    StrategyTabRecord.active == 1,
                    StrategyTabRecord.mode.in_(wanted),
                )
                .order_by(StrategyTabRecord.ordinal.asc())
                .all()
            )
            return [self._tab_from_row(row) for row in rows]
        finally:
            session.close()

    def evaluate(
        self,
        *,
        tab: SimulationTabConfig,
        history: list[BetSide],
        table_name: str,
        source: str,
        skip_tie: bool,
        progression,
        money_quote=None,
        auto_bet: bool,
        license_allowed: bool,
        pending_main: bool,
        pending_tie: bool,
        round_already_placed: bool,
        shuffling: bool,
        source_allowed: bool,
        ui_healthy: bool = True,
        countdown: int | None = None,
        balance: float | None = None,
        disabled_patterns: frozenset[str] = frozenset(),
        pattern_lengths: dict[str, int] | None = None,
        daily_profit: float = 0.0,
        limit_hit: str = "",
    ) -> TabAuthorityDecision:
        if tab.enabled:
            strategy = decision_for_strategy_tab(
                tab,
                history,
                skip_tie=skip_tie,
                disabled_patterns=disabled_patterns,
                pattern_lengths=pattern_lengths,
                table_name=table_name,
                source=source,
            )
        else:
            strategy = StrategyDecision.skip(
                strategy_id=tab.strategy_id,
                strategy_name=tab.name,
                reason="Tab đang tắt",
                history_size=len(history),
            )
        money = (
            money_quote
            if money_quote is not None
            else ProgressionMoneyManager.from_progression(progression).quote()
        )
        risk = RiskManager().evaluate(
            RiskContext(
                strategy=strategy,
                money=money,
                auto_bet=auto_bet,
                license_allowed=license_allowed,
                daily_profit=daily_profit,
                stop_loss=tab.stop_loss,
                take_profit=tab.take_profit,
                limit_hit=limit_hit,
                pending_main=pending_main,
                pending_tie=pending_tie,
                round_already_placed=round_already_placed,
                shuffling=shuffling,
                source_allowed=source_allowed,
                ui_healthy=ui_healthy,
                countdown=countdown,
                balance=balance,
            )
        )
        return TabAuthorityDecision(
            tab_id=tab.id,
            tab_name=tab.name,
            mode=TabLifecycleMode(tab.mode),
            strategy=strategy,
            risk=risk,
            stake=money.stake,
        )
