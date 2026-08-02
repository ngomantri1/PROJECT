"""Local emergency stop checked immediately before every new live bet."""

from __future__ import annotations

import os
from pathlib import Path


def kill_switch_path() -> Path:
    configured = os.environ.get("TOOLBET_KILL_SWITCH", "").strip()
    return Path(configured) if configured else Path("data") / "KILL_SWITCH"


def is_kill_switch_active() -> bool:
    return os.environ.get("TOOLBET_DISABLE_LIVE", "").strip() == "1" or kill_switch_path().exists()


def live_bet_allowed(license_allowed: bool) -> bool:
    return bool(license_allowed) and not is_kill_switch_active()
