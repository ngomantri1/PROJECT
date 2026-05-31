(() => {
  const SIDE_MAP = {
    p: 'player',
    player: 'player',
    b: 'banker',
    banker: 'banker',
    t: 'tie',
    tie: 'tie'
  };

  const TARGET_IDS = {
    player: 'playbetboxPlayer',
    banker: 'playbetboxBanker',
    tie: 'playbetboxTie'
  };

  const CONFIRM_ID = 'verifyBoxConfirmBtn';

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function normalizeSide(raw) {
    return SIDE_MAP[String(raw || '').trim().toLowerCase()] || '';
  }

  function safe(fn, fallback = null) {
    try {
      return fn();
    } catch (_) {
      return fallback;
    }
  }

  function trimText(raw, max = 40) {
    const s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s)
      return '';
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  function nodeInfo(el) {
    if (!el)
      return null;
    const r = safe(() => el.getBoundingClientRect(), null);
    return {
      tag: String((el.tagName || '')).toLowerCase(),
      id: el.id || '',
      cls: String(el.className || '').trim(),
      text: trimText(el.textContent || ''),
      rect: r ? {
        x: Math.round(r.left || 0),
        y: Math.round(r.top || 0),
        w: Math.round(r.width || 0),
        h: Math.round(r.height || 0)
      } : null
    };
  }

  function readSnapshot(doc) {
    const ids = ['myTotalBet', 'totl_bet', 'moneyBoxPlayer', 'moneyBoxBanker', 'peopleBoxPlayer', 'peopleBoxBanker'];
    return ids.reduce((acc, id) => {
      const el = safe(() => doc.getElementById(id), null);
      acc[id] = el ? trimText(el.textContent || '') : '';
      return acc;
    }, {});
  }

  function labelToAmount(raw) {
    const s = String(raw || '').replace(/\s+/g, '').trim().toUpperCase();
    const m = s.match(/^(\d+(?:[.,]\d+)?)([KM]?)$/);
    if (!m)
      return 0;
    const base = Number(String(m[1]).replace(/,/g, ''));
    if (!Number.isFinite(base))
      return 0;
    if (m[2] === 'K')
      return base * 1000;
    if (m[2] === 'M')
      return base * 1000000;
    return base;
  }

  function getChipText(el) {
    if (!el)
      return '';
    const nodes = [el];
    try {
      nodes.push(...Array.from(el.querySelectorAll('span,div,b,strong,i,em')));
    } catch (_) {}
    for (const node of nodes) {
      const text = trimText(node.textContent || '', 16);
      if (text && labelToAmount(text) > 0)
        return text;
    }
    return '';
  }

  function triggerClick(win, el) {
    if (!el)
      return false;
    const target = el.closest ? (el.closest('button,[role=button],a,[onclick],.mouse_pointer') || el) : el;
    try {
      target.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true, cancelable: true, view: win }));
      target.dispatchEvent(new win.MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: win }));
      target.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true, view: win, button: 0, buttons: 1 }));
      target.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true, cancelable: true, view: win, button: 0, buttons: 0 }));
      target.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, view: win, button: 0, buttons: 0 }));
    } catch (_) {}
    try {
      if (typeof target.click === 'function')
        target.click();
    } catch (_) {}
    return true;
  }

  function findChip(doc, amount) {
    const direct = safe(() => doc.getElementById(`patawardopen-box-money-${amount}`), null);
    if (direct)
      return direct;
    const roots = [
      safe(() => doc.getElementById('chip_box'), null),
      safe(() => doc.getElementById('pataward-chip'), null)
    ].filter(Boolean);
    for (const root of roots) {
      const nodes = [root];
      try {
        nodes.push(...Array.from(root.querySelectorAll('*')));
      } catch (_) {}
      for (const raw of nodes) {
        const el = raw && raw.closest ? (raw.closest('button,[role=button],a,[onclick],.mouse_pointer') || raw) : raw;
        if (labelToAmount(getChipText(el)) === amount)
          return el;
      }
    }
    return null;
  }

  function activateFrame(ifr) {
    const previous = {
      style: ifr.getAttribute('style'),
      display: ifr.style.display || '',
      visibility: ifr.style.visibility || '',
      position: ifr.style.position || '',
      left: ifr.style.left || '',
      top: ifr.style.top || '',
      width: ifr.style.width || '',
      height: ifr.style.height || '',
      zIndex: ifr.style.zIndex || ''
    };
    ifr.style.display = 'block';
    ifr.style.visibility = 'visible';
    ifr.style.position = 'fixed';
    ifr.style.left = '0px';
    ifr.style.top = '0px';
    ifr.style.width = '1152px';
    ifr.style.height = '732px';
    ifr.style.zIndex = '2147483647';
    return previous;
  }

  function restoreFrame(ifr, previous) {
    if (!ifr || !previous)
      return;
    if (previous.style == null)
      ifr.removeAttribute('style');
    else
      ifr.setAttribute('style', previous.style);
    ifr.style.display = previous.display;
    ifr.style.visibility = previous.visibility;
    ifr.style.position = previous.position;
    ifr.style.left = previous.left;
    ifr.style.top = previous.top;
    ifr.style.width = previous.width;
    ifr.style.height = previous.height;
    ifr.style.zIndex = previous.zIndex;
  }

  async function activate101AndBet(side, amount, opts = {}) {
    const normalizedSide = normalizeSide(side);
    const amountValue = Number(amount) || 0;
    const waitMs = Number(opts.waitMs) || 350;
    if (!normalizedSide)
      throw new Error('invalid-side');
    if (!(amountValue > 0))
      throw new Error('invalid-amount');

    const iframe101 = document.getElementById('iframe_101');
    if (!iframe101)
      throw new Error('iframe_101-not-found');

    const doc = safe(() => iframe101.contentDocument, null);
    const win = safe(() => iframe101.contentWindow, null);
    if (!doc || !win)
      throw new Error('iframe_101-doc-not-found');

    const previous = activateFrame(iframe101);
    await sleep(waitMs);

    const chip = findChip(doc, amountValue);
    const target = safe(() => doc.getElementById(TARGET_IDS[normalizedSide]), null);
    const confirm = safe(() => doc.getElementById(CONFIRM_ID), null);

    const result = {
      href: location.href,
      side: normalizedSide,
      amount: amountValue,
      before: readSnapshot(doc),
      chip: nodeInfo(chip),
      target: nodeInfo(target),
      confirm: nodeInfo(confirm),
      iframeRect: safe(() => {
        const r = iframe101.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      }, null),
      innerWidth: safe(() => win.innerWidth, -1),
      innerHeight: safe(() => win.innerHeight, -1),
      steps: []
    };

    if (!chip)
      throw new Error(`chip-not-found:${amountValue}`);
    if (!target)
      throw new Error(`target-not-found:${TARGET_IDS[normalizedSide]}`);
    if (!confirm && opts.confirm !== false)
      throw new Error('confirm-not-found');

    triggerClick(win, chip);
    result.steps.push({ stage: 'chip_click', ok: true, chip: nodeInfo(chip) });
    await sleep(waitMs);

    triggerClick(win, target);
    result.steps.push({ stage: 'target_click', ok: true, target: nodeInfo(target) });
    await sleep(waitMs);

    if (opts.confirm !== false) {
      triggerClick(win, confirm);
      result.steps.push({ stage: 'confirm_click', ok: true, confirm: nodeInfo(confirm) });
      await sleep(waitMs);
    }

    result.after = readSnapshot(doc);
    restoreFrame(iframe101, previous);
    return result;
  }

  window.__abx_activate101AndBet = activate101AndBet;
  console.log('[ABX] activate101+bet ready', {
    fn: "__abx_activate101AndBet('player', 10)",
    href: location.href
  });
})();

