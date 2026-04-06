(() => {
  function safe(fn, fallback = null) {
    try {
      return fn();
    } catch (_) {
      return fallback;
    }
  }

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
      h: Math.round(r.height || 0)
    };
  }

  function iframeInfo(ifr, index) {
    const style = safe(() => getComputedStyle(ifr), null);
    const win = safe(() => ifr.contentWindow, null);
    const doc = safe(() => ifr.contentDocument, null);
    const href = safe(() => win.location.href, '');
    const title = safe(() => doc.title, '');
    const innerWidth = safe(() => win.innerWidth, -1);
    const innerHeight = safe(() => win.innerHeight, -1);
    const docClientW = safe(() => doc.documentElement.clientWidth, -1);
    const docClientH = safe(() => doc.documentElement.clientHeight, -1);
    const ready = safe(() => doc.readyState, '');
    const packed = {
      playbetboxPlayer: !!safe(() => doc.getElementById('playbetboxPlayer'), null),
      playbetboxBanker: !!safe(() => doc.getElementById('playbetboxBanker'), null),
      verifyBoxConfirmBtn: !!safe(() => doc.getElementById('verifyBoxConfirmBtn'), null),
      chip_box: !!safe(() => doc.getElementById('chip_box'), null),
      openChipsBtn: !!safe(() => doc.getElementById('openChipsBtn'), null)
    };
    const rect = rectInfo(ifr);
    return {
      index,
      id: ifr.id || '',
      name: ifr.name || '',
      cls: String(ifr.className || '').trim(),
      src: ifr.getAttribute('src') || '',
      href,
      title: trimText(title, 60),
      readyState: ready,
      frameDisplay: style ? style.display : '',
      frameVisibility: style ? style.visibility : '',
      rect,
      frameVisible: !!(rect && rect.w > 0 && rect.h > 0 && style && style.display !== 'none' && style.visibility !== 'hidden'),
      innerWidth,
      innerHeight,
      docClientW,
      docClientH,
      docVisible: innerWidth > 0 && innerHeight > 0,
      packed
    };
  }

  const rows = Array.from(document.querySelectorAll('iframe')).map(iframeInfo);
  const result = {
    href: location.href,
    readyState: document.readyState,
    viewport: {
      w: window.innerWidth,
      h: window.innerHeight
    },
    total: rows.length,
    visibleFrames: rows.filter(x => x.frameVisible || x.docVisible),
    allFrames: rows
  };

  console.log('[ABX][parent iframe inventory]', result);
  try {
    console.log('[ABX][parent iframe inventory][flat]', JSON.stringify(result, null, 2));
  } catch (_) {}
  result;
})();

