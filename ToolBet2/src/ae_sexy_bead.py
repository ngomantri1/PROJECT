from __future__ import annotations

import asyncio
import io
import logging

from PIL import Image
from playwright.async_api import Frame, Page

from src.ae_sexy import AE_SEXY_HOSTS, _game_shell_frames, _wrap_nested_js
from src.ae_sexy_http import reconcile_history_to_stats
from src.models import BetSide

logger = logging.getLogger(__name__)

# Bead plate (珠盘路): moi cot 6 o, dien tu tren xuong duoi, cot tiep theo ben phai
BEAD_PLATE_ROWS = 6

# Mo rong iframe + scroll de hien bead plate
_PREPARE_ROOM_JS = """
() => {
  try {
    window.scrollTo(0, document.body.scrollHeight);
    document.documentElement.scrollTop = 99999;
    const zone = document.querySelector('[class*="road_zone"]');
    if (zone) zone.scrollIntoView({ block: 'end', behavior: 'instant' });
    window.dispatchEvent(new Event('resize'));
  } catch (e) {}
  return !!document.querySelector('[class*="road_zone"]');
}
"""

# Doc bead plate — cot 6 o, trai sang phai, tren xuong duoi; bao nhieu o = bay nhieu van
_BEAD_PLATE_DOM_JS = """
(expectedTotal) => {
  const ROWS = 6;
  const zone = document.querySelector('[class*="road_zone"]');
  if (!zone) return { source: 'none', codes: [], count: 0 };
  const grids = [...zone.querySelectorAll('[class*="road_grid"]')];
  if (!grids.length) return { source: 'none', codes: [], count: 0 };

  const ownText = (el) => {
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    return own.trim().toUpperCase();
  };

  const sideFromClass = (cls, el) => {
    const s = String(cls || '');
    if (/tie|_t_|green|yellow|lime/i.test(s)) return 'T';
    if (/blue|player/i.test(s)) return 'P';
    if (/red|banker/i.test(s)) return 'B';
    try {
      const st = window.getComputedStyle(el);
      const bg = st.backgroundColor || '';
      const m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (m) {
        const r = +m[1], g = +m[2], b = +m[3];
        if (g > r + 35 && g > b + 25) return 'T';
        if (b > r + 18 && b >= g) return 'P';
        if (r > b + 18 && r >= g) return 'B';
      }
    } catch (e) {}
    return null;
  };

  const readGrid = (grid) => {
    const gr = grid.getBoundingClientRect();
    if (gr.width < 8 || gr.height < 8) return null;
    const scroller = grid.closest('[class*="road_big"]') || grid.parentElement || grid;
    const merged = new Map();

    const collect = (scrollLeft) => {
      const add = (side, rect) => {
        if (!side || !rect || rect.width < 3 || rect.height < 3 || rect.height > 40) return;
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const cell = Math.max(8, Math.min(rect.width, rect.height, 18));
        const key = Math.round((scrollLeft + cx - gr.x) / cell) + ',' + Math.round((cy - gr.y) / cell);
        if (!merged.has(key)) merged.set(key, { side, x: cx, y: cy });
      };
      for (const el of grid.querySelectorAll('span, div, label, b, strong, i')) {
        if (el.children.length > 0) continue;
        const t = ownText(el);
        if (t !== 'P' && t !== 'B' && t !== 'T') continue;
        add(t, el.getBoundingClientRect());
      }
      for (const el of grid.querySelectorAll('[class*="road_bg"], [class*="road_text"]')) {
        const cls = (el.className || '').toString();
        if (/road_boder/i.test(cls)) continue;
        const t = ownText(el);
        let side = (t === 'P' || t === 'B' || t === 'T') ? t : sideFromClass(cls, el);
        if (!side) continue;
        add(side, el.getBoundingClientRect());
      }
    };

    const runScroll = (sc) => {
      const maxScroll = Math.max(0, (sc.scrollWidth || 0) - (sc.clientWidth || 0));
      const step = Math.max(12, Math.floor((sc.clientWidth || 120) / 6));
      collect(sc.scrollLeft || 0);
      for (let pos = 0; pos <= maxScroll + step; pos += step) {
        try { sc.scrollLeft = pos; } catch (e) {}
        collect(pos);
      }
      try { sc.scrollLeft = 0; } catch (e) {}
      collect(0);
    };
    runScroll(scroller);
    if (merged.size < 1 && scroller !== grid) runScroll(grid);

    const beads = [...merged.values()];
    if (!beads.length) return null;

    const cellH = Math.max(8, gr.height / ROWS);
    const xs = beads.map(b => b.x).sort((a, b) => a - b);
    let cellW = cellH;
    if (xs.length > 1) {
      const gaps = [];
      for (let i = 1; i < xs.length; i++) {
        const g = xs[i] - xs[i - 1];
        if (g > 4 && g < cellH * 2.5) gaps.push(g);
      }
      if (gaps.length) {
        gaps.sort((a, b) => a - b);
        cellW = gaps[Math.floor(gaps.length / 2)];
      }
    }

    const cells = new Map();
    for (const b of beads) {
      const col = Math.round((b.x - gr.x) / cellW);
      const row = Math.round((b.y - gr.y) / cellH);
      if (row < 0 || row >= ROWS || col < 0) continue;
      const key = col + ',' + row;
      if (!cells.has(key)) cells.set(key, b.side);
    }
    if (!cells.size) return null;

    const entries = [...cells.entries()].map(([k, side]) => {
      const [col, row] = k.split(',').map(Number);
      return { col, row, side };
    });
    entries.sort((a, b) => (a.col !== b.col ? a.col - b.col : a.row - b.row));

    const perCol = new Map();
    for (const e of entries) {
      perCol.set(e.col, (perCol.get(e.col) || 0) + 1);
    }
    for (const n of perCol.values()) {
      if (n > ROWS) return null;
    }

    const seq = entries.map(e => e.side);
    return { codes: seq, count: seq.length };
  };

  let best = null;
  let bestCount = -1;
  for (const grid of grids) {
    const got = readGrid(grid);
    if (!got || !got.codes.length) continue;
    if (got.count > bestCount) {
      bestCount = got.count;
      best = got;
    }
  }
  if (!best || !best.codes.length) return { source: 'none', codes: [], count: 0 };
  return { source: 'bead-plate-dom', codes: best.codes, count: best.count };
}
"""

