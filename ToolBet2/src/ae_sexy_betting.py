from __future__ import annotations

import logging
import re
import time

from playwright.async_api import Frame, Page

from src.ae_sexy import (
    _game_shell_frames,
    _hide_overlay_for_click,
    _lobby_frames,
    _os_click_viewport,
    _restore_overlay_after_click,
    _shell_iframe_js,
    _wrap_nested_js,
    overlay_click_passthrough,
)
from src.models import BetSide, SIDE_LABEL

logger = logging.getLogger(__name__)

# Pattern iframe ban — KHONG gom gamehall (khi trong ban se tim nham iframe sanh)
_BET_IFRAME_PAT = "singlebactable|bactable|webmain"

# Vung dat cuoc AE SEXY C01 — uu tien theo thu tu (phan tu dau = chinh).
# Nha con (Player/xanh): chipBoxPlayer / betBoxPlayer (vung "Tay con")
# Nha cai (Banker/do): chipBoxBanker / betBoxBanker (vung "Nha cai")
# askPlayerBtn/askBankerBtn la nut sidebar — KHONG phai vung dat chip
BET_ZONE_PLAYER: tuple[str, ...] = ("chipBoxPlayer", "betBoxPlayer")
BET_ZONE_BANKER: tuple[str, ...] = ("betBoxBanker", "chipBoxBanker")
BET_ZONE_TIE: tuple[str, ...] = ("chipBoxTie", "betBoxTie")
BET_ZONE_ALL_PROBE: tuple[str, ...] = (
    *BET_ZONE_PLAYER,
    *BET_ZONE_BANKER,
    *BET_ZONE_TIE,
)
_MIN_ZONE_PX = 20


DEFAULT_CHIP_VALUES = [10, 50, 100, 500, 1000, 5000]
TABLE_CHIP_VALUES: dict[int, list[int]] = {
    5: [10, 20, 50, 100, 200],
    # AE Sexy thuong: 10/20/50/100/200/500 (KHONG phai 25)
    6: [10, 20, 50, 100, 200, 500],
}

# Chi chip trong #chips — loai bg/amount/shadow. KHONG lay .list_select (trung / sai index).
# Playwright phai dung cung selector nay; neu khong loc, nth(1) trung child cua chip 10.
CHIP_TOKEN_CSS = (
    "#chips .chips3d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow), "
    "#chips .icon_bet_chips2d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow)"
)

_BET_PHASE_BODY = """
  const visEl = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if (parseFloat(s.opacity || '1') < 0.12) return false;
    if (s.pointerEvents === 'none') return false;
    return true;
  };
  const sizedEl = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    return r.width >= 8 && r.height >= 8 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const chips = [...document.querySelectorAll('#chips .chips3d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow), #chips .icon_bet_chips2d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow)')]
    .filter(el => !el.classList.contains('chips3d_bg') && !el.classList.contains('chips3d_amount') && !el.classList.contains('chips3d_shadow'));
  const chipsVisible = chips.some(visEl);
  const zoneIds = [
    'chipBoxPlayer', 'chipBoxBanker', 'chipBoxNoCommBanker', 'chipBoxBank',
    'askPlayerBtn', 'askBankerBtn', 'chipBoxTie',
  ];
  let zoneVisible = zoneIds.some((id) => visEl(document.getElementById(id)) || sizedEl(document.getElementById(id)));
  if (!zoneVisible) {
    zoneVisible = [...document.querySelectorAll('[id^="chipBox"]')].some((el) => {
      const id = (el.id || '').toLowerCase();
      if (/pair|phoenix|dragon|turtle|big|small|super|bonus|tai|xiu|fabulous|lucky/.test(id)) return false;
      return visEl(el) || sizedEl(el);
    });
  }
  const cdTime = document.getElementById('countdownTime');
  const cdWrap = document.getElementById('countdown');
  const text = document.body?.innerText || '';
  const cdRaw = cdTime ? (cdTime.textContent || '').trim() : '';
  let cdText = cdRaw;
  if (!cdText && cdTime) {
    const inner = cdTime.querySelector('p, span, b, strong');
    cdText = inner ? (inner.textContent || '').trim() : '';
  }
  if (!cdText && cdWrap) {
    const m = (cdWrap.textContent || '').match(/\\b(\\d{1,2})\\b/);
    if (m) cdText = m[1];
  }
  const cdNum = (String(cdText).match(/^(\\d+)/) || text.match(/(\\d{1,2})\\s*s/i) || [])[1] || '';
  const circle = document.querySelector('#progress-circle circle, #countdown circle');
  const circleStyle = circle ? getComputedStyle(circle) : null;
  const strokeOffRaw = circle ? (circle.style.strokeDashoffset || circleStyle?.strokeDashoffset || '0') : '0';
  const strokeOff = parseFloat(String(strokeOffRaw).replace('px','')) || 0;
  const strokeLen = parseFloat(String(circleStyle?.strokeDasharray || '0').split(' ')[0]) || 0;
  const progressActive = !!(circle && (strokeOff > 1 || (strokeLen > 0 && strokeOff < strokeLen - 0.5)));
  const hasCountdown = !!(cdNum && parseInt(cdNum, 10) > 0) || progressActive;
  const cdVisible = !!(cdWrap && visEl(cdWrap));
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normText = norm(text);
  const closed = /dang mo bai|opening cards|no more bet|het thoi gian dat cuoc|mo bai|vui long doi|please wait|stop betting/i.test(normText);
  const bettingText = /moi dat cuoc|dat cuoc|place your bet|start betting|sap bat dau/i.test(normText);
  const confirm = document.getElementById('confirm');
  const confirmEnabled = !!(confirm && (
    !confirm.classList.contains('disabled') ||
    confirm.classList.contains('enable') ||
    confirm.classList.contains('active')
  ));
  const confirmReady = !!(confirmEnabled && visEl(confirm));
  const confirmVisible = visEl(confirm);
  const open = !closed && chipsVisible && zoneVisible && (
    (hasCountdown && cdNum && parseInt(cdNum, 10) > 0) || (cdVisible && progressActive) || confirmReady || bettingText
  );
  const canClick = open && chipsVisible && zoneVisible;
  return {
    open, canClick, hasCountdown, cdVisible, progressActive, confirmReady, confirmVisible,
    chipsVisible, zoneVisible, closed, bettingText, moBai: closed, cdText: cdNum || cdText,
    chipCount: chips.length,
    confirmDisabled: confirm ? confirm.classList.contains('disabled') : true,
  };
"""

