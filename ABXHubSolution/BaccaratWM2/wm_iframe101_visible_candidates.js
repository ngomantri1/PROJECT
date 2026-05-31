(() => {
  function trimText(raw, max = 80) {
    const s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s)
      return '';
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  function rectInfo(el) {
    if (!el || !el.getBoundingClientRect)
      return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left || 0),
      y: Math.round(r.top || 0),
      w: Math.round(r.width || 0),
      h: Math.round(r.height || 0),
      cx: Math.round((r.left || 0) + (r.width || 0) / 2),
      cy: Math.round((r.top || 0) + (r.height || 0) / 2)
    };
  }

  function cssPath(el) {
    if (!el || !el.tagName)
      return '';
    const parts = [];
    let cur = el;
    let guard = 0;
    while (cur && cur.nodeType === 1 && guard++ < 6) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += '#' + cur.id;
        parts.unshift(part);
        break;
      }
      const cls = String(cur.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
      if (cls.length)
        part += '.' + cls.join('.');
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function isActuallyVisible(el) {
    if (!el)
      return false;
    try {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0)
        return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (_) {
      return false;
    }
  }

  function inViewportPoint(x, y) {
    return x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
  }

  function topAtCenter(el) {
    try {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (!inViewportPoint(cx, cy))
        return null;
      const top = document.elementFromPoint(cx, cy);
      if (!top)
        return null;
      return {
        same: top === el || (el.contains && el.contains(top)) || (top.contains && top.contains(el)),
        tag: (top.tagName || '').toLowerCase(),
        id: top.id || '',
        cls: String(top.className || '').trim(),
        text: trimText(top.textContent || '', 50)
      };
    } catch (_) {
      return null;
    }
  }

  function summarize(el, kind) {
    const rect = rectInfo(el);
    const top = topAtCenter(el);
    return {
      kind,
      tag: (el.tagName || '').toLowerCase(),
      id: el.id || '',
      cls: String(el.className || '').trim(),
      text: trimText(el.textContent || '', 60),
      visible: isActuallyVisible(el),
      rect,
      inViewport: !!(rect && inViewportPoint(rect.cx, rect.cy)),
      topAtCenter: top,
      clickableLike: !!(el.closest && el.closest('button,[role=button],a,[onclick],.mouse_pointer')),
      path: cssPath(el)
    };
  }

  function collectVisible(kind, selectors, limit = 40) {
    const out = [];
    const seen = new Set();
    for (const sel of selectors) {
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(sel));
      } catch (_) {}
      for (const raw of nodes) {
        const el = raw && raw.closest
          ? (raw.closest('button,[role=button],a,[onclick],.mouse_pointer') || raw)
          : raw;
        if (!el || seen.has(el) || !isActuallyVisible(el))
          continue;
        const info = summarize(el, kind);
        if (!info.rect || !(info.rect.w > 0 && info.rect.h > 0))
          continue;
        seen.add(el);
        out.push(info);
        if (out.length >= limit)
          return out;
      }
    }
    return out;
  }

  const result = {
    href: location.href,
    readyState: document.readyState,
    viewport: {
      w: window.innerWidth,
      h: window.innerHeight
    },
    player: collectVisible('player', [
      '#playbetboxPlayer',
      '#Player',
      '[id*="player" i]',
      '[class*="player" i]',
      '[data-bet*="player" i]'
    ]),
    banker: collectVisible('banker', [
      '#playbetboxBanker',
      '#Banker',
      '[id*="banker" i]',
      '[class*="banker" i]',
      '[data-bet*="banker" i]'
    ]),
    confirm: collectVisible('confirm', [
      '#verifyBoxConfirmBtn',
      '#verifyBox',
      '[id*="confirm" i]',
      '[class*="confirm" i]',
      '[id*="verify" i]',
      '[class*="verify" i]'
    ]),
    chip: collectVisible('chip', [
      '#chip_box *',
      '#chip_box',
      '#pataward-chip *',
      '#pataward-chip',
      '[id*="chip" i]',
      '[class*="chip" i]'
    ], 80)
  };

  console.log('[ABX][iframe101 visible candidates]', result);
  try {
    console.log('[ABX][iframe101 visible candidates][flat]', JSON.stringify(result, null, 2));
  } catch (_) {}
  result;
})();

