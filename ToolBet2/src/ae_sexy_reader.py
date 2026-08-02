from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from playwright.async_api import Frame, Page

from src.models import BetSide

logger = logging.getLogger(__name__)

TABLE_NAME_RE = re.compile(r"^Baccarat C\d+$", re.I)

# JS: tim cac diem roadmap (o tron nho co mau do/xanh/luc)
_ROADMAP_JS = """
(tableName) => {
  const colorToSide = (c) => {
    if (!c) return null;
    const s = String(c).toLowerCase();
    const m = s.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) {
      if (s.includes('blue') || s.includes('00f') || s.includes('0099')) return 'P';
      if (s.includes('red') || s.includes('f00') || s.includes('cc0000')) return 'B';
      if (s.includes('green') || s.includes('0f0') || s.includes('00cc00')) return 'T';
      return null;
    }
    const r = +m[1], g = +m[2], b = +m[3];
    if (g > r + 30 && g > b + 30) return 'T';
    if (b > r + 15 && b > g) return 'P';
    if (r > b + 15 && r > g) return 'B';
    return null;
  };

  const collectDots = (root) => {
    const dots = [];
    const addDot = (el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.width > 32 || rect.height < 4 || rect.height > 32) return;
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      const fill = el.getAttribute('fill') || style.fill || '';
      const stroke = el.getAttribute('stroke') || style.stroke || '';
      const side = colorToSide(bg) || colorToSide(fill) || colorToSide(stroke);
      if (!side) return;
      dots.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, side });
    };
    for (const el of root.querySelectorAll('circle, rect, div, span')) addDot(el);
    dots.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    return dots;
  };

  const scrapeCard = (root) => {
    const dots = collectDots(root);
    if (dots.length < 4) return null;
  // gom theo hang (y gan nhau)
    const rows = [];
    for (const d of dots) {
      let row = rows.find(r => Math.abs(r.y - d.y) < 8);
      if (!row) { row = { y: d.y, items: [] }; rows.push(row); }
      row.items.push(d);
    }
    rows.sort((a, b) => a.y - b.y);
    const seq = [];
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      for (const it of row.items) seq.push(it.side);
    }
    return seq;
  };

  const results = [];
  const seen = new Set();

  if (tableName) {
    const label = [...document.querySelectorAll('*')].find(
      e => (e.textContent || '').trim() === tableName
    );
    if (label) {
      let node = label;
      for (let i = 0; i < 12 && node; i++) {
        const seq = scrapeCard(node);
        if (seq && seq.length >= 4) {
          return { table: tableName, codes: seq, stats: {} };
        }
        node = node.parentElement;
      }
    }
    return null;
  }

  // Quet tat ca ban trong sanh
  for (const el of document.querySelectorAll('*')) {
    const t = (el.textContent || '').trim();
    if (!/^Baccarat C\\d+$/i.test(t) || seen.has(t)) continue;
    seen.add(t);
    let node = el;
    let seq = null;
    let stats = {};
    for (let i = 0; i < 12 && node; i++) {
      const text = node.textContent || '';
      const sm = text.match(/B\\s*(\\d+).*P\\s*(\\d+).*T\\s*(\\d+)/i);
      if (sm) stats = { banker: +sm[1], player: +sm[2], tie: +sm[3] };
      const s = scrapeCard(node);
      if (s && s.length >= 4) { seq = s; break; }
      node = node.parentElement;
    }
    if (seq) results.push({ table: t, codes: seq, stats });
  }
  return results;
}
"""