_GET_CANVAS_PNG_JS = """
() => {
  const list = [...document.querySelectorAll('canvas')].filter(c => {
    const r = c.getBoundingClientRect();
    return (c.width >= 80 && c.height >= 80) || (r.width >= 120 && r.height >= 120);
  });
  list.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return (rb.width * rb.height) - (ra.width * ra.height);
  });
  const c = list[0];
  if (!c) return null;
  try {
    return { w: c.width, h: c.height, dw: c.getBoundingClientRect().width, dh: c.getBoundingClientRect().height, data: c.toDataURL('image/png') };
  } catch (e) {
    return { err: String(e) };
  }
}
"""

_BEAD_CANVAS_SCAN_JS = """
() => {
  const zone = document.querySelector('[class*="road_zone"]');
  if (!zone) return { err: 'no zone' };
  const grids = [...zone.querySelectorAll('[class*="road_grid"]')];
  const grid = grids.find(g => {
    const r = g.getBoundingClientRect();
    return r.width >= 40 && r.height >= 40;
  }) || grids[0];
  if (!grid) return { err: 'no grid' };
  const canvases = [...document.querySelectorAll('canvas')].filter(c => {
    const r = c.getBoundingClientRect();
    return (c.width >= 80 && c.height >= 80) || (r.width >= 120 && r.height >= 120);
  });
  canvases.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return (rb.width * rb.height) - (ra.width * ra.height);
  });
  const canvas = canvases[0];
  if (!canvas) return { err: 'no canvas' };
  const cr = canvas.getBoundingClientRect();
  const gr = grid.getBoundingClientRect();
  if (!cr.width || !cr.height) return { err: 'canvas zero size' };
  const sx = canvas.width / cr.width;
  const sy = canvas.height / cr.height;
  let data = null;
  try { data = canvas.toDataURL('image/png'); } catch (e) { return { err: String(e) }; }
  return {
    data,
    rect: {
      x: Math.max(0, Math.round((gr.x - cr.x) * sx)),
      y: Math.max(0, Math.round((gr.y - cr.y) * sy)),
      w: Math.max(1, Math.round(gr.width * sx)),
      h: Math.max(1, Math.round(gr.height * sy)),
    },
    canvasW: canvas.width,
    canvasH: canvas.height,
  };
}
"""

_IS_CANVAS_BEAD_JS = """
() => {
  const zone = document.querySelector('[class*="road_zone"]');
  if (!zone) return false;
  const grids = [...zone.querySelectorAll('[class*="road_grid"]')];
  if (!grids.length) return false;
  const g = grids.find(x => x.getBoundingClientRect().width > 20) || grids[0];
  return g.querySelectorAll('*').length < 3;
}
"""

_BIG_ROAD_DOM_JS = """
() => {
  const zone = document.querySelector('[class*="road_zone"]');
  if (!zone) return { codes: [], count: 0 };
  const grids = [...zone.querySelectorAll('[class*="road_grid"]')];
  const grid = grids[1] || grids[0];
  if (!grid) return { codes: [], count: 0 };
  const dots = [];
  for (const el of grid.querySelectorAll('[class*="road_dot"], [class*="road_boder"], [class*="road_bg"]')) {
    const cls = (el.className || '').toString();
    let side = null;
    if (/green/i.test(cls)) side = 'T';
    else if (/red/i.test(cls)) side = 'B';
    else if (/blue/i.test(cls)) side = 'P';
    if (!side) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    dots.push({ side, x: rect.x, y: rect.y });
  }
  if (dots.length < 5) return { codes: [], count: 0 };
  const cols = [];
  for (const d of dots) {
    let col = cols.find(c => Math.abs(c.x - d.x) < 9);
    if (!col) { col = { x: d.x, items: [] }; cols.push(col); }
    col.items.push(d);
  }
  cols.sort((a,b)=>a.x-b.x);
  const seq = [];
  for (const col of cols) {
    col.items.sort((a,b)=>a.y-b.y);
    for (const it of col.items) seq.push(it.side);
  }
  return { source: 'big-road-dom', codes: seq, count: seq.length };
}
"""

