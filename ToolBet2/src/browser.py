from __future__ import annotations

import asyncio
import logging
import os
import socket
import subprocess
import time
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_RUNTIME_ROOT = Path(os.environ.get("TOOLBET_HOME", "") or _PROJECT_ROOT)
_DEFAULT_PROFILE = _RUNTIME_ROOT / "data" / "cdp_profile"


def normalize_cdp_url(cdp_url: str | None) -> str:
    """localhost → 127.0.0.1 (tranh Node/Playwright uu tien ::1 bi ECONNREFUSED)."""
    raw = (cdp_url or "http://127.0.0.1:9222").strip()
    if not raw:
        return "http://127.0.0.1:9222"
    parsed = urlparse(raw)
    host = parsed.hostname or "127.0.0.1"
    if host.lower() in ("localhost", "::1"):
        host = "127.0.0.1"
    port = parsed.port or 9222
    return f"http://{host}:{port}"


def _cdp_host_port(cdp_url: str) -> tuple[str, int]:
    parsed = urlparse(normalize_cdp_url(cdp_url))
    host = parsed.hostname or "127.0.0.1"
    port = int(parsed.port or 9222)
    return host, port


def cdp_port_open(cdp_url: str, timeout: float = 0.2) -> bool:
    host, port = _cdp_host_port(cdp_url)
    # normalize_cdp_url already resolves localhost to 127.0.0.1. Probing the
    # same loopback endpoint three times made a stopped Chrome cost several
    # seconds on Windows before each recovery/startup decision.
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


async def wait_for_cdp_port(
    cdp_url: str,
    *,
    wait_sec: float = 15.0,
    interval_sec: float = 0.5,
) -> bool:
    """Wait for a Chrome process launched by ToolBet.bat to expose CDP."""

    deadline = time.monotonic() + max(0.0, wait_sec)
    while time.monotonic() < deadline:
        if cdp_port_open(cdp_url):
            return True
        await asyncio.sleep(max(0.05, interval_sec))
    return cdp_port_open(cdp_url)


def find_chrome_exe() -> str | None:
    candidates = [
        os.environ.get("CHROME_EXE") or "",
        os.environ.get("TOOLBET_CHROME") or "",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        str(Path.home() / "AppData" / "Local" / "Google" / "Chrome" / "Application" / "chrome.exe"),
    ]
    for path in candidates:
        if path and Path(path).is_file():
            return path
    return None


def launch_chrome_cdp(cdp_url: str, profile_dir: Path | None = None) -> bool:
    """Mo Chrome voi remote-debugging (giong ToolBet.bat)."""
    if cdp_port_open(cdp_url):
        return True
    chrome = find_chrome_exe()
    if not chrome:
        logger.error("Khong tim thay chrome.exe — khong the mo lai trinh duyet")
        return False
    _, port = _cdp_host_port(cdp_url)
    profile = Path(profile_dir or _DEFAULT_PROFILE)
    profile.mkdir(parents=True, exist_ok=True)
    args = [
        chrome,
        f"--remote-debugging-port={port}",
        f"--user-data-dir={profile}",
        "--start-maximized",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
    ]
    creationflags = 0
    if os.name == "nt":
        creationflags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(
            subprocess, "CREATE_NEW_PROCESS_GROUP", 0
        )
    try:
        subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            creationflags=creationflags,
            close_fds=os.name != "nt",
        )
        logger.warning(
            "Da mo Chrome CDP port=%s profile=%s",
            port,
            profile,
        )
        return True
    except Exception as exc:
        logger.error("Mo Chrome that bai: %s", exc)
        return False


