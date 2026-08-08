"""Small, side-effect-free table selection state machine.

Browser navigation and betting remain owned by ``HistoryWatcher`` and
``AutoBettor``.  This module only protects the distinction between an
operator's requested table and a table confirmed by the game room.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class TableSelectionPhase(str, Enum):
    IDLE = "idle"
    WAITING_MANUAL = "waiting_manual"
    AUTO_ENTERING = "auto_entering"
    CONFIRMING = "confirming"
    READY = "ready"
    RECOVERING = "recovering"
    BLOCKED = "blocked"


class TableSelectionSource(str, Enum):
    STARTUP_DETECTED = "startup_detected"
    OPERATOR = "operator"
    LAST_CONFIRMED = "last_confirmed"
    CONFIG_DEFAULT = "config_default"
    AUTO_FALLBACK = "auto_fallback"
    RECOVERY = "recovery"


@dataclass
class TableSelectionState:
    phase: TableSelectionPhase = TableSelectionPhase.IDLE
    preferred_table: str = ""
    pending_table: str = ""
    active_table: str = ""
    last_confirmed_table: str = ""
    source: TableSelectionSource | None = None
    manual_grace_seconds: int = 30
    manual_deadline_monotonic: float | None = None
    auto_enter_enabled: bool = True
    operator_change_active: bool = False
    message: str = ""
    error: str = ""
    available_tables: list[str] = field(default_factory=list)


class TableSelectionController:
    """Enforce intent -> confirmation -> authority transitions."""

    def __init__(self, state: TableSelectionState | None = None):
        self.state = state or TableSelectionState()

    def set_available_tables(self, tables: list[str]) -> None:
        self.state.available_tables = [
            str(item).strip() for item in tables if str(item).strip()
        ]

    def snapshot(self, now: float, *, wall_time: float) -> dict:
        remaining = 0.0
        if self.state.manual_deadline_monotonic is not None:
            remaining = max(0.0, self.state.manual_deadline_monotonic - now)
        return {
            "phase": self.state.phase.value,
            "preferred_table": self.state.preferred_table,
            "pending_table": self.state.pending_table,
            "active_table": self.state.active_table,
            "last_confirmed_table": self.state.last_confirmed_table,
            "source": self.state.source.value if self.state.source else "",
            "auto_enter_enabled": self.state.auto_enter_enabled,
            "operator_change_active": self.state.operator_change_active,
            "message": self.state.message,
            "error": self.state.error,
            "available_tables": list(self.state.available_tables),
            "remaining_seconds": int(remaining + 0.999),
            "deadline_epoch_ms": int((wall_time + remaining) * 1000) if remaining else 0,
        }

    def lobby_ready(self, now: float) -> None:
        self.state.phase = TableSelectionPhase.WAITING_MANUAL
        self.state.manual_deadline_monotonic = now + self.state.manual_grace_seconds
        self.state.pending_table = ""
        self.state.message = "Đang chờ chọn bàn"

    def request(self, table: str, *, source: TableSelectionSource) -> bool:
        if not table or self.state.phase == TableSelectionPhase.BLOCKED:
            return False
        self.state.pending_table = table
        self.state.preferred_table = table
        self.state.source = source
        self.state.phase = (
            TableSelectionPhase.RECOVERING
            if source is TableSelectionSource.RECOVERY
            else TableSelectionPhase.AUTO_ENTERING
        )
        return True

    def confirm_ready(self, actual_table: str) -> str:
        if not actual_table:
            raise ValueError("TABLE_READY requires an actual table")
        self.state.active_table = actual_table
        self.state.last_confirmed_table = actual_table
        self.state.pending_table = ""
        self.state.phase = TableSelectionPhase.READY
        self.state.operator_change_active = False
        self.state.error = ""
        return actual_table

    def candidate_failed(self, message: str = "") -> None:
        self.state.pending_table = ""
        self.state.error = message
        self.state.phase = TableSelectionPhase.WAITING_MANUAL

    def timeout_target(self, *, last_confirmed: str, config_default: str, fallback: str) -> str:
        if not self.state.auto_enter_enabled:
            return ""
        return last_confirmed or config_default or fallback

    def begin_operator_change(self, *, unsafe: bool) -> bool:
        if unsafe:
            self.state.phase = TableSelectionPhase.BLOCKED
            self.state.message = "Đang có cược hoặc thao tác vật lý chưa an toàn"
            return False
        self.state.operator_change_active = True
        self.state.phase = TableSelectionPhase.WAITING_MANUAL
        self.state.pending_table = ""
        self.state.manual_deadline_monotonic = None
        self.state.message = "Đang chờ chọn bàn mới"
        return True

    def abort_operator_change(self, message: str) -> None:
        """Rollback an operator change that could not open/select a table."""
        self.state.operator_change_active = False
        self.state.pending_table = ""
        self.state.error = str(message or "")
        self.state.phase = (
            TableSelectionPhase.READY
            if self.state.active_table
            else TableSelectionPhase.WAITING_MANUAL
        )

    def recovery_allowed(self) -> bool:
        return not self.state.operator_change_active and self.state.phase not in {
            TableSelectionPhase.WAITING_MANUAL,
            TableSelectionPhase.BLOCKED,
        }
