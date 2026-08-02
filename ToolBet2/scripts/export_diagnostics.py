from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.release_support import export_diagnostics


def main() -> int:
    parser = argparse.ArgumentParser(description="Export redacted ToolBet diagnostics")
    parser.add_argument("--output", default="")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--database", default="data/toolbet.db")
    parser.add_argument("--logs", default="logs")
    args = parser.parse_args()
    output = args.output or (
        f"reports/toolbet-diagnostics-{datetime.now():%Y%m%d-%H%M%S}.zip"
    )
    path = export_diagnostics(
        output, config_path=args.config,
        database_path=args.database, log_dir=args.logs,
    )
    print(path.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
