"""Presets + validate config nuoi Hoa."""
from __future__ import annotations

from typing import Any

from src.config import TieNurtureConfig

# Bo thu de xuat tu phan tich DB (8:1)
TIE_NURTURE_PRESETS: dict[str, dict[str, Any]] = {
    "thu_can_bang": {
        "label": "Thu can bang (18/25/3)",
        "gap_min": 18,
        "gap_max": 25,
        "max_bets": 3,
        "stake": 100,
        "payout": 8.0,
        "session_stop_loss": 3000.0,
    },
    "thu_pnl_max": {
        "label": "Thu PnL max (18/35/3)",
        "gap_min": 18,
        "gap_max": 35,
        "max_bets": 3,
        "stake": 100,
        "payout": 8.0,
        "session_stop_loss": 3000.0,
    },
    "goc_nuoi": {
        "label": "Goc nuoi vo han (gap 10)",
        "gap_min": 10,
        "gap_max": 0,
        "max_bets": 0,
        "stake": 100,
        "payout": 8.0,
        "session_stop_loss": 3000.0,
    },
}


def preset_options_for_overlay() -> list[dict[str, Any]]:
    out = [
        {"id": k, "label": v["label"], **{kk: vv for kk, vv in v.items() if kk != "label"}}
        for k, v in TIE_NURTURE_PRESETS.items()
    ]
    out.append(
        {
            "id": "custom",
            "label": "Tuy chinh (sua tung o)",
            "gap_min": 18,
            "gap_max": 25,
            "max_bets": 3,
            "stake": 100,
            "payout": 8.0,
            "session_stop_loss": 3000.0,
        }
    )
    return out


def apply_preset(preset_id: str, base: TieNurtureConfig | None = None) -> TieNurtureConfig:
    cfg = (base or TieNurtureConfig()).model_copy(deep=True)
    pid = (preset_id or "").strip() or "thu_can_bang"
    if pid == "custom":
        cfg.preset = "custom"
        return cfg
    preset = TIE_NURTURE_PRESETS.get(pid)
    if not preset:
        cfg.preset = "custom"
        return cfg
    cfg.preset = pid
    cfg.gap_min = int(preset["gap_min"])
    cfg.gap_max = int(preset["gap_max"])
    cfg.max_bets = int(preset["max_bets"])
    cfg.stake = int(preset["stake"])
    cfg.payout = float(preset["payout"])
    cfg.session_stop_loss = float(preset["session_stop_loss"])
    return cfg


def normalize_tie_nurture_dict(data: dict[str, Any] | None) -> TieNurtureConfig:
    raw = dict(data or {})
    preset = str(raw.get("preset") or "custom").strip() or "custom"
    if preset in TIE_NURTURE_PRESETS and raw.get("apply_preset"):
        cfg = apply_preset(preset)
        cfg.enabled = bool(raw.get("enabled", False))
        return cfg

    def _int(key: str, default: int) -> int:
        try:
            v = int(float(raw.get(key, default) or default))
        except (TypeError, ValueError):
            v = default
        return max(0, v)

    def _float(key: str, default: float) -> float:
        try:
            v = float(raw.get(key, default) or default)
        except (TypeError, ValueError):
            v = default
        return max(0.0, v)

    gap_min = max(1, _int("gap_min", 18))
    gap_max = _int("gap_max", 25)
    max_bets = _int("max_bets", 3)
    stake = max(10, _int("stake", 100))
    payout = _float("payout", 8.0)
    if payout <= 0:
        payout = 8.0
    session_sl = _float("session_stop_loss", 3000.0)
    if gap_max > 0 and gap_max < gap_min:
        gap_max = gap_min

    # Neu khop 1 preset → gan id; khong → custom
    matched = "custom"
    for pid, p in TIE_NURTURE_PRESETS.items():
        if (
            int(p["gap_min"]) == gap_min
            and int(p["gap_max"]) == gap_max
            and int(p["max_bets"]) == max_bets
            and int(p["stake"]) == stake
            and float(p["payout"]) == float(payout)
        ):
            matched = pid
            break
    if preset in TIE_NURTURE_PRESETS and matched == preset:
        matched = preset
    elif preset == "custom" or matched == "custom":
        matched = "custom" if preset == "custom" or matched == "custom" else matched

    return TieNurtureConfig(
        enabled=bool(raw.get("enabled", False)),
        preset=matched if matched != "custom" else ("custom" if preset == "custom" else matched),
        gap_min=gap_min,
        gap_max=gap_max,
        max_bets=max_bets,
        stake=stake,
        payout=payout,
        session_stop_loss=session_sl,
    )


def tie_nurture_to_overlay(cfg: TieNurtureConfig) -> dict[str, Any]:
    return {
        "enabled": bool(cfg.enabled),
        "preset": cfg.preset or "custom",
        "gap_min": int(cfg.gap_min),
        "gap_max": int(cfg.gap_max),
        "max_bets": int(cfg.max_bets),
        "stake": int(cfg.stake),
        "payout": float(cfg.payout),
        "session_stop_loss": float(cfg.session_stop_loss),
        "presets": preset_options_for_overlay(),
    }
