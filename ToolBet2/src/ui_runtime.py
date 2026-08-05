from __future__ import annotations

import asyncio
import logging

from playwright.async_api import Page

from src.ui_assets import UiAssetBundle, load_ui_assets
from src.ui_contracts import UiSnapshot


logger = logging.getLogger(__name__)


class BrowserUiRuntime:
    """Owns the v2 UI lifecycle while keeping its state on the Python side."""

    def __init__(
        self,
        *,
        enabled: bool = False,
        assets: UiAssetBundle | None = None,
    ):
        self.enabled = bool(enabled)
        self._assets = assets
        self._last_snapshot: UiSnapshot | None = None
        self._update_lock = asyncio.Lock()
        self._pending_update: tuple[Page, UiSnapshot] | None = None
        self._scroll_trace_pages: set[int] = set()

    @property
    def last_snapshot(self) -> UiSnapshot | None:
        return self._last_snapshot

    def configure(self, *, enabled: bool) -> None:
        self.enabled = bool(enabled)

    def _bundle(self) -> UiAssetBundle:
        if self._assets is None:
            self._assets = load_ui_assets()
        return self._assets

    def _bind_scroll_trace(self, page: Page) -> None:
        """Forward explicit browser scroll diagnostics into the runtime log."""
        page_key = id(page)
        if page_key in self._scroll_trace_pages:
            return
        try:
            def on_console(message) -> None:
                text = str(getattr(message, "text", ""))
                if "[TBV2_SCROLL_TRACE]" in text:
                    logger.info("%s", text)

            page.on("console", on_console)
            self._scroll_trace_pages.add(page_key)
        except Exception as exc:
            logger.debug("Khong gan duoc scroll trace cho UI runtime: %s", exc)

    async def install(self, page: Page, snapshot: UiSnapshot | None = None) -> bool:
        if snapshot is not None:
            self._last_snapshot = snapshot
        if not self.enabled or page.is_closed():
            return False

        current = self._last_snapshot or UiSnapshot()
        assets = self._bundle()
        try:
            self._bind_scroll_trace(page)
            await page.evaluate(assets.bridge_js)
            return bool(
                await page.evaluate(
                    """({snapshot, assets}) =>
                      window.ToolBetUi.install(snapshot, assets)""",
                    {
                        "snapshot": current.to_payload(),
                        "assets": {
                            "themeCss": assets.theme_css,
                            "componentsCss": assets.components_css,
                        },
                    },
                )
            )
        except Exception as exc:
            logger.debug("Khong cai duoc UI runtime v2: %s", exc)
            return False

    @staticmethod
    def _session_id(snapshot: UiSnapshot) -> str:
        return str(snapshot.state.get("runtime_session_id") or "")

    def _is_stale(self, snapshot: UiSnapshot) -> bool:
        current = self._last_snapshot
        return bool(
            current is not None
            and self._session_id(current) == self._session_id(snapshot)
            and snapshot.revision < current.revision
        )

    async def _send_update(self, page: Page, snapshot: UiSnapshot) -> bool:
        if page.is_closed():
            return False
        try:
            bridge_ready = bool(
                await page.evaluate(
                    "() => !!(window.ToolBetUi && window.ToolBetUi.update)"
                )
            )
        except Exception:
            bridge_ready = False
        if not bridge_ready:
            return await self.install(page)

        try:
            return bool(
                await page.evaluate(
                    """snapshot => window.ToolBetUi.update(snapshot)""",
                    snapshot.to_payload(),
                )
            )
        except Exception:
            return await self.install(page)

    async def update(self, page: Page, snapshot: UiSnapshot) -> bool:
        if not self.enabled or page.is_closed():
            return False
        if self._is_stale(snapshot):
            return True
        self._last_snapshot = snapshot
        if self._update_lock.locked():
            self._pending_update = (page, snapshot)
            return True

        result = True
        async with self._update_lock:
            current: tuple[Page, UiSnapshot] | None = (page, snapshot)
            while current is not None:
                current_page, current_snapshot = current
                self._pending_update = None
                result = await self._send_update(
                    current_page,
                    current_snapshot,
                )
                current = self._pending_update
        return result

    async def present(self, page: Page) -> bool:
        if not self.enabled or page.is_closed():
            return False
        try:
            return bool(
                await page.evaluate(
                    "() => !!(window.ToolBetUi && window.ToolBetUi.present())"
                )
            )
        except Exception:
            return False

    async def remove(self, page: Page) -> None:
        if page.is_closed():
            return
        try:
            await page.evaluate(
                """() => {
                  if (window.ToolBetUi && window.ToolBetUi.remove) {
                    window.ToolBetUi.remove();
                  }
                }"""
            )
        except Exception:
            pass
