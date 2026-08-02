"""Liet ke lich su cuoc voi day du: sanh, ban, mau, ly do, thoi gian."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.bet_analytics import list_bets
from src.database import init_db


def main() -> None:
    parser = argparse.ArgumentParser(description="Lich su cuoc")
    parser.add_argument("--db", default=str(ROOT / "data" / "toolbet.db"))
    parser.add_argument("--date", default=None, help="Loc theo ngay YYYY-MM-DD")
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()

    session_factory = init_db(args.db)
    session = session_factory()
    try:
        for r in list_bets(session, limit=args.limit, session_date=args.date):
            profit = r["profit"]
            profit_s = f"{profit:+.0f}" if profit is not None else "?"
            print(
                f"#{r['id']} {r['placed_at']} | {r['hall_name'] or r['hall_id']} | "
                f"{r['table_name']} shoe={r['game_shoe']} rnd={r['game_round']} | "
                f"{r['pattern_name']} ({r['pattern_id']}) | {r['side']} {r['stake']} "
                f"-> {r['outcome']} {profit_s}"
            )
            if r["reason"]:
                print(f"    ly do: {r['reason']}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