_VERIFY_BET_BODY = """
  const side = String(args[0] || '').toLowerCase();
  const visEl = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if (parseFloat(s.opacity || '1') < 0.1) return false;
    return true;
  };
  const stackOn = (id) => {
    const box = document.getElementById(id);
    if (!box) return false;
    const nodes = [box, ...box.querySelectorAll('*')];
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      const cls = String(el.className || '');
      const src = String(el.getAttribute?.('src') || '');
      const bg = window.getComputedStyle(el).backgroundImage || '';
      if (
        /chip|bet|stack|wager|token|amount/i.test(cls) ||
        /chip|bet/i.test(src) || /chip/i.test(bg) ||
        ((el.tagName === 'IMG' || el.tagName === 'CANVAS') && r.width > 10)
      ) return true;
      const t = (el.textContent || '').trim();
      if (/^\\d+$/.test(t) && parseInt(t, 10) >= 5) return true;
    }
    return false;
  };
  const player = stackOn('chipBoxPlayer') || stackOn('betBoxPlayer');
  const banker = stackOn('chipBoxBanker') || stackOn('betBoxBanker');
  const tie = stackOn('chipBoxTie') || stackOn('betBoxTie');
  const confirm = document.getElementById('confirm');
  const confirmEnabled = !!(confirm && (
    !confirm.classList.contains('disabled') ||
    confirm.classList.contains('enable') ||
    confirm.classList.contains('active')
  ));
  // Chi tin stack chip that — KHONG coi confirmReady = da dat (gay dat ao)
  let ok = false;
  if (side === 'player') ok = player;
  else if (side === 'banker') ok = banker;
  else if (side === 'tie') ok = tie;
  else ok = player || banker || tie;
  const confirmReady = confirmEnabled && visEl(confirm);
  return {
    ok, playerStack: player, bankerStack: banker, confirmReady,
    confirmDisabled: confirm ? confirm.classList.contains('disabled') : true,
    confirmVisible: visEl(confirm),
  };
"""

_PROBE_ZONES_BODY = """
  const visZone = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width >= %MIN_PX% && r.height >= %MIN_PX%;
  };
  const zones = {};
  for (const id of %ZONE_IDS%) {
    const el = document.getElementById(id);
    if (!el) { zones[id] = null; continue; }
    const r = el.getBoundingClientRect();
    zones[id] = {
      w: Math.round(r.width),
      h: Math.round(r.height),
      visible: visZone(el),
    };
  }
  return zones;
"""

_CHIP_LIST_JS = """
  const chips = [...document.querySelectorAll('#chips .chips3d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow), #chips .icon_bet_chips2d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow)')]
    .filter(el => !el.classList.contains('chips3d_bg') && !el.classList.contains('chips3d_amount') && !el.classList.contains('chips3d_shadow'));
  const parseVal = (el) => {
    if (!el) return 0;
    const amt = el.querySelector('.chips3d_amount, .chips2d_amount, [class*=\"amount\"]');
    let raw = ((amt && amt.textContent) || el.getAttribute('data-value') || el.getAttribute('data-chip') || '').replace(/[^\\d]/g, '');
    if (!raw) {
      const cls = String(el.className || '') + ' ' + String((amt && amt.className) || '');
      const m = cls.match(/(?:chips?3?d?[_-]?|chip[_-]?|value[_-]?)(10|20|25|50|100|200|500|1000|5000)\\b/i)
        || cls.match(/\\b(10|20|25|50|100|200|500|1000|5000)\\b/);
      if (m) raw = m[1];
    }
    if (!raw) {
      const t = ((amt && amt.textContent) || el.textContent || '').trim();
      const m2 = t.match(/\\b(10|20|25|50|100|200|500|1000|5000)\\b/);
      if (m2) raw = m2[1];
    }
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const isOn = (el) => {
    if (!el) return false;
    const cls = String(el.className || '');
    // Chi nhan marker selected ro rang — tranh \\bon\\b match nham
    if (/chips2d_on|chips3d_on|_on\\b|chip_on|is-selected|is_selected|selected|active/i.test(cls)) return true;
    const onChild = el.querySelector('.chips2d_on, .chips3d_on, [class*=\"chips2d_on\"], [class*=\"chips3d_on\"], [class$=\"_on\"], [class*=\"_on \"]');
    return !!onChild;
  };
  const selectedIdx = () => {
    let idx = chips.findIndex(isOn);
    if (idx >= 0) return idx;
    // Fallback: chip co ring/highlight (outline / boxShadow manh)
    let best = -1, bestScore = 0;
    chips.forEach((el, i) => {
      try {
        const s = window.getComputedStyle(el);
        let score = 0;
        if (s.outlineStyle && s.outlineStyle !== 'none') score += 2;
        if (s.boxShadow && s.boxShadow !== 'none') score += 1;
        if (score > bestScore) { bestScore = score; best = i; }
      } catch (_) {}
    });
    return bestScore > 0 ? best : -1;
  };
"""

_CHIP_SELECTED_BODY = (
    _CHIP_LIST_JS
    + """
  const p = Array.isArray(args[0]) ? args[0] : args;
  const wantVal = Number(p[0] || 0);
  const values = chips.map(parseVal);
  const idx = selectedIdx();
  const selectedValue = idx >= 0 ? values[idx] : 0;
  const ok = wantVal > 0 ? selectedValue === wantVal : idx >= 0;
  return {
    ok,
    count: chips.length,
    value: selectedValue,
    idx,
    on: idx >= 0,
    values,
    wantVal,
  };
"""
)

_SELECT_CHIP_VALUE_BODY = (
    _CHIP_LIST_JS
    + """
  const p = Array.isArray(args[0]) ? args[0] : args;
  const wantVal = Number(p[0] || 0);
  const values = chips.map(parseVal);
  const idx = chips.findIndex((c) => parseVal(c) === wantVal);
  if (idx < 0 || wantVal <= 0) {
    return { ok: false, err: 'not_found', values, wantVal, selectedValue: 0 };
  }
  const el = chips[idx];
  const target = el.querySelector('.chips3d_amount, .chips2d_amount, [class*=\"amount\"]') || el;
  try {
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } catch (_) {}
  const fire = (node) => {
    try {
      node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
      node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      node.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
      node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      try { node.click(); } catch (_) {}
      return true;
    } catch (e) { return false; }
  };
  fire(target);
  if (target !== el) fire(el);
  const idx2 = selectedIdx();
  const selectedValue = idx2 >= 0 ? parseVal(chips[idx2]) : 0;
  return {
    ok: selectedValue === wantVal,
    idx,
    values,
    wantVal,
    selectedValue,
    selectedIdx: idx2,
  };
"""
)

_GET_BET_UI_BODY = (
    _CHIP_LIST_JS
    + """
  const chipValues = chips.map(parseVal);
  const idx = selectedIdx();
  const confirm = document.getElementById('confirm');
  return {
    chipCount: chips.length,
    chipValues,
    selectedIdx: idx,
    selectedValue: idx >= 0 ? chipValues[idx] : 0,
    confirmDisabled: confirm ? confirm.classList.contains('disabled') : true,
  };
"""
)

_ZONE_AMOUNT_BODY = """
  const p = Array.isArray(args[0]) ? args[0] : args;
  const side = String(p[0] || '').toLowerCase();
  const ids = side === 'player'
    ? ['chipBoxPlayer', 'betBoxPlayer']
    : (side === 'tie'
      ? ['chipBoxTie', 'betBoxTie']
      : ['chipBoxBanker', 'betBoxBanker']);
  const parseNums = (root) => {
    if (!root) return [];
    const out = [];
    const push = (n) => {
      if (Number.isFinite(n) && n >= 5 && n <= 50000) out.push(n);
    };
    // 1) Text so tren amount chip trong zone
    for (const el of root.querySelectorAll('.chips3d_amount, .chips2d_amount, [class*=\"amount\"]')) {
      const raw = ((el.textContent || '') + '').replace(/[^\\d]/g, '');
      if (raw) push(parseInt(raw, 10));
    }
    // 2) Text node chi chua so (tong cuoc)
    const nodes = [root, ...root.querySelectorAll('span,div,p,b,strong,label')];
    for (const el of nodes) {
      const t = (el.textContent || '').trim();
      if (!t || t.length > 8) continue;
      if (el.children && el.children.length > 2) continue;
      const raw = t.replace(/[^\\d]/g, '');
      if (!raw || raw.length > 6) continue;
      if (!/^\\d+$/.test(raw)) continue;
      push(parseInt(raw, 10));
    }
    return out;
  };
  let amount = 0;
  let nums = [];
  for (const id of ids) {
    const box = document.getElementById(id);
    const found = parseNums(box);
    if (found.length) {
      nums = found;
      // Tong stack: uu tien so gan stake hop ly — lay max (thuong la tong)
      amount = Math.max(...found);
      break;
    }
  }
  return { amount, nums, side };
"""


