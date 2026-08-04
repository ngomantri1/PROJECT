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
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

import yaml

_SECRET_KEYS = {
    "password", "passwd", "token", "refresh_token", "access_token", "cookie",
    "authorization", "secret", "api_key", "bootstrap_password", "username",
}
_INLINE_SECRET = re.compile(
    r"(?i)\b(password|passwd|token|refresh[_-]?token|authorization|cookie|secret|api[_-]?key|username|user)"
    r"(\s*[=:]\s*)([^\s,;]+)"
)
_URL_CREDENTIAL = re.compile(r"(?i)(https?://)([^/@:\s]+):([^/@\s]+)@")
_LOGIN_IDENTIFIER = re.compile(
    r"(?i)((?:dang nhap|đăng nhập)[^\r\n:]{0,80}(?:thanh cong|thành công)\s*:\s*)"
    r"([^\s,;]+)"
)


def configure_console_utf8() -> None:
    """Keep maintenance CLI output readable on Windows code-page consoles."""

    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError):
                pass


def redact_text(value: str) -> str:
    text = _URL_CREDENTIAL.sub(r"\1***:***@", str(value))
    text = _INLINE_SECRET.sub(
        lambda match: f"{match.group(1)}{match.group(2)}***", text
    )
    return _LOGIN_IDENTIFIER.sub(lambda match: f"{match.group(1)}***", text)


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


@dataclass(frozen=True, slots=True)
class PilotRuntimeState:
    database_exists: bool
    pending_bets: int = 0
    live_tabs: int = 0
    authoritative_stakes: tuple[int, ...] = ()
    live_tab_ids: tuple[str, ...] = ()
    errors: tuple[str, ...] = ()

    @property
    def maximum_stake(self) -> int:
        return max(self.authoritative_stakes, default=0)


def _stake_list(raw: str | None, *, label: str) -> list[int]:
    try:
        values = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} không phải JSON hợp lệ") from exc
    if not isinstance(values, list):
        raise ValueError(f"{label} phải là danh sách")
    try:
        stakes = [int(value) for value in values]
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} chứa mức tiền không hợp lệ") from exc
    if any(value < 0 for value in stakes):
        raise ValueError(f"{label} chứa mức tiền âm")
    return stakes


def _stake_chains(raw: str | None, *, label: str) -> list[list[int]]:
    try:
        values = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} không phải JSON hợp lệ") from exc
    if not isinstance(values, list):
        raise ValueError(f"{label} phải là danh sách chuỗi tiền")
    chains: list[list[int]] = []
    for index, value in enumerate(values, start=1):
        if not isinstance(value, list):
            raise ValueError(f"{label} chuỗi {index} không phải danh sách")
        chains.append(_stake_list(json.dumps(value), label=f"{label} chuỗi {index}"))
    return chains


def inspect_pilot_runtime(database_path: str | Path) -> PilotRuntimeState:
    """Read the authoritative live-tab stake envelope without mutating SQLite."""

    database = Path(database_path).resolve()
    if not database.is_file():
        return PilotRuntimeState(
            database_exists=False,
            errors=(f"Không tìm thấy SQLite: {database}",),
        )
    try:
        connection = sqlite3.connect(
            f"file:{database.as_posix()}?mode=ro", uri=True
        )
        connection.row_factory = sqlite3.Row
        try:
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            required = {"bets", "strategy_tabs", "strategy_money_configs"}
            missing = sorted(required - tables)
            if missing:
                return PilotRuntimeState(
                    database_exists=True,
                    errors=(
                        "SQLite thiếu bảng preflight: " + ", ".join(missing),
                    ),
                )
            bet_columns = {
                row[1] for row in connection.execute("PRAGMA table_info(bets)")
            }
            pending_query = "SELECT COUNT(*) FROM bets WHERE outcome IS NULL"
            if "status" in bet_columns:
                pending_query += (
                    " AND COALESCE(status, 'placed') "
                    "IN ('placing', 'placed', 'uncertain')"
                )
            pending = int(connection.execute(pending_query).fetchone()[0])
            rows = connection.execute(
                "SELECT t.id, t.money_manager_id, t.stakes_json AS tab_stakes, "
                "t.stake_chains_json AS tab_chains, "
                "c.stakes_json AS manager_stakes, "
                "c.stake_chains_json AS manager_chains "
                "FROM strategy_tabs AS t "
                "LEFT JOIN strategy_money_configs AS c "
                "ON c.tab_id=t.id AND c.manager_id=t.money_manager_id "
                "WHERE t.active=1 AND t.mode='live' ORDER BY t.ordinal"
            ).fetchall()
            errors: list[str] = []
            authoritative: list[int] = []
            from src.capital_managers import MONEY_MANAGER_IDS

            for row in rows:
                tab_id = str(row["id"] or "")
                manager_id = str(row["money_manager_id"] or "")
                label = f"tab {tab_id[:8] or '?'} / {manager_id or '?'}"
                if manager_id not in MONEY_MANAGER_IDS:
                    errors.append(f"{label}: MoneyManager không hợp lệ")
                    continue
                try:
                    stakes = _stake_list(
                        row["manager_stakes"]
                        if row["manager_stakes"] is not None
                        else row["tab_stakes"],
                        label=f"{label} stakes",
                    )
                    chains = _stake_chains(
                        row["manager_chains"]
                        if row["manager_chains"] is not None
                        else row["tab_chains"],
                        label=f"{label} stake_chains",
                    )
                    possible = (
                        [stake for chain in chains for stake in chain]
                        if manager_id == "MultiChain" and chains
                        else stakes
                    )
                    if not possible:
                        raise ValueError(f"{label}: chuỗi tiền trống")
                    authoritative.extend(possible)
                    if manager_id == "Victor2":
                        authoritative.extend(stake * 2 for stake in possible)
                except ValueError as exc:
                    errors.append(str(exc))
            return PilotRuntimeState(
                database_exists=True,
                pending_bets=pending,
                live_tabs=len(rows),
                authoritative_stakes=tuple(authoritative),
                live_tab_ids=tuple(str(row["id"]) for row in rows),
                errors=tuple(errors),
            )
        finally:
            connection.close()
    except sqlite3.Error as exc:
        return PilotRuntimeState(
            database_exists=True,
            errors=(f"Không đọc được SQLite preflight: {type(exc).__name__}",),
        )


