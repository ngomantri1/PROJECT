"""Shared source/packaged CLI for finite small-stake canaries."""

from __future__ import annotations

import json
import os
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

from src.release_support import (
    inspect_license_readiness,
    inspect_pilot_runtime,
    pilot_preflight,
)
from src.small_stake_guard import (
    SMALL_STAKE_ACK,
    SmallStakePilotGuard,
    arm_small_stake_pilot,
    default_lease_path,
)


def _value(argv: list[str], flag: str, default: str = "") -> str:
    try:
        index = argv.index(flag)
    except ValueError:
        return default
    return argv[index + 1] if len(argv) > index + 1 else default


def handle_small_stake_command(argv: list[str], *, config_flag: str = "--config") -> int:
    action = _value(argv, "--small-stake-pilot")
    if action not in {"arm", "status", "finish", "close"}:
        print("BLOCK: small-stake action phải là arm, status, finish hoặc close")
        return 2
    config_path = Path(_value(argv, config_flag, "config.yaml")).resolve()
    config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    database = Path(str((config.get("database") or {}).get("path") or "data/toolbet.db"))
    if not database.is_absolute():
        database = config_path.parent / database
    database = database.resolve()
    lease_path = default_lease_path(database)
    guard = SmallStakePilotGuard(database, lease_path)

    if action == "status":
        try:
            lease = guard.load_lease()
        except Exception as exc:
            print(f"BLOCK: không có lease canary hợp lệ: {type(exc).__name__}")
            return 2
        decision = guard.evaluate(
            stake=lease.max_stake,
            tab_ids=[lease.allowed_tab_id],
            bet_kind="main",
        )
        print(json.dumps(
            {
                "active": decision.allowed,
                "reason": decision.reason,
                **asdict(lease),
            },
            ensure_ascii=False,
            indent=2,
        ))
        return 0 if decision.allowed else 2
    if action == "finish":
        evidence = guard.finish_evidence()
        print(json.dumps(evidence.to_dict(), ensure_ascii=False, indent=2))
        return 0 if evidence.passed else 2
    if action == "close":
        if not lease_path.is_file():
            print("PASS: không có lease canary đang hoạt động")
            return 0
        revoked = lease_path.with_name(
            f"{lease_path.stem}.revoked-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.json"
        )
        os.replace(lease_path, revoked)
        print(f"PASS: đã đóng lease; bản lưu: {revoked}")
        return 0

    try:
        max_stake = int(_value(argv, "--max-stake", "100"))
        max_bets = int(_value(argv, "--max-bets", "3"))
        max_loss = float(_value(argv, "--max-loss", "300"))
        duration = int(_value(argv, "--duration-minutes", "30"))
    except ValueError:
        print("BLOCK: giới hạn canary không hợp lệ")
        return 2
    runtime = inspect_pilot_runtime(database)
    errors = pilot_preflight(
        config,
        stage="small_stake",
        runtime=runtime,
        maximum_small_stake=max_stake,
        license_errors=inspect_license_readiness(config, config_dir=config_path.parent),
    )
    if lease_path.exists():
        errors.append("Đã có lease canary; phải close trước khi arm lại")
    if _value(argv, "--ack") != SMALL_STAKE_ACK:
        errors.append(f'thêm --ack "{SMALL_STAKE_ACK}"')
    if errors:
        for error in errors:
            print(f"BLOCK: {error}")
        return 2
    try:
        lease = arm_small_stake_pilot(
            database,
            lease_path,
            runtime=runtime,
            max_stake=max_stake,
            max_bets=max_bets,
            max_loss=max_loss,
            duration_minutes=duration,
            acknowledgement=SMALL_STAKE_ACK,
        )
    except (OSError, ValueError) as exc:
        print(f"BLOCK: {exc}")
        return 2
    print(json.dumps({"armed": True, **asdict(lease)}, ensure_ascii=False, indent=2))
    return 0
