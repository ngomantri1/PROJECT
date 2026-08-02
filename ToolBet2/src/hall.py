from __future__ import annotations

import re

from src.ongames import decode_history_codes, is_baccarat_table, pick_baccarat_table

HIDDEN_BACCARAT_RE = re.compile(r"^W-BAC\d", re.I)
WM_BACCARAT_RE = re.compile(r"^WM-BAC", re.I)

# Cac phong khong phai Baccarat trong sanh (xoc dia, sicbo...)
NON_BACCARAT_PREFIXES = ("VNS", "LSD", "SD", "DT", "RL", "ONLSD", "ONX", "ONSD")


def is_hall_playable_baccarat(tb: dict) -> bool:
    """Ban Baccarat co the vao trong sanh hien tai."""
    if not is_baccarat_table(tb):
        return False
    t_no = str(tb.get("tNo", "")).upper()
    if HIDDEN_BACCARAT_RE.match(t_no) or WM_BACCARAT_RE.match(t_no):
        return False
    if any(t_no.startswith(p) for p in NON_BACCARAT_PREFIXES):
        return False
    return True


def list_hall_baccarat_tables(tables: list[dict]) -> list[dict]:
    """Lay danh sach ban Baccarat theo thu tu trong message 1101."""
    return [tb for tb in tables if is_hall_playable_baccarat(tb)]


def pick_first_hall_table(
    tables: list[dict],
    *,
    table_name: str = "",
    table_id: int | None = None,
) -> tuple[dict | None, list[dict]]:
    """Chon ban: config uu tien, khong thi ban Baccarat dau tien trong sanh."""
    hall_tables = list_hall_baccarat_tables(tables)
    if table_name or table_id is not None:
        picked = pick_baccarat_table(hall_tables or tables, table_name=table_name, table_id=table_id)
        return picked, hall_tables
    if hall_tables:
        return hall_tables[0], hall_tables
    return None, hall_tables


def lobby_row_position(index: int) -> tuple[float, float]:
    """Toa do click hang thu `index` (0 = phong dau tien) tren lobby canvas."""
    enter_x = 0.90
    first_y = 0.23
    row_h = 0.14
    return enter_x, min(first_y + index * row_h, 0.82)