def inspect_license_readiness(
    config: dict[str, Any],
    *,
    config_dir: str | Path = ".",
    now: datetime | None = None,
    device_id: str | None = None,
    allow_plaintext_cache_for_tests: bool = False,
) -> tuple[str, ...]:
    """Verify the cached signed live_bet lease without refresh or mutation."""

    license_cfg = config.get("license") or {}
    errors: list[str] = []
    if not license_cfg.get("enabled"):
        return ("Pilot tiền thật yêu cầu license.enabled=true",)
    api_url = str(license_cfg.get("api_url") or "").strip()
    parsed = urlparse(api_url)
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        errors.append("Pilot tiền thật yêu cầu license.api_url HTTPS production")
    base = Path(config_dir).resolve()

    def resolve(value: Any, default: str) -> Path:
        path = Path(str(value or default))
        return path if path.is_absolute() else base / path

    public_key = resolve(
        license_cfg.get("public_key_path"), "data/license_public.pem"
    )
    cache = resolve(license_cfg.get("cache_path"), "data/license_session.bin")
    if not public_key.is_file():
        errors.append("Không tìm thấy license public key production")
    if not cache.is_file():
        errors.append("Chưa có signed license cache trên thiết bị")
    if errors:
        return tuple(errors)
    try:
        from src.device_identity import device_fingerprint
        from src.license_contracts import SignedLease, verify_signed_lease
        from src.secure_token_store import SecureTokenStore

        expected_device = device_id or device_fingerprint()
        payload = SecureTokenStore(
            cache,
            allow_plaintext_for_tests=allow_plaintext_cache_for_tests,
        ).load()
        if not isinstance(payload, dict):
            return ("Không đọc được signed license cache",)
        if str(payload.get("device_id") or "") != expected_device:
            return ("Signed license cache không thuộc thiết bị này",)
        if not str(payload.get("refresh_token") or ""):
            return ("Signed license cache thiếu refresh token",)
        signed = SignedLease.from_dict(payload.get("lease") or {})
        lease = verify_signed_lease(signed, public_key.read_bytes())
        if lease.device_id != expected_device:
            return ("Signed license lease không thuộc thiết bị này",)
        if "live_bet" not in lease.capabilities:
            return ("License không có capability live_bet",)
        current = now or datetime.now(timezone.utc)
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        grace_minutes = max(0, int(license_cfg.get("grace_minutes") or 0))
        grace_until = min(
            lease.refresh_until,
            lease.expires_at + timedelta(minutes=grace_minutes),
        )
        if current.astimezone(timezone.utc) > grace_until:
            return ("License/live_bet hoặc offline grace đã hết hạn",)
    except Exception as exc:
        return (f"Signed license cache không hợp lệ: {type(exc).__name__}",)
    return ()


def pilot_preflight(
    config: dict[str, Any],
    *,
    stage: str,
    runtime: PilotRuntimeState | None = None,
    maximum_small_stake: int = 100,
    license_errors: Iterable[str] = (),
) -> list[str]:
    errors: list[str] = []
    betting = config.get("betting") or {}
    auto_bet = bool(betting.get("auto_bet"))
    state = runtime or PilotRuntimeState(database_exists=False)
    errors.extend(str(error) for error in state.errors)
    stakes = list(state.authoritative_stakes)
    pending_bets = state.pending_bets
    live_tabs = state.live_tabs
    if pending_bets:
        errors.append("Có cược pending; không được đổi giai đoạn pilot")
    if live_tabs > 1:
        errors.append("Có nhiều hơn một tab live")
    if stage in {"simulation", "shadow"} and auto_bet:
        errors.append("Simulation/shadow yêu cầu auto_bet=false")
    if stage in {"stake_zero", "small_stake"}:
        if not state.database_exists:
            errors.append("Pilot yêu cầu SQLite authoritative")
        if live_tabs != 1:
            errors.append("Pilot yêu cầu đúng một tab live")
        if auto_bet:
            errors.append("Preflight chuyển giai đoạn yêu cầu auto_bet=false")
        if not stakes:
            errors.append("Không đọc được chuỗi tiền authoritative của tab live")
    if stage == "stake_zero" and stakes and any(stakes):
        errors.append("Pilot stake 0 yêu cầu toàn bộ chuỗi tiền live bằng 0")
    if stage == "small_stake":
        errors.extend(str(error) for error in license_errors)
        if stakes and not any(stake > 0 for stake in stakes):
            errors.append("Pilot tiền thật yêu cầu ít nhất một stake dương")
        if stakes and max(stakes) > maximum_small_stake:
            errors.append(f"Stake vượt ngưỡng pilot {maximum_small_stake}")
    return errors
