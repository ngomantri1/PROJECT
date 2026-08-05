from __future__ import annotations

import asyncio
import logging
import re
import time
from contextlib import asynccontextmanager

from playwright.async_api import BrowserContext, Frame, Page

from src.ae_sexy_ws import table_name_to_ids
from src.game import (
    close_game_overlay,
    ensure_game_overlay_visible,
    get_game_iframe,
    has_game_iframe,
    show_game_overlay,
    teardown_game_iframe,
)

logger = logging.getLogger(__name__)

# Tre thao tac de tranh hanh vi bat thuong / web lag
ACTION_PAUSE_MS = 2500
CLICK_PAUSE_MS = 3500
HALL_LOAD_WAIT_MS = 8000
ENTER_RETRY_MAX = 3

PHASE_ROOM = "room"
PHASE_LOBBY = "lobby"
PHASE_LOADING = "loading"
PHASE_WEB = "web"

PHASE_LABEL = {
    PHASE_ROOM: "trong ban",
    PHASE_LOBBY: "sanh AE SEXY",
    PHASE_LOADING: "game dang load",
    PHASE_WEB: "trang web casino",
}

TABLE_CODE_RE = re.compile(r"C(\d+)", re.I)

# Iframe ban choi (webMain hoac singleBacTable)
_ROOM_IFRAME_PAT = "singlebactable|bactable|webmain"

# AE SEXY co the load qua nhieu domain (CDN doi thuong — match webMain/gamehall)
AE_SEXY_HOSTS = (
    "mhuxu.com",
    "usplaynet.com",
    "mex777.com",
    "tgmeq.com",
    "gctpjt77.com",
    "lztkhh66.com",
    "dpbqwn88.com",
    "tscvmv77.com",
    "tscvmw77.com",
    "doarkm88.com",
    "doerkm88.com",
    "docrm88.com",
)


def is_ae_sexy_url(url: str) -> bool:
    """Nhan dien URL AE SEXY ke ca CDN moi (khong can nam trong AE_SEXY_HOSTS)."""
    u = (url or "").lower()
    if not u or u.startswith("about:"):
        return False
    if any(h in u for h in AE_SEXY_HOSTS):
        return True
    if "gamehall.jsp" in u or "webmain.jsp" in u or "singlebactable" in u:
        return True
    if "bactable.jsp" in u:
        return True
    if "/player/" in u and any(k in u for k in ("webmain", "gamehall", "bactable")):
        return True
    return False


def is_usable_browser_page_url(url: str) -> bool:
    """Tab that that duoc dung cho login/sanh/ban — loai about:blank / chrome://."""
    u = (url or "").strip().lower()
    if not u or u in ("about:blank", "about:srcdoc"):
        return False
    if u.startswith(("chrome://", "chrome-error://", "devtools://", "edge://", "data:", "blob:")):
        return False
    return u.startswith("http://") or u.startswith("https://")


def _web_page_preference_score(url: str) -> int:
    """Uu tien tab provider AE SEXY (webMain) hon shell casino."""
    from src.sites import allowed_hosts

    u = (url or "").lower()
    score = 0
    if is_ae_sexy_url(u):
        score += 100
    if "webmain" in u:
        score += 40
    if "gamehall" in u or "bactable" in u or "singlebactable" in u:
        score += 30
    if "/casino" in u or "#/live" in u or "tabname=live" in u:
        score += 10
    # Shell 222b provider list — thap hon popup AE
    if "/home/live" in u:
        score += 2
    elif "/home/" in u:
        score += 1
    for h in allowed_hosts():
        host = (h or "").lower().lstrip(".")
        if host.startswith("www."):
            host = host[4:]
        if host and host in u:
            score += 2
            break
    return score


DEFAULT_TABLE_NAME = "Baccarat C01"


def _table_codes_match(wanted: str, detected: str) -> bool:
    if not wanted or not detected:
        return False
    mw = TABLE_CODE_RE.search(wanted)
    md = TABLE_CODE_RE.search(detected)
    if mw and md:
        try:
            return int(mw.group(1)) == int(md.group(1))
        except ValueError:
            return mw.group(1) == md.group(1)
    return wanted.upper() in detected.upper()


def _sort_tables(names: list[str]) -> list[str]:
    def key(name: str) -> int:
        m = TABLE_CODE_RE.search(name)
        return int(m.group(1)) if m else 9999

    return sorted(names, key=key)


def normalize_baccarat_table_name(name: str) -> str:
    raw = (name or "").strip()
    if not raw:
        return DEFAULT_TABLE_NAME
    m = TABLE_CODE_RE.search(raw)
    if not m:
        return raw if raw.lower().startswith("baccarat") else raw
    # AE SEXY luon hien C01..C09 (2 chu so) — tranh mismatch C5 vs C05
    try:
        code = f"C{int(m.group(1)):02d}"
    except ValueError:
        code = m.group(0).upper()
    return f"Baccarat {code}"


def table_code_from_name(name: str) -> str:
    m = TABLE_CODE_RE.search(name or "")
    if not m:
        return ""
    try:
        return f"C{int(m.group(1)):02d}"
    except ValueError:
        return m.group(0).upper()


def lobby_table_candidates(
    wanted: str,
    available: list[str] | None = None,
) -> list[tuple[str, str]]:
    """Thu tu vao ban: muc tieu -> C02 (neu C01) -> cac ban con lai tren sanh."""
    available_sorted = _sort_tables(list(available or []))
    by_code = {table_code_from_name(t): t for t in available_sorted if table_code_from_name(t)}

    wanted_norm = normalize_baccarat_table_name(wanted)
    primary = table_code_from_name(wanted_norm) or "C01"

    out: list[tuple[str, str]] = []
    seen: set[str] = set()

    def push(name: str, reason: str) -> None:
        n = normalize_baccarat_table_name(name)
        if n not in seen:
            seen.add(n)
            out.append((n, reason))

    if primary in by_code:
        push(by_code[primary], "preferred")
    elif not available_sorted:
        push(wanted_norm, "preferred_blind")

    if primary == "C01" and "C02" in by_code:
        push(by_code["C02"], "fallback_c02")

    for t in available_sorted:
        push(t, "fallback_first")

    if not out:
        push(wanted_norm or DEFAULT_TABLE_NAME, "default")
    return out


def describe_table_pick(reason: str) -> str:
    labels = {
        "preferred": "ban muc tieu",
        "preferred_blind": "ban muc tieu (khong doc duoc sanh)",
        "fallback_c02": "C01 khong co / bao tri — thu C02",
        "fallback_first": "ban dau tien tren sanh",
        "detected_room": "phat hien ban thuc te tu DOM",
    }
    return labels.get(reason, reason)


async def _iframe_visibility(page: Page) -> dict:
    """Kiem tra iframe game co hien thi (vipbet #iframe_game / provider #iframeGame|#iframeGameHall)."""
    try:
        return await page.evaluate(
            """() => {
            const score = (iframe) => {
              if (!iframe) return null;
              const rect = iframe.getBoundingClientRect();
              const style = window.getComputedStyle(iframe);
              const parent = iframe.closest('div.fixed');
              const parentStyle = parent ? window.getComputedStyle(parent) : null;
              const hidden = style.display === 'none' || style.visibility === 'hidden'
                  || parseFloat(style.opacity || '1') < 0.05
                  || (parentStyle && (parentStyle.display === 'none' || parentStyle.visibility === 'hidden'));
              const visible = !hidden && rect.width > 80 && rect.height > 80;
              return {
                visible,
                src: iframe.src || '',
                w: rect.width,
                h: rect.height,
                id: iframe.id || '',
                area: Math.max(0, rect.width) * Math.max(0, rect.height),
              };
            };
            const cands = [];
            for (const id of ['iframe_game', 'iframeGame', 'iframeGameHall']) {
              const el = document.getElementById(id);
              if (el) cands.push(el);
            }
            for (const f of document.querySelectorAll('iframe')) {
              if (/gamehall|webmain|singlebactable|bactable/i.test(f.src || '')) cands.push(f);
            }
            let best = null;
            for (const el of cands) {
              const s = score(el);
              if (!s) continue;
              if (!best) { best = s; continue; }
              // Uu tien iframe dang visible + dien tich lon (phong > sanh an)
              if (s.visible && !best.visible) { best = s; continue; }
              if (s.visible === best.visible && s.area > best.area) best = s;
            }
            if (!best) return { visible: false, src: '', w: 0, h: 0 };
            return { visible: best.visible, src: best.src, w: best.w, h: best.h, id: best.id };
        }"""
        )
    except Exception:
        return {"visible": False, "src": "", "w": 0, "h": 0}


async def detect_ae_sexy_phase(page: Page, table_name: str = "", collector=None) -> str:
    """web | loading | lobby | room — derive tu probe_game_state (SSOT)."""
    # Trang shell home (222b /home/, vipbet trang chu) — khong probe AE SEXY (treo)
    try:
        url = (page.url or "").lower()
    except Exception:
        url = ""
    on_ae = bool(url and is_ae_sexy_url(url))
    on_casino_shell = bool(
        url
        and any(x in url for x in ("/casino", "live.html", "webmain", "gamehall", "bactable"))
    )
    # vipbet keeps the live casino iframe on its root SPA URL after the room
    # has opened.  The URL alone therefore cannot prove that the player has
    # left the room; allow the shell/room probes to decide first.
    root_can_host_game = False
    try:
        from src.sites import resolve_site_from_page

        site = resolve_site_from_page(page)
        root_can_host_game = bool(
            site is not None and site.info.shell_mode == "casino_iframe"
        )
    except Exception:
        pass
    if url and is_usable_browser_page_url(url):
        if not on_ae and not on_casino_shell and not root_can_host_game:
            return PHASE_WEB

    # FAST PATH: shell_mode (nhanh) — tranh probe nang treo → nham WEB
    try:
        mode = await asyncio.wait_for(_get_shell_mode(page), timeout=2.5)
        if mode == "lobby":
            return PHASE_LOBBY
        if mode == "room":
            return PHASE_ROOM
        if mode == "loading":
            return PHASE_LOADING
    except Exception:
        pass

    from src.ae_sexy_state import probe_to_phase

    try:
        probe = await asyncio.wait_for(
            probe_game_state(page, table_name, collector), timeout=8.0
        )
    except Exception:
        # Timeout / loi probe — AE URL = loading, KHONG bao gio WEB
        if on_ae or on_casino_shell:
            return PHASE_LOADING
        return PHASE_LOADING
    return probe_to_phase(probe)


async def find_ae_sexy_page(
    context: BrowserContext,
    table_name: str = "",
    *,
    site_id: str | None = None,
) -> tuple[Page | None, str]:
    """Tim tab tot nhat cua SITE dang chon — khong lay shell/web cua web kia."""
    from src.sites import foreign_shell_page, get_active_site, page_site_id

    active = (site_id or get_active_site().info.id).strip().lower()
    rank = {PHASE_ROOM: 4, PHASE_LOBBY: 3, PHASE_LOADING: 2, PHASE_WEB: 1}
    best_page: Page | None = None
    best_phase = PHASE_WEB
    best_rank = 0
    best_score = -1
    for page in context.pages:
        if page.is_closed():
            continue
        try:
            url = page.url or ""
        except Exception:
            continue
        if not is_usable_browser_page_url(url):
            continue
        # Tab shell web KHAC — bo qua
        if foreign_shell_page(page, active):
            continue
        bound = page_site_id(page)
        if bound and bound != active:
            continue
        # Shell home — khong probe AE (tranh treo)
        if not is_ae_sexy_url(url) and not any(
            x in url.lower()
            for x in (
                "/casino",
                "live.html",
                "webmain",
                "gamehall",
                "bactable",
                "#/live",
                "tabname=live",
            )
        ):
            phase = PHASE_WEB
            r = 1
            score = _web_page_preference_score(url)
            try:
                from src.sites import get_site

                site = get_site(active)
                if any(h.lower().replace("www.", "") in url.lower() for h in site.info.hosts):
                    score += 20
            except Exception:
                pass
            if r > best_rank or (r == best_rank and score > best_score):
                best_rank = r
                best_page = page
                best_phase = phase
                best_score = score
            continue
        try:
            phase = await asyncio.wait_for(
                detect_ae_sexy_phase(page, table_name), timeout=8.0
            )
        except Exception:
            phase = PHASE_LOADING if is_ae_sexy_url(url) else PHASE_WEB
        r = rank.get(phase, 0)
        score = _web_page_preference_score(url)
        if is_ae_sexy_url(url):
            score += 50
            if bound == active:
                score += 30
        if r > best_rank or (r == best_rank and score > best_score):
            best_rank = r
            best_page = page
            best_phase = phase
            best_score = score
        elif r == best_rank and r > 0 and score == best_score and best_page is not None:
            try:
                if is_ae_sexy_url(url) and not is_ae_sexy_url(best_page.url):
                    best_page = page
                    best_phase = phase
            except Exception:
                pass
    return best_page, best_phase


async def switch_to_ae_sexy_page(page: Page, table_name: str = "") -> Page:
    """Chuyen sang tab AE SEXY (provider/casino) — KHONG bao gio nhay sang about:blank."""
    try:
        ctx = page.context
    except Exception:
        return page
    best, phase = await find_ae_sexy_page(ctx, table_name)
    if not best or best.is_closed():
        return page
    try:
        best_url = best.url or ""
    except Exception:
        return page
    if not is_usable_browser_page_url(best_url):
        return page
    if best is page:
        return page
    # Dang o tab http hop le: chi chuyen khi tab kia tot hon (room/lobby/loading
    # hoac cung WEB nhung diem cao hon — tranh nhay ve tab login/blank).
    try:
        cur_url = page.url or ""
    except Exception:
        cur_url = ""
    if is_usable_browser_page_url(cur_url):
        rank = {PHASE_ROOM: 4, PHASE_LOBBY: 3, PHASE_LOADING: 2, PHASE_WEB: 1}
        cur_phase = await detect_ae_sexy_phase(page, table_name)
        cur_r = rank.get(cur_phase, 0)
        best_r = rank.get(phase, 0)
        if best_r < cur_r:
            return page
        if best_r == cur_r and _web_page_preference_score(best_url) <= _web_page_preference_score(
            cur_url
        ):
            return page
    try:
        await best.bring_to_front()
    except Exception:
        pass
    logger.info(
        "Chuyen sang tab AE SEXY (%s): %s",
        PHASE_LABEL.get(phase, phase),
        best_url[:90],
    )
    return best


async def ensure_lobby_ready(page: Page, timeout_sec: int = 30, table_name: str = "") -> bool:
    """Da trong game — chi hien iframe va cho sanh, khong quay ve web."""
    page = await switch_to_ae_sexy_page(page, table_name)
    if await is_game_session_expired(page):
        if not await recover_ae_sexy_session_expired(page, table_name):
            return False
        page = await switch_to_ae_sexy_page(page, table_name)
    if await dismiss_ae_sexy_welcome_back(page):
        await page.wait_for_timeout(3000)
    await ensure_game_overlay_visible(page)
    await _dismiss_ae_sexy_connection_dialogs(page)
    # Hall an (iframeGame che) — bat sanh truoc khi coi la ready
    if not await _gamehall_iframe_visible(page) and not await is_ae_sexy_lobby(page):
        await go_ae_sexy_lobby(page)
        await page.wait_for_timeout(1000)
    if await is_ae_sexy_lobby(page) or await _gamehall_iframe_visible(page):
        return True
    return await wait_for_ae_sexy_lobby(page, timeout_sec=timeout_sec, table_name=table_name)


async def _game_launched(page: Page) -> bool:
    """Game da khoi chay (iframe co src, URL provider, hoac frame AE SEXY).

    KHONG goi is_casino_fatal_error / _list_tables — tranh vong lap treo.
    """
    try:
        if is_ae_sexy_url(page.url or ""):
            return True
    except Exception:
        pass
    for frame in page.frames:
        try:
            url = (frame.url or "").lower()
        except Exception:
            continue
        if is_ae_sexy_url(url) or "gamehall.jsp" in url or "webmain" in url:
            return True
    try:
        vis = await _iframe_visibility(page)
    except Exception:
        vis = {}
    src = vis.get("src") or ""
    if src and src not in ("about:blank", ""):
        return True
    if vis.get("w", 0) > 100 or vis.get("h", 0) > 100:
        return True
    # Sanh AE SEXY render bang the ban (Truyen thong + Baccarat Cxx)
    try:
        if await page.evaluate(
            """() => {
              const t = document.body?.innerText || '';
              const hasTables = (t.match(/Baccarat\\s*C\\d+/gi) || []).length >= 2;
              const hasLobby = /Truyền thống|Truyen thong|Traditional/i.test(t);
              return hasTables && hasLobby;
            }"""
        ):
            return True
    except Exception:
        pass
    try:
        return await has_game_iframe(page)
    except Exception:
        return False


async def is_ae_sexy_promo_visible(page: Page) -> bool:
    """Trang casino con banner AE SEXY + nut 'Vao choi' (chua vao sanh)."""
    if await _game_launched(page):
        return False
    try:
        return bool(
            await page.evaluate(
                """() => {
                const iframe = document.getElementById('iframe_game');
                if (iframe && iframe.src && iframe.src !== 'about:blank') return false;
                const btn = [...document.querySelectorAll('span,a,button,div')].find(
                    el => ['Vào chơi', 'Vao choi'].includes((el.textContent || '').trim())
                );
                if (!btn) return false;
                const rect = btn.getBoundingClientRect();
                if (rect.width < 20 || rect.height < 10) return false;
                const ae = [...document.querySelectorAll('span,div,h1,h2,h3')].find(
                    el => (el.textContent || '').trim() === 'AE SEXY'
                );
                return !!ae;
            }"""
            )
        )
    except Exception:
        return False


async def is_game_iframe_visible(page: Page) -> bool:
    if await _game_launched(page):
        vis = await _iframe_visibility(page)
        if vis.get("visible"):
            return True
        await ensure_game_overlay_visible(page)
        vis = await _iframe_visibility(page)
        return bool(vis.get("visible")) or bool(vis.get("src") and vis.get("src") != "about:blank")
    return False


def _shell_iframe_js(body: str) -> str:
    """Chay JS tren shell frame (webMain) — thao tac iframe con."""
    return f"""(...args) => {{
  {body}
}}"""


_SHELL_VISIBLE_MODE_BODY = """
  const list = [...document.querySelectorAll('iframe')];
  const cssVis = (f) => {
    const s = getComputedStyle(f);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || '1') > 0.05;
  };
  const vis = (f) => {
    const r = f.getBoundingClientRect();
    return cssVis(f) && r.width > 120 && r.height > 120;
  };
  const src = (f) => (f.src || '').toLowerCase();
  const area = (f) => {
    const r = f.getBoundingClientRect();
    return r.width * r.height;
  };
  const tableNames = (doc) => {
    if (!doc) return [];
    const found = [];
    for (const el of doc.querySelectorAll('div.cursor-pointer, div, span, h3, h4')) {
      const t = (el.textContent || '').trim();
      if (/^Baccarat\\s+C\\d{1,3}$/i.test(t)) found.push(t);
      if (found.length >= 40) break;
    }
    return [...new Set(found)];
  };
  const hasChip = (doc) => doc && !!(
    doc.getElementById('chipBoxPlayer')
    || doc.getElementById('chipBoxBanker')
    || doc.querySelector('#chips .chips3d')
  );
  const hasBet = (doc) => doc && /Đặt cược|Place your bet|Sắp bắt đầu đặt/i.test(doc.body?.innerText || '');
  // Tranh chip ghost tren iframe 0x0 sau khi bi day ve sanh
  const thisFrameVisible = () => {
    try {
      const fe = window.frameElement;
      if (fe) {
        const r = fe.getBoundingClientRect();
        return cssVis(fe) && r.width > 120 && r.height > 120;
      }
    } catch (_) {}
    return window.innerWidth > 200 && window.innerHeight > 150;
  };
  const visible = list.filter(vis);

  // 1) BAN: chip tren iframe HIEN (co kich thuoc)
  let best = null, bestScore = -1;
  for (const f of visible) {
    if (!/singlebactable|bactable|webmain/.test(src(f))) continue;
    if (/gamehall/.test(src(f))) continue;
    const doc = f.contentDocument;
    if (!doc || !hasChip(doc)) continue;
    const names = tableNames(doc);
    if (names.length >= 3) continue;
    let score = area(f);
    if (hasBet(doc)) score += 100000;
    if (names.length <= 1) score += 200000;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  if (best) return { mode: 'room', src: src(best), via: 'visible-chip-iframe' };

  // 2) Chip tren document nay CHI khi frame dang hien
  if (hasChip(document) && thisFrameVisible()) {
    const names = tableNames(document);
    if (names.length <= 2) return { mode: 'room', src: location.href || '', via: 'self-chip' };
  }

  // 3) SANH: gamehall HIEN + nhieu the
  let hall = null, hallArea = 0;
  for (const f of visible) {
    if (!/gamehall/.test(src(f))) continue;
    const a = area(f);
    if (a > hallArea) { hallArea = a; hall = f; }
  }
  if (hall) {
    const doc = hall.contentDocument;
    if (hasChip(doc) && tableNames(doc).length <= 2) {
      return { mode: 'room', src: src(hall), via: 'hall-chips' };
    }
    const names = tableNames(doc);
    if (names.length >= 2) return { mode: 'lobby', src: src(hall), tables: names.length };
    return { mode: 'lobby', src: src(hall) };
  }

  // 3b) Provider webMain: luoi nhieu the ban tren document (khong iframe gamehall)
  {
    const selfNames = tableNames(document);
    if (selfNames.length >= 3 && thisFrameVisible()) {
      return { mode: 'lobby', src: location.href || '', via: 'self-lobby-grid', tables: selfNames.length };
    }
  }

  for (const f of visible) {
    if (!/webmain|singlebactable|bactable/.test(src(f)) || /gamehall/.test(src(f))) continue;
    if (area(f) > 120000) return { mode: 'loading', src: src(f) };
  }
  if (!visible.length) return { mode: 'none' };
  return { mode: 'unknown', src: src(visible[0]) };
"""


async def _count_lobby_table_titles(page: Page) -> int:
    """Dem so THE BAN SANH dang HIEN (khong dem text an trong DOM/hall an khi dang trong ban).

    Truoc day dem body.innerText → trong ban van thay 19 chu 'Baccarat Cxx' tu hall an → nham sanh.
    """
    js = """() => {
      const found = new Set();
      const cssVis = (el) => {
        if (!el) return false;
        const s = getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0.05;
      };
      const collectInDoc = (doc) => {
        if (!doc) return;
        const nodes = doc.querySelectorAll(
          'div.cursor-pointer, div[class*="cursor-pointer"], [class*="tableCard"], [class*="table-card"]'
        );
        for (const el of nodes) {
          if (!cssVis(el)) continue;
          const r = el.getBoundingClientRect();
          // The sanh: khoang 100-520 x 70-320, nam trong viewport
          if (r.width < 100 || r.height < 70) continue;
          if (r.width > 520 || r.height > 320) continue;
          if (r.bottom < 40 || r.top > (doc.defaultView?.innerHeight || innerHeight) - 40) continue;
          const t = el.textContent || '';
          const names = t.match(/Baccarat\\s*C\\d{1,3}/gi) || [];
          // The ban that: 1 ten; bo node cha gom nhieu the
          if (names.length !== 1) continue;
          const mm = names[0].match(/C(\\d{1,3})/i);
          if (mm) found.add('C' + String(parseInt(mm[1], 10)));
        }
      };
      collectInDoc(document);
      for (const f of document.querySelectorAll('iframe')) {
        try {
          const r = f.getBoundingClientRect();
          const s = getComputedStyle(f);
          if (!cssVis(f) || r.width < 120 || r.height < 120) continue;
          // Bo qua iframe ban (singleBac) — chi dem gamehall / webMain sanh
          const src = (f.src || '').toLowerCase();
          if (/singlebactable|bactable\\.jsp/.test(src) && !/gamehall/.test(src)) continue;
          collectInDoc(f.contentDocument);
        } catch (_) {}
      }
      return found.size;
    }"""
    try:
        n = await page.evaluate(js)
        return int(n or 0)
    except Exception:
        pass
    for frame in await _game_shell_frames(page):
        try:
            n = await frame.evaluate(js)
            if int(n or 0) >= 2:
                return int(n or 0)
        except Exception:
            continue
    return 0