_FIND_BEAD_ARRAY_JS = """
() => {
  const results = [];
  const seen = new WeakSet();
  function walk(obj, path, depth) {
    if (!obj || depth > 12 || typeof obj !== 'object') return;
    if (seen.has(obj)) return;
    if (obj instanceof Window || obj instanceof Document) return;
    seen.add(obj);
    const arr = Array.isArray(obj) ? obj : (ArrayBuffer.isView(obj) ? Array.from(obj) : null);
    if (arr && arr.length >= 5 && arr.length <= 400) {
      const ok = arr.filter(v => v === 0 || v === 1 || v === 2);
      if (ok.length >= arr.length * 0.92) {
        results.push({ path, len: arr.length, data: arr });
      }
      return;
    }
    if (Array.isArray(obj)) {
      if (obj.length > 0 && obj.length <= 50) walk(obj[0], path + '[0]', depth + 1);
      return;
    }
    for (const k of Object.keys(obj).slice(0, 60)) {
      try { walk(obj[k], path ? path + '.' + k : k, depth + 1); } catch (e) {}
    }
  }
  walk(window, 'window', 0);
  results.sort((a, b) => b.len - a.len);
  return results.slice(0, 8);
}
"""

_READ_STATS_JS = """
() => {
  const root = document.body?.cloneNode(true);
  if (root) {
    root.querySelectorAll('#toolbet-overlay, #toolbet-overlay-style, [id*="toolbet"]').forEach(el => el.remove());
  }
  const text = (root || document.body)?.innerText || '';
  const re = /B\\s*:?\\s*(\\d+)[^\\d]{0,24}P\\s*:?\\s*(\\d+)[^\\d]{0,24}T\\s*:?\\s*(\\d+)(?:[^\\d]{0,24}Total\\s*:?\\s*(\\d+))?/gi;
  let best = null;
  let m;
  while ((m = re.exec(text)) !== null) {
    const banker = +m[1], player = +m[2], tie = +m[3];
    const sum = banker + player + tie;
    const explicit = m[4] ? +m[4] : 0;
    const total = explicit > 0 ? explicit : sum;
    if (explicit > 0 && explicit !== sum) continue;
    if (tie > total * 0.4) continue;
    const score = total * 100 + (explicit > 0 ? 50 : 0);
    if (!best || score > best.score) {
      best = { banker, player, tie, total, score };
    }
  }
  if (best) delete best.score;
  return best;
}
"""

_READ_HOOKED_WS = """
() => {
  const out = [];
  const log = window.__tbWs || [];
  for (const m of log) {
    if (m.dir !== 'recv') continue;
    const d = m.data || '';
    const i = d.indexOf('{');
    if (i < 0) continue;
    try { out.push(JSON.parse(d.slice(i))); } catch(e) {}
  }
  try {
    const stored = JSON.parse(localStorage.getItem('__tb_roads') || '[]');
    for (const d of stored) {
      const i = d.indexOf('{');
      if (i < 0) continue;
      try { out.push(JSON.parse(d.slice(i))); } catch(e) {}
    }
  } catch(e) {}
  return out;
}
"""


def _color_to_side(r: int, g: int, b: int) -> str | None:
    if max(r, g, b) < 50:
        return None
    sat = max(r, g, b) - min(r, g, b)
    if sat < 38:
        return None
    # Nen xanh ban / o trong
    if g > 70 and g > r + 22 and g > b + 12 and r < 120:
        return None
    # Nen trang / xam nhat
    if min(r, g, b) > 175 and sat < 55:
        return None
    if g > r + 30 and g > b + 24 and g >= 95 and r < 150:
        return "T"
    if b > r + 18 and b > g + 8 and b >= 85 and r < 140:
        return "P"
    if r > b + 18 and r > g + 8 and r >= 120 and b < 120:
        return "B"
    return None


