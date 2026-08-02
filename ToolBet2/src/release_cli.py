"""Small maintenance CLI embedded in the packaged ToolBet executable."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

import yaml

from src.database import init_db
from src.kill_switch import is_kill_switch_active
from src.pending_reconciliation import (
    RECONCILIATION_ACK,
    ReconciliationError,
    backup_database,
    list_pending_bets,
    reconcile_pending_bet,
)
from src.release_support import (
    configure_console_utf8,
    export_diagnostics,
    inspect_license_readiness,
    inspect_pilot_runtime,
    pilot_preflight,
)
from src.stake_zero_audit import inspect_stake_zero_window, latest_bet_id
from src.small_stake_cli import handle_small_stake_command


def handle_release_command(argv: list[str]) -> int | None:
    configure_console_utf8()
    if "--small-stake-pilot" in argv:
        return handle_small_stake_command(argv)
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
    if "--stake-zero-audit" in argv:
        index = argv.index("--stake-zero-audit")
        action = argv[index + 1] if len(argv) > index + 1 else ""
        if action not in {"start", "finish"}:
            print("BLOCK: stake-zero audit action phải là start hoặc finish")
            return 2
        config = yaml.safe_load(Path("config.yaml").read_text(encoding="utf-8")) or {}
        database = Path(
            str((config.get("database") or {}).get("path") or "data/toolbet.db")
        )
        runtime = inspect_pilot_runtime(database)
        errors = pilot_preflight(
            config,
            stage="stake_zero",
            runtime=runtime,
            kill_switch_active=is_kill_switch_active(),
        )
        for error in errors:
            print(f"BLOCK: {error}")
        if errors:
            return 2
        if action == "start":
            print(
                json.dumps(
                    {
                        "stage": "stake_zero",
                        "baseline_bet_id": latest_bet_id(database),
                        "kill_switch_active": is_kill_switch_active(),
                        "authoritative_stakes": list(runtime.authoritative_stakes),
                    },
                    ensure_ascii=False,
                )
            )
            return 0
        try:
            pos = argv.index("--after-bet-id")
            after_bet_id = int(argv[pos + 1])
        except (ValueError, IndexError):
            print("BLOCK: finish yêu cầu --after-bet-id hợp lệ")
            return 2
        evidence = inspect_stake_zero_window(
            database, after_bet_id=after_bet_id
        )
        payload = evidence.to_dict()
        payload["stage"] = "stake_zero"
        payload["kill_switch_active"] = is_kill_switch_active()
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0 if evidence.passed else 2
    if "--reconcile-pending" in argv:
        index = argv.index("--reconcile-pending")
        action = argv[index + 1] if len(argv) > index + 1 else ""
        if action not in {"list", "resolve"}:
            print("BLOCK: reconcile action phải là list hoặc resolve")
            return 2
        config = yaml.safe_load(Path("config.yaml").read_text(encoding="utf-8")) or {}
        database = Path(
            str((config.get("database") or {}).get("path") or "data/toolbet.db")
        )
        rows = list_pending_bets(database)
        if action == "list":
            for row in rows:
                print(
                    f"id={row[0]} round_id={row[1]} table={row[2] or '?'} "
                    f"side={row[3]} stake={row[4]} pattern={row[5] or '?'} "
                    f"status={row[6]}"
                )
            if not rows:
                print("Không có pending.")
                return 0
            return 2

        def value(flag: str) -> str:
            try:
                pos = argv.index(flag)
            except ValueError:
                return ""
            return argv[pos + 1] if len(argv) > pos + 1 else ""

        if not is_kill_switch_active():
            print("BLOCK: kill switch phải đang bật trước khi đối chiếu DB")
            return 2
        if value("--ack") != RECONCILIATION_ACK:
            print(f'BLOCK: thêm --ack "{RECONCILIATION_ACK}"')
            return 2
        try:
            bet_id = int(value("--bet-id"))
            round_id = value("--round-id")
            game_result = value("--result")
            evidence = value("--evidence")
        except ValueError:
            print("BLOCK: --bet-id không hợp lệ")
            return 2
        if not round_id or game_result not in {"player", "banker", "tie"}:
            print("BLOCK: thiếu round-id hoặc result không hợp lệ")
            return 2
        backup = backup_database(database)
        try:
            reconciled = reconcile_pending_bet(
                init_db(str(database)),
                bet_id=bet_id,
                expected_round_id=round_id,
                result=game_result,
                evidence=evidence,
                acknowledgement=RECONCILIATION_ACK,
            )
        except (ReconciliationError, OSError, RuntimeError) as exc:
            print(f"BLOCK: {exc}")
            print(f"Backup giữ tại: {backup}")
            return 2
        print(
            f"PASS: bet={reconciled.bet_id} round={reconciled.round_id} "
            f"result={reconciled.result} outcome={reconciled.outcome} "
            f"profit={reconciled.profit:+.2f}"
        )
        print(f"Backup: {backup}")
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
    database = Path(str((config.get("database") or {}).get("path") or "data/toolbet.db"))
    runtime = inspect_pilot_runtime(database)
    license_errors = (
        inspect_license_readiness(config)
        if stage == "small_stake"
        else ()
    )
    errors = pilot_preflight(
        config, stage=stage, runtime=runtime,
        kill_switch_active=is_kill_switch_active(),
        license_errors=license_errors,
    )
    for error in errors:
        print(f"BLOCK: {error}")
    if errors:
        return 2
    print(
        f"PASS: {stage}; pending={runtime.pending_bets}; "
        f"live_tabs={runtime.live_tabs}; max_stake={runtime.maximum_stake}"
    )
    return 0