_GET_BET_CLICK_POS_BODY = """
  const p = Array.isArray(args[0]) ? args[0] : args;
  const side = p[0];
  const chipIndex = p[1];

  const room = (() => {
    const list = [...document.querySelectorAll('iframe')];
    const big = (f) => f.clientWidth > 80 && f.clientHeight > 80;
    const hasBetUI = (doc) => doc && (doc.getElementById('chipBoxPlayer') || doc.querySelector('#chips .chips3d'));
    let hit = list.find(f => big(f) && /singlebactable|bactable/i.test((f.src || '').toLowerCase()));
    if (hit) return hit;
    hit = list.find(f => hasBetUI(f.contentDocument));
    return hit;
  })();
  const doc = room?.contentDocument;
  if (!doc) return { ok: false, err: 'no_room' };

  const text = doc.body?.innerText || '';
  if (/đang mở bài|opening cards|no more bet|mở bài|vui lòng đợi|please wait/i.test(text)) {
    return { ok: false, err: 'betting_closed' };
  }

  const confirm = doc.getElementById('confirm');

  const toShellPos = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) return null;
    let x = r.left + r.width / 2;
    let y = r.top + r.height / 2;
    let frame = room;
    while (frame) {
      const fr = frame.getBoundingClientRect();
      x += fr.left;
      y += fr.top;
      const win = frame.ownerDocument?.defaultView;
      frame = win?.frameElement || null;
    }
    return { x, y };
  };

  const chips = [...doc.querySelectorAll('#chips .chips3d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow), #chips .icon_bet_chips2d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow)')]
    .filter(el => !el.classList.contains('chips3d_bg') && !el.classList.contains('chips3d_amount') && !el.classList.contains('chips3d_shadow'));
  const chipEl = chips[chipIndex];
  const chipPos = toShellPos(chipEl);

  const sideLow = String(side || '').toLowerCase();
  const visZone = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 20 && r.height >= 20;
  };
  const playerIds = %PLAYER_IDS%;
  const bankerIds = %BANKER_IDS%;
  const tieIds = %TIE_IDS%;
  const zoneIds = sideLow === 'player' ? playerIds
    : (sideLow === 'tie' ? tieIds : bankerIds);
  let zonePos = null;
  for (const zid of zoneIds) {
    const el = doc.getElementById(zid);
    if (visZone(el)) {
      zonePos = toShellPos(el);
      if (zonePos) break;
    }
  }
  if (!zonePos) {
    return { ok: false, err: !chipPos ? 'no_chip' : 'no_zone', chipPos, zonePos: null, confirmPos: toShellPos(confirm), chipCount: chips.length, confirmDisabled: confirm ? confirm.classList.contains('disabled') : true };
  }

  const confirmPos = toShellPos(confirm);
  return {
    ok: !!(chipPos && zonePos),
    err: !chipPos ? 'no_chip' : !zonePos ? 'no_zone' : '',
    chipPos,
    zonePos,
    confirmPos,
    chipCount: chips.length,
    confirmDisabled: confirm ? confirm.classList.contains('disabled') : true,
  };
"""

_NESTED_CLICK_BODY = """
  const p = Array.isArray(args[0]) ? args[0] : args;
  const target = p[0];
  const chipIndex = p[1];
  const doc = document;

  const clickEl = (el) => {
    if (!el) return false;
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch (e) {
      try { el.click(); return true; } catch (_) { return false; }
    }
  };

  if (target === 'chip') {
    const chips = [...document.querySelectorAll('#chips .chips3d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow), #chips .icon_bet_chips2d:not(.chips3d_bg):not(.chips3d_amount):not(.chips3d_shadow)')]
    .filter(el => !el.classList.contains('chips3d_bg') && !el.classList.contains('chips3d_amount') && !el.classList.contains('chips3d_shadow'));
    return { ok: clickEl(chips[chipIndex]) };
  }
  if (target === 'zone') {
    const sideLow = String(p[2] || '').toLowerCase();
    const visZone = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 20 && r.height >= 20;
    };
    const playerIds = %PLAYER_IDS%;
    const bankerIds = %BANKER_IDS%;
    const tieIds = %TIE_IDS%;
    const ids = sideLow === 'player' ? playerIds
      : (sideLow === 'tie' ? tieIds : bankerIds);
    for (const zid of ids) {
      const el = doc.getElementById(zid);
      if (visZone(el) && clickEl(el)) return { ok: true, id: zid };
    }
    return { ok: false };
  }
  if (target === 'confirm') {
    const confirm = doc.getElementById('confirm');
    if (!confirm) return { ok: false, err: 'no_confirm' };
    if (confirm.classList.contains('disabled') && !confirm.classList.contains('enable')
        && !confirm.classList.contains('active')) {
      return { ok: false, err: 'confirm_disabled' };
    }
    return { ok: clickEl(confirm) };
  }
  return { ok: false, err: 'bad_target' };
"""


def chip_values_for_count(count: int) -> list[int]:
    if count in TABLE_CHIP_VALUES:
        return list(TABLE_CHIP_VALUES[count])
    if count <= 0:
        return list(TABLE_CHIP_VALUES.get(5, DEFAULT_CHIP_VALUES[:5]))
    return list(DEFAULT_CHIP_VALUES[:count])


def resolve_chip_values(chip_count: int, dom_values: list[int] | None = None) -> list[int]:
    """Uu tien menh gia doc tu DOM; fallback bang TABLE_CHIP_VALUES theo so chip."""
    if dom_values:
        positional = [int(v or 0) for v in dom_values]
        positive = [value for value in positional if value > 0]
        # Keep positional zeros so the returned indexes still match the DOM.
        # Stake planning already ignores non-positive denominations.
        if len(positional) == int(chip_count) and len(positive) >= 2:
            return positional
        if len(positive) >= 2 and len(positive) == len(positional):
            return positive
    return chip_values_for_count(int(chip_count) if chip_count else 5)


def split_stake_by_available_chips(
    stake: int, chip_values: list[int] | None = None
) -> list[tuple[int, int]] | None:
    """Chia dung stake theo menh gia phinh dang co, lon den nho.

    Day la cung co che ``makePlan`` cua BaccaratChromeAgent2: phinh duoc lay
    tu DOM, sap xep giam dan va dung lap lai mot menh gia khi can. Vi du khay
    ``[10, 50, 100, 500, 1000]`` va stake ``120`` thanh ``[(100, 1), (10, 2)]``.
    Tra ve ``None`` neu khong the tao dung tong tien.
    """
    amount = int(stake)
    if amount == 0:
        return []
    if amount < 0:
        return None
    denominations = sorted(
        {int(value) for value in (chip_values or DEFAULT_CHIP_VALUES) if int(value) > 0},
        reverse=True,
    )
    if not denominations:
        return None

    remaining = amount
    plan: list[tuple[int, int]] = []
    for value in denominations:
        clicks = remaining // value
        if clicks:
            plan.append((value, clicks))
            remaining -= value * clicks
    return plan if remaining == 0 else None


