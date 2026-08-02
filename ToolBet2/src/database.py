from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


class HallRecord(Base):
    __tablename__ = "halls"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    provider: Mapped[str] = mapped_column(String(32), default="")
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class TableRecord(Base):
    __tablename__ = "tables"
    __table_args__ = (UniqueConstraint("hall_id", "name", name="uq_hall_table_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hall_id: Mapped[str] = mapped_column(String(32), ForeignKey("halls.id"), index=True)
    table_code: Mapped[str] = mapped_column(String(16), index=True)
    name: Mapped[str] = mapped_column(String(128))
    external_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    stats_banker: Mapped[int] = mapped_column(Integer, default=0)
    stats_player: Mapped[int] = mapped_column(Integer, default=0)
    stats_tie: Mapped[int] = mapped_column(Integer, default=0)
    round_count: Mapped[int] = mapped_column(Integer, default=0)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class RoundRecord(Base):
    __tablename__ = "rounds"
    __table_args__ = (
        UniqueConstraint("table_fk_id", "session_date", "session_no", name="uq_table_session_day"),
        UniqueConstraint("table_fk_id", "game_shoe", "game_round", name="uq_table_shoe_round"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    hall_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("halls.id"), nullable=True, index=True)
    table_fk_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tables.id"), nullable=True, index=True)
    session_date: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    session_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    round_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game_shoe: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game_round: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bead_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    table_id: Mapped[str] = mapped_column(String(32), default="")
    table_name: Mapped[str] = mapped_column(String(128), default="")
    result: Mapped[str] = mapped_column(String(16))  # player | banker | tie
    player_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    banker_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class BetGroupRecord(Base):
    """
    Mot nhom cuoc (chuoi progression) — tuong tu ban/sanh: co id rieng,
    denormalize hall/table/ngay de loc bao cao.
    Dong khi dat lai nhom / lo nhom; bet gan qua bets.group_id.
    """

    __tablename__ = "bet_groups"
    __table_args__ = (
        UniqueConstraint("session_date", "seq_no", name="uq_bet_group_day_seq"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # So thu tu trong ngay (1, 2, 3...) — hien thi "Nhom #3"
    seq_no: Mapped[int] = mapped_column(Integer, default=1)
    session_date: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)

    hall_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    hall_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    table_name: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    # Snapshot cau hinh luc mo nhom
    group_take_profit: Mapped[float] = mapped_column(Float, default=0.0)
    group_stop_loss: Mapped[float] = mapped_column(Float, default=0.0)
    stakes_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # open | take_profit | stop_loss | abandoned
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    close_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)

    bet_count: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    pushes: Mapped[int] = mapped_column(Integer, default=0)
    pnl: Mapped[float] = mapped_column(Float, default=0.0)
    max_stake_index: Mapped[int] = mapped_column(Integer, default=0)
    max_loss_count: Mapped[int] = mapped_column(Integer, default=0)

    opened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class BetRecord(Base):
    __tablename__ = "bets"
    __table_args__ = (UniqueConstraint("round_id", name="uq_bet_round_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[str] = mapped_column(String(96), index=True)
    session_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    session_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game_shoe: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game_round: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rule_name: Mapped[str] = mapped_column(String(64))
    side: Mapped[str] = mapped_column(String(16))
    stake: Mapped[float] = mapped_column(Float)
    outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)  # win | loss | push
    profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    stake_index: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    hall_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    hall_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    table_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    pattern_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="placed")
    placed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    session_profit_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_round_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Nhom cuoc — giong hall_id/table_name: gan bet vao entity nhom
    group_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bet_groups.id"), nullable=True, index=True
    )
    group_pnl_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class EventRecord(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[str] = mapped_column(String(64), default="", index=True)
    event_type: Mapped[str] = mapped_column(String(64))
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


def _migrate_schema(engine) -> None:
    """Them cot moi cho DB cu (SQLite ALTER TABLE)."""
    insp = inspect(engine)
    if "rounds" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("rounds")}
        alters: list[str] = []
        if "hall_id" not in cols:
            alters.append("ALTER TABLE rounds ADD COLUMN hall_id VARCHAR(32)")
        if "table_fk_id" not in cols:
            alters.append("ALTER TABLE rounds ADD COLUMN table_fk_id INTEGER")
        if "round_index" not in cols:
            alters.append("ALTER TABLE rounds ADD COLUMN round_index INTEGER")
        for col, ddl in (
            ("session_date", "ALTER TABLE rounds ADD COLUMN session_date VARCHAR(10)"),
            ("session_no", "ALTER TABLE rounds ADD COLUMN session_no INTEGER"),
            ("game_shoe", "ALTER TABLE rounds ADD COLUMN game_shoe INTEGER"),
            ("game_round", "ALTER TABLE rounds ADD COLUMN game_round INTEGER"),
            ("bead_index", "ALTER TABLE rounds ADD COLUMN bead_index INTEGER"),
            ("occurred_at", "ALTER TABLE rounds ADD COLUMN occurred_at DATETIME"),
        ):
            if col not in cols:
                alters.append(ddl)
        if alters:
            with engine.begin() as conn:
                for stmt in alters:
                    conn.execute(text(stmt))
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_table_session_day "
                    "ON rounds (table_fk_id, session_date, session_no) "
                    "WHERE session_date IS NOT NULL AND session_no IS NOT NULL"
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_table_shoe_round "
                    "ON rounds (table_fk_id, game_shoe, game_round) "
                    "WHERE game_shoe IS NOT NULL AND game_round IS NOT NULL"
                )
            )

    if "bets" not in insp.get_table_names():
        return

    bet_cols = {c["name"] for c in insp.get_columns("bets")}
    bet_alters: list[str] = []
    for col, ddl in (
        ("hall_id", "ALTER TABLE bets ADD COLUMN hall_id VARCHAR(32)"),
        ("table_name", "ALTER TABLE bets ADD COLUMN table_name VARCHAR(128)"),
        ("pattern_id", "ALTER TABLE bets ADD COLUMN pattern_id VARCHAR(64)"),
        ("status", "ALTER TABLE bets ADD COLUMN status VARCHAR(16) DEFAULT 'placed'"),
        ("placed_at", "ALTER TABLE bets ADD COLUMN placed_at DATETIME"),
        ("session_profit_after", "ALTER TABLE bets ADD COLUMN session_profit_after FLOAT"),
        ("target_round_index", "ALTER TABLE bets ADD COLUMN target_round_index INTEGER"),
        ("session_date", "ALTER TABLE bets ADD COLUMN session_date VARCHAR(10)"),
        ("session_no", "ALTER TABLE bets ADD COLUMN session_no INTEGER"),
        ("game_shoe", "ALTER TABLE bets ADD COLUMN game_shoe INTEGER"),
        ("game_round", "ALTER TABLE bets ADD COLUMN game_round INTEGER"),
        ("hall_name", "ALTER TABLE bets ADD COLUMN hall_name VARCHAR(128)"),
        ("resolved_at", "ALTER TABLE bets ADD COLUMN resolved_at DATETIME"),
        ("group_id", "ALTER TABLE bets ADD COLUMN group_id INTEGER"),
        ("group_pnl_after", "ALTER TABLE bets ADD COLUMN group_pnl_after FLOAT"),
    ):
        if col not in bet_cols:
            bet_alters.append(ddl)
    if bet_alters:
        with engine.begin() as conn:
            for stmt in bet_alters:
                conn.execute(text(stmt))

    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE bets SET hall_name = (SELECT name FROM halls WHERE halls.id = bets.hall_id) "
                "WHERE hall_name IS NULL AND hall_id IS NOT NULL"
            )
        )
        conn.execute(
            text(
                "DELETE FROM bets WHERE id NOT IN ("
                "  SELECT MIN(id) FROM bets GROUP BY round_id"
                ")"
            )
        )
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS uq_bet_round_id ON bets (round_id)")
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_bets_group_id ON bets (group_id)")
        )


def init_db(db_path: str):
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    _migrate_schema(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)
