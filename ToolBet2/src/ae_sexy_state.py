"""Single source of truth — vi tri game AE SEXY va quyet dinh tu probe."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

TABLE_CODE_RE = re.compile(r"C(\d+)", re.I)

PHASE_ROOM = "room"
PHASE_LOBBY = "lobby"
PHASE_LOADING = "loading"
PHASE_WEB = "web"


class GamePosition(str, Enum):
    WEB = "web"
    WEB_PROMO = "web_promo"
    GAME_IFRAME_DEAD = "game_iframe_dead"
    GAME_LOADING = "game_loading"
    GAME_WELCOME_BACK = "game_welcome_back"
    GAME_SESSION_EXPIRED = "game_session_expired"
    GAME_FATAL_1008 = "game_fatal_1008"
    GAME_LOBBY = "game_lobby"
    GAME_TRANSITION = "game_transition"
    GAME_ROOM = "game_room"
    GAME_ROOM_BROKEN = "game_room_broken"
    FEED_DISCONNECTED = "feed_disconnected"


POSITION_LABEL = {
    GamePosition.WEB: "trang web casino",
    GamePosition.WEB_PROMO: "promo AE SEXY (Vao choi)",
    GamePosition.GAME_IFRAME_DEAD: "iframe game chua mo",
    GamePosition.GAME_LOADING: "game dang load",
    GamePosition.GAME_WELCOME_BACK: "welcome-back",
    GamePosition.GAME_SESSION_EXPIRED: "session het han",
    GamePosition.GAME_FATAL_1008: "loi 1008/token",
    GamePosition.GAME_LOBBY: "sanh AE SEXY",
    GamePosition.GAME_TRANSITION: "dang vao ban",
    GamePosition.GAME_ROOM: "trong ban",
    GamePosition.GAME_ROOM_BROKEN: "ban stream loi",
    GamePosition.FEED_DISCONNECTED: "mat feed WS/HTTP",
}


@dataclass
class GameProbe:
    """Ket qua probe day du — moi quyet dinh derive tu day."""

    position: GamePosition
    shell_mode: str = "none"
    game_launched: bool = False
    iframe_visible: bool = False
    promo_visible: bool = False
    welcome_back: bool = False
    session_expired: bool = False
    fatal_error: bool = False
    fatal_reason: str = ""
    lobby_tables: list[str] = field(default_factory=list)
    room_table: str = ""
    stream: dict[str, Any] = field(default_factory=dict)
    room_info: dict[str, Any] = field(default_factory=dict)
    has_nested_room: bool = False
    dom_stats: dict[str, int] = field(default_factory=dict)
    feed_healthy: bool = False
    history_len: int = 0
    confidence: float = 0.0
    reason: str = ""

    def summary(self) -> str:
        parts = [
            f"pos={self.position.value}",
            f"shell={self.shell_mode}",
            f"lobby={len(self.lobby_tables)}",
            f"room={self.room_table or '-'}",
            f"stream={'OK' if self.stream.get('streamOk') else 'x'}",
            f"feed={'OK' if self.feed_healthy else 'x'}",
            f"hist={self.history_len}",
        ]
        if self.reason:
            parts.append(self.reason)
        return " ".join(parts)


def table_codes_match(wanted: str, detected: str) -> bool:
    if not wanted or not detected:
        return True
    wm = TABLE_CODE_RE.search(wanted)
    dm = TABLE_CODE_RE.search(detected)
    if wm and dm:
        return wm.group(1) == dm.group(1)
    return wanted.upper() in detected.upper() or detected.upper() in wanted.upper()


def _stream_ok(probe: GameProbe) -> bool:
    return bool(probe.stream.get("streamOk") and not probe.stream.get("blackScreen"))


def _stats_total(probe: GameProbe) -> int:
    return sum(probe.dom_stats.values()) if probe.dom_stats else 0


def _lobby_ui_visible(
    *,
    shell_mode: str,
    lobby_tables: list[str],
    room_info: dict[str, Any] | None,
) -> bool:
    """Sanh ro: shell lobby + the ban. Ghost hall DOM khi shell=room KHONG tinh."""
    # Dang trong ban (shell) — the ban trong hall an khong duoc coi la sanh
    if shell_mode == "room":
        return False
    ri = room_info or {}
    table_count = int(ri.get("tableCount") or 0)
    if shell_mode == "lobby" and (len(lobby_tables) >= 2 or table_count >= 2):
        return True
    if shell_mode == "lobby" and ri.get("isLobby") and table_count >= 2:
        return True
    if table_count >= 3 and shell_mode in ("lobby", "unknown", "none"):
        return True
    return False


def _clearly_in_room_dom(
    stream: dict[str, Any],
    room_info: dict[str, Any],
    *,
    has_nested_room: bool,
    dom_stats: dict[str, int] | None = None,
) -> bool:
    """
    Trong ban that — chip/bet (+ stream neu co).
    Video den VAN la trong ban neu con chip/cua cuoc (can reload, khong ra sanh).
    """
    ri = room_info or {}
    table_count = int(ri.get("tableCount") or 0)
    stream_ok = bool(stream.get("streamOk") and not stream.get("blackScreen"))
    # Chi CHIP DOM = trong ban. hasBet text ("Mo bai") xuat hien tren the SANH.
    has_chip = bool(ri.get("hasChip") or stream.get("hasChip"))
    has_bet_strict = bool(ri.get("hasBet") and ri.get("hasChip"))

    # Chip = trong ban — ghost hall text (tableCount cao / isLobby) KHONG day ra sanh
    # (dly8829 webMain: DOM van con ~19 ten Baccarat Cxx an khi dang choi)
    if has_chip:
        return True
    if ri.get("isLobby") or table_count >= 3:
        return False
    if has_bet_strict and table_count <= 1:
        return True

    if not stream_ok:
        return False
    stats_total = sum(dom_stats.values()) if dom_stats else 0
    if (
        (ri.get("hasStats") or stats_total > 0)
        and not ri.get("isLobby")
        and table_count <= 1
        and stream.get("hasRoad")
        and has_nested_room
    ):
        return True
    return False


def _clearly_in_room_probe(probe: GameProbe) -> bool:
    return _clearly_in_room_dom(
        probe.stream,
        probe.room_info,
        has_nested_room=probe.has_nested_room,
        dom_stats=probe.dom_stats,
    )


def _room_signals(probe: GameProbe) -> bool:
    ri = probe.room_info or {}
    return bool(
        ri.get("hasChip")
        or probe.stream.get("hasChip")
        or (ri.get("hasChip") and ri.get("hasBet"))
        or (ri.get("hasStats") and not ri.get("isLobby") and int(ri.get("tableCount") or 0) <= 1)
        or (probe.stream.get("hasRoad") and ri.get("hasChip"))
        or (_stream_ok(probe) and ri.get("hasChip"))
        or (_stats_total(probe) > 0 and ri.get("hasChip"))
    )


def _table_ok(probe: GameProbe, table_name: str) -> bool:
    """Khi yeu cau ban cu the: phai detect dung ma ban (hoac chua detect + UI room ro)."""
    if not table_name:
        return True
    if probe.room_table:
        return table_codes_match(table_name, probe.room_table)
    # Chua doc duoc ten ban — chap nhan neu shell/UI room ro
    if probe.shell_mode == "room" or probe.position in (
        GamePosition.GAME_ROOM,
        GamePosition.GAME_ROOM_BROKEN,
    ):
        return True
    return _clearly_in_room_probe(probe)


def classify_position(
    *,
    game_launched: bool,
    iframe_visible: bool,
    promo_visible: bool,
    welcome_back: bool,
    session_expired: bool,
    fatal_error: bool,
    shell_mode: str,
    lobby_tables: list[str],
    stream: dict[str, Any],
    room_info: dict[str, Any],
    feed_healthy: bool,
    history_len: int,
    has_nested_room: bool,
    dom_stats: dict[str, int] | None = None,
) -> tuple[GamePosition, float, str]:
    """Phan loai vi tri tu tin hieu UI — KHONG dung feed/history lam bang chung vi tri."""
    if fatal_error:
        return GamePosition.GAME_FATAL_1008, 1.0, "fatal_1008"
    if promo_visible and not game_launched:
        return GamePosition.WEB_PROMO, 0.95, "promo_visible"
    if welcome_back:
        return GamePosition.GAME_WELCOME_BACK, 0.9, "welcome_back"
    if session_expired:
        return GamePosition.GAME_SESSION_EXPIRED, 0.9, "session_expired"
    if not game_launched:
        return GamePosition.GAME_IFRAME_DEAD, 0.85, "iframe_not_launched"
    if not iframe_visible:
        return GamePosition.GAME_LOADING, 0.7, "iframe_hidden"

    stream_dead = bool(stream.get("blackScreen") and stream.get("streamDead"))
    stream_ok = bool(stream.get("streamOk") and not stream.get("blackScreen"))
    has_road = bool(stream.get("hasRoad"))
    ri = room_info or {}
    table_count = int(ri.get("tableCount") or 0)

    clearly_room = _clearly_in_room_dom(
        stream, room_info, has_nested_room=has_nested_room, dom_stats=dom_stats
    )
    # UI room ro (chip/bet) — ke ca video den → ROOM_BROKEN (reload), khong ra sanh
    if clearly_room:
        if stream_dead or (
            stream.get("blackScreen") and stream.get("streamDead")
        ):
            return GamePosition.GAME_ROOM_BROKEN, 0.92, "room_black_video"
        return GamePosition.GAME_ROOM, 0.93, "room_dom_clear"

    # shell=room uu tien hon ghost lobby_tables (hall an van con ten ban)
    if shell_mode == "room":
        if stream_dead or (stream.get("blackScreen") and stream.get("streamDead")):
            return GamePosition.GAME_ROOM_BROKEN, 0.88, "shell_room_black"
        return GamePosition.GAME_ROOM, 0.9, "shell_room"

    visible_lobby = _lobby_ui_visible(
        shell_mode=shell_mode,
        lobby_tables=lobby_tables,
        room_info=room_info,
    )
    # Sanh UI ro — luon sanh, ke ca WS/HTTP van song
    if visible_lobby:
        return (
            GamePosition.GAME_LOBBY,
            0.92,
            f"lobby_tables={len(lobby_tables)}|tc={table_count}",
        )

    if stream_dead and has_road and shell_mode in ("room", "loading"):
        return GamePosition.GAME_ROOM_BROKEN, 0.85, "black_screen"

    if stream_ok and shell_mode in ("room", "loading"):
        return GamePosition.GAME_ROOM, 0.9, "shell_room+stream"

    if shell_mode == "loading" or (has_nested_room and not visible_lobby):
        return GamePosition.GAME_TRANSITION, 0.75, "transition"

    # Feed chi bao suc khoe nguon — KHONG bao vi tri. Neu khong co UI room → loading.
    if not feed_healthy and history_len >= 3 and shell_mode in ("room", "loading"):
        return GamePosition.FEED_DISCONNECTED, 0.7, "feed_stale"

    if shell_mode in ("none", "unknown"):
        if stream_ok or has_nested_room:
            return GamePosition.GAME_TRANSITION, 0.6, f"shell_{shell_mode}"
        return GamePosition.GAME_LOADING, 0.5, f"shell_{shell_mode}"

    return GamePosition.GAME_LOADING, 0.5, "default_loading"


def probe_in_room(probe: GameProbe, table_name: str = "") -> bool:
    """
    Dang trong ban — CHI dua tren UI (shell/chip/stream/stats).
    Feed WS/HTTP KHONG du de coi la trong ban (sanh van nhan GP_WINNER).
    """
    if probe.position in (
        GamePosition.GAME_FATAL_1008,
        GamePosition.WEB_PROMO,
        GamePosition.GAME_LOBBY,
        GamePosition.GAME_SESSION_EXPIRED,
        GamePosition.GAME_WELCOME_BACK,
        GamePosition.WEB,
        GamePosition.GAME_IFRAME_DEAD,
    ):
        return False

    if probe.position == GamePosition.GAME_ROOM_BROKEN:
        # Van TRONG BAN neu con CHIP DOM — chi stream hong (man den).
        # Khong dung hasBet text ("Mo bai" tren the sanh).
        ri = probe.room_info or {}
        if ri.get("hasChip") or probe.stream.get("hasChip"):
            return _table_ok(probe, table_name)
        return False

    if _lobby_ui_visible(
        shell_mode=probe.shell_mode,
        lobby_tables=probe.lobby_tables,
        room_info=probe.room_info,
    ) and not _clearly_in_room_probe(probe):
        return False

    if _clearly_in_room_probe(probe):
        return _table_ok(probe, table_name)

    if probe.position == GamePosition.GAME_ROOM:
        return _table_ok(probe, table_name)

    if probe.shell_mode == "lobby" and not _clearly_in_room_probe(probe):
        return False

    if len(probe.lobby_tables) >= 2 and not _clearly_in_room_probe(probe):
        return False

    ri = probe.room_info or {}
    has_chip = bool(ri.get("hasChip") or probe.stream.get("hasChip"))
    # Man den + khong chip = khong coi la trong ban
    if probe.stream.get("blackScreen") and probe.stream.get("streamDead") and not has_chip:
        return False

    stream_ok = _stream_ok(probe)
    stats_ok = _stats_total(probe) > 0

    if has_chip and probe.shell_mode in ("room", "loading"):
        return _table_ok(probe, table_name)

    if stream_ok and probe.shell_mode in ("room", "loading") and has_chip:
        return _table_ok(probe, table_name)

    if stream_ok and probe.shell_mode == "room" and has_chip:
        return _table_ok(probe, table_name)

    if stats_ok and probe.shell_mode == "room" and has_chip:
        return _table_ok(probe, table_name)

    if _room_signals(probe) and probe.shell_mode == "room" and has_chip:
        return _table_ok(probe, table_name)

    return False


def probe_table_ready(probe: GameProbe, table_name: str = "") -> bool:
    """Trong ban VA san sang theo doi/cuoc."""
    if not probe_in_room(probe, table_name):
        return False

    if probe.feed_healthy and probe.history_len >= 3:
        return True

    stream_ok = _stream_ok(probe)
    stats_ok = _stats_total(probe) >= 1

    if stream_ok and stats_ok:
        return True

    ri = probe.room_info or {}
    if stream_ok and (ri.get("hasChip") or probe.stream.get("hasChip")):
        return True

    if stats_ok and probe.stream.get("hasRoad"):
        return True

    return False


def probe_is_lobby(probe: GameProbe) -> bool:
    if _clearly_in_room_probe(probe):
        return False
    if probe.position == GamePosition.GAME_LOBBY:
        return True
    if _lobby_ui_visible(
        shell_mode=probe.shell_mode,
        lobby_tables=probe.lobby_tables,
        room_info=probe.room_info,
    ):
        return True
    return probe.position == GamePosition.WEB_PROMO and probe.game_launched


def probe_to_phase(probe: GameProbe) -> str:
    """Map probe -> phase legacy (4 gia tri) cho main/watch."""
    if probe.position == GamePosition.GAME_ROOM:
        return PHASE_ROOM
    if probe.position == GamePosition.GAME_ROOM_BROKEN:
        # Van trong ban (man den) — watch dung ROOM de reload, khong nhay sanh
        return PHASE_ROOM
    if probe.position == GamePosition.GAME_LOBBY:
        return PHASE_LOBBY
    if probe.position in (
        GamePosition.GAME_TRANSITION,
        GamePosition.GAME_LOADING,
        GamePosition.FEED_DISCONNECTED,
        GamePosition.GAME_WELCOME_BACK,
        GamePosition.GAME_SESSION_EXPIRED,
        GamePosition.GAME_FATAL_1008,
    ):
        return PHASE_LOADING
    if probe_in_room(probe):
        return PHASE_ROOM
    if probe_is_lobby(probe):
        return PHASE_LOBBY
    if probe.game_launched:
        return PHASE_LOADING
    return PHASE_WEB


def build_probe(**kwargs: Any) -> GameProbe:
    pos, conf, reason = classify_position(
        game_launched=kwargs.get("game_launched", False),
        iframe_visible=kwargs.get("iframe_visible", False),
        promo_visible=kwargs.get("promo_visible", False),
        welcome_back=kwargs.get("welcome_back", False),
        session_expired=kwargs.get("session_expired", False),
        fatal_error=kwargs.get("fatal_error", False),
        shell_mode=kwargs.get("shell_mode", "none"),
        lobby_tables=kwargs.get("lobby_tables") or [],
        stream=kwargs.get("stream") or {},
        room_info=kwargs.get("room_info") or {},
        feed_healthy=kwargs.get("feed_healthy", False),
        history_len=kwargs.get("history_len", 0),
        has_nested_room=kwargs.get("has_nested_room", False),
        dom_stats=kwargs.get("dom_stats") or {},
    )
    return GameProbe(
        position=pos,
        confidence=conf,
        reason=reason,
        shell_mode=kwargs.get("shell_mode", "none"),
        game_launched=kwargs.get("game_launched", False),
        iframe_visible=kwargs.get("iframe_visible", False),
        promo_visible=kwargs.get("promo_visible", False),
        welcome_back=kwargs.get("welcome_back", False),
        session_expired=kwargs.get("session_expired", False),
        fatal_error=kwargs.get("fatal_error", False),
        fatal_reason=kwargs.get("fatal_reason", ""),
        lobby_tables=list(kwargs.get("lobby_tables") or []),
        room_table=kwargs.get("room_table") or "",
        stream=dict(kwargs.get("stream") or {}),
        room_info=dict(kwargs.get("room_info") or {}),
        has_nested_room=kwargs.get("has_nested_room", False),
        dom_stats=dict(kwargs.get("dom_stats") or {}),
        feed_healthy=kwargs.get("feed_healthy", False),
        history_len=int(kwargs.get("history_len") or 0),
    )