def stake_to_chip_clicks(stake: int, chip_values: list[int] | None = None) -> list[tuple[int, int]] | None:
    """Chia stake thanh (chip_index, so_lan_click), UU TIEN CHIP LON TRUOC.
    Tra ve None neu khong dat chinh xac. Stake 0 → [].
    """
    chips = list(chip_values or DEFAULT_CHIP_VALUES)
    value_plan = split_stake_by_available_chips(stake, chips)
    if value_plan is None:
        return None
    chip_indexes = {
        int(value): index
        for index, value in enumerate(chips)
        if int(value) > 0
    }
    return [(chip_indexes[value], clicks) for value, clicks in value_plan]


# AE Sexy: lan click chip 10 DAU TIEN tren ban bi ep thanh 20 (min/table quirk).
CHIP_10_FIRST_DEPOSIT = 20


def value_plan_total(plan: list[tuple[int, int]]) -> int:
    """Tong menh gia mat (khong tinh quirk game)."""
    return sum(int(v) * int(n) for v, n in plan)


def value_plan_effective_total(plan: list[tuple[int, int]]) -> int:
    """Tong thuc te game ghi nhan.

    Quirk AE Sexy: neu CLICK DAU TIEN cua ca lan dat la chip 10 → ghi 20,
    NHUNG stake dung 10 (plan = 10x1) van = 10 (ban min chip 10).
    Chip 10 o cuoi (sau 50/20/...) van = 10.
    """
    return value_plan_total(plan)
    if not plan:
        return 0
    # Mot click chip 10 = stake 10 — khong ep 20
    if len(plan) == 1 and int(plan[0][0]) == 10 and int(plan[0][1]) == 1:
        return 10
    total = 0
    first_click = True
    for v, n in plan:
        v, n = int(v), int(n)
        for _ in range(max(0, n)):
            if first_click and v == 10:
                total += CHIP_10_FIRST_DEPOSIT
            else:
                total += v
            first_click = False
    return total


def _chip10_quirk_clicks(amount: int) -> int | None:
    """So lan click chip 10 de dat dung `amount` (lan 1 = 20, chi khi amount>=20)."""
    amount = int(amount)
    if amount < CHIP_10_FIRST_DEPOSIT or amount % 10 != 0:
        return None
    # 20 + 10*(n-1) = amount  →  n = amount/10 - 1
    n = amount // 10 - 1
    if n < 1 or n > 8:
        return None
    return n


def stake_to_value_clicks(
    stake: int, chip_values: list[int] | None = None
) -> list[tuple[int, int]] | None:
    """Ke hoach theo MENH GIA + quirk AE Sexy (chip 10 dau = 20, tru stake=10).

    Uu tien:
    - stake 10 → chip 10 x1 (ban co menh gia 10)
    - 80 (co chip 10 trong greedy) → 20x4 (tranh chip 10)
    - 30 = 20+10 greedy → 10x2 (lan 1 ep 20, chon lai 10 → +10 = 30)
    - 80/130... lon→nho, chip 10 chi o CUOI (50+20+10)
    """
    return split_stake_by_available_chips(stake, chip_values)
    chips = list(chip_values or DEFAULT_CHIP_VALUES)
    amount = int(stake)
    if amount == 0:
        return []
    chip_set = {int(c) for c in chips if int(c) > 0}
    # Stake = chip 10: 1 click — khong dung quirk 10→20
    if amount == 10 and 10 in chip_set:
        return [(10, 1)]

    plan_idx = stake_to_chip_clicks(stake, chips)
    if plan_idx is None:
        return None
    if not plan_idx:
        return []
    greedy = [(int(chips[i]), int(n)) for i, n in plan_idx]

    uses_ten = any(v == 10 for v, _n in greedy)
    # 1) Co the thuan chip 20 → tranh quirk 10 (vd 80→20x4, 60→20x3)
    if uses_ten and 20 in chip_set and amount % 20 == 0:
        n20 = amount // 20
        if 1 <= n20 <= 8:
            return [(20, n20)]

    # 2) 20+10 (stake 30): 10x2 — chon 10, cua; chon lai 10, cua; xac nhan
    if greedy == [(20, 1), (10, 1)] and 10 in chip_set:
        n10 = _chip10_quirk_clicks(amount)
        if n10 is not None:
            quirk = [(10, n10)]
            if value_plan_effective_total(quirk) == amount:
                return quirk

    # 3) Greedy khong lead bang 10
    if greedy[0][0] != 10:
        return greedy

    # 4) Lead bang 10: dung quirk thuan 10 neu khop (amount>=20)
    n10 = _chip10_quirk_clicks(amount)
    if n10 is not None and 10 in chip_set:
        quirk = [(10, n10)]
        if value_plan_effective_total(quirk) == amount:
            return quirk

    # 5) Plan lead 10 ma effective != stake — khong dat duoc
    if greedy[0][0] == 10 and value_plan_effective_total(greedy) != amount:
        return None

    return greedy


def chip_plan_total(plan: list[tuple[int, int]], chip_values: list[int]) -> int:
    return sum(chip_values[i] * n for i, n in plan)


def stake_placeable_exactly(stake: int, chip_values: list[int] | None = None) -> bool:
    """Stake 0 luon hop le (van theo doi, khong dat chip)."""
    if int(stake) == 0:
        return True
    chips = chip_values or DEFAULT_CHIP_VALUES
    plan = stake_to_chip_clicks(stake, chips)
    return plan is not None and chip_plan_total(plan, chips) == stake


def validate_progression_stakes(stakes: list[int], chip_values: list[int] | None = None) -> list[int]:
    """Tra ve cac muc trong chuoi khong dat chinh xac bang chip tren ban (bo qua muc 0)."""
    chips = chip_values or TABLE_CHIP_VALUES.get(5, DEFAULT_CHIP_VALUES[:5])
    bad: list[int] = []
    for s in stakes:
        if int(s) < 0 or not stake_placeable_exactly(s, chips):
            bad.append(s)
    return bad


def zone_ids_for_side(side: BetSide) -> list[str]:
    """ID nut vung cuoc theo ben — uu tien phan tu dau."""
    if side == BetSide.PLAYER:
        return list(BET_ZONE_PLAYER)
    if side == BetSide.BANKER:
        return list(BET_ZONE_BANKER)
    if side == BetSide.TIE:
        return list(BET_ZONE_TIE)
    return []


def _zones_js_array(ids: tuple[str, ...] | list[str]) -> str:
    return "[" + ", ".join(f"'{z}'" for z in ids) + "]"


def _inject_zone_ids(body: str) -> str:
    return (
        body.replace("%PLAYER_IDS%", _zones_js_array(BET_ZONE_PLAYER))
        .replace("%BANKER_IDS%", _zones_js_array(BET_ZONE_BANKER))
        .replace("%TIE_IDS%", _zones_js_array(BET_ZONE_TIE))
        .replace("%ZONE_IDS%", _zones_js_array(BET_ZONE_ALL_PROBE))
        .replace("%MIN_PX%", str(_MIN_ZONE_PX))
    )


