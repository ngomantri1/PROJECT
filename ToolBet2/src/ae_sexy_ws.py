from __future__ import annotations

import json
import logging
import re
from typing import Any

from src.models import BetSide

logger = logging.getLogger(__name__)

# road trong bigRoads: bit flag AE SEXY
# 0=Banker, 1=Player, 2=Tie (co the kem pair/lucky6)
ROAD_TO_SIDE = {
    0: BetSide.BANKER,
    1: BetSide.PLAYER,
    2: BetSide.TIE,
    8: BetSide.PLAYER,
    9: BetSide.BANKER,
    10: BetSide.PLAYER,
    12: BetSide.BANKER,
}


def table_name_to_ids(table_name: str) -> list[int]:
    """Map 'Baccarat C03' -> [1003] — chi dung tableID chuan 1000+n."""
    m = re.search(r"C(\d+)", table_name, re.I)
    if not m:
        return []
    return [1000 + int(m.group(1))]


def table_id_to_name(table_id: int) -> str:
    """Map 1008 -> 'Baccarat C08'."""
    n = int(table_id) - 1000
    if n < 1:
        return ""
    return f"Baccarat C{n:02d}"


def primary_table_id(table_name: str) -> int | None:
    ids = table_name_to_ids(table_name)
    return ids[0] if ids else None


# markerRoads — ma ket qua van (co pair/lucky6). Khac bigRoads bit flag.
MARKER_ROAD_TO_SIDE: dict[int, BetSide] = {
    0: BetSide.BANKER,
    1: BetSide.PLAYER,
    2: BetSide.TIE,
    3: BetSide.BANKER,   # cai + pair con
    4: BetSide.BANKER,
    5: BetSide.BANKER,   # cai + pair cai
    6: BetSide.PLAYER,   # con + pair (player win)
    7: BetSide.PLAYER,   # con + pair
    8: BetSide.PLAYER,
    9: BetSide.TIE,      # hoa (pair/lucky6 variant)
    10: BetSide.TIE,     # hoa tren bead plate (truoc day nham thanh Player)
    11: BetSide.TIE,
    12: BetSide.BANKER,
}


def decode_marker_item(item: dict[str, Any]) -> BetSide | None:
    """Giai ma 1 muc markerRoads — road + bigSmall (pair variant)."""
    road = int(item.get("road", -1))
    if road in MARKER_ROAD_TO_SIDE:
        return MARKER_ROAD_TO_SIDE[road]
    return decode_marker_road(road) or decode_road(road)


def decode_marker_road(road: int) -> BetSide | None:
    """markerRoads — uu tien bang ma day du, khong dung 2 bit thap."""
    if road in MARKER_ROAD_TO_SIDE:
        return MARKER_ROAD_TO_SIDE[road]
    low = road & 0x03
    if low == 0:
        return BetSide.BANKER
    if low == 1:
        return BetSide.PLAYER
    if low in (2, 3):
        return BetSide.TIE
    return decode_road(road)


def decode_road(road: int) -> BetSide | None:
    if road in ROAD_TO_SIDE:
        return ROAD_TO_SIDE[road]
    base = road & 0x0F
    side = ROAD_TO_SIDE.get(base)
    if side:
        return side
    return _side_from_int(road)


def parse_ae_ws_payload(text: str) -> list[dict[str, Any]]:
    """Tach JSON tu frame WS (bo prefix byte)."""
    out: list[dict[str, Any]] = []
    start = text.find("{")
    if start < 0:
        return out
    try:
        out.append(json.loads(text[start:]))
    except json.JSONDecodeError:
        pass
    return out


def extract_road_info(data: dict[str, Any]) -> dict[str, Any] | None:
    if data.get("messageType") != "GameHallInfo":
        return None
    msg = data.get("message") or {}
    if "roadInfo" in msg:
        return msg["roadInfo"]
    return None


def decode_winner_side(msg: dict[str, Any]) -> BetSide | None:
    """GP_WINNER / dealerEvent — tim ket qua van."""
    for key in ("winner", "winPlay", "result", "road", "w", "r"):
        val = msg.get(key)
        if val is None:
            continue
        if isinstance(val, int):
            side = _side_from_int(val)
            if side:
                return side
        if isinstance(val, str):
            v = val.lower()
            if v in ("banker", "b", "1"):
                return BetSide.BANKER
            if v in ("player", "p", "2"):
                return BetSide.PLAYER
            if v in ("tie", "t", "0"):
                return BetSide.TIE
            if val.isdigit():
                side = _side_from_int(int(val))
                if side:
                    return side
    return None


