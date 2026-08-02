from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.kill_switch import is_kill_switch_active
from src.release_support import pilot_preflight


def _runtime_counts(database: Path) -> tuple[int, int]:
    if not database.exists():
        return 0, 0
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    try:
        tables = {
            row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        pending = (
            connection.execute(
                "SELECT COUNT(*) FROM bets WHERE status IN ('pending','placed') "
                "AND outcome IS NULL"
            ).fetchone()[0]
            if "bets" in tables else 0
        )
        live = (
            connection.execute(
                "SELECT COUNT(*) FROM strategy_tabs WHERE active=1 AND mode='live'"
            ).fetchone()[0]
            if "strategy_tabs" in tables else 0
        )
        return int(pending), int(live)
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Fail-closed pilot readiness check")
    parser.add_argument(
        "stage", choices=("simulation", "shadow", "stake_zero", "small_stake")
    )
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--database", default="data/toolbet.db")
    parser.add_argument("--max-stake", type=int, default=100)
    parser.add_argument("--ack", default="")
    args = parser.parse_args()
    if args.stage == "small_stake" and args.ack != "I ACCEPT SMALL STAKE PILOT":
        print('BLOCK: thêm --ack "I ACCEPT SMALL STAKE PILOT"')
        return 2
    config = yaml.safe_load(Path(args.config).read_text(encoding="utf-8")) or {}
    pending, live = _runtime_counts(Path(args.database))
    errors = pilot_preflight(
        config, stage=args.stage, pending_bets=pending, live_tabs=live,
        maximum_small_stake=max(0, args.max_stake),
        kill_switch_active=is_kill_switch_active(),
    )
    if errors:
        for error in errors:
            print(f"BLOCK: {error}")
        return 2
    print(
        f"PASS: stage={args.stage}; pending={pending}; live_tabs={live}; "
        f"kill_switch={is_kill_switch_active()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