async def _lobby_grid_visible(page: Page) -> bool:
    """Sanh co luoi nhieu the ban HIEN — ke ca webMain provider."""
    # Dang trong ban (chip/zone) → KHONG phai sanh (hall an van con text Cxx)
    if await _has_visible_room_bet_ui(page):
        # Chi coi sanh neu gamehall dang de len tren chip
        if not await _gamehall_iframe_visible(page):
            return False
    n = await _count_lobby_table_titles(page)
    if n >= 3:
        return True
    try:
        mode = await asyncio.wait_for(_get_shell_mode(page), timeout=2.5)
        if mode == "lobby":
            return True
        if mode == "room":
            return False
    except Exception:
        pass
    if await _gamehall_iframe_visible(page):
        n2 = await _count_lobby_table_titles(page)
        return n2 >= 2
    return False


async def _get_shell_mode(page: Page) -> str:
    """lobby | room | loading | none | unknown — chon frame tot nhat, bo qua 'none'."""
    # Chip/cuoc hien → room TRUOC (tranh dem hall an → nham lobby khi dang choi)
    if await _has_visible_room_bet_ui(page):
        if await _gamehall_iframe_visible(page):
            # Hall de len — dang o sanh
            n = await _count_lobby_table_titles(page)
            if n >= 3:
                return "lobby"
        return "room"
    # Provider webMain: dem THE HIEN (khong dem text an)
    try:
        if is_ae_sexy_url(page.url or ""):
            n_titles = await _count_lobby_table_titles(page)
            if n_titles >= 3:
                return "lobby"
    except Exception:
        pass
    # Provider: #iframeGame che sanh → room/loading, KHONG lobby
    try:
        layout = await page.evaluate(
            """() => {
              const hall = document.getElementById('iframeGameHall');
              const game = document.getElementById('iframeGame');
              const vis = (el) => {
                if (!el) return false;
                const s = getComputedStyle(el);
                const r = el.getBoundingClientRect();
                return s.visibility !== 'hidden' && s.display !== 'none'
                  && Number(s.opacity || 1) > 0.05 && r.width > 120 && r.height > 120;
              };
              const hallV = vis(hall);
              const gameV = vis(game);
              if (gameV && !hallV) return 'game';
              if (hallV && !gameV) return 'hall';
              if (gameV && hallV) return 'both';
              return 'none';
            }"""
        )
        if layout == "game":
            return "room"
        if layout == "hall":
            return "lobby"
    except Exception:
        pass
    fn = _shell_iframe_js(_SHELL_VISIBLE_MODE_BODY)
    # room > loading > lobby: dang vao ban (loading) uu tien hon ghost lobby
    rank = {"room": 4, "loading": 3, "lobby": 2, "unknown": 1, "none": 0}
    best = "none"
    best_r = -1
    for frame in await _game_shell_frames(page):
        try:
            info = await frame.evaluate(fn)
        except Exception:
            continue
        if not info or not info.get("mode"):
            continue
        mode = str(info["mode"])
        if mode == "none":
            continue
        # Lobby chi chap nhan khi gamehall THUC SU hien
        if mode == "lobby":
            try:
                if not await _gamehall_iframe_visible(page):
                    continue
            except Exception:
                continue
        r = rank.get(mode, 0)
        if r > best_r:
            best_r = r
            best = mode
    if best != "none":
        return best
    # Provider tab webMain: sanh = nhieu the HIEN tren document
    try:
        if is_ae_sexy_url(page.url or ""):
            n = await _count_lobby_table_titles(page)
            if n >= 3:
                return "lobby"
            if n == 1 and await _has_visible_room_bet_ui(page):
                return "room"
            if not await _gamehall_iframe_visible(page):
                return "room" if await _has_visible_room_bet_ui(page) else "loading"
            if n == 1:
                return "room"
    except Exception:
        pass
    return "none"


def _wrap_nested_js(body: str, iframe_pat: str = "gamehall") -> str:
    """Chay JS trong iframe con (gamehall/ban) qua shell frame cung origin."""
    return f"""(...args) => {{
  const __shellDoc = document;
  const pick = () => {{
    const list = [...__shellDoc.querySelectorAll('iframe')];
    const big = (f) => f.clientWidth > 80 && f.clientHeight > 80;
    const vis = (f) => {{
      const r = f.getBoundingClientRect();
      return r.width > 120 && r.height > 120;
    }};
    const s = (f) => (f.src || '').toLowerCase();
    const hasBetUI = (doc) => doc && (doc.getElementById('chipBoxPlayer') || doc.querySelector('#chips .chips3d'));
    const pat = /{iframe_pat}/i;
    const isHallPat = /^(gamehall)$/i.test('{iframe_pat}');

    // Sanh: uu tien gamehall DANG HIEN — khong lay iframe ban an
    if (isHallPat) {{
      let hit = list.find(f => vis(f) && /gamehall/.test(s(f)));
      if (hit) return hit;
      hit = list.find(f => big(f) && /gamehall/.test(s(f)));
      if (hit) return hit;
      return list.find(f => /gamehall/.test(s(f))) || null;
    }}

    // Ban: iframe room DANG HIEN + chip
    let hit = list.find(f => vis(f) && /singlebactable|bactable|webmain/.test(s(f)) && hasBetUI(f.contentDocument));
    if (hit) return hit;
    hit = list.find(f => vis(f) && /singlebactable|bactable|webmain/.test(s(f)));
    if (hit) return hit;
    hit = list.find(f => vis(f) && pat.test(s(f)));
    if (hit) return hit;
    hit = list.find(f => vis(f) && hasBetUI(f.contentDocument));
    if (hit) return hit;
    hit = list.find(f => big(f) && pat.test(s(f)));
    return hit || list.find(f => pat.test(s(f))) || null;
  }};
  const iframe = pick();
  const __hallDoc = iframe?.contentDocument;
  if (!__hallDoc) return null;
  const __run = (document, window) => {{
    {body}
  }};
  return __run(__hallDoc, __hallDoc.defaultView || __shellDoc.defaultView);
}}"""


async def _game_shell_frames(page: Page) -> list[Frame]:
    """Frame vo game AE (webMain) — chua iframe gamehall/ban ben trong."""
    shells: list[Frame] = []
    seen: set[int] = set()
    for frame in page.frames:
        try:
            href = (await frame.evaluate("() => location.href")) or ""
        except Exception:
            continue
        low = href.lower()
        if is_ae_sexy_url(href) or "webmain" in low:
            if id(frame) not in seen:
                seen.add(id(frame))
                shells.append(frame)
    return shells


async def _outer_nav_shell_frames(page: Page) -> list[Frame]:
    """Frame shell ngoai (webMain) — co iframe gamehall + webMain con. Dung cho click/nav."""
    hits: list[Frame] = []
    for frame in page.frames:
        try:
            ok = await frame.evaluate(
                """() => {
                const list = [...document.querySelectorAll('iframe')];
                return list.some(f => /gamehall/i.test(f.src || ''))
                    && list.some(f => /webmain/i.test(f.src || ''));
            }"""
            )
            if ok:
                hits.append(frame)
        except Exception:
            continue
    if hits:
        return hits
    shells = await _game_shell_frames(page)
    if shells:
        return shells[:1]
    if len(page.frames) > 1:
        return [page.frames[1]]
    return []


async def _gamehall_playwright_frame(page: Page) -> Frame | None:
    for frame in page.frames:
        if "gamehall.jsp" in (frame.url or "").lower():
            return frame
    return None


async def _gamehall_frame_locator(page: Page):
    """frame_locator khi gamehall khong xuat hien trong page.frames (nested iframe)."""
    for shell in await _outer_nav_shell_frames(page):
        try:
            fl = shell.frame_locator('iframe[src*="gamehall"]')
            if await fl.locator("body").count():
                return fl
        except Exception:
            continue
    return page.frame_locator('#iframe_game iframe[src*="gamehall"]')


_SCROLL_LOBBY_TO_TABLE_BODY = """
  const tableName = args[0];
  const m = String(tableName || '').match(/C(\\d{1,3})/i);
  if (!m) return { err: 'bad_name' };
  const num = String(parseInt(m[1], 10));
  const nameRe = new RegExp('Baccarat\\\\s*C0*' + num + '(?!\\\\d)', 'i');
  const hall = document.getElementById('iframeGameHall')
    || [...document.querySelectorAll('iframe')].find(f => /gamehall/i.test(f.src || ''));
  if (hall) {
    const hs = getComputedStyle(hall);
    if (hs.visibility === 'hidden' || hs.display === 'none') {
      return { err: 'hall_hidden' };
    }
  }
  const doc = hall?.contentDocument;
  if (!doc) return { err: 'no_hall_doc' };
  const findCard = () => {
    let best = null, bestScore = -1;
    for (const el of doc.querySelectorAll('div.cursor-pointer, div[class*="cursor-pointer"]')) {
      if (el.closest('#toolbet-ui-v2')) continue;
      const t = el.textContent || '';
      if (!nameRe.test(t)) continue;
      const names = t.match(/Baccarat\\s*C\\d+/gi) || [];
      if (names.length > 2) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 70) continue;
      if (r.width > 450 || r.height > 280) continue;
      const cls = String(el.className || '');
      let score = r.width * r.height;
      if (/cursor-pointer/i.test(cls)) score += 100000;
      if (r.width >= 240 && r.height >= 130) score += 50000;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  };
  const scrollers = [
    ...doc.querySelectorAll('.vue-recycle-scroller, [class*="recycle-scroller"], [class*="scroller"]')
  ].filter(el => !el.closest('#toolbet-ui-v2') && (el.scrollHeight > el.clientHeight + 30 || el.scrollWidth > el.clientWidth + 30));
  if (!scrollers.length) {
    for (const el of doc.querySelectorAll('*')) {
      if (el.closest('#toolbet-ui-v2')) continue;
      const s = doc.defaultView.getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflowX === 'auto' || s.overflowX === 'scroll')
        && (el.scrollHeight > el.clientHeight + 60 || el.scrollWidth > el.clientWidth + 60))
        scrollers.push(el);
    }
  }
  if (!scrollers.length) scrollers.push(doc.documentElement);
  let moved = 0;
  for (const sc of scrollers) {
    const stepY = Math.max(140, Math.floor((sc.clientHeight || 400) * 0.55));
    const stepX = Math.max(160, Math.floor((sc.clientWidth || 600) * 0.45));
    const maxY = Math.max(sc.scrollHeight || 0, 800);
    const maxX = Math.max(sc.scrollWidth || 0, sc.clientWidth || 0);
    for (let y = 0; y <= maxY + stepY; y += stepY) {
      for (let x = 0; x <= maxX + stepX; x += stepX) {
        try { sc.scrollTop = y; sc.scrollLeft = x; moved++; } catch (e) {}
        const card = findCard();
        if (card) {
          card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          const r = card.getBoundingClientRect();
          return { ok: true, moved, w: r.width, h: r.height };
        }
      }
    }
    try { sc.scrollTop = 0; sc.scrollLeft = 0; } catch (e) {}
  }
  const card = findCard();
  if (!card) return { err: 'no_card_after_scroll', moved };
  card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  const r = card.getBoundingClientRect();
  return { ok: true, moved, w: r.width, h: r.height };
"""


async def scroll_lobby_to_table(page: Page, table_name: str) -> bool:
    """Scroll sanh den khi the ban hien trong DOM (lazy load / vue-recycle-scroller)."""
    if not await _gamehall_iframe_visible(page) and not await _lobby_grid_visible(page):
        await go_ae_sexy_lobby(page)
    fn = _shell_iframe_js(_SCROLL_LOBBY_TO_TABLE_BODY)
    for frame in await _outer_nav_shell_frames(page):
        try:
            res = await frame.evaluate(fn, table_name)
            if res and res.get("ok"):
                logger.debug(
                    "Scroll den ban %s (moved=%s, %dx%d)",
                    table_name,
                    res.get("moved"),
                    int(res.get("w") or 0),
                    int(res.get("h") or 0),
                )
                await page.wait_for_timeout(400)
                return True
            if res and res.get("err") == "hall_hidden":
                await go_ae_sexy_lobby(page)
                continue
            if res and res.get("err") == "no_card_after_scroll":
                logger.debug("Scroll sanh chua thay the ban %s (moved=%s)", table_name, res.get("moved"))
        except Exception as exc:
            logger.debug("Scroll den ban %s: %s", table_name, exc)
    # Provider tab: scroll tren document (gamehall cross-origin)
    try:
        res = await page.evaluate(
            """(tableName) => {
              const m = String(tableName || '').match(/C(\\d{1,3})/i);
              if (!m) return { err: 'bad_name' };
              const fullName = 'Baccarat C' + m[1];
              const doc = document;
              const findCard = () => {
                let best = null, bestScore = -1;
                for (const el of doc.querySelectorAll('div.cursor-pointer, div[class*="cursor-pointer"], *')) {
                  if (el.closest('#toolbet-ui-v2')) continue;
                  const t = el.textContent || '';
                  if (!t.includes(fullName)) continue;
                  const names = t.match(/Baccarat C\\d+/g) || [];
                  if (names.length > 2) continue;
                  const r = el.getBoundingClientRect();
                  if (r.width < 80 || r.height < 60) continue;
                  if (r.width > 520 || r.height > 320) continue;
                  const cls = String(el.className || '');
                  let score = r.width * r.height;
                  if (/cursor-pointer/i.test(cls)) score += 100000;
                  if (score > bestScore) { bestScore = score; best = el; }
                }
                return best;
              };
              const scrollers = [
                ...doc.querySelectorAll('.vue-recycle-scroller, [class*="recycle-scroller"], [class*="scroller"]')
              ].filter(el => !el.closest('#toolbet-ui-v2') && el.scrollHeight > el.clientHeight + 30);
              if (!scrollers.length) scrollers.push(doc.documentElement, doc.body);
              let moved = 0;
              for (const sc of scrollers) {
                if (!sc) continue;
                const step = Math.max(140, Math.floor((sc.clientHeight || 400) * 0.55));
                const maxY = Math.max(sc.scrollHeight || 0, 1200);
                for (let y = 0; y <= maxY + step; y += step) {
                  try { sc.scrollTop = y; moved++; } catch (e) { try { window.scrollTo(0, y); moved++; } catch (_) {} }
                  const card = findCard();
                  if (!card) continue;
                  card.scrollIntoView({ block: 'center', behavior: 'instant' });
                  const r = card.getBoundingClientRect();
                  return { ok: true, moved, w: r.width, h: r.height };
                }
              }
              const card = findCard();
              if (!card) return { err: 'no_card_after_scroll', moved };
              card.scrollIntoView({ block: 'center', behavior: 'instant' });
              const r = card.getBoundingClientRect();
              return { ok: true, moved, w: r.width, h: r.height };
            }""",
            table_name,
        )
        if res and res.get("ok"):
            await page.wait_for_timeout(400)
            return True
    except Exception as exc:
        logger.debug("Scroll document den ban %s: %s", table_name, exc)
    return False


async def _lobby_frames(page: Page) -> list[Frame]:
    """Lay shell frame chua iframe gamehall — khong goi _game_launched (tranh vong lap)."""
    shells = await _outer_nav_shell_frames(page)
    if shells:
        return shells
    shells = await _game_shell_frames(page)
    if shells:
        return shells
    frames: list[Frame] = []
    for frame in page.frames:
        try:
            url = (frame.url or "").lower()
        except Exception:
            continue
        if is_ae_sexy_url(url) or "gamehall" in url or "webmain" in url:
            frames.append(frame)
    if not frames:
        try:
            frames = [page.main_frame]
        except Exception:
            pass
    return frames


# Chi doc nhan ngan tren the ban — KHONG body.innerText (DOM sanh treo CDP 20-60s)
_LIST_LOBBY_TABLES_BODY = """
  const found = new Map();
  const add = (code) => {
    const c = String(code || '').toUpperCase();
    if (!/^C\\d{1,3}$/.test(c)) return;
    found.set(c, 'Baccarat ' + c);
  };
  const cards = document.querySelectorAll(
    'div.cursor-pointer, [class*="tableCard"], [class*="table-card"], [class*="TableCard"]'
  );
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    if (r.width < 70 || r.height < 50) continue;
    for (const child of card.querySelectorAll('div, span, p, h3, h4, label, a')) {
      const t = (child.textContent || '').trim();
      if (t.length < 8 || t.length > 36) continue;
      const m = t.match(/^Baccarat\\s+(C\\d{1,3})$/i);
      if (m) { add(m[1]); break; }
    }
  }
  if (found.size < 2) {
    for (const el of document.querySelectorAll('div, span, p, h3, h4')) {
      const t = (el.textContent || '').trim();
      if (t.length < 8 || t.length > 36) continue;
      const m = t.match(/^Baccarat\\s+(C\\d{1,3})$/i);
      if (m) add(m[1]);
      if (found.size >= 40) break;
    }
  }
  return [...found.values()];
"""

_LIST_VISIBLE_LOBBY_TABLES_SHELL = """
  const list = [...document.querySelectorAll('iframe')];
  const vis = (f) => {
    const r = f.getBoundingClientRect();
    return r.width > 120 && r.height > 120;
  };
  const hall = list.find(f => vis(f) && /gamehall/.test((f.src || '').toLowerCase()));
  if (!hall || !hall.contentDocument) return [];
  const doc = hall.contentDocument;
  const found = new Map();
  const add = (code) => {
    const c = String(code || '').toUpperCase();
    if (!/^C\\d{1,3}$/.test(c)) return;
    found.set(c, 'Baccarat ' + c);
  };
  const cards = doc.querySelectorAll(
    'div.cursor-pointer, [class*="tableCard"], [class*="table-card"], [class*="TableCard"]'
  );
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    if (r.width < 70 || r.height < 50) continue;
    for (const child of card.querySelectorAll('div, span, p, h3, h4, label, a')) {
      const t = (child.textContent || '').trim();
      if (t.length < 8 || t.length > 36) continue;
      const m = t.match(/^Baccarat\\s+(C\\d{1,3})$/i);
      if (m) { add(m[1]); break; }
    }
  }
  return [...found.values()];
"""

_SCROLL_LOBBY_BODY = """
  const scrollers = [...document.querySelectorAll('*')].filter(el => {
    if (el.closest('#toolbet-ui-v2')) return false;
    const s = getComputedStyle(el);
    return (s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflow === 'auto')
      && el.scrollHeight > el.clientHeight + 60;
  });
  const targets = scrollers.length ? scrollers : [document.documentElement, document.body];
  let moved = 0;
  for (const sc of targets) {
    const step = Math.max(180, Math.floor((sc.clientHeight || 400) * 0.75));
    for (let y = 0; y <= sc.scrollHeight + step; y += step) {
      try { sc.scrollTop = y; moved++; } catch (e) { window.scrollTo(0, y); moved++; }
    }
  }
  return moved;
"""

_GET_TABLE_CARD_POS_BODY = """
  const tableName = args[0];
  const m = String(tableName || '').match(/C(\\d{1,3})/i);
  if (!m) return null;
  const fullName = 'Baccarat C' + m[1];
  const findCard = () => {
    let best = null, bestScore = -1;
    for (const el of document.querySelectorAll('*')) {
      if (el.closest('#toolbet-ui-v2')) continue;
      const t = el.textContent || '';
      if (!t.includes(fullName)) continue;
      const names = t.match(/Baccarat C\\d+/g) || [];
      if (names.length > 2) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 80) continue;
      if (r.width > 420 || r.height > 260) continue;
      const cls = String(el.className || '');
      let score = r.width * r.height;
      if (/cursor-pointer/i.test(cls)) score += 100000;
      if (r.width >= 250 && r.height >= 140 && r.width <= 360) score += 50000;
      if (t.trim().startsWith(fullName)) score += 20000;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  };
  const scrollers = [
    ...document.querySelectorAll('.vue-recycle-scroller, [class*="recycle-scroller"]')
  ].filter(el => !el.closest('#toolbet-ui-v2') && el.scrollHeight > el.clientHeight + 40);
  if (!scrollers.length) scrollers.push(document.documentElement);
  for (const sc of scrollers) {
    const step = Math.max(160, Math.floor((sc.clientHeight || 400) * 0.65));
    for (let y = 0; y <= sc.scrollHeight + step; y += step) {
      try { sc.scrollTop = y; } catch (e) {}
      const card = findCard();
      if (!card) continue;
      card.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = card.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }
  }
  const card = findCard();
  if (!card) return null;
  card.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = card.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
"""

_GET_TABLE_SCREEN_POS_BODY = """
  const tableName = args[0];
  const m = String(tableName || '').match(/C(\\d{1,3})/i);
  if (!m) return null;
  const fullName = 'Baccarat C' + m[1];
  const hall = [...document.querySelectorAll('iframe')].find(f => (f.src || '').toLowerCase().includes('gamehall'));
  const doc = hall?.contentDocument;
  if (!doc) return null;
  let card = null, bestScore = -1;
  for (const el of doc.querySelectorAll('div.cursor-pointer')) {
    const t = el.textContent || '';
    if (!t.includes(fullName)) continue;
    const names = t.match(/Baccarat C\\d+/g) || [];
    if (names.length > 2) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 80) continue;
    let score = r.width * r.height + (/cursor-pointer/i.test(el.className || '') ? 100000 : 0);
    if (score > bestScore) { bestScore = score; card = el; }
  }
  if (!card) return null;
  card.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = card.getBoundingClientRect();
  let x = r.left + r.width / 2;
  let y = r.top + r.height / 2;
  let frame = hall;
  while (frame) {
    const fr = frame.getBoundingClientRect();
    x += fr.left;
    y += fr.top;
    const win = frame.ownerDocument?.defaultView;
    frame = win?.frameElement || null;
  }
  return { x, y, w: r.width, h: r.height };
"""

_HIDE_OVERLAY_JS = """() => {
  // Chi tat click — KHONG an panel (tranh nhay mat tool moi lan cuoc)
  for (const id of ['toolbet-overlay', 'toolbet-overlay-left', 'toolbet-overlay-center']) {
    const ov = document.getElementById(id);
    if (!ov) continue;
    ov.style.pointerEvents = 'none';
  }
}"""

_RESTORE_OVERLAY_JS = """() => {
  // Chi panel tuong tac — center van none de khong chan ban cuoc
  const left = document.getElementById('toolbet-overlay-left');
  const right = document.getElementById('toolbet-overlay');
  if (left) left.style.pointerEvents = 'auto';
  if (right) right.style.pointerEvents = 'auto';
  const center = document.getElementById('toolbet-overlay-center');
  if (center) center.style.pointerEvents = 'none';
}"""


async def _hide_overlay_for_click(page: Page) -> None:
    try:
        await page.evaluate(_HIDE_OVERLAY_JS)
    except Exception:
        pass


async def _restore_overlay_after_click(page: Page) -> None:
    """Bat lai click tren panel trai/phai sau khi bot click chip/ban."""
    try:
        await page.evaluate(_RESTORE_OVERLAY_JS)
    except Exception:
        pass


@asynccontextmanager
async def overlay_click_passthrough(page: Page):
    """Tam tat pointer-events overlay de click game, roi bat lai panel UI."""
    await _hide_overlay_for_click(page)
    try:
        yield
    finally:
        await _restore_overlay_after_click(page)


