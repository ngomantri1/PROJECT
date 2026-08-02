from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class SiteConfig(BaseModel):
    url: str = "https://vipbet389.com/"
    cdp_url: str = "http://localhost:9222"


class AccountConfig(BaseModel):
    username: str = ""
    password: str = ""


class GameConfig(BaseModel):
    table_name: str = ""  # vd: VNB01, SB01
    table_id: int | None = None
    provider: str = "ae_sexy"
    skip_tie: bool = True


class TieNurtureConfig(BaseModel):
    """Nuoi Hoa: bat/tat + gap + cat som (bo thu / tuy chinh)."""

    enabled: bool = False
    preset: str = "thu_can_bang"  # thu_can_bang | thu_pnl_max | goc_nuoi | custom
    gap_min: int = 18
    gap_max: int = 25  # 0 = khong gioi han
    max_bets: int = 3  # 0 = nuoi den Hoa
    stake: int = 100
    payout: float = 8.0  # 8 = 8:1
    session_stop_loss: float = 3000.0  # 0 = tat SL rieng mode Hoa


class BettingConfig(BaseModel):
    stakes: list[int] = Field(
        default_factory=lambda: [
            0, 100, 110, 120, 130, 140, 150, 160, 170,
            180, 190, 200, 220, 240, 260, 280, 300,
        ]
    )
    default_side: str = "player"
    auto_bet: bool = False
    stop_loss: float = 0.0  # 0 = khong gioi han (PnL hom nay)
    take_profit: float = 0.0  # 0 = khong gioi han (PnL hom nay)
    group_take_profit: float = 80.0  # dong nhom khi PnL nhom >= gia tri nay; 0 = tat
    group_stop_loss: float = 200.0  # dong nhom khi PnL nhom <= -gia tri nay; 0 = tat
    progression_mode: str = "loss_up_win_reset"  # cach tang chuoi stake trong nhom
    # Mode1: thua ve stake 0 cho thang; thang o 0 moi nhay gỡ theo loss_count
    loss_watch_recover: bool = False
    # Mode danh Hoa: sau gap_min phien khong Hoa → nuoi Hoa stake den Hoa / cat
    tie_nurture: TieNurtureConfig = Field(default_factory=TieNurtureConfig)


class StreakRuleConfig(BaseModel):
    type: str = "streak"
    name: str = ""
    min_streak: int = 3
    side: str = "player"  # player | banker | any
    bet_side: str = "follow"  # follow | player | banker
    enabled: bool = True


class AlternatingRuleConfig(BaseModel):
    type: str = "alternating"
    name: str = ""
    min_pairs: int = 2
    start_side: str = "player"
    bet_side: str = "player"
    enabled: bool = True


class DatabaseConfig(BaseModel):
    path: str = "data/toolbet.db"


class LoggingConfig(BaseModel):
    level: str = "INFO"


class AppConfig(BaseModel):
    site: SiteConfig = Field(default_factory=SiteConfig)
    account: AccountConfig = Field(default_factory=AccountConfig)
    game: GameConfig = Field(default_factory=GameConfig)
    betting: BettingConfig = Field(default_factory=BettingConfig)
    patterns: dict[str, bool] = Field(default_factory=dict)
    pattern_lengths: dict[str, int] = Field(default_factory=dict)
    rules: list[dict[str, Any]] = Field(default_factory=list)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)


def load_config(path: str | Path = "config.yaml") -> AppConfig:
    config_path = Path(path)
    if not config_path.exists():
        config_path = Path("config.example.yaml")
    with config_path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return AppConfig.model_validate(raw)


def config_path_resolved(path: str | Path = "config.yaml") -> Path:
    p = Path(path)
    return p if p.exists() else Path("config.example.yaml")


def update_site_url(url: str, path: str | Path = "config.yaml") -> AppConfig:
    """Cap nhat site.url trong config.yaml va tra AppConfig moi."""
    from src.credentials import normalize_site_url

    config_path = Path(path)
    if not config_path.exists():
        config_path = Path("config.example.yaml")
    with config_path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    if not isinstance(raw, dict):
        raw = {}
    site = raw.get("site") if isinstance(raw.get("site"), dict) else {}
    site = dict(site)
    site["url"] = normalize_site_url(url)
    raw["site"] = site
    out = Path(path)
    with out.open("w", encoding="utf-8") as f:
        yaml.safe_dump(raw, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    return AppConfig.model_validate(raw)