async def _click_at_shell_pos(page: Page, x: float, y: float) -> bool:
    """Click tin cay qua toa do viewport — #iframe_game (vipbet) hoac #iframeGameHall (provider)."""
    async with overlay_click_passthrough(page):
        for sel in ("#iframe_game", "#iframeGame", "#iframeGameHall"):
            box = await page.locator(sel).bounding_box()
            if box:
                try:
                    await page.mouse.click(box["x"] + x, box["y"] + y)
                    await page.wait_for_timeout(250)
                    return True
                except Exception as exc:
                    logger.debug("mouse.click %s: %s", sel, exc)
            iframe_loc = page.locator(sel)
            if await iframe_loc.count():
                try:
                    await iframe_loc.click(position={"x": x, "y": y}, timeout=5000)
                    await page.wait_for_timeout(250)
                    return True
                except Exception:
                    pass
        if await _os_click_viewport(page, x, y):
            await page.wait_for_timeout(250)
            return True
        return False


async def _bet_ui_frame(page: Page) -> Frame | None:
    """Frame Playwright chua UI dat cuoc (singleBacTable/bactable)."""
    pat = re.compile(r"singlebactable|bactable", re.I)
    for frame in page.frames:
        if not pat.search(frame.url or ""):
            continue
        try:
            if await frame.evaluate("() => !!document.getElementById('chipBoxPlayer')"):
                return frame
        except Exception:
            continue
    for frame in page.frames:
        try:
            if await frame.evaluate("() => !!document.getElementById('chipBoxPlayer')"):
                return frame
        except Exception:
            continue
    return None


async def _eval_in_bet_ui(page: Page, body: str, *args) -> dict | None:
    """Chay JS trong frame UI cuoc that (bactable) — uu tien hon lobby shell."""
    payload = list(args) if args else []
    bet = await _bet_ui_frame(page)
    if bet:
        try:
            info = await bet.evaluate(f"(args) => {{ {body} }}", payload)
            if info is not None:
                return info
        except Exception as exc:
            logger.debug("eval bet_ui_frame: %s", exc)
    fn = _wrap_nested_js(body, _BET_IFRAME_PAT)
    for frame in await _lobby_frames(page):
        try:
            info = await frame.evaluate(fn, payload)
            if info is not None:
                return info
        except Exception:
            continue
    for frame in await _game_shell_frames(page):
        try:
            info = await frame.evaluate(fn, payload)
            if info is not None:
                return info
        except Exception:
            continue
    return None


async def _chip_selected(
    page: Page, chip_index: int = -1, *, chip_value: int = 0
) -> bool:
    """True khi chip DANG SELECT tren khay co menh gia == chip_value."""
    want = int(chip_value or 0)
    if want <= 0:
        return False
    info = await _eval_in_bet_ui(page, _CHIP_SELECTED_BODY, want)
    return bool(info and info.get("ok"))


async def _select_chip_value_js(page: Page, chip_value: int) -> bool:
    """Click chip theo menh gia bang JS trong iframe ban — tin cay hon Playwright nth."""
    info = await _eval_in_bet_ui(page, _SELECT_CHIP_VALUE_BODY, int(chip_value))
    if info and info.get("ok"):
        return True
    if info:
        logger.warning(
            "JS select chip %s that bai — selected=%s tray=%s",
            chip_value,
            info.get("selectedValue"),
            info.get("values"),
        )
    return False


async def _read_zone_amount(page: Page, side: BetSide) -> int:
    info = await _eval_in_bet_ui(page, _ZONE_AMOUNT_BODY, side.value)
    if not info:
        return 0
    return int(info.get("amount") or 0)


async def _chip_tray_info(page: Page) -> dict:
    """Doc khay chip: values + chip dang select."""
    info = await _eval_in_bet_ui(page, _GET_BET_UI_BODY)
    if info and info.get("chipCount"):
        return info
    return {}


async def _find_chip_index_for_value(page: Page, value: int) -> int:
    info = await _chip_tray_info(page)
    values = info.get("chipValues") or []
    for i, v in enumerate(values):
        if int(v or 0) == int(value):
            return i
    chips = resolve_chip_values(int(info.get("chipCount") or 5), values or None)
    try:
        return chips.index(int(value))
    except ValueError:
        return -1


async def _zone_ids_for_side(side: BetSide) -> list[str]:
    return zone_ids_for_side(side)


async def _resolve_zone_locator(frame: Frame, side: BetSide):
    """Tim nut vung cuoc visible dau tien cho ben player/banker."""
    for zid in zone_ids_for_side(side):
        loc = frame.locator(f"#{zid}")
        if await loc.count():
            box = await loc.first.bounding_box()
            if box and box.get("width", 0) >= _MIN_ZONE_PX and box.get("height", 0) >= _MIN_ZONE_PX:
                return loc.first, zid
    return None, ""


async def probe_bet_zones(page: Page) -> dict[str, dict | None]:
    """Kich thuoc/visible cac nut dat cuoc — dung de debug C01."""
    fn = _wrap_nested_js(_inject_zone_ids(_PROBE_ZONES_BODY), _BET_IFRAME_PAT)
    for frame in await _lobby_frames(page):
        try:
            zones = await frame.evaluate(fn)
            if zones:
                return zones
        except Exception:
            continue
    return {}


async def side_zone_visible(page: Page, side: BetSide) -> tuple[bool, str]:
    """Ben cuoc co nut dat visible khong — tra ve (ok, zone_id)."""
    zones = await probe_bet_zones(page)
    for zid in zone_ids_for_side(side):
        info = zones.get(zid)
        if info and info.get("visible"):
            return True, zid
    return False, ""


async def _select_chip_value_mouse(page: Page, chip_value: int) -> bool:
    """Click chip bang toa do chuot that (can cho nested iframe 222b/provider)."""
    frame = await _bet_ui_frame(page)
    if not frame or chip_value <= 0:
        return False
    resolved = await _find_chip_index_for_value(page, chip_value)
    if resolved < 0:
        return False
    chips = frame.locator(CHIP_TOKEN_CSS)
    chip = chips.nth(resolved)
    if await chip.count() == 0:
        return False
    try:
        await chip.scroll_into_view_if_needed(timeout=2000)
    except Exception:
        pass
    for _ in range(3):
        try:
            amt = chip.locator(".chips3d_amount, .chips2d_amount, [class*='amount']").first
            target = amt if await amt.count() else chip
            box = await target.bounding_box()
            if not box:
                box = await chip.bounding_box()
            if not box:
                await target.click(timeout=3000, force=True)
            else:
                await page.mouse.click(
                    box["x"] + box["width"] / 2,
                    box["y"] + box["height"] / 2,
                )
        except Exception as exc:
            logger.debug("mouse select chip %s: %s", chip_value, exc)
            try:
                await chip.click(timeout=3000, force=True)
            except Exception:
                pass
        await page.wait_for_timeout(350)
        if await _chip_selected(page, chip_value=chip_value):
            return True
    return False


