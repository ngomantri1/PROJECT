from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.kill_switch import is_kill_switch_active
from src.release_support import (
    configure_console_utf8,
    inspect_pilot_runtime,
    pilot_preflight,
)
from src.stake_zero_audit import inspect_stake_zero_window, latest_bet_id


def _paths(config_value: str, database_value: str) -> tuple[Path, Path, dict]:
    config_path = Path(config_value).resolve()
    config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    configured = str((config.get("database") or {}).get("path") or "data/toolbet.db")
    database = Path(database_value) if database_value else Path(configured)
    if not database.is_absolute():
        database = config_path.parent / database
    return config_path, database.resolve(), config


def main() -> int:
    configure_console_utf8()
    parser = argparse.ArgumentParser(
        description="Tạo bằng chứng read-only cho cửa sổ pilot stake-zero"
    )
    parser.add_argument("action", choices=("start", "finish"))
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--database", default="")
    parser.add_argument("--after-bet-id", type=int, default=-1)
    parser.add_argument("--output", default="")
    args = parser.parse_args()
    _config_path, database, config = _paths(args.config, args.database)

    runtime = inspect_pilot_runtime(database)
    errors = pilot_preflight(
        config,
        stage="stake_zero",
        runtime=runtime,
        kill_switch_active=is_kill_switch_active(),
    )
    if errors:
        for error in errors:
            print(f"BLOCK: {error}")
        return 2

    if args.action == "start":
        baseline = latest_bet_id(database)
        print(
            json.dumps(
                {
                    "stage": "stake_zero",
                    "baseline_bet_id": baseline,
                    "kill_switch_active": is_kill_switch_active(),
                    "authoritative_stakes": list(runtime.authoritative_stakes),
                },
                ensure_ascii=False,
            )
        )
        return 0

    if args.after_bet_id < 0:
        print("BLOCK: finish yêu cầu --after-bet-id từ lệnh start")
        return 2
    evidence = inspect_stake_zero_window(
        database, after_bet_id=args.after_bet_id
    )
    payload = evidence.to_dict()
    payload["stage"] = "stake_zero"
    payload["kill_switch_active"] = is_kill_switch_active()
    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        output = Path(args.output).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered + "\n", encoding="utf-8")
        print(output)
    else:
        print(rendered)
    return 0 if evidence.passed else 2


if __name__ == "__main__":
    raise SystemExit(main())
