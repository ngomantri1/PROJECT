from __future__ import annotations

import re

from src.models import BetSide

BACCARAT_GAME_IDS = {1, 7, 13}


def parse_destination(dest: str) -> tuple[int | None, int | None]:
    m = re.search(r"/topic/gaming/(\d+)/(\d+)", dest or "")
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None


def decode_baccarat_result(code: str) -> BetSide | None:
    if not code:
        return None
    c = code[0].upper()
    return {"P": BetSide.PLAYER, "B": BetSide.BANKER, "T": BetSide.TIE}.get(c)


def decode_history_codes(codes: list[str]) -> list[BetSide]:
    sides: list[BetSide] = []
    for code in codes:
        side = decode_baccarat_result(str(code))
        if side:
            sides.append(side)
    return sides


def decode_win_play(win_play: str) -> BetSide | None:
    if not win_play:
        return None
    plays = {int(p) for p in re.findall(r"\d+", win_play)}
    if 1001 in plays:
        return BetSide.PLAYER
    if 1002 in plays:
        return BetSide.BANKER
    if 1003 in plays:
        return BetSide.TIE
    return None


def is_baccarat_table(tb: dict) -> bool:
    t_no = str(tb.get("tNo", "")).upper()
    r_no = str(tb.get("rNo", "")).upper()
    if "BAC" in t_no or "BAC" in r_no or "WM-BAC" in r_no:
        return True
    if tb.get("gId") in BACCARAT_GAME_IDS:
        # Loai sicbo/xoc dia theo prefix phong
        if any(t_no.startswith(p) for p in ("LSD", "SD", "DT", "RL", "ON")):
            return False
        return True
    return False


LOBBY_BACCARAT_PREFIXES = ("VNB", "SB", "ONBSB")
# Hall W-BACxx / WM-BACxx khong hien tren lobby ON LIVE
HIDDEN_BACCARAT_RE = re.compile(r"^W-BAC\d", re.I)
WM_BACCARAT_RE = re.compile(r"^WM-BAC", re.I)


def is_lobby_baccarat_table(tb: dict) -> bool:
    if not is_baccarat_table(tb):
        return False
    t_no = str(tb.get("tNo", "")).upper()
    if HIDDEN_BACCARAT_RE.match(t_no) or WM_BACCARAT_RE.match(t_no):
        return False
    return any(t_no.startswith(p) for p in LOBBY_BACCARAT_PREFIXES)


def pick_baccarat_table(
    tables: list[dict],
    *,
    table_name: str = "",
    table_id: int | None = None,
) -> dict | None:
    """Chon ban theo config hoac lobby mac dinh."""
    if table_id is not None:
        for tb in tables:
            if tb.get("tId") == table_id and is_baccarat_table(tb):
                return tb
    if table_name:
        name = table_name.upper()
        for tb in tables:
            if not is_baccarat_table(tb):
                continue
            t_no = str(tb.get("tNo", "")).upper()
            if name in t_no or t_no.startswith(name):
                return tb
        return None
    return pick_first_baccarat_table(tables)


def pick_first_baccarat_table(tables: list[dict]) -> dict | None:
    """Chon ban Baccarat hien tren lobby (VNB/SB...), khong chon W-BAC an."""
    lobby_tables = [tb for tb in tables if is_lobby_baccarat_table(tb)]
    if not lobby_tables:
        lobby_tables = [tb for tb in tables if is_baccarat_table(tb)]
    if not lobby_tables:
        return None

    def sort_key(tb: dict) -> tuple:
        t_no = str(tb.get("tNo", "")).upper()
        prefix_rank = len(LOBBY_BACCARAT_PREFIXES)
        for i, prefix in enumerate(LOBBY_BACCARAT_PREFIXES):
            if t_no.startswith(prefix):
                prefix_rank = i
                break
        history = decode_history_codes(tb.get("history") or [])
        return (prefix_rank, t_no, -len(history))

    lobby_tables.sort(key=sort_key)
    return lobby_tables[0]


def lobby_enter_position(table_name: str) -> tuple[float, float]:
    """Toa do nut 'Vao Tro choi' theo hang ban tren lobby canvas."""
    t_no = str(table_name or "").upper()
    enter_x = 0.90

    if t_no.startswith("VNB"):
        return enter_x, 0.23
    if t_no.startswith("SB"):
        num = int(m.group(1)) if (m := re.search(r"(\d+)", t_no)) else 1
        return enter_x, min(0.53 + (num - 1) * 0.14, 0.82)
    if t_no.startswith("WM-BAC"):
        num = int(m.group(1)) if (m := re.search(r"(\d+)", t_no)) else 1
        return enter_x, min(0.40 + (num - 1) * 0.12, 0.82)
    return enter_x, 0.23


def table_matches(
    *,
    table_name: str,
    table_id: int | None,
    t_no: str = "",
    t_id: int | None = None,
    r_no: str = "",
    destination: str = "",
) -> bool:
    if table_id is not None:
        _, dest_tid = parse_destination(destination)
        if t_id is not None and int(t_id) == int(table_id):
            return True
        if dest_tid is not None and int(dest_tid) == int(table_id):
            return True

    if not table_name:
        return table_id is None

    name = table_name.lower()
    for val in (t_no, r_no, destination):
        if val and name in str(val).lower():
            return True
    return False
