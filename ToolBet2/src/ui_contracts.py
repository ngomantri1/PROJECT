from __future__ import annotations

from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


UI_PROTOCOL_VERSION = 1


class UiScreen(str, Enum):
    TOOL_LOGIN = "tool_login"
    GAME_LOGIN = "game_login"
    WORKSPACE = "workspace"


class UiCommandType(str, Enum):
    TOOL_LOGIN = "tool_login"
    TOOL_LOGOUT = "tool_logout"
    GAME_LOGIN = "game_login"
    SAVE_STRATEGY_TAB = "save_strategy_tab"
    START_SIMULATION = "start_simulation"
    STOP_SIMULATION = "stop_simulation"
    START_SHADOW = "start_shadow"
    PROMOTE_LIVE = "promote_live"
    DEMOTE_LIVE = "demote_live"
    ENABLE_LIVE_BET = "enable_live_bet"
    DISABLE_LIVE_BET = "disable_live_bet"
    SET_TAB_MODE = "set_tab_mode"
    SET_RUN_STATE = "set_run_state"
    RESET_TAB_STATISTICS = "reset_tab_statistics"
    QUERY_HISTORY = "query_history"
    UPDATE_SETTINGS = "update_settings"


class UiSnapshot(BaseModel):
    """One immutable view of application state sent from Python to the UI."""

    version: int = UI_PROTOCOL_VERSION
    revision: int = Field(default=0, ge=0)
    screen: UiScreen = UiScreen.WORKSPACE
    state: dict[str, Any] = Field(default_factory=dict)
    tabs: list[dict[str, Any]] = Field(default_factory=list)

    def to_payload(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


class UiCommand(BaseModel):
    """A typed user intent sent from the browser UI to Python."""

    version: int = UI_PROTOCOL_VERSION
    command_id: str = Field(default_factory=lambda: uuid4().hex, min_length=1)
    type: UiCommandType
    payload: dict[str, Any] = Field(default_factory=dict)


class UiCommandResult(BaseModel):
    version: int = UI_PROTOCOL_VERSION
    command_id: str
    ok: bool
    data: dict[str, Any] = Field(default_factory=dict)
    error: str = ""