_CANVAS_ROADMAP_JS = """
() => {
  const colorToSide = (r, g, b) => {
    if (g > r + 40 && g > b + 40) return 'T';
    if (b > r + 20 && b > g) return 'P';
    if (r > b + 20 && r > g) return 'B';
    return null;
  };
  const seq = [];
  for (const canvas of document.querySelectorAll('canvas')) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 40) continue;
    try {
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      const img = ctx.getImageData(0, 0, w, h).data;
      const cell = Math.max(6, Math.round(w / 20));
      for (let y = cell; y < h - cell; y += cell) {
        for (let x = cell; x < w - cell; x += cell) {
          const i = (y * w + x) * 4;
          const r = img[i], g = img[i+1], b = img[i+2], a = img[i+3];
          if (a < 100) continue;
          const side = colorToSide(r, g, b);
          if (side) seq.push({ x, y, side });
        }
      }
    } catch (e) { /* cross-origin taint */ }
  }
  if (!seq.length) return [];
  seq.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  // loc trung gan nhau
  const out = [];
  for (const d of seq) {
    if (out.some(o => Math.abs(o.x - d.x) < 8 && Math.abs(o.y - d.y) < 8)) continue;
    out.push(d);
  }
  return out.map(d => d.side);
}
"""


def _codes_to_sides(codes: list[str]) -> list[BetSide]:
    mapping = {"P": BetSide.PLAYER, "B": BetSide.BANKER, "T": BetSide.TIE}
    return [mapping[c] for c in codes if c in mapping]


@dataclass
class AeSexyTableInfo:
    name: str
    history: list[BetSide] = field(default_factory=list)
    stats: dict[str, int] = field(default_factory=dict)


async def _eval_on_frames(page: Page, js: str, arg=None):
    """Chay JS tren tat ca frame mhuxu/usplaynet, tra ve ket qua tot nhat."""
    best = None
    for frame in page.frames:
        url = frame.url or ""
        if not any(h in url for h in ("mhuxu.com", "usplaynet.com", "mex777.com", "tgmeq.com")):
            continue
        try:
            result = await frame.evaluate(js, arg) if arg is not None else await frame.evaluate(js)
            if result is None:
                continue
            if isinstance(result, list) and len(result) > (len(best) if isinstance(best, list) else 0):
                best = result
            elif isinstance(result, dict) and result.get("codes"):
                if not best or len(result["codes"]) > len(best.get("codes", [])):
                    best = result
            elif best is None:
                best = result
        except Exception as exc:
            logger.debug("eval frame %s: %s", url[:60], exc)
    if best is not None:
        return best
    loc = page.locator("#iframe_game")
    if await loc.count():
        el = await loc.element_handle()
        if el:
            frame = await el.content_frame()
            if frame:
                try:
                    return await frame.evaluate(js, arg) if arg is not None else await frame.evaluate(js)
                except Exception:
                    pass
    return None


async def scrape_table_history(page: Page, table_name: str) -> AeSexyTableInfo | None:
    """Doc lich su roadmap tu card ban hoac phong hien tai."""
    raw = await _eval_on_frames(page, _ROADMAP_JS, table_name)
    if raw and raw.get("codes"):
        return AeSexyTableInfo(
            name=table_name,
            history=_codes_to_sides(raw["codes"]),
            stats=raw.get("stats") or {},
        )
    # Thu canvas
    codes = await _eval_on_frames(page, _CANVAS_ROADMAP_JS)
    if codes:
        return AeSexyTableInfo(name=table_name, history=_codes_to_sides(codes))
    return None


async def scrape_all_tables(page: Page) -> list[AeSexyTableInfo]:
    """Doc tat ca ban + lich su tu sanh AE SEXY."""
    raw = await _eval_on_frames(page, _ROADMAP_JS, None)
    if not raw:
        return []
    tables: list[AeSexyTableInfo] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("table", ""))
        if not name:
            continue
        tables.append(
            AeSexyTableInfo(
                name=name,
                history=_codes_to_sides(item.get("codes") or []),
                stats=item.get("stats") or {},
            )
        )
    return tables


async def scrape_room_history(page: Page, table_name: str = "") -> list[BetSide]:
    """Doc lich su trong phong (roadmap lon)."""
    name = table_name or ""
    info = await scrape_table_history(page, name) if name else None
    if info and info.history:
        return info.history
    codes = await _eval_on_frames(page, _CANVAS_ROADMAP_JS)
    if codes:
        return _codes_to_sides(codes)
    return []