class BrowserManager:
    """Kết nối Chrome đang chạy qua CDP hoặc mở browser mới."""

    def __init__(
        self,
        cdp_url: str | None = None,
        headless: bool = False,
        profile_dir: Path | str | None = None,
    ):
        self.cdp_url = normalize_cdp_url(cdp_url) if cdp_url else None
        self.headless = headless
        self.profile_dir = Path(profile_dir) if profile_dir else _DEFAULT_PROFILE
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._owns_browser = False

    @property
    def context(self) -> BrowserContext | None:
        return self._context

    def is_connected(self) -> bool:
        """True khi CDP/browser + context con song."""
        browser = self._browser
        ctx = self._context
        if browser is None or ctx is None:
            return False
        try:
            if hasattr(browser, "is_connected") and not browser.is_connected():
                return False
        except Exception:
            return False
        try:
            # Truy cap pages de bat context da dong.
            _ = ctx.pages
            return True
        except Exception:
            return False

    async def _set_cdp_window_bounds(
        self,
        *,
        window_state: str,
        width: int | None = None,
        height: int | None = None,
    ) -> None:
        """Set the current CDP Chrome window state on Windows."""

        if os.name != "nt" or self._context is None:
            return
        page = next(
            (item for item in self._context.pages if not item.is_closed()), None
        )
        if page is None:
            return
        session = None
        try:
            session = await self._context.new_cdp_session(page)
            window = await session.send("Browser.getWindowForTarget")
            window_id = window.get("windowId")
            if window_id:
                bounds = {"windowState": window_state}
                if width is not None:
                    bounds["width"] = int(width)
                if height is not None:
                    bounds["height"] = int(height)
                await session.send(
                    "Browser.setWindowBounds",
                    {"windowId": window_id, "bounds": bounds},
                )
                logger.info("Dat trang thai cua so Chrome CDP: %s", window_state)
        except Exception as exc:
            logger.debug("Khong toi da hoa duoc cua so Chrome CDP: %s", exc)
        finally:
            if session is not None:
                try:
                    await session.detach()
                except Exception:
                    pass

    async def maximize_window(self) -> None:
        """Expand the browser after authentication, before entering the game."""

        await self._set_cdp_window_bounds(window_state="maximized")

    async def ensure_maximized(self) -> None:
        """Idempotent startup/reconnect maximize hook."""

        await self.maximize_window()

    async def start(self) -> BrowserContext:
        self._playwright = await async_playwright().start()

        if self.cdp_url:
            self.cdp_url = normalize_cdp_url(self.cdp_url)
            # The packaged launcher delegates Chrome startup to this manager.
            # Launch first, then wait for readiness. Waiting for a port before
            # launching Chrome made a cold start spend ~20 seconds doing nothing.
            if not cdp_port_open(self.cdp_url):
                logger.info("Chrome CDP chưa mở — khởi động ngay...")
                await self.ensure_chrome_cdp(wait_sec=12.0)
            urls = [self.cdp_url]
            if "127.0.0.1" in self.cdp_url:
                urls.append(self.cdp_url.replace("127.0.0.1", "localhost"))
            last_err: Exception | None = None
            for attempt in range(1, 9):
                for url in urls:
                    try:
                        self._browser = await self._playwright.chromium.connect_over_cdp(url)
                        if self._browser.contexts:
                            self._context = self._browser.contexts[0]
                        else:
                            self._context = await self._browser.new_context()
                        self._owns_browser = False
                        self.cdp_url = url
                        await self.ensure_maximized()
                        logger.info("Đã kết nối Chrome qua CDP: %s", url)
                        return self._context
                    except Exception as e:
                        last_err = e
                if attempt < 8:
                    logger.debug("CDP chưa nhận kết nối (lần %d/8): %s", attempt, last_err)
                    await asyncio.sleep(0.75)
            logger.warning(
                "Không kết nối được CDP (%s), mở browser mới: %s",
                self.cdp_url,
                last_err,
            )

        self._browser = await self._playwright.chromium.launch(headless=self.headless)
        self._context = await self._browser.new_context()
        self._owns_browser = True
        logger.info("Đã mở browser mới")
        return self._context

    async def _disconnect_quiet(self) -> None:
        browser = self._browser
        self._browser = None
        self._context = None
        if browser is not None:
            try:
                await browser.close()
            except Exception:
                pass
        pw = self._playwright
        self._playwright = None
        if pw is not None:
            try:
                await pw.stop()
            except Exception:
                pass
        self._owns_browser = False

    async def ensure_chrome_cdp(self, wait_sec: float = 20.0) -> bool:
        """Dam bao Chrome dang lang nghe CDP; mo lai neu can."""
        if not self.cdp_url:
            return False
        if cdp_port_open(self.cdp_url):
            return True
        logger.warning("Chrome CDP khong phan hoi — dang mo lai trinh duyet...")
        if not launch_chrome_cdp(self.cdp_url, self.profile_dir):
            return False
        deadline = time.monotonic() + wait_sec
        while time.monotonic() < deadline:
            if cdp_port_open(self.cdp_url):
                logger.info("Chrome CDP da san sang: %s", self.cdp_url)
                return True
            await asyncio.sleep(0.5)
        logger.error("Timeout cho Chrome CDP: %s", self.cdp_url)
        return False

    async def ensure_connected(self, *, force: bool = False) -> BrowserContext:
        """
        Neu Chrome bi tat / CDP mat — mo lai Chrome, ket noi Playwright lai.
        Tra ve BrowserContext moi (goi lai moi lan recover).
        """
        if not force and self.is_connected():
            assert self._context is not None
            return self._context

        logger.warning("=" * 50)
        logger.warning("KHOI PHUC TRINH DUYET — CDP/context da dong")
        logger.warning("=" * 50)

        await self._disconnect_quiet()

        if self.cdp_url:
            if not await self.ensure_chrome_cdp():
                raise RuntimeError(
                    f"Khong mo duoc Chrome CDP ({self.cdp_url}). "
                    "Kiem tra Chrome da cai va port 9222."
                )
            last_err: Exception | None = None
            for attempt in range(1, 12):
                try:
                    self._playwright = await async_playwright().start()
                    self._browser = await self._playwright.chromium.connect_over_cdp(
                        self.cdp_url
                    )
                    if self._browser.contexts:
                        self._context = self._browser.contexts[0]
                    else:
                        self._context = await self._browser.new_context()
                    self._owns_browser = False
                    await self.ensure_maximized()
                    logger.info(
                        "Da ket noi lai Chrome CDP (lan %d): %s",
                        attempt,
                        self.cdp_url,
                    )
                    return self._context
                except Exception as exc:
                    last_err = exc
                    logger.warning(
                        "Ket noi CDP that bai lan %d/11: %s", attempt, exc
                    )
                    await self._disconnect_quiet()
                    await self.ensure_chrome_cdp(wait_sec=8.0)
                    await asyncio.sleep(1.0)
            raise RuntimeError(f"Khong ket noi lai duoc CDP: {last_err}")

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=self.headless)
        self._context = await self._browser.new_context()
        self._owns_browser = True
        logger.info("Da mo lai browser Playwright (khong CDP)")
        return self._context

    async def get_or_open_page(self, url: str) -> Page:
        if not self.is_connected():
            await self.ensure_connected()
        assert self._context is not None
        from src.ae_sexy import is_usable_browser_page_url

        for page in self._context.pages:
            if page.is_closed():
                continue
            try:
                page_url = page.url or ""
            except Exception:
                continue
            if not is_usable_browser_page_url(page_url):
                continue
            if url.rstrip("/") in page_url:
                logger.info("Dung tab hien co: %s", page_url)
                try:
                    await page.bring_to_front()
                except Exception:
                    pass
                return page
        page = await self._context.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        try:
            await page.bring_to_front()
        except Exception:
            pass
        return page

    async def resolve_game_page(self, site_url: str, table_name: str = "") -> Page:
        """Uu tien tab AE SEXY cua SITE dang chon — khong lay tab web kia."""
        if not self.is_connected():
            await self.ensure_connected()
        assert self._context is not None
        from src.ae_sexy import (
            find_ae_sexy_page,
            is_ae_sexy_url,
            is_usable_browser_page_url,
            PHASE_LABEL,
        )
        from src.sites import (
            bind_page_site,
            foreign_shell_page,
            get_active_site,
            resolve_site,
        )

        try:
            active = resolve_site(site_url)
        except Exception:
            active = get_active_site()
        site_id = active.info.id

        best, phase = await find_ae_sexy_page(
            self._context, table_name, site_id=site_id
        )
        if best and phase in ("room", "lobby", "loading"):
            try:
                best_url = best.url or ""
            except Exception:
                best_url = ""
            if is_usable_browser_page_url(best_url) and not foreign_shell_page(best, site_id):
                logger.info(
                    "Dung tab game [%s] (%s): %s",
                    site_id,
                    PHASE_LABEL.get(phase, phase),
                    best_url[:80],
                )
                bind_page_site(best, site_id)
                try:
                    await best.bring_to_front()
                except Exception:
                    pass
                return best
        # AE CDN URL thuoc site dang chon
        for page in self._context.pages:
            if page.is_closed():
                continue
            if foreign_shell_page(page, site_id):
                continue
            try:
                u = page.url or ""
            except Exception:
                continue
            if is_ae_sexy_url(u):
                logger.info("Dung tab AE SEXY [%s]: %s", site_id, u[:80])
                bind_page_site(page, site_id)
                try:
                    await page.bring_to_front()
                except Exception:
                    pass
                return page
        page = await self.get_or_open_page(site_url)
        bind_page_site(page, site_id)
        return page

    async def stop(self):
        if self._owns_browser and self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
        elif self._browser:
            try:
                await self._browser.close()  # CDP: chỉ ngắt kết nối, không đóng Chrome
            except Exception:
                pass
        self._browser = None
        self._context = None
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    def on_websocket(self, handler: Callable):
        """Đăng ký handler cho mọi WebSocket: handler(ws)"""
        assert self._context is not None
        self._context.on("websocket", handler)
