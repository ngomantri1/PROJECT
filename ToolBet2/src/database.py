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
    execution_mode: Mapped[str] = mapped_column(String(16), default="real")
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


class BetAllocationRecord(Base):
    """Durable per-tab placement journal for one aggregate live bet."""

    __tablename__ = "bet_allocations"
    __table_args__ = (
        UniqueConstraint("bet_id", "tab_id", name="uq_bet_allocation_tab"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bet_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bets.id"), index=True
    )
    tab_id: Mapped[str] = mapped_column(String(64))
    tab_name: Mapped[str] = mapped_column(String(64), default="")
    side: Mapped[str] = mapped_column(String(16))
    stake: Mapped[float] = mapped_column(Float)
    stake_index: Mapped[int] = mapped_column(Integer, default=0)
    signal_id: Mapped[str] = mapped_column(String(64), default="")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    placement_status: Mapped[str] = mapped_column(String(16), default="planned")
    outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)
    profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    recovery_epoch: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class BetPlacementAttemptRecord(Base):
    """One durable physical-placement attempt within a logical bet."""

    __tablename__ = "bet_placement_attempts"
    __table_args__ = (
        UniqueConstraint("bet_id", "run_epoch", name="uq_bet_attempt_epoch"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bet_id: Mapped[int] = mapped_column(Integer, ForeignKey("bets.id"), index=True)
    attempt_no: Mapped[int] = mapped_column(Integer)
    run_epoch: Mapped[str] = mapped_column(String(64), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    placement_status: Mapped[str] = mapped_column(String(24), default="placing")
    assumed_placed: Mapped[bool] = mapped_column(Integer, default=False)
    error_code: Mapped[str | None] = mapped_column(String(96), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class BetPlacementAttemptAllocationRecord(Base):
    __tablename__ = "bet_placement_attempt_allocations"
    __table_args__ = (
        UniqueConstraint("attempt_id", "tab_id", "side", name="uq_attempt_allocation"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attempt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bet_placement_attempts.id"), index=True
    )
    tab_id: Mapped[str] = mapped_column(String(64))
    side: Mapped[str] = mapped_column(String(16))
    requested_stake: Mapped[float] = mapped_column(Float)
    execution_mode: Mapped[str] = mapped_column(String(16), default="real")
    placement_status: Mapped[str] = mapped_column(String(24), default="planned")
    zone_amount_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    zone_amount_after: Mapped[float | None] = mapped_column(Float, nullable=True)


class EventRecord(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[str] = mapped_column(String(64), default="", index=True)
    event_type: Mapped[str] = mapped_column(String(64))
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class StrategyTabRecord(Base):
    __tablename__ = "strategy_tabs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    ordinal: Mapped[int] = mapped_column(Integer, default=0)
    name: Mapped[str] = mapped_column(String(64))
    enabled: Mapped[int] = mapped_column(Integer, default=1)
    active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    selected: Mapped[int] = mapped_column(Integer, default=0)
    strategy_id: Mapped[str] = mapped_column(String(64))
    stakes_json: Mapped[str] = mapped_column(Text)
    progression_mode: Mapped[str] = mapped_column(String(64))
    money_manager_id: Mapped[str] = mapped_column(
        String(64), default="IncreaseWhenLose"
    )
    stake_chains_json: Mapped[str] = mapped_column(Text, default="[]")
    stop_loss: Mapped[float] = mapped_column(Float, default=0.0)
    take_profit: Mapped[float] = mapped_column(Float, default=0.0)
    auto_reset_on_nonnegative_pnl: Mapped[int] = mapped_column(Integer, default=0)
    strategy_input: Mapped[str] = mapped_column(Text, default="")
    mode: Mapped[str] = mapped_column(String(24), default="simulation", index=True)
    shadow_evaluations: Mapped[int] = mapped_column(Integer, default=0)
    shadow_matches: Mapped[int] = mapped_column(Integer, default=0)
    shadow_mismatches: Mapped[int] = mapped_column(Integer, default=0)
    shadow_errors: Mapped[int] = mapped_column(Integer, default=0)
    demote_reason: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class StrategyTabRuntimeRecord(Base):
    __tablename__ = "strategy_tab_runtime"

    tab_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("strategy_tabs.id"), primary_key=True
    )
    table_name: Mapped[str] = mapped_column(String(128), default="")
    history_size: Mapped[int] = mapped_column(Integer, default=0)
    status_json: Mapped[str] = mapped_column(Text, default="{}")
    statistics_baseline_json: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class StrategyTabHistoryRecord(Base):
    __tablename__ = "strategy_tab_history"
    __table_args__ = (
        UniqueConstraint(
            "tab_id", "table_name", "history_size", name="uq_strategy_tab_history_point"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tab_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("strategy_tabs.id"), index=True
    )
    table_name: Mapped[str] = mapped_column(String(128), default="", index=True)
    history_size: Mapped[int] = mapped_column(Integer, default=0)
    signals: Mapped[int] = mapped_column(Integer, default=0)
    virtual_bets: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    pushes: Mapped[int] = mapped_column(Integer, default=0)
    pnl: Mapped[float] = mapped_column(Float, default=0.0)
    current_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class StrategyMoneyStateRecord(Base):
    __tablename__ = "strategy_money_states"
    __table_args__ = (
        UniqueConstraint(
            "tab_id", "manager_id", name="uq_strategy_money_state_tab_manager"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tab_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("strategy_tabs.id"), index=True
    )
    manager_id: Mapped[str] = mapped_column(String(64), index=True)
    config_fingerprint: Mapped[str] = mapped_column(String(64))
    state_json: Mapped[str] = mapped_column(Text)
    settled_state_json: Mapped[str] = mapped_column(Text, default="")
    recovery_epoch: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class StrategyMoneyConfigRecord(Base):
    __tablename__ = "strategy_money_configs"
    __table_args__ = (
        UniqueConstraint(
            "tab_id", "manager_id", name="uq_strategy_money_config_tab_manager"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tab_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("strategy_tabs.id"), index=True
    )
    manager_id: Mapped[str] = mapped_column(String(64), index=True)
    stakes_json: Mapped[str] = mapped_column(Text)
    stake_chains_json: Mapped[str] = mapped_column(Text, default="[]")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


def _migrate_schema(engine) -> None:
    """Them cot moi cho DB cu (SQLite ALTER TABLE)."""
    insp = inspect(engine)
    if "strategy_tab_runtime" in insp.get_table_names():
        runtime_cols = {
            column["name"] for column in insp.get_columns("strategy_tab_runtime")
        }
        if "statistics_baseline_json" not in runtime_cols:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE strategy_tab_runtime "
                        "ADD COLUMN statistics_baseline_json TEXT DEFAULT '{}'"
                    )
                )
    if "strategy_money_states" in insp.get_table_names():
        money_cols = {
            c["name"] for c in insp.get_columns("strategy_money_states")
        }
        money_alters: list[str] = []
        if "settled_state_json" not in money_cols:
            money_alters.append(
                "ALTER TABLE strategy_money_states "
                "ADD COLUMN settled_state_json TEXT DEFAULT ''"
            )
        if "recovery_epoch" not in money_cols:
            money_alters.append(
                "ALTER TABLE strategy_money_states "
                "ADD COLUMN recovery_epoch INTEGER DEFAULT 0"
            )
        if money_alters:
            with engine.begin() as conn:
                for stmt in money_alters:
                    conn.execute(text(stmt))

    if "bet_allocations" in insp.get_table_names():
        allocation_cols = {
            c["name"] for c in insp.get_columns("bet_allocations")
        }
        if "recovery_epoch" not in allocation_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE bet_allocations "
                    "ADD COLUMN recovery_epoch INTEGER DEFAULT 0"
                ))
    if "strategy_tabs" in insp.get_table_names():
        tab_cols = {c["name"] for c in insp.get_columns("strategy_tabs")}
        tab_alters: list[str] = []
        for col, ddl in (
            (
                "mode",
                "ALTER TABLE strategy_tabs ADD COLUMN mode VARCHAR(24) "
                "DEFAULT 'simulation'",
            ),
            (
                "shadow_evaluations",
                "ALTER TABLE strategy_tabs ADD COLUMN shadow_evaluations INTEGER DEFAULT 0",
            ),
            (
                "shadow_matches",
                "ALTER TABLE strategy_tabs ADD COLUMN shadow_matches INTEGER DEFAULT 0",
            ),
            (
                "shadow_mismatches",
                "ALTER TABLE strategy_tabs ADD COLUMN shadow_mismatches INTEGER DEFAULT 0",
            ),
            (
                "shadow_errors",
                "ALTER TABLE strategy_tabs ADD COLUMN shadow_errors INTEGER DEFAULT 0",
            ),
            (
                "demote_reason",
                "ALTER TABLE strategy_tabs ADD COLUMN demote_reason VARCHAR(255) DEFAULT ''",
            ),
            (
                "money_manager_id",
                "ALTER TABLE strategy_tabs ADD COLUMN money_manager_id VARCHAR(64) "
                "DEFAULT 'IncreaseWhenLose'",
            ),
            (
                "stake_chains_json",
                "ALTER TABLE strategy_tabs ADD COLUMN stake_chains_json TEXT DEFAULT '[]'",
            ),
            (
                "auto_reset_on_nonnegative_pnl",
                "ALTER TABLE strategy_tabs ADD COLUMN auto_reset_on_nonnegative_pnl INTEGER DEFAULT 0",
            ),
            (
                "strategy_input",
                "ALTER TABLE strategy_tabs ADD COLUMN strategy_input TEXT DEFAULT ''",
            ),
        ):
            if col not in tab_cols:
                tab_alters.append(ddl)
        if tab_alters:
            with engine.begin() as conn:
                for stmt in tab_alters:
                    conn.execute(text(stmt))
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_strategy_tabs_mode "
                    "ON strategy_tabs (mode)"
                )
            )

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
        (
            "execution_mode",
            "ALTER TABLE bets ADD COLUMN execution_mode VARCHAR(16) DEFAULT 'real'",
        ),
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
                "UPDATE bets SET execution_mode = 'virtual' "
                "WHERE stake <= 0 AND (execution_mode IS NULL OR execution_mode = 'real')"
            )
        )
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
