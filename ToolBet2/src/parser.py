from __future__ import annotations

import json
import logging
import re
from typing import Any

from src.models import BetSide, RoundResult, TableState
from src.ongames import (
    decode_baccarat_result,
    decode_history_codes,
    decode_win_play,
    parse_destination,
    pick_first_baccarat_table,
    table_matches,
)

logger = logging.getLogger(__name__)

# Mapping phổ biến trong API casino
RESULT_MAP = {
    "player": BetSide.PLAYER,
    "banker": BetSide.BANKER,
    "tie": BetSide.TIE,
    "p": BetSide.PLAYER,
    "b": BetSide.BANKER,
    "t": BetSide.TIE,
    1: BetSide.PLAYER,
    2: BetSide.BANKER,
    3: BetSide.TIE,
    0: BetSide.PLAYER,
}


def _parse_side(value: Any) -> BetSide | None:
    if value is None:
        return None
    if isinstance(value, BetSide):
        return value
    key = value if isinstance(value, int) else str(value).lower().strip()
    return RESULT_MAP.get(key)


def _dig(data: Any, *keys: str) -> Any:
    current = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def parse_game_message(
    payload: str | bytes,
    *,
    table_name: str = "",
    table_id: int | None = None,
) -> dict[str, Any] | None:
    """Parse JSON từ WebSocket / XHR / STOMP. Trả về dict chuẩn hóa hoặc None."""
    try:
        if isinstance(payload, bytes):
            payload = payload.decode("utf-8", errors="ignore")
        text = payload.strip().replace("\x00", "")
        if not text:
            return None

        # STOMP frame từ ongames.info
        if text.startswith("MESSAGE") or "destination:/topic/" in text:
            return _parse_stomp_message(text, table_name=table_name, table_id=table_id)

        if text[0] not in "{[":
            # JSON nhúng trong frame
            m = re.search(r"(\{.*\})", text, re.DOTALL)
            if m:
                text = m.group(1)
            else:
                return None
        data = json.loads(text)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None

    if isinstance(data, list):
        for item in data:
            parsed = parse_game_message(
                json.dumps(item), table_name=table_name, table_id=table_id
            )
            if parsed:
                return parsed
        return None

    if not isinstance(data, dict):
        return None

    event = _extract_event(data)
    if event:
        return event

    return None


def _parse_stomp_message(text: str, *, table_name: str = "", table_id: int | None = None) -> dict[str, Any] | None:
    m = re.search(r"destination:([^\n]+)", text)
    destination = m.group(1).strip() if m else ""
    hall, dest_table_id = parse_destination(destination)
    jm = re.search(r"(\{.*\})", text, re.DOTALL)
    if not jm:
        return None
    try:
        data = json.loads(jm.group(1))
    except json.JSONDecodeError:
        return None

    code = data.get("code")
    content = data.get("content") or {}

    # 1302: trạng thái ván — rSt=1 mở cược
    if code == 1302:
        r_no = str(content.get("rNo", ""))
        r_st = content.get("rSt")
        matched = table_matches(
            table_name=table_name,
            table_id=table_id,
            r_no=r_no,
            destination=destination,
            t_id=dest_table_id,
        )
        if table_id is not None or table_name:
            if not matched:
                return None
        return {
            "type": "round_state",
            "round_id": r_no,
            "phase": "betting" if r_st == 1 else "closed",
            "round_status": r_st,
            "table_id": dest_table_id,
            "hall": hall,
            "destination": destination,
            "raw": data,
        }

    if code == 1002 and content.get("result"):
        side = decode_baccarat_result(str(content["result"]))
        if not side:
            return None
        matched = table_matches(
            table_name=table_name,
            table_id=table_id,
            t_id=content.get("tId"),
            r_no=str(content.get("rNo", "")),
        )
        if (table_id is not None or table_name) and not matched:
            return None
        return {
            "type": "round_result",
            "round_id": str(content.get("rNo", "")),
            "side": side,
            "table_id": content.get("tId"),
            "result_code": content.get("result"),
            "raw": data,
        }

    if code == 1305:
        res = content.get("result") or {}
        win_play = str(content.get("winPlay", ""))
        side = decode_win_play(win_play)
        matched = table_matches(
            table_name=table_name,
            table_id=table_id,
            destination=destination,
            t_id=dest_table_id,
        )
        if (table_id is not None or table_name) and not matched:
            return None
        return {
            "type": "round_result" if side else "dealing_complete",
            "round_id": "",
            "side": side,
            "table_id": dest_table_id,
            "player_cards": res.get("player"),
            "banker_cards": res.get("banker"),
            "destination": destination,
            "raw": data,
        }

    if code == 1204:
        matched = table_matches(
            table_name=table_name,
            table_id=table_id,
            destination=destination,
            t_id=dest_table_id,
        )
        if (table_id is not None or table_name) and not matched:
            return None
        res = content.get("result") or {}
        return {
            "type": "dealing",
            "phase": "dealing",
            "step": res.get("step"),
            "player_cards": res.get("player"),
            "banker_cards": res.get("banker"),
            "destination": destination,
            "table_id": dest_table_id,
            "raw": data,
        }

    if code == 1101:
        tbs = content.get("tbs") or []
        if table_id is not None:
            matched_tables = [tb for tb in tbs if tb.get("tId") == table_id]
        elif table_name:
            matched_tables = [
                tb for tb in tbs
                if table_matches(
                    table_name=table_name,
                    table_id=None,
                    t_no=str(tb.get("tNo", "")),
                    t_id=tb.get("tId"),
                    r_no=str(tb.get("rNo", "")),
                )
            ]
        else:
            picked = pick_first_baccarat_table(tbs)
            matched_tables = [picked] if picked else []
        if matched_tables:
            return {"type": "table_list", "tables": matched_tables, "raw": data}

    return None


