"""Finite, fail-closed authorization for the first real-money pilot."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from src.kill_switch import is_kill_switch_active
from src.release_support import PilotRuntimeState, inspect_pilot_runtime

SMALL_STAKE_ACK = "I ACCEPT FINITE SMALL STAKE PILOT"
LEASE_SCHEMA_VERSION = 1


def _utc(value: datetime | None = None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def default_lease_path(database_path: str | Path) -> Path:
    configured = os.environ.get("TOOLBET_SMALL_STAKE_LEASE", "").strip()
    if configured:
        return Path(configured).resolve()
    return Path(database_path).resolve().parent / "SMALL_STAKE_PILOT.json"


@dataclass(frozen=True, slots=True)
class SmallStakeLease:
    schema_version: int
    pilot_id: str
    database_path: str
    allowed_tab_id: str
    max_stake: int
    max_bets: int
    max_loss: float
    baseline_bet_id: int
    issued_at: str
    expires_at: str
    allow_tie: bool = False

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "SmallStakeLease":
        return cls(
            schema_version=int(payload.get("schema_version") or 0),
            pilot_id=str(payload.get("pilot_id") or ""),
            database_path=str(payload.get("database_path") or ""),
            allowed_tab_id=str(payload.get("allowed_tab_id") or ""),
            max_stake=int(payload.get("max_stake") or 0),
            max_bets=int(payload.get("max_bets") or 0),
            max_loss=float(payload.get("max_loss") or 0),
            baseline_bet_id=int(payload.get("baseline_bet_id") or 0),
            issued_at=str(payload.get("issued_at") or ""),
            expires_at=str(payload.get("expires_at") or ""),
            allow_tie=bool(payload.get("allow_tie", False)),
        )


@dataclass(frozen=True, slots=True)
class SmallStakeDecision:
    allowed: bool
    reason: str
    pilot_id: str = ""


@dataclass(frozen=True, slots=True)
class SmallStakeEvidence:
    passed: bool
    pilot_id: str
    bet_count: int
    resolved_count: int
    pnl: float
    errors: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _latest_bet_id(database: Path) -> int:
    connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    try:
        return int(connection.execute("SELECT COALESCE(MAX(id), 0) FROM bets").fetchone()[0])
    finally:
        connection.close()


def arm_small_stake_pilot(
    database_path: str | Path,
    lease_path: str | Path,
    *,
    runtime: PilotRuntimeState,
    max_stake: int,
    max_bets: int,
    max_loss: float,
    duration_minutes: int,
    acknowledgement: str,
    now: datetime | None = None,
) -> SmallStakeLease:
    """Create an atomic local lease after the caller has passed preflight."""

    if acknowledgement != SMALL_STAKE_ACK:
        raise ValueError("Sai acknowledgement cho pilot tiền nhỏ")
    if len(runtime.live_tab_ids) != 1 or runtime.live_tabs != 1:
        raise ValueError("Pilot yêu cầu đúng một tab live có định danh")
    if max_stake <= 0 or max_bets <= 0 or max_loss <= 0 or duration_minutes <= 0:
        raise ValueError("Giới hạn canary phải lớn hơn 0")
    if runtime.maximum_stake > max_stake:
        raise ValueError("Stake authoritative vượt trần canary")
    database = Path(database_path).resolve()
    current = _utc(now)
    lease = SmallStakeLease(
        schema_version=LEASE_SCHEMA_VERSION,
        pilot_id=str(uuid.uuid4()),
        database_path=str(database),
        allowed_tab_id=runtime.live_tab_ids[0],
        max_stake=int(max_stake),
        max_bets=int(max_bets),
        max_loss=float(max_loss),
        baseline_bet_id=_latest_bet_id(database),
        issued_at=current.isoformat(),
        expires_at=(current + timedelta(minutes=duration_minutes)).isoformat(),
        allow_tie=False,
    )
    target = Path(lease_path).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(
        json.dumps(asdict(lease), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(temporary, target)
    return lease


class SmallStakePilotGuard:
    def __init__(self, database_path: str | Path, lease_path: str | Path):
        self.database_path = Path(database_path).resolve()
        self.lease_path = Path(lease_path).resolve()

    def load_lease(self) -> SmallStakeLease:
        payload = json.loads(self.lease_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Lease canary không phải object")
        lease = SmallStakeLease.from_dict(payload)
        if lease.schema_version != LEASE_SCHEMA_VERSION or not lease.pilot_id:
            raise ValueError("Lease canary sai phiên bản hoặc thiếu pilot_id")
        return lease

    def evaluate(
        self,
        *,
        stake: int,
        tab_ids: tuple[str, ...] | list[str],
        bet_kind: str,
        current_bet_id: int | None = None,
        now: datetime | None = None,
    ) -> SmallStakeDecision:
        if stake <= 0:
            return SmallStakeDecision(True, "virtual stake")
        try:
            lease = self.load_lease()
            current = _utc(now)
            expires = _utc(datetime.fromisoformat(lease.expires_at))
        except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
            return SmallStakeDecision(False, f"lease canary không hợp lệ: {type(exc).__name__}")
        deny = lambda reason: SmallStakeDecision(False, reason, lease.pilot_id)
        if is_kill_switch_active():
            return deny("kill switch đang bật")
        if Path(lease.database_path).resolve() != self.database_path:
            return deny("lease không thuộc SQLite đang chạy")
        if current > expires:
            return deny("lease canary đã hết hạn")
        if stake > lease.max_stake:
            return deny(f"tổng stake {stake} vượt trần canary {lease.max_stake}")
        if bet_kind == "tie" and not lease.allow_tie:
            return deny("Nuôi Hòa không được phép trong canary đầu")
        normalized_tabs = tuple(sorted({str(item) for item in tab_ids if str(item)}))
        if normalized_tabs != (lease.allowed_tab_id,):
            return deny("tab live hiện tại không khớp lease canary")

        runtime = inspect_pilot_runtime(self.database_path)
        if runtime.errors:
            return deny(runtime.errors[0])
        if runtime.live_tab_ids != (lease.allowed_tab_id,) or runtime.live_tabs != 1:
            return deny("binding tab live đã thay đổi sau khi arm")
        if not runtime.authoritative_stakes or runtime.maximum_stake > lease.max_stake:
            return deny("stake authoritative đã vượt hoặc mất envelope canary")

        try:
            connection = sqlite3.connect(
                f"file:{self.database_path.as_posix()}?mode=ro", uri=True
            )
            connection.row_factory = sqlite3.Row
            try:
                columns = {
                    row[1] for row in connection.execute("PRAGMA table_info(bets)")
                }
                real_clause = (
                    "execution_mode='real' AND stake>0"
                    if "execution_mode" in columns
                    else "stake>0"
                )
                rows = connection.execute(
                    f"SELECT id, outcome, profit FROM bets "
                    f"WHERE id>? AND status!='cancelled' AND {real_clause} ORDER BY id",
                    (lease.baseline_bet_id,),
                ).fetchall()
            finally:
                connection.close()
        except sqlite3.Error as exc:
            return deny(f"không đọc được journal canary: {type(exc).__name__}")

        unresolved = [int(row["id"]) for row in rows if row["outcome"] is None]
        allowed_pending = [current_bet_id] if current_bet_id is not None else []
        if unresolved != allowed_pending:
            return deny("journal có pending ngoài bet đang chuẩn bị click")
        used = len(rows)
        if (current_bet_id is None and used >= lease.max_bets) or used > lease.max_bets:
            return deny(f"đã đạt giới hạn {lease.max_bets} bet canary")
        pnl = sum(float(row["profit"] or 0) for row in rows if row["outcome"] is not None)
        if pnl <= -lease.max_loss:
            return deny(f"đã chạm stop-loss canary {lease.max_loss:g}")
        return SmallStakeDecision(True, "canary hợp lệ", lease.pilot_id)

    def finish_evidence(self) -> SmallStakeEvidence:
        try:
            lease = self.load_lease()
            connection = sqlite3.connect(
                f"file:{self.database_path.as_posix()}?mode=ro", uri=True
            )
            connection.row_factory = sqlite3.Row
            try:
                columns = {
                    row[1] for row in connection.execute("PRAGMA table_info(bets)")
                }
                real_clause = (
                    "execution_mode='real' AND stake>0"
                    if "execution_mode" in columns
                    else "stake>0"
                )
                rows = connection.execute(
                    f"SELECT id, stake, outcome, profit, status FROM bets "
                    f"WHERE id>? AND status!='cancelled' AND {real_clause} ORDER BY id",
                    (lease.baseline_bet_id,),
                ).fetchall()
            finally:
                connection.close()
        except (OSError, ValueError, sqlite3.Error, json.JSONDecodeError) as exc:
            return SmallStakeEvidence(
                False, "", 0, 0, 0.0,
                (f"Không đọc được evidence canary: {type(exc).__name__}",),
            )
        errors: list[str] = []
        if not rows:
            errors.append("Ca canary chưa có bet tiền thật")
        unresolved = [int(row["id"]) for row in rows if row["outcome"] is None]
        if unresolved:
            errors.append("Ca canary còn bet pending: " + ", ".join(map(str, unresolved)))
        if len(rows) > lease.max_bets:
            errors.append("Số bet vượt lease canary")
        if any(float(row["stake"] or 0) > lease.max_stake for row in rows):
            errors.append("Có bet vượt trần stake canary")
        pnl = sum(float(row["profit"] or 0) for row in rows if row["outcome"] is not None)
        if pnl < -lease.max_loss:
            errors.append("P&L vượt stop-loss canary")
        return SmallStakeEvidence(
            not errors,
            lease.pilot_id,
            len(rows),
            sum(row["outcome"] is not None for row in rows),
            pnl,
            tuple(errors),
        )
