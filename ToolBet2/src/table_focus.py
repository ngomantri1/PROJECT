from __future__ import annotations

import json
import re
from typing import Any

from src.hall import is_hall_playable_baccarat, list_hall_baccarat_tables, pick_first_hall_table
from src.ongames import decode_history_codes

FOCUS_CODES = {1202, 1204, 1302, 1304, 1305, 2202}


def _parse_stomp_json(text: str) -> dict[str, Any] | None:
    cleaned = text.replace("\x00", "")
    if "\n\n" in cleaned:
        body = cleaned.split("\n\n", 1)[1].strip()
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            pass
    jm = re.search(r"(\{.*\})", cleaned, re.DOTALL)
    if not jm:
        return None
    try:
        return json.loads(jm.group(1))
    except json.JSONDecodeError:
        return None


def extract_table_ids_from_ws(text: str) -> list[int]:
    tids: list[int] = []
    dm = re.search(r"destination:/topic/gaming/\d+/(\d+)", text)
    if dm:
        tids.append(int(dm.group(1)))
    data = _parse_stomp_json(text)
    if not data:
        return tids
    code = data.get("code")
    content = data.get("content")
    if code == 1101 and isinstance(content, dict):
        for tb in content.get("tbs") or []:
            if isinstance(tb, dict) and tb.get("tId") is not None:
                tids.append(int(tb["tId"]))
    if code in FOCUS_CODES:
        if isinstance(content, dict) and content.get("tId") is not None:
            tids.append(int(content["tId"]))
        if code == 2202 and isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("tId") is not None:
                    tids.append(int(item["tId"]))
    if code == 1002 and isinstance(content, dict) and content.get("tId") is not None:
        tids.append(int(content["tId"]))
    return tids


def cache_tables_from_ws(text: str, cache: dict[int, dict], order: list[int]) -> int:
    """Cap nhat cache + thu tu ban tu message 1101."""
    if '"code":1101' not in text and '"code": 1101' not in text:
        return 0
    data = _parse_stomp_json(text)
    if not data or data.get("code") != 1101:
        return 0
    content = data.get("content") or {}
    tbs = content.get("tbs") or []
    new_order: list[int] = []
    added = 0
    for tb in tbs:
        if not isinstance(tb, dict) or not is_hall_playable_baccarat(tb):
            continue
        tid = tb.get("tId")
        if tid is None:
            continue
        cache[int(tid)] = tb
        new_order.append(int(tid))
        added += 1
    if new_order:
        order.clear()
        order.extend(new_order)
    return added


def pick_default_lobby_table(
    cache: dict[int, dict],
    order: list[int],
    *,
    table_name: str = "",
    table_id: int | None = None,
) -> tuple[dict | None, list[dict]]:
    tables = [cache[tid] for tid in order if tid in cache]
    return pick_first_hall_table(tables, table_name=table_name, table_id=table_id)


def table_history_len(tb: dict) -> int:
    return len(decode_history_codes(tb.get("history") or []))
