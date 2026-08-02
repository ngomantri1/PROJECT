from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from playwright.async_api import BrowserContext, Page

from src.ae_sexy_bead import read_in_room_stats, scrape_in_room_bead_plate
from src.ae_sexy_hook import WS_HOOK_SCRIPT
from src.ae_sexy_http import (
    _merge_entry,
    best_stats,
    fetch_init_table_info,
    format_marker_roads_preview,
    history_for_table_name,
    history_matches_stats,
    history_mismatches_display,
    invalidate_stale_http,
    is_trusted_history,
    log_marker_roads_ssot,
    parse_win_counts,
    reconcile_history_to_stats,
    side_counts,
    SSOT_SOURCE,
    stats_mismatch_severity,
    stats_total,
    try_parse_http_response,
)
from src.round_trace import cuoc_phase, ket_qua, ket_qua_bo_qua, ssot_sync, van_ket_thuc, van_mo
from src.ae_sexy_ws import (
    decode_big_road_item,
    decode_road,
    decode_winner_side,
    extract_full_road_from_message,
    extract_road_info,
    extract_winner_event,
    format_road_info_summary,
    parse_ae_ws_payload,
    table_id_to_name,
    table_name_to_ids,
)
from src.models import BetSide, TableState

logger = logging.getLogger(__name__)

OnHistoryUpdate = Callable[[list[BetSide], str, int], Awaitable[None] | None]
OnRoundWinner = Callable[[int, int], None]  # table_id, game_round
OnShoeChange = Callable[[str], None]
OnBettingOpen = Callable[[Page, str], Awaitable[None] | None]

DISPLAY_HISTORY_SOURCES = frozenset({
    "bead-plate-dom",
    "big-road-dom",
    "js-array",
    "display-sync",
})

# Canvas/grid-shot chi thay ~8-10 o viewport — KHONG dung lam lich su shoe
CANVAS_HISTORY_SOURCES = frozenset({
    "grid-shot",
    "canvas-shot",
})

EVENT_HISTORY_SOURCES = frozenset({
    "gp-winner",
    "road-info-round",
})

BET_TRIGGER_SOURCES = frozenset({
    "gp-winner",
    "road-info-round",
    "marker-roads",
})

_UI_BROKEN_STREAK = 3

# BOOTSTRAP: history rong / vao ban / shoe moi — bead hoac HTTP trusted
# INCREMENT: +1 tu roadInfo / GP_WINNER
# RECONCILE: bead plate doi chieu — bead thang
HistoryIntent = str  # "bootstrap" | "increment" | "reconcile"


def _stats_total(stats: dict[str, int] | None) -> int:
    return stats_total(stats)


