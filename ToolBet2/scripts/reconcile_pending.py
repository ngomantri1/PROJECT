from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.database import init_db
from src.kill_switch import is_kill_switch_active
from src.pending_reconciliation import (
    RECONCILIATION_ACK,
    ReconciliationError,
    backup_database,
    list_pending_bets,
    reconcile_pending_bet,
)
from src.release_support import configure_console_utf8


def _database_path(config_path: Path, override: str) -> Path:
    config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    configured = str((config.get("database") or {}).get("path") or "data/toolbet.db")
    database = Path(override) if override else Path(configured)
    return database.resolve() if database.is_absolute() else (config_path.parent / database).resolve()


def _list_pending(database: Path) -> int:
    rows = list_pending_bets(database)
    if not rows:
        print("Không có pending.")
        return 0
    for row in rows:
        print(
            f"id={row[0]} round_id={row[1]} table={row[2] or '?'} "
            f"side={row[3]} stake={row[4]} pattern={row[5] or '?'} status={row[6]}"
        )
    return 2


def main() -> int:
    configure_console_utf8()
    parser = argparse.ArgumentParser(
        description="Đối chiếu pending có evidence; không tự suy diễn kết quả"
    )
    parser.add_argument("action", choices=("list", "resolve"))
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--database", default="")
    parser.add_argument("--bet-id", type=int)
    parser.add_argument("--round-id", default="")
    parser.add_argument("--result", choices=("player", "banker", "tie"))
    parser.add_argument("--evidence", default="")
    parser.add_argument("--ack", default="")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    database = _database_path(config_path, args.database)
    if args.action == "list":
        return _list_pending(database)
    if not is_kill_switch_active():
        print("BLOCK: kill switch phải đang bật trước khi đối chiếu DB")
        return 2
    if args.bet_id is None or not args.round_id or not args.result:
        print("BLOCK: resolve cần --bet-id, --round-id và --result")
        return 2
    if args.ack != RECONCILIATION_ACK:
        print(f'BLOCK: thêm --ack "{RECONCILIATION_ACK}"')
        return 2

    backup = backup_database(database)
    try:
        result = reconcile_pending_bet(
            init_db(str(database)),
            bet_id=args.bet_id,
            expected_round_id=args.round_id,
            result=args.result,
            evidence=args.evidence,
            acknowledgement=args.ack,
        )
    except (ReconciliationError, OSError, RuntimeError) as exc:
        print(f"BLOCK: {exc}")
        print(f"Backup giữ tại: {backup}")
        return 2
    print(
        f"PASS: bet={result.bet_id} round={result.round_id} "
        f"result={result.result} outcome={result.outcome} profit={result.profit:+.2f}"
    )
    print(f"Backup: {backup}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
