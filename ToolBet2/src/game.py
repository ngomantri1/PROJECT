from __future__ import annotations



import logging

import re



from playwright.async_api import BrowserContext, Frame, Page



from src.hall import lobby_row_position
from src.ongames import lobby_enter_position



logger = logging.getLogger(__name__)



BACCARAT_CLICK_SELECTORS = [

    "text=/VNB\\d+/i",

    "text=/SB\\d+/i",

    "text=/BAC\\d+/i",

    "text=/baccarat/i",

    "text=/百家乐/i",

]





GAME_HOST_MARKERS = ("ongames.info", "usplaynet.com", "mhuxu.com", "mex777.com", "gctpjt77.com", "iconic")


async def close_game_overlay(page: Page) -> bool:
    """An overlay game fullscreen (khong xoa iframe)."""
    hidden = await page.evaluate(
        """() => {
        let n = 0;
        for (const el of document.querySelectorAll('div.fixed')) {
            if (el.querySelector('#iframe_game')) {
                el.style.display = 'none';
                el.style.pointerEvents = 'none';
                n++;
            }
        }
        return n;
    }"""
    )
    if hidden:
        logger.info("Da an overlay game (%d)", hidden)
        await page.wait_for_timeout(500)
    return hidden > 0


async def teardown_game_iframe(page: Page) -> bool:
    """
    Xoa iframe game cu de lay session/token moi (WalletLiveToken).
    Khac close_game_overlay — dat src=about:blank, buoc vao lai tu 'Vao choi'.
    """
    cleared = await page.evaluate(
        """() => {
        let n = 0;
        for (const el of document.querySelectorAll('div.fixed')) {
            if (el.querySelector('#iframe_game')) {
                el.style.display = 'none';
                el.style.pointerEvents = 'none';
                el.style.visibility = 'hidden';
            }
        }
        const iframe = document.getElementById('iframe_game');
        if (iframe) {
            iframe.src = 'about:blank';
            iframe.removeAttribute('src');
            iframe.style.display = 'none';
            iframe.style.visibility = 'hidden';
            n = 1;
        }
        return n;
    }"""
    )
    if cleared:
        logger.info("Da teardown iframe game (xoa token cu)")
        await page.wait_for_timeout(1500)
    return cleared > 0


async def show_game_overlay(page: Page) -> bool:
    """Hien lai overlay game (sau khi da bi close_game_overlay an di)."""
    shown = await page.evaluate(
        """() => {
        let n = 0;
        for (const el of document.querySelectorAll('div.fixed')) {
            if (el.querySelector('#iframe_game')) {
                const style = window.getComputedStyle(el);
                const wasHidden = style.display === 'none' || style.visibility === 'hidden'
                    || parseFloat(style.opacity || '1') < 0.05;
                el.style.display = 'flex';
                el.style.pointerEvents = 'auto';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
                if (wasHidden) n++;
            }
        }
        const iframe = document.getElementById('iframe_game');
        if (iframe) {
            const iStyle = window.getComputedStyle(iframe);
            if (iStyle.display === 'none' || iStyle.visibility === 'hidden') {
                iframe.style.display = 'block';
                iframe.style.visibility = 'visible';
                if (!n) n = 1;
            }
        }
        return n;
    }"""
    )
    if shown:
        logger.info("Da hien overlay game (%d)", shown)
        await page.wait_for_timeout(800)
    return shown > 0


async def ensure_game_overlay_visible(page: Page) -> bool:
    """Dam bao iframe game hien thi — goi sau khi click Vao choi."""
    try:
        await show_game_overlay(page)
        loc = page.locator("#iframe_game")
        if not await loc.count():
            return False
        await loc.scroll_into_view_if_needed(timeout=3000)
        box = await loc.bounding_box()
        return bool(box and box.get("width", 0) > 80 and box.get("height", 0) > 80)
    except Exception as exc:
        message = str(exc or "").lower()
        if "targetclosed" in type(exc).__name__.lower() or "has been closed" in message:
            logger.warning("Bo qua hien overlay — page/context da dong")
            return False
        raise


async def get_game_iframe(page: Page) -> Frame | None:
    for frame in page.frames:
        url = frame.url or ""
        if any(m in url for m in GAME_HOST_MARKERS) and url not in ("about:blank", ""):
            return frame

    loc = page.locator("#iframe_game")
    if await loc.count():
        el = await loc.element_handle()
        if el:
            frame = await el.content_frame()
            if frame and frame.url and frame.url != "about:blank":
                return frame
    return None


