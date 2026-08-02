from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class BetSide(str, Enum):
    PLAYER = "player"   # xanh
    BANKER = "banker"   # đỏ
    TIE = "tie"         # hòa


SIDE_LABEL = {
    BetSide.PLAYER: "xanh",
    BetSide.BANKER: "đỏ",
    BetSide.TIE: "hòa",
}


@dataclass
class RoundResult:
    round_id: str
    side: BetSide
    player_score: int | None = None
    banker_score: int | None = None
    timestamp: datetime = field(default_factory=datetime.now)
    raw: dict | None = None


@dataclass
class BetSignal:
    side: BetSide
    stake: int
    rule_name: str
    reason: str


@dataclass
class TableState:
    table_id: str = ""
    table_name: str = ""
    phase: str = "unknown"  # betting | dealing | result | idle
    countdown: int | None = None
    current_round_id: str = ""
    history: list[BetSide] = field(default_factory=list)