def _cell_looks_empty(crop: Image.Image, cx: int, cy: int, cell: int) -> bool:
    """O trong: tam sang hoac xam, khong co vong mau bao quanh."""
    cw, ch = crop.size
    if cx < 0 or cy < 0 or cx >= cw or cy >= ch:
        return True
    r, g, b = crop.getpixel((cx, cy))[:3]
    sat = max(r, g, b) - min(r, g, b)
    if min(r, g, b) > 185 and sat < 40:
        return True
    if max(r, g, b) < 45:
        return True
    ring_hits = 0
    r_outer = max(3, cell // 2 - 1)
    for dx in (-r_outer, 0, r_outer):
        for dy in (-r_outer, 0, r_outer):
            if dx == 0 and dy == 0:
                continue
            px, py = cx + dx, cy + dy
            if px < 0 or py < 0 or px >= cw or py >= ch:
                continue
            pr, pg, pb = crop.getpixel((px, py))[:3]
            if _color_to_side(pr, pg, pb):
                ring_hits += 1
    return ring_hits < 2


def _trim_bead_footer(img: Image.Image) -> Image.Image:
    """Cat thanh den/chu duoi road_grid — chi giu vung luoi trang."""
    w, h = img.size
    bottom = h
    for y in range(h - 1, max(0, h // 4), -1):
        dark = 0
        samples = 0
        for x in range(0, w, max(1, w // 24)):
            px = img.getpixel((x, y))
            r, g, b = px[:3]
            samples += 1
            if max(r, g, b) < 35:
                dark += 1
        if samples and dark / samples < 0.55:
            bottom = y + 1
            break
    if bottom < h - 4:
        img = img.crop((0, 0, w, bottom))
    return img


def _bead_content_top(img: Image.Image) -> int:
    """Bo vien tren (neu co) — tim dong sang dau tien."""
    w, h = img.size
    for y in range(0, min(h, 20)):
        bright = 0
        samples = 0
        for x in range(0, w, max(1, w // 16)):
            r, g, b = img.getpixel((x, y))[:3]
            samples += 1
            if min(r, g, b) > 170:
                bright += 1
        if samples and bright / samples > 0.45:
            return y
    return 0


def _prepare_bead_crop(img: Image.Image) -> Image.Image:
    trimmed = _trim_bead_footer(img)
    top = _bead_content_top(trimmed)
    if top > 0:
        trimmed = trimmed.crop((0, top, trimmed.width, trimmed.height))
    return trimmed


def _estimate_bead_cell(crop: Image.Image) -> tuple[int, int]:
    """Kich thuoc o bead — AE SEXY viewport ~4 cot, 6 hang (co the bi footer che hang duoi)."""
    cw, ch = crop.size
    cell_h = max(8, ch // BEAD_PLATE_ROWS)
    ncol = max(3, min(7, round(cw / max(cell_h * 2.2, 22))))
    cell_w = max(cell_h, cw // ncol)
    return cell_w, cell_h


def _codes_to_sides(codes: list[str]) -> list[BetSide]:
    m = {"P": BetSide.PLAYER, "B": BetSide.BANKER, "T": BetSide.TIE}
    return [m[c] for c in codes if c in m]


def _int_array_to_sides(arr: list[int]) -> list[BetSide]:
    m = {0: BetSide.BANKER, 1: BetSide.PLAYER, 2: BetSide.TIE}
    return [m[v] for v in arr if v in m]


def _stats_total(stats: dict | None) -> int:
    if not stats:
        return 0
    return int(stats.get("banker", stats.get("b", 0)) + stats.get("player", stats.get("p", 0)) + stats.get("tie", stats.get("t", 0)))


def _side_counts(history: list[BetSide]) -> dict[str, int]:
    return {
        "banker": sum(1 for s in history if s == BetSide.BANKER),
        "player": sum(1 for s in history if s == BetSide.PLAYER),
        "tie": sum(1 for s in history if s == BetSide.TIE),
    }


def _history_score(history: list[BetSide], stats: dict | None) -> int:
    if not history:
        return -1
    if not stats or not _stats_total(stats):
        return len(history)
    counts = _side_counts(history)
    b_err = abs(counts["banker"] - int(stats.get("banker", stats.get("b", 0))))
    p_err = abs(counts["player"] - int(stats.get("player", stats.get("p", 0))))
    t_err = abs(counts["tie"] - int(stats.get("tie", stats.get("t", 0))))
    diff = b_err + p_err + t_err
    if diff == 0:
        return 3000 + len(history)
    if diff <= 2:
        return 1500 + len(history) - diff * 50
    if diff <= 8:
        return 700 + len(history) - diff * 20
    expected = _stats_total(stats)
    len_err = abs(len(history) - expected)
    if len_err <= 5 and diff <= 12:
        return 500 + len(history) - len_err * 10
    return max(0, 200 - diff * 30 - len_err * 10)


def scan_bead_from_canvas_screenshot(img: Image.Image, expected_total: int = 0) -> list[str]:
    w, h = img.size
    regions = [
        # AE SEXY: bead plate (珠盘路) goc duoi TRAI tren canvas game
        (0.0, 0.82, 0.12, 0.18),
        (0.0, 0.80, 0.15, 0.20),
        (0.0, 0.78, 0.18, 0.22),
        (0.0, 0.84, 0.10, 0.16),
        (0.0, 0.70, 0.26, 0.30),
        (0.0, 0.74, 0.24, 0.26),
        (0.0, 0.76, 0.20, 0.24),
    ]
    best: list[str] = []
    for rx, ry, rw, rh in regions:
        x0 = int(w * rx)
        y0 = int(h * ry)
        crop = img.crop((x0, y0, min(w, x0 + int(w * rw)), min(h, y0 + int(h * rh))))
        seq = _scan_bead_crop(crop)
        if not seq:
            continue
        if expected_total and abs(len(seq) - expected_total) < abs(len(best) - expected_total):
            best = seq
        elif not expected_total and len(seq) > len(best):
            best = seq
    return best


def _detect_cell_side(crop: Image.Image, cx: int, cy: int, cell: int) -> str | None:
    """Nhan dien 1 o bead — lay mau vong tron (bo qua chu trang o tam)."""
    if _cell_looks_empty(crop, cx, cy, cell):
        return None
    cw, ch = crop.size
    votes: dict[str, int] = {}
    r_inner = max(2, cell // 5)
    r_outer = max(3, cell // 2 - 1)
    min_votes = 5 if cell >= 12 else 4
    for dx in range(-r_outer, r_outer + 1):
        for dy in range(-r_outer, r_outer + 1):
            d2 = dx * dx + dy * dy
            if d2 < r_inner * r_inner or d2 > r_outer * r_outer:
                continue
            px, py = cx + dx, cy + dy
            if px < 0 or py < 0 or px >= cw or py >= ch:
                continue
            px_val = crop.getpixel((px, py))
            if len(px_val) == 4:
                r, g, b, a = px_val
            else:
                r, g, b = px_val
                a = 255
            if a < 80:
                continue
            side = _color_to_side(r, g, b)
            if side:
                votes[side] = votes.get(side, 0) + 1
    if not votes:
        return None
    best, count = max(votes.items(), key=lambda x: x[1])
    if count < min_votes:
        return None
    return best


def _scan_bead_crop(crop: Image.Image) -> list[str]:
    crop = _prepare_bead_crop(crop)
    cw, ch = crop.size
    if cw < 24 or ch < 16:
        return []
    cell_w, cell_h = _estimate_bead_cell(crop)
    cols = max(1, (cw + cell_w - 1) // cell_w)
    cell = min(cell_w, cell_h)
    seq: list[str] = []
    for col in range(cols):
        col_beads: list[str] = []
        for row in range(BEAD_PLATE_ROWS):
            cx = col * cell_w + cell_w // 2
            cy = row * cell_h + cell_h // 2
            if cx >= cw or cy >= ch:
                continue
            side = _detect_cell_side(crop, cx, cy, cell)
            if side:
                col_beads.append(side)
        if not col_beads:
            if seq:
                break
            continue
        seq.extend(col_beads)
    return seq


def _merge_bead_sequences(chunks: list[list[str]]) -> list[str]:
    """Gop nhieu lan chup khi scroll ngang — uu tien doan dai nhat, khop prefix."""
    if not chunks:
        return []
    best = max(chunks, key=len)
    if len(chunks) == 1:
        return best
    for other in sorted(chunks, key=len, reverse=True):
        if other == best:
            continue
        # other co the la phan dau (scroll phai) hoac phan cuoi (scroll trai)
        if len(other) > len(best) and best == other[-len(best) :]:
            best = other
        elif len(other) <= len(best) and best[-len(other) :] == other:
            extra = other[len(best) :]
            if extra:
                best = best + extra
    return best


def _is_room_frame(url: str) -> bool:
    u = url.lower()
    return "singlebactable" in u or "bactable.jsp" in u or "bactable" in u


def _is_game_frame(url: str) -> bool:
    return any(h in url for h in AE_SEXY_HOSTS) or "gamehall" in url


_room_view_prepared: set[int] = set()


async def _prepare_room_view(page: Page, *, force: bool = False):
    """Chuan bi view 1 lan — tranh nhay man hinh moi poll."""
    pid = id(page)
    if not force and pid in _room_view_prepared:
        return
    try:
        await page.evaluate(
            """() => {
            const iframe = document.getElementById('iframe_game');
            if (iframe) {
                iframe.style.position = 'fixed';
                iframe.style.top = '0';
                iframe.style.left = '0';
                iframe.style.width = '100vw';
                iframe.style.height = '100vh';
                iframe.style.zIndex = '9999';
                iframe.style.border = 'none';
            }
        }"""
        )
        await page.wait_for_timeout(300 if _room_view_prepared else 800)
        _room_view_prepared.add(pid)
    except Exception:
        pass


_GAME_DOC_PAT = "singlebactable|bactable|webmain|gamehall"


async def _eval_game_doc(frame: Frame, js_lambda: str, *args, iframe_pat: str = _GAME_DOC_PAT):
    """Chay ham JS trong iframe game/ban ben trong shell frame."""
    if args:
        body = f"return ({js_lambda})(...args);"
    else:
        body = f"return ({js_lambda})();"
    fn = _wrap_nested_js(body, iframe_pat)
    return await frame.evaluate(fn, *args)


async def _read_stats(frame: Frame) -> dict | None:
    try:
        return await _eval_game_doc(frame, _READ_STATS_JS)
    except Exception:
        return None


async def _scrape_big_road_dom(frame: Frame) -> list[BetSide]:
    try:
        raw = await _eval_game_doc(frame, _BIG_ROAD_DOM_JS)
    except Exception:
        return []
    if raw and raw.get("codes"):
        return _codes_to_sides(raw["codes"])
    return []


async def _scrape_bead_dom(frame: Frame, expected_total: int = 0) -> list[BetSide]:
    try:
        await _eval_game_doc(frame, _PREPARE_ROOM_JS)
        await frame.wait_for_timeout(800)
        # Bead plate: khong cat theo expectedTotal — bao nhieu o = bay nhieu van
        raw = await _eval_game_doc(frame, _BEAD_PLATE_DOM_JS, 0)
    except Exception:
        return []
    if raw and raw.get("codes"):
        return _codes_to_sides(raw["codes"])
    return []


async def _find_bead_array(frame: Frame, stats: dict | None) -> list[BetSide]:
    try:
        found = await _eval_game_doc(frame, _FIND_BEAD_ARRAY_JS)
    except Exception:
        return []
    best: list[BetSide] = []
    best_score = -1
    for item in found or []:
        sides = _int_array_to_sides([int(x) for x in item.get("data") or []])
        score = _history_score(sides, stats)
        if score > best_score:
            best_score = score
            best = sides
    return best


_SCROLL_BEAD_GRID_JS = """
() => {
  const zone = document.querySelector('[class*="road_zone"]');
  if (!zone) return null;
  const grids = [...zone.querySelectorAll('[class*="road_grid"]')];
  const grid = grids.find(g => g.getBoundingClientRect().width >= 40) || grids[0];
  if (!grid) return null;
  const scroller = (grid.scrollWidth > grid.clientWidth + 2) ? grid : (grid.closest('[class*="road_big"]') || grid.parentElement || grid);
  const gr = grid.getBoundingClientRect();
  if (gr.width < 30 || gr.height < 30) return null;
  const maxScroll = Math.max(0, (scroller.scrollWidth || 0) - (scroller.clientWidth || 0));
  const step = Math.max(40, Math.floor((scroller.clientWidth || gr.width) * 0.85));
  const positions = [0];
  for (let pos = step; pos < maxScroll; pos += step) positions.push(pos);
  if (maxScroll > 0 && positions[positions.length - 1] !== maxScroll) {
    positions.push(maxScroll);
  }
  return {
    x: gr.x,
    y: gr.y,
    w: gr.width,
    h: gr.height,
    positions,
    maxScroll,
    scrollTarget: (scroller.className || '').toString().slice(0, 40),
  };
}
"""

_SET_BEAD_SCROLL_JS = """
(scrollLeft) => {
  const zone = document.querySelector('[class*="road_zone"]');
  if (!zone) return false;
  const grids = [...zone.querySelectorAll('[class*="road_grid"]')];
  const grid = grids.find(g => g.getBoundingClientRect().width >= 40) || grids[0];
  if (!grid) return false;
  const scroller = (grid.scrollWidth > grid.clientWidth + 2) ? grid : (grid.closest('[class*="road_big"]') || grid.parentElement || grid);
  try { scroller.scrollLeft = scrollLeft; } catch (e) { return false; }
  return true;
}
"""


async def _screenshot_bead_grid_element(page: Page, *, merge_scroll: bool = True) -> Image.Image | None:
    """Chup vung road_grid — bead plate ve tren layer HTML/canvas con."""
    from src.ae_sexy import _game_shell_frames

    pat = _GAME_DOC_PAT
    for shell in await _game_shell_frames(page):
        try:
            meta = await _eval_game_doc(shell, _SCROLL_BEAD_GRID_JS, iframe_pat=pat)
        except Exception:
            continue
        if not meta:
            continue
        try:
            iframe_off = await page.evaluate(
                """() => {
                const f = document.getElementById('iframe_game');
                if (!f) return { x: 0, y: 0 };
                const r = f.getBoundingClientRect();
                return { x: r.x, y: r.y };
            }"""
            )
        except Exception:
            iframe_off = {"x": 0, "y": 0}
        clip = {
            "x": max(0, iframe_off["x"] + meta["x"]),
            "y": max(0, iframe_off["y"] + meta["y"]),
            "width": max(1, meta["w"]),
            "height": max(1, meta["h"]),
        }
        positions = [0] if not merge_scroll else (meta.get("positions") or [0])
        last_img: Image.Image | None = None
        for scroll_pos in positions:
            if scroll_pos:
                try:
                    await _eval_game_doc(shell, _SET_BEAD_SCROLL_JS, scroll_pos, iframe_pat=pat)
                    await shell.wait_for_timeout(120)
                except Exception:
                    pass
            try:
                png = await page.screenshot(clip=clip, animations="disabled")
                last_img = Image.open(io.BytesIO(png))
            except Exception as exc:
                logger.debug("page clip screenshot: %s", exc)
        if last_img and merge_scroll and len(positions) > 1:
            try:
                await _eval_game_doc(shell, _SET_BEAD_SCROLL_JS, 0, iframe_pat=pat)
            except Exception:
                pass
        return last_img
    return None


async def _scan_bead_grid_from_page(page: Page) -> list[str]:
    """Chup road_grid (co scroll ngang) va quet B/P/T."""
    from src.ae_sexy import _game_shell_frames

    pat = _GAME_DOC_PAT
    for shell in await _game_shell_frames(page):
        try:
            meta = await _eval_game_doc(shell, _SCROLL_BEAD_GRID_JS, iframe_pat=pat)
        except Exception:
            continue
        if not meta:
            continue
        try:
            iframe_off = await page.evaluate(
                """() => {
                const f = document.getElementById('iframe_game');
                if (!f) return { x: 0, y: 0 };
                const r = f.getBoundingClientRect();
                return { x: r.x, y: r.y };
            }"""
            )
        except Exception:
            iframe_off = {"x": 0, "y": 0}
        clip = {
            "x": max(0, iframe_off["x"] + meta["x"]),
            "y": max(0, iframe_off["y"] + meta["y"]),
            "width": max(1, meta["w"]),
            "height": max(1, meta["h"]),
        }
        chunks: list[list[str]] = []
        positions = meta.get("positions") or [0]
        prev_key: tuple[str, ...] | None = None
        for scroll_pos in positions:
            if scroll_pos:
                try:
                    await _eval_game_doc(shell, _SET_BEAD_SCROLL_JS, scroll_pos, iframe_pat=pat)
                    await shell.wait_for_timeout(120)
                except Exception:
                    pass
            try:
                png = await page.screenshot(clip=clip, animations="disabled")
                img = Image.open(io.BytesIO(png))
                seq = _scan_bead_crop(img)
                key = tuple(seq)
                if scroll_pos and key == prev_key:
                    break
                prev_key = key
                if seq:
                    chunks.append(seq)
            except Exception as exc:
                logger.debug("bead grid scan scroll=%s: %s", scroll_pos, exc)
        try:
            await _eval_game_doc(shell, _SET_BEAD_SCROLL_JS, 0, iframe_pat=pat)
        except Exception:
            pass
        merged = _merge_bead_sequences(chunks)
        if merged:
            return merged
    return []


async def _scrape_bead_canvas(frame: Frame, stats: dict | None = None, page: Page | None = None) -> list[BetSide]:
    """Doc bead plate tu canvas game — AE SEXY ve hang tron len canvas, khong co DOM con."""
    codes: list[str] = []

    if page:
        codes = await _scan_bead_grid_from_page(page)
        if codes:
            sides = _codes_to_sides(codes)
            if sides:
                c = _side_counts(sides)
                logger.info(
                    "Bead plate (grid-shot): %d van — B=%d P=%d T=%d",
                    len(sides),
                    c["banker"],
                    c["player"],
                    c["tie"],
                )
                return sides

    import base64

    try:
        payload = await _eval_game_doc(frame, _BEAD_CANVAS_SCAN_JS, iframe_pat=_GAME_DOC_PAT)
    except Exception as exc:
        logger.debug("bead canvas scan: %s", exc)
        return []
    if not payload or not payload.get("data"):
        if payload and payload.get("err"):
            logger.debug("bead canvas: %s", payload.get("err"))
        return []
    try:
        b64 = str(payload["data"]).split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
    except Exception as exc:
        logger.debug("canvas decode: %s", exc)
        return []

    codes: list[str] = []
    rect = payload.get("rect") or {}
    if rect.get("w") and rect.get("h"):
        x = int(rect["x"])
        y = int(rect["y"])
        w = int(rect["w"])
        h = int(rect["h"])
        crop = img.crop((x, y, min(img.width, x + w), min(img.height, y + h)))
        try:
            crop.save("data/debug_bead_crop.png")
        except Exception:
            pass
        codes = _scan_bead_crop(crop)

    if not codes:
        expected = _stats_total(stats)
        codes = scan_bead_from_canvas_screenshot(img, expected_total=expected)

    sides = _codes_to_sides(codes)
    if sides:
        c = _side_counts(sides)
        logger.info(
            "Bead plate (canvas-shot): %d van — B=%d P=%d T=%d",
            len(sides),
            c["banker"],
            c["player"],
            c["tie"],
        )
    return sides


async def _road_uses_canvas(frame: Frame) -> bool:
    try:
        return bool(await _eval_game_doc(frame, _IS_CANVAS_BEAD_JS, iframe_pat=_GAME_DOC_PAT))
    except Exception:
        return False


async def _screenshot_canvas_bead(frame: Frame, stats: dict | None) -> list[BetSide]:
    try:
        meta = await frame.evaluate(
            """() => [...document.querySelectorAll('canvas')]
              .map((c, idx) => ({ idx, area: c.width * c.height }))
              .filter(c => c.area >= 200 * 120)
              .sort((a,b)=>b.area-a.area)
              .slice(0, 2)"""
        )
    except Exception:
        return []
    expected = _stats_total(stats)
    best: list[BetSide] = []
    best_score = -1
    for item in meta or []:
        idx = int(item["idx"])
        try:
            png = await frame.locator("canvas").nth(idx).screenshot(timeout=3000, animations="disabled")
            img = Image.open(io.BytesIO(png))
            codes = scan_bead_from_canvas_screenshot(img, expected_total=expected)
            sides = _codes_to_sides(codes)
            score = _history_score(sides, stats)
            if score > best_score:
                best_score = score
                best = sides
        except Exception as exc:
            logger.debug("canvas shot idx=%s: %s", idx, exc)
    return best


async def _iter_game_frames(page: Page) -> list[Frame]:
    shells = await _game_shell_frames(page)
    frames: list[Frame] = []
    seen: set[int] = set()

    def add(frame: Frame | None):
        if frame and id(frame) not in seen:
            seen.add(id(frame))
            frames.append(frame)

    for shell in shells:
        add(shell)
    for frame in page.frames:
        url = frame.url or ""
        if _is_room_frame(url) or _is_game_frame(url):
            add(frame)
    return frames or shells


async def scrape_in_room_bead_plate(
    page: Page,
    ws_stats: dict[str, int] | None = None,
    *,
    allow_canvas: bool = False,
    light_dom: bool = False,
    display_truth: bool = False,
    skip_prepare: bool = False,
) -> tuple[list[BetSide], str]:
    """Doc hang tron B/P/T (bead plate) goc duoi trai — nguon lich su chuan tren ban."""
    if not skip_prepare:
        await _prepare_room_view(page)

    # display_truth: bead plate only; DOM trong thi canvas
    if display_truth:
        best_hist: list[BetSide] = []
        best_src = ""
        loops = 1 if light_dom else 3
        for attempt in range(loops):
            if attempt:
                await asyncio.sleep(1.0)
            for frame in await _iter_game_frames(page):
                use_canvas = await _road_uses_canvas(frame)
                if not use_canvas:
                    dom_hist = await _scrape_bead_dom(frame, 0)
                    if len(dom_hist) > len(best_hist):
                        best_hist = dom_hist
                        best_src = "bead-plate-dom"
                if allow_canvas and (use_canvas or len(best_hist) < 1):
                    canvas_hist = await _scrape_bead_canvas(frame, ws_stats, page=page)
                    if len(canvas_hist) > len(best_hist):
                        best_hist = canvas_hist
                        best_src = "grid-shot"
            if len(best_hist) >= 1:
                break
        if best_hist:
            c = _side_counts(best_hist)
            logger.info(
                "Bead plate (%s): %d van — B=%d P=%d T=%d",
                best_src,
                len(best_hist),
                c["banker"],
                c["player"],
                c["tie"],
            )
            return best_hist, best_src
        return [], ""

    best_hist = []
    best_src = ""
    best_score = -1
    loops = 1 if light_dom else 2

    for attempt in range(loops):
        if attempt:
            await asyncio.sleep(1.5)

        for frame in await _iter_game_frames(page):
            stats = await _read_stats(frame)
            if ws_stats and _stats_total(ws_stats) > _stats_total(stats):
                stats = {
                    "banker": ws_stats.get("banker", 0),
                    "player": ws_stats.get("player", 0),
                    "tie": ws_stats.get("tie", 0),
                    "total": sum(ws_stats.values()),
                }

            expected = _stats_total(stats) or _stats_total(ws_stats)
            use_canvas = await _road_uses_canvas(frame)
            dom_hist: list[BetSide] = []
            if not use_canvas:
                dom_hist = await _scrape_bead_dom(frame, expected)
                score = _history_score(dom_hist, stats)
                if score > best_score:
                    best_score, best_hist, best_src = score, dom_hist, "bead-plate-dom"

            if allow_canvas and (use_canvas or len(dom_hist) < 3):
                canvas_hist = await _scrape_bead_canvas(frame, stats or ws_stats, page=page)
                score = _history_score(canvas_hist, stats)
                if score > best_score:
                    best_score, best_hist, best_src = score, canvas_hist, "canvas-shot"

            if not light_dom:
                big_hist = await _scrape_big_road_dom(frame)
                score = _history_score(big_hist, stats)
                if score > best_score:
                    best_score, best_hist, best_src = score, big_hist, "big-road-dom"

                js_hist = await _find_bead_array(frame, stats)
                score = _history_score(js_hist, stats)
                if score > best_score:
                    best_score, best_hist, best_src = score, js_hist, "js-array"

        if best_score >= 1500:
            break

    if allow_canvas and best_score < 500:
        for frame in await _iter_game_frames(page):
            stats = await _read_stats(frame)
            if ws_stats and _stats_total(ws_stats) > _stats_total(stats):
                stats = {
                    "banker": ws_stats.get("banker", 0),
                    "player": ws_stats.get("player", 0),
                    "tie": ws_stats.get("tie", 0),
                    "total": sum(ws_stats.values()),
                }
            shot_hist = await _screenshot_canvas_bead(frame, stats)
            score = _history_score(shot_hist, stats)
            if score > best_score:
                best_score, best_hist, best_src = score, shot_hist, "canvas-shot"

    min_score = 400
    if ws_stats and _stats_total(ws_stats) >= 5:
        min_score = 250
    if display_truth and ws_stats:
        min_score = 2800
    if best_hist and ws_stats:
        err_budget = 0 if display_truth else 1
        best_hist = reconcile_history_to_stats(best_hist, ws_stats, max_count_err=err_budget)
        best_score = _history_score(best_hist, ws_stats)
    if best_hist and best_score >= min_score:
        c = _side_counts(best_hist)
        logger.info(
            "Bead plate (%s): %d van — B=%d P=%d T=%d",
            best_src,
            len(best_hist),
            c["banker"],
            c["player"],
            c["tie"],
        )
        return best_hist, best_src
    return [], ""


async def read_hooked_ws_messages(page: Page) -> list[dict]:
    msgs: list[dict] = []
    for frame in await _iter_game_frames(page):
        try:
            msgs.extend(await frame.evaluate(_READ_HOOKED_WS))
        except Exception:
            pass
    try:
        msgs.extend(await page.evaluate(_READ_HOOKED_WS))
    except Exception:
        pass
    return msgs


async def read_in_room_stats(page: Page) -> dict[str, int]:
    """Doc B/P/T tren thanh stats ban — chi khi dang trong ban (khong phai sanh)."""
    from src.ae_sexy import _get_shell_mode

    if await _get_shell_mode(page) != "room":
        return {}

    best: dict[str, int] = {}
    best_score = -1
    for frame in await _iter_game_frames(page):
        stats = await _read_stats(frame)
        if not stats:
            continue
        banker = int(stats.get("banker", 0))
        player = int(stats.get("player", 0))
        tie = int(stats.get("tie", 0))
        total = banker + player + tie
        if total < 3 or total > 250:
            continue
        if tie > total * 0.2:
            continue
        # Uu tien bo stats can bang (1 ban), khong lay tong max tu nhieu vung DOM
        balance = abs(banker - player)
        score = 1000 - balance * 3 - abs(total - 60)
        if score > best_score:
            best_score = score
            best = {"banker": banker, "player": player, "tie": tie}
    return best


async def read_room_stats_raw(page: Page) -> dict[str, int]:
    """Doc B/P/T ke ca khi = 0 — phat hien zombie ban (man den + stats reset)."""
    from src.ae_sexy import _get_shell_mode

    if await _get_shell_mode(page) != "room":
        return {}
    for frame in await _iter_game_frames(page):
        stats = await _read_stats(frame)
        if not stats:
            continue
        return {
            "banker": int(stats.get("banker", 0)),
            "player": int(stats.get("player", 0)),
            "tie": int(stats.get("tie", 0)),
        }
    return {}