class AeSexyCollector:
    """AE SEXY: bead plate = lich su; WS roadInfo = +1 van; HTTP = bootstrap."""

    def __init__(
        self,
        state: TableState,
        table_name: str = "",
        on_history_update: OnHistoryUpdate | None = None,
        on_round_winner: OnRoundWinner | None = None,
        on_shoe_change: OnShoeChange | None = None,
        on_betting_open: OnBettingOpen | None = None,
        on_ui_broken: Callable[[str], None] | None = None,
        on_need_enter_table: Callable[[str], None] | None = None,
        poll_interval: float = 1.5,
    ):
        self.state = state
        self.table_name = table_name
        self.on_history_update = on_history_update
        self.on_round_winner = on_round_winner
        self.on_shoe_change = on_shoe_change
        self.on_betting_open = on_betting_open
        self.on_ui_broken = on_ui_broken
        self.on_need_enter_table = on_need_enter_table
        self.poll_interval = poll_interval
        self._last_need_enter_at: float = 0.0
        self._running = False
        self._task: asyncio.Task | None = None
        self._last_key: tuple = ()
        self._cdp_sessions: list[Any] = []
        self._road_by_table: dict[int, list[tuple[int, BetSide]]] = {}
        self._stats_by_table: dict[int, dict[str, int]] = {}
        self._last_stats_total: dict[int, int] = {}
        self._last_game_round: dict[int, int] = {}
        self._last_game_shoe: dict[int, int] = {}
        self._last_stamp_by_table: dict[int, int] = {}
        self._round_check_tasks: dict[int, asyncio.Task] = {}
        self._lobby_history: dict[str, list[BetSide]] = {}
        self._page: Page | None = None
        self._http_roads: dict[int, dict] = {}
        self._http_handler = None
        self._last_http_fetch: float = 0.0
        self._last_http_logout_relay: bool = False
        self._http_fail_streak: int = 0
        self._http_fail_until: float = 0.0
        self._last_http_fail_log: float = 0.0
        self._last_ssot_poll_at: float = 0.0
        self._ssot_poll_interval: float = 8.0
        self._ssot_catchup_task: asyncio.Task | None = None
        self._last_bet_phase: dict[str, Any] = {}
        self._last_cuoc_mo_logged: bool = False
        self._http_fetch_interval: float = 8.0
        self.poll_error_streak: int = 0
        self._poll_gate: Callable[[], bool] | None = None
        self._game_ws_open: int = 0
        self._ws_disconnected_at: float | None = None
        self._ws_last_frame_at: float = 0.0
        self._last_history_growth_at: float = time.monotonic()
        self._last_remote_stats_total: int = 0
        self._cached_display_stats: dict[str, int] = {}
        self._cached_display_stats_at: float = 0.0
        self._last_gp_winner_at: float = 0.0
        self._last_applied_winner_round: dict[int, int] = {}
        self._pending_winner_round: dict[int, int] = {}
        self._shuffle_by_table: dict[int, int] = {}
        self._in_room: bool = False
        self._table_ready: bool = False
        self._ui_fail_streak: int = 0
        self._ui_broken_notified: bool = False
        self._ws_activity: dict[int, float] = {}
        self._on_table_sync: Callable[[], Awaitable[None] | None] | None = None

    @property
    def in_room(self) -> bool:
        return self._in_room

    @property
    def table_ready(self) -> bool:
        return self._table_ready

    def set_in_room(self, in_room: bool, *, clear_history: bool = False) -> None:
        """in_room = dang trong ban; table_ready = footer/chip OK (cho luu DB)."""
        self._in_room = bool(in_room)
        if clear_history and not in_room:
            self.state.history = []
            self._last_key = ()

    def set_table_sync_hook(
        self, hook: Callable[[], Awaitable[None] | None] | None
    ) -> None:
        """Goi moi chu ky poll khi trong ban — dong bo ban runtime tu DOM."""
        self._on_table_sync = hook

    def dominant_ws_table_id(self) -> int | None:
        """Ban co WS/roadInfo hoat dong gan nhat (ho tro detect khi doi ban)."""
        if not self._ws_activity:
            return None
        return max(self._ws_activity, key=self._ws_activity.get)

    def dominant_ws_table_name(self) -> str:
        tid = self.dominant_ws_table_id()
        return table_id_to_name(tid) if tid else ""

    def set_table_ready(self, ready: bool) -> None:
        self._table_ready = bool(ready)

    def _request_enter_table(self, reason: str = "") -> None:
        """Dang o sanh / chua click — bao main uu tien click vao ban (throttle)."""
        now = time.monotonic()
        if now - self._last_need_enter_at < 8.0:
            return
        self._last_need_enter_at = now
        logger.warning(
            "[PHIEN] CAN_CLICK_BAN | ban=%s | %s — dang o danh sach sanh, chua trong phong",
            self.table_name or "?",
            reason or "chua_vao_ban",
        )
        if self.on_need_enter_table:
            try:
                self.on_need_enter_table(reason or "chua_vao_ban")
            except Exception as exc:
                logger.debug("on_need_enter_table: %s", exc)

    @staticmethod
    def _is_game_ws(url: str) -> bool:
        u = (url or "").lower()
        return "h54uk" in u or "ogre" in u or ("mhuxu" in u and "websocket" in u)

    def _note_ws_open(self, url: str) -> None:
        self._game_ws_open += 1
        self._ws_disconnected_at = None
        logger.info("Game WS ket noi (%d): %s", self._game_ws_open, url[:90])

    def _note_ws_close(self, url: str) -> None:
        self._game_ws_open = max(0, self._game_ws_open - 1)
        if self._game_ws_open == 0:
            self._ws_disconnected_at = time.monotonic()
            logger.warning("Game WS ngat het (%s)", url[:90])

    def _note_ws_frame(self) -> None:
        self._ws_last_frame_at = time.monotonic()
        self._ws_disconnected_at = None

    def is_ws_disconnected(self, grace_sec: float = 20.0) -> bool:
        if self._ws_disconnected_at is None:
            return False
        return (time.monotonic() - self._ws_disconnected_at) >= grace_sec

    def is_ws_stale(self, stale_sec: float = 75.0) -> bool:
        if self._game_ws_open <= 0:
            return False
        if not self._ws_last_frame_at:
            return False
        return (time.monotonic() - self._ws_last_frame_at) >= stale_sec

    def in_round_transition(self, grace_sec: float = 8.0) -> bool:
        """Dang chuyen van (GP_WINNER gan day) — khong recovery vi DOM stats tam = 0."""
        if self._last_gp_winner_at <= 0:
            return False
        return (time.monotonic() - self._last_gp_winner_at) < grace_sec

    def is_remote_stats_stale(self, stale_sec: float = 120.0) -> bool:
        """HTTP stats tang nhung lich su local khong doi — nghi ngo ket noi treo."""
        if self._last_remote_stats_total <= 0:
            return False
        if len(self.state.history) >= self._last_remote_stats_total:
            return False
        return (time.monotonic() - self._last_history_growth_at) >= stale_sec

    def is_feed_healthy(self, table_name: str = "") -> bool:
        """
        Nguon du lieu (HTTP/WS/lich su) van song — bo qua canh bao stream DOM.
        AE SEXY thuong co DOM stats B0P0T0 va video trong iframe khong doc duoc.
        """
        name = (table_name or self.table_name or "").strip()
        hist_len = len(self.state.history)
        if hist_len < 3:
            return False

        stats = self.get_stats(name) if name else {}
        remote = self._last_remote_stats_total
        dom_total = _stats_total(stats) if stats else 0
        ref_total = max(remote, dom_total, hist_len)

        if ref_total < 3:
            return False

        if abs(hist_len - ref_total) <= 5:
            return True

        if self._http_roads and (time.monotonic() - self._last_http_fetch) < 45:
            if (time.monotonic() - self._last_history_growth_at) < 25:
                return True
            if self._ws_last_frame_at and (time.monotonic() - self._ws_last_frame_at) < 45:
                return True

        if (time.monotonic() - self._last_history_growth_at) < 180:
            return True

        if self._game_ws_open > 0 and self._ws_last_frame_at:
            if (time.monotonic() - self._ws_last_frame_at) < 90:
                return True

        return False

    def attach_http(self, page: Page):
        """Bat HTTP queryInitTableInfo / queryInitWebGameHall — lich su day du."""
        if self._http_handler:
            try:
                page.remove_listener("response", self._http_handler)
            except Exception:
                pass

        async def on_response(resp):
            try:
                parsed = await try_parse_http_response(resp.url, await resp.text())
                for tid, entry in parsed.items():
                    prev = self._http_roads.get(tid)
                    merged = _merge_entry(prev, entry) if prev else entry
                    self._http_roads[tid] = merged
                    if merged.get("stats"):
                        self._stats_by_table[tid] = merged["stats"]
                    shoe = int(merged.get("game_shoe") or 0)
                    rnd = int(merged.get("game_round") or 0)
                    if shoe:
                        self._last_game_shoe[tid] = shoe
                    if rnd:
                        self._last_game_round[tid] = rnd
                    cur_len = len(self.state.history)
                    new_len = len(merged.get("history") or [])
                    if (
                        self.table_name
                        and tid in table_name_to_ids(self.table_name)
                        and merged.get("history")
                        and merged.get("stats")
                        and (
                            is_trusted_history(merged["history"], merged["stats"])
                            or (
                                new_len == stats_total(merged["stats"])
                                and stats_mismatch_severity(merged["history"], merged["stats"]) <= 4
                            )
                        )
                        and self._in_room
                        and (cur_len == 0 or new_len > cur_len)
                    ):
                        try:
                            loop = asyncio.get_running_loop()
                            loop.create_task(
                                self._dispatch_history_update(
                                    "bootstrap",
                                    merged["history"],
                                    SSOT_SOURCE if merged.get("has_markers") else str(merged.get("source", "http-live")),
                                    force=True,
                                )
                            )
                        except RuntimeError:
                            pass
            except Exception as exc:
                logger.debug("HTTP road parse: %s", exc)

        self._http_handler = on_response
        page.on("response", on_response)
        self._page = page

    async def install_hook(self, context: BrowserContext):
        await context.add_init_script(WS_HOOK_SCRIPT)

    def attach_to_context(self, context: BrowserContext):
        context.on("page", self._on_page)
        for p in context.pages:
            self._attach_page(p)

    def _on_page(self, page: Page):
        self._attach_page(page)

    def _attach_page(self, page: Page):
        page.on("websocket", self._on_websocket)

    def _on_websocket(self, ws):
        if not self._is_game_ws(ws.url):
            return
        self._note_ws_open(ws.url)

        def on_frame(payload):
            text = payload if isinstance(payload, str) else payload.decode("utf-8", errors="ignore")
            self._note_ws_frame()
            self._handle_ws_text(text)

        def on_close():
            self._note_ws_close(ws.url)

        ws.on("framereceived", on_frame)
        ws.on("close", on_close)

    async def reattach(self, context: BrowserContext, page: Page):
        """Gan lai listener/hook sau khi tab reload."""
        self.stop()
        self.poll_error_streak = 0
        self._game_ws_open = 0
        self._ws_disconnected_at = None
        self._ws_last_frame_at = 0.0
        self._last_history_growth_at = time.monotonic()
        self._page = page
        if hasattr(self, "_cdp_page_ids"):
            self._cdp_page_ids.discard(id(page))
        self.attach_http(page)
        self._attach_page(page)
        await self.inject_hook_frames(page)
        await self.attach_cdp_page(context, page)

    async def attach_cdp_page(self, context: BrowserContext, page: Page):
        pid = id(page)
        if pid in getattr(self, "_cdp_page_ids", set()):
            return
        if not hasattr(self, "_cdp_page_ids"):
            self._cdp_page_ids: set[int] = set()
        try:
            cdp = await context.new_cdp_session(page)
            await cdp.send("Network.enable")

            def on_ws(params: dict):
                payload = params.get("response", {}).get("payloadData", "")
                if payload:
                    self._note_ws_frame()
                    self._handle_ws_text(payload)

            cdp.on("Network.webSocketFrameReceived", on_ws)
            self._cdp_sessions.append(cdp)
            self._cdp_page_ids.add(pid)
        except Exception as exc:
            logger.debug("CDP attach page fail: %s", exc)

    async def attach_cdp(self, context: BrowserContext):
        for page in context.pages:
            await self.attach_cdp_page(context, page)

    async def inject_hook_frames(self, page: Page):
        """Inject hook vao frame game (neu WS da tao truoc init script)."""
        self._page = page
        for frame in page.frames:
            try:
                await frame.evaluate(WS_HOOK_SCRIPT)
            except Exception:
                pass

    def _handle_ws_text(self, text: str):
        for data in parse_ae_ws_payload(text):
            road = extract_road_info(data)
            if road:
                self._ingest_road_info(road)
            full = extract_full_road_from_message(data)
            if full:
                msg = data.get("message") or {}
                full_tid = int(msg.get("tableID") or (road or {}).get("tableID") or 0)
                if full_tid and self._matches_table(full_tid) and len(full) >= 10:
                    self._schedule_round_check(full_tid)
            winner = extract_winner_event(data)
            if winner:
                tid = int(winner.get("tableID") or 0)
                rnd = int(winner.get("gameRound") or 0)
                if tid and self._matches_table(tid):
                    logger.info("GP_WINNER tableID=%s round=%s", tid, rnd)
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(self._handle_gp_winner_event(tid, rnd, winner))
                    except RuntimeError:
                        pass
                elif tid:
                    logger.debug("GP_WINNER tableID=%s round=%s (ban khac)", tid, rnd)

    async def _handle_gp_winner_event(self, tid: int, game_round: int, winner_msg: dict):
        """GP_WINNER — danh dau van ket thuc; ket qua P/B/T o roadInfo ngay sau."""
        self._last_gp_winner_at = time.monotonic()
        game_shoe = int(winner_msg.get("gameShoe") or 0)
        shuffle = int(winner_msg.get("shuffle") or 0)
        if game_shoe:
            self._last_game_shoe[tid] = game_shoe
        self._shuffle_by_table[tid] = shuffle
        if shuffle:
            logger.info("Shuffle dang dien ra table %s — tam dung cuoc", tid)
        if game_round:
            self._pending_winner_round[tid] = game_round
        logger.info(
            "GP_WINNER table=%s round=%s — ket qua se den trong roadInfo",
            tid,
            game_round,
        )
        van_ket_thuc(
            table=self.table_name or str(tid),
            game_round=game_round,
            game_shoe=game_shoe,
            tool_len=len(self.state.history),
        )
        if self._page and self.table_name and self._matches_table(tid):
            if not self._in_room:
                # Sanh van nhan GP_WINNER — KHONG doi markerRoads; can click vao ban
                self._request_enter_table(f"gp-winner-r{game_round}-lobby")
            else:
                await asyncio.sleep(0.8)
                await self._sync_ssot_marker_roads(reason=f"gp-winner-r{game_round}")
        # Mot so ban gui kem winner trong message (hiem)
        side = decode_winner_side(winner_msg)
        if side:
            await self._apply_round_result(tid, game_round, side, "gp-winner")
        if self.on_round_winner:
            try:
                self.on_round_winner(tid, game_round)
            except Exception as exc:
                logger.debug("on_round_winner: %s", exc)

    async def _apply_round_result(
        self,
        tid: int,
        game_round: int,
        side: BetSide,
        source: str,
    ) -> bool:
        if self._matches_table(tid):
            # Chi danh dau trong ban khi UI xac nhan — WS sanh cung gui GP_WINNER
            pass
        prev_len = len(self.state.history)
        if game_round:
            if prev_len >= game_round:
                return False
            if prev_len < game_round - 1:
                if self._page and self.table_name:
                    await self.try_catch_up_rounds(self._page)
                    prev_len = len(self.state.history)
                if prev_len >= game_round:
                    return False
                if prev_len < game_round - 1:
                    return False
            if self._last_applied_winner_round.get(tid) == game_round:
                return False
        trial = list(self.state.history) + [side]
        self._last_gp_winner_at = time.monotonic()
        if game_round:
            self._last_applied_winner_round[tid] = game_round
            self._last_game_round[tid] = game_round
            self._pending_winner_round.pop(tid, None)
        if await self._dispatch_history_update("increment", trial, source, force=True):
            from src.models import SIDE_LABEL

            ket_qua(
                table=self.table_name or str(tid),
                side=side,
                game_round=game_round,
                tool_len=len(trial),
                prev_len=prev_len,
                source=source,
                stats=self.get_stats(self.table_name) if self.table_name else None,
            )
            logger.info(
                "%s: +%s (round %s) — tong %d van",
                source,
                SIDE_LABEL.get(side, side.value),
                game_round or "?",
                len(trial),
            )
            self._schedule_display_reconcile(tid)
            return True
        if self._page and self.table_name:
            await self.try_catch_up_rounds(self._page)
        return False

    async def _apply_road_info_increment(self, tid: int, road: dict, stats: dict[str, int]) -> bool:
        """Ap dung +1 van tu roadInfo.bigRoads — CHI khi da trong ban."""
        if not self._in_room:
            self._request_enter_table(
                f"roadInfo-r{int(road.get('gameRound') or 0)}-lobby"
            )
            return False
        # Khong set _in_room tu WS — sanh AE SEXY cung nhan roadInfo moi ban
        big = road.get("bigRoads") or []
        if not big:
            logger.info("roadInfo round=%s — bigRoads rong, bo qua", road.get("gameRound", "?"))
            return False
        item = big[0] if len(big) == 1 else max(big, key=lambda x: int(x.get("stampTime") or 0))
        side = decode_big_road_item(item) or decode_road(int(item.get("road", -1)))
        if not side:
            logger.warning(
                "roadInfo round=%s — khong decode duoc road=%s count=%s",
                road.get("gameRound", "?"),
                item.get("road"),
                item.get("count"),
            )
            return False

        game_round = int(road.get("gameRound") or 0)
        cur_len = len(self.state.history)
        stamp = int(item.get("stampTime") or 0)

        if game_round:
            if cur_len >= game_round:
                ket_qua_bo_qua(
                    reason="tool da co du van (roadInfo muon)",
                    table=self.table_name or str(tid),
                    source="road-info-round",
                    tool_len=cur_len,
                    game_round=game_round,
                    detail=f"winCounts={_stats_total(stats) if stats else '?'}",
                )
                logger.debug(
                    "roadInfo round=%s — tool da co %d van, bo qua",
                    game_round,
                    cur_len,
                )
                return False
            if cur_len < game_round - 1:
                logger.info(
                    "roadInfo round=%s nhung tool %d van — thu HTTP/WS bootstrap",
                    game_round,
                    cur_len,
                )
                if self._page and self.table_name:
                    await self.fetch_http_history(self._page, self.table_name)
                    http_hist, http_src, _ = self._get_trusted_http_history(self.table_name)
                    if http_hist and len(http_hist) >= game_round:
                        if await self._dispatch_history_update(
                            "bootstrap", http_hist, http_src or "http-init-table", force=True
                        ):
                            return True
                merged = self._append_ws_rounds(tid, stats)
                if merged and await self._dispatch_history_update("bootstrap", merged, "ws-bootstrap", force=True):
                    return True
                self._schedule_round_check(tid)
                return False
            return await self._apply_round_result(tid, game_round, side, "road-info-round")

        if stamp and stamp <= self._last_stamp_by_table.get(tid, 0):
            return False
        if stamp:
            self._last_stamp_by_table[tid] = stamp
        trial = list(self.state.history) + [side]
        return await self._dispatch_history_update("increment", trial, "road-info-round", force=True)

    async def apply_gp_winner(self, tid: int, game_round: int, winner_msg: dict) -> bool:
        """Legacy — GP_WINNER khong co ket qua; dung roadInfo."""
        side = decode_winner_side(winner_msg)
        if not side:
            return False
        return await self._apply_round_result(tid, game_round, side, "gp-winner")

    def _schedule_display_reconcile(self, tid: int):
        """Doi chieu bead/footer sau GP_WINNER — khong thay the cap nhat ngay."""
        self._schedule_round_check(tid)

    def _schedule_round_check(self, tid: int):
        if not self._matches_table(tid):
            return
        existing = self._round_check_tasks.get(tid)
        if existing and not existing.done():
            return
        try:
            loop = asyncio.get_running_loop()
            self._round_check_tasks[tid] = loop.create_task(self._delayed_round_check(tid))
        except RuntimeError:
            pass

    async def _delayed_round_check(self, tid: int):
        """Sau GP_WINNER — doi chieu man hinh (retry), khong la nguon cap nhat chinh."""
        if not self._page or not self.table_name:
            return
        if self.in_round_transition(12.0):
            await asyncio.sleep(2.0)
        cur_len = len(self.state.history)
        waits = (1.2, 1.0, 1.0, 1.0, 1.0)
        for i, delay in enumerate(waits):
            await asyncio.sleep(delay)
            if len(self.state.history) > cur_len:
                return
            if await self.sync_history_from_display(
                self._page,
                light_dom=(i == 0),
                retries=1,
            ):
                cur = len(self.state.history)
                dom = await self._read_dom_stats(self._page)
                if dom and stats_total(dom) == cur:
                    logger.debug("Display doi chieu OK — %d van", cur)
                return
        await self.check_round_update(self._page)

    def _ingest_road_info(self, road: dict):
        tid = road.get("tableID")
        if tid is None:
            return
        tid = int(tid)
        self._ws_activity[tid] = time.monotonic()
        if self.table_name and tid not in table_name_to_ids(self.table_name):
            return
        new_shoe = int(road.get("gameShoe") or 0)
        cached = self._http_roads.get(tid)
        if cached and new_shoe and cached.get("game_shoe") and new_shoe != cached.get("game_shoe"):
            self._road_by_table[tid] = []
            self._last_stamp_by_table[tid] = 0
            self._last_stats_total[tid] = 0
            self._shuffle_by_table[tid] = 0
            self._last_game_shoe[tid] = new_shoe
            if self.table_name and tid in table_name_to_ids(self.table_name):
                self.state.history = []
                self._last_key = ()
                self._notify_shoe_change(self.table_name)
            logger.info("Shoe moi table %s: %s -> %s", tid, cached.get("game_shoe"), new_shoe)

        counts = road.get("winCounts") or []
        stats = parse_win_counts(counts) if len(counts) >= 3 else {}
        if stats:
            self._stats_by_table[tid] = stats
        if new_shoe:
            self._last_game_shoe[tid] = new_shoe
        entries = self._road_by_table.setdefault(tid, [])
        seen = {t for t, _ in entries}
        for br in road.get("bigRoads") or []:
            stamp = int(br.get("stampTime") or 0)
            if stamp in seen:
                continue
            side = decode_road(int(br.get("road", -1)))
            if side:
                entries.append((stamp, side))
                seen.add(stamp)
        entries.sort(key=lambda x: x[0])
        if stats:
            total = _stats_total(stats)
            prev_total = self._last_stats_total.get(tid, 0)
            if total > prev_total:
                self._last_stats_total[tid] = total
            game_round = int(road.get("gameRound") or 0)
            if game_round and self._in_room:
                prev_round = self._last_game_round.get(tid, 0)
                if game_round > prev_round and self.table_name and tid in table_name_to_ids(self.table_name):
                    van_mo(
                        table=self.table_name,
                        game_round=game_round,
                        game_shoe=new_shoe or self._last_game_shoe.get(tid, 0),
                        tool_len=len(self.state.history),
                    )
                self._last_game_round[tid] = game_round
            elif game_round:
                self._last_game_round[tid] = game_round

        if self.table_name and tid in table_name_to_ids(self.table_name):
            if not self._in_room:
                # Sanh: chi bao click — KHONG van_mo / bootstrap / apply history
                self._request_enter_table(
                    f"roadInfo-r{int(road.get('gameRound') or 0)}-lobby"
                )
                return
            logger.info(
                "%s",
                format_road_info_summary(road, tool_len=len(self.state.history)),
            )
            total = _stats_total(stats) if stats else 0
            cur_len = len(self.state.history)
            if total > cur_len and self._page:
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(
                        self._sync_ssot_marker_roads(
                            reason=f"ws-winCounts-{total}>{cur_len}"
                        )
                    )
                except RuntimeError:
                    pass
            elif _stats_total(stats) > len(self.state.history):
                self._schedule_round_check(tid)
            if stats:
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self._apply_road_info_increment(tid, road, stats))
                except RuntimeError:
                    pass

    async def _sync_ssot_marker_roads(self, page: Page | None = None, *, reason: str = "") -> bool:
        """
        SSOT duy nhat: HTTP queryInitTableInfo -> roadInfo.markerRoads[].
        CHI khi da CLICK vao ban. Sanh chi thay the ban — WS GP_WINNER van ve
        nhung markerRoads day du chi co trong phong.
        """
        page = page or self._page
        if not page or not self.table_name:
            return False
        if not self._in_room:
            self._request_enter_table(reason or "ssot-chua-vao-ban")
            return False
        prev_len = len(self.state.history)
        ws_stats = self.get_stats(self.table_name)

        async def _load_ssot() -> tuple[list[BetSide], str, dict[str, int], list[dict]]:
            await self.fetch_http_history(page, self.table_name)
            hist, src, http_stats = self._resolve_http_history(self.table_name)
            if not src:
                hist, src, http_stats = self._pick_marker_http(self.table_name)
            markers: list[dict] = []
            for tid in table_name_to_ids(self.table_name):
                entry = self._http_roads.get(tid) or {}
                if entry.get("raw_markers"):
                    markers = list(entry["raw_markers"])
                    break
            return hist, src or "", dict(http_stats or {}), markers

        hist, src, http_stats, markers = await _load_ssot()
        win_total = stats_total(http_stats) or stats_total(ws_stats)
        grid_preview = format_marker_roads_preview(markers) if markers else ""

        if not src:
            ssot_sync(
                reason=reason or "poll",
                table=self.table_name,
                tool_len=prev_len,
                marker_n=0,
                decode_n=0,
                win_total=win_total,
                http_stats=http_stats,
                ws_stats=ws_stats,
                applied=False,
            )
            logger.warning(
                "[SSOT] Khong co markerRoads cho %s (%s) — tool %d van",
                self.table_name,
                reason or "poll",
                prev_len,
            )
            return False

        if len(hist) <= prev_len and win_total > prev_len:
            for delay in (0.6, 1.0, 1.5):
                await asyncio.sleep(delay)
                hist, src, http_stats, markers = await _load_ssot()
                win_total = stats_total(http_stats) or stats_total(ws_stats)
                grid_preview = format_marker_roads_preview(markers) if markers else ""
                if len(hist) > prev_len:
                    break

        ssot_sync(
            reason=reason or "poll",
            table=self.table_name,
            tool_len=prev_len,
            marker_n=len(markers) if markers else len(hist),
            decode_n=len(hist),
            win_total=win_total,
            http_stats=http_stats,
            ws_stats=ws_stats,
            applied=False,
            grid_preview=grid_preview,
        )

        if len(hist) <= prev_len:
            dom_stats = await self._read_dom_stats(page) if page else {}
            if dom_stats and is_trusted_history(self.state.history, dom_stats):
                logger.debug(
                    "[SSOT] HTTP %d van — tool %d van khop footer B=%s P=%s T=%s (%s)",
                    len(hist),
                    prev_len,
                    dom_stats.get("banker"),
                    dom_stats.get("player"),
                    dom_stats.get("tie"),
                    reason or "poll",
                )
                return False
            if win_total > prev_len:
                ket_qua_bo_qua(
                    reason="SSOT chua co van moi (HTTP cham)",
                    table=self.table_name,
                    source=SSOT_SOURCE,
                    tool_len=prev_len,
                    detail=f"marker={len(hist)} winCounts={win_total}",
                )
            return False

        ok = await self._dispatch_history_update("bootstrap", hist, SSOT_SOURCE, force=True)
        if not ok and len(hist) > prev_len and http_stats and is_trusted_history(hist, http_stats):
            logger.info(
                "[SSOT] Dispatch that bai — ap dung truc tiep %d van (+%d)",
                len(hist),
                len(hist) - prev_len,
            )
            ok = await self._apply_history(hist, SSOT_SOURCE, force=True)
        if ok:
            ssot_sync(
                reason=reason or "poll",
                table=self.table_name,
                tool_len=prev_len,
                marker_n=len(markers) if markers else len(hist),
                decode_n=len(hist),
                win_total=win_total,
                http_stats=http_stats,
                ws_stats=ws_stats,
                applied=True,
                grid_preview=grid_preview,
            )
            if http_stats:
                self._sync_stats_from_history(self.table_name, hist, ref_stats=http_stats)
        else:
            counts = side_counts(hist)
            ket_qua_bo_qua(
                reason="dispatch marker-roads that bai",
                table=self.table_name,
                source=SSOT_SOURCE,
                tool_len=prev_len,
                detail=f"hist={len(hist)} B={counts.get('banker')} P={counts.get('player')} T={counts.get('tie')}",
            )
            logger.warning(
                "[SSOT] markerRoads %d van (B=%s P=%s T=%s) khong ap dung — tool %d van (%s)",
                len(hist),
                counts.get("banker"),
                counts.get("player"),
                counts.get("tie"),
                prev_len,
                reason,
            )
        return ok

    def _append_ws_rounds(
        self,
        tid: int,
        stats: dict[str, int] | None,
        base: list[BetSide] | None = None,
    ) -> list[BetSide] | None:
        """Ghep van moi tu bigRoad WS vao lich su hien tai."""
        if not stats:
            return None
        entries = self._road_by_table.get(tid, [])
        if not entries:
            return None
        expected = _stats_total(stats)
        cur_len = len(base) if base is not None else len(self.state.history)
        if expected <= cur_len:
            return None

        hist = list(base) if base is not None else list(self.state.history)
        last_stamp = self._last_stamp_by_table.get(tid, 0)
        delta = expected - cur_len

        if cur_len == 0 and entries:
            full = [s for _, s in sorted(entries, key=lambda x: x[0])]
            if full and history_matches_stats(full, stats, max_count_err=0):
                self._last_stamp_by_table[tid] = max(t for t, _ in entries)
                return full

        if delta == 1:
            stamp, side = max(entries, key=lambda x: x[0])
            if cur_len == 0 or stamp > last_stamp:
                trial = hist + [side]
                if history_matches_stats(trial, stats, max_count_err=0):
                    self._last_stamp_by_table[tid] = stamp
                    return trial
            return None

        for stamp, side in sorted(entries, key=lambda x: x[0]):
            if stamp <= last_stamp:
                continue
            trial = hist + [side]
            if len(trial) > expected:
                continue
            if history_matches_stats(trial, stats, max_count_err=0):
                hist = trial
                last_stamp = stamp
                self._last_stamp_by_table[tid] = stamp

        if len(hist) > cur_len and history_matches_stats(hist, stats, max_count_err=0):
            return hist
        return None

    def _matches_table(self, tid: int) -> bool:
        if not self.table_name:
            return False
        return tid in table_name_to_ids(self.table_name)

    def _notify_shoe_change(self, table_name: str) -> None:
        if not self.on_shoe_change or not table_name:
            return
        try:
            self.on_shoe_change(table_name)
        except Exception as exc:
            logger.debug("on_shoe_change: %s", exc)

    def set_lobby_history(
        self,
        table_name: str,
        history: list[BetSide],
        stats: dict[str, int] | None = None,
    ):
        if history:
            self._lobby_history[table_name] = list(history)
        if stats and stats_total(stats) >= 1:
            for tid in table_name_to_ids(table_name):
                self._stats_by_table[tid] = {
                    "banker": int(stats.get("banker", 0)),
                    "player": int(stats.get("player", 0)),
                    "tie": int(stats.get("tie", 0)),
                }
                self._last_stats_total[tid] = stats_total(stats)

    def reset_for_table(self, table_name: str):
        """Reset khi chuyen sang ban khac hoac sau recovery."""
        self.table_name = table_name
        self._last_key = ()
        self._last_stats_total = {}
        self._last_game_round = {}
        self._last_game_shoe = {}
        self._last_stamp_by_table = {}
        self.state.history = []
        self._last_remote_stats_total = 0
        self._cached_display_stats = {}
        self._cached_display_stats_at = 0.0
        self._last_gp_winner_at = 0.0
        self._last_applied_winner_round = {}
        self._pending_winner_round = {}
        for tid in table_name_to_ids(table_name):
            self._shuffle_by_table.pop(tid, None)
            self._http_roads.pop(tid, None)
            self._stats_by_table.pop(tid, None)
            self._road_by_table.pop(tid, None)
        self._purge_other_tables(table_name)

    def _sync_stats_from_history(
        self,
        table_name: str,
        history: list[BetSide],
        ref_stats: dict[str, int] | None = None,
    ) -> None:
        """Dong bo winCounts — uu tien stats HTTP/footer neu khop tong van."""
        if not history or not table_name:
            return
        counts = side_counts(history)
        if ref_stats and stats_total(ref_stats) == len(history):
            if history_matches_stats(history, ref_stats, max_count_err=0):
                counts = {
                    "banker": int(ref_stats.get("banker", 0)),
                    "player": int(ref_stats.get("player", 0)),
                    "tie": int(ref_stats.get("tie", 0)),
                }
        for tid in table_name_to_ids(table_name):
            self._stats_by_table[tid] = dict(counts)
            self._last_stats_total[tid] = len(history)
        self._last_remote_stats_total = len(history)

    async def _read_dom_stats(self, page: Page | None) -> dict[str, int]:
        if not page:
            return dict(self._cached_display_stats) if self._cached_display_stats else {}
        from src.ae_sexy_bead import read_in_room_stats, read_room_stats_raw

        dom = await read_in_room_stats(page) or {}
        if stats_total(dom) < 1:
            raw = await read_room_stats_raw(page) or {}
            if stats_total(raw) >= 1:
                dom = raw

        if stats_total(dom) >= 1:
            self._cached_display_stats = dict(dom)
            self._cached_display_stats_at = time.monotonic()
            return dom

        if self._cached_display_stats and time.monotonic() - self._cached_display_stats_at < 30:
            return dict(self._cached_display_stats)
        return {}

    async def sync_history_from_display(
        self,
        page: Page,
        table_name: str | None = None,
        *,
        light_dom: bool = False,
        retries: int = 2,
    ) -> bool:
        """Dong bo lich su qua HTTP markerRoads — KHONG dung bead (viewport sai)."""
        table_name = table_name or self.table_name
        if not table_name:
            return False

        for attempt in range(max(1, retries)):
            if attempt:
                await asyncio.sleep(0.8)
            dom_stats = await self._read_dom_stats(page)
            footer_total = stats_total(dom_stats) if dom_stats else 0
            cur_len = len(self.state.history)

            if cur_len and footer_total and footer_total <= cur_len:
                return False

            await self.fetch_http_history(page, table_name)
            http_hist, http_src, http_stats = self._resolve_http_history(table_name)
            if not http_hist:
                continue

            if footer_total >= 3 and len(http_hist) < footer_total:
                logger.debug(
                    "HTTP %d van < footer %d van — cho fetch lai",
                    len(http_hist),
                    footer_total,
                )
                continue

            if await self._dispatch_history_update(
                "bootstrap",
                http_hist,
                http_src or SSOT_SOURCE,
                force=True,
            ):
                if http_stats:
                    self._merge_table_stats(table_name, http_stats)
                    self._sync_stats_from_history(table_name, http_hist, ref_stats=http_stats)
                elif dom_stats:
                    self._merge_table_stats(table_name, dom_stats, from_display=True)
                logger.info(
                    "Dong bo HTTP: %d van (footer %d van)",
                    len(http_hist),
                    footer_total or len(http_hist),
                )
                return True

        dom_stats = await self._read_dom_stats(page)
        if dom_stats and history_mismatches_display(self.state.history, dom_stats):
            logger.warning(
                "Lich su tool %d van lech footer %d van (B=%s P=%s T=%s)",
                len(self.state.history),
                stats_total(dom_stats),
                dom_stats.get("banker"),
                dom_stats.get("player"),
                dom_stats.get("tie"),
            )
        return False

    def _is_incremental_source(self, source: str) -> bool:
        return source in EVENT_HISTORY_SOURCES

    def _score_history_option(
        self,
        hist: list[BetSide],
        src: str,
        ref: dict[str, int],
        http_stats: dict[str, int] | None,
    ) -> int:
        ln = len(hist)
        stats = ref or http_stats
        if stats and is_trusted_history(hist, stats):
            return 50000 + ln
        if ref and is_trusted_history(hist, ref):
            return 40000 + ln
        if http_stats and is_trusted_history(hist, http_stats):
            return 30000 + ln
        err = stats_mismatch_severity(hist, stats) if stats else 99
        return ln * 10 - err * 100

    def _pick_room_history(
        self,
        *,
        bead: list[BetSide] | None,
        bead_src: str,
        http_hist: list[BetSide],
        http_src: str,
        http_stats: dict[str, int] | None,
        dom_stats: dict[str, int] | None,
    ) -> tuple[list[BetSide], str] | None:
        """Chi tra HTTP — bead viewport bi bo qua."""
        if http_hist:
            return list(http_hist), http_src or "http-init-table"
        return None

    async def _try_apply_bead(
        self,
        page: Page,
        table_name: str,
        bead: list[BetSide] | None,
        bead_src: str,
        *,
        dom_stats: dict[str, int] | None = None,
        http_stats: dict[str, int] | None = None,
    ) -> list[BetSide] | None:
        """Bead viewport — KHONG dung lam lich su (chi thay ~20 o)."""
        return None

    def _purge_other_tables(self, table_name: str):
        """Xoa du lieu ban khac — tranh nham phong."""
        active = set(table_name_to_ids(table_name))
        for store in (
            self._http_roads,
            self._stats_by_table,
            self._road_by_table,
            self._last_stats_total,
            self._last_game_round,
            self._last_stamp_by_table,
            self._ws_activity,
        ):
            for tid in list(store.keys()):
                if tid not in active:
                    del store[tid]

    def _round_ids_for_table(self, table_name: str) -> tuple[int | None, int | None]:
        shoe: int | None = None
        last_round: int | None = None
        for tid in table_name_to_ids(table_name):
            if tid in self._last_game_shoe:
                shoe = int(self._last_game_shoe[tid])
            if tid in self._last_game_round:
                last_round = int(self._last_game_round[tid])
            entry = self._http_roads.get(tid)
            if entry:
                if not shoe and entry.get("game_shoe"):
                    shoe = int(entry["game_shoe"])
                if not last_round and entry.get("game_round"):
                    last_round = int(entry["game_round"])
        return shoe, last_round

    def _game_round_for_bead(self, bead_index: int, hist_len: int, anchor_round: int | None) -> int | None:
        if anchor_round is None or hist_len < 1 or bead_index < 0 or bead_index >= hist_len:
            return None
        return anchor_round - (hist_len - 1 - bead_index)

    def get_round_meta(self, table_name: str, bead_index: int) -> dict[str, int]:
        """Meta phien tu WS/HTTP — map ket qua (bead_index) voi gameShoe/gameRound."""
        meta: dict[str, int] = {"bead_index": bead_index}
        hist_len = len(self.state.history)
        shoe, last_round = self._round_ids_for_table(table_name)
        if shoe:
            meta["game_shoe"] = shoe
        if last_round and hist_len:
            gr = self._game_round_for_bead(bead_index, hist_len, last_round)
            if gr and gr > 0:
                meta["game_round"] = gr
        return meta

    def get_bet_round_meta(self, table_name: str, bead_index: int) -> dict[str, int]:
        """Meta van sap dat cuoc — gameRound = van ket tiep theo trong shoe."""
        meta: dict[str, int] = {"bead_index": bead_index}
        shoe, last_round = self._round_ids_for_table(table_name)
        if shoe:
            meta["game_shoe"] = shoe
        hist_len = len(self.state.history)
        if last_round is not None and bead_index == hist_len:
            meta["game_round"] = last_round + 1
        elif last_round is not None and hist_len:
            gr = self._game_round_for_bead(bead_index, hist_len, last_round)
            if gr and gr > 0:
                meta["game_round"] = gr + 1
        elif shoe:
            meta["game_round"] = bead_index + 1
        return meta

    def is_shuffle_active(self, table_name: str = "") -> bool:
        """True khi ban dang xao bai — khong dat cuoc."""
        name = table_name or self.table_name
        if not name:
            return False
        for tid in table_name_to_ids(name):
            if self._shuffle_by_table.get(tid):
                return True
        return False

    def get_stats(self, table_name: str) -> dict[str, int]:
        for tid in table_name_to_ids(table_name):
            if tid in self._stats_by_table:
                return self._stats_by_table[tid]
        return {}

    def _merge_table_stats(self, table_name: str, new_stats: dict[str, int] | None, *, from_display: bool = False):
        """Cap nhat stats — man hinh ban luon uu tien, HTTP/WS khong duoc vuot hon."""
        if not new_stats or not table_name:
            return
        new_total = _stats_total(new_stats)
        for tid in table_name_to_ids(table_name):
            prev = self._stats_by_table.get(tid)
            if from_display or not prev:
                self._stats_by_table[tid] = dict(new_stats)
                continue
            prev_total = _stats_total(prev)
            if new_total <= prev_total:
                self._stats_by_table[tid] = dict(new_stats)

    async def _apply_http_if_display_match(
        self,
        page: Page,
        http_hist: list[BetSide],
        source: str,
    ) -> bool:
        """Chi ap HTTP khi khop tuyet doi B/P/T/Total tren man hinh ban."""
        if not http_hist:
            return False
        dom_stats = await self._read_dom_stats(page)
        if not dom_stats or stats_total(dom_stats) < 1:
            logger.debug("Bo qua %s — chua doc duoc stats man hinh", source)
            return False
        self._merge_table_stats(self.table_name or "", dom_stats, from_display=True)
        if not is_trusted_history(http_hist, dom_stats):
            counts = side_counts(http_hist)
            logger.warning(
                "Bo qua %s — %d van (B=%s P=%s T=%s) khong khop man hinh %d van (B=%s P=%s T=%s)",
                source,
                len(http_hist),
                counts.get("banker"),
                counts.get("player"),
                counts.get("tie"),
                stats_total(dom_stats),
                dom_stats.get("banker"),
                dom_stats.get("player"),
                dom_stats.get("tie"),
            )
            return False
        return await self._dispatch_history_update("bootstrap", http_hist, source)

    async def _try_apply_growth(
        self,
        history: list[BetSide],
        source: str,
        ref_stats: dict[str, int],
        page: Page,
    ) -> bool:
        """Ap dung khi lich su dai hon hien tai (van moi)."""
        if not history or len(history) <= len(self.state.history):
            return False
        prepared = await self._prepare_history(history, self.table_name, page)
        if not await self._validate_history(prepared, self.table_name, page, source=source):
            return False
        if history_matches_stats(prepared, ref_stats, max_count_err=0):
            return await self._dispatch_history_update("reconcile", prepared, source)
        return False

    def _expected_rounds(self, table_name: str) -> int:
        stats = self.get_stats(table_name)
        if stats:
            return stats.get("banker", 0) + stats.get("player", 0) + stats.get("tie", 0)
        return 0

    async def _validate_history(
        self,
        history: list[BetSide],
        table_name: str,
        page: Page | None,
        *,
        source: str = "",
    ) -> bool:
        if not history:
            return False
        dom_stats = await self._read_dom_stats(page)
        if dom_stats:
            self._merge_table_stats(table_name, dom_stats, from_display=True)

        ws_stats = self.get_stats(table_name)
        ref = best_stats(dom_stats, ws_stats)
        if ref:
            return is_trusted_history(history, ref)
        if ws_stats:
            return is_trusted_history(history, ws_stats)
        return len(history) >= 3

    async def _prepare_history(self, history: list[BetSide], table_name: str, page: Page | None) -> list[BetSide]:
        dom_stats = await self._read_dom_stats(page) if page else {}
        if dom_stats:
            self._merge_table_stats(table_name, dom_stats, from_display=True)
        stats = best_stats(dom_stats, self.get_stats(table_name))
        if stats and is_trusted_history(history, stats):
            return list(history)
        if stats:
            aligned = reconcile_history_to_stats(history, stats, max_count_err=0)
            if is_trusted_history(aligned, stats):
                return aligned
        return list(history)

    async def _extend_with_ws(self, history: list[BetSide], table_name: str, stats: dict[str, int]) -> list[BetSide]:
        """Bo sung van moi tu WS len lich su markerRoads HTTP."""
        if not history or not stats:
            return history
        expected = _stats_total(stats)
        if len(history) >= expected:
            return history
        for tid in table_name_to_ids(table_name):
            extended = self._append_ws_rounds(tid, stats, base=history)
            if extended and len(extended) > len(history):
                return extended
        return history

    async def _dispatch_history_update(
        self,
        intent: HistoryIntent,
        history: list[BetSide],
        source: str,
        *,
        force: bool = False,
    ) -> bool:
        """Mot cua vao cap nhat lich su — phan loai theo intent."""
        if not history:
            return False
        if not self._in_room:
            logger.debug("Bo qua cap nhat lich su (%s) — chua vao ban", source)
            return False
        prev_len = len(self.state.history)

        if intent == "increment":
            if prev_len and len(history) != prev_len + 1:
                logger.debug(
                    "Bo qua increment %s — %d van (can +1 tu %d)",
                    source,
                    len(history),
                    prev_len,
                )
                return False
            force = True
        elif intent == "reconcile":
            if (
                source not in DISPLAY_HISTORY_SOURCES
                and not source.startswith("bead")
                and not source.startswith("http")
            ):
                logger.info("Bo qua reconcile — nguon %s khong hop le", source)
                return False
            if prev_len and len(history) < prev_len:
                logger.debug(
                    "Bo qua reconcile %s — %d van < %d van hien tai (bead DOM cham)",
                    source,
                    len(history),
                    prev_len,
                )
                return False
            force = True
        elif intent == "bootstrap":
            if prev_len and len(history) <= prev_len:
                return False
            if source in CANVAS_HISTORY_SOURCES:
                dom_stats = None
                if self._page:
                    dom_stats = await self._read_dom_stats(self._page)
                if not dom_stats or not is_trusted_history(history, dom_stats):
                    logger.debug(
                        "Bo qua bootstrap %s %d van — canvas viewport, footer khong xac nhan",
                        source,
                        len(history),
                    )
                    return False
            # Cho HTTP ghi de bead partial khi force (bootstrap day du hon viewport)
            if source.startswith("http") and prev_len and not force:
                return False
            if source.startswith("http") and prev_len:
                force = True
            if source in DISPLAY_HISTORY_SOURCES or source.startswith("bead"):
                force = True

        return await self._apply_history(history, source, force=force)

    async def _apply_history(self, history: list[BetSide], source: str, *, force: bool = False) -> bool:
        if not history:
            return False
        from_display = source in DISPLAY_HISTORY_SOURCES
        if from_display and self.table_name and self._page:
            history = await self._prepare_history(history, self.table_name, self._page)
        prev_len = len(self.state.history)
        incremental = self._is_incremental_source(source)
        if not force and self.table_name and self._page:
            dom_stats = await self._read_dom_stats(self._page)
            if dom_stats:
                self._merge_table_stats(self.table_name, dom_stats, from_display=True)
            ws_stats = self.get_stats(self.table_name)
            http_stats = None
            for tid in table_name_to_ids(self.table_name):
                entry = self._http_roads.get(tid) or {}
                if entry.get("stats"):
                    http_stats = dict(entry["stats"])
                    break
            ref_stats = best_stats(http_stats, ws_stats, dom_stats)
            dom_total = stats_total(dom_stats) if dom_stats else 0
            if (
                dom_stats
                and dom_total >= 1
                and not from_display
                and source in (SSOT_SOURCE, "marker-roads")
                and len(history) > dom_total + 2
                and http_stats
                and is_trusted_history(history, http_stats)
            ):
                ref_stats = http_stats
            elif dom_stats and dom_total >= 1 and not from_display:
                if len(history) != stats_total(dom_stats):
                    logger.warning(
                        "Bo qua %s — %d van nhung man hinh chi co %d van",
                        source,
                        len(history),
                        stats_total(dom_stats),
                    )
                    return False
                if not is_trusted_history(history, dom_stats):
                    counts = side_counts(history)
                    logger.warning(
                        "Bo qua %s — B=%s P=%s T=%s khong khop man hinh B=%s P=%s T=%s",
                        source,
                        counts.get("banker"),
                        counts.get("player"),
                        counts.get("tie"),
                        dom_stats.get("banker"),
                        dom_stats.get("player"),
                        dom_stats.get("tie"),
                    )
                    return False

            if incremental:
                if len(history) > prev_len + 1:
                    logger.warning(
                        "Bo qua %s — tang %d van (chi chap nhan +1)",
                        source,
                        len(history) - prev_len,
                    )
                    return False
                if ref_stats and len(history) > prev_len:
                    ref_total = stats_total(ref_stats)
                    if ref_total > 0 and len(history) > ref_total:
                        logger.warning(
                            "Bo qua %s — van %d > winCounts %d (nguon chua cap nhat)",
                            source,
                            len(history),
                            ref_total,
                        )
                        return False
                if ref_stats and len(history) > prev_len and not is_trusted_history(history, ref_stats):
                    logger.warning(
                        "Bo qua %s — van moi khong khop stats B=%s P=%s T=%s",
                        source,
                        ref_stats.get("banker"),
                        ref_stats.get("player"),
                        ref_stats.get("tie"),
                    )
                    return False
            else:
                trust_ref = ref_stats or ws_stats
                if trust_ref and not is_trusted_history(history, trust_ref):
                    counts = side_counts(history)
                    logger.warning(
                        "Bo qua lich su %s — khong tin cay (%d van B=%s P=%s T=%s vs B=%s P=%s T=%s)",
                        source,
                        len(history),
                        counts.get("banker"),
                        counts.get("player"),
                        counts.get("tie"),
                        trust_ref.get("banker", "?"),
                        trust_ref.get("player", "?"),
                        trust_ref.get("tie", "?"),
                    )
                    return False
                if (
                    prev_len
                    and len(history) == prev_len
                    and history != self.state.history
                    and ref_stats
                    and is_trusted_history(self.state.history, ref_stats)
                ):
                    logger.debug("Giu lich su hien tai — bulk %s khong khop chuoi dang co", source)
                    return False

            if not await self._validate_history(
                history, self.table_name, self._page, source=source
            ):
                stats = ref_stats or ws_stats
                logger.warning(
                    "Bo qua lich su %s (%d van) — khong khop stats ban %s (B=%s P=%s T=%s)",
                    source,
                    len(history),
                    self.table_name,
                    stats.get("banker", "?") if stats else "?",
                    stats.get("player", "?") if stats else "?",
                    stats.get("tie", "?") if stats else "?",
                )
                return False
        # Khong ghi de lich su day du bang it van hon
        expected = self._expected_rounds(self.table_name)
        if expected and len(history) < expected * 0.5 and len(self.state.history) >= len(history):
            return False
        if prev_len and len(history) < prev_len:
            logger.debug(
                "Bo qua %s — khong ghi de nguoc %d -> %d van",
                source,
                prev_len,
                len(history),
            )
            return False
        if len(self.state.history) > len(history) + 3 and expected and len(self.state.history) >= expected * 0.7:
            return False
        key = tuple(s.value for s in history[-40:])
        if key == self._last_key and len(history) == len(self.state.history):
            return False
        self._last_key = key
        self.state.history = list(history)
        if self.table_name and history:
            self._sync_stats_from_history(self.table_name, history)
        if len(history) > prev_len:
            self._last_history_growth_at = time.monotonic()
            self._reset_bet_phase_for_new_round()
        for tid in table_name_to_ids(self.table_name):
            self._last_stats_total[tid] = _stats_total(self.get_stats(self.table_name))
        logger.info("Lich su AE SEXY (%s): %d van (+%d)", source, len(history), max(0, len(history) - prev_len))
        if self.on_history_update:
            result = self.on_history_update(history, source, prev_len)
            if hasattr(result, "__await__"):
                await result
        return True

    def _pick_marker_http(
        self, table_name: str
    ) -> tuple[list[BetSide], str, dict[str, int]]:
        for tid in table_name_to_ids(table_name):
            entry = self._http_roads.get(tid)
            if not entry or not entry.get("has_markers"):
                continue
            hist = list(entry.get("history") or [])
            stats = dict(entry.get("stats") or {})
            if not hist and stats_total(stats) == 0:
                return hist, str(entry.get("source", SSOT_SOURCE)), stats
            if not hist:
                continue
            if stats and (
                is_trusted_history(hist, stats)
                or (
                    len(hist) == stats_total(stats)
                    and stats_mismatch_severity(hist, stats) <= 4
                )
            ):
                return hist, str(entry.get("source", SSOT_SOURCE)), stats
        return [], "", {}

    def _trusted_http_len(self, table_name: str) -> int:
        """So van HTTP tin cay — phai khop winCounts B+P+T, khong phai chi bigRoads."""
        for tid in table_name_to_ids(table_name):
            entry = self._http_roads.get(tid)
            if not entry:
                continue
            hist = entry.get("history") or []
            stats = entry.get("stats")
            if hist and stats and is_trusted_history(hist, stats):
                return len(hist)
        return 0

    def _get_trusted_http_history(
        self, table_name: str
    ) -> tuple[list[BetSide], str, dict[str, int]]:
        hist, src, stats = history_for_table_name(self._http_roads, table_name)
        if hist and stats and is_trusted_history(hist, stats):
            return list(hist), src or "http-init-table", dict(stats)
        if hist and stats and len(hist) == stats_total(stats) and stats_mismatch_severity(hist, stats) <= 4:
            return list(hist), src or "http-init-table", dict(stats)
        return [], "", {}

    async def fetch_http_history(self, page: Page, table_name: str) -> bool:
        """Goi queryInitTableInfo — chi khi da trong ban (sau click)."""
        if not self._in_room:
            logger.debug(
                "[SSOT] Bo qua queryInitTableInfo — chua click vao ban %s",
                table_name,
            )
            return False
        now = time.monotonic()
        if now < getattr(self, "_http_fail_until", 0.0):
            return False
        self._last_http_fetch = now
        prev_len = self._trusted_http_len(table_name)
        fetched, logout_relay = await fetch_init_table_info(page, table_name, quiet=True)
        if logout_relay:
            self._last_http_logout_relay = True
        if not fetched:
            # Thu nap thang vao cache neu intercept khong bat duoc
            from src.ae_sexy_http import _fetch_table_body_from_frames, ingest_http_json, parse_http_json_text

            for tid in table_name_to_ids(table_name):
                body, relay = await _fetch_table_body_from_frames(page, tid)
                if relay:
                    self._last_http_logout_relay = True
                if not body:
                    continue
                data = parse_http_json_text(body)
                if data:
                    fetched = ingest_http_json(data) or fetched
                if fetched:
                    break
        if not fetched:
            if not self._in_room:
                logger.debug(
                    "[SSOT] Bo qua queryInitTableInfo — chua trong ban %s (dang o sanh?)",
                    table_name,
                )
                return False
            self._http_fail_streak = int(getattr(self, "_http_fail_streak", 0)) + 1
            pause = min(60.0, 4.0 * self._http_fail_streak)
            if self._http_fail_streak >= 3:
                self._http_fail_until = now + pause
                # Session/API chet — dung spam; danh dau can khoi phuc
                if self._http_fail_streak == 3 or (now - getattr(self, "_last_http_fail_log", 0)) > 20:
                    self._last_http_fail_log = now
                    if getattr(self, "_last_http_logout_relay", False):
                        logger.warning(
                            "[SSOT] HTTP queryInitTableInfo — session API het han — ban %s (tam dung %.0fs)",
                            table_name,
                            pause,
                        )
                    else:
                        logger.warning(
                            "[SSOT] HTTP queryInitTableInfo that bai/decode rong — ban %s "
                            "(lan %d, tam dung %.0fs — khong spam)",
                            table_name,
                            self._http_fail_streak,
                            pause,
                        )
                if self._http_fail_streak >= 5:
                    self._in_room = False
                    self._request_enter_table("ssot-http-fail")
            elif self._http_fail_streak == 1:
                if getattr(self, "_last_http_logout_relay", False):
                    logger.warning(
                        "[SSOT] HTTP queryInitTableInfo — session API het han (Auto Logout Relay) — ban %s",
                        table_name,
                    )
                else:
                    logger.warning(
                        "[SSOT] HTTP queryInitTableInfo that bai hoac decode rong — ban %s",
                        table_name,
                    )
            return False
        self._http_fail_streak = 0
        self._http_fail_until = 0.0
        for tid, entry in fetched.items():
            prev = self._http_roads.get(tid)
            new_shoe = int(entry.get("game_shoe") or 0)
            prev_shoe = int(prev.get("game_shoe") or 0) if prev else 0
            if prev and new_shoe and prev_shoe and new_shoe != prev_shoe:
                logger.info("Shoe moi HTTP table %s: %s -> %s", tid, prev_shoe, new_shoe)
                self._road_by_table[tid] = []
                self._last_stamp_by_table[tid] = 0
                self._last_stats_total[tid] = 0
                if self.table_name and tid in table_name_to_ids(self.table_name):
                    self.state.history = []
                    self._last_key = ()
                    self._shuffle_by_table[tid] = 0
                    self._notify_shoe_change(self.table_name)
            self._http_roads[tid] = _merge_entry(prev, entry) if prev else entry
            if entry.get("stats") and tid in table_name_to_ids(table_name):
                self._merge_table_stats(table_name, entry["stats"])
            shoe = int(entry.get("game_shoe") or 0)
            rnd = int(entry.get("game_round") or 0)
            if shoe:
                self._last_game_shoe[tid] = shoe
            if rnd:
                self._last_game_round[tid] = rnd
        new_len = self._trusted_http_len(table_name)
        if new_len > prev_len:
            logger.info("HTTP poll %s: %d -> %d van", table_name, prev_len, new_len)
        else:
            for tid in table_name_to_ids(table_name):
                entry = self._http_roads.get(tid)
                if not entry or not entry.get("history"):
                    continue
                hist = entry["history"]
                stats = entry.get("stats") or {}
                if stats and not is_trusted_history(hist, stats):
                    logger.debug(
                        "HTTP cache table %s: decode %d van lech winCounts tong %d (B=%s P=%s T=%s)",
                        tid,
                        len(hist),
                        stats_total(stats),
                        stats.get("banker"),
                        stats.get("player"),
                        stats.get("tie"),
                    )
                    break
        return new_len > prev_len

    def _resolve_http_history(
        self, table_name: str
    ) -> tuple[list[BetSide], str, dict[str, int]]:
        """Lay lich su HTTP day du — CHI markerRoads (SSOT grid bead plate)."""
        hist, src, stats = self._pick_marker_http(table_name)
        if src:
            return hist, src or SSOT_SOURCE, dict(stats or self.get_stats(table_name) or {})
        for tid in table_name_to_ids(table_name):
            entry = self._http_roads.get(tid)
            if not entry or not entry.get("has_markers"):
                continue
            h = list(entry.get("history") or [])
            s = dict(entry.get("stats") or {})
            if not h and stats_total(s) == 0:
                return h, str(entry.get("source") or SSOT_SOURCE), s
            if h and s and is_trusted_history(h, s):
                return h, str(entry.get("source") or SSOT_SOURCE), s
            if h and s and len(h) == stats_total(s) and stats_mismatch_severity(h, s) <= 4:
                return h, str(entry.get("source") or SSOT_SOURCE), s
        return [], "", {}

    async def _bootstrap_from_http(self, page: Page, table_name: str) -> list[BetSide] | None:
        """Nap lich su CHI tu HTTP markerRoads. None = chua lay duoc SSOT."""
        self._last_http_logout_relay = False
        await self.fetch_http_history(page, table_name)
        http_hist, http_src, http_stats = self._resolve_http_history(table_name)
        if not http_src:
            return None

        dom_stats = await self._read_dom_stats(page)
        footer_total = stats_total(dom_stats) if dom_stats else 0
        if footer_total >= 3 and abs(len(http_hist) - footer_total) > 2:
            logger.warning(
                "HTTP %d van lech footer %d van — uu tien HTTP markerRoads",
                len(http_hist),
                footer_total,
            )

        if await self._dispatch_history_update(
            "bootstrap",
            http_hist,
            http_src or SSOT_SOURCE,
            force=True,
        ):
            if http_stats:
                self._merge_table_stats(table_name, http_stats)
                self._sync_stats_from_history(table_name, http_hist, ref_stats=http_stats)
            return list(self.state.history)
        return None

    async def load_full_history(self, page: Page, table_name: str, *, light_dom: bool = False) -> list[BetSide]:
        """Doc lich su — CHI HTTP markerRoads (+ WS fallback). Khong bead."""
        if not self._in_room:
            return []
        self.table_name = table_name
        self._page = page
        await self.inject_hook_frames(page)

        hist = await self._bootstrap_from_http(page, table_name)
        if hist is not None:
            return hist

        if self._last_http_logout_relay:
            from src.ae_sexy import recover_ae_sexy_session_expired

            logger.warning("[SSOT] Session API het han — khoi phuc va nap lai markerRoads")
            if await recover_ae_sexy_session_expired(page, table_name):
                self._last_http_logout_relay = False
                hist = await self._bootstrap_from_http(page, table_name)
                if hist is not None:
                    return hist

        # Cho HTTP/WS (toi da 15s) — khong scrape bead
        deadline = asyncio.get_event_loop().time() + 15.0
        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(1.5)
            if await self.try_catch_up_rounds(page):
                return list(self.state.history)
            hist = await self._bootstrap_from_http(page, table_name)
            if hist is not None:
                return hist

        if not self.state.history:
            if self._last_http_logout_relay:
                logger.warning(
                    "[SSOT] Khong nap duoc markerRoads — session API het han (Auto Logout Relay) — ban %s",
                    table_name,
                )
            else:
                logger.warning(
                    "[SSOT] Khong nap duoc markerRoads sau 15s — ban %s",
                    table_name,
                )
            for tid in table_name_to_ids(table_name):
                entry = self._http_roads.get(tid)
                if entry and entry.get("history"):
                    stats = entry.get("stats") or {}
                    logger.info(
                        "HTTP table %s: decode %d | winCounts tong %d (B=%s P=%s T=%s) %s",
                        tid,
                        len(entry["history"]),
                        stats_total(stats),
                        stats.get("banker", "?"),
                        stats.get("player", "?"),
                        stats.get("tie", "?"),
                        "OK" if is_trusted_history(entry["history"], stats) else "LECH",
                    )
                    break

        return list(self.state.history)

    async def try_catch_up_rounds(self, page: Page) -> bool:
        """Footer/HTTP/WS tien hon lich su local — nap van moi (khong can recovery)."""
        if not self.table_name:
            return False
        cur_len = len(self.state.history)
        dom_stats = await self._read_dom_stats(page)
        ws_stats = self.get_stats(self.table_name)
        ref_total = max(
            stats_total(dom_stats) if dom_stats else 0,
            stats_total(ws_stats) if ws_stats else 0,
            max(self._last_stats_total.get(tid, 0) for tid in table_name_to_ids(self.table_name) or [0]),
        )
        if ref_total <= cur_len:
            return False
        logger.info(
            "Nguon %d van > tool %d van — nap SSOT markerRoads",
            ref_total,
            cur_len,
        )
        return await self._sync_ssot_marker_roads(page, reason=f"catch-up-{ref_total}>{cur_len}")

    def _schedule_ssot_catchup(self, reason: str, *, delays: tuple[float, ...] = (1.5, 3.0, 5.5)) -> None:
        """Poll SSOT HTTP sau khi dong cua / nghi co ket qua moi (WS co the khong toi)."""
        if self._ssot_catchup_task and not self._ssot_catchup_task.done():
            return

        async def _run() -> None:
            base_len = len(self.state.history)
            for i, delay in enumerate(delays):
                await asyncio.sleep(delay)
                page = self._page
                if not page or not self.table_name:
                    return
                prev = len(self.state.history)
                if await self._sync_ssot_marker_roads(page, reason=f"{reason}-t{i+1}"):
                    return
                if await self.try_catch_up_rounds(page):
                    return
                if len(self.state.history) > prev:
                    return
            if len(self.state.history) <= base_len:
                dom = await self._read_dom_stats(page) if page else {}
                if dom and is_trusted_history(self.state.history, dom):
                    logger.debug(
                        "[SSOT] Tool %d van khop footer B=%s P=%s T=%s — HTTP cham (%s)",
                        base_len,
                        dom.get("banker"),
                        dom.get("player"),
                        dom.get("tie"),
                        reason,
                    )
                    return
                ws = self.get_stats(self.table_name) if self.table_name else {}
                marker_n = 0
                decode_n = 0
                for tid in table_name_to_ids(self.table_name or ""):
                    entry = self._http_roads.get(tid) or {}
                    markers = entry.get("raw_markers") or []
                    hist_http = entry.get("history") or []
                    marker_n = len(markers) if markers else len(hist_http)
                    decode_n = len(hist_http)
                    break
                logger.warning(
                    "[PHIEN] SSOT_CHUA_CAP_NHAT | ban=%s | tool=%d van | marker=%d decode=%d | winCount=%s | sau %s",
                    self.table_name,
                    base_len,
                    marker_n,
                    decode_n,
                    stats_total(ws) if ws else "?",
                    reason,
                )

        try:
            loop = asyncio.get_running_loop()
            self._ssot_catchup_task = loop.create_task(_run())
        except RuntimeError:
            pass

    def _reset_bet_phase_for_new_round(self) -> None:
        """Sau ket qua van moi — cho phep bat CUOC_MO lan tiep (phase co the mac dinh open)."""
        self._last_bet_phase = {}
        self._last_cuoc_mo_logged = False

    async def _trace_betting_phase(self, page: Page) -> None:
        """Log chuyen pha cua cuoc — mo/dong."""
        if not self.table_name or not self._in_room:
            return
        try:
            from src.ae_sexy_betting import probe_betting_phase

            phase = await probe_betting_phase(page)
        except Exception:
            return
        if not phase:
            return
        prev = self._last_bet_phase
        game_round = 0
        for tid in table_name_to_ids(self.table_name):
            game_round = self._last_game_round.get(tid, 0)
            if game_round:
                break
        ws_stats = self.get_stats(self.table_name)
        tool_len = len(self.state.history)
        open_now = bool(phase.get("open") or phase.get("canClick"))
        closed_now = bool(phase.get("closed") or phase.get("moBai"))
        was_open = bool(prev.get("open") or prev.get("canClick"))
        was_closed = bool(prev.get("closed") or prev.get("moBai"))
        if open_now and not was_open:
            cd = str(phase.get("cdText") or "").strip()
            has_cd = bool(cd and cd.isdigit() and int(cd) > 0)
            if not has_cd and not phase.get("confirmReady"):
                self._last_bet_phase = dict(phase)
                return
            if has_cd and int(cd) < 3 and not phase.get("confirmReady"):
                self._last_bet_phase = dict(phase)
                return
            if (
                not has_cd
                and not phase.get("confirmReady")
                and not phase.get("progressActive")
                and not phase.get("bettingText")
            ):
                self._last_bet_phase = dict(phase)
                return
            cuoc_phase(
                event="CUOC_MO",
                table=self.table_name,
                cd=str(phase.get("cdText") or ""),
                chips=phase.get("chipsVisible"),
                zone=phase.get("zoneVisible"),
                closed=closed_now,
                game_round=game_round,
            )
            logger.info(
                "[PHIEN] CUOC_MO_CTX | tool=%d van | ws tong=%s | round=%s",
                tool_len,
                stats_total(ws_stats) if ws_stats else "?",
                game_round or "?",
            )
            self._last_cuoc_mo_logged = True
            if self.on_betting_open:
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self._notify_betting_open(page))
                except RuntimeError:
                    pass
        elif closed_now and not was_closed and self._last_cuoc_mo_logged:
            cuoc_phase(
                event="CUOC_DONG",
                table=self.table_name,
                cd=str(phase.get("cdText") or ""),
                chips=phase.get("chipsVisible"),
                zone=phase.get("zoneVisible"),
                closed=True,
                game_round=game_round,
            )
            logger.info(
                "[PHIEN] CUOC_DONG_CTX | tool=%d van | ws tong=%s | round=%s — poll SSOT",
                tool_len,
                stats_total(ws_stats) if ws_stats else "?",
                game_round or "?",
            )
            self._last_cuoc_mo_logged = False
            self._schedule_ssot_catchup("cuoc-dong")
        self._last_bet_phase = dict(phase)

    async def _notify_betting_open(self, page: Page) -> None:
        if not self.on_betting_open or not self.table_name:
            return
        try:
            result = self.on_betting_open(page, self.table_name)
            if hasattr(result, "__await__"):
                await result
        except Exception as exc:
            logger.debug("on_betting_open: %s", exc)

    async def check_round_update(self, page: Page):
        """Poll dinh ky — chi HTTP catch-up + WS increment. Khong bead."""
        self._page = page
        if not self.table_name:
            return
        from src.ae_sexy import is_ae_sexy_in_room, is_game_ui_alive

        ui_ok, ui_reason = await is_game_ui_alive(page, self.table_name)
        if not ui_ok:
            self._ui_fail_streak += 1
            if self._ui_fail_streak >= _UI_BROKEN_STREAK and self.on_ui_broken:
                # Chi bao 1 lan cho moi chuoi fail — reset khi UI song lai
                if not getattr(self, "_ui_broken_notified", False):
                    try:
                        self.on_ui_broken(ui_reason)
                        self._ui_broken_notified = True
                    except Exception as exc:
                        logger.debug("on_ui_broken: %s", exc)
        else:
            self._ui_fail_streak = 0
            self._ui_broken_notified = False

        in_room = await is_ae_sexy_in_room(page, self.table_name, self)
        if not in_room:
            # Chip/cuoc van con → dang trong ban (probe nham lobby)
            try:
                from src.ae_sexy import _gamehall_iframe_visible, _has_visible_room_bet_ui

                if await _has_visible_room_bet_ui(page) and not await _gamehall_iframe_visible(
                    page
                ):
                    in_room = True
            except Exception:
                pass
        # Dang co chip → khong bi day ra in_room=False chi vi dem text hall an
        if in_room:
            self._in_room = True
        elif not in_room:
            try:
                from src.ae_sexy import _count_lobby_table_titles, _has_visible_room_bet_ui

                if await _has_visible_room_bet_ui(page):
                    in_room = True
                    self._in_room = True
                elif await _count_lobby_table_titles(page) >= 3:
                    self._in_room = False
                    self._table_ready = False
            except Exception:
                pass
        if in_room and self._in_room:
            # Trong ban nhung man den — bao reload, khong MAT_BAN
            try:
                from src.ae_sexy import probe_game_shell_health, probe_room_stream_health
                from src.ae_sexy_betting import probe_betting_phase

                stream = await probe_room_stream_health(page)
                shell = await probe_game_shell_health(page)
                bet = await probe_betting_phase(page)
                chips = bool(bet.get("chipsVisible") or bet.get("zoneVisible"))
                black = bool(
                    (stream.get("blackScreen") or shell.get("blackScreen"))
                    and (
                        stream.get("streamDead")
                        or stream.get("videoDead")
                        or shell.get("videoDead")
                        or not stream.get("streamOk")
                    )
                )
                if black and chips and self.on_ui_broken:
                    if not getattr(self, "_black_video_notified", False):
                        self.on_ui_broken("man hinh den + mat stream video")
                        self._black_video_notified = True
                elif not black:
                    self._black_video_notified = False
            except Exception:
                pass
        else:
            # Chip/cuoc con → van trong ban (probe nham vi video den)
            try:
                from src.ae_sexy_betting import probe_betting_phase

                bet = await probe_betting_phase(page)
                if bet.get("chipsVisible") or bet.get("zoneVisible"):
                    self._in_room = True
                    if self.on_ui_broken and not getattr(self, "_black_video_notified", False):
                        self.on_ui_broken("man hinh den + mat stream video")
                        self._black_video_notified = True
                    return
            except Exception:
                pass
            # History dang theo doi + khong thay gamehall → chua kick, chi probe lech
            try:
                from src.ae_sexy import _gamehall_iframe_visible

                if self.state.history and not await _gamehall_iframe_visible(page):
                    self._in_room = True
                    logger.debug(
                        "Bo qua MAT_BAN — con history + sanh an (co the dang trong ban)"
                    )
                    return
            except Exception:
                pass
            if self._in_room:
                logger.warning(
                    "[PHIEN] MAT_BAN | bi day ra sanh — can vao lai %s",
                    self.table_name,
                )
            self._in_room = False
            self._table_ready = False
            self._request_enter_table("poll-van-o-sanh")
            return

        if ui_ok:
            await self._trace_betting_phase(page)

        now = time.monotonic()
        if now - self._last_ssot_poll_at >= self._ssot_poll_interval:
            self._last_ssot_poll_at = now
            cur_len = len(self.state.history)
            dom_stats = await self._read_dom_stats(page)
            ws_stats = self.get_stats(self.table_name)
            ref_total = max(
                stats_total(dom_stats) if dom_stats else 0,
                stats_total(ws_stats) if ws_stats else 0,
            )
            stale = (now - self._last_history_growth_at) > 25.0
            if ref_total > cur_len or stale:
                if stale and ref_total <= cur_len:
                    logger.info(
                        "[PHIEN] SSOT_POLL | tool=%d van khong doi >25s — thu HTTP markerRoads",
                        cur_len,
                    )
                if await self._sync_ssot_marker_roads(page, reason="periodic"):
                    return

        if await self.try_catch_up_rounds(page):
            return

        if not self.state.history:
            now = asyncio.get_event_loop().time()
            if now - self._last_http_fetch >= self._http_fetch_interval:
                self._last_http_fetch = now
                await self._bootstrap_from_http(page, self.table_name)
            return

        dom_stats = await self._read_dom_stats(page)
        if dom_stats and stats_total(dom_stats) >= 3:
            self._merge_table_stats(self.table_name, dom_stats, from_display=True)
            footer_total = stats_total(dom_stats)
            cur_len = len(self.state.history)
            if footer_total > cur_len:
                await self.try_catch_up_rounds(page)

        if (
            self._ws_last_frame_at
            and (time.monotonic() - self._ws_last_frame_at) > 90
            and len(self.state.history) >= 3
        ):
            logger.warning(
                "[PHIEN] WS_IM_LANG | ban=%s | khong co WS frame >90s — dung poll SSOT/DOM",
                self.table_name,
            )
            self._ws_last_frame_at = time.monotonic()

    async def poll_dom(self, page: Page):
        """Alias — goi check_round_update."""
        await self.check_round_update(page)

    async def wait_for_history(
        self,
        table_name: str,
        page: Page,
        timeout_sec: float = 25,
        *,
        light_dom: bool = False,
    ) -> list[BetSide]:
        self.table_name = table_name
        deadline = asyncio.get_event_loop().time() + timeout_sec
        expected = self._expected_rounds(table_name)

        while asyncio.get_event_loop().time() < deadline:
            hist = await self.load_full_history(page, table_name, light_dom=light_dom)
            dom = await read_in_room_stats(page)
            dom_total = _stats_total(dom) if dom else 0
            if hist and dom_total and is_trusted_history(hist, dom):
                return hist
            expected = max(expected, self._expected_rounds(table_name))
            if hist and expected >= 5 and len(hist) < expected - 2:
                await asyncio.sleep(2.5)
                continue
            if hist and not dom_total and (not expected or len(hist) >= expected - 1):
                return hist
            await asyncio.sleep(2.5)

        return list(self.state.history)

    def set_poll_gate(self, gate: Callable[[], bool] | None) -> None:
        """Neu gate() tra ve True thi tam dung poll (vd. dang cho/dat cuoc)."""
        self._poll_gate = gate

    def bind_page(self, page: Page) -> None:
        """Gan page hien tai (sau resolve tab) — poll/HTTP dung dung tab."""
        self._page = page
        try:
            self.attach_http(page)
        except Exception as exc:
            logger.debug("bind_page attach_http: %s", exc)

    async def start_polling(self, page: Page):
        self._running = True
        self._page = page
        while self._running:
            try:
                cur = self._page or page
                if cur.is_closed():
                    self.poll_error_streak += 1
                    break
                if self._poll_gate and self._poll_gate():
                    # Van probe vi tri nhe — tranh _in_room treo khi bi day ve sanh
                    try:
                        from src.ae_sexy import is_ae_sexy_in_room, is_ae_sexy_lobby

                        if self.table_name and await is_ae_sexy_lobby(cur):
                            if self._in_room:
                                logger.warning(
                                    "[PHIEN] MAT_BAN | poll-gate — UI sanh, can click lai %s",
                                    self.table_name,
                                )
                            self._in_room = False
                            self._table_ready = False
                            self._request_enter_table("poll-gate-lobby")
                    except Exception:
                        pass
                    await asyncio.sleep(0.3)
                    continue
                await self.check_round_update(cur)
                if self._in_room and self._on_table_sync:
                    try:
                        result = self._on_table_sync()
                        if asyncio.iscoroutine(result):
                            await result
                    except Exception as exc:
                        logger.debug("Table sync hook: %s", exc)
                self.poll_error_streak = 0
            except Exception as exc:
                self.poll_error_streak += 1
                logger.debug("Poll loi (%d): %s", self.poll_error_streak, exc)
            await asyncio.sleep(self.poll_interval)

    def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()

    def start_background(self, page: Page):
        self.bind_page(page)
        if self._task and not self._task.done():
            # Restart poll tren page moi
            self._task.cancel()
        loop = asyncio.get_running_loop()
        self._task = loop.create_task(self.start_polling(page))
