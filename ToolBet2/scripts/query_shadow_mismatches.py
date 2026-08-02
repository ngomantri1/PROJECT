"""List redacted decision-shadow mismatches stored in the ToolBet database."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.database import EventRecord, init_db


def main() -> None:
    parser = argparse.ArgumentParser(description="Decision shadow mismatches")
    parser.add_argument("--db", default=str(ROOT / "data" / "toolbet.db"))
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    session_factory = init_db(args.db)
    session = session_factory()
    try:
        rows = session.scalars(
            select(EventRecord)
            .where(EventRecord.event_type == "decision_shadow_mismatch")
            .order_by(EventRecord.id.desc())
            .limit(max(1, args.limit))
        ).all()
        if not rows:
            print("No decision shadow mismatches.")
            return
        for row in rows:
            try:
                payload = json.loads(row.payload or "{}")
            except json.JSONDecodeError:
                payload = {}
            old = payload.get("legacy") or {}
            new = payload.get("shadow") or {}
            strategy = new.get("strategy") or {}
            money = new.get("money") or {}
            risk = new.get("risk") or {}
            print(
                f"#{row.id} {row.created_at} | table={payload.get('table_name') or '?'} "
                f"history={payload.get('history_size') or 0} "
                f"mismatch={','.join(payload.get('mismatches') or [])}"
            )
            print(
                "    "
                f"old={old.get('signal_id') or '-'}:{old.get('side') or '-'} "
                f"stake={old.get('stake')} arm={old.get('wants_arm')} | "
                f"new={strategy.get('signal_id') or '-'}:{strategy.get('side') or '-'} "
                f"stake={money.get('stake')} arm={new.get('wants_arm')} "
                f"risk={risk.get('code') or '-'}"
            )
    finally:
        session.close()


if __name__ == "__main__":
    main()
