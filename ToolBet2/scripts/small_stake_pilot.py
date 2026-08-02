from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.release_support import configure_console_utf8
from src.small_stake_cli import handle_small_stake_command


def main() -> int:
    configure_console_utf8()
    parser = argparse.ArgumentParser(description="Finite small-stake pilot lease")
    parser.add_argument("action", choices=("arm", "status", "finish", "close"))
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--max-stake", type=int, default=100)
    parser.add_argument("--max-bets", type=int, default=3)
    parser.add_argument("--max-loss", type=float, default=300)
    parser.add_argument("--duration-minutes", type=int, default=30)
    parser.add_argument("--ack", default="")
    args = parser.parse_args()
    argv = [
        "--small-stake-pilot", args.action,
        "--config", args.config,
        "--max-stake", str(args.max_stake),
        "--max-bets", str(args.max_bets),
        "--max-loss", str(args.max_loss),
        "--duration-minutes", str(args.duration_minutes),
        "--ack", args.ack,
    ]
    return handle_small_stake_command(argv)


if __name__ == "__main__":
    raise SystemExit(main())
