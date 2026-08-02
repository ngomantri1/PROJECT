from __future__ import annotations

import argparse
from pathlib import Path

import yaml


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--channel", choices=("internal", "customer"), required=True)
    parser.add_argument("--license-url", default="")
    args = parser.parse_args()
    data = yaml.safe_load(Path(args.source).read_text(encoding="utf-8")) or {}
    data.setdefault("betting", {})["auto_bet"] = False
    if args.channel == "customer":
        data.setdefault("tool_auth", {})["bootstrap_password"] = ""
    data.setdefault("license", {})["enabled"] = args.channel == "customer"
    if args.channel == "customer":
        data["license"]["api_url"] = args.license_url
        data["license"]["public_key_path"] = "data/license_public.pem"
    Path(args.output).write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
