(() => {
  function isVisible(el) {
    if (!el)
      return false;
    try {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0)
        return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (_) {
      return false;
    }
  }

  function trimText(raw, max = 80) {
    const s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s)
      return '';
    return s.length > max ? s.slice(0, max) + '...' : s;
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

  function summarize(el) {
    if (!el)
      return null;
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    return {
      tag: (el.tagName || '').toLowerCase(),
      id: el.id || '',
      cls: String(el.className || '').trim(),
      text: trimText(el.textContent || ''),
      visible: isVisible(el),
      rect: {
        x: Math.round(r.left || 0),
        y: Math.round(r.top || 0),
        w: Math.round(r.width || 0),
        h: Math.round(r.height || 0)
      },
      path: cssPath(el)
    };
  }

  function collect(sel, limit = 40) {
    try {
      return Array.from(document.querySelectorAll(sel)).slice(0, limit).map(summarize);
    } catch (_) {
      return [];
    }
  }

  const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
  const idHits = allIds.filter(id => /player|banker|tie|confirm|chip|bet|box|stake|coin|area/i.test(id)).slice(0, 300);
  const textHits = Array.from(document.querySelectorAll('button,div,span,a'))
    .filter(el => {
      const text = trimText(el.textContent || '', 40);
      return text && /^(player|banker|tie|xac nhan|confirm|10|20|50|100|500|1k|5k|10k)$/i.test(text);
    })
    .slice(0, 120)
    .map(summarize);

  const result = {
    href: location.href,
    readyState: document.readyState,
    title: document.title || '',
    iframeCount: document.querySelectorAll('iframe').length,
    ids: {
      targeted: idHits,
      exactPacked: {
        playbetboxPlayer: !!document.getElementById('playbetboxPlayer'),
        playbetboxBanker: !!document.getElementById('playbetboxBanker'),
        verifyBoxConfirmBtn: !!document.getElementById('verifyBoxConfirmBtn'),
        chip_box: !!document.getElementById('chip_box'),
        pataward_chip: !!document.getElementById('pataward-chip'),
        openChipsBtn: !!document.getElementById('openChipsBtn')
      }
    },
    candidates: {
      buttons: collect('button,[role=button],a[role=button],a,[onclick]'),
      betLike: collect('[id*="bet" i],[class*="bet" i],[id*="player" i],[id*="banker" i],[id*="tie" i]'),
      chipLike: collect('[id*="chip" i],[class*="chip" i]'),
      confirmLike: collect('[id*="confirm" i],[class*="confirm" i],[id*="verify" i],[class*="verify" i]'),
      textLike: textHits
    }
  };

  console.log('[ABX][iframe101 scan]', result);
  result;
})();

