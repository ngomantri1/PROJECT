"""Small maintenance CLI embedded in the packaged ToolBet executable."""

from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

import yaml

from src.kill_switch import is_kill_switch_active
from src.release_support import export_diagnostics, pilot_preflight


def _counts(path: Path) -> tuple[int, int]:
    if not path.exists():
        return 0, 0
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        tables = {
            row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        pending = 0
        live = 0
        if "bets" in tables:
            pending = int(connection.execute(
                "SELECT COUNT(*) FROM bets WHERE status IN ('pending','placed') "
                "AND outcome IS NULL"
            ).fetchone()[0])
        if "strategy_tabs" in tables:
            live = int(connection.execute(
                "SELECT COUNT(*) FROM strategy_tabs WHERE active=1 AND mode='live'"
            ).fetchone()[0])
        return pending, live
    finally:
        connection.close()


def handle_release_command(argv: list[str]) -> int | None:
    if "--self-check" in argv:
        try:
            import ddddocr
            from playwright._impl._driver import compute_driver_executable
            from src.overlay import GameOverlay
            from src.strategy_tabs import (
                StrategyTabsConfig,
                strategy_tabs_to_overlay,
            )
            from src.ui_assets import load_ui_assets

            executable, driver_cli = compute_driver_executable()
            if not Path(executable).exists() or not Path(driver_cli).exists():
                raise RuntimeError("Playwright driver không đầy đủ")
            bundle = load_ui_assets()
            if not bundle.theme_css or not bundle.bridge_js:
                raise RuntimeError("UI assets không đầy đủ")
            # Constructor loads packaged ONNX/model assets and native runtime.
            _ = ddddocr.DdddOcr(show_ad=False)
            connection = sqlite3.connect(":memory:")
            connection.execute("SELECT 1").fetchone()
            connection.close()
            overlay = GameOverlay()
            overlay.set_strategy_tabs(
                strategy_tabs_to_overlay(
                    StrategyTabsConfig(), [], skip_tie=True
                )
            )
            workspace = overlay._build_ui_snapshot().state["strategy_tabs"]
            if not workspace.get("strategies"):
                raise RuntimeError("UI không có catalog chiến lược")
            if not workspace.get("money_managers"):
                raise RuntimeError("UI không có catalog quản lý vốn")
        except Exception as exc:
            print(f"BLOCK: self-check {type(exc).__name__}: {exc}")
            return 2
        print("PASS: playwright + UI assets/catalogues + ddddocr + SQLite")
        return 0
    if "--diagnostics" in argv:
        output = Path("reports") / (
            f"toolbet-diagnostics-{datetime.now():%Y%m%d-%H%M%S}.zip"
        )
        print(export_diagnostics(output).resolve())
        return 0
    if "--pilot-preflight" not in argv:
        return None
    index = argv.index("--pilot-preflight")
    stage = argv[index + 1] if len(argv) > index + 1 else ""
    if stage not in {"simulation", "shadow", "stake_zero", "small_stake"}:
        print("BLOCK: stage không hợp lệ")
        return 2
    if stage == "small_stake" and "--ack-small-stake" not in argv:
        print("BLOCK: thiếu --ack-small-stake")
        return 2
    config = yaml.safe_load(Path("config.yaml").read_text(encoding="utf-8")) or {}
    pending, live = _counts(Path("data/toolbet.db"))
    errors = pilot_preflight(
        config, stage=stage, pending_bets=pending, live_tabs=live,
        kill_switch_active=is_kill_switch_active(),
    )
    for error in errors:
        print(f"BLOCK: {error}")
    if errors:
        return 2
    print(f"PASS: {stage}; pending={pending}; live_tabs={live}")
    return 0