def _extract_event(data: dict) -> dict[str, Any] | None:
    """Tìm kết quả ván, trạng thái bàn trong nhiều format API khác nhau."""

    # Format: { code: 200, data: { ... } }
    inner = data.get("data", data)
    if isinstance(inner, list) and inner:
        for item in inner:
            if isinstance(item, dict):
                evt = _extract_event(item)
                if evt:
                    return evt

    round_id = (
        _dig(data, "roundId")
        or _dig(data, "round_id")
        or _dig(data, "gameRoundId")
        or _dig(data, "shoeRoundId")
        or _dig(inner, "roundId")
        or _dig(inner, "round_id")
        or data.get("gr")
    )

    result_raw = (
        _dig(data, "result")
        or _dig(data, "winner")
        or _dig(data, "winType")
        or _dig(data, "gameResult")
        or _dig(inner, "result")
        or _dig(inner, "winner")
    )

    side = _parse_side(result_raw)
    if side is not None:
        return {
            "type": "round_result",
            "round_id": str(round_id or ""),
            "side": side,
            "player_score": _dig(data, "playerScore") or _dig(inner, "playerScore"),
            "banker_score": _dig(data, "bankerScore") or _dig(inner, "bankerScore"),
            "raw": data,
        }

    # Trạng thái bàn / countdown
    phase = (
        _dig(data, "status")
        or _dig(data, "phase")
        or _dig(data, "gameStatus")
        or _dig(inner, "status")
    )
    countdown = _dig(data, "countdown") or _dig(data, "timer") or _dig(inner, "countdown")

    if phase is not None or countdown is not None:
        return {
            "type": "table_status",
            "phase": str(phase) if phase is not None else "unknown",
            "countdown": int(countdown) if countdown is not None else None,
            "round_id": str(round_id or ""),
            "raw": data,
        }

    # Lịch sử roadmap
    history_raw = (
        _dig(data, "history")
        or _dig(data, "roadmap")
        or _dig(data, "bigRoad")
        or _dig(inner, "history")
    )
    if isinstance(history_raw, list) and history_raw:
        sides = [_parse_side(h) for h in history_raw]
        sides = [s for s in sides if s is not None]
        if sides:
            return {"type": "history", "history": sides, "raw": data}

    # xocDiaStatus / bacarat status từ console log site
    if "xocDiaStatus" in str(data).lower() or "baccarat" in str(data).lower():
        for k, v in _flatten(data).items():
            side = _parse_side(v)
            if side and "result" in k.lower():
                return {
                    "type": "round_result",
                    "round_id": str(round_id or ""),
                    "side": side,
                    "raw": data,
                }

    return None


def _flatten(obj: Any, prefix: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            out.update(_flatten(v, key))
    else:
        out[prefix] = obj
    return out


def apply_event(state: TableState, event: dict[str, Any]) -> RoundResult | None:
    if event["type"] == "table_status":
        state.phase = event.get("phase", state.phase)
        state.countdown = event.get("countdown")
        if event.get("round_id"):
            state.current_round_id = event["round_id"]
        return None

    if event["type"] == "table_list":
        tables = event.get("tables") or []
        if tables:
            tb = tables[0]
            new_tid = str(tb.get("tId", ""))
            if new_tid and state.table_id and new_tid != state.table_id:
                state.history = []
                state.current_round_id = ""
            state.table_id = new_tid or state.table_id
            state.table_name = str(tb.get("tNo", state.table_name))
            if tb.get("rNo"):
                state.current_round_id = str(tb["rNo"])
            state.history = decode_history_codes(tb.get("history") or [])
        return None

    if event["type"] == "round_state":
        state.phase = event.get("phase", state.phase)
        if event.get("round_id"):
            state.current_round_id = event["round_id"]
        if event.get("table_id"):
            state.table_id = str(event["table_id"])
        return None

    if event["type"] == "history":
        state.history = event["history"]
        return None

    if event["type"] == "dealing":
        state.phase = "dealing"
        return None

    if event["type"] == "round_result":
        side = event.get("side")
        if side is None:
            return None
        round_id = event.get("round_id") or state.current_round_id or _gen_round_id()
        if not event.get("round_id") and state.current_round_id:
            round_id = state.current_round_id
        result = RoundResult(
            round_id=round_id,
            side=side,
            player_score=event.get("player_score"),
            banker_score=event.get("banker_score"),
            raw=event.get("raw"),
        )
        if event.get("table_id"):
            state.table_id = str(event["table_id"])
        # Tranh double-append khi 1101 da cap nhat lich su truoc 1002/1305
        already_latest = (
            state.history
            and state.history[-1] == side
            and round_id
            and state.current_round_id == round_id
        )
        if not already_latest:
            state.history.append(side)
        state.current_round_id = round_id
        state.phase = "result"
        return result

    return None


def _gen_round_id() -> str:
    import time
    return f"R{int(time.time() * 1000)}"


def extract_round_id_from_text(text: str) -> str | None:
    """Ván GR232672477R từ UI."""
    m = re.search(r"GR\d+R?", text, re.IGNORECASE)
    return m.group(0) if m else None