def decode_big_road_item(item: dict) -> BetSide | None:
    """bigRoads — count=1 thuong la hoa."""
    road = int(item.get("road", -1))
    count = int(item.get("count", 0))
    if count == 1 and road in (4, 12):
        return BetSide.TIE
    return decode_road(road)


def format_road_info_summary(road: dict[str, Any], *, tool_len: int = -1) -> str:
    """Tom tat roadInfo de debug — hien thi tren log."""
    tid = road.get("tableID", "?")
    rnd = road.get("gameRound", "?")
    shoe = road.get("gameShoe", "?")
    counts = road.get("winCounts") or []
    big = road.get("bigRoads") or []
    parts = [
        f"table={tid}",
        f"round={rnd}",
        f"shoe={shoe}",
        f"winCounts={list(counts) if counts else '[]'}",
        f"bigRoads={len(big)}",
    ]
    if big:
        item = big[0] if len(big) == 1 else max(big, key=lambda x: int(x.get("stampTime") or 0))
        road_val = int(item.get("road", -1))
        side = decode_big_road_item(item) or decode_road(road_val)
        side_s = side.value if side else "?"
        parts.append(
            f"latest={{road={road_val},count={item.get('count')},stamp={item.get('stampTime')}->{side_s}}}"
        )
    if tool_len >= 0:
        parts.append(f"tool={tool_len}van")
    return "roadInfo: " + " | ".join(parts)


def extract_winner_event(data: dict[str, Any]) -> dict[str, Any] | None:
    if data.get("messageType") != "GameHallInfo":
        return None
    msg = data.get("message") or {}
    if msg.get("eventType") == "GP_WINNER":
        return msg
    return None


def _side_from_int(val: int) -> BetSide | None:
    return {
        0: BetSide.BANKER,
        1: BetSide.PLAYER,
        2: BetSide.TIE,
        3: BetSide.TIE,
        4: BetSide.BANKER,
        5: BetSide.PLAYER,
        6: BetSide.BANKER,
        7: BetSide.PLAYER,
        8: BetSide.PLAYER,
        9: BetSide.BANKER,
        10: BetSide.PLAYER,
        12: BetSide.BANKER,
    }.get(val)


def extract_full_road_from_message(data: dict[str, Any]) -> list[BetSide]:
    """Tim mang lich su day du trong bat ky message WS nao."""
    sides: list[BetSide] = []

    def walk(obj: Any, depth: int = 0):
        if depth > 8:
            return
        if isinstance(obj, list):
            if len(obj) >= 10:
                # mang so — bead plate encoded
                if all(isinstance(x, int) for x in obj):
                    decoded = [_side_from_int(x) for x in obj]
                    if sum(1 for d in decoded if d) >= len(obj) * 0.7:
                        sides.extend(d for d in decoded if d)
                        return
                # mang object co result/winner
                if all(isinstance(x, dict) for x in obj):
                    for item in obj:
                        for k in ("result", "winner", "road", "w", "r", "win"):
                            if k in item:
                                s = _side_from_int(item[k]) if isinstance(item[k], int) else decode_road(int(item[k])) if str(item[k]).isdigit() else None
                                if s:
                                    sides.append(s)
                                    break
            for item in obj[:5]:
                walk(item, depth + 1)
            return
        if isinstance(obj, dict):
            for key in (
                "beadPlate", "beadRoad", "plateRoad", "roads", "roadList",
                "history", "results", "bigRoads", "beadPlates", "roadResults",
            ):
                if key in obj and isinstance(obj[key], list) and len(obj[key]) >= 5:
                    walk(obj[key], depth + 1)
            for k, v in obj.items():
                if k in ("message", "data", "roadInfo", "tableInfo"):
                    walk(v, depth + 1)

    walk(data)
    return sides


def extract_all_roads_from_hooked(messages: list[dict]) -> dict[int, list[BetSide]]:
    """Parse tat ca message da hook — tim road day du theo tableID."""
    by_table: dict[int, list[BetSide]] = {}
    for data in messages:
        road = extract_road_info(data)
        if road:
            tid = int(road.get("tableID", 0))
            entries = by_table.setdefault(tid, [])
            for br in road.get("bigRoads") or []:
                side = decode_road(int(br.get("road", -1)))
                if side:
                    entries.append(side)
        full = extract_full_road_from_message(data)
        if full:
            tid = 0
            msg = data.get("message") or {}
            if "tableID" in msg:
                tid = int(msg["tableID"])
            elif "roadInfo" in msg:
                tid = int(msg["roadInfo"].get("tableID", 0))
            if tid:
                if len(full) > len(by_table.get(tid, [])):
                    by_table[tid] = full
    return by_table
