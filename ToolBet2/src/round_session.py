"""Dinh danh van — gameShoe + gameRound tu server AE SEXY."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class RoundRef:
    """Dinh danh mot phien/van — map ket qua va cuoc."""

    round_id: str
    table_code: str
    game_shoe: int
    game_round: int
    session_date: str | None = None  # audit only
    session_no: int | None = None  # legacy
    bead_index: int | None = None

    @property
    def display(self) -> str:
        return f"{self.table_code} shoe{self.game_shoe} r{self.game_round}"


def today_str(when: datetime | None = None) -> str:
    dt = when or datetime.now()
    return dt.date().isoformat()


def make_round_id(hall_id: str, table_code: str, game_shoe: int, game_round: int) -> str:
    return f"{hall_id}:{table_code}:{game_shoe}:{game_round}"


def parse_round_id(round_id: str) -> dict[str, str | int] | None:
    parts = (round_id or "").split(":")
    if len(parts) != 4:
        return None
    hall_id, table_code, shoe, rnd = parts
    try:
        game_shoe = int(shoe)
        game_round = int(rnd)
    except ValueError:
        return None
    if len(shoe) == 8 and shoe.isdigit() and shoe.startswith("20"):
        session_date = f"{shoe[:4]}-{shoe[4:6]}-{shoe[6:8]}"
        return {
            "hall_id": hall_id,
            "table_code": table_code,
            "session_date": session_date,
            "session_no": game_round,
            "legacy": True,
        }
    return {
        "hall_id": hall_id,
        "table_code": table_code,
        "game_shoe": game_shoe,
        "game_round": game_round,
    }