def is_game_loaded(page: Page) -> bool:
    for frame in page.frames:
        url = frame.url or ""
        if any(m in url for m in GAME_HOST_MARKERS) and url not in ("about:blank", ""):
            return True
    return False


async def has_game_iframe(page: Page) -> bool:
    loc = page.locator("#iframe_game")
    if not await loc.count():
        return False
    src = await loc.get_attribute("src") or ""
    return bool(src.strip() and src not in ("about:blank", ""))





async def reset_game_iframe(page: Page, *, force: bool = False) -> bool:
    """Reset iframe de kich hoat lai WebSocket (sau khi da gan listener)."""
    if not force and is_game_loaded(page) and await has_game_iframe(page):
        logger.info("Game da mo — bo qua reset iframe (giu ban hien tai)")
        return False

    loc = page.locator("#iframe_game")

    if not await loc.count():

        return False

    src = await loc.get_attribute("src")

    if not src:

        return False

    await page.evaluate("(src) => { const el = document.getElementById('iframe_game'); if(el) el.src = src; }", src)

    logger.info("Da reset iframe game -> kich hoat WebSocket")

    await page.wait_for_timeout(5000)

    return True





async def wait_for_game_iframe(page: Page, timeout_sec: int = 90) -> bool:
    """Cho sanh game ongames.info load (Iconic21/ON LIVE)."""
    for i in range(timeout_sec):
        if any("ongames.info" in (f.url or "") for f in page.frames):
            logger.info("Sanh ongames.info san sang")
            return True
        if i > 0 and i % 15 == 0:
            logger.info("Cho sanh Iconic21/ON LIVE... (%ds)", i)
        await page.wait_for_timeout(1000)
    return is_game_loaded(page)


async def ensure_game_open(page: Page) -> Page:
    """Mo game trong iframe neu chua co."""
    if await has_game_iframe(page) or is_game_loaded(page):
        if "ongames.info" in " ".join(f.url for f in page.frames):
            logger.info("Game iframe san sang (ongames)")
            return page

    try:
        from src.sites import get_active_site

        casino_url = get_active_site().info.casino_url()
    except Exception:
        casino_url = "https://vipbet389.com/casino"

    if casino_url.rstrip("/") not in (page.url or "") and "/casino" not in (page.url or "") and "live.html" not in (page.url or ""):
        await page.goto(casino_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2000)

    if await has_game_iframe(page) and not any("ongames.info" in (f.url or "") for f in page.frames):
        await close_game_overlay(page)



    for sel in [
        "text=/ICONIC21/i",
        "text=/iconic/i",
        "text=/ON LIVE/i",
        "text=/AE SEXY/i",
        "text=/sexy/i",
        "text=/game play/i",
        "img[src*='iconic']",
        "img[src*='game']",
    ]:

        try:

            loc = page.locator(sel).first

            if await loc.is_visible(timeout=2000):

                await loc.click(timeout=5000)

                await page.wait_for_timeout(2000)

                logger.info("Clicked provider: %s", sel)

                break

        except Exception as e:

            logger.debug("Click %s: %s", sel, e)



    for sel in ["text=/chơi ngay/i", "text=/choi ngay/i", "text=/Vào chơi/i", "text=/Vao choi/i"]:

        try:

            loc = page.locator(sel).first

            if await loc.is_visible(timeout=3000):

                await loc.click()

                await page.wait_for_timeout(8000)

                logger.info("Clicked: %s", sel)

                break

        except Exception:

            pass



    for _ in range(15):

        if await has_game_iframe(page) or is_game_loaded(page):

            logger.info("Game loaded")

            return page

        await page.wait_for_timeout(2000)



    logger.warning("Chua mo duoc game iframe")

    return page





async def wait_for_lobby_ready(page: Page, timeout_sec: int = 20) -> bool:

    """Cho lobby canvas load xong."""

    for _ in range(timeout_sec * 2):

        frame = await get_game_iframe(page)

        if frame:

            try:

                loading = await frame.locator("text=/loading/i").count()

                canvas = await frame.locator("canvas").count()

                if canvas > 0 and loading == 0:

                    await page.wait_for_timeout(1500)

                    return True

            except Exception:

                pass

        await page.wait_for_timeout(500)

    return False