async def _os_click_viewport(page: Page, x: float, y: float) -> bool:
    """Click OS (trusted) khi Playwright khong kich hoat handler Vue."""
    try:
        import ctypes
        import sys

        if sys.platform != "win32":
            return False
        win = await page.evaluate(
            """() => ({
              screenX: window.screenX, screenY: window.screenY,
              outerH: window.outerHeight, innerH: window.innerHeight,
              outerW: window.outerWidth, innerW: window.innerWidth,
              dpr: window.devicePixelRatio || 1
            })"""
        )
        chrome_h = win["outerH"] - win["innerH"]
        chrome_w = win["outerW"] - win["innerW"]
        sx = int((win["screenX"] + chrome_w / 2 + x) * win["dpr"])
        sy = int((win["screenY"] + chrome_h + y) * win["dpr"])
        await page.bring_to_front()
        await page.wait_for_timeout(200)
        user32 = ctypes.windll.user32
        user32.SetCursorPos(sx, sy)
        user32.mouse_event(0x0002, 0, 0, 0, 0)
        user32.mouse_event(0x0004, 0, 0, 0, 0)
        return True
    except Exception as exc:
        logger.debug("OS click: %s", exc)
        return False


async def _read_room_stats_quick(page: Page) -> dict[str, int]:
    from src.ae_sexy_bead import read_in_room_stats

    try:
        return await read_in_room_stats(page) or {}
    except Exception:
        return {}


async def _room_has_broken_stream(page: Page) -> bool:
    """Man den hoac stream chet trong ban — thuong do doc.href/shell.src."""
    stream = await probe_room_stream_health(page)
    if not stream:
        return False
    if stream.get("blackScreen") and stream.get("streamDead"):
        return True
    if stream.get("hasRoad") and stream.get("streamDead") and not stream.get("streamOk"):
        return True
    return False


async def is_room_fully_loaded(page: Page, table_name: str = "") -> bool:
    """Ban load day du — stats DOM > 0 VA stream video/canvas song."""
    stream = await probe_room_stream_health(page)
    if not stream.get("streamOk"):
        return False
    stats = await _read_room_stats_quick(page)
    if stats and sum(stats.values()) > 0:
        return True
    if stream.get("hasStats") and not stream.get("statsZero"):
        return True
    if stream.get("hasBet"):
        return True
    return False


async def wait_for_room_stream_ready(
    page: Page, table_name: str = "", timeout_sec: int = 25
) -> bool:
    """Cho stream video/canvas + stats DOM sau khi vao ban."""
    for i in range(timeout_sec * 2):
        mode = await _get_shell_mode(page)
        in_room = await is_ae_sexy_in_room(page, table_name)
        shell_room = mode in ("room", "loading")
        nested = await _shell_has_nested(page, _ROOM_IFRAME_PAT)
        can_probe = in_room or shell_room or nested or i < 10

        if not can_probe:
            if await is_ae_sexy_lobby(page):
                await page.wait_for_timeout(500)
                continue
            await page.wait_for_timeout(500)
            continue

        stream = await probe_room_stream_health(page)
        shell = await probe_game_shell_health(page)
        stats = await _read_room_stats_quick(page)
        stats_total = sum(stats.values()) if stats else 0
        stream_ok = bool(stream.get("streamOk") or shell.get("streamOk"))
        if stream.get("blackScreen") and stream.get("streamDead"):
            stream_ok = False
        if stream_ok and stats_total > 0:
            logger.info("Stream video san sang (stats=%d)", stats_total)
            return True
        if stream_ok and (stream.get("hasBet") or shell.get("hasBet")):
            logger.info("Stream video san sang (co cua cuoc)")
            return True
        if stream_ok and not stream.get("blackScreen") and shell_room and i >= 4:
            if stream.get("hasRoad") or stream.get("hasStats"):
                logger.info("Stream video san sang (mode=%s)", mode)
                return True
        if i > 0 and i % 10 == 0:
            logger.info(
                "Cho stream video... (%ds, stats=%d, stream=%s, mode=%s)",
                i // 2,
                stats_total,
                "OK" if stream_ok else "chet",
                mode,
            )
        await page.wait_for_timeout(500)
    logger.warning("Stream video chua san sang sau %ds", timeout_sec)
    return False


async def is_game_token_zombie(page: Page, table_name: str = "") -> tuple[bool, str]:
    """
    Trong ban nhung mat token video (WalletLiveToken).
    HTTP/WS van cap nhat lich su nhung DOM stats=0 + stream chet.
    """
    if not await is_ae_sexy_in_room(page, table_name):
        return False, ""
    stream = await probe_room_stream_health(page)
    shell = await probe_game_shell_health(page)
    stream_dead = bool(
        stream.get("streamDead")
        or shell.get("streamDead")
        or shell.get("videoDead")
        or (stream.get("blackScreen") and not stream.get("streamOk"))
    )
    if not stream_dead:
        return False, ""
    stats = await _read_room_stats_quick(page)
    stats_zero = not stats or sum(stats.values()) == 0
    if stats_zero or stream.get("statsZero") or shell.get("statsZero"):
        return True, "mat token video — stats=0 + stream chet"
    if stream.get("blackScreen") or shell.get("blackScreen"):
        return True, "mat token video — man den + stream chet"
    return False, ""


async def recover_game_stream_token(page: Page, table_name: str) -> bool:
    """Quay sanh + click ban de refresh token video (khong dung direct nav)."""
    wanted = (table_name or "").strip() or "Baccarat C01"
    logger.warning("KHOI PHUC TOKEN VIDEO — quay sanh roi click ban %s", wanted)
    if not await go_ae_sexy_lobby(page):
        logger.warning("Khong quay duoc ve sanh")
        return False
    await page.wait_for_timeout(3000)
    await ensure_lobby_ready(page, timeout_sec=30, table_name=wanted)
    if not await enter_ae_sexy_table(page, wanted, fresh_token=True):
        return False
    await wait_for_ae_sexy_in_room(page, wanted, timeout_sec=30)
    return await wait_for_room_stream_ready(page, wanted, timeout_sec=25)


async def force_relaunch_ae_sexy_game(page: Page, table_name: str) -> bool:
    """Xoa iframe/tab cu + vao lai de lay WalletLiveToken moi."""
    wanted = (table_name or "").strip() or "Baccarat C01"
    from src.sites import get_active_site

    site = get_active_site()
    casino_url = site.info.casino_url()

    logger.warning("=" * 50)
    logger.warning("RELAUNCH GAME — site=%s (%s)", site.info.id, wanted)
    logger.warning("=" * 50)

    if site.info.shell_mode == "provider_tab":
        if not await site.enter_ae_sexy_hall(page, wanted, force_relaunch=True):
            return False
        best, _ = await find_ae_sexy_page(page.context, wanted)
        target = best or page
        try:
            await target.bring_to_front()
        except Exception:
            pass
        await ensure_lobby_ready(target, timeout_sec=45, table_name=wanted)
        if not await enter_ae_sexy_table(target, wanted, fresh_token=True):
            logger.warning("Khong vao lai duoc ban %s sau relaunch 222b", wanted)
            return False
        await wait_for_ae_sexy_in_room(target, wanted, timeout_sec=45)
        return await wait_for_room_stream_ready(target, wanted, timeout_sec=30)

    await teardown_game_iframe(page)
    await page.wait_for_timeout(1500)

    try:
        await page.goto(casino_url, wait_until="domcontentloaded", timeout=60000)
    except Exception as exc:
        logger.warning("Goto casino loi: %s", exc)
        return False

    await page.wait_for_timeout(3000)

    if not await enter_ae_sexy_hall(page, wanted, _from_recovery=True, force_relaunch=True):
        logger.warning("Khong vao lai duoc cong AE SEXY sau relaunch")
        return False

    await ensure_lobby_ready(page, timeout_sec=45, table_name=wanted)
    if not await enter_ae_sexy_table(page, wanted, fresh_token=True):
        logger.warning("Khong vao lai duoc ban %s sau relaunch", wanted)
        return False

    await wait_for_ae_sexy_in_room(page, wanted, timeout_sec=45)
    return await wait_for_room_stream_ready(page, wanted, timeout_sec=30)


_GO_LOBBY_BODY = """
  // UU TIEN: bat #iframeGameHall + an #iframeGame (zombie Loading/webMain che sanh)
  const hallEl = document.getElementById('iframeGameHall')
    || [...document.querySelectorAll('iframe')].find(f => /gamehall/i.test(f.src || ''));
  const gameEl = document.getElementById('iframeGame')
    || [...document.querySelectorAll('iframe')].find(f => {
      const s = (f.src || '').toLowerCase();
      return (/webmain|singlebactable|bactable\\.jsp/.test(s) && !/gamehall/.test(s));
    });
  if (hallEl) {
    const hs = (hallEl.src || '').toLowerCase();
    // Neu hall bi doi thanh singleBacTable — nap lai gamehall
    if (/singlebactable|bactable\\.jsp/.test(hs) && !/gamehall/.test(hs)) {
      const m = (hallEl.src || '').match(/^(https?:\\/\\/[^/]+\\/player\\/)/);
      if (m) {
        const jsid = ((hallEl.src || '').match(/jsessionid=([^?;&]+)/) || [])[1] || '';
        hallEl.src = m[1] + 'gamehall.jsp' + (jsid ? ';jsessionid=' + jsid : '') + '?dm=1&title=1';
      }
    }
    hallEl.style.visibility = 'visible';
    hallEl.style.display = 'block';
    hallEl.style.opacity = '1';
    if (gameEl && gameEl !== hallEl) {
      // CHI AN — KHONG blank src. Blank #iframeGame lam click ban khong mo phong.
      gameEl.style.visibility = 'hidden';
    }
    return { ok: true, method: 'toggle-hall-visible' };
  }
  // Fallback cu: doi href iframe (co the la hall an)
  const hall = [...document.querySelectorAll('iframe')].find(f => {
    const s = (f.src || '').toLowerCase();
    return s.includes('gamehall') || s.includes('singlebactable') || s.includes('bactable');
  });
  if (!hall) return { err: 'no_iframe' };
  const src = hall.src || '';
  const m = src.match(/^(https?:\\/\\/[^/]+\\/player\\/)/);
  if (!m) return { err: 'bad_src', src };
  const jsid = (src.match(/jsessionid=([^?;&]+)/) || [])[1] || '';
  const base = m[1];
  const url = base + 'gamehall.jsp' + (jsid ? ';jsessionid=' + jsid : '') + '?dm=1&title=1';
  const doc = hall.contentDocument;
  if (!doc) {
    hall.src = url;
    return { ok: true, method: 'iframe.src', url };
  }
  doc.location.href = url;
  return { ok: true, method: 'doc.href', url };
"""


async def go_ae_sexy_lobby(page: Page, *, force: bool = False) -> bool:
    """Hien sanh AE SEXY — bat buoc bat #iframeGameHall (khong chi reload hall an).

    Mac dinh KHONG an #iframeGame neu dang co chip/cuoc (tranh man den khi false lobby).
    """
    if not force and await _has_visible_room_bet_ui(page):
        logger.warning(
            "Bo qua go_ae_sexy_lobby — dang co chip/cuoc trong ban (tranh an phong → man den)"
        )
        return False
    fn = _shell_iframe_js(_GO_LOBBY_BODY)
    for frame in await _outer_nav_shell_frames(page):
        try:
            res = await frame.evaluate(fn)
            if res and res.get("ok"):
                logger.info("Ve sanh AE SEXY (%s)", res.get("method") or "ok")
                await page.wait_for_timeout(2000)
                if await _gamehall_iframe_visible(page) or await is_ae_sexy_lobby(page):
                    return True
                await page.wait_for_timeout(2000)
                return await is_ae_sexy_lobby(page) or await _gamehall_iframe_visible(page)
        except Exception:
            continue
    try:
        if is_ae_sexy_url(page.url or ""):
            res = await page.evaluate(f"() => {{ {_GO_LOBBY_BODY} }}")
            if res and res.get("ok"):
                logger.info("Ve sanh AE SEXY top (%s)", res.get("method") or "ok")
                await page.wait_for_timeout(2500)
                return await is_ae_sexy_lobby(page) or await _gamehall_iframe_visible(page)
    except Exception as exc:
        logger.debug("go_ae_sexy_lobby top: %s", exc)
    return False


_IS_HALL_SRC_BROKEN_JS = """
() => {
  const hall = [...document.querySelectorAll('iframe')].find(f => /gamehall/i.test(f.src || ''));
  if (!hall) return false;
  return /singlebactable|bactable/i.test((hall.src || '').toLowerCase());
}
"""


async def _fix_broken_hall_iframe(page: Page) -> bool:
    """hall.src bi doi thanh singleBacTable (direct nav cu) — quay ve gamehall."""
    for frame in await _outer_nav_shell_frames(page):
        try:
            broken = await frame.evaluate(_shell_iframe_js(_IS_HALL_SRC_BROKEN_JS))
            if broken:
                logger.warning("gamehall iframe bi doi URL (hall.src) — quay ve sanh")
                return await go_ae_sexy_lobby(page)
        except Exception:
            continue
    return False


_CLICK_TABLE_IN_HALL_BODY = """
  const tableName = args[0];
  const m = String(tableName || '').match(/C(\\d{1,3})/i);
  if (!m) return { err: 'bad_name' };
  const num = String(parseInt(m[1], 10));
  const padded = num.padStart(2, '0');
  const nameRe = new RegExp('Baccarat\\\\s*C0*' + num + '(?!\\\\d)', 'i');
  const hall = document.getElementById('iframeGameHall')
    || [...document.querySelectorAll('iframe')].find(f => /gamehall/i.test(f.src || ''));
  // Hall an (bi iframeGame che) — click DOM an khong co tac dung
  if (hall) {
    const hs = getComputedStyle(hall);
    if (hs.visibility === 'hidden' || hs.display === 'none') {
      return { err: 'hall_hidden' };
    }
  }
  const doc = hall?.contentDocument;
  if (!doc) return { err: 'no_hall_doc' };
  const findCard = () => {
    let best = null, bestScore = -1;
    for (const el of doc.querySelectorAll('div.cursor-pointer, div[class*="cursor-pointer"]')) {
      if (el.closest('#toolbet-ui-v2')) continue;
      const t = el.textContent || '';
      if (!nameRe.test(t)) continue;
      const names = t.match(/Baccarat\\s*C\\d+/gi) || [];
      if (names.length > 2) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 70) continue;
      if (r.width > 450 || r.height > 280) continue;
      const cls = String(el.className || '');
      let score = r.width * r.height;
      if (/cursor-pointer/i.test(cls)) score += 100000;
      if (r.width >= 240 && r.height >= 130) score += 50000;
      // Uu tien the dang trong viewport
      if (r.top >= -20 && r.top < (doc.defaultView.innerHeight || 900) && r.left >= -20)
        score += 200000;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  };
  const scrollers = [
    ...doc.querySelectorAll('.vue-recycle-scroller, [class*="recycle-scroller"], [class*="scroller"]')
  ].filter(el => !el.closest('#toolbet-ui-v2') && (el.scrollHeight > el.clientHeight + 30 || el.scrollWidth > el.clientWidth + 30));
  if (!scrollers.length) {
    for (const el of doc.querySelectorAll('*')) {
      if (el.closest('#toolbet-ui-v2')) continue;
      try {
        const s = doc.defaultView.getComputedStyle(el);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflowX === 'auto' || s.overflowX === 'scroll')
          && (el.scrollHeight > el.clientHeight + 60 || el.scrollWidth > el.clientWidth + 60))
          scrollers.push(el);
      } catch (e) {}
    }
  }
  if (!scrollers.length) scrollers.push(doc.documentElement);
  for (const sc of scrollers) {
    const stepY = Math.max(140, Math.floor((sc.clientHeight || 400) * 0.55));
    const stepX = Math.max(160, Math.floor((sc.clientWidth || 600) * 0.45));
    const maxY = Math.max(sc.scrollHeight || 0, 800);
    const maxX = Math.max(sc.scrollWidth || 0, sc.clientWidth || 0);
    for (let y = 0; y <= maxY + stepY; y += stepY) {
      for (let x = 0; x <= maxX + stepX; x += stepX) {
        try { sc.scrollTop = y; sc.scrollLeft = x; } catch (e) {}
        const card = findCard();
        if (!card) continue;
        card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        card.click();
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: doc.defaultView });
        card.dispatchEvent(evt);
        const r = card.getBoundingClientRect();
        return { ok: true, method: 'click', w: r.width, h: r.height, name: 'C' + padded };
      }
    }
  }
  const card = findCard();
  if (!card) return { err: 'no_card' };
  card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  card.click();
  const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: doc.defaultView });
  card.dispatchEvent(evt);
  const r = card.getBoundingClientRect();
  return { ok: true, method: 'click', w: r.width, h: r.height, name: 'C' + padded };
"""

# Click tren document hien tai (provider tab — khong can gamehall.contentDocument)
_CLICK_TABLE_IN_DOC_BODY = """
  const tableName = args[0];
  const m = String(tableName || '').match(/C(\\d{1,3})/i);
  if (!m) return { err: 'bad_name' };
  const num = String(parseInt(m[1], 10));
  const nameRe = new RegExp('Baccarat\\\\s*C0*' + num + '(?!\\\\d)', 'i');
  const doc = document;
  const findCard = () => {
    let best = null, bestScore = -1;
    for (const el of doc.querySelectorAll('div.cursor-pointer, div[class*="cursor-pointer"]')) {
      if (el.closest('#toolbet-ui-v2')) continue;
      const t = el.textContent || '';
      if (!nameRe.test(t)) continue;
      const names = t.match(/Baccarat\\s*C\\d+/gi) || [];
      if (names.length > 2) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 60) continue;
      if (r.width > 520 || r.height > 320) continue;
      const cls = String(el.className || '');
      let score = r.width * r.height;
      if (/cursor-pointer/i.test(cls)) score += 100000;
      if (r.width >= 200 && r.height >= 120) score += 50000;
      if (r.top >= -20 && r.left >= -20) score += 200000;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  };
  const scrollers = [
    ...doc.querySelectorAll('.vue-recycle-scroller, [class*="recycle-scroller"], [class*="scroller"]')
  ].filter(el => !el.closest('#toolbet-ui-v2') && (el.scrollHeight > el.clientHeight + 30 || el.scrollWidth > el.clientWidth + 30));
  if (!scrollers.length) scrollers.push(doc.documentElement, doc.body);
  for (const sc of scrollers) {
    if (!sc) continue;
    const stepY = Math.max(140, Math.floor((sc.clientHeight || 400) * 0.55));
    const stepX = Math.max(160, Math.floor((sc.clientWidth || 600) * 0.45));
    const maxY = Math.max(sc.scrollHeight || 0, 800);
    const maxX = Math.max(sc.scrollWidth || 0, sc.clientWidth || 0);
    for (let y = 0; y <= maxY + stepY; y += stepY) {
      for (let x = 0; x <= maxX + stepX; x += stepX) {
        try { sc.scrollTop = y; sc.scrollLeft = x; } catch (e) { try { window.scrollTo(x, y); } catch (_) {} }
        const card = findCard();
        if (!card) continue;
        card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        card.click();
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        card.dispatchEvent(evt);
        const r = card.getBoundingClientRect();
        return { ok: true, method: 'doc-click', w: r.width, h: r.height };
      }
    }
  }
  const card = findCard();
  if (!card) return { err: 'no_card' };
  card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  card.click();
  const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
  card.dispatchEvent(evt);
  const r = card.getBoundingClientRect();
  return { ok: true, method: 'doc-click', w: r.width, h: r.height };
"""

_NAV_TABLE_HREF_BODY = """
  const tableId = args[0];
  const hall = [...document.querySelectorAll('iframe')].find(f => /gamehall/i.test(f.src || ''));
  const doc = hall?.contentDocument;
  if (!doc) return { err: 'no_hall_doc' };
  const src = hall.src || '';
  const m = src.match(/^(https?:\\/\\/[^/]+\\/player\\/)/);
  if (!m) return { err: 'bad_src', src };
  const jsid = (src.match(/jsessionid=([^?;&]+)/) || [])[1] || '';
  const url = m[1] + 'singleBacTable.jsp' + (jsid ? ';jsessionid=' + jsid : '')
    + '?dm=1&tableID=' + tableId + '&title=1&srw=1';
  doc.location.href = url;
  return { ok: true, method: 'doc.href', url };
"""

_LOBBY_STATUS_BODY = """
  const text = document.body?.innerText || '';
  const tableCount = (text.match(/Baccarat C\\d+/gi) || []).length;
  const truyen = /Truyền Thống/i.test(text);
  return { tableCount, truyen };
"""


async def scroll_ae_sexy_lobby(page: Page) -> int:
    """Scroll sanh de load them ban (lazy load)."""
    moved = 0
    fn = _wrap_nested_js(_SCROLL_LOBBY_BODY, "gamehall")
    for frame in await _lobby_frames(page):
        try:
            n = await frame.evaluate(fn)
            moved += int(n or 0)
        except Exception:
            continue
    if moved:
        await page.wait_for_timeout(1200)
    return moved


async def _gamehall_iframe_visible(page: Page) -> bool:
    """True chi khi iframe gamehall dang HIEN (khong dem hall an khi dang trong ban)."""
    check_js = """() => {
      const hall = [...document.querySelectorAll('iframe')]
        .find(f => /gamehall/i.test(f.src || ''));
      if (!hall) return false;
      const r = hall.getBoundingClientRect();
      const s = getComputedStyle(hall);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0)
        return false;
      // Bi che boi iframe ban (webMain/singleBac) lon hon / z cao hon
      const room = [...document.querySelectorAll('iframe')].find(f => {
        const src = (f.src || '').toLowerCase();
        if (!/webmain|singlebactable|bactable\\.jsp/.test(src)) return false;
        if (/gamehall/.test(src)) return false;
        const rr = f.getBoundingClientRect();
        const ss = getComputedStyle(f);
        return rr.width > 200 && rr.height > 150
          && ss.visibility !== 'hidden' && ss.display !== 'none';
      });
      if (room) return false;
      return r.width > 120 && r.height > 120;
    }"""
    for frame in await _game_shell_frames(page):
        try:
            if await frame.evaluate(check_js):
                return True
        except Exception:
            continue
    try:
        if is_ae_sexy_url(page.url or ""):
            return bool(await page.evaluate(check_js))
    except Exception:
        pass
    return False


async def _has_visible_room_bet_ui(page: Page) -> bool:
    """Chip/cua cuoc dang hien — dang trong ban that (khong goi go_lobby)."""
    try:
        from src.ae_sexy_betting import probe_betting_phase

        bet = await probe_betting_phase(page)
        if bet.get("chipsVisible") or bet.get("zoneVisible"):
            return True
    except Exception:
        pass
    js = """() => {
      const chip = (doc) => !!(doc && (
        doc.getElementById('chipBoxPlayer')
        || doc.getElementById('chipBoxBanker')
        || doc.querySelector('#chips .chips3d')));
      const ok = (f) => {
        const r = f.getBoundingClientRect();
        const s = getComputedStyle(f);
        return r.width > 160 && r.height > 120
          && s.visibility !== 'hidden' && s.display !== 'none';
      };
      for (const f of document.querySelectorAll('iframe')) {
        if (!ok(f)) continue;
        try { if (chip(f.contentDocument)) return true; } catch (_) {}
      }
      try { if (chip(document)) return true; } catch (_) {}
      return false;
    }"""
    try:
        if await page.evaluate(js):
            return True
    except Exception:
        pass
    for frame in await _game_shell_frames(page):
        try:
            if await frame.evaluate(js):
                return True
        except Exception:
            continue
    return False


