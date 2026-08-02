from __future__ import annotations
import json
import logging
import re
from datetime import datetime
from typing import Any
from src.ae_sexy_reader import AeSexyTableInfo
from src.ae_sexy_ws import primary_table_id
from sqlalchemy import func, select
from src.database import (
    BetAllocationRecord,
    BetGroupRecord,
    BetRecord,
    EventRecord,
    HallRecord,
    RoundRecord,
    TableRecord,
)
from src.models import BetSide
from src.round_session import RoundRef, make_round_id, today_str
logger = logging.getLogger(__name__)

PROVIDER_HALLS: dict[str, tuple[str, str]] = {
    "ae_sexy": ("ae_sexy", "AE SEXY"),
}

def table_code_from_name(name: str) -> str:
    m = re.search(r"C(\d+)", name, re.I)
    return f"C{m.group(1)}" if m else name.strip()

class GameDataStore:
    """Luu master sảnh, bàn theo sảnh, lịch sử kết quả riêng từng bàn."""
    def __init__(self, session_factory, provider: str):
        self.session_factory = session_factory
        hall_id, hall_name = PROVIDER_HALLS.get(provider, (provider, provider.upper()))
        self.hall_id = hall_id
        self.hall_name = hall_name
        self.provider = provider
        self._saved_rounds: set[str] = set()
        # (table_fk_id, game_shoe, game_round) hoac legacy (table_fk_id, bead_index)
        self._reserved_rounds: dict[tuple[int, ...], RoundRef] = {}
    def clear_reserved_rounds(self, table_name: str) -> None:
        """Xoa reserve cuoc khi shoe moi / reset ban."""
        table = self.register_active_table(table_name)
        if not table:
            return
        drop = [k for k in self._reserved_rounds if k and k[0] == table.id]
        for key in drop:
            self._reserved_rounds.pop(key, None)
    def register_hall(self) -> HallRecord:
        now = datetime.now()
        session = self.session_factory()
        try:
            hall = session.get(HallRecord, self.hall_id)
            if hall:
                hall.name = self.hall_name
                hall.provider = self.provider
                hall.last_seen_at = now
                hall.updated_at = now
            else:
                hall = HallRecord(
                    id=self.hall_id,
                    name=self.hall_name,
                    provider=self.provider,
                    last_seen_at=now,
                    created_at=now,
                    updated_at=now,
                )
                session.add(hall)
            session.commit()
            session.refresh(hall)
            return hall
        finally:
            session.close()
    def sync_table_names(self, table_names: list[str]) -> int:
        """Dang ky danh sach ban (khong co lich su)."""
        if not table_names:
            return 0
        self.register_hall()
        now = datetime.now()
        session = self.session_factory()
        count = 0
        try:
            for name in table_names:
                if self._upsert_table(session, name, stats=None, round_count=0, now=now):
                    count += 1
            session.commit()
            return count
        finally:
            session.close()
    def sync_lobby_tables(self, tables: list[AeSexyTableInfo]) -> dict[str, int]:
        """Luu danh sach ban + lich su roadmap tu sanh."""
        self.register_hall()
        saved_tables = 0
        for info in tables:
            self._upsert_table_record(info.name, info.stats, len(info.history))
            saved_tables += 1
            # Roadmap sanh chi co mau B/P/T — khong co gameShoe/gameRound tu server.
            # Lich su DB chi luu khi da vao ban (HTTP markerRoads / WS).
        logger.info(
            "DB sanh %s: %d ban (bo qua luu lich su lobby — chua co gameShoe/gameRound)",
            self.hall_name,
            saved_tables,
        )
        return {"tables": saved_tables, "rounds": 0}
    def register_active_table(self, table_name: str, stats: dict[str, int] | None = None) -> TableRecord | None:
        self.register_hall()
        now = datetime.now()
        session = self.session_factory()
        try:
            table = self._upsert_table(session, table_name, stats=stats, round_count=0, now=now)
            session.commit()
            if table:
                session.refresh(table)
                return table
            return None
        finally:
            session.close()
    def hydrate_saved_rounds(self, table_name: str, game_shoe: int | None = None) -> int:
        """Nap round_id da luu tu DB — tranh insert trung khi vao lai ban / bootstrap."""
        table = self.register_active_table(table_name)
        if not table:
            return 0
        session = self.session_factory()
        try:
            query = session.query(RoundRecord.round_id).filter_by(table_fk_id=table.id)
            if game_shoe:
                query = query.filter_by(game_shoe=game_shoe)
            rows = query.all()
            for (round_id,) in rows:
                if round_id:
                    self._saved_rounds.add(round_id)
            return len(rows)
        finally:
            session.close()
    def save_table_history(
        self,
        table_name: str,
        history: list[BetSide],
        *,
        stats: dict[str, int] | None = None,
        source: str = "",
        start_index: int = 0,
        raw_extra: dict[str, Any] | None = None,
        round_meta: dict[int, dict[str, Any]] | None = None,
    ) -> int:
        """Luu lich su ket qua theo ban — moi van = 1 round_id gameShoe:gameRound."""
        if not table_name or not history:
            return 0
        game_shoe = None
        for meta in (round_meta or {}).values():
            if meta.get("game_shoe"):
                game_shoe = int(meta["game_shoe"])
                break
        if game_shoe:
            self.hydrate_saved_rounds(table_name, game_shoe)
        saved = 0
        for idx in range(start_index, len(history)):
            meta = dict((round_meta or {}).get(idx, {}))
            if raw_extra:
                meta.setdefault("extra", raw_extra)
            meta.pop("bead_index", None)
            ref = self.save_round(
                table_name,
                history[idx],
                bead_index=idx,
                source=source,
                stats=stats if idx == len(history) - 1 else None,
                **meta,
            )
            if ref:
                saved += 1
        return saved
    def save_round(
        self,
        table_name: str,
        side: BetSide,
        *,
        bead_index: int | None = None,
        source: str = "",
        stats: dict[str, int] | None = None,
        game_shoe: int | None = None,
        game_round: int | None = None,
        occurred_at: datetime | None = None,
    ) -> RoundRef | None:
        """Luu 1 ket qua — gan so phien duy nhat theo ngay."""
        if not table_name:
            return None
        table = self.register_active_table(table_name, stats)
        if not table:
            return None
        session = self.session_factory()
        try:
            if game_shoe and game_round:
                existing = (
                    session.query(RoundRecord)
                    .filter_by(table_fk_id=table.id, game_shoe=game_shoe, game_round=game_round)
                    .first()
                )
                if existing:
                    self._saved_rounds.add(existing.round_id)
                    if existing.result != side.value:
                        existing.result = side.value
                        existing.raw_json = json.dumps(
                            {"source": source, "updated": True},
                            ensure_ascii=False,
                        )
                        session.commit()
                    return RoundRef(
                        round_id=existing.round_id,
                        table_code=table.table_code,
                        game_shoe=int(existing.game_shoe or 0),
                        game_round=int(existing.game_round or 0),
                        session_date=existing.session_date,
                        session_no=int(existing.session_no) if existing.session_no else None,
                        bead_index=existing.bead_index,
                    )
            reserved: RoundRef | None = None
            if game_shoe and game_round:
                reserved = self._reserved_rounds.pop((table.id, game_shoe, game_round), None)
            if not reserved and bead_index is not None:
                reserved = self._reserved_rounds.pop((table.id, bead_index), None)
            if reserved:
                ref = RoundRef(
                    round_id=reserved.round_id,
                    table_code=reserved.table_code,
                    game_shoe=int(game_shoe or reserved.game_shoe),
                    game_round=int(game_round or reserved.game_round),
                    session_date=reserved.session_date,
                    session_no=reserved.session_no,
                    bead_index=bead_index if bead_index is not None else reserved.bead_index,
                )
            else:
                if not (game_shoe and game_round):
                    if source == "lobby-scrape":
                        logger.debug(
                            "Bo qua bead #%s ban %s — lobby khong co gameShoe/gameRound",
                            bead_index,
                            table.table_code,
                        )
                    else:
                        logger.warning(
                            "Thieu gameShoe/gameRound — khong luu van bead #%s ban %s",
                            bead_index,
                            table.table_code,
                        )
                    return None
                ref = RoundRef(
                    round_id=make_round_id(self.hall_id, table.table_code, game_shoe, game_round),
                    table_code=table.table_code,
                    game_shoe=game_shoe,
                    game_round=game_round,
                    session_date=today_str(occurred_at),
                    bead_index=bead_index,
                )
            if ref.round_id in self._saved_rounds:
                return ref
            dup = session.query(RoundRecord).filter_by(round_id=ref.round_id).first()
            if dup:
                self._saved_rounds.add(ref.round_id)
                return ref
            now = occurred_at or datetime.now()
            raw = {
                "source": source,
                "bead_index": bead_index,
                "game_shoe": ref.game_shoe,
                "game_round": ref.game_round,
            }
            session.add(
                RoundRecord(
                    round_id=ref.round_id,
                    hall_id=self.hall_id,
                    table_fk_id=table.id,
                    session_date=ref.session_date,
                    session_no=ref.session_no,
                    round_index=bead_index,
                    bead_index=bead_index,
                    game_shoe=ref.game_shoe,
                    game_round=ref.game_round,
                    table_id=str(primary_table_id(table_name) or table.table_code),
                    table_name=table_name,
                    result=side.value,
                    raw_json=json.dumps(raw, ensure_ascii=False, default=str),
                    occurred_at=now,
                    created_at=now,
                )
            )
            db_table = session.get(TableRecord, table.id)
            if db_table:
                if bead_index is not None:
                    db_table.round_count = max(db_table.round_count, bead_index + 1)
                if stats:
                    db_table.stats_banker = int(stats.get("banker", db_table.stats_banker))
                    db_table.stats_player = int(stats.get("player", db_table.stats_player))
                    db_table.stats_tie = int(stats.get("tie", db_table.stats_tie))
                db_table.last_seen_at = datetime.now()
                db_table.updated_at = datetime.now()
            session.commit()
            self._saved_rounds.add(ref.round_id)
            logger.info(
                "Phien %s — %s (bead #%s shoe=%s round=%s)",
                ref.display,
                side.value,
                bead_index if bead_index is not None else "?",
                ref.game_shoe,
                ref.game_round,
            )
            return ref
        finally:
            session.close()
    def reserve_round(
        self,
        table_name: str,
        bead_index: int,
        *,
        game_shoe: int,
        game_round: int,
    ) -> RoundRef:
        """Giu round_id cho van sap dat cuoc — ket qua se map lai cung gameShoe:gameRound."""
        table = self.register_active_table(table_name)
        if not table:
            raise ValueError(f"Khong dang ky duoc ban {table_name}")
        key = (table.id, game_shoe, game_round)
        if key in self._reserved_rounds:
            return self._reserved_rounds[key]
        ref = RoundRef(
            round_id=make_round_id(self.hall_id, table.table_code, game_shoe, game_round),
            table_code=table.table_code,
            game_shoe=game_shoe,
            game_round=game_round,
            session_date=today_str(),
            bead_index=bead_index,
        )
        self._reserved_rounds[key] = ref
        logger.debug(
            "Giu phien %s cho cuoc (bead #%d)",
            ref.display,
            bead_index,
        )
        return ref
    def append_history(
        self,
        table_name: str,
        history: list[BetSide],
        prev_len: int,
        *,
        source: str = "",
        stats: dict[str, int] | None = None,
        round_meta: dict[int, dict[str, Any]] | None = None,
    ) -> int:
        if prev_len < 0:
            prev_len = 0
        if len(history) <= prev_len:
            return 0
        return self.save_table_history(
            table_name,
            history,
            stats=stats,
            source=source,
            start_index=prev_len,
            round_meta=round_meta,
        )
    def find_bet_by_round_id(self, round_id: str) -> BetRecord | None:
        session = self.session_factory()
        try:
            return session.scalar(select(BetRecord).where(BetRecord.round_id == round_id))
        finally:
            session.close()
    def open_bet_group(
        self,
        *,
        session_date: str | None = None,
        table_name: str | None = None,
        group_take_profit: float = 0.0,
        group_stop_loss: float = 0.0,
        stakes: list[int] | None = None,
    ) -> BetGroupRecord:
        """Mo nhom cuoc moi — seq_no tang theo ngay (giong lich su theo ban/sanh)."""
        day = session_date or today_str()
        now = datetime.now()
        session = self.session_factory()
        try:
            max_seq = session.scalar(
                select(func.max(BetGroupRecord.seq_no)).where(
                    BetGroupRecord.session_date == day
                )
            )
            seq_no = int(max_seq or 0) + 1
            group = BetGroupRecord(
                seq_no=seq_no,
                session_date=day,
                hall_id=self.hall_id,
                hall_name=self.hall_name,
                table_name=table_name or "",
                group_take_profit=float(group_take_profit),
                group_stop_loss=float(group_stop_loss),
                stakes_json=json.dumps(list(stakes or []), ensure_ascii=False),
                status="open",
                opened_at=now,
                created_at=now,
            )
            session.add(group)
            session.commit()
            session.refresh(group)
            logger.info(
                "Mo nhom #%d (id=%d) ngay %s ban=%s",
                group.seq_no,
                group.id,
                day,
                table_name or "?",
            )
            return group
        finally:
            session.close()

    def close_bet_group(
        self,
        group_id: int,
        *,
        close_reason: str,
        pnl: float,
        bet_count: int | None = None,
        wins: int | None = None,
        losses: int | None = None,
        pushes: int | None = None,
        max_stake_index: int | None = None,
        max_loss_count: int | None = None,
    ) -> None:
        session = self.session_factory()
        try:
            group = session.get(BetGroupRecord, group_id)
            if not group:
                return
            group.status = close_reason if close_reason in (
                "take_profit",
                "stop_loss",
                "abandoned",
            ) else "abandoned"
            group.close_reason = close_reason
            group.pnl = float(pnl)
            if bet_count is not None:
                group.bet_count = bet_count
            if wins is not None:
                group.wins = wins
            if losses is not None:
                group.losses = losses
            if pushes is not None:
                group.pushes = pushes
            if max_stake_index is not None:
                group.max_stake_index = max_stake_index
            if max_loss_count is not None:
                group.max_loss_count = max_loss_count
            group.closed_at = datetime.now()
            session.commit()
            logger.info(
                "Dong nhom #%d (id=%d) %s pnl=%+.0f",
                group.seq_no,
                group.id,
                group.status,
                group.pnl,
            )
        finally:
            session.close()

    def touch_bet_group(
        self,
        group_id: int,
        *,
        pnl: float,
        outcome: str,
        stake_index: int,
        loss_count: int,
    ) -> None:
        """Cap nhat tong hop nhom dang mo sau moi van resolve."""
        session = self.session_factory()
        try:
            group = session.get(BetGroupRecord, group_id)
            if not group or group.status != "open":
                return
            group.pnl = float(pnl)
            group.bet_count = int(group.bet_count or 0) + 1
            if outcome == "win":
                group.wins = int(group.wins or 0) + 1
            elif outcome == "loss":
                group.losses = int(group.losses or 0) + 1
            elif outcome == "push":
                group.pushes = int(group.pushes or 0) + 1
            group.max_stake_index = max(int(group.max_stake_index or 0), int(stake_index))
            group.max_loss_count = max(int(group.max_loss_count or 0), int(loss_count))
            session.commit()
        finally:
            session.close()

    def save_bet(
        self,
        *,
        round_id: str,
        table_name: str,
        side: str,
        stake: float,
        stake_index: int,
        pattern_id: str,
        pattern_name: str,
        reason: str,
        target_round_index: int,
        status: str = "placed",
        execution_mode: str = "real",
        session_date: str | None = None,
        session_no: int | None = None,
        game_shoe: int | None = None,
        game_round: int | None = None,
        group_id: int | None = None,
    ) -> BetRecord | None:
        now = datetime.now()
        session = self.session_factory()
        try:
            existing = session.scalar(
                select(BetRecord).where(BetRecord.round_id == round_id)
            )
            if existing:
                logger.warning(
                    "save_bet: round_id %s da ton tai (#%d) — bo qua trung",
                    round_id,
                    existing.id,
                )
                return existing
            bet = BetRecord(
                round_id=round_id,
                rule_name=pattern_name,
                side=side,
                stake=stake,
                stake_index=stake_index,
                reason=reason,
                hall_id=self.hall_id,
                hall_name=self.hall_name,
                table_name=table_name,
                pattern_id=pattern_id,
                execution_mode=execution_mode,
                session_date=session_date,
                session_no=session_no,
                game_shoe=game_shoe,
                game_round=game_round,
                status=status,
                placed_at=now,
                target_round_index=target_round_index,
                group_id=group_id,
                created_at=now,
            )
            session.add(bet)
            session.commit()
            session.refresh(bet)
            return bet
        except Exception:
            session.rollback()
            existing = session.scalar(
                select(BetRecord).where(BetRecord.round_id == round_id)
            )
            if existing:
                return existing
            raise
        finally:
            session.close()

    def resolve_bet(
        self,
        bet_id: int,
        *,
        outcome: str,
        profit: float,
        session_profit_after: float,
        group_pnl_after: float | None = None,
    ) -> None:
        session = self.session_factory()
        try:
            bet = session.get(BetRecord, bet_id)
            if not bet:
                return
            bet.outcome = outcome
            bet.profit = profit
            bet.session_profit_after = session_profit_after
            if group_pnl_after is not None:
                bet.group_pnl_after = group_pnl_after
            bet.status = "resolved"
            bet.resolved_at = datetime.now()
            session.commit()
        finally:
            session.close()

    def update_bet_status(self, bet_id: int, status: str) -> None:
        session = self.session_factory()
        try:
            bet = session.get(BetRecord, bet_id)
            if not bet:
                return
            bet.status = status
            session.commit()
        finally:
            session.close()

    def cancel_bet_before_click(self, bet_id: int, reason: str) -> None:
        """Close an intent that a final guard rejected before any physical click."""
        session = self.session_factory()
        try:
            bet = session.get(BetRecord, bet_id)
            if not bet or bet.status != "placing":
                raise ValueError("Chỉ được cancel intent đang placing trước click")
            bet.status = "cancelled"
            bet.outcome = "cancelled"
            bet.profit = 0.0
            bet.resolved_at = datetime.now()
            bet.reason = f"{bet.reason} | canary_block={reason}".strip(" |")
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def save_bet_allocations(
        self, bet_id: int, allocations: list[dict[str, Any]]
    ) -> list[BetAllocationRecord]:
        """Persist the complete aggregate plan before any irreversible click."""

        now = datetime.now()
        session = self.session_factory()
        try:
            existing = {
                row.tab_id: row
                for row in session.scalars(
                    select(BetAllocationRecord).where(
                        BetAllocationRecord.bet_id == bet_id
                    )
                )
            }
            rows: list[BetAllocationRecord] = []
            for item in allocations:
                tab_id = str(item.get("tab_id") or "")
                if not tab_id:
                    raise ValueError("bet allocation requires tab_id")
                row = existing.get(tab_id)
                if row is None:
                    row = BetAllocationRecord(bet_id=bet_id, tab_id=tab_id)
                    session.add(row)
                row.tab_name = str(item.get("tab_name") or "")
                row.side = str(item.get("side") or "")
                row.stake = float(item.get("stake") or 0)
                row.stake_index = int(item.get("stake_index") or 0)
                row.signal_id = str(item.get("signal_id") or "")
                row.reason = str(item.get("reason") or "")
                row.placement_status = str(
                    item.get("placement_status")
                    or ("virtual" if row.stake <= 0 else "planned")
                )
                row.updated_at = now
                rows.append(row)
            session.commit()
            for row in rows:
                session.refresh(row)
            return rows
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def update_bet_allocation_status(
        self, bet_id: int, side: str, status: str
    ) -> None:
        session = self.session_factory()
        try:
            rows = session.scalars(
                select(BetAllocationRecord).where(
                    BetAllocationRecord.bet_id == bet_id,
                    BetAllocationRecord.side == side,
                    BetAllocationRecord.stake > 0,
                )
            )
            now = datetime.now()
            for row in rows:
                row.placement_status = status
                row.updated_at = now
            session.commit()
        finally:
            session.close()

    def resolve_bet_allocations(
        self, bet_id: int, allocations: list[dict[str, Any]]
    ) -> None:
        session = self.session_factory()
        try:
            rows = {
                row.tab_id: row
                for row in session.scalars(
                    select(BetAllocationRecord).where(
                        BetAllocationRecord.bet_id == bet_id
                    )
                )
            }
            now = datetime.now()
            for item in allocations:
                row = rows.get(str(item.get("tab_id") or ""))
                if row is None:
                    continue
                row.outcome = str(item.get("outcome") or "") or None
                profit = item.get("profit")
                row.profit = float(profit) if profit is not None else None
                row.updated_at = now
            session.commit()
        finally:
            session.close()

    def load_unresolved_bets(self) -> list[BetRecord]:
        session = self.session_factory()
        try:
            return list(
                session.scalars(
                    select(BetRecord)
                    .where(BetRecord.outcome.is_(None))
                    .order_by(BetRecord.created_at, BetRecord.id)
                )
            )
        finally:
            session.close()

    def load_bet_allocations(self, bet_id: int) -> list[dict[str, Any]]:
        session = self.session_factory()
        try:
            rows = session.scalars(
                select(BetAllocationRecord)
                .where(BetAllocationRecord.bet_id == bet_id)
                .order_by(BetAllocationRecord.id)
            )
            return [
                {
                    "tab_id": row.tab_id,
                    "tab_name": row.tab_name,
                    "side": row.side,
                    "stake": row.stake,
                    "stake_index": row.stake_index,
                    "signal_id": row.signal_id,
                    "reason": row.reason or "",
                    "placement_status": row.placement_status,
                    "outcome": row.outcome,
                    "profit": row.profit,
                }
                for row in rows
            ]
        finally:
            session.close()

    def save_event(
        self,
        event_type: str,
        payload: dict[str, Any] | None = None,
        *,
        round_id: str = "",
    ) -> None:
        session = self.session_factory()
        try:
            session.add(
                EventRecord(
                    round_id=round_id or "",
                    event_type=event_type,
                    payload=json.dumps(payload or {}, ensure_ascii=False, default=str),
                    created_at=datetime.now(),
                )
            )
            session.commit()
        finally:
            session.close()
    def get_summary(self) -> dict[str, int]:
        session = self.session_factory()
        try:
            halls = session.query(HallRecord).count()
            tables = session.query(TableRecord).filter_by(hall_id=self.hall_id).count()
            rounds = session.query(RoundRecord).filter_by(hall_id=self.hall_id).count()
            return {"halls": halls, "tables": tables, "rounds": rounds}
        finally:
            session.close()
    def _round_id(self, table_code: str, game_shoe: int, game_round: int) -> str:
        return make_round_id(self.hall_id, table_code, game_shoe, game_round)
    def _upsert_table_record(
        self,
        table_name: str,
        stats: dict[str, int] | None,
        round_count: int,
    ) -> TableRecord | None:
        now = datetime.now()
        session = self.session_factory()
        try:
            table = self._upsert_table(session, table_name, stats, round_count, now)
            session.commit()
            if table:
                session.refresh(table)
            return table
        finally:
            session.close()
    def _upsert_table(
        self,
        session,
        table_name: str,
        stats: dict[str, int] | None,
        round_count: int,
        now: datetime,
    ) -> TableRecord | None:
        if not table_name:
            return None
        code = table_code_from_name(table_name)
        ext = primary_table_id(table_name)
        table = (
            session.query(TableRecord)
            .filter_by(hall_id=self.hall_id, name=table_name)
            .first()
        )
        if table:
            table.table_code = code
            table.external_id = str(ext) if ext else table.external_id
            if stats:
                table.stats_banker = int(stats.get("banker", 0))
                table.stats_player = int(stats.get("player", 0))
                table.stats_tie = int(stats.get("tie", 0))
            if round_count:
                table.round_count = max(table.round_count, round_count)
            table.last_seen_at = now
            table.updated_at = now
        else:
            table = TableRecord(
                hall_id=self.hall_id,
                table_code=code,
                name=table_name,
                external_id=str(ext) if ext else None,
                stats_banker=int(stats.get("banker", 0)) if stats else 0,
                stats_player=int(stats.get("player", 0)) if stats else 0,
                stats_tie=int(stats.get("tie", 0)) if stats else 0,
                round_count=round_count,
                last_seen_at=now,
                created_at=now,
                updated_at=now,
            )
            session.add(table)
        return table
