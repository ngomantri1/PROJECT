from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from src.pattern_analyzer import (
    DEFAULT_PATTERN_LENGTHS,
    clamp_pattern_length,
    normalize_pattern_lengths,
    pattern_catalog,
)


def all_pattern_ids() -> list[str]:
    return [str(p["id"]) for p in pattern_catalog()]


def normalize_pattern_enabled(raw: dict[str, Any] | None) -> dict[str, bool]:
    """Gop config — thieu key = bat (mac dinh)."""
    enabled = {pid: True for pid in all_pattern_ids()}
    if not raw:
        return enabled
    for pid in all_pattern_ids():
        if pid in raw:
            enabled[pid] = bool(raw[pid])
    return enabled


def disabled_pattern_ids(enabled: dict[str, bool]) -> frozenset[str]:
    return frozenset(pid for pid, on in enabled.items() if not on)


def save_pattern_enabled(
    pattern_id: str,
    enabled: bool,
    *,
    config_path: str | Path = "config.yaml",
) -> dict[str, bool]:
    path = Path(config_path)
    if not path.exists():
        path = Path("config.example.yaml")
    with path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    patterns = normalize_pattern_enabled(raw.get("patterns"))
    if pattern_id not in patterns:
        raise ValueError(f"Mau khong hop le: {pattern_id}")
    patterns[pattern_id] = enabled
    raw["patterns"] = patterns
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(raw, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    return patterns


def load_pattern_lengths(config_path: str | Path = "config.yaml") -> dict[str, int]:
    path = Path(config_path)
    if not path.exists():
        path = Path("config.example.yaml")
    with path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return normalize_pattern_lengths(raw.get("pattern_lengths"))


def save_pattern_length(
    pattern_id: str,
    length: int,
    *,
    config_path: str | Path = "config.yaml",
) -> dict[str, int]:
    path = Path(config_path)
    if not path.exists():
        path = Path("config.example.yaml")
    with path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    lengths = normalize_pattern_lengths(raw.get("pattern_lengths"))
    if pattern_id not in DEFAULT_PATTERN_LENGTHS:
        raise ValueError(f"Mau khong hop le: {pattern_id}")
    lengths[pattern_id] = clamp_pattern_length(length, DEFAULT_PATTERN_LENGTHS[pattern_id])
    raw["pattern_lengths"] = lengths
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(raw, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    return lengths