async def _is_ae_sexy_loading_zombie(page: Page) -> bool:
    """Man den: #iframeGame hien nhung chi Loading, khong chip/road — KHONG coi webMain.jsp binh thuong la zombie."""
    # Dang trong ban (chip) — khong phai zombie
    if await _has_visible_room_bet_ui(page):
        return False
    js = """() => {
      const hall = document.getElementById('iframeGameHall')
        || [...document.querySelectorAll('iframe')].find(f => /gamehall/i.test(f.src || ''));
      const game = document.getElementById('iframeGame')
        || [...document.querySelectorAll('iframe')].find(f => {
          const s = (f.src || '').toLowerCase();
          return /webmain|singlebactable|bactable/.test(s) && !/gamehall/.test(s);
        });
      if (!game) return false;
      const gs = getComputedStyle(game);
      const gr = game.getBoundingClientRect();
      if (gs.visibility === 'hidden' || gs.display === 'none' || gr.width < 120) return false;
      let hallHidden = true;
      if (hall) {
        const hs = getComputedStyle(hall);
        hallHidden = hs.visibility === 'hidden' || hs.display === 'none'
          || hall.getBoundingClientRect().width < 80;
      }
      // Chi zombie khi sanh an + game che + UI chi Loading (khong chip, khong ten ban)
      if (!hallHidden) return false;
      try {
        const doc = game.contentDocument;
        if (!doc || !doc.body) return true; // khong doc duoc + sanh an = nghi treo
        const t = doc.body.innerText || '';
        const hasChip = !!(doc.getElementById('chipBoxPlayer')
          || doc.getElementById('chipBoxBanker')
          || doc.querySelector('#chips .chips3d'));
        if (hasChip) return false;
        const hasTable = /Baccarat\\s*C\\d+/i.test(t);
        const loading = /loading\\.\\.\\./i.test(t) || /^\\s*$/.test(t);
        // Nested iframe chi Loading / trang trong
        const nested = [...doc.querySelectorAll('iframe')];
        let nestedOk = false;
        for (const nf of nested) {
          try {
            const nd = nf.contentDocument;
            if (nd && (nd.getElementById('chipBoxPlayer') || /Baccarat\\s*C\\d+/i.test(nd.body?.innerText || '')))
              nestedOk = true;
          } catch (_) {}
        }
        if (nestedOk) return false;
        return loading && !hasTable;
      } catch (e) {
        // Cross-origin: khong biet — khong ket luan zombie (tranh an phong dang choi)
        return false;
      }
    }"""
    try:
        if is_ae_sexy_url(page.url or "") and await page.evaluate(js):
            return True
    except Exception:
        pass
    for frame in await _outer_nav_shell_frames(page):
        try:
            if await frame.evaluate(js):
                return True
        except Exception:
            continue
    return False


async def _list_tables_in_frames(page: Page) -> list[str]:
    """Dem ban tu gamehall HIEN — khong dem khi dang trong ban (chip iframe HIEN)."""
    # Chi chip/iframe ban CO KICH THUOC — ghost 0x0 sau kick sanh khong tinh
    try:
        in_room_ui = await page.evaluate(
            """() => {
              const chip = (doc) => !!(doc && (
                doc.getElementById('chipBoxPlayer')
                || doc.getElementById('chipBoxBanker')
                || doc.querySelector('#chips .chips3d')));
              const okSize = (f) => {
                const r = f.getBoundingClientRect();
                const s = getComputedStyle(f);
                return r.width > 160 && r.height > 120
                  && s.visibility !== 'hidden' && s.display !== 'none';
              };
              for (const f of document.querySelectorAll('iframe')) {
                if (!okSize(f)) continue;
                const src = (f.src || '').toLowerCase();
                try {
                  if (chip(f.contentDocument)) return true;
                } catch (_) {}
                if (/singlebactable|bactable\\.jsp/.test(src) && chip) {
                  try { if (chip(f.contentDocument)) return true; } catch (_) {}
                }
              }
              return false;
            }"""
        )
        if in_room_ui:
            return []
    except Exception:
        pass
    try:
        if await _get_shell_mode(page) == "room":
            return []
    except Exception:
        pass

    found: set[str] = set()
    body_fn = f"() => {{\n{_LIST_LOBBY_TABLES_BODY}\n}}"
    hall_visible = await _gamehall_iframe_visible(page)
    if hall_visible:
        for frame in await _game_shell_frames(page):
            try:
                in_room_hall = await frame.evaluate(
                    """() => {
                      const hall = [...document.querySelectorAll('iframe')]
                        .find(f => {
                          if (!/gamehall/i.test(f.src || '')) return false;
                          const r = f.getBoundingClientRect();
                          const s = getComputedStyle(f);
                          return r.width > 120 && r.height > 120
                            && s.visibility !== 'hidden' && s.display !== 'none';
                        });
                      const doc = hall && hall.contentDocument;
                      if (!doc) return false;
                      return !!(doc.getElementById('chipBoxPlayer')
                        || doc.getElementById('chipBoxBanker')
                        || doc.querySelector('#chips .chips3d'));
                    }"""
                )
                if in_room_hall:
                    return []
            except Exception:
                continue
        hall = await _gamehall_playwright_frame(page)
        if hall:
            try:
                chip = await hall.evaluate(
                    """() => !!(document.getElementById('chipBoxPlayer')
                      || document.getElementById('chipBoxBanker')
                      || document.querySelector('#chips .chips3d'))"""
                )
                if chip:
                    return []
                names = await hall.evaluate(body_fn)
                if names:
                    found.update(names)
            except Exception:
                pass
        if len(found) < 2:
            fn = _shell_iframe_js(_LIST_VISIBLE_LOBBY_TABLES_SHELL)
            for frame in await _lobby_frames(page):
                try:
                    names = await frame.evaluate(fn)
                    if names:
                        found.update(names)
                except Exception:
                    continue
                if len(found) >= 2:
                    break
    if len(found) < 2 and not hall_visible:
        try:
            mode = await _get_shell_mode(page)
        except Exception:
            mode = "none"
        if mode == "lobby":
            frames = [page.main_frame]
            try:
                frames.extend(await _game_shell_frames(page))
            except Exception:
                pass
            seen: set[int] = set()
            for frame in frames:
                if id(frame) in seen:
                    continue
                seen.add(id(frame))
                try:
                    names = await frame.evaluate(body_fn)
                    if names:
                        found.update(names)
                except Exception:
                    continue
    return _sort_tables(list(found))


_FRAME_ROOM_UI_BODY = """
  const hasRoad = !!document.querySelector('[class*="road_zone"]');
  if (!hasRoad) return false;
  const text = document.body?.innerText || '';
  const hasStats = /B\\s*\\d+[^\\d]{0,12}P\\s*\\d+[^\\d]{0,12}T\\s*\\d+/i.test(text);
  const hasBet = /Đặt cược|Đang mở bài|Place your bet/i.test(text);
  const hasChip = !!(document.getElementById('chipBoxPlayer')
    || document.getElementById('chipBoxBanker')
    || document.querySelector('#chips .chips3d'));
  // Chip/road = trong ban; khong dung tableCount tu hall an (webMain dly8829)
  if (hasChip) return true;
  const tableCount = (text.match(/Baccarat C\\d+/gi) || []).length;
  if (hasBet) return tableCount <= 2;
  if (hasStats) return tableCount <= 2;
  return false;
"""

_FRAME_TABLE_NAME_BODY = """
  const exact = [];
  for (const el of document.querySelectorAll('*')) {
    const t = (el.textContent || '').trim();
    if (/^Baccarat C\\d{1,3}$/i.test(t)) exact.push(t);
  }
  if (exact.length) {
    exact.sort((a, b) => a.length - b.length);
    return exact[0];
  }
  const m = (document.body?.innerText || '').match(/Baccarat C\\d{1,3}/i);
  return m ? m[0] : '';
"""


def _is_room_url(url: str) -> bool:
    u = (url or "").lower()
    return "singlebactable" in u or "bactable.jsp" in u or "bactable" in u


async def _shell_has_nested(page: Page, iframe_pat: str) -> bool:
    fn = _wrap_nested_js(
        "return !!(document.getElementById('chipBoxPlayer') || document.querySelector('#chips .chips3d'));",
        iframe_pat,
    )
    for frame in await _game_shell_frames(page):
        try:
            if await frame.evaluate(fn):
                return True
        except Exception:
            continue
    return False


async def _frame_has_room_ui(frame: Frame) -> bool:
    fn = _wrap_nested_js(_FRAME_ROOM_UI_BODY, "singlebactable|bactable|webmain|gamehall")
    try:
        return bool(await frame.evaluate(fn))
    except Exception:
        return False


async def _room_frames(page: Page) -> list[Frame]:
    """Shell frame khi dang trong ban (iframe singleBacTable/webMain ben trong)."""
    if await _shell_has_nested(page, _ROOM_IFRAME_PAT):
        return await _game_shell_frames(page)
    out: list[Frame] = []
    seen: set[int] = set()

    def add(frame: Frame | None):
        if frame and id(frame) not in seen:
            seen.add(id(frame))
            out.append(frame)

    for frame in page.frames:
        if _is_room_url(frame.url or ""):
            add(frame)
    if not out:
        for frame in await _game_shell_frames(page):
            if await _frame_has_room_ui(frame):
                add(frame)
    return out


async def has_ae_sexy_room_ui(page: Page) -> bool:
    """Co UI trong ban — shell room hoac chip/bet ro, khong phai luoi sanh."""
    if await is_ae_sexy_promo_visible(page):
        return False
    mode = await _get_shell_mode(page)
    if mode == "room":
        return True
    if mode == "lobby":
        return False
    try:
        from src.ae_sexy_state import probe_in_room

        probe = await probe_game_state(page)
        return probe_in_room(probe, "")
    except Exception:
        return False


async def _iframe_src(page: Page) -> str:
    loc = page.locator("#iframe_game")
    if not await loc.count():
        return ""
    return (await loc.get_attribute("src")) or ""


async def _has_ae_game_frame(page: Page) -> bool:
    """Co frame game AE SEXY — uu tien iframe dang hien."""
    if await is_game_iframe_visible(page):
        return True
    for frame in page.frames:
        url = frame.url or ""
        if url in ("", "about:blank"):
            continue
        if any(h in url for h in AE_SEXY_HOSTS) or "gamehall.jsp" in url:
            return True
    return False


async def is_ae_sexy_lobby(page: Page) -> bool:
    """True neu PAGE HIEN TAI dang o sanh. Khong doi tab (tranh lech page caller)."""
    from src.ae_sexy_state import _clearly_in_room_probe, probe_in_room, probe_is_lobby

    try:
        mode = await asyncio.wait_for(_get_shell_mode(page), timeout=2.5)
        if mode == "lobby":
            return True
        if mode == "room":
            return False
    except Exception:
        pass

    if not await _game_launched(page):
        return False
    # Provider tab (222b) khong co #iframe_game — bo qua overlay vipbet
    try:
        if not is_ae_sexy_url(page.url or ""):
            await ensure_game_overlay_visible(page)
    except Exception:
        pass
    probe = await probe_game_state(page)
    # Dang trong ban (chip/stream) — KHONG coi la sanh du hall con ten ban trong DOM
    if probe_in_room(probe) or _clearly_in_room_probe(probe) or probe.shell_mode == "room":
        return False
    if probe_is_lobby(probe):
        return True
    if probe.shell_mode != "lobby":
        return False
    # Fallback chi khi shell=lobby: dem the tren gamehall HIEN
    if not await _gamehall_iframe_visible(page):
        return False
    fn = _wrap_nested_js(_LOBBY_STATUS_BODY, "gamehall")
    for frame in await _lobby_frames(page):
        try:
            info = await frame.evaluate(fn)
            if not info:
                continue
            if info.get("tableCount", 0) >= 2:
                return True
            if info.get("tableCount", 0) >= 1 and info.get("truyen"):
                return True
        except Exception:
            continue
    return False


async def _on_provider_shell_without_ae(page: Page) -> bool:
    """Shell 222b/dly8829 (home/#/) — chua mo tab AE SEXY; khong cho lobby o day."""
    try:
        from src.sites import get_active_site

        site = get_active_site()
        if site.info.shell_mode != "provider_tab":
            return False
        url = page.url or ""
        if is_ae_sexy_url(url):
            return False
        if not site.info.matches_url(url):
            return False
        if await _game_launched(page):
            return False
        best, phase = await find_ae_sexy_page(page.context, site_id=site.info.id)
        if best and phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING):
            return False
        return True
    except Exception:
        return False


async def wait_for_ae_sexy_lobby(page: Page, timeout_sec: int = 90, table_name: str = "") -> bool:
    welcome_streak = 0
    no_lobby_streak = 0
    page = await switch_to_ae_sexy_page(page, table_name)
    for i in range(timeout_sec):
        page = await switch_to_ae_sexy_page(page, table_name)
        # Dung som neu dang treo tren shell provider (home/#/) — can click SEXY, khong cho iframe
        if i >= 3 and await _on_provider_shell_without_ae(page):
            logger.warning(
                "Cho sanh tren shell provider (url=%s) — dung cho, can mo lai SEXY",
                (page.url or "")[:70],
            )
            return False
        if await is_ae_sexy_welcome_back(page):
            welcome_streak += 1
            if await dismiss_ae_sexy_welcome_back(page):
                await page.wait_for_timeout(3000)
                welcome_streak = 0
                no_lobby_streak = 0
                continue
            if welcome_streak >= 8:
                logger.warning(
                    "Treo man hinh welcome-back (%ds) — reload trang...",
                    i,
                )
                await close_game_overlay(page)
                try:
                    await page.reload(wait_until="domcontentloaded", timeout=60000)
                except Exception:
                    pass
                await page.wait_for_timeout(4000)
                welcome_streak = 0
                no_lobby_streak = 0
                continue
        else:
            welcome_streak = 0

        if await is_game_session_expired(page):
            logger.warning("Session het han khi cho sanh (%ds) — khoi phuc...", i)
            if await recover_ae_sexy_session_expired(page, table_name):
                await page.wait_for_timeout(2000)
                page = await switch_to_ae_sexy_page(page, table_name)
                continue
            await close_game_overlay(page)
            try:
                await page.reload(wait_until="domcontentloaded", timeout=60000)
            except Exception:
                pass
            await page.wait_for_timeout(4000)
            continue

        await ensure_game_overlay_visible(page)
        lobby = await is_ae_sexy_lobby(page)
        if lobby:
            no_lobby_streak = 0
            tables = await _list_tables_in_frames(page)
            if not tables and i % 4 == 0:
                await scroll_ae_sexy_lobby(page)
                tables = await _list_tables_in_frames(page)
            if tables:
                await page.wait_for_timeout(1500)
                logger.info("Sanh AE SEXY san sang (%d ban)", len(tables))
                return True
            if i >= 5:
                logger.info("Sanh AE SEXY hien thi — tiep tuc tim ban...")
                return True
        elif await _game_launched(page):
            no_lobby_streak += 1
            if no_lobby_streak >= 25:
                logger.warning(
                    "Iframe da load nhung khong vao sanh (%ds) — reload trang...",
                    i,
                )
                await close_game_overlay(page)
                try:
                    await page.reload(wait_until="domcontentloaded", timeout=60000)
                except Exception:
                    pass
                await page.wait_for_timeout(4000)
                no_lobby_streak = 0
                continue
        else:
            no_lobby_streak = 0

        if i > 0 and i % 15 == 0:
            vis = await _iframe_visibility(page)
            launched = await _game_launched(page)
            logger.info(
                "Cho sanh AE SEXY... (%ds) launched=%s iframe=%sx%s url=%s",
                i,
                launched,
                int(vis.get("w", 0)),
                int(vis.get("h", 0)),
                (page.url or "")[:70],
            )
        await page.wait_for_timeout(1000)
    return False


async def _lobby_already_open(page: Page) -> bool:
    """Sanh AE SEXY da mo trong iframe — khong can click tab promo."""
    if await is_ae_sexy_lobby(page):
        return True
    mode = await _get_shell_mode(page)
    if mode == "lobby":
        return True
    tables = await _list_tables_in_frames(page)
    return len(tables) >= 2


async def _unblock_casino_promo(page: Page) -> None:
    """An iframe game neu che tab AE SEXY / nut Vao choi tren trang casino."""
    vis = await _iframe_visibility(page)
    if not vis.get("visible"):
        return
    if await _lobby_already_open(page):
        return
    await close_game_overlay(page)
    await page.wait_for_timeout(500)


async def _click_ae_tab(page: Page) -> bool:
    """Chon tab AE SEXY — JS truoc (tranh iframe intercept), roi playwright."""
    picked = await page.evaluate(
        """() => {
        const items = [...document.querySelectorAll('span,div,a,button')].filter(
            el => (el.textContent || '').trim() === 'AE SEXY'
        );
        if (!items.length) return false;
        const el = items.sort((a,b) => {
            const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            return (ra.width*ra.height) - (rb.width*rb.height);
        })[0];
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        el.click();
        return true;
    }"""
    )
    if picked:
        logger.info("Da chon cong AE SEXY (js)")
        return True

    ae_locators = page.get_by_text("AE SEXY", exact=True)
    count = await ae_locators.count()
    if not count:
        logger.error("Khong tim thay nhan AE SEXY")
        return False
    best_idx = 0
    best_area = float("inf")
    for i in range(min(count, 8)):
        box = await ae_locators.nth(i).bounding_box()
        if box and box["width"] * box["height"] < best_area:
            best_area = box["width"] * box["height"]
            best_idx = i
    target = ae_locators.nth(best_idx)
    await target.scroll_into_view_if_needed(timeout=5000)
    await page.wait_for_timeout(400)
    try:
        await target.click(timeout=8000)
    except Exception:
        await target.click(timeout=8000, force=True)
    logger.info("Da chon cong AE SEXY (playwright)")
    return True


async def _click_ae_sexy_enter(page: Page, *, force_relaunch: bool = False) -> bool:
    """Chon AE SEXY trong swiper roi click 'Vao choi' — dung Playwright click."""
    if force_relaunch:
        await teardown_game_iframe(page)
        await page.wait_for_timeout(2000)
    else:
        await ensure_game_overlay_visible(page)
        if await _lobby_already_open(page):
            logger.info("Da o sanh AE SEXY trong iframe — bo qua click promo")
            return True

        if await _game_launched(page):
            if await is_game_session_expired(page):
                logger.warning("Iframe het session — teardown de vao lai...")
                await teardown_game_iframe(page)
                await page.wait_for_timeout(2000)
            elif await _lobby_already_open(page):
                return True
            else:
                logger.info("Game iframe da khoi chay — bo qua click promo")
                return True

    await _unblock_casino_promo(page)
    await page.evaluate("window.scrollTo(0, 400)")
    await page.wait_for_timeout(ACTION_PAUSE_MS)

    try:
        if not await _click_ae_tab(page):
            return False
    except Exception as exc:
        logger.warning("Click AE SEXY tab: %s — thu lai sau an iframe", exc)
        await _unblock_casino_promo(page)
        if not await _click_ae_tab(page):
            return False

    await page.wait_for_timeout(ACTION_PAUSE_MS)

    entered = False
    await _unblock_casino_promo(page)
    for label, get_loc in [
        ("exact", lambda: page.get_by_text("Vào chơi", exact=True).first),
        ("role", lambda: page.get_by_role("link", name="Vào chơi")),
        ("contains", lambda: page.locator("a, button, span, div").filter(has_text="Vào chơi").first),
    ]:
        try:
            loc = get_loc()
            if await loc.count() == 0:
                continue
            await loc.scroll_into_view_if_needed(timeout=8000)
            await page.wait_for_timeout(500)
            try:
                async with page.expect_response(
                    lambda r: "launch" in r.url.lower() or "game" in r.url.lower(),
                    timeout=12000,
                ):
                    await loc.click(timeout=10000)
            except Exception:
                await loc.click(timeout=10000, force=True)
            logger.info("Da click Vao choi (%s) — cho iframe load...", label)
            entered = True
            break
        except Exception as exc:
            logger.debug("Click Vao choi %s: %s", label, exc)

    if not entered:
        entered = await page.evaluate(
            """() => {
            const btn = [...document.querySelectorAll('a,button,span,div')].find(
                el => ['Vào chơi', 'Vao choi'].includes((el.textContent || '').trim())
            );
            if (!btn) return false;
            btn.scrollIntoView({ block: 'center' });
            btn.click();
            return true;
        }"""
        )
        if entered:
            logger.info("Da click Vao choi (js fallback)")

    if entered:
        await page.wait_for_timeout(1500)
        await ensure_game_overlay_visible(page)
    return bool(entered)


async def _wait_iframe_ready(page: Page, timeout_sec: int = 45) -> bool:
    """Cho iframe game co kich thuoc sau khi click Vao choi."""
    for i in range(timeout_sec * 2):
        fatal, _ = await is_casino_fatal_error(page)
        if fatal:
            logger.warning("Iframe hien loi 1008/token — huy cho load")
            return False
        await ensure_game_overlay_visible(page)
        vis = await _iframe_visibility(page)
        if vis.get("visible") and vis.get("src") and vis.get("src") not in ("about:blank", ""):
            return True
        if await has_game_iframe(page):
            await show_game_overlay(page)
            vis = await _iframe_visibility(page)
            if vis.get("w", 0) > 80 or any(
                any(h in (f.url or "") for h in AE_SEXY_HOSTS) for f in page.frames
            ):
                return True
        if i > 0 and i % 10 == 0:
            logger.info(
                "Cho iframe game... (%ds) %sx%s src=%s",
                i // 2,
                int(vis.get("w", 0)),
                int(vis.get("h", 0)),
                (vis.get("src") or "")[:60],
            )
        await page.wait_for_timeout(500)
    return False


async def enter_ae_sexy_hall(
    page: Page,
    table_name: str = "",
    *,
    _from_recovery: bool = False,
    force_relaunch: bool = False,
) -> bool:
    """Dispatcher — moi web co nhanh vao sanh rieng (SiteAdapter)."""
    from src.sites import bind_page_site, get_active_site, resolve_site_from_page

    # Tab shell (vipbet/222b) → dung site theo URL; tab CDN AE → active session
    site = resolve_site_from_page(page) or get_active_site()
    bind_page_site(page, site.info.id)
    logger.info("Vao sanh AE SEXY qua site=%s (%s)", site.info.id, site.info.shell_mode)
    return await site.enter_ae_sexy_hall(
        page,
        table_name,
        _from_recovery=_from_recovery,
        force_relaunch=force_relaunch,
    )


async def _resolve_provider_shell_page(
    page: Page,
    *,
    site_id: str | None = None,
) -> Page | None:
    """Tab shell casino (222b live.html / dly8829 #/live) — KHONG bao gio la tab CDN AE.

    Neu goto live.html tren tab AE SEXY → dung game bi thay bang shell (bug thuong gap).
    """
    from src.sites import get_active_site, get_site

    try:
        site = get_site(site_id) if site_id else get_active_site()
    except Exception:
        site = get_active_site()
    sid = site.info.id

    def _is_shell(pg: Page) -> bool:
        try:
            u = pg.url or ""
        except Exception:
            return False
        if not site.info.matches_url(u):
            return False
        if is_ae_sexy_url(u):
            return False
        return True

    try:
        if not page.is_closed() and _is_shell(page):
            return page
    except Exception:
        pass

    try:
        ctx = page.context
    except Exception:
        return None
    # Uu tien URL casino (live.html / #/live)
    ranked: list[tuple[int, Page]] = []
    for pg in list(ctx.pages):
        if pg.is_closed():
            continue
        if not _is_shell(pg):
            continue
        try:
            u = (pg.url or "").lower()
        except Exception:
            u = ""
        score = 0
        if "live.html" in u or "#/live" in u or "tabname=live" in u:
            score += 10
        if "/home/" in u or "/home?" in u:
            score += 3
        ranked.append((score, pg))
    if not ranked:
        return None
    ranked.sort(key=lambda x: -x[0])
    shell = ranked[0][1]
    from src.sites import bind_page_site

    bind_page_site(shell, sid)
    return shell


