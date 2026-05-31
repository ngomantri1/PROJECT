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

  const CONFIRM_IDS = ['verifyBoxConfirmBtn'];
  const DIRECT_CHIP_IDS = amount => [
    `patawardopen-box-money-${amount}`,
    `chip-${amount}`,
    `chip_${amount}`
  ];

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

  function trimText(raw, max = 60) {
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

  function labelToAmount(raw) {
    const s = String(raw || '').replace(/\s+/g, '').trim().toUpperCase();
    if (!s)
      return 0;
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

  function triggerDomClick(win, el) {
    if (!el)
      return false;
    const target = el.closest ? (el.closest('button,[role=button],a,[onclick],.mouse_pointer') || el) : el;
    try {
      target.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true, cancelable: true, view: win }));
    } catch (_) {}
    try {
      target.dispatchEvent(new win.MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: win }));
    } catch (_) {}
    try {
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

  function collectFrames() {
    return Array.from(document.querySelectorAll('iframe')).map((ifr, index) => {
      const doc = safe(() => ifr.contentDocument, null);
      const win = safe(() => ifr.contentWindow, null);
      const packed = !!safe(() => doc.getElementById('playbetboxPlayer'), null);
      return {
        index,
        id: ifr.id || '',
        src: ifr.getAttribute('src') || '',
        display: safe(() => getComputedStyle(ifr).display, ''),
        visibility: safe(() => getComputedStyle(ifr).visibility, ''),
        rect: safe(() => {
          const r = ifr.getBoundingClientRect();
          return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        }, null),
        innerWidth: safe(() => win.innerWidth, -1),
        innerHeight: safe(() => win.innerHeight, -1),
        packed,
        doc,
        win,
        ifr
      };
    });
  }

  function pickBetFrame() {
    const frames = collectFrames();
    const packedVisible = frames.find(x => x.packed && x.display !== 'none' && x.rect && x.rect.w > 0 && x.rect.h > 0 && x.innerWidth > 0 && x.innerHeight > 0);
    const packedAny = frames.find(x => x.packed);
    return {
      chosen: packedVisible || packedAny || null,
      frames: frames.map(x => ({
        index: x.index,
        id: x.id,
        src: x.src,
        display: x.display,
        visibility: x.visibility,
        rect: x.rect,
        innerWidth: x.innerWidth,
        innerHeight: x.innerHeight,
        packed: x.packed
      }))
    };
  }

  function findChip(doc, amount) {
    for (const id of DIRECT_CHIP_IDS(amount)) {
      const byId = safe(() => doc.getElementById(id), null);
      if (byId)
        return byId;
    }

    const roots = [
      safe(() => doc.getElementById('chip_box'), null),
      safe(() => doc.getElementById('pataward-chip'), null)
    ].filter(Boolean);

    const amountValue = Number(amount) || 0;
    for (const root of roots) {
      const nodes = [root];
      try {
        nodes.push(...Array.from(root.querySelectorAll('*')));
      } catch (_) {}
      for (const raw of nodes) {
        const el = raw && raw.closest ? (raw.closest('button,[role=button],a,[onclick],.mouse_pointer') || raw) : raw;
        const text = getChipText(el);
        if (text && labelToAmount(text) === amountValue)
          return el;
      }
    }
    return null;
  }

  function readStakeSnapshot(doc) {
    const ids = ['myTotalBet', 'totl_bet', 'moneyBoxPlayer', 'moneyBoxBanker', 'peopleBoxPlayer', 'peopleBoxBanker'];
    return ids.reduce((acc, id) => {
      const el = safe(() => doc.getElementById(id), null);
      acc[id] = el ? trimText(el.textContent || '', 40) : '';
      return acc;
    }, {});
  }

  async function directBet(side, amount, opts = {}) {
    const normalizedSide = normalizeSide(side);
    const amountValue = Number(amount) || 0;
    const waitMs = Number(opts.waitMs) || 300;
    if (!normalizedSide)
      throw new Error('invalid-side');
    if (!(amountValue > 0))
      throw new Error('invalid-amount');

    const framePick = pickBetFrame();
    const frame = framePick.chosen;
    if (!frame || !frame.doc || !frame.win)
      throw new Error('bet-frame-not-found');

    const doc = frame.doc;
    const win = frame.win;
    const targetId = TARGET_IDS[normalizedSide];
    const target = safe(() => doc.getElementById(targetId), null);
    const confirm = CONFIRM_IDS.map(id => safe(() => doc.getElementById(id), null)).find(Boolean) || null;
    const chip = findChip(doc, amountValue);

    const result = {
      href: location.href,
      side: normalizedSide,
      amount: amountValue,
      chosenFrame: {
        index: frame.index,
        id: frame.id,
        src: frame.src,
        display: frame.display,
        visibility: frame.visibility,
        rect: frame.rect,
        innerWidth: frame.innerWidth,
        innerHeight: frame.innerHeight,
        packed: frame.packed
      },
      frameCandidates: framePick.frames,
      before: readStakeSnapshot(doc),
      chip: nodeInfo(chip),
      target: nodeInfo(target),
      confirm: nodeInfo(confirm),
      steps: []
    };

    if (!chip)
      throw new Error(`chip-not-found:${amountValue}`);
    if (!target)
      throw new Error(`target-not-found:${targetId}`);
    if (!confirm && opts.confirm !== false)
      throw new Error('confirm-not-found');

    triggerDomClick(win, chip);
    result.steps.push({ stage: 'chip_click', ok: true, chip: nodeInfo(chip) });
    await sleep(waitMs);

    triggerDomClick(win, target);
    result.steps.push({ stage: 'target_click', ok: true, target: nodeInfo(target) });
    await sleep(waitMs);

    if (opts.confirm !== false) {
      triggerDomClick(win, confirm);
      result.steps.push({ stage: 'confirm_click', ok: true, confirm: nodeInfo(confirm) });
      await sleep(waitMs);
    }

    result.after = readStakeSnapshot(doc);
    return result;
  }

  window.__abx_parentDirectBet = directBet;
  console.log('[ABX] parent direct bet ready', {
    fn: "__abx_parentDirectBet('player', 10)",
    href: location.href
  });
})();

