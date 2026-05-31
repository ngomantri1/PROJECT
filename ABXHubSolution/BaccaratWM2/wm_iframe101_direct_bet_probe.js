(() => {
  const SIDE_IDS = {
    player: 'playbetboxPlayer',
    banker: 'playbetboxBanker',
    tie: 'playbetboxTie'
  };
  const CHIP_ROOT_SELECTORS = ['#chip_box', '#pataward-chip'];
  const CHIP_OPEN_IDS = ['openChipsBtn'];
  const CONFIRM_IDS = ['verifyBoxConfirmBtn'];
  const DEFAULT_WAIT_MS = 220;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function normalizeSide(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (s === 'p' || s === 'player')
      return 'player';
    if (s === 'b' || s === 'banker')
      return 'banker';
    if (s === 't' || s === 'tie')
      return 'tie';
    return '';
  }

  function amountToLabels(amount) {
    const n = Number(amount) || 0;
    if (!(n > 0))
      return [];
    const labels = new Set([
      String(n),
      String(n).replace(/\.0+$/, ''),
      n >= 1000 ? `${Math.round(n / 1000)}K` : '',
      n >= 1000000 ? `${Math.round(n / 1000000)}M` : ''
    ]);
    return Array.from(labels).map(x => x.trim().toUpperCase()).filter(Boolean);
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
    const suffix = m[2] || '';
    if (suffix === 'K')
      return base * 1000;
    if (suffix === 'M')
      return base * 1000000;
    return base;
  }

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

  function clickAtPoint(el) {
    if (!el || !el.getBoundingClientRect)
      return false;
    const doc = el.ownerDocument || document;
    const win = doc.defaultView || window;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0))
      return false;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    try {
      if (typeof win.PointerEvent === 'function') {
        el.dispatchEvent(new win.PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          view: win,
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 1
        }));
        el.dispatchEvent(new win.PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          view: win,
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 0
        }));
      }
    } catch (_) {}
    try {
      el.dispatchEvent(new win.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: win,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 1
      }));
      el.dispatchEvent(new win.MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: win,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 0
      }));
      el.dispatchEvent(new win.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: win,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 0
      }));
    } catch (_) {}
    try {
      if (typeof el.click === 'function')
        el.click();
    } catch (_) {}
    return true;
  }

  function getChipText(el) {
    if (!el)
      return '';
    const nodes = [el];
    try {
      nodes.push(...Array.from(el.querySelectorAll('span,div,b,strong,i,em')));
    } catch (_) {}
    for (const node of nodes) {
      const text = String((node && node.textContent) || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 12)
        continue;
      if (labelToAmount(text) > 0)
        return text;
    }
    return '';
  }

  function collectChipNodes() {
    const out = [];
    const seen = new Set();
    for (const rootSel of CHIP_ROOT_SELECTORS) {
      let root = null;
      try {
        root = document.querySelector(rootSel);
      } catch (_) {}
      if (!root)
        continue;
      const nodes = [root];
      try {
        nodes.push(...Array.from(root.querySelectorAll('*')));
      } catch (_) {}
      for (const raw of nodes) {
        const el = raw && raw.closest
          ? (raw.closest('button,[role=button],a,[onclick],.mouse_pointer,[id*="chip"],[class*="chip"]') || raw)
          : raw;
        if (!el || seen.has(el) || !root.contains(el) || !isVisible(el))
          continue;
        const text = getChipText(el);
        if (!text)
          continue;
        seen.add(el);
        out.push({
          el,
          text,
          amount: labelToAmount(text),
          id: el.id || '',
          cls: String(el.className || '')
        });
      }
    }
    return out;
  }

  function findByIds(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && isVisible(el))
        return el;
    }
    return null;
  }

  function findChip(amount) {
    const chips = collectChipNodes();
    const wanted = amountToLabels(amount);
    let exact = chips.find(x => wanted.includes(String(x.text || '').trim().toUpperCase()));
    if (!exact)
      exact = chips.find(x => x.amount === Number(amount));
    if (!exact && chips.length) {
      const target = Number(amount) || 0;
      exact = chips
        .filter(x => x.amount > 0)
        .sort((a, b) => Math.abs(a.amount - target) - Math.abs(b.amount - target))[0] || null;
    }
    return { chip: exact || null, chips };
  }

  async function ensureChipPanelOpen() {
    let chips = collectChipNodes();
    if (chips.length)
      return { opened: false, chips };
    const opener = findByIds(CHIP_OPEN_IDS);
    if (opener) {
      clickAtPoint(opener);
      await sleep(DEFAULT_WAIT_MS);
      chips = collectChipNodes();
      return { opened: true, chips, openerId: opener.id || '' };
    }
    return { opened: false, chips };
  }

  async function directPackedBet(side, amount, opts = {}) {
    const normalizedSide = normalizeSide(side);
    const amountValue = Number(amount) || 0;
    const waitMs = Number(opts.waitMs) || DEFAULT_WAIT_MS;
    const targetId = SIDE_IDS[normalizedSide] || '';
    const target = targetId ? document.getElementById(targetId) : null;
    const confirm = findByIds(CONFIRM_IDS);
    const result = {
      href: location.href,
      readyState: document.readyState,
      side: normalizedSide,
      amount: amountValue,
      targetId,
      targetFound: !!target,
      confirmId: confirm ? (confirm.id || '') : '',
      confirmFound: !!confirm,
      steps: []
    };

    if (!normalizedSide)
      throw new Error('invalid-side');
    if (!(amountValue > 0))
      throw new Error('invalid-amount');
    if (!target || !isVisible(target))
      throw new Error(`target-not-found:${targetId}`);

    const chipOpen = await ensureChipPanelOpen();
    result.steps.push({ stage: 'chip_panel', opened: !!chipOpen.opened, count: chipOpen.chips.length, openerId: chipOpen.openerId || '' });

    const chipPick = findChip(amountValue);
    result.chipCandidates = chipPick.chips.map(x => ({
      text: x.text,
      amount: x.amount,
      id: x.id,
      cls: x.cls
    }));
    if (!chipPick.chip)
      throw new Error(`chip-not-found:${amountValue}`);

    result.chipPicked = {
      text: chipPick.chip.text,
      amount: chipPick.chip.amount,
      id: chipPick.chip.id,
      cls: chipPick.chip.cls
    };

    clickAtPoint(chipPick.chip.el);
    result.steps.push({ stage: 'chip_click', ok: true, text: chipPick.chip.text, amount: chipPick.chip.amount });
    await sleep(waitMs);

    clickAtPoint(target);
    result.steps.push({ stage: 'target_click', ok: true, id: targetId });
    await sleep(waitMs);

    if (opts.confirm !== false) {
      const confirmNow = findByIds(CONFIRM_IDS);
      if (!confirmNow || !isVisible(confirmNow))
        throw new Error('confirm-not-found');
      clickAtPoint(confirmNow);
      result.steps.push({ stage: 'confirm_click', ok: true, id: confirmNow.id || '' });
      await sleep(waitMs);
    }

    return result;
  }

  window.__abx_directPackedBet = directPackedBet;
  console.log('[ABX] direct packed bet ready', {
    fn: '__abx_directPackedBet(side, amount, { confirm: true })',
    href: location.href,
    readyState: document.readyState
  });
})();