async def enter_ae_sexy_hall_provider_tab(
    page: Page,
    table_name: str = "",
    *,
    launch_code: str = "AWC_S",
    casino_url: str,
    force_relaunch: bool = False,
    site_id: str | None = None,
) -> bool:
    """Mo casino shell roi goGame(code) — AE SEXY mo tab moi (222b-like)."""
    from src.sites import bind_page_site, foreign_shell_page, get_active_site

    sid = (site_id or get_active_site().info.id).strip().lower()
    ctx = page.context
    bind_page_site(page, sid)
    # Neu da co tab AE SEXY cua site — dung luon
    best, phase = await find_ae_sexy_page(ctx, table_name, site_id=sid)
    if best and phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING) and not force_relaunch:
        if foreign_shell_page(best, sid):
            best = None
        else:
            logger.info("%s: da co tab AE SEXY (%s)", sid, PHASE_LABEL.get(phase, phase))
            bind_page_site(best, sid)
            try:
                await best.bring_to_front()
            except Exception:
                pass
            if phase == PHASE_LOBBY or await is_ae_sexy_lobby(best):
                return True
            return await wait_for_ae_sexy_lobby(best, timeout_sec=45, table_name=table_name)

    # force_relaunch: dong tab AE, luon thao tac tren SHELL — khong goto live.html tren tab CDN
    shell = await _resolve_provider_shell_page(page, site_id=sid)
    if force_relaunch and best and phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING):
        if best is not None and not best.is_closed():
            # Neu best == shell thi khong dong
            if shell is None or best is not shell:
                try:
                    await best.close()
                except Exception:
                    pass
                await page.wait_for_timeout(800)
        if shell is None:
            shell = await _resolve_provider_shell_page(page, site_id=sid)

    if shell is None:
        # Fallback: tim shell theo host (cu)
        if page.is_closed() or is_ae_sexy_url(page.url or ""):
            try:
                from src.sites import get_site

                hosts = tuple(h.lower() for h in get_site(sid).info.hosts)
            except Exception:
                hosts = (sid,)
            for p in ctx.pages:
                if p.is_closed():
                    continue
                try:
                    u = (p.url or "").lower()
                except Exception:
                    continue
                if any(h.replace("www.", "") in u for h in hosts) and not is_ae_sexy_url(u):
                    shell = p
                    bind_page_site(shell, sid)
                    break
        elif not is_ae_sexy_url(page.url or ""):
            shell = page

    if shell is None or shell.is_closed():
        logger.error("%s: mat shell casino (live.html) — khong the goGame", sid)
        return False

    page = shell
    bind_page_site(page, sid)
    try:
        await page.bring_to_front()
    except Exception:
        pass

    try:
        cur = (page.url or "").lower()
        need_goto = True
        if "live.html" in cur or "#/live" in cur or "tabname=live" in cur:
            need_goto = False
        elif casino_url.rstrip("/").lower() in cur:
            need_goto = False
        if need_goto:
            # CHI goto tren shell — da dam bao page khong phai CDN AE
            if is_ae_sexy_url(page.url or ""):
                logger.error(
                    "%s: tu choi goto casino tren tab AE (%s)",
                    sid,
                    (page.url or "")[:70],
                )
                return False
            await page.goto(casino_url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(2000)
    except Exception as exc:
        logger.warning("Goto casino %s loi: %s", sid, exc)
        return False

    code = (launch_code or "AWC_S").strip()
    logger.info("%s: goGame('%s') de mo SEXY CASINO...", sid, code)
    try:
        await page.evaluate(
            """(code) => {
              if (typeof goGame === 'function') {
                goGame(code, code);
                return 'goGame';
              }
              const links = [...document.querySelectorAll('a')];
              const a = links.find(el => (el.getAttribute('href')||'').includes(code) && /goGame/i.test(el.getAttribute('href')||''))
                || links.find(el => (el.className||'').includes('play') && (el.getAttribute('href')||'').includes(code));
              if (a) { a.click(); return 'click'; }
              return '';
            }""",
            code,
        )
    except Exception as exc:
        logger.error("goGame %s loi: %s", sid, exc)
        return False

    await page.wait_for_timeout(800)
    # Popup "Vui long dang nhap truoc" = chua login web
    try:
        need_login = await page.evaluate(
            """() => /vui\\s*lòng\\s*đăng\\s*nhập\\s*trước/i.test(
              (document.body && document.body.innerText) || ''
            )"""
        )
        if need_login:
            logger.error(
                "%s: goGame bi chan — 'Vui long dang nhap truoc' (web CHUA login)",
                sid,
            )
            return False
    except Exception:
        pass

    for i in range(60):
        await page.wait_for_timeout(500)
        best, phase = await find_ae_sexy_page(ctx, table_name, site_id=sid)
        if not best or foreign_shell_page(best, sid):
            continue
        if phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING):
            bind_page_site(best, sid)
            try:
                await best.bring_to_front()
            except Exception:
                pass
            if phase in (PHASE_LOBBY, PHASE_ROOM) or await is_ae_sexy_lobby(best):
                logger.info("%s: da vao sanh AE SEXY (tab provider)", sid)
                try:
                    await best.bring_to_front()
                except Exception:
                    pass
                return True
            if phase == PHASE_LOADING and i >= 6:
                if await wait_for_ae_sexy_lobby(best, timeout_sec=12, table_name=table_name):
                    try:
                        await best.bring_to_front()
                    except Exception:
                        pass
                    return True
        if i > 0 and i % 10 == 0:
            logger.info("%s: cho tab AE SEXY... (%ds) phase=%s", sid, i // 2, phase)

    logger.error("%s: khong mo duoc tab AE SEXY sau goGame", sid)
    return False


async def enter_ae_sexy_hall_sexy_card(
    page: Page,
    table_name: str = "",
    *,
    casino_url: str,
    site_id: str,
    force_relaunch: bool = False,
) -> bool:
    """dly8829/EE88: trang #/live → click 'Vào trò chơi' tren the SEXY CASINO."""
    from src.sites import bind_page_site, foreign_shell_page

    sid = (site_id or "dly8829").strip().lower()
    ctx = page.context
    bind_page_site(page, sid)

    best, phase = await find_ae_sexy_page(ctx, table_name, site_id=sid)
    if best and phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING) and not force_relaunch:
        if not foreign_shell_page(best, sid):
            logger.info("%s: da co tab AE SEXY (%s)", sid, PHASE_LABEL.get(phase, phase))
            bind_page_site(best, sid)
            try:
                await best.bring_to_front()
            except Exception:
                pass
            if phase == PHASE_LOBBY or await is_ae_sexy_lobby(best):
                return True
            return await wait_for_ae_sexy_lobby(best, timeout_sec=45, table_name=table_name)

    # Chi thao tac tren SHELL dly8829 (#/live) — khong goto casino tren tab CDN AE
    shell = await _resolve_provider_shell_page(page, site_id=sid)
    if force_relaunch and best and not best.is_closed():
        if shell is None or best is not shell:
            try:
                await best.close()
            except Exception:
                pass
            await page.wait_for_timeout(800)
        if shell is None:
            shell = await _resolve_provider_shell_page(page, site_id=sid)

    if shell is None:
        # Fallback: tab host dly8829 khong phai AE
        for p in list(ctx.pages):
            if p.is_closed():
                continue
            try:
                u = p.url or ""
            except Exception:
                continue
            if "dly8829" in u.lower() and not is_ae_sexy_url(u):
                shell = p
                break
    if shell is None or shell.is_closed():
        logger.error("%s: mat shell (#/live) — khong the click SEXY card", sid)
        return False

    page = shell
    bind_page_site(page, sid)
    try:
        await page.bring_to_front()
    except Exception:
        pass

    try:
        cur = (page.url or "").lower()
        if is_ae_sexy_url(cur):
            logger.error(
                "%s: tu choi goto #/live tren tab AE (%s)",
                sid,
                cur[:70],
            )
            return False
        if "#/live" not in cur and "tabname=live" not in cur:
            await page.goto(casino_url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(2500)
        else:
            # Dam bao list provider da render
            await page.wait_for_timeout(800)
    except Exception as exc:
        logger.warning("%s: goto live casino loi: %s", sid, exc)
        return False

    logger.info("%s: click SEXY CASINO → Vao tro choi...", sid)
    clicked = await page.evaluate(
        """() => {
          const norm = (t) => (t || '').replace(/\\s+/g, ' ').trim();
          // Tim card/provider SEXY
          const nodes = [...document.querySelectorAll('div,li,section,article')];
          const card = nodes.find(el => {
            const t = norm(el.innerText);
            if (!/sexy\\s*casino/i.test(t)) return false;
            // card gan — khong lay ca providerList dai
            return t.length < 200 && /vào\\s*trò\\s*chơi|chơi\\s*ngay|play/i.test(t);
          });
          if (card) {
            const btn = [...card.querySelectorAll('button,a,div,span')].find(el =>
              /^vào\\s*trò\\s*chơi$/i.test(norm(el.innerText))
              || /^chơi\\s*ngay$/i.test(norm(el.innerText))
            );
            if (btn) { btn.click(); return 'card-btn'; }
            card.click();
            return 'card';
          }
          // Fallback: nut Vao tro choi gan text SEXY
          const play = [...document.querySelectorAll('button,a')].find(el => {
            if (!/^vào\\s*trò\\s*chơi$/i.test(norm(el.innerText))) return false;
            let p = el.parentElement;
            for (let i = 0; i < 6 && p; i++) {
              if (/sexy\\s*casino/i.test(norm(p.innerText))) return true;
              p = p.parentElement;
            }
            return false;
          });
          if (play) { play.click(); return 'play-near-sexy'; }
          return '';
        }"""
    )
    if not clicked:
        logger.error("%s: khong tim thay nut SEXY CASINO / Vao tro choi", sid)
        return False
    logger.info("%s: click=%s — cho tab AE SEXY...", sid, clicked)

    # Co the hien popup can login
    await page.wait_for_timeout(1000)
    try:
        need_login = await page.evaluate(
            """() => {
              const t = (document.body && document.body.innerText) || '';
              if (/vui\\s*lòng\\s*đăng\\s*nhập/i.test(t)) return true;
              const dlg = [...document.querySelectorAll('.el-dialog')].find(d => {
                const r = d.getBoundingClientRect();
                if (r.width < 2) return false;
                const title = ((d.querySelector('.el-dialog__title') || {}).textContent || '');
                return /đăng\\s*nhập/i.test(title);
              });
              return !!dlg;
            }"""
        )
        if need_login:
            logger.error("%s: bi chan — can dang nhap truoc khi vao SEXY", sid)
            return False
    except Exception:
        pass

    for i in range(60):
        await page.wait_for_timeout(500)
        best, phase = await find_ae_sexy_page(ctx, table_name, site_id=sid)
        if not best or foreign_shell_page(best, sid):
            continue
        if phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING):
            bind_page_site(best, sid)
            try:
                await best.bring_to_front()
            except Exception:
                pass
            if phase in (PHASE_LOBBY, PHASE_ROOM) or await is_ae_sexy_lobby(best):
                logger.info("%s: da vao sanh AE SEXY (SEXY card)", sid)
                return True
            if phase == PHASE_LOADING and i >= 6:
                if await wait_for_ae_sexy_lobby(best, timeout_sec=12, table_name=table_name):
                    return True
        if i > 0 and i % 10 == 0:
            logger.info("%s: cho tab AE SEXY... (%ds) phase=%s", sid, i // 2, phase)

    logger.error("%s: khong mo duoc tab AE SEXY sau click SEXY card", sid)
    return False


async def enter_ae_sexy_hall_casino_iframe(
    page: Page,
    table_name: str = "",
    *,
    _from_recovery: bool = False,
    force_relaunch: bool = False,
    casino_url: str | None = None,
) -> bool:
    """Nhanh vipbet-like: trang /casino + #iframe_game + click AE SEXY / Vao choi."""
    from src.sites import bind_page_site, get_active_site

    force_relaunch = force_relaunch or _from_recovery
    site = get_active_site()
    casino_url = casino_url or site.info.casino_url()
    bind_page_site(page, site.info.id)

    # Da trong ban — khong doi sanh / khong click Vao choi lai
    if not force_relaunch:
        try:
            if await is_ae_sexy_in_room(page, table_name):
                logger.info("Da trong ban AE SEXY — bo qua vao sanh")
                return True
        except Exception:
            pass

    fatal, fatal_reason = await is_casino_fatal_error(page)
    if fatal:
        logger.warning("Loi casino 1008 — xoa iframe/token cu: %s", (fatal_reason or "")[:80])
        if not await _clear_casino_fatal_page(page):
            return False
        force_relaunch = True
    elif force_relaunch:
        await close_game_overlay(page)
        await teardown_game_iframe(page)
        await page.wait_for_timeout(1500)

    if not _from_recovery and await is_game_session_expired(page, table_name):
        if await is_ae_sexy_in_room(page, table_name):
            logger.debug("Bo qua session het han gia — van trong ban")
        else:
            logger.warning("Session game het han — khoi phuc truoc khi vao sanh")
            if await recover_ae_sexy_session_expired(page, table_name):
                return await is_ae_sexy_lobby(page) or await wait_for_ae_sexy_lobby(page, 30, table_name)
            return False

    if await is_ae_sexy_lobby(page):
        logger.info("Da o sanh AE SEXY")
        return True

    if not force_relaunch:
        await ensure_game_overlay_visible(page)
        if await _lobby_already_open(page):
            logger.info("Da o sanh AE SEXY (iframe hien %d+ ban)", len(await _list_tables_in_frames(page)))
            return True

        if await _game_launched(page):
            if await dismiss_ae_sexy_welcome_back(page):
                await page.wait_for_timeout(3000)
                if await is_ae_sexy_lobby(page):
                    return True
            elif await is_ae_sexy_welcome_back(page):
                logger.warning("Man hinh welcome-back — thu tro ve game...")
                if await dismiss_ae_sexy_welcome_back(page):
                    await page.wait_for_timeout(3000)
                    if await is_ae_sexy_lobby(page):
                        return True
            logger.info("Iframe game dang load — cho sanh...")
            await ensure_game_overlay_visible(page)
            # Co the da vao ban (khong phai sanh) — khong treo cho lobby
            if await is_ae_sexy_in_room(page, table_name):
                logger.info("Iframe da vao ban — bo qua cho sanh")
                return True
            if await is_game_session_expired(page):
                logger.warning("Iframe load nhung session het han — khoi phuc...")
                if await recover_ae_sexy_session_expired(page, table_name):
                    return True
            elif await wait_for_ae_sexy_lobby(page, timeout_sec=75, table_name=table_name):
                return True
            # Timeout sanh nhung van trong ban → coi thanh cong
            if await is_ae_sexy_in_room(page, table_name):
                logger.info("Cho sanh timeout nhung dang trong ban — OK")
                return True
    else:
        await close_game_overlay(page)
        await teardown_game_iframe(page)
        await page.wait_for_timeout(1000)

    if not site.info.is_casino_url(page.url or ""):
        await page.goto(casino_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)
        bind_page_site(page, site.info.id)
    elif await is_ae_sexy_promo_visible(page):
        logger.info("Dang o trang casino AE SEXY promo")
        await page.wait_for_timeout(1000)
    elif await is_game_alive(page) or await is_ae_sexy_lobby(page):
        logger.info("Da trong game AE SEXY hop le — khong reload trang web")
        await ensure_game_overlay_visible(page)
    elif await _game_launched(page) and await is_game_session_expired(page):
        logger.warning("Game iframe het session — dong va vao lai")
        await close_game_overlay(page)
        await page.wait_for_timeout(2000)
    else:
        await page.reload(wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)

    for attempt in range(1, ENTER_RETRY_MAX + 1):
        logger.info("Thu vao AE SEXY (lan %d/%d)...", attempt, ENTER_RETRY_MAX)
        if not await _click_ae_sexy_enter(page, force_relaunch=force_relaunch and attempt == 1):
            await page.wait_for_timeout(ACTION_PAUSE_MS)
            continue

        if not await _wait_iframe_ready(page, timeout_sec=30):
            logger.warning("Iframe game chua hien sau click (lan %d)", attempt)
            await page.wait_for_timeout(ACTION_PAUSE_MS)
            continue

        await page.wait_for_timeout(HALL_LOAD_WAIT_MS)

        if await wait_for_ae_sexy_lobby(page, timeout_sec=60, table_name=table_name):
            return True

        if await is_ae_sexy_promo_visible(page):
            logger.warning("Van o trang promo — thu lai...")
            await page.wait_for_timeout(ACTION_PAUSE_MS * 2)
            continue

        logger.warning("Sanh chua load sau lan %d", attempt)
        await page.wait_for_timeout(ACTION_PAUSE_MS * 2)

    return False


async def _all_frames(page: Page) -> list[Frame]:
    return list(page.frames)


async def _ae_sexy_frame(page: Page) -> Frame | None:
    for frame in page.frames:
        url = frame.url or ""
        if any(h in url for h in AE_SEXY_HOSTS):
            return frame
    loc = page.locator("#iframe_game")
    if await loc.count():
        el = await loc.element_handle()
        if el:
            frame = await el.content_frame()
            if frame:
                return frame
    return None


async def list_ae_sexy_tables(page: Page) -> list[str]:
    if not await is_ae_sexy_lobby(page) and not await _lobby_grid_visible(page):
        return []
    for attempt in range(12):
        tables = await _list_tables_in_frames(page)
        if not tables:
            # Provider webMain: dem the tren document
            try:
                tables = await page.evaluate(
                    """() => {
                      const found = new Map();
                      for (const el of document.querySelectorAll('div, span, p, h3, h4, label, a')) {
                        const t = (el.textContent || '').trim();
                        if (t.length < 8 || t.length > 36) continue;
                        const m = t.match(/^Baccarat\\s+(C\\d{1,3})$/i);
                        if (m) found.set(m[1].toUpperCase(), 'Baccarat ' + m[1].toUpperCase());
                        if (found.size >= 40) break;
                      }
                      return [...found.values()];
                    }"""
                )
            except Exception:
                tables = []
        if tables:
            return list(tables)
        if attempt % 3 == 0:
            await scroll_ae_sexy_lobby(page)
        await page.wait_for_timeout(800)
    return []


async def _wait_room_entry(page: Page, table_name: str, timeout_sec: float = 20.0) -> bool:
    """Cho iframe ban load sau click/nav — khong kiem tra ngay lap tuc."""
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        if await _is_ae_sexy_loading_zombie(page):
            return False
        if await is_ae_sexy_in_room(page, table_name):
            return True
        if await _shell_has_nested(page, _ROOM_IFRAME_PAT):
            mode = await _get_shell_mode(page)
            # "loading" co the la man den Loading — chi chap nhan room that
            if mode == "room":
                return True
        await page.wait_for_timeout(500)
    return False


async def _click_table_in_hall(page: Page, table_name: str) -> bool:
    """Click the ban tren sanh — an overlay, scroll den the, click chinh xac."""
    try:
        await page.bring_to_front()
    except Exception:
        pass
    await _hide_overlay_for_click(page)
    # Da trong ban (chip) — KHONG bat sanh (an #iframeGame → man den)
    hall_vis = await _gamehall_iframe_visible(page)
    lobby_grid = await _lobby_grid_visible(page)
    if (
        await _has_visible_room_bet_ui(page)
        and not hall_vis
        and not lobby_grid
    ):
        logger.info("Bo qua click sanh %s — dang co UI cuoc trong ban", table_name)
        return True
    # Bat buoc sanh HIEN — click hall an (visibility:hidden) khong vao ban
    # Provider/webMain: luoi the ban tren document = sanh OK, khong can #iframeGameHall
    if not hall_vis and not lobby_grid:
        if await _is_ae_sexy_loading_zombie(page):
            logger.warning("Sanh an + Loading zombie — bat #iframeGameHall truoc khi click ban")
        else:
            logger.warning("Sanh AE SEXY dang an — bat #iframeGameHall truoc khi click ban")
        if not await go_ae_sexy_lobby(page):
            logger.warning("Khong bat duoc sanh de click ban %s", table_name)
            return False
        await page.wait_for_timeout(800)
    elif not hall_vis and lobby_grid:
        logger.info(
            "Sanh provider/webMain hien (luoi ban) — click the %s tren document",
            table_name,
        )
    await scroll_lobby_to_table(page, table_name)
    await page.wait_for_timeout(500)
    table_name = normalize_baccarat_table_name(table_name)
    short = table_name.split()[-1] if table_name else "C01"
    full = table_name if (table_name or "").lower().startswith("baccarat") else f"Baccarat {short}"

    # Provider webMain: uu tien click tren document (khong can iframe gamehall)
    if lobby_grid and not hall_vis:
        try:
            loc = page.locator("div.cursor-pointer").filter(has_text=full).first
            if await loc.count():
                await loc.scroll_into_view_if_needed(timeout=8000)
                await loc.click(timeout=10000)
                logger.info("Click the ban %s (provider document locator)", table_name)
                return True
        except Exception as exc:
            logger.debug("Click provider document locator: %s", exc)
        # Mouse theo toa do the (overlay thuong che nut Playwright)
        try:
            pos = await page.evaluate(
                """(tableName) => {
                  const m = String(tableName || '').match(/C(\\d{1,3})/i);
                  if (!m) return null;
                  const num = String(parseInt(m[1], 10));
                  const nameRe = new RegExp('Baccarat\\\\s*C0*' + num + '(?!\\\\d)', 'i');
                  let best = null, bestScore = -1;
                  for (const el of document.querySelectorAll('div.cursor-pointer, div[class*="cursor-pointer"], div')) {
                    if (el.closest('#toolbet-ui-v2')) continue;
                    const t = el.textContent || '';
                    if (!nameRe.test(t)) continue;
                    const names = t.match(/Baccarat\\s*C\\d+/gi) || [];
                    if (names.length > 2) continue;
                    const r = el.getBoundingClientRect();
                    if (r.width < 100 || r.height < 70) continue;
                    if (r.width > 520 || r.height > 320) continue;
                    let score = r.width * r.height;
                    if (/cursor-pointer/i.test(String(el.className || ''))) score += 100000;
                    if (r.top >= 0 && r.left >= 0 && r.bottom < innerHeight && r.right < innerWidth)
                      score += 200000;
                    if (score > bestScore) { bestScore = score; best = r; }
                  }
                  if (!best) return null;
                  return { x: best.left + best.width / 2, y: best.top + best.height * 0.35 };
                }""",
                table_name,
            )
            if pos and pos.get("x") is not None:
                await page.mouse.click(float(pos["x"]), float(pos["y"]))
                logger.info(
                    "Click the ban %s (provider mouse %.0f,%.0f)",
                    table_name,
                    float(pos["x"]),
                    float(pos["y"]),
                )
                return True
        except Exception as exc:
            logger.debug("Click provider mouse: %s", exc)
        doc_fn_early = f"""(tableName) => {{
          const args = [tableName];
          {_CLICK_TABLE_IN_DOC_BODY}
        }}"""
        try:
            res = await page.evaluate(doc_fn_early, table_name)
            if res and res.get("ok"):
                logger.info(
                    "Click the ban %s (provider document JS %dx%d)",
                    table_name,
                    int(res.get("w") or 0),
                    int(res.get("h") or 0),
                )
                return True
        except Exception as exc:
            logger.debug("Click provider document JS: %s", exc)

    hall_fl = await _gamehall_frame_locator(page)
    try:
        loc = hall_fl.locator("div.cursor-pointer").filter(has_text=full).first
        if await loc.count():
            await loc.scroll_into_view_if_needed(timeout=8000)
            await loc.click(timeout=10000)
            logger.info("Click the ban %s (gamehall frame_locator)", table_name)
            return True
    except Exception as exc:
        logger.debug("Click gamehall frame_locator: %s", exc)
    hall_frame = await _gamehall_playwright_frame(page)
    if hall_frame:
        try:
            loc = hall_frame.locator("div.cursor-pointer").filter(has_text=full).first
            if await loc.count():
                await loc.scroll_into_view_if_needed(timeout=8000)
                await loc.click(timeout=10000)
                logger.info("Click the ban %s (gamehall frame)", table_name)
                return True
        except Exception as exc:
            logger.debug("Click gamehall frame: %s", exc)
    fn = _shell_iframe_js(_CLICK_TABLE_IN_HALL_BODY)
    for frame in await _outer_nav_shell_frames(page):
        try:
            res = await frame.evaluate(fn, table_name)
            if res and res.get("ok"):
                logger.info(
                    "Click the ban %s (gamehall JS %dx%d)",
                    table_name,
                    int(res.get("w") or 0),
                    int(res.get("h") or 0),
                )
                return True
            if res and res.get("err") == "hall_hidden":
                logger.warning("Click gamehall JS: hall_hidden — thu bat sanh")
                await go_ae_sexy_lobby(page)
                continue
            if res and res.get("err"):
                logger.warning("Click gamehall JS %s: %s", table_name, res.get("err"))
        except Exception as exc:
            logger.debug("Click gamehall JS: %s", exc)
    doc_fn = f"""(tableName) => {{
      const args = [tableName];
      {_CLICK_TABLE_IN_DOC_BODY}
    }}"""
    for frame in [page.main_frame, *await _game_shell_frames(page)]:
        try:
            res = await frame.evaluate(doc_fn, table_name)
            if res and res.get("ok"):
                logger.info(
                    "Click the ban %s (document JS %dx%d)",
                    table_name,
                    int(res.get("w") or 0),
                    int(res.get("h") or 0),
                )
                return True
            if res and res.get("err"):
                logger.warning("Click document JS %s: %s", table_name, res.get("err"))
        except Exception as exc:
            logger.debug("Click document JS: %s", exc)
    try:
        loc = page.get_by_text(full, exact=True).first
        if await loc.count():
            await loc.scroll_into_view_if_needed(timeout=8000)
            card = page.locator("div.cursor-pointer").filter(has_text=full).first
            if await card.count():
                await card.click(timeout=10000)
            else:
                await loc.click(timeout=10000)
            logger.info("Click the ban %s (page exact text)", table_name)
            return True
    except Exception as exc:
        logger.debug("Click page exact: %s", exc)
    logger.warning("Khong click duoc the ban %s tren sanh (chua scroll toi?)", table_name)
    return False


async def _navigate_to_table_href(frame: Frame, table_name: str) -> bool:
    """KHONG DUNG — doc.href trong gamehall gay man den (WS song nhung video chet)."""
    logger.warning(
        "Bo qua doc.href vao ban %s — chi click sanh moi load duoc video",
        table_name,
    )
    return False


async def _navigate_to_table_shell(frame: Frame, table_name: str) -> bool:
    """Deprecated — khong dung programmatic nav vao ban."""
    return await _navigate_to_table_href(frame, table_name)


async def _room_entry_looks_ok(page: Page, table_name: str = "") -> bool:
    from src.ae_sexy_state import probe_in_room

    probe = await probe_game_state(page, table_name)
    return probe_in_room(probe, table_name)


async def _confirm_room_entry(page: Page, table_name: str, timeout_sec: float = 20.0) -> bool:
    """Cho vao ban — cung tieu chi voi wait_for_ae_sexy_in_room."""
    if await _room_has_broken_stream(page):
        logger.warning("Phat hien man den sau vao ban %s", table_name)
        return False
    probe = await wait_for_game_position(
        page,
        table_name=table_name,
        want_in_room=True,
        timeout_sec=timeout_sec,
    )
    return probe is not None


async def enter_ae_sexy_table(page: Page, table_name: str, *, fresh_token: bool = False) -> bool:
    from src.ae_sexy_state import probe_in_room

    table_name = normalize_baccarat_table_name(table_name)
    page = await switch_to_ae_sexy_page(page, table_name)
    await _dismiss_ae_sexy_connection_dialogs(page)

    # Da trong ban (chip) — KHONG go_lobby (sanh an khi dang choi la binh thuong)
    lobby_grid = await _lobby_grid_visible(page)
    if (
        await _has_visible_room_bet_ui(page)
        and not await _gamehall_iframe_visible(page)
        and not lobby_grid
    ):
        logger.info("Da trong ban %s (chip/zone) — bo qua vao lai", table_name)
        return True

    # Chi bat sanh khi zombie Loading that — KHONG bat sanh chi vi hall an (dang trong ban)
    if await _is_ae_sexy_loading_zombie(page):
        logger.warning("Phat hien man den Loading (iframeGame zombie) — bat sanh")
        await go_ae_sexy_lobby(page, force=True)
        await page.wait_for_timeout(1500)
        page = await switch_to_ae_sexy_page(page, table_name)
    elif not await _gamehall_iframe_visible(page) and not lobby_grid:
        # Hall an: chi mo sanh neu CHAC khong trong ban
        if not await is_ae_sexy_in_room(page, table_name):
            logger.info("Sanh dang an va chua trong ban — bat #iframeGameHall")
            await go_ae_sexy_lobby(page)
            await page.wait_for_timeout(1000)
            page = await switch_to_ae_sexy_page(page, table_name)

    probe = await probe_game_state(page, table_name)
    # Sanh nhieu ban — KHONG bo qua click (false positive "da trong ban")
    # Chi coi sanh khi shell/UI sanh RO — khong dung lobby_tables tu hall an
    lobby_open = (
        lobby_grid
        or probe.shell_mode == "lobby"
        or await is_ae_sexy_lobby(page)
        or await _gamehall_iframe_visible(page)
    )
    if probe_in_room(probe, table_name) and not lobby_open:
        if not (probe.stream.get("blackScreen") and probe.stream.get("streamDead")):
            if not await _room_has_broken_stream(page):
                logger.info("Da trong ban %s — bo qua click", table_name)
                return True
        logger.warning("Trong ban %s nhung stream loi — quay ve sanh click lai", table_name)
        await go_ae_sexy_lobby(page, force=True)
        await page.wait_for_timeout(2500)
        page = await switch_to_ae_sexy_page(page, table_name)
    elif probe_in_room(probe, table_name) and lobby_open:
        # Hall an con DOM nhung dang trong ban (chip/stream) — dung click
        # Neu luoi sanh RO → van phai click
        if lobby_grid or await is_ae_sexy_lobby(page):
            logger.warning(
                "Sanh dang hien (luoi ban) — khong bo qua click %s du probe room",
                table_name,
            )
        else:
            try:
                from src.ae_sexy_betting import probe_betting_phase
                from src.ae_sexy_state import _clearly_in_room_probe

                bet_ui = await probe_betting_phase(page)
                if bet_ui.get("chipsVisible") or bet_ui.get("zoneVisible"):
                    if await _gamehall_iframe_visible(page):
                        # Hall dang hien = dang o sanh, khong phai trong ban
                        pass
                    else:
                        logger.info("Da trong ban %s (chip/zone) — bo qua click sanh", table_name)
                        return True
                if _clearly_in_room_probe(probe) and not await _gamehall_iframe_visible(page):
                    logger.info("Da trong ban %s (probe room) — bo qua click sanh", table_name)
                    return True
            except Exception:
                pass
    elif await is_ae_sexy_lobby(page) or lobby_grid:
        pass

    await _fix_broken_hall_iframe(page)

    # Hall an + room zombie: bat sanh truoc
    if (
        not await _gamehall_iframe_visible(page)
        and not lobby_grid
        and not await is_ae_sexy_in_room(page, table_name)
    ):
        logger.info("Sanh dang an — bat #iframeGameHall truoc khi chon ban")
        await go_ae_sexy_lobby(page)
        await page.wait_for_timeout(1500)
        page = await switch_to_ae_sexy_page(page, table_name)

    if await has_ae_sexy_room_ui(page) and not await is_ae_sexy_lobby(page) and not lobby_grid:
        if not await is_room_fully_loaded(page, table_name):
            logger.info("Ban rong (URL doi nhung chua load) — quay ve sanh de thu lai")
            await go_ae_sexy_lobby(page)
            await page.wait_for_timeout(3000)
            page = await switch_to_ae_sexy_page(page, table_name)

    if (
        not await is_ae_sexy_lobby(page)
        and not lobby_grid
        and not await _game_launched(page)
    ):
        logger.warning(
            "Chua o sanh AE SEXY — khong click ban %s (url=%s)",
            table_name,
            (page.url or "")[:80],
        )
        return False

    await _hide_overlay_for_click(page)
    try:
        await scroll_lobby_to_table(page, table_name)
        await page.wait_for_timeout(800)
        await ensure_lobby_ready(page, timeout_sec=20, table_name=table_name)

        ids = table_name_to_ids(table_name)
        logger.info("Dang chon ban %s (tableID=%s)...", table_name, ids[0] if ids else "?")

        for attempt in range(3):
            if attempt:
                await scroll_lobby_to_table(page, table_name)
                await page.wait_for_timeout(600)
                if not await is_ae_sexy_lobby(page) and not await _lobby_grid_visible(page):
                    await go_ae_sexy_lobby(page)
                    await page.wait_for_timeout(2000)
                    await scroll_lobby_to_table(page, table_name)

            if await _click_table_in_hall(page, table_name):
                if await _confirm_room_entry(page, table_name, timeout_sec=25):
                    logger.info("Da vao ban %s (click sanh)", table_name)
                    return True
                if await _room_has_broken_stream(page):
                    logger.warning("Click sanh stream loi — quay ve sanh thu lai")
                    await go_ae_sexy_lobby(page)
            else:
                probe = await wait_for_game_position(
                    page, table_name=table_name, want_in_room=True, timeout_sec=15
                )
                if probe:
                    logger.info("Da vao ban %s (probe sau click)", table_name)
                    return True
                logger.warning(
                    "Click sanh chua vao ban — %s",
                    (await probe_game_state(page, table_name)).summary(),
                )
                await go_ae_sexy_lobby(page)
            await page.wait_for_timeout(2000)

        pos_fn = _wrap_nested_js(_GET_TABLE_CARD_POS_BODY, "gamehall")
        screen_fn = _shell_iframe_js(_GET_TABLE_SCREEN_POS_BODY)
        iframe_loc = page.locator("#iframe_game")

        for attempt in range(2):
            if attempt:
                await scroll_lobby_to_table(page, table_name)
                await page.wait_for_timeout(600)

            for frame in await _lobby_frames(page):
                try:
                    screen = await frame.evaluate(screen_fn, table_name)
                    if screen and await iframe_loc.count():
                        box = await iframe_loc.bounding_box()
                        if box:
                            px = box["x"] + screen["x"]
                            py = box["y"] + screen["y"]
                            await page.mouse.click(px, py)
                            logger.debug("Click ban %s (mouse %.0f,%.0f)", table_name, px, py)
                            if await _confirm_room_entry(page, table_name, timeout_sec=15):
                                logger.info("Da click vao ban %s (mouse)", table_name)
                                return True
                        if await _os_click_viewport(page, screen["x"], screen["y"]):
                            if await _confirm_room_entry(page, table_name, timeout_sec=15):
                                logger.info("Da click vao ban %s (OS)", table_name)
                                return True
                except Exception as exc:
                    logger.debug("Click ban %s (mouse/os): %s", table_name, exc)

                try:
                    pos = await frame.evaluate(pos_fn, table_name)
                    if not pos or not pos.get("w"):
                        logger.debug("Khong tim thay the ban %s tren sanh (lan %d)", table_name, attempt + 1)
                        continue
                    if await iframe_loc.count():
                        await iframe_loc.click(
                            position={"x": pos["x"], "y": pos["y"]},
                            timeout=10000,
                        )
                        logger.debug(
                            "Click ban %s (iframe %.0f,%.0f %dx%d)",
                            table_name,
                            pos["x"],
                            pos["y"],
                            int(pos.get("w") or 0),
                            int(pos.get("h") or 0),
                        )
                        if await _confirm_room_entry(page, table_name, timeout_sec=15):
                            logger.info("Da click vao ban %s (iframe)", table_name)
                            return True
                except Exception as exc:
                    logger.debug("Click ban %s (iframe): %s", table_name, exc)
    finally:
        await _restore_overlay_after_click(page)

    if await _shell_has_nested(page, _ROOM_IFRAME_PAT):
        if await _room_has_broken_stream(page):
            logger.warning("Co iframe ban nhung man den — quay ve sanh")
            await go_ae_sexy_lobby(page)
            return False
        detected = await detect_room_table_name(page)
        stream = await probe_room_stream_health(page)
        if stream.get("streamOk"):
            if not table_name or not detected or _table_codes_match(table_name, detected):
                logger.info(
                    "Xac nhan trong ban %s (iframe room, detect=%s)",
                    table_name,
                    detected or "?",
                )
                return True
        logger.warning(
            "Co iframe ban %s nhung chua co stream video — cho tiep",
            table_name,
        )
        if await wait_for_room_stream_ready(page, table_name, timeout_sec=10):
            return True
        if await _room_has_broken_stream(page):
            await go_ae_sexy_lobby(page)
        return False

    logger.warning("Khong vao duoc ban %s", table_name)
    return False


_ROOM_INFO_BODY = """
  const hasRoad = !!document.querySelector('[class*="road_zone"]');
  const text = document.body?.innerText || '';
  const hasStats = /B\\s*\\d+[^\\d]{0,12}P\\s*\\d+[^\\d]{0,12}T\\s*\\d+/i.test(text);
  const hasBet = /Đặt cược|Đang mở bài|Place your bet/i.test(text);
  const hasChip = !!(document.getElementById('chipBoxPlayer')
    || document.getElementById('chipBoxBanker')
    || document.querySelector('#chips .chips3d'));
  const tables = [...new Set([...text.matchAll(/Baccarat C\\d+/gi)].map(m => m[0]))];
  // Khi co chip: ten ban hall an trong body.innerText KHONG tinh sanh
  let tableCount = tables.length;
  let isLobby = tableCount >= 3;
  if (hasChip) {
    isLobby = false;
    tableCount = Math.min(tableCount, 1);
  }
  return { hasRoad, hasStats, hasBet, hasChip, tables, tableCount, isLobby, text };
"""


async def has_ae_sexy_table_frame(page: Page) -> bool:
    """Co frame singleBacTable trong iframe hien thi."""
    return bool(await _room_frames(page))


async def is_ae_sexy_in_room(page: Page, table_name: str = "", collector=None) -> bool:
    """Kiem tra dang trong ban — derive tu probe_game_state (SSOT)."""
    from src.ae_sexy_state import probe_in_room

    probe = await probe_game_state(page, table_name, collector)
    return probe_in_room(probe, table_name)


async def is_ae_sexy_table_ready(page: Page, table_name: str = "", collector=None) -> bool:
    """Trong ban VA game da load — derive tu probe_game_state (SSOT)."""
    from src.ae_sexy_state import probe_table_ready

    probe = await probe_game_state(page, table_name, collector)
    return probe_table_ready(probe, table_name)


async def wait_for_ae_sexy_table_ready(
    page: Page, table_name: str, timeout_sec: int = 60
) -> bool:
    """Cho game trong ban khoi tao xong — cung probe SSOT."""
    probe = await wait_for_game_position(
        page,
        table_name=table_name,
        want_table_ready=True,
        timeout_sec=timeout_sec,
    )
    return probe is not None


async def detect_room_table_name(page: Page) -> str:
    """Tim ten ban neu dang trong phong — uu tien frame phong choi."""
    fn = _wrap_nested_js(_FRAME_TABLE_NAME_BODY, _ROOM_IFRAME_PAT)
    for frame in await _room_frames(page):
        try:
            name = await frame.evaluate(fn)
            if name:
                return name
        except Exception:
            continue
    return ""


async def _read_room_info_quick(page: Page) -> dict:
    room_fn = _wrap_nested_js(_ROOM_INFO_BODY, _ROOM_IFRAME_PAT)
    for frame in await _game_shell_frames(page):
        try:
            info = await frame.evaluate(room_fn)
            if info:
                return info
        except Exception:
            continue
    return {}


async def probe_game_state(page: Page, table_name: str = "", collector=None):
    """Thu thap tin hieu + phan loai vi tri — SSOT cho moi quyet dinh."""
    from src.ae_sexy_state import build_probe

    try:
        on_provider_doc = is_ae_sexy_url(page.url or "")
    except Exception:
        on_provider_doc = False

    # Shell mode TRUOC — sanh/room ro thi bo qua fatal/stream nang (tranh treo CDP)
    shell_mode = "none"
    try:
        shell_mode = await asyncio.wait_for(_get_shell_mode(page), timeout=2.5)
    except Exception:
        shell_mode = "none"

    game_launched = on_provider_doc or shell_mode in ("lobby", "room", "loading")
    if not game_launched:
        try:
            game_launched = await asyncio.wait_for(_game_launched(page), timeout=3.0)
        except Exception:
            game_launched = False

    iframe_visible = bool(on_provider_doc and game_launched)
    if not iframe_visible and game_launched:
        try:
            iframe_visible = await asyncio.wait_for(
                is_game_iframe_visible(page), timeout=3.0
            )
        except Exception:
            iframe_visible = on_provider_doc

    fatal, fatal_reason = False, ""
    promo = False
    welcome = False
    lobby_tables: list[str] = []
    stream: dict = {}
    room_table = ""
    has_nested = False
    dom_stats: dict = {}
    room_info: dict = {}
    session_expired = False

    # SANH ro: khong quet fatal/stream/session (do do treo + nham WEB)
    # Chi short-circuit khi gamehall THUC SU hien — tranh false lobby khi dang trong ban
    if shell_mode == "lobby":
        hall_really = False
        try:
            hall_really = await asyncio.wait_for(
                _gamehall_iframe_visible(page), timeout=2.0
            )
        except Exception:
            hall_really = False
        has_bet_ui = False
        try:
            has_bet_ui = await asyncio.wait_for(
                _has_visible_room_bet_ui(page), timeout=2.5
            )
        except Exception:
            has_bet_ui = False
        if not hall_really or has_bet_ui:
            # Hall an / dang co chip → dang trong ban, khong short-circuit lobby
            shell_mode = "room" if has_bet_ui else "loading"
        else:
            try:
                lobby_tables = await asyncio.wait_for(
                    _list_tables_in_frames(page), timeout=5.0
                )
            except Exception:
                lobby_tables = []
            feed_healthy = False
            history_len = 0
            if collector is not None:
                history_len = len(collector.state.history)
                feed_healthy = collector.is_feed_healthy(
                    table_name or collector.table_name or ""
                )
            return build_probe(
                game_launched=True,
                iframe_visible=True,
                promo_visible=False,
                welcome_back=False,
                session_expired=False,
                fatal_error=False,
                fatal_reason="",
                shell_mode="lobby",
                lobby_tables=lobby_tables,
                stream={},
                room_info={"isLobby": True, "tableCount": max(len(lobby_tables), 3)},
                feed_healthy=feed_healthy,
                history_len=history_len,
                has_nested_room=False,
                dom_stats={},
                room_table="",
            )

    if game_launched:
        try:
            fatal, fatal_reason = await asyncio.wait_for(
                is_casino_fatal_error(page), timeout=4.0
            )
        except Exception:
            fatal, fatal_reason = False, ""
        try:
            promo = await asyncio.wait_for(is_ae_sexy_promo_visible(page), timeout=2.0)
        except Exception:
            promo = False

    if game_launched and not fatal:
        try:
            welcome = await asyncio.wait_for(
                is_ae_sexy_welcome_back(page), timeout=2.0
            )
        except Exception:
            welcome = False
        # shell=room: KHONG dem the sanh an — tranh pos=game_lobby khi da trong ban
        if shell_mode == "room":
            lobby_tables = []
        else:
            try:
                lobby_tables = await asyncio.wait_for(
                    _list_tables_in_frames(page), timeout=5.0
                )
            except Exception:
                lobby_tables = []
            if shell_mode in ("none", "unknown") and len(lobby_tables) >= 2:
                shell_mode = "lobby"
        # Probe stream/room khi dang room/loading — ke ca hall an con nhieu ten ban
        if shell_mode in ("room", "loading") or (
            shell_mode != "lobby" and len(lobby_tables) < 2
        ):
            try:
                stream = await asyncio.wait_for(
                    probe_room_stream_health(page), timeout=4.0
                )
            except Exception:
                stream = {}
            try:
                room_table = await asyncio.wait_for(
                    detect_room_table_name(page), timeout=3.0
                )
            except Exception:
                room_table = ""
            try:
                has_nested = await asyncio.wait_for(
                    _shell_has_nested(page, _ROOM_IFRAME_PAT), timeout=2.0
                )
            except Exception:
                has_nested = False
            try:
                dom_stats = await asyncio.wait_for(
                    _read_room_stats_quick(page), timeout=3.0
                )
            except Exception:
                dom_stats = {}
            try:
                room_info = await asyncio.wait_for(
                    _read_room_info_quick(page), timeout=3.0
                )
            except Exception:
                room_info = {}
            # Trong ban: khong de room_info.isLobby tu hall an
            if shell_mode == "room":
                if room_info.get("isLobby") or int(room_info.get("tableCount") or 0) >= 3:
                    room_info = {
                        **room_info,
                        "isLobby": False,
                        "tableCount": 1,
                        "tables": [room_table] if room_table else room_info.get("tables") or [],
                    }
                # Chip tu betting/stream neu room_info thieu
                if not room_info.get("hasChip") and (
                    stream.get("hasBet") or has_nested
                ):
                    try:
                        from src.ae_sexy_betting import probe_betting_phase

                        bet = await asyncio.wait_for(probe_betting_phase(page), timeout=2.0)
                        if bet.get("chipsVisible") or bet.get("zoneVisible"):
                            room_info = {**room_info, "hasChip": True, "hasBet": True}
                    except Exception:
                        pass
            try:
                if shell_mode != "room":
                    session_expired = await asyncio.wait_for(
                        _session_expired_dom_scan(page), timeout=3.0
                    )
            except Exception:
                session_expired = False
        else:
            room_info = {"isLobby": True, "tableCount": max(len(lobby_tables), 3)}

    feed_healthy = False
    history_len = 0
    if collector is not None:
        history_len = len(collector.state.history)
        feed_healthy = collector.is_feed_healthy(table_name or collector.table_name or "")

    return build_probe(
        game_launched=game_launched,
        iframe_visible=iframe_visible,
        promo_visible=promo,
        welcome_back=welcome,
        session_expired=session_expired,
        fatal_error=fatal,
        fatal_reason=fatal_reason or "",
        shell_mode=shell_mode,
        lobby_tables=lobby_tables,
        stream=stream,
        room_info=room_info,
        feed_healthy=feed_healthy,
        history_len=history_len,
        has_nested_room=has_nested,
        dom_stats=dom_stats,
        room_table=room_table,
    )


async def wait_for_game_position(
    page: Page,
    *,
    table_name: str = "",
    want_in_room: bool = False,
    want_table_ready: bool = False,
    timeout_sec: float = 60,
    collector=None,
):
    """Cho dat vi tri mong muon — cung tieu chi probe, khong gate rieng."""
    from src.ae_sexy_state import probe_in_room, probe_table_ready

    label = "trong ban" if want_in_room else ("san sang" if want_table_ready else "state")
    for i in range(int(timeout_sec * 2)):
        probe = await probe_game_state(page, table_name, collector)
        ok = (
            probe_table_ready(probe, table_name)
            if want_table_ready
            else probe_in_room(probe, table_name)
        )
        if ok:
            await page.wait_for_timeout(1000 if want_in_room else 800)
            probe2 = await probe_game_state(page, table_name, collector)
            ok2 = (
                probe_table_ready(probe2, table_name)
                if want_table_ready
                else probe_in_room(probe2, table_name)
            )
            if ok2:
                logger.info(
                    "Xac nhan %s %s — %s",
                    label,
                    table_name or "?",
                    probe2.summary(),
                )
                return probe2
        if i > 0 and i % 20 == 0:
            logger.info(
                "Cho %s %s... (%ds) %s",
                label,
                table_name or "?",
                i // 2,
                probe.summary(),
            )
        await page.wait_for_timeout(500)
    return None


async def wait_for_ae_sexy_in_room(
    page: Page, table_name: str, timeout_sec: int = 60, collector=None
) -> bool:
    probe = await wait_for_game_position(
        page,
        table_name=table_name,
        want_in_room=True,
        timeout_sec=timeout_sec,
        collector=collector,
    )
    return probe is not None


async def read_table_stats(frame: Frame, table_name: str) -> dict[str, int]:
    try:
        return await frame.evaluate(
            """(tableName) => {
            const el = [...document.querySelectorAll('*')].find(
                e => (e.textContent || '').trim() === tableName
            );
            if (!el) return {};
            let node = el;
            for (let i = 0; i < 10 && node; i++) {
                const text = node.textContent || '';
                const m = text.match(/B\\s*(\\d+).*P\\s*(\\d+).*T\\s*(\\d+)/i);
                if (m) return { banker: +m[1], player: +m[2], tie: +m[3] };
                node = node.parentElement;
            }
            return {};
        }""",
            table_name,
        )
    except Exception:
        return {}


_SESSION_EXPIRED_RE_JS = (
    r"session\s+(has|is)\s+expired|please\s+relogin|please\s+log\s*in\s+to\s+the\s+game\s+again|"
    r"hội thoại của bạn đã kết thúc|đăng nhập lại trò chơi|"
    r"conversation has ended|log in to the game again|"
    r"\b1059\b|status[=:]?\s*1059"
)

_SESSION_EXPIRED_BODY = f"""
  const STRICT_RE = /{_SESSION_EXPIRED_RE_JS}/i;
  const visExpired = (doc) => {{
    if (!doc) return false;
    const win = doc.defaultView || window;
    const vp = (win.innerWidth || 800) * (win.innerHeight || 600);
    for (const el of doc.querySelectorAll('div, section, p, h1, h2, h3, span, button')) {{
      const text = (el.innerText || '').trim();
      if (!text || text.length < 4 || text.length > 320) continue;
      if (!STRICT_RE.test(text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 16) continue;
      const s = win.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (parseFloat(s.opacity || '1') < 0.35) continue;
      if (r.width * r.height < vp * 0.002) continue;
      return true;
    }}
    return false;
  }};
  return {{ expired: visExpired(document), textLen: (document.body?.innerText || '').length }};
"""

_SHELL_SESSION_SCAN_BODY = f"""
  const STRICT_RE = /{_SESSION_EXPIRED_RE_JS}/i;
  const visIframe = (f) => {{
    const r = f.getBoundingClientRect();
    return r.width > 120 && r.height > 120;
  }};
  const visExpired = (doc) => {{
    if (!doc) return false;
    const win = doc.defaultView || window;
    const vp = (win.innerWidth || 800) * (win.innerHeight || 600);
    for (const el of doc.querySelectorAll('div, section, p, h1, h2, h3, span, button')) {{
      const text = (el.innerText || '').trim();
      if (!text || text.length < 4 || text.length > 320) continue;
      if (!STRICT_RE.test(text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 16) continue;
      const s = win.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (parseFloat(s.opacity || '1') < 0.35) continue;
      if (r.width * r.height < vp * 0.002) continue;
      return true;
    }}
    return false;
  }};
  if (visExpired(document)) return {{ expired: true, where: 'shell' }};
  for (const iframe of document.querySelectorAll('iframe')) {{
    if (!visIframe(iframe)) continue;
    try {{
      const doc = iframe.contentDocument;
      if (doc && visExpired(doc)) return {{ expired: true, where: 'child_iframe' }};
    }} catch (_) {{}}
  }}
  return {{ expired: false }};
"""


def _text_is_session_expired(text: str) -> bool:
    return bool(
        re.search(
            r"session\s+(has|is)\s+expired|please\s+relogin|"
            r"please\s+log\s*in\s+to\s+the\s+game\s+again|"
            r"hội thoại của bạn đã kết thúc|đăng nhập lại trò chơi|"
            r"conversation has ended|log in to the game again|"
            r"\b1059\b|status[=:]?\s*1059",
            text or "",
            re.I,
        )
    )


def _url_is_session_expired(url: str) -> bool:
    u = (url or "").lower()
    return bool(
        "status=1059" in u
        or "status%3d1059" in u
        or ("/error" in u and "1059" in u)
        or ("session" in u and "expired" in u and ("velki" in u or "error" in u))
    )


_CASINO_FATAL_RE = re.compile(
    r"oops.*1008|1008.*oops|walletlivetoken|wallet.?live.?token.*not.*match|"
    r"token.*not.*match|is not match.*token|\boops\b.*\b1008\b",
    re.I,
)


def _text_is_casino_fatal(text: str) -> bool:
    t = (text or "").strip()
    if len(t) < 8:
        return False
    # Chi so / "-1" / "1008" don le — KHONG phai man hinh loi
    if re.fullmatch(r"-?\d+", t):
        return False
    return bool(_CASINO_FATAL_RE.search(t))


# Quet DOM loi 1008 — chi overlay/banner ro, KHONG quet ca body sanh (false positive).
_FATAL_SCAN_JS = """() => {
  const RE = /oops[\\s\\S]{0,80}1008|1008[\\s\\S]{0,80}oops|walletlivetoken|wallet\\s*live\\s*token|token[^.]{0,40}not[^.]{0,20}match/i;
  const BAD_ONLY_NUM = /^-?\\d+$/;
  const vis = (doc) => {
    if (!doc) return '';
    const win = doc.defaultView || window;
    const vp = Math.max(1, (win.innerWidth || 800) * (win.innerHeight || 600));
    for (const el of doc.querySelectorAll('h1,h2,h3,p,div,span,section,article,li,td,label,button')) {
      const t = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!t || t.length < 8 || t.length > 500) continue;
      if (BAD_ONLY_NUM.test(t)) continue;
      if (!RE.test(t)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 12) continue;
      try {
        const s = win.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        if (parseFloat(s.opacity || '1') < 0.25) continue;
      } catch (_) {}
      // Can overlay/banner du lon — tranh so '1008' trong the ban/stats sanh
      if (r.width * r.height < vp * 0.008 && t.length < 24) continue;
      return t.slice(0, 160);
    }
    return '';
  };
  const pageHit = vis(document);
  if (pageHit) return { hit: true, snippet: pageHit, where: 'doc' };
  const iframe = document.getElementById('iframe_game');
  if (iframe) {
    try {
      const doc = iframe.contentDocument;
      const iframeHit = vis(doc);
      if (iframeHit) return { hit: true, snippet: iframeHit, where: 'iframe_game' };
    } catch (_) {}
  }
  return { hit: false };
}"""


async def is_casino_fatal_error(page: Page) -> tuple[bool, str]:
    """
    Trang casino loi nghiem trong (Oops/1008/WalletLiveToken).
    Khong bat so le / text nho trong sanh AE SEXY.
    """
    if page.is_closed():
        return False, ""

    # Shell home (khong phai AE SEXY) — khong quet fatal game
    try:
        url = (page.url or "").lower()
        if url and not is_ae_sexy_url(url) and not any(
            x in url for x in ("/casino", "live.html", "webmain", "gamehall", "bactable")
        ):
            return False, ""
    except Exception:
        pass

    # Sanh/room dang hien = khong phai man 1008 (dung shell_mode, KHONG list_tables)
    try:
        mode = await _get_shell_mode(page)
        if mode in ("lobby", "room"):
            return False, ""
    except Exception:
        pass
    try:
        if is_ae_sexy_url(page.url or ""):
            # Dem frame gamehall / ten ban ngan — KHONG body.innerText (treo)
            n = await page.evaluate(
                """() => {
                  const hall = [...document.querySelectorAll('iframe')]
                    .find(f => /gamehall/i.test(f.src || '') && f.clientWidth > 80);
                  if (hall) return 3;
                  let n = 0;
                  for (const el of document.querySelectorAll('div.cursor-pointer, div, span')) {
                    const t = (el.textContent || '').trim();
                    if (/^Baccarat\\s+C\\d{1,3}$/i.test(t)) {
                      n++;
                      if (n >= 2) return n;
                    }
                  }
                  return n;
                }"""
            )
            if int(n or 0) >= 2:
                return False, ""
    except Exception:
        pass

    try:
        hit = await page.evaluate(_FATAL_SCAN_JS)
        if hit and hit.get("hit"):
            reason = (hit.get("snippet") or "").strip()
            if _text_is_casino_fatal(reason) or (
                len(reason) >= 12
                and re.search(r"oops|walletlivetoken|1008", reason, re.I)
            ):
                logger.warning(
                    "Trang casino loi nghiem trong (%s): %s",
                    hit.get("where", "?"),
                    reason[:100],
                )
                return True, reason
    except Exception:
        pass

    for frame in list(page.frames):
        try:
            url = (frame.url or "").lower()
            if url in ("", "about:blank", "about:srcdoc"):
                continue
            hit = await frame.evaluate(_FATAL_SCAN_JS)
            if not hit or not hit.get("hit"):
                continue
            reason = (hit.get("snippet") or "").strip()
            if len(reason) < 8 or re.fullmatch(r"-?\d+", reason):
                continue
            if not (
                _text_is_casino_fatal(reason)
                or re.search(r"oops|walletlivetoken|\\b1008\\b", reason, re.I)
            ):
                continue
            logger.warning(
                "Trang casino loi nghiem trong (frame %s): %s",
                (url[:60] or hit.get("where") or "?"),
                reason[:100],
            )
            return True, reason
        except Exception:
            continue

    return False, ""


CASINO_HOME_URL = "https://vipbet389.com"
CASINO_PAGE_URL = "https://vipbet389.com/casino"


def _site_base_url() -> str:
    try:
        from src.sites import get_active_site

        return get_active_site().info.home_url.rstrip("/")
    except Exception:
        return CASINO_HOME_URL


def _casino_page_url() -> str:
    try:
        from src.sites import get_active_site

        return get_active_site().info.casino_url()
    except Exception:
        return f"{_site_base_url()}/casino"


async def _clear_casino_fatal_page(page: Page, *, max_rounds: int = 4) -> bool:
    """
    Xoa man hinh Oops/1008 (WalletLiveToken) — teardown iframe + tai trang casino sach.
  Khong click 'Vao choi' khi con loi 1008.
    """
    await close_game_overlay(page)
    await teardown_game_iframe(page)
    await page.wait_for_timeout(1200)
    for i in range(max_rounds):
        fatal, reason = await is_casino_fatal_error(page)
        if not fatal:
            return True
        logger.warning(
            "Con loi 1008/token (lan %d/%d): %s",
            i + 1,
            max_rounds,
            (reason or "?")[:90],
        )
        await close_game_overlay(page)
        await teardown_game_iframe(page)
        try:
            if i % 2 == 1:
                await page.goto(_site_base_url() + "/", wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(2000)
            await page.goto(_casino_page_url(), wait_until="domcontentloaded", timeout=60000)
        except Exception as exc:
            logger.debug("Goto casino khi xoa 1008: %s", exc)
        await page.wait_for_timeout(2500)
        try:
            await page.reload(wait_until="domcontentloaded", timeout=60000)
        except Exception:
            pass
        await page.wait_for_timeout(2000)
        await teardown_game_iframe(page)
    fatal, _ = await is_casino_fatal_error(page)
    return not fatal


async def _session_expired_dom_scan(page: Page) -> bool:
    """Quet DOM/URL session het han — bat ca loi 1059 provider."""
    try:
        url = page.url or ""
    except Exception:
        url = ""
    if _url_is_session_expired(url):
        logger.warning("Session game het han (URL 1059): %s", url[:90])
        return True
    try:
        hit = await page.evaluate(
            f"""() => {{
            const STRICT_RE = /{_SESSION_EXPIRED_RE_JS}/i;
            const visExpired = (doc) => {{
                if (!doc) return false;
                const win = doc.defaultView || window;
                const vp = (win.innerWidth || 800) * (win.innerHeight || 600);
                for (const el of doc.querySelectorAll('div, section, p, h1, h2, h3, span, button')) {{
                    const text = (el.innerText || '').trim();
                    if (!text || text.length < 4 || text.length > 320) continue;
                    if (!STRICT_RE.test(text)) continue;
                    const r = el.getBoundingClientRect();
                    if (r.width < 40 || r.height < 16) continue;
                    const s = win.getComputedStyle(el);
                    if (s.display === 'none' || s.visibility === 'hidden') continue;
                    if (parseFloat(s.opacity || '1') < 0.35) continue;
                    if (r.width * r.height < vp * 0.002) continue;
                    return true;
                }}
                return false;
            }};
            if (visExpired(document)) return {{ expired: true, where: 'page' }};
            const iframe = document.getElementById('iframe_game');
            if (!iframe) return {{ expired: false }};
            const ir = iframe.getBoundingClientRect();
            if (ir.width < 120 || ir.height < 120) return {{ expired: false }};
            try {{
                const doc = iframe.contentDocument;
                if (doc && visExpired(doc)) return {{ expired: true, where: 'iframe_game' }};
            }} catch (_) {{}}
            return {{ expired: false }};
        }}"""
        )
        if hit and hit.get("expired"):
            logger.warning("Session game het han (%s)", hit.get("where", "?"))
            return True
    except Exception:
        pass

    try:
        top = await page.evaluate("() => document.body?.innerText || ''")
        if _text_is_session_expired(top):
            if not await _game_launched(page):
                logger.warning("Session game het han (trang chinh)")
                return True
    except Exception:
        pass

    fn = _wrap_nested_js(_SESSION_EXPIRED_BODY, "singlebactable|bactable|gamehall")
    for frame in await _lobby_frames(page):
        try:
            info = await frame.evaluate(fn)
            if info and info.get("expired"):
                logger.warning("Session game het han (iframe ban/sanh)")
                return True
        except Exception:
            continue

    shell_fn = _shell_iframe_js(_SHELL_SESSION_SCAN_BODY)
    for frame in await _game_shell_frames(page):
        try:
            info = await frame.evaluate(shell_fn)
            if info and info.get("expired"):
                logger.warning("Session game het han (%s)", info.get("where", "shell"))
                return True
        except Exception:
            continue

    return False


async def is_game_session_expired(page: Page, table_name: str = "") -> bool:
    """Phat hien man hinh session het han / loi 1059 provider AE SEXY."""
    if page.is_closed():
        return False
    try:
        if _url_is_session_expired(page.url or ""):
            logger.warning("Session het han — URL loi 1059")
            return True
    except Exception:
        pass
    # Sanh/ban dang hien = khong phai session het han (tranh false positive 1008/-1)
    try:
        if await is_ae_sexy_in_room(page, table_name):
            return False
        tables = await _list_tables_in_frames(page)
        if len(tables) >= 2:
            return await _session_expired_dom_scan(page)
        phase = await detect_ae_sexy_phase(page, table_name)
        if phase == PHASE_ROOM:
            return False
        if phase == PHASE_LOBBY:
            return await _session_expired_dom_scan(page)
        stream = await probe_room_stream_health(page)
        if stream.get("hasRoad") or stream.get("hasStats") or stream.get("hasBet"):
            return False
    except Exception:
        pass

    fatal, _ = await is_casino_fatal_error(page)
    if fatal:
        return True

    return await _session_expired_dom_scan(page)


_WELCOME_BACK_SCAN_JS = """
() => {
  const WELCOME_RE = /chào mừng quay trở lại|chao mung quay tro lai|welcome back/i;
  const scan = (doc, where) => {
    const text = doc?.body?.innerText || '';
    if (!WELCOME_RE.test(text)) return null;
    return { welcome: true, where, textLen: text.length };
  };
  let hit = scan(document, 'shell');
  if (hit) return hit;
  const iframe = document.getElementById('iframe_game');
  if (!iframe) return { welcome: false };
  try {
    const doc = iframe.contentDocument;
    hit = scan(doc, 'iframe_game');
    if (hit) return hit;
    for (const inner of doc?.querySelectorAll('iframe') || []) {
      try {
        const d2 = inner.contentDocument;
        hit = scan(d2, 'nested_iframe');
        if (hit) return hit;
      } catch (_) {}
    }
  } catch (_) {}
  return { welcome: false };
}
"""

_WELCOME_BACK_DISMISS_JS = """
() => {
  const WELCOME_RE = /chào mừng quay trở lại|chao mung quay tro lai|welcome back/i;
  const BTN_RE = /trở về game|tro ve game|return to game|back to game/i;
  const tryClick = (doc, where) => {
    const text = doc?.body?.innerText || '';
    if (!WELCOME_RE.test(text)) return null;
    for (const el of doc.querySelectorAll('button, a, div, span, p, h1, h2, h3')) {
      const t = (el.textContent || '').trim();
      if (!BTN_RE.test(t) || t.length > 40) continue;
      const r = el.getBoundingClientRect?.();
      if (!r || r.width < 20 || r.height < 10) continue;
      el.click();
      return { welcome: true, clicked: true, where, text: t };
    }
    return { welcome: true, clicked: false, where };
  };
  let hit = tryClick(document, 'shell');
  if (hit) return hit;
  const iframe = document.getElementById('iframe_game');
  if (!iframe) return { welcome: false, clicked: false };
  try {
    const doc = iframe.contentDocument;
    hit = tryClick(doc, 'iframe_game');
    if (hit) return hit;
    for (const inner of doc?.querySelectorAll('iframe') || []) {
      try {
        const d2 = inner.contentDocument;
        hit = tryClick(d2, 'nested_iframe');
        if (hit) return hit;
      } catch (_) {}
    }
  } catch (_) {}
  return { welcome: false, clicked: false };
}
"""


async def is_ae_sexy_welcome_back(page: Page) -> bool:
    """Man hinh 'Chao mung quay tro lai' + nut Tro ve game — khong phai sanh, khong phai ban."""
    try:
        hit = await page.evaluate(_WELCOME_BACK_SCAN_JS)
        return bool(hit and hit.get("welcome"))
    except Exception:
        return False


async def dismiss_ae_sexy_welcome_back(page: Page) -> bool:
    """Click 'Tro ve game' neu dang o man hinh welcome-back."""
    try:
        hit = await page.evaluate(_WELCOME_BACK_DISMISS_JS)
        if hit and hit.get("clicked"):
            logger.info(
                "Da click '%s' tren man hinh welcome-back (%s)",
                hit.get("text", "?"),
                hit.get("where", "?"),
            )
            return True
        if hit and hit.get("welcome"):
            logger.warning(
                "Man hinh welcome-back (%s) nhung khong click duoc nut",
                hit.get("where", "?"),
            )
    except Exception as exc:
        logger.debug("dismiss welcome back: %s", exc)
    return False


async def is_game_alive(page: Page) -> bool:
    """Game iframe dang chay VA session con hop le."""
    ok, _ = await is_game_ui_alive(page)
    return ok


async def is_stream_zombie(page: Page, table_name: str = "") -> tuple[bool, str]:
    """
  Trong ban nhung stream video/canvas chet — HTTP/WS van song, UI chip/road con.
  Day la trang thai 'zombie' can reload, khong phai dut mang hoan toan.
    """
    fatal, _ = await is_casino_fatal_error(page)
    if fatal:
        return False, ""
    shell = await probe_game_shell_health(page)
    stream = await probe_room_stream_health(page)
    stream_dead = bool(shell.get("streamDead") or stream.get("streamDead"))
    if not stream_dead:
        stream_ok = shell.get("streamOk") if "streamOk" in shell else stream.get("streamOk")
        if stream_ok is False:
            stream_dead = True
    if not stream_dead:
        return False, ""
    has_road = bool(shell.get("hasRoad") or stream.get("hasRoad"))
    black = bool(shell.get("blackScreen") or stream.get("blackScreen") or shell.get("blackCover"))
    in_room = await is_ae_sexy_in_room(page, table_name)
    if black:
        return True, "man hinh den + mat stream video"
    if has_road and in_room:
        return True, "trong ban nhung stream video chet (zombie)"
    if has_road and stream.get("hasStats"):
        return True, "co roadmap nhung stream video chet (zombie)"
    return False, ""


async def is_game_ui_alive(page: Page, table_name: str = "") -> tuple[bool, str]:
    """
    Kiem tra UI game con hien thi binh thuong.
    False = man den / iframe mat / bi chan — can reload truoc khi xu ly tiep.
    """
    if page.is_closed():
        return False, "tab dong"
    try:
        phase = await detect_ae_sexy_phase(page, table_name)
    except Exception as exc:
        return False, f"loi phase: {exc}"
    if phase == PHASE_WEB:
        return False, "roi khoi game (trang web)"

    # Sanh dang mo (nhieu ban) — UI song, khong goi session/fatal (tranh loop)
    try:
        if await _is_ae_sexy_loading_zombie(page):
            return False, "man den Loading (iframeGame zombie)"
        tables = await _list_tables_in_frames(page)
        if len(tables) >= 2 or phase in (PHASE_LOBBY, PHASE_LOADING):
            if await _session_expired_dom_scan(page):
                return False, "session game het han"
            if not await _game_launched(page):
                return False, "mat iframe game"
            return True, ""
    except Exception:
        pass

    if await is_game_session_expired(page, table_name):
        return False, "session game het han"
    if not await _game_launched(page):
        return False, "mat iframe game"
    vis = await _iframe_visibility(page)
    if not vis.get("visible"):
        return False, "iframe game an hoac mat"

    in_room = await is_ae_sexy_in_room(page, table_name)
    shell = await probe_game_shell_health(page)
    stream = await probe_room_stream_health(page)

    zombie, zreason = await is_stream_zombie(page, table_name)
    if zombie and in_room:
        return False, zreason

    # Sanh/loading: khong kiem tra chip cuoc (chip chi co trong ban)
    if not in_room and phase in (PHASE_LOBBY, PHASE_LOADING):
        if shell.get("blackScreen") and shell.get("videoDead"):
            return False, "man hinh den + mat stream video"
        if stream.get("pageDisabled"):
            return False, "trang bi disable (mask/overlay)"
        return True, ""

    if in_room:
        if shell.get("blackScreen") and shell.get("videoDead"):
            return False, "man hinh den + mat stream video"
        if shell.get("renderBroken") and shell.get("chipsDom") and not shell.get("chipsVisible"):
            return False, "render hong — chip khong hien"
        if stream.get("pageDisabled"):
            return False, "trang bi disable (mask/overlay)"
        if stream.get("blackScreen") and stream.get("videoDead"):
            return False, "man hinh den + mat stream video"
        return True, ""

    if in_room or shell.get("nestedReachable") or stream.get("hasRoad") or stream.get("hasStats"):
        if shell.get("blackScreen") and shell.get("videoDead"):
            return False, "man hinh den + mat stream video"
        if stream.get("pageDisabled"):
            return False, "trang bi disable (mask/overlay)"
        if stream.get("blackScreen") and stream.get("videoDead"):
            return False, "man hinh den + mat stream video"
        return True, ""

    if shell.get("gameBroken"):
        return False, "iframe game khong truy cap duoc UI"
    if shell.get("uiMissing"):
        return False, "UI ban trong (khong chip/roadmap)"
    if shell.get("blackScreen"):
        return False, "man hinh den / game bi chan"
    if shell.get("renderBroken") and not shell.get("chipsVisible"):
        return False, "render hong — chip khong hien"
    if stream.get("pageDisabled"):
        return False, "trang bi disable (mask/overlay)"
    if stream.get("blackScreen") and stream.get("videoDead"):
        return False, "man hinh den + mat stream video"
    return True, ""


async def fix_session_if_expired(page: Page, table_name: str = "") -> bool:
    """Khoi phuc neu session het han. True = co the tiep tuc."""
    if not await is_game_session_expired(page):
        return True
    return await recover_ae_sexy_session_expired(page, table_name)


async def recover_ae_sexy_session_expired(page: Page, table_name: str) -> bool:
    """
    Khoi phuc khi session AE SEXY het han / loi 1008 — teardown + goto casino + vao lai game moi.
    """
    wanted = (table_name or "").strip() or "Baccarat C01"
    fatal, fatal_reason = await is_casino_fatal_error(page)

    logger.warning("=" * 50)
    if fatal:
        logger.warning("KHOI PHUC LOI CASINO (1008/token) — %s", wanted)
        logger.warning("  %s", (fatal_reason or "")[:120])
    else:
        logger.warning("KHOI PHUC SESSION HET HAN — %s", wanted)
    logger.warning("=" * 50)

    if not await _clear_casino_fatal_page(page):
        logger.error("Khong xoa duoc loi 1008 — thu F5 trang casino thu cong")
        return False

    if not await enter_ae_sexy_hall(page, wanted, _from_recovery=True, force_relaunch=True):
        logger.warning("Chua vao lai duoc cong AE SEXY sau session het han")
        return False

    await ensure_lobby_ready(page, timeout_sec=45, table_name=wanted)
    if await enter_ae_sexy_table(page, wanted, fresh_token=True):
        await wait_for_ae_sexy_in_room(page, wanted, timeout_sec=45)

    if await is_game_session_expired(page):
        logger.error("Van hien thi session het han sau khoi phuc")
        return False

    token_zombie, tz_reason = await is_game_token_zombie(page, wanted)
    stream_ok = await wait_for_room_stream_ready(page, wanted, timeout_sec=20)
    if token_zombie or not stream_ok:
        logger.warning(
            "Vao ban nhung stream/token chua OK [%s] — thu quay sanh",
            tz_reason or "stream chet",
        )
        if not await recover_game_stream_token(page, wanted):
            logger.warning("Quay sanh that bai — relaunch game tu dau")
            if not await force_relaunch_ae_sexy_game(page, wanted):
                return False

    if await is_game_session_expired(page):
        logger.error("Van hien thi session het han sau khoi phuc")
        return False

    ok = (
        await is_ae_sexy_in_room(page, wanted)
        and await wait_for_room_stream_ready(page, wanted, timeout_sec=15)
    ) or await is_ae_sexy_lobby(page)
    if ok:
        logger.info("Khoi phuc session het han thanh cong — tiep tuc theo doi")
    else:
        logger.warning("Khoi phuc xong nhung stream/stats chua on dinh")
    return ok


_ROOM_STREAM_HEALTH_BODY = """
  const text = document.body?.innerText || '';
  const hasRoad = !!document.querySelector('[class*="road_zone"], [class*="bead"], [class*="roadmap"]');
  const sm = text.match(/B\\s*(\\d+)[^\\d]{0,12}P\\s*(\\d+)[^\\d]{0,12}T\\s*(\\d+)/i);
  const statsTotal = sm ? (+sm[1] + +sm[2] + +sm[3]) : 0;
  const statsZero = sm && statsTotal === 0;
  // KHONG dung "Mo bai" thuan — the sanh cung ghi trang thai do
  const hasBet = /Đặt cược|Đang mở bài|Place your bet|Sắp bắt đầu đặt/i.test(text);
  const videos = [...document.querySelectorAll('video')];
  const videoAlive = videos.some(v => v.videoWidth > 0 && v.readyState >= 2 && !v.ended);
  const canvas = document.querySelector('canvas');
  const canvasAlive = !!(canvas && canvas.width > 0 && canvas.height > 0);
  const streamOk = videoAlive || canvasAlive;
  const streamDead = !streamOk;
  const videoDead = streamDead;
  let blackScreen = false;
  const vp = window.innerWidth * window.innerHeight;
  for (const el of document.querySelectorAll('div, section')) {
    const r = el.getBoundingClientRect();
    if (r.width < 400 || r.height < 280) continue;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    if (parseFloat(s.opacity || '1') < 0.45) continue;
    const bg = (s.backgroundColor || '').replace(/\\s/g, '');
    if (bg === 'rgb(0,0,0)' || bg === 'black') {
      const area = r.width * r.height;
      if (area > vp * 0.22 && r.top < window.innerHeight * 0.55) {
        blackScreen = true;
        break;
      }
    }
  }
  if (!blackScreen && hasRoad && streamDead) blackScreen = true;
  const bigMask = [...document.querySelectorAll('[class*="disable"], [class*="mask"], [class*="cover"]')]
    .some(el => {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return r.width > 200 && r.height > 200 && parseFloat(s.opacity || '1') > 0.4
        && s.display !== 'none' && s.visibility !== 'hidden';
    });
  const bodyStyle = window.getComputedStyle(document.body);
  const pageDisabled = bigMask || bodyStyle.visibility === 'hidden' || bodyStyle.display === 'none';
  return {
    hasRoad, hasStats: !!sm, statsZero, hasBet, streamOk, streamDead, videoAlive, canvasAlive,
    blackScreen, videoDead, pageDisabled, textLen: text.length
  };
"""

_ROOM_SHELL_HEALTH_BODY = """
  const visEl = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if (parseFloat(s.opacity || '1') < 0.12) return false;
    return true;
  };
  const chipPlayer = document.getElementById('chipBoxPlayer');
  const chipBanker = document.getElementById('chipBoxBanker');
  const chipsWrap = document.querySelector('#chips');
  const chipTokens = [...document.querySelectorAll('#chips .chips3d, #chips .icon_bet_chips2d')]
    .filter(el => !el.classList.contains('chips3d_bg') && !el.classList.contains('chips3d_amount'));
  const hasChip = !!(chipPlayer || chipsWrap || chipTokens.length);
  const chipsDom = hasChip;
  const chipsVisible = visEl(chipPlayer) || visEl(chipBanker) || visEl(chipsWrap)
    || chipTokens.some(visEl);
  const betZoneVisible = visEl(chipPlayer) || visEl(chipBanker);
  const hasRoad = !!document.querySelector('[class*="road_zone"], [class*="bead"], [class*="roadmap"], [class*="road"]');
  const text = (document.body?.innerText || '').trim();
  let uiMissing = !hasChip && !hasRoad && text.length < 40;
  const sm = text.match(/B\\s*(\\d+)[^\\d]{0,12}P\\s*(\\d+)[^\\d]{0,12}T\\s*(\\d+)/i);
  const statsTotal = sm ? (+sm[1] + +sm[2] + +sm[3]) : -1;
  const statsZero = sm && statsTotal === 0;
  const videos = [...document.querySelectorAll('video')];
  const videoAlive = videos.some(v => v.videoWidth > 0 && v.readyState >= 2 && !v.ended);
  const canvas = document.querySelector('canvas');
  const canvasAlive = !!(canvas && canvas.width > 0 && canvas.height > 0);
  const streamOk = videoAlive || canvasAlive;
  const streamDead = !streamOk;
  const videoDead = streamDead;
  const vp = window.innerWidth * window.innerHeight;
  let blackCover = false;
  for (const el of document.querySelectorAll('div, section, main, canvas')) {
    const r = el.getBoundingClientRect();
    if (r.width < 280 || r.height < 180) continue;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    if (parseFloat(s.opacity || '1') < 0.4) continue;
    const bg = (s.backgroundColor || '').replace(/\\s/g, '');
    if (bg === 'rgb(0,0,0)' || bg === 'black') {
      if (r.width * r.height > vp * 0.2 && r.top < window.innerHeight * 0.7) {
        blackCover = true;
        break;
      }
    }
  }
  let blackScreen = blackCover && !chipsVisible;
  if (blackCover && streamDead) blackScreen = true;
  if (hasRoad && streamDead) blackScreen = true;
  if (text.length < 50 && !chipsVisible && !hasRoad && streamDead) {
    blackScreen = true;
    uiMissing = true;
  }
  let renderBroken = statsZero && blackCover;
  if (!renderBroken) {
    renderBroken = blackScreen || (chipsDom && !chipsVisible);
  }
  return {
    hasChip, chipsDom, chipsVisible, betZoneVisible, hasRoad, uiMissing,
    blackScreen, blackCover, renderBroken, streamOk, streamDead,
    statsTotal, statsZero, videoAlive, videoDead, canvasAlive,
    textLen: text.length,
  };
"""

_SHELL_OUTER_HEALTH_JS = """
() => {
  const out = { hasOuterIframe: false, outerVisible: false, gameBroken: false };
  const ov = document.getElementById('iframe_game');
  if (!ov) {
    out.gameBroken = true;
    return out;
  }
  out.hasOuterIframe = true;
  const rect = ov.getBoundingClientRect();
  const style = window.getComputedStyle(ov);
  const parent = ov.closest('div.fixed');
  const parentStyle = parent ? window.getComputedStyle(parent) : null;
  const hidden = style.display === 'none' || style.visibility === 'hidden'
    || parseFloat(style.opacity || '1') < 0.05
    || (parentStyle && parentStyle.display === 'none');
  out.outerVisible = !hidden && rect.width > 120 && rect.height > 120;
  if (!out.outerVisible) out.gameBroken = true;
  return out;
}
"""


def _empty_shell_health() -> dict:
    return {
        "hasOuterIframe": False,
        "outerVisible": False,
        "nestedReachable": False,
        "hasChip": False,
        "hasRoad": False,
        "chipsDom": False,
        "chipsVisible": False,
        "betZoneVisible": False,
        "blackScreen": False,
        "uiMissing": False,
        "gameBroken": False,
        "renderBroken": False,
    }


async def probe_game_shell_health(page: Page) -> dict:
    """
    Kiem tra suc khoe game — probe qua Playwright frame (khong dung contentDocument
  tu trang casino vi iframe cross-origin se null du game van chay).
    """
    out = _empty_shell_health()
    try:
        outer = await page.evaluate(_SHELL_OUTER_HEALTH_JS) or {}
    except Exception:
        outer = {}
    out.update(outer)
    if outer.get("gameBroken"):
        return out

    fn = _wrap_nested_js(_ROOM_SHELL_HEALTH_BODY, _ROOM_IFRAME_PAT)
    for frame in await _game_shell_frames(page):
        try:
            info = await frame.evaluate(fn)
            if not info:
                continue
            out["nestedReachable"] = True
            for key in (
                "hasChip",
                "hasRoad",
                "chipsDom",
                "chipsVisible",
                "betZoneVisible",
                "blackScreen",
                "blackCover",
                "uiMissing",
                "renderBroken",
                "streamOk",
                "streamDead",
                "statsZero",
                "videoDead",
                "videoAlive",
                "canvasAlive",
                "statsTotal",
                "textLen",
            ):
                if key in info:
                    out[key] = info[key]
            return out
        except Exception:
            continue

    if await _game_shell_frames(page):
        out["nestedReachable"] = False
        return out
    if not await _game_launched(page):
        out["gameBroken"] = True
    return out


async def probe_room_stream_health(page: Page) -> dict:
    """Kiem tra stream/UI trong ban — phat hien man hinh den hoac disablePage."""
    fn = _wrap_nested_js(_ROOM_STREAM_HEALTH_BODY, _ROOM_IFRAME_PAT)
    for frame in await _room_frames(page):
        try:
            info = await frame.evaluate(fn)
            if info:
                return info
        except Exception:
            continue
    return {}


async def assess_ae_sexy_connection(
    page: Page,
    table_name: str = "",
    collector=None,
    *,
    last_phase: str = "",
) -> tuple[bool, str, str]:
    """
    Kiem tra ket noi game co bi dut khong.
    Tra ve (broken, reason, severity) — severity: immediate | streak.
    """
    try:
        phase = await detect_ae_sexy_phase(page, table_name)
    except Exception as exc:
        return True, f"loi kiem tra phase: {exc}", "immediate"

    if phase == PHASE_WEB:
        return True, "roi khoi game (trang web)", "immediate"

    fatal, fatal_reason = await is_casino_fatal_error(page)
    if fatal:
        return True, f"loi 1008/token: {(fatal_reason or '')[:60]}", "immediate"

    ui_ok, ui_reason = await is_game_ui_alive(page, table_name)
    if not ui_ok:
        return True, ui_reason, "immediate"

    if await is_game_session_expired(page):
        return True, "session game het han — dang nhap lai", "immediate"

    if await is_ae_sexy_welcome_back(page):
        return True, "man hinh welcome-back (tro ve game)", "immediate"

    if not await _game_launched(page):
        return True, "mat iframe game", "immediate"

    vis = await _iframe_visibility(page)
    if not vis.get("visible"):
        return True, "iframe game an hoac mat", "immediate"

    feed_ok = bool(collector and collector.is_feed_healthy(table_name))

    if last_phase == PHASE_ROOM and phase == PHASE_LOBBY:
        if await is_ae_sexy_in_room(page, table_name):
            pass  # phase nham — van trong ban
        elif await has_ae_sexy_room_ui(page):
            pass
        elif await is_ae_sexy_lobby(page) and not await has_ae_sexy_room_ui(page):
            # Sanh UI ro — bat buoc vao lai ban (feed WS van song o sanh)
            return True, "bi day ve sanh (backToGameHall)", "streak"

    if collector and not feed_ok:
        if collector.is_ws_disconnected(grace_sec=45):
            return True, "WebSocket game ngat ket noi", "streak"
        if collector.is_ws_stale(stale_sec=120) and phase == PHASE_ROOM:
            return True, "WebSocket khong co du lieu", "streak"
        if collector.is_remote_stats_stale(stale_sec=150) and phase in (PHASE_ROOM, PHASE_LOBBY):
            return True, "lich su khong cap nhat du stats server", "streak"

    if phase in (PHASE_ROOM, PHASE_LOADING) and not feed_ok:
        health = await probe_room_stream_health(page)
        if health:
            if health.get("pageDisabled"):
                return True, "ban bi disable (disablePage)", "streak"
            if health.get("hasRoad") and health.get("statsZero") and not health.get("streamOk"):
                return True, "ban rong + mat stream video", "streak"
            if health.get("hasRoad") and not health.get("streamOk"):
                if collector and collector.is_ws_disconnected(grace_sec=30):
                    return True, "mat stream + WebSocket ngat", "streak"

    if phase == PHASE_ROOM:
        in_room = await is_ae_sexy_in_room(page, table_name)
        if not in_room:
            shell = await probe_game_shell_health(page)
            stream = await probe_room_stream_health(page)
            if shell.get("gameBroken") and not (
                stream.get("hasRoad") or stream.get("hasStats") or stream.get("hasBet")
            ):
                return True, "iframe game mat — khong truy cap duoc UI", "streak"
            if shell.get("uiMissing") and not stream.get("hasRoad"):
                return True, "UI ban trong — khong co chip/roadmap", "streak"
        else:
            shell = await probe_game_shell_health(page)
            if shell.get("statsZero") and shell.get("videoDead"):
                return True, "ban zombie — stats 0 + mat video", "immediate"
            if shell.get("blackScreen") and shell.get("videoDead"):
                return True, "man hinh den + mat stream video", "immediate"
            if collector and len(collector.state.history) >= 5:
                from src.ae_sexy_bead import read_room_stats_raw

                raw = await read_room_stats_raw(page)
                dom_total = sum(raw.values()) if raw else -1
                hist_len = len(collector.state.history)
                if dom_total == 0 and hist_len >= 5:
                    if collector.in_round_transition(15.0):
                        pass
                    elif feed_ok:
                        pass
                    elif await is_ae_sexy_in_room(page, table_name):
                        pass  # footer tam = 0 giua van / session overlay
                    else:
                        return True, f"stats DOM = 0 nhung tool con {hist_len} van", "immediate"
                if dom_total > 0 and abs(dom_total - hist_len) > 10:
                    return True, f"lech DOM/tool ({dom_total} vs {hist_len} van)", "streak"

    return False, "", ""


async def _recover_provider_tab_shell(page: Page, wanted: str) -> bool:
    """dly8829/222b: shell home/live.html sau reload — mo lai SEXY + vao ban.

    KHONG bao gio page.goto(live.html) tren tab CDN AE (bien khung game thanh shell).
    """
    from src.sites import bind_page_site, get_active_site

    site = get_active_site()
    if site.info.shell_mode != "provider_tab":
        return False

    shell = await _resolve_provider_shell_page(page, site_id=site.info.id)
    if shell is None:
        logger.warning(
            "provider_tab: khong tim thay tab shell (%s) — bo qua reload tren tab hien tai",
            site.info.id,
        )
        return False

    bind_page_site(shell, site.info.id)
    try:
        await shell.bring_to_front()
    except Exception:
        pass

    logger.warning(
        "provider_tab: reload shell casino roi click SEXY (url=%s)",
        (shell.url or "")[:70],
    )
    try:
        await site.reload_shell(shell, prefer_casino=True)
    except Exception as exc:
        logger.warning("reload_shell loi: %s — thu ensure_casino", exc)
        try:
            await site.ensure_casino(shell)
        except Exception as exc2:
            logger.warning("ensure_casino loi: %s", exc2)
            return False

    if not await enter_ae_sexy_hall(
        shell, wanted, _from_recovery=True, force_relaunch=True
    ):
        logger.warning("provider_tab: khong mo duoc sanh AE SEXY sau reload shell")
        return False

    target = await switch_to_ae_sexy_page(shell, wanted)
    await ensure_lobby_ready(target, timeout_sec=45, table_name=wanted)
    target = await switch_to_ae_sexy_page(target, wanted)
    if not await enter_ae_sexy_table(target, wanted, fresh_token=True):
        logger.warning("provider_tab: mo sanh OK nhung chua vao duoc ban %s", wanted)
        return False
    await wait_for_ae_sexy_in_room(target, wanted, timeout_sec=45)
    if await is_ae_sexy_in_room(target, wanted):
        logger.info("Khoi phuc thanh cong (provider_tab shell -> SEXY -> ban)")
        return True
    return False


async def recover_ae_sexy_connection(page: Page, table_name: str) -> bool:
    """
    Tu dong khoi phuc game khi dut ket noi — khong can nguoi dung thao tac.
    Thu: session het han -> ve sanh -> vao lai ban -> reset iframe -> reload trang.
    """
    fatal, _ = await is_casino_fatal_error(page)
    if fatal or await is_game_session_expired(page):
        return await recover_ae_sexy_session_expired(page, table_name)

    if await dismiss_ae_sexy_welcome_back(page):
        await page.wait_for_timeout(3500)
        if await is_ae_sexy_lobby(page) or await is_ae_sexy_in_room(page, table_name):
            logger.info("Khoi phuc thanh cong (welcome-back -> tro ve game)")
            return True

    await ensure_game_overlay_visible(page)
    await _dismiss_ae_sexy_connection_dialogs(page)

    wanted = normalize_baccarat_table_name((table_name or "").strip() or "Baccarat C01")

    # provider_tab (dly8829/222b): neu dang o shell web / mat tab AE → mo SEXY ngay
    try:
        from src.sites import get_active_site

        if get_active_site().info.shell_mode == "provider_tab":
            if await _on_provider_shell_without_ae(page):
                if await _recover_provider_tab_shell(page, wanted):
                    return True
            else:
                phase_now = await detect_ae_sexy_phase(page, wanted)
                if phase_now == PHASE_WEB:
                    if await _recover_provider_tab_shell(page, wanted):
                        return True
    except Exception as exc:
        logger.debug("provider_tab early recover: %s", exc)

    # Soft recover CHI khi dung ban + stream con song (tranh zombie UI)
    in_wanted = await is_ae_sexy_in_room(page, wanted)
    stream_broken = await _room_has_broken_stream(page)
    zombie, zreason = await is_stream_zombie(page, wanted)
    if in_wanted and not stream_broken and not zombie:
        logger.info("Van trong ban %s — khoi phuc mem (bo qua sanh)", wanted)
        return True
    if in_wanted and (stream_broken or zombie):
        logger.warning(
            "Trong ban %s nhung stream loi (%s) — quay sanh click lai",
            wanted,
            zreason or "stream chet",
        )

    # Room UI ghost / iframeGame che sanh — KHONG coi la OK
    if await has_ae_sexy_room_ui(page) and not await is_ae_sexy_lobby(page):
        if not in_wanted or stream_broken or zombie:
            logger.warning(
                "UI ban zombie/che sanh — bat #iframeGameHall roi vao lai %s",
                wanted,
            )
            await go_ae_sexy_lobby(page, force=True)
            await page.wait_for_timeout(1500)
        else:
            logger.info("UI ban %s con hien — khoi phuc mem", wanted)
            return True

    # Dang o sanh (hall visible) — vao ban luon, khong soft-return
    if await _gamehall_iframe_visible(page) or await is_ae_sexy_lobby(page):
        logger.info("Dang o sanh — vao lai ban %s", wanted)
        await ensure_lobby_ready(page, timeout_sec=25, table_name=wanted)
        if await enter_ae_sexy_table(page, wanted):
            await wait_for_ae_sexy_in_room(page, wanted, timeout_sec=40)
            if await is_ae_sexy_in_room(page, wanted) and not await _room_has_broken_stream(page):
                logger.info("Khoi phuc thanh cong (sanh hien -> ban)")
                return True

    from src.game import reset_game_iframe

    logger.warning("=" * 50)
    logger.warning("TU DONG KHOI PHUC KET NOI GAME — %s", wanted)
    logger.warning("=" * 50)

    if await is_ae_sexy_lobby(page) or await wait_for_ae_sexy_lobby(page, timeout_sec=35):
        page = await switch_to_ae_sexy_page(page, wanted)
        await page.wait_for_timeout(1200)
        if await is_ae_sexy_in_room(page, wanted) and not await _room_has_broken_stream(page):
            logger.info("Van trong ban %s — bo qua Buoc 2", wanted)
            return True
        tables = await _list_tables_in_frames(page)
        if tables:
            logger.info("Dang o sanh (%d ban) — vao ban %s, khong reload", len(tables), wanted)
        await ensure_lobby_ready(page, timeout_sec=35, table_name=wanted)
        page = await switch_to_ae_sexy_page(page, wanted)
        logger.info("Buoc 2: vao lai ban %s...", wanted)
        if await enter_ae_sexy_table(page, wanted):
            await wait_for_ae_sexy_in_room(page, wanted, timeout_sec=40)
            if await is_ae_sexy_in_room(page, wanted) and not await _room_has_broken_stream(page):
                logger.info("Khoi phuc thanh cong (sanh -> ban)")
                return True
        if tables or await _gamehall_iframe_visible(page):
            logger.warning(
                "Van o sanh — chua vao duoc ban %s; khong reload trang (cho thu lai)",
                wanted,
            )
            return False

    logger.info("Buoc 3: reset iframe game...")
    if await reset_game_iframe(page, force=True):
        await page.wait_for_timeout(5000)
        if await enter_ae_sexy_hall(page, wanted, _from_recovery=True, force_relaunch=True):
            page = await switch_to_ae_sexy_page(page, wanted)
            await ensure_lobby_ready(page, timeout_sec=40, table_name=wanted)
            page = await switch_to_ae_sexy_page(page, wanted)
            if await enter_ae_sexy_table(page, wanted):
                await wait_for_ae_sexy_in_room(page, wanted, timeout_sec=40)
                if await is_ae_sexy_in_room(page, wanted):
                    logger.info("Khoi phuc thanh cong (reset iframe)")
                    return True

    logger.warning("Buoc 4: reload trang casino...")
    try:
        from src.sites import get_active_site

        site = get_active_site()
        if site.info.shell_mode == "provider_tab":
            if await _recover_provider_tab_shell(page, wanted):
                return True
            logger.error("Khoi phuc ket noi game that bai — se thu lai sau")
            return False
        await page.reload(wait_until="domcontentloaded", timeout=60000)
    except Exception as exc:
        logger.warning("Reload trang loi: %s", exc)
        return False
    await page.wait_for_timeout(5000)

    if await enter_ae_sexy_hall(page, wanted, _from_recovery=True, force_relaunch=True):
        page = await switch_to_ae_sexy_page(page, wanted)
        await ensure_lobby_ready(page, timeout_sec=45, table_name=wanted)
        page = await switch_to_ae_sexy_page(page, wanted)
        if await enter_ae_sexy_table(page, wanted):
            await wait_for_ae_sexy_in_room(page, wanted, timeout_sec=45)
            if await is_ae_sexy_in_room(page, wanted):
                logger.info("Khoi phuc thanh cong (reload trang)")
                return True

    logger.error("Khoi phuc ket noi game that bai — se thu lai sau")
    return False


async def _dismiss_ae_sexy_connection_dialogs(page: Page) -> bool:
    """Bam Thử lại / Xác nhận tren dialog mat ket noi o sanh/ban."""
    js = """() => {
      const re = /thử lại|thu lai|xác nhận|reconnect|retry|đồng ý|ket noi|kết nối/i;
      const nodes = [...document.querySelectorAll('button, a, div, span')];
      for (const el of nodes) {
        const t = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!t || t.length > 40) continue;
        if (!re.test(t)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 14) continue;
        el.click();
        return { ok: true, text: t.slice(0, 40) };
      }
      return { ok: false };
    }"""
    clicked = False
    frames = [page.main_frame, *page.frames]
    for frame in frames:
        try:
            res = await frame.evaluate(js)
            if res and res.get("ok"):
                logger.info("Da bam dialog ket noi: %s", res.get("text"))
                clicked = True
                await page.wait_for_timeout(1200)
        except Exception:
            continue
    return clicked
