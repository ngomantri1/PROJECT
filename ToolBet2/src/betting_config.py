from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from src.stakes_config import format_stakes, parse_stakes_text


def parse_limit_text(text: str) -> float:
    """0 hoac trong = khong gioi han."""
    raw = (text or "").strip()
    if not raw:
        return 0.0
    val = float(raw.replace(",", "").replace(" ", ""))
    if val < 0:
        raise ValueError("Gioi han phai >= 0")
    return val


def format_limit(value: float) -> str:
    if not value:
        return ""
    if value == int(value):
        return str(int(value))
    return str(value)


def load_betting_section(config_path: str | Path) -> dict[str, Any]:
    path = Path(config_path)
    if not path.exists():
        path = Path("config.example.yaml")
    with path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return raw.setdefault("betting", {})


def save_betting_to_config(
    *,
    config_path: str | Path,
    stakes: list[int] | None = None,
    auto_bet: bool | None = None,
    stop_loss: float | None = None,
    take_profit: float | None = None,
    group_take_profit: float | None = None,
    group_stop_loss: float | None = None,
    progression_mode: str | None = None,
    loss_watch_recover: bool | None = None,
    tie_nurture: dict[str, Any] | None = None,
) -> None:
    path = Path(config_path)
    if not path.exists():
        path = Path("config.example.yaml")
    with path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    betting = raw.setdefault("betting", {})
    if stakes is not None:
        betting["stakes"] = stakes
    if auto_bet is not None:
        betting["auto_bet"] = auto_bet
    if stop_loss is not None:
        betting["stop_loss"] = stop_loss
    if take_profit is not None:
        betting["take_profit"] = take_profit
    if group_take_profit is not None:
        betting["group_take_profit"] = group_take_profit
    if group_stop_loss is not None:
        betting["group_stop_loss"] = group_stop_loss
    if progression_mode is not None:
        betting["progression_mode"] = progression_mode
    if loss_watch_recover is not None:
        betting["loss_watch_recover"] = bool(loss_watch_recover)
    if tie_nurture is not None:
        betting["tie_nurture"] = dict(tie_nurture)
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(raw, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def save_tie_nurture_to_config(
    tie_nurture: dict[str, Any],
    config_path: str | Path = "config.yaml",
) -> None:
    # Khong luu danh sach presets vao yaml
    data = {
        k: v
        for k, v in dict(tie_nurture).items()
        if k not in ("presets", "label", "apply_preset")
    }
    save_betting_to_config(config_path=config_path, tie_nurture=data)


def save_stakes_to_config(stakes: list[int], config_path: str | Path = "config.yaml") -> None:
    save_betting_to_config(config_path=config_path, stakes=stakes)


def save_limits_to_config(
    stop_loss: float,
    take_profit: float,
    config_path: str | Path = "config.yaml",
    *,
    group_take_profit: float | None = None,
    group_stop_loss: float | None = None,
    progression_mode: str | None = None,
) -> None:
    save_betting_to_config(
        config_path=config_path,
        stop_loss=stop_loss,
        take_profit=take_profit,
        group_take_profit=group_take_profit,
        group_stop_loss=group_stop_loss,
        progression_mode=progression_mode,
    )
