from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field

from src.strategy_tabs import StrategyTabsConfig


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


class UiConfig(BaseModel):
    # Giai doan C: workspace HTML la mac dinh; legacy van co the bat lai de rollback.
    runtime_v2_enabled: bool = True
    legacy_overlay_enabled: bool = False


class ToolAuthConfig(BaseModel):
    """Local development identity; licensing replaces this in the release phase."""

    enabled: bool = True
    account_store_path: str = "data/tool_accounts.json"
    remembered_credentials_path: str = "data/tool_login.bin"
    bootstrap_username: str = "toolbet"
    bootstrap_password: str = "toolbet"
    session_timeout_minutes: int = Field(default=480, ge=1, le=1440)


class LicenseConfig(BaseModel):
    """Remote license client; provider selects signed or reference lease mode."""

    enabled: bool = False
    provider: Literal["signed", "baccarat_chrome_agent2"] = "signed"
    api_url: str = "http://127.0.0.1:8765"
    public_key_path: str = "data/license_public.pem"
    cache_path: str = "data/license_session.bin"
    timeout_seconds: float = Field(default=8.0, ge=1.0, le=60.0)
    grace_minutes: int = Field(default=60, ge=0, le=1440)
    refresh_before_minutes: int = Field(default=5, ge=1, le=60)
    github_raw_base_url: str = "https://raw.githubusercontent.com"
    github_owner: str = "ngomantri1"
    github_repo: str = "licenses"
    github_branch: str = "main"
    github_license_path: str = "auto"
    lease_base_url: str = "https://net88.ngomantri1.workers.dev/lease/auto"
    lease_app_id: str = "BaccaratChromeAgent"
    heartbeat_seconds: int = Field(default=600, ge=15, le=600)
    reference_client_id_path: str = "data/reference_license_client_id.txt"


class LiveExecutionConfig(BaseModel):
    """Policy for physical execution; it never replaces the safety gates."""

    mode: Literal["disabled", "pilot", "production"] = "pilot"


class AppConfig(BaseModel):
    site: SiteConfig = Field(default_factory=SiteConfig)
    account: AccountConfig = Field(default_factory=AccountConfig)
    game: GameConfig = Field(default_factory=GameConfig)
    betting: BettingConfig = Field(default_factory=BettingConfig)
    strategy_tabs: StrategyTabsConfig = Field(default_factory=StrategyTabsConfig)
    patterns: dict[str, bool] = Field(default_factory=dict)
    pattern_lengths: dict[str, int] = Field(default_factory=dict)
    rules: list[dict[str, Any]] = Field(default_factory=list)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    ui: UiConfig = Field(default_factory=UiConfig)
    tool_auth: ToolAuthConfig = Field(default_factory=ToolAuthConfig)
    license: LicenseConfig = Field(default_factory=LicenseConfig)
    live_execution: LiveExecutionConfig = Field(default_factory=LiveExecutionConfig)


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