async def _playwright_click_bet(
    page: Page,
    side: BetSide,
    chip_index: int,
    *,
    zone_clicks: int = 1,
    chip_value: int = 0,
) -> bool:
    """Click chip (theo menh gia) + zone. Bat buoc selectedValue == chip_value."""
    if chip_value <= 0:
        return False
    frame = await _bet_ui_frame(page)
    if not frame:
        return False
    await _hide_overlay_for_click(page)
    try:
        selected = False
        # 1) JS click theo menh gia (uu tien)
        for _ in range(3):
            if await _select_chip_value_js(page, chip_value):
                selected = True
                break
            await page.wait_for_timeout(200)

        # 2) Mouse that theo bounding box (provider tab / nested iframe)
        if not selected:
            if await _select_chip_value_mouse(page, chip_value):
                selected = True

        # 3) Fallback Playwright nth theo index resolve tu tray
        if not selected:
            resolved = await _find_chip_index_for_value(page, chip_value)
            if resolved < 0:
                logger.warning("Khong tim thay chip menh gia %s tren khay", chip_value)
                return False
            chip_index = resolved
            chips = frame.locator(CHIP_TOKEN_CSS)
            chip = chips.nth(chip_index)
            if await chip.count() == 0:
                return False
            try:
                await chip.scroll_into_view_if_needed(timeout=2000)
            except Exception:
                pass
            for _sel_try in range(3):
                try:
                    amt = chip.locator(
                        ".chips3d_amount, .chips2d_amount, [class*='amount']"
                    ).first
                    if await amt.count():
                        await amt.click(timeout=3000, force=True)
                    else:
                        await chip.click(timeout=5000, force=True)
                except Exception:
                    try:
                        await chip.click(timeout=5000, force=True)
                    except Exception:
                        pass
                await page.wait_for_timeout(300)
                if await _chip_selected(page, chip_value=chip_value):
                    selected = True
                    break

        if not selected:
            tray = await _chip_tray_info(page)
            logger.warning(
                "KHONG select duoc chip %s — selected=%s tray=%s — HUY (tranh dat 20 thay 10)",
                chip_value,
                tray.get("selectedValue"),
                tray.get("chipValues"),
            )
            return False

        zone_ids = zone_ids_for_side(side)
        for zid in zone_ids:
            loc = frame.locator(f"#{zid}")
            if not await loc.count():
                continue
            box = await loc.first.bounding_box()
            if not box or box.get("width", 0) < _MIN_ZONE_PX or box.get("height", 0) < _MIN_ZONE_PX:
                continue
            for click_i in range(zone_clicks):
                # AE Sexy: sau moi lan zone phai chon LAI chip (chip 10 lan 1→20,
                # lan 2 can select lai moi +10). Khong chi select khi "mat".
                if not await _select_chip_value_js(page, chip_value):
                    if not await _select_chip_value_mouse(page, chip_value):
                        logger.warning(
                            "Mat select chip %s truoc zone click %s/%s — HUY",
                            chip_value,
                            click_i + 1,
                            zone_clicks,
                        )
                        return False
                await page.wait_for_timeout(200)
                try:
                    await loc.first.click(timeout=5000)
                except Exception:
                    await loc.first.click(timeout=5000, force=True)
                await page.wait_for_timeout(450)
                # KHONG return som khi con click (vd 140 = 100 + 20x2) —
                # is_bet_placed True sau click 1 se bo sot click 2 → zone=120
            if await is_bet_placed(page, side):
                return True
            detail = await _bet_placed_detail(page, side)
            if detail.get("confirmReady") or detail.get("ok"):
                return True
        logger.warning(
            "Khong dat chip %s len vung %s — da thu: %s",
            chip_value,
            side.value,
            ", ".join(zone_ids),
        )
        return False
    except Exception as exc:
        logger.debug("playwright_click_bet: %s", exc)
        return False
    finally:
        await _restore_overlay_after_click(page)


async def _viewport_click_bet(
    page: Page,
    side: BetSide,
    chip_index: int,
    *,
    zone_clicks: int = 1,
    chip_value: int = 0,
) -> bool:
    """Click chip + zone qua toa do shell — van bat buoc dung menh gia."""
    if chip_value <= 0:
        return False
    if not await _select_chip_value_js(page, chip_value):
        resolved = await _find_chip_index_for_value(page, chip_value)
        if resolved < 0:
            return False
        chip_index = resolved
        pos = await _get_bet_click_pos(page, side, chip_index)
        if not pos or not pos.get("chipPos"):
            return False
        for _ in range(3):
            await _click_at_shell_pos(page, pos["chipPos"]["x"], pos["chipPos"]["y"])
            await page.wait_for_timeout(300)
            if await _chip_selected(page, chip_value=chip_value):
                break
        else:
            return False
        zone_pos = pos.get("zonePos")
    else:
        # Da select bang JS — chi can toa do zone
        resolved = await _find_chip_index_for_value(page, chip_value)
        chip_index = resolved if resolved >= 0 else 0
        pos = await _get_bet_click_pos(page, side, chip_index)
        zone_pos = pos.get("zonePos") if pos else None
    if not zone_pos:
        return False
    for click_i in range(zone_clicks):
        # Chon lai chip moi lan (quirk 10→20 can re-select)
        if not await _select_chip_value_js(page, chip_value):
            if not await _select_chip_value_mouse(page, chip_value):
                return False
        await page.wait_for_timeout(200)
        if not await _click_at_shell_pos(page, zone_pos["x"], zone_pos["y"]):
            return False
        await page.wait_for_timeout(350)
        # Hoan tat du so lan click truoc khi coi la dat xong (tranh 20x2 → chi 1 lan)
    return await is_bet_placed(page, side)


async def _get_bet_click_pos(page: Page, side: BetSide, chip_index: int) -> dict | None:
    fn = _shell_iframe_js(_inject_zone_ids(_GET_BET_CLICK_POS_BODY))
    for frame in await _game_shell_frames(page):
        try:
            pos = await frame.evaluate(fn, [side.value, chip_index])
            if pos and pos.get("ok"):
                return pos
        except Exception as exc:
            logger.debug("Lay vi tri cuoc: %s", exc)
    return None


async def _nested_click(page: Page, target: str, chip_index: int = 0, side: str = "") -> bool:
    fn = _wrap_nested_js(_inject_zone_ids(_NESTED_CLICK_BODY), _BET_IFRAME_PAT)
    for frame in await _lobby_frames(page):
        try:
            payload = [target, chip_index, side] if target == "zone" else [target, chip_index]
            res = await frame.evaluate(fn, payload)
            if res and res.get("ok"):
                await page.wait_for_timeout(200)
                return True
        except Exception:
            continue
    return False


async def probe_betting_phase(page: Page) -> dict:
    """Trang thai cua cuoc — chip/zone/countdown co the bam duoc khong."""
    fn = _wrap_nested_js(_BET_PHASE_BODY, _BET_IFRAME_PAT)
    for frame in await _lobby_frames(page):
        try:
            info = await frame.evaluate(fn)
            if info:
                return info
        except Exception:
            continue
    return {}


async def is_betting_open(page: Page) -> bool:
    info = await probe_betting_phase(page)
    return bool(info.get("open"))


async def is_betting_clickable(page: Page) -> bool:
    """Chip + vung cuoc san sang — co the bat dau click."""
    info = await probe_betting_phase(page)
    return bool(info.get("canClick"))


async def _bet_placed_detail(page: Page, side: BetSide | None = None) -> dict:
    fn = _wrap_nested_js(_VERIFY_BET_BODY, _BET_IFRAME_PAT)
    side_val = side.value if side else ""
    for frame in await _lobby_frames(page):
        try:
            info = await frame.evaluate(fn, [side_val])
            if info:
                return info
        except Exception:
            continue
    return {}


async def is_bet_placed(page: Page, side: BetSide | None = None) -> bool:
    info = await _bet_placed_detail(page, side)
    return bool(info.get("ok"))