async def _click_iframe_relative(page: Page, rel_x: float, rel_y: float) -> bool:

    loc = page.locator("#iframe_game")

    if not await loc.count():

        return False

    box = await loc.bounding_box()

    if not box:

        return False

    x = box["x"] + box["width"] * rel_x

    y = box["y"] + box["height"] * rel_y

    await page.mouse.click(x, y)

    return True





async def enter_hall_room_at_index(page: Page, row_index: int = 0) -> bool:
    """Click vao phong Baccarat thu `row_index` tren lobby (0 = phong dau tien trong sanh)."""
    frame = await get_game_iframe(page)
    if not frame:
        await ensure_game_open(page)
        frame = await get_game_iframe(page)
    if not frame:
        logger.warning("Khong co iframe game")
        return False

    await frame.wait_for_load_state("domcontentloaded", timeout=30000)
    await wait_for_lobby_ready(page)

    rel_x, rel_y = lobby_row_position(row_index)
    if await _click_iframe_relative(page, rel_x, rel_y):
        await page.wait_for_timeout(3500)
        logger.info(
            "Click phong hang %d tai (%.0f%%, %.0f%%)",
            row_index,
            rel_x * 100,
            rel_y * 100,
        )
        return True

    logger.warning("Khong click duoc phong hang %d", row_index)
    return False


async def enter_baccarat_room(page: Page, table_name: str = "") -> bool:

    """Click vao ban Baccarat tren lobby canvas (nut 'Vao Tro choi')."""

    frame = await get_game_iframe(page)

    if not frame:

        await ensure_game_open(page)

        frame = await get_game_iframe(page)



    if not frame:

        logger.warning("Khong co iframe game")

        return False



    await frame.wait_for_load_state("domcontentloaded", timeout=30000)

    await wait_for_lobby_ready(page)



    # Thu click DOM neu co (mot so skin co text)

    if table_name:

        for sel in [f"text=/{re.escape(table_name)}/i", f"text=/{table_name[:3]}/i"]:

            try:

                loc = frame.locator(sel)

                if await loc.count() > 0 and await loc.first.is_visible(timeout=800):

                    await loc.first.click(timeout=3000)

                    await page.wait_for_timeout(2000)

                    logger.info("Vao ban qua DOM: %s", sel)

                    return True

            except Exception as e:

                logger.debug("DOM click %s: %s", sel, e)



        for sel in ["text=/vào trò chơi/i", "text=/vao tro choi/i"]:

            try:

                loc = frame.locator(sel)

                if await loc.count() > 0:

                    await loc.first.click(timeout=3000)

                    await page.wait_for_timeout(2500)

                    logger.info("Vao ban qua nut Vao Tro choi (DOM)")

                    return True

            except Exception:

                pass



    # Canvas lobby: click nut 'Vao Tro choi' theo hang ban

    rel_x, rel_y = lobby_enter_position(table_name)

    if await _click_iframe_relative(page, rel_x, rel_y):

        await page.wait_for_timeout(3500)

        logger.info("Click vao ban %s tai (%.0f%%, %.0f%%)", table_name or "Baccarat", rel_x * 100, rel_y * 100)

        return True



    logger.warning("Khong click duoc vao ban %s", table_name or "?")

    return False





async def wait_for_table_history(state, table_id: str | int = "", timeout_sec: int = 30, *, timeout: int | None = None) -> bool:
    """Cho lich su cua dung ban (theo table_id)."""
    import asyncio

    if timeout is not None:
        timeout_sec = timeout
    want_id = str(table_id or state.table_id or "")
    for _ in range(timeout_sec * 2):
        if want_id and str(state.table_id) == want_id and state.history:
            return True
        if not want_id and state.history:
            return True
        await asyncio.sleep(0.5)
    return False


async def wait_for_table_selection(state, timeout_sec: int = 20, *, timeout: int | None = None) -> bool:
    """Cho WebSocket gui table_list va chon ban."""
    import asyncio

    if timeout is not None:
        timeout_sec = timeout
    for _ in range(timeout_sec * 2):
        if state.table_name and state.table_id:
            return True
        await asyncio.sleep(0.5)
    return False


async def enter_first_baccarat_room(page: Page, table_name: str = "") -> bool:
    if table_name:
        return await enter_baccarat_room(page, table_name)
    return await enter_hall_room_at_index(page, 0)





def find_game_page(context: BrowserContext) -> Page | None:

    for page in context.pages:

        if "/casino" in page.url:

            return page

    return context.pages[0] if context.pages else None


