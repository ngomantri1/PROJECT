from __future__ import annotations



import asyncio

import logging

from collections.abc import Awaitable, Callable

from typing import Any



from playwright.async_api import BrowserContext, Page, WebSocket



from src.models import TableState

from src.ongames import decode_history_codes, pick_baccarat_table

from src.parser import apply_event, parse_game_message

from src.table_focus import (
    cache_tables_from_ws,
    pick_default_lobby_table,
)



logger = logging.getLogger(__name__)



OnRoundResult = Callable[[Any], Awaitable[None] | None]

OnTableLoaded = Callable[[dict, list[str]], Awaitable[None] | None]

OnHistorySync = Callable[[dict, list[str], list], Awaitable[None] | None]





class TrafficCollector:

    """Sniff WebSocket, luu lich su van Baccarat."""



    def __init__(

        self,

        state: TableState,

        table_id: int | None = None,

        table_name: str = "",

        on_round_result: OnRoundResult | None = None,

        on_table_loaded: OnTableLoaded | None = None,

        on_history_sync: OnHistorySync | None = None,

    ):

        self.state = state

        self.table_id = table_id

        self.table_name = table_name

        self.on_round_result = on_round_result

        self.on_table_loaded = on_table_loaded

        self.on_history_sync = on_history_sync

        self._seen_rounds: set[str] = set()

        self._loaded_table_id: int | None = None

        self._attached_pages: set[int] = set()

        self._table_cache: dict[int, dict] = {}

        self._table_order: list[int] = []

        self._pick_deferred = table_id is None



    def attach_to_context(self, context: BrowserContext):

        context.on("page", self._on_new_page)

        for page in context.pages:

            self._attach_page(page)

        logger.info("Collector gan vao %d tab", len(context.pages))



    def _on_new_page(self, page: Page):

        self._attach_page(page)



    def _attach_page(self, page: Page):

        pid = id(page)

        if pid in self._attached_pages:

            return

        self._attached_pages.add(pid)

        page.on("websocket", self._on_websocket)

        logger.info("WS listener: %s", page.url[:100])



    def _on_websocket(self, ws: WebSocket):

        if "ongames" in ws.url or "vipbet" in ws.url:

            logger.info("WebSocket: %s", ws.url)

        ws.on("framereceived", lambda p: self._schedule(self._process(p)))



    def _schedule(self, coro):

        try:

            loop = asyncio.get_event_loop()

            if loop.is_running():

                loop.create_task(coro)

        except Exception:

            pass



    def get_hall_tables(self) -> list[dict]:

        """Danh sach ban Baccarat trong sanh (thu tu message 1101)."""

        return [self._table_cache[tid] for tid in self._table_order if tid in self._table_cache]



    async def wait_for_hall_tables(self, min_tables: int = 1, timeout_sec: int = 30) -> list[dict]:

        for _ in range(timeout_sec * 2):

            tables = self.get_hall_tables()

            if len(tables) >= min_tables:

                return tables

            await asyncio.sleep(0.5)

        return self.get_hall_tables()



    async def wait_for_table_in_cache(self, t_id: int, timeout_sec: int = 15) -> dict | None:

        for _ in range(timeout_sec * 2):

            tb = self._table_cache.get(int(t_id))

            if tb:

                return tb

            await asyncio.sleep(0.5)

        return None



    async def wait_for_table_cache(self, min_tables: int = 1, timeout_sec: int = 20) -> bool:

        for _ in range(timeout_sec * 2):

            if len(self._table_cache) >= min_tables:

                return True

            await asyncio.sleep(0.5)

        return len(self._table_cache) > 0



    async def wait_for_target_table(self, timeout_sec: int = 25) -> dict | None:

        for _ in range(timeout_sec * 2):

            picked, _ = pick_default_lobby_table(

                self._table_cache,

                self._table_order,

                table_name=self.table_name,

                table_id=self.table_id,

            )

            if picked:

                return picked

            await asyncio.sleep(0.5)

        picked, _ = pick_default_lobby_table(self._table_cache, self._table_order)

        return picked



    async def lock_table(self, t_id: int) -> dict | None:

        tb = self._table_cache.get(int(t_id))

        if not tb:

            tb = await self.wait_for_table_in_cache(t_id, timeout_sec=10)

        if not tb:

            logger.warning("Khong co cache cho ban id=%s", t_id)

            return None



        self._pick_deferred = False

        self.table_id = int(t_id)

        self._loaded_table_id = int(t_id)



        codes = tb.get("history") or []

        self.state.table_id = str(t_id)

        self.state.table_name = str(tb.get("tNo", ""))

        self.state.history = decode_history_codes(codes)



        logger.info(

            "Khoa theo doi ban %s (id=%s) | lich su cache: %d van",

            tb.get("tNo"),

            t_id,

            len(self.state.history),

        )

        if self.state.history:

            from src.models import SIDE_LABEL

            tail = " -> ".join(SIDE_LABEL.get(s, s.value) for s in self.state.history[-8:])

            logger.info("8 van cuoi [%s id=%s]: %s", tb.get("tNo"), t_id, tail)



        if self.on_table_loaded:

            result = self.on_table_loaded(tb, codes)

            if hasattr(result, "__await__"):

                await result

        return tb



    async def _process(self, payload: str | bytes):

        text = payload.decode("utf-8", errors="ignore") if isinstance(payload, bytes) else payload

        cache_tables_from_ws(text, self._table_cache, self._table_order)



        if self._pick_deferred:

            return



        event = parse_game_message(text, table_id=self.table_id)

        if not event:

            return



        if event["type"] == "table_list" and not self.table_id:

            tables = event.get("tables") or []

            picked = pick_baccarat_table(

                tables, table_name=self.table_name, table_id=None

            )

            if picked:

                self.table_id = picked.get("tId")

                logger.info("Chon ban lobby: %s (id=%s)", picked.get("tNo"), picked.get("tId"))

                event = {"type": "table_list", "tables": [picked], "raw": event.get("raw")}



        if event["type"] == "round_result" and not self.table_id:

            raw = event.get("raw") or {}

            content = raw.get("content") or {}

            r_no = str(event.get("round_id", ""))

            t_id = content.get("tId") or event.get("table_id")

            result_code = str(content.get("result", ""))

            if t_id and ("BAC" in r_no.upper() or result_code[:1] in "PBT"):

                self.table_id = t_id

                logger.info("Chon ban Baccarat id=%s (%s)", t_id, r_no[:50])

            else:

                return



        if self.table_id and event.get("type") in ("round_result", "round_state", "dealing"):

            evt_tid = event.get("table_id")

            if evt_tid is not None and int(evt_tid) != int(self.table_id):

                return



        if event["type"] == "table_list" and self.table_id:

            tables = [t for t in event.get("tables", []) if t.get("tId") == self.table_id]

            if not tables:

                return

            event["tables"] = tables



        prev_history = list(self.state.history)

        round_result = apply_event(self.state, event)



        if event["type"] == "table_list":

            tables = event.get("tables") or []

            if tables:

                tb = tables[0]

                tid = tb.get("tId")

                codes = tb.get("history") or []

                table_changed = tid != self._loaded_table_id

                history_grew = (

                    self._loaded_table_id == tid

                    and len(prev_history) == 0

                    and len(self.state.history) > 0

                )



                if table_changed or self._loaded_table_id is None:

                    self._loaded_table_id = tid

                    if self.on_table_loaded:

                        result = self.on_table_loaded(tb, codes)

                        if hasattr(result, "__await__"):

                            await result

                elif history_grew:

                    if self.on_table_loaded:

                        result = self.on_table_loaded(tb, codes)

                        if hasattr(result, "__await__"):

                            await result

                elif self.state.history != prev_history and self.on_history_sync:

                    result = self.on_history_sync(tb, codes, prev_history)

                    if hasattr(result, "__await__"):

                        await result



        if not round_result:

            return



        dedup = f"{round_result.round_id}:{round_result.side.value}"

        if dedup in self._seen_rounds:

            return

        self._seen_rounds.add(dedup)



        if self.on_round_result:

            result = self.on_round_result(round_result)

            if hasattr(result, "__await__"):

                await result