async def _betting_ready(page: Page, side: BetSide, phase: dict) -> bool:
    """Cua cuoc san sang — chip + zone ben cuoc + countdown/confirm va khong dang mo bai."""
    if phase.get("closed") or phase.get("moBai"):
        return False
    if not phase.get("chipsVisible"):
        return False
    zone_ok, zone_id = await side_zone_visible(page, side)
    if not zone_ok:
        return False
    cd = str(phase.get("cdText") or "").strip()
    has_cd = bool(cd and cd.isdigit() and int(cd) >= 3)
    if phase.get("confirmReady"):
        return True
    if has_cd:
        return True
    if phase.get("bettingText"):
        return True
    if phase.get("progressActive"):
        return True
    if phase.get("cdVisible") and phase.get("hasCountdown"):
        return True
    return False


async def wait_and_place_bet(
    page: Page,
    side: BetSide,
    amount: int,
    *,
    timeout_sec: int = 55,
    click_scope=None,
    pre_click_guard=None,
    place_when_remaining_seconds: int = 10,
) -> bool:
    """Cho cua cuoc mo (chip + zone + countdown) roi dat cuoc ngay trong thoi gian cho phep.
    amount=0: van theo doi — cho cua mo, khong click chip, van tinh thang/thua nhom.
    """
    if side == BetSide.PLAYER:
        label = "xanh"
    elif side == BetSide.BANKER:
        label = "do"
    elif side == BetSide.TIE:
        label = "hoa"
    else:
        label = SIDE_LABEL.get(side, str(side))
    polls = max(1, int(timeout_sec * 1000 / 200))
    last_log = -5
    last_fail_log = 0.0
    virtual = int(amount) <= 0
    try:
        threshold = max(3, int(place_when_remaining_seconds))
    except (TypeError, ValueError):
        threshold = 10

    for i in range(polls):
        phase = await probe_betting_phase(page)
        if phase.get("closed") or phase.get("moBai"):
            if i - last_log >= 25:
                last_log = i
                logger.debug("Cho cua cuoc... (%ds) dang mo bai/dong cua", int(i * 0.2))
        elif await _betting_ready(page, side, phase):
            cd_text = str(phase.get("cdText") or "").strip()
            countdown = int(cd_text) if cd_text.isdigit() else None
            if countdown is None:
                if i - last_log >= 15:
                    last_log = i
                    logger.warning(
                        "[BET_COUNTDOWN_INVALID] %s %s | cd=%r | cho countdown hop le",
                        label,
                        amount,
                        cd_text,
                    )
                await page.wait_for_timeout(200)
                continue
            if countdown < 3:
                if i - last_log >= 10:
                    last_log = i
                    logger.info(
                        "[BET_COUNTDOWN_LATE] %s %s | con %ss (< 3), khong click",
                        label,
                        amount,
                        countdown,
                    )
                await page.wait_for_timeout(200)
                continue
            if countdown > threshold:
                if i - last_log >= 10:
                    last_log = i
                    logger.info(
                        "[BET_WAIT_COUNTDOWN] %s %s | con %ss, cho nguong %ss",
                        label,
                        amount,
                        countdown,
                        threshold,
                    )
                await page.wait_for_timeout(200)
                continue
            logger.info(
                "[BET_COUNTDOWN_READY] %s %s | con %ss, nguong %ss",
                label,
                amount,
                countdown,
                threshold,
            )
            _, zone_id = await side_zone_visible(page, side)
            if virtual:
                logger.info(
                    "[PHIEN] VAN_THEO_DOI stake=0 | tin hieu %s | cd=%s zone=%s — khong dat chip",
                    label,
                    phase.get("cdText", ""),
                    zone_id or "?",
                )
                return True
            logger.info(
                "[PHIEN] DANG_DAT_CUOC | %s %s | cd=%s chips=%s zone=%s",
                label,
                amount,
                phase.get("cdText", ""),
                phase.get("chipsVisible"),
                zone_id or "?",
            )
            if pre_click_guard is not None:
                guard_result = await pre_click_guard()
                if isinstance(guard_result, tuple):
                    allowed, reason = guard_result
                else:
                    allowed, reason = bool(guard_result), "pre-click guard rejected"
                if not allowed:
                    raise PreClickGuardRejected(str(reason))
            if await _execute_bet_clicks(page, side, amount, click_scope=click_scope):
                logger.info(
                    "Da dat cuoc AE SEXY %s %s (%s) — cd=%s confirm=%s",
                    amount,
                    label,
                    side.value,
                    phase.get("cdText", ""),
                    "ready" if phase.get("confirmReady") else "wait",
                )
                return True
            now = time.monotonic()
            if now - last_fail_log >= 3.0:
                last_fail_log = now
                logger.warning(
                    "Cua cuoc mo (cd=%s) nhung dat cuoc that bai — thu lai",
                    phase.get("cdText", "?"),
                )
        elif i == 0:
            logger.info(
                "Cho cua cuoc mo de %s %s %s...",
                "theo doi" if virtual else "dat",
                label,
                amount,
            )
        elif i - last_log >= 25:
            last_log = i
            logger.info(
                "Cho cua cuoc... (%ds) chips=%s zone=%s cd=%s confirm=%s closed=%s",
                int(i * 0.2),
                phase.get("chipsVisible"),
                phase.get("zoneVisible"),
                phase.get("cdText", ""),
                "ready" if phase.get("confirmReady") else "disabled",
                phase.get("closed"),
            )
            # chips/zone mat lau — co the da bi day ra sanh
            if (
                not phase.get("chipsVisible")
                and not phase.get("zoneVisible")
                and i >= 40
            ):
                try:
                    from src.ae_sexy import is_ae_sexy_lobby

                    if await is_ae_sexy_lobby(page):
                        logger.warning(
                            "Huy cho cua cuoc — UI dang o sanh AE SEXY (chips/zone mat)"
                        )
                        return False
                except Exception:
                    pass
        await page.wait_for_timeout(200)
    phase = await probe_betting_phase(page)
    logger.warning(
        "Het thoi gian cho cua cuoc (%ds) — chips=%s zone=%s cd=%s",
        timeout_sec,
        phase.get("chipsVisible"),
        phase.get("zoneVisible"),
        phase.get("cdText", ""),
    )
    return False


class PreClickGuardRejected(RuntimeError):
    """The physical click was cancelled by the final execution policy check."""


class BetPlacementUncertain(RuntimeError):
    """At least one bet-zone click may have occurred, but placement is unproven."""


async def place_ae_sexy_bet(page: Page, side: BetSide, amount: int, *, click_scope=None) -> bool:
    """Dat cuoc Player/Banker/Tie trong ban AE SEXY: chip -> vung cuoc -> xac nhan."""
    if not await is_betting_open(page):
        logger.debug("Cua cuoc dong — bo qua dat cuoc %s %s", side.value, amount)
        return False
    if not await _execute_bet_clicks(page, side, amount, click_scope=click_scope):
        return False
    label = SIDE_LABEL.get(side, side.value)
    logger.info("Da dat cuoc AE SEXY %s %s (%s)", amount, label, side.value)
    return True


async def _try_clear_bet(page: Page) -> bool:
    """Thu bam nut huy/xoa chip tren ban khi dat sai so tien."""
    body = """
  const ids = ['cancel', 'btnCancel', 'clearBet', 'rebet', 'repeat'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const cls = String(el.className || '');
    if (/disabled/i.test(cls)) continue;
    try {
      el.click();
      return { ok: true, id };
    } catch (_) {}
  }
  const btn = [...document.querySelectorAll('button, div, span, a')].find((el) => {
    const t = (el.innerText || el.textContent || '').trim().toLowerCase();
    return /^(hủy|huy|cancel|clear|xóa|xoa)$/i.test(t);
  });
  if (btn) {
    try { btn.click(); return { ok: true, id: 'text' }; } catch (_) {}
  }
  return { ok: false };
"""
    info = await _eval_in_bet_ui(page, body)
    ok = bool(info and info.get("ok"))
    if ok:
        logger.warning("Da bam clear/huy cuoc sai (%s)", (info or {}).get("id"))
        await page.wait_for_timeout(400)
    return ok


