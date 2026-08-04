from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.release_support import (
    configure_console_utf8,
    inspect_license_readiness,
    inspect_pilot_runtime,
    pilot_preflight,
)


def main() -> int:
    configure_console_utf8()
    parser = argparse.ArgumentParser(description="Fail-closed pilot readiness check")
    parser.add_argument(
        "stage", choices=("simulation", "shadow", "stake_zero", "small_stake")
    )
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--database", default="")
    parser.add_argument("--max-stake", type=int, default=100)
    parser.add_argument("--ack", default="")
    args = parser.parse_args()
    if args.stage == "small_stake" and args.ack != "I ACCEPT SMALL STAKE PILOT":
        print('BLOCK: thêm --ack "I ACCEPT SMALL STAKE PILOT"')
        return 2
    config_path = Path(args.config).resolve()
    config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    configured_database = str((config.get("database") or {}).get("path") or "data/toolbet.db")
    database = Path(args.database) if args.database else Path(configured_database)
    if not database.is_absolute():
        database = config_path.parent / database
    runtime = inspect_pilot_runtime(database)
    license_errors = (
        inspect_license_readiness(config, config_dir=config_path.parent)
        if args.stage == "small_stake"
        else ()
    )
    errors = pilot_preflight(
        config, stage=args.stage, runtime=runtime,
        maximum_small_stake=max(0, args.max_stake),
        license_errors=license_errors,
    )
    if errors:
        for error in errors:
            print(f"BLOCK: {error}")
        return 2
    print(
        f"PASS: stage={args.stage}; pending={runtime.pending_bets}; "
        f"live_tabs={runtime.live_tabs}; max_stake={runtime.maximum_stake}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
