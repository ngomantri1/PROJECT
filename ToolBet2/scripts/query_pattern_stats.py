"""In bang tong hop ty le thang theo mau (theo ngay va tat ca)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.bet_analytics import run_pattern_stats_report
from src.database import init_db


def main() -> None:
    parser = argparse.ArgumentParser(description="Thong ke ty le thang theo mau")
    parser.add_argument("--db", default=str(ROOT / "data" / "toolbet.db"))
    parser.add_argument("--date", default=None, help="Loc theo ngay YYYY-MM-DD")
    args = parser.parse_args()

    session_factory = init_db(args.db)
    print(run_pattern_stats_report(session_factory, session_date=args.date))


if __name__ == "__main__":
    main()