async def _try_confirm_bet(page: Page, side: BetSide, chip_idx: int = 0) -> bool:
    """Bam nut Xac nhan — thu nhieu cach."""
    bet_frame = await _bet_ui_frame(page)
    if bet_frame:
        try:
            confirm = bet_frame.locator("#confirm")
            for _ in range(12):
                if await confirm.count():
                    disabled = await confirm.evaluate(
                        "el => el.classList.contains('disabled') && !el.classList.contains('enable')"
                    )
                    if not disabled:
                        try:
                            await confirm.click(timeout=5000)
                        except Exception:
                            await confirm.click(timeout=5000, force=True)
                        await page.wait_for_timeout(300)
                        return True
                await page.wait_for_timeout(250)
        except Exception as exc:
            logger.debug("playwright confirm: %s", exc)

    for _ in range(12):
        pos = await _get_bet_click_pos(page, side, chip_idx)
        if pos and pos.get("confirmPos"):
            if not pos.get("confirmDisabled"):
                if await _click_at_shell_pos(
                    page, pos["confirmPos"]["x"], pos["confirmPos"]["y"]
                ):
                    await page.wait_for_timeout(300)
                    return True
        if await _nested_click(page, "confirm"):
            await page.wait_for_timeout(300)
            return True
        await page.wait_for_timeout(250)
    return False


async def _execute_bet_clicks(
    page: Page, side: BetSide, amount: int, *, click_scope=None
) -> bool:
    """Thuc hien click chip -> zone -> xac nhan (uu tien Playwright + viewport)."""
    async def _run() -> bool:
        return await _execute_bet_clicks_inner(page, side, amount)

    if click_scope:
        async with click_scope():
            return await _run()
    return await _run()


async def _execute_bet_clicks_inner(page: Page, side: BetSide, amount: int) -> bool:
    if int(amount) <= 0:
        logger.info("Stake 0 — bo qua click chip (van theo doi)")
        return True

    tray = await _chip_tray_info(page)
    chip_count = int(tray.get("chipCount") or 5)
    raw_vals = tray.get("chipValues") or []
    dom_values = [int(v or 0) for v in raw_vals] if isinstance(raw_vals, list) else None
    chip_values = resolve_chip_values(chip_count, dom_values)

    value_plan = stake_to_value_clicks(amount, chip_values)
    if not value_plan:
        logger.error(
            "Stake %s khong dat chinh xac bang chip ban %s (dom=%s) — bo qua cuoc",
            amount,
            chip_values,
            dom_values,
        )
        return False
    chip_total = value_plan_effective_total(value_plan)
    if chip_total != int(amount):
        logger.error(
            "Plan chip lech stake (quirk 10→20): stake=%s plan=%s effective=%s — HUY",
            amount,
            value_plan,
            chip_total,
        )
        return False
    logger.info(
        "Ke hoach cuoc %s: stake=%s tray=%s plan=%s effective=%s (chip10 dau=20)",
        side.value,
        amount,
        chip_values,
        value_plan,
        chip_total,
    )

    last_chip_idx = 0
    zone_click_attempted = False
    for chip_value, clicks in value_plan:
        chip_index = await _find_chip_index_for_value(page, chip_value)
        if chip_index < 0:
            logger.warning(
                "Thieu chip menh gia %s tren khay %s — HUY cuoc",
                chip_value,
                chip_values,
            )
            if zone_click_attempted:
                raise BetPlacementUncertain(
                    f"missing chip {chip_value} after a possible zone click"
                )
            return False
        last_chip_idx = chip_index
        need_clicks = int(clicks)
        placed = False
        for attempt in range(3):
            # Luon select lai chip truoc moi lan dat (tranh giu chip cu)
            if not await _select_chip_value_js(page, chip_value):
                await _select_chip_value_mouse(page, chip_value)
            await page.wait_for_timeout(200)
            zone_click_attempted = True
            if await _playwright_click_bet(
                page,
                side,
                chip_index,
                zone_clicks=need_clicks,
                chip_value=chip_value,
            ):
                placed = True
                break
            if await _viewport_click_bet(
                page,
                side,
                chip_index,
                zone_clicks=need_clicks,
                chip_value=chip_value,
            ):
                placed = True
                break
            if await _chip_selected(page, chip_value=chip_value) or await _select_chip_value_js(
                page, chip_value
            ):
                for _click_n in range(need_clicks):
                    # Moi lan zone: chon lai chip (quirk 10)
                    if not await _select_chip_value_js(page, chip_value):
                        await _select_chip_value_mouse(page, chip_value)
                    await page.wait_for_timeout(150)
                    await _nested_click(page, "zone", chip_index, side.value)
                    await page.wait_for_timeout(350)
                if await is_bet_placed(page, side):
                    placed = True
                    break
            logger.debug(
                "Thu dat cuoc lan %d/3 — chip_value=%s idx=%s zone=%s",
                attempt + 1,
                chip_value,
                chip_index,
                side.value,
            )
            await page.wait_for_timeout(400)

        if not placed:
            detail = await _bet_placed_detail(page, side)
            logger.warning(
                "Khong dat chip %s len vung %s (idx=%s, clicks=%s) — player=%s banker=%s",
                chip_value,
                side.value,
                chip_index,
                need_clicks,
                detail.get("playerStack"),
                detail.get("bankerStack"),
            )
            raise BetPlacementUncertain(
                f"zone click for {side.value} may have occurred without confirmation"
            )
        # Khong "bu chip" / doi chieu zone amount: ban multiplayer hay doc
        # tong ban / so nguoi khac (70, 3267...) → sai stake + HUY nham.

    for attempt in range(20):
        if await is_bet_placed(page, side):
            break
        await page.wait_for_timeout(200)
    else:
        detail = await _bet_placed_detail(page, side)
        if not detail.get("ok"):
            logger.warning("Chip chua len vung cuoc %s — khong bam Xac nhan", side.value)
            raise BetPlacementUncertain(
                f"zone click for {side.value} may have occurred without visible stake"
            )

    confirmed = await _try_confirm_bet(page, side, last_chip_idx)
    if confirmed:
        return True

    detail = await _bet_placed_detail(page, side)
    if detail.get("ok"):
        phase = await probe_betting_phase(page)
        if not phase.get("confirmVisible") or phase.get("confirmDisabled"):
            logger.info(
                "Chip da len vung %s — bo qua xac nhan (confirm an/disabled)",
                side.value,
            )
            return True

    pos = await _get_bet_click_pos(page, side, last_chip_idx)
    logger.warning(
        "Khong bam duoc Xac nhan — confirmDisabled=%s chip=%s zone=%s stack=%s",
        pos.get("confirmDisabled") if pos else "?",
        pos.get("chipCount") if pos else "?",
        side.value,
        detail.get("playerStack") or detail.get("bankerStack"),
    )
    if detail.get("ok"):
        return True
    raise BetPlacementUncertain(
        f"zone click for {side.value} may have occurred without confirmation"
    )
