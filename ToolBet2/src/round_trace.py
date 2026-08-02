"""Log vong doi van — de debug SSOT vs web vs auto cuoc."""

from __future__ import annotations

import logging
from typing import Any

from src.models import BetSide, SIDE_LABEL

logger = logging.getLogger(__name__)


def _fmt_stats(stats: dict[str, int] | None) -> str:
    if not stats:
        return "B? P? T?"
    return f"B{stats.get('banker', '?')} P{stats.get('player', '?')} T{stats.get('tie', '?')}"


def _fmt_side(side: BetSide | None) -> str:
    if not side:
        return "?"
    return SIDE_LABEL.get(side, side.value)


def van_mo(
    *,
    table: str = "",
    game_round: int = 0,
    game_shoe: int = 0,
    tool_len: int = 0,
) -> None:
    logger.info(
        "[PHIEN] VAN_MO | ban=%s | round=%s | shoe=%s | tool=%d van",
        table or "?",
        game_round or "?",
        game_shoe or "?",
        tool_len,
    )


def van_ket_thuc(
    *,
    table: str = "",
    game_round: int = 0,
    game_shoe: int = 0,
    tool_len: int = 0,
    source: str = "GP_WINNER",
) -> None:
    logger.info(
        "[PHIEN] VAN_KET_THUC | ban=%s | round=%s | shoe=%s | tool=%d van | nguon=%s",
        table or "?",
        game_round or "?",
        game_shoe or "?",
        tool_len,
        source,
    )


def ket_qua(
    *,
    table: str = "",
    side: BetSide | None = None,
    game_round: int = 0,
    tool_len: int = 0,
    prev_len: int = 0,
    source: str = "",
    stats: dict[str, int] | None = None,
) -> None:
    logger.info(
        "[PHIEN] KET_QUA | ban=%s | %s | round=%s | tool %d->%d van | %s | nguon=%s",
        table or "?",
        _fmt_side(side),
        game_round or "?",
        prev_len,
        tool_len,
        _fmt_stats(stats),
        source or "?",
    )


def ket_qua_bo_qua(
    *,
    reason: str,
    table: str = "",
    source: str = "",
    tool_len: int = 0,
    game_round: int = 0,
    detail: str = "",
) -> None:
    logger.warning(
        "[PHIEN] KET_QUA_BO_QUA | ban=%s | %s | tool=%d van | round=%s | nguon=%s%s",
        table or "?",
        reason,
        tool_len,
        game_round or "?",
        source or "?",
        f" | {detail}" if detail else "",
    )


def ssot_sync(
    *,
    reason: str,
    table: str = "",
    tool_len: int = 0,
    marker_n: int = 0,
    decode_n: int = 0,
    win_total: int = 0,
    http_stats: dict[str, int] | None = None,
    ws_stats: dict[str, int] | None = None,
    applied: bool = False,
    grid_preview: str = "",
) -> None:
    lag = win_total - decode_n if win_total else marker_n - decode_n
    logger.info(
        "[PHIEN] SSOT | ban=%s | %s | tool=%d | marker=%d decode=%d | winCounts=%d (%s) ws=%s | %s%s",
        table or "?",
        reason,
        tool_len,
        marker_n,
        decode_n,
        win_total,
        _fmt_stats(http_stats),
        _fmt_stats(ws_stats),
        "AP_DUNG" if applied else "CHUA_AP_DUNG",
        f" | grid: {grid_preview}" if grid_preview else "",
    )
    if win_total and decode_n < win_total:
        logger.warning(
            "[PHIEN] SSOT_LECH | winCounts %d van nhung decode %d van (lech %d)",
            win_total,
            decode_n,
            win_total - decode_n,
        )
    if marker_n < win_total:
        logger.warning(
            "[PHIEN] SSOT_CHAM | markerRoads %d < winCounts %d — HTTP co the chua cap nhat",
            marker_n,
            win_total,
        )


def cuoc_phase(
    *,
    event: str,
    table: str = "",
    cd: str = "",
    chips: bool | None = None,
    zone: bool | None = None,
    closed: bool | None = None,
    game_round: int = 0,
) -> None:
    extra: list[str] = []
    if cd:
        extra.append(f"cd={cd}")
    if chips is not None:
        extra.append(f"chips={chips}")
    if zone is not None:
        extra.append(f"zone={zone}")
    if closed is not None:
        extra.append(f"closed={closed}")
    if game_round:
        extra.append(f"round={game_round}")
    tail = (" | " + " ".join(extra)) if extra else ""
    logger.info("[PHIEN] %s | ban=%s%s", event, table or "?", tail)


def cuoc_thu(
    *,
    table: str = "",
    side: BetSide | None = None,
    stake: int = 0,
    pattern: str = "",
    tool_len: int = 0,
    game_round: int = 0,
    source: str = "",
) -> None:
    logger.info(
        "[PHIEN] CUOC_THU | ban=%s | %s %s | mau=%s | van #%d | round=%s | nguon=%s",
        table or "?",
        stake,
        _fmt_side(side),
        pattern or "?",
        tool_len,
        game_round or "?",
        source or "?",
    )


def cuoc_bo_qua(
    *,
    reason: str,
    table: str = "",
    source: str = "",
    pattern: str = "",
    tool_len: int = 0,
    detail: str = "",
) -> None:
    logger.info(
        "[PHIEN] CUOC_BO_QUA | ban=%s | %s | nguon=%s | mau=%s | tool=%d van%s",
        table or "?",
        reason,
        source or "?",
        pattern or "-",
        tool_len,
        f" | {detail}" if detail else "",
    )


def cuoc_dat(
    *,
    table: str = "",
    side: BetSide | None = None,
    stake: int = 0,
    pattern: str = "",
    cd: str = "",
) -> None:
    logger.info(
        "[PHIEN] CUOC_DAT | ban=%s | %s %s | mau=%s | cd=%s",
        table or "?",
        stake,
        _fmt_side(side),
        pattern or "?",
        cd or "?",
    )


def phan_tich_mau(
    *,
    table: str = "",
    tool_len: int = 0,
    no_tie_len: int = 0,
    matched: str = "",
    building: str = "",
) -> None:
    if matched:
        logger.info(
            "[PHIEN] MAU_KHOP | ban=%s | tool=%d van (%d bo hoa) | %s",
            table or "?",
            tool_len,
            no_tie_len,
            matched,
        )
    elif building:
        logger.info(
            "[PHIEN] MAU_DANG_HINH | ban=%s | tool=%d van | %s",
            table or "?",
            tool_len,
            building,
        )
    else:
        logger.info(
            "[PHIEN] MAU_CHUA_KHOP | ban=%s | tool=%d van (%d bo hoa)",
            table or "?",
            tool_len,
            no_tie_len,
        )
