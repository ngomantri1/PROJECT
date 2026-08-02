"""Release integrity, redacted diagnostics and pilot preflight helpers."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import platform
import re
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Iterable

import yaml

_SECRET_KEYS = {
    "password", "passwd", "token", "refresh_token", "access_token", "cookie",
    "authorization", "secret", "api_key", "bootstrap_password",
}
_INLINE_SECRET = re.compile(
    r"(?i)\b(password|passwd|token|refresh[_-]?token|authorization|cookie|secret|api[_-]?key)"
    r"(\s*[=:]\s*)([^\s,;]+)"
)
_URL_CREDENTIAL = re.compile(r"(?i)(https?://)([^/@:\s]+):([^/@\s]+)@")


def redact_text(value: str) -> str:
    text = _URL_CREDENTIAL.sub(r"\1***:***@", str(value))
    return _INLINE_SECRET.sub(lambda match: f"{match.group(1)}{match.group(2)}***", text)


def redact_mapping(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): (
                "***" if str(key).lower() in _SECRET_KEYS
                else redact_mapping(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_mapping(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    return value


class SecretRedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
            record.msg = redact_text(message)
            record.args = ()
        except Exception:
            record.msg = "[log redaction failed]"
            record.args = ()
        return True


def configure_runtime_logging(log_dir: str | Path = "logs") -> Path:
    directory = Path(log_dir)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "toolbet.log"
    root = logging.getLogger()
    if not any(getattr(handler, "_toolbet_release_handler", False) for handler in root.handlers):
        handler = RotatingFileHandler(
            target, maxBytes=5 * 1024 * 1024, backupCount=4, encoding="utf-8"
        )
        handler._toolbet_release_handler = True  # type: ignore[attr-defined]
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s"
        ))
        handler.addFilter(SecretRedactionFilter())
        root.addHandler(handler)
    for handler in root.handlers:
        if not any(isinstance(item, SecretRedactionFilter) for item in handler.filters):
            handler.addFilter(SecretRedactionFilter())
    return target


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_integrity_manifest(
    root: str | Path,
    *,
    excluded_names: Iterable[str] = ("release-manifest.json",),
) -> dict[str, Any]:
    base = Path(root).resolve()
    excluded = set(excluded_names)
    files = {
        path.relative_to(base).as_posix(): sha256_file(path)
        for path in sorted(base.rglob("*"))
        if path.is_file() and path.name not in excluded
    }
    return {
        "schema_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }


def verify_integrity_manifest(root: str | Path, manifest: dict[str, Any]) -> list[str]:
    base = Path(root).resolve()
    errors: list[str] = []
    for relative, expected in (manifest.get("files") or {}).items():
        path = (base / relative).resolve()
        if base not in path.parents:
            errors.append(f"invalid_path:{relative}")
        elif not path.is_file():
            errors.append(f"missing:{relative}")
        elif sha256_file(path) != expected:
            errors.append(f"changed:{relative}")
    return errors


def _database_summary(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"exists": False}
    try:
        connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            tables = [
                row[0] for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
                )
            ]
            safe_counts = {}
            for table in ("rounds", "bets", "events", "strategy_tabs"):
                if table in tables:
                    safe_counts[table] = connection.execute(
                        f'SELECT COUNT(*) FROM "{table}"'
                    ).fetchone()[0]
            return {"exists": True, "tables": tables, "counts": safe_counts}
        finally:
            connection.close()
    except Exception as exc:
        return {"exists": True, "error": type(exc).__name__}


def export_diagnostics(
    output_path: str | Path,
    *,
    config_path: str | Path = "config.yaml",
    database_path: str | Path = "data/toolbet.db",
    log_dir: str | Path = "logs",
) -> Path:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    config_file = Path(config_path)
    raw_config: Any = {}
    if config_file.exists():
        raw_config = yaml.safe_load(config_file.read_text(encoding="utf-8")) or {}
    summary = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "platform": platform.platform(),
        "python": sys.version.split()[0],
        "frozen": bool(getattr(sys, "frozen", False)),
        "cwd": "<redacted>",
        "database": _database_summary(Path(database_path)),
        "kill_switch": (Path("data") / "KILL_SWITCH").exists(),
    }
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("system.json", json.dumps(summary, ensure_ascii=False, indent=2))
        archive.writestr(
            "config.redacted.yaml",
            yaml.safe_dump(redact_mapping(raw_config), allow_unicode=True, sort_keys=False),
        )
        for log_path in sorted(Path(log_dir).glob("toolbet.log*")):
            content = log_path.read_text(encoding="utf-8", errors="replace")
            archive.writestr(f"logs/{log_path.name}", redact_text(content))
    return output


def pilot_preflight(
    config: dict[str, Any],
    *,
    stage: str,
    pending_bets: int = 0,
    live_tabs: int = 0,
    maximum_small_stake: int = 100,
    kill_switch_active: bool = False,
) -> list[str]:
    errors: list[str] = []
    betting = config.get("betting") or {}
    license_cfg = config.get("license") or {}
    stakes = [int(value) for value in (betting.get("stakes") or [])]
    auto_bet = bool(betting.get("auto_bet"))
    if pending_bets:
        errors.append("Có cược pending; không được đổi giai đoạn pilot")
    if live_tabs > 1:
        errors.append("Có nhiều hơn một tab live")
    if stage in {"simulation", "shadow"} and auto_bet:
        errors.append("Simulation/shadow yêu cầu auto_bet=false")
    if stage == "stake_zero" and any(stakes):
        errors.append("Pilot stake 0 yêu cầu toàn bộ chuỗi tiền bằng 0")
    if stage == "small_stake":
        if not license_cfg.get("enabled"):
            errors.append("Pilot tiền thật yêu cầu license.enabled=true")
        if not stakes or max(stakes) > maximum_small_stake:
            errors.append(f"Stake vượt ngưỡng pilot {maximum_small_stake}")
        if kill_switch_active:
            errors.append("Kill switch đang bật")
    return errors
