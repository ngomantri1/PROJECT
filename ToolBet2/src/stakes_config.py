from __future__ import annotations

import ast
import re
from pathlib import Path

import yaml


DEFAULT_STAKES = [0, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220, 240, 260, 280, 300]


def format_stakes(stakes: list[int]) -> str:
    return "[" + ", ".join(str(s) for s in stakes) + "]"


def parse_stakes_text(text: str) -> list[int]:
    """Parse '[20, 50, 100]' hoac '20, 50, 100'."""
    raw = (text or "").strip()
    if not raw:
        raise ValueError("Chuoi cuoc trong")

    if raw.startswith("["):
        parsed = ast.literal_eval(raw)
        if not isinstance(parsed, list) or not parsed:
            raise ValueError("Mang cuoc khong hop le")
        stakes = [int(x) for x in parsed]
    else:
        parts = re.split(r"[,;\s]+", raw)
        stakes = [int(p) for p in parts if p.strip()]

    if not stakes:
        raise ValueError("Can it nhat 1 muc cuoc")
    if any(s < 0 for s in stakes):
        raise ValueError("Muc cuoc khong duoc am")
    return stakes


def save_stakes_to_config(stakes: list[int], config_path: str | Path = "config.yaml") -> None:
    from src.betting_config import save_betting_to_config

    save_betting_to_config(config_path=config_path, stakes=stakes)
