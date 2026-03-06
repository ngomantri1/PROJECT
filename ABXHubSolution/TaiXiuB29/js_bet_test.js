(() => {
  const TAIL_BTN_TAI = 'HomeScene/MINI_GAME_18/bgTxBanChoi/btnTaiBet';
  const TAIL_BTN_XIU = 'HomeScene/MINI_GAME_18/bgTxBanChoi/btnXiuBet';

  function nSide(s) {
    s = String(s || '').toUpperCase();
    return s === 'TAI' ? 'TAI' : 'XIU';
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function p(n) {
    const a = [];
    let t = n;
    let c = 0;
    while (t && c < 64) {
      if (t.name) a.push(t.name);
      t = t.parent || t._parent || null;
      c++;
    }
    return a.reverse().join('/');
  }

  function walk(cb) {
    if (!(window.cc && cc.director && cc.director.getScene)) return;
    const sc = cc.director.getScene();
    if (!sc) return;
    const st = [sc];
    const seen = [];
    while (st.length) {
      const n = st.pop();
      if (!n || seen.indexOf(n) >= 0) continue;
      seen.push(n);
      try { cb(n); } catch (_) {}
      const k = (n.children || n._children) || [];
      for (let i = 0; i < k.length; i++) st.push(k[i]);
    }
  }

  function findTailEnd(end) {
    end = String(end || '').toLowerCase();
    let hit = null;
    walk(n => {
      if (hit) return;
      if (p(n).toLowerCase().endsWith(end)) hit = n;
    });
    return hit;
  }

  function getComp(n, T) {
    try { return n && n.getComponent ? n.getComponent(T) : null; } catch (_) { return null; }
  }

  function clickableOf(node, depth = 8) {
    let cur = node;
    let d = 0;
    while (cur && d <= depth) {
      if (getComp(cur, cc.Button) || getComp(cur, cc.Toggle) || cur._touchListener) return cur;
      cur = cur.parent || cur._parent || null;
      d++;
    }
    return node;
  }

  function findClickableInSubtree(root, maxDepth = 6) {
    if (!root) return null;
    if (getComp(root, cc.Button) || getComp(root, cc.Toggle) || root._touchListener) return root;
    const q = [{ n: root, d: 0 }];
    const seen = [];
    while (q.length) {
      const cur = q.shift();
      const n = cur.n;
      const d = cur.d;
      if (!n || seen.indexOf(n) >= 0) continue;
      seen.push(n);
      if (d > 0 && (getComp(n, cc.Button) || getComp(n, cc.Toggle) || n._touchListener)) return n;
      if (d >= maxDepth) continue;
      const kids = (n.children || n._children) || [];
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        if (k && seen.indexOf(k) < 0) q.push({ n: k, d: d + 1 });
      }
    }
    return null;
  }

  function nodeCenter(node) {
    try {
      if (!node || !window.cc || !cc.Camera || !cc.view) return null;
      const cam = cc.Camera.findCamera(node);
      if (!cam) return null;
      const wp = node.convertToWorldSpaceAR(cc.v2 ? cc.v2(0, 0) : new cc.Vec2(0, 0));
      const sp = cam.worldToScreen(wp);
      const fs = cc.view.getFrameSize();
      const vs = cc.view.getVisibleSize();
      const sx = (Number(fs && fs.width) || 1) / Math.max(1, Number(vs && vs.width) || 1);
      const sy = (Number(fs && fs.height) || 1) / Math.max(1, Number(vs && vs.height) || 1);
      const gx = (Number(sp && sp.x) || 0) * sx;
      const gy = (Number(sp && sp.y) || 0) * sy;
      const cvs = document.querySelector('canvas');
      if (cvs && typeof cvs.getBoundingClientRect === 'function') {
        const rect = cvs.getBoundingClientRect();
        const fw = Math.max(1, Number(fs && fs.width) || rect.width || 1);
        const fh = Math.max(1, Number(fs && fs.height) || rect.height || 1);
        return {
          x: rect.left + (gx / fw) * Math.max(1, rect.width || 1),
          y: rect.top + ((fh - gy) / fh) * Math.max(1, rect.height || 1)
        };
      }
      return { x: gx, y: gy };
    } catch (_) {
      return null;
    }
  }

  function clickAtPoint(x, y) {
    try {
      x = Number(x);
      y = Number(y);
      if (!isFinite(x) || !isFinite(y)) return false;
      const el = document.elementFromPoint(x, y) || document.querySelector('canvas') || document.body;
      if (!el) return false;
      const common = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (let i = 0; i < events.length; i++) {
        try {
          el.dispatchEvent(new MouseEvent(events[i], common));
        } catch (_) {}
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function emitClickDeep(node) {
    if (!node) return { ok: false, fired: [] };
    const fired = [];
    function mark(x) { fired.push(x); }

    const b = getComp(node, cc.Button);
    if (b && b.interactable !== false) {
      try {
        const ce = b.clickEvents || [];
        if (ce.length) {
          cc.Component.EventHandler.emitEvents(ce, new cc.Event.EventCustom('click', true));
          mark('btn.clickEvents');
        }
      } catch (_) {}
      try {
        if (typeof b._onTouchBegan === 'function' || typeof b._onTouchEnded === 'function') {
          const c = nodeCenter(node) || { x: 0, y: 0 };
          const evt = {
            type: 'touch',
            target: node,
            currentTarget: node,
            getLocation: () => (cc.v2 ? cc.v2(c.x, c.y) : { x: c.x, y: c.y }),
            getLocationX: () => c.x,
            getLocationY: () => c.y,
            stopPropagation: () => {},
            preventDefault: () => {}
          };
          if (typeof b._onTouchBegan === 'function') b._onTouchBegan(evt);
          if (typeof b._onTouchEnded === 'function') b._onTouchEnded(evt);
          mark('btn._onTouch*');
        }
      } catch (_) {}
    }

    const t = getComp(node, cc.Toggle);
    if (t && t.interactable !== false) {
      try {
        t.isChecked = true;
        if (t._emitToggleEvents) t._emitToggleEvents();
        mark('toggle');
      } catch (_) {}
    }

    try {
      if (node.emit) {
        node.emit('touchstart');
        node.emit('touchend');
        node.emit('click');
        node.emit('toggle');
        mark('node.emit');
      }
    } catch (_) {}

    try {
      const c = nodeCenter(node);
      if (c && clickAtPoint(c.x, c.y)) mark('canvas.click');
    } catch (_) {}

    return { ok: fired.length > 0, fired };
  }

  function readMark(tag) {
    try {
      if (typeof window.__tx_dbg_mark === 'function') {
        const m = window.__tx_dbg_mark(tag || 'mark') || {};
        m._ts = Date.now();
        return m;
      }
    } catch (_) {}
    return { tag: tag || 'mark', _ts: Date.now() };
  }

  function parseMoney(v) {
    const s = String(v == null ? '' : v);
    const digits = s.replace(/[^\d]/g, '');
    if (!digits) return 0;
    const n = Number(digits);
    return isFinite(n) ? n : 0;
  }

  function moneyDelta(before, after) {
    const bTai = parseMoney(before && before.moneyOnTai);
    const bXiu = parseMoney(before && before.moneyOnXiu);
    const aTai = parseMoney(after && after.moneyOnTai);
    const aXiu = parseMoney(after && after.moneyOnXiu);
    return {
      beforeTai: bTai,
      beforeXiu: bXiu,
      afterTai: aTai,
      afterXiu: aXiu,
      deltaTai: aTai - bTai,
      deltaXiu: aXiu - bXiu
    };
  }

  function inferSideFromMark(m) {
    if (!m) return '';
    if (m.disableTai === false && m.disableXiu === true) return 'TAI';
    if (m.disableTai === true && m.disableXiu === false) return 'XIU';
    if (!!m.lightTai && !m.lightXiu) return 'TAI';
    if (!m.lightTai && !!m.lightXiu) return 'XIU';
    return '';
  }

  function sideTail(side) {
    return nSide(side) === 'TAI' ? TAIL_BTN_TAI : TAIL_BTN_XIU;
  }

  function sideBtnMeta(side) {
    side = nSide(side);
    const tail = sideTail(side);
    const node = findTailEnd(tail);
    if (!node) return { side, ok: false, reason: 'not_found', tail };
    const clickNode = findClickableInSubtree(node, 6) || clickableOf(node, 12) || node;
    const b = getComp(clickNode, cc.Button);
    const ce = [];
    try {
      const arr = (b && b.clickEvents) || [];
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i] || {};
        const t = e.target || null;
        ce.push({
          idx: i,
          handler: String(e.handler || ''),
          customEventData: String(e.customEventData || ''),
          component: String(e.component || ''),
          targetPath: p(t)
        });
      }
    } catch (_) {}
    return {
      side,
      ok: true,
      tailNode: p(node),
      tailClick: p(clickNode),
      activeNode: !!(node && node.activeInHierarchy),
      activeClick: !!(clickNode && clickNode.activeInHierarchy),
      interactable: !!(b && b.interactable !== false),
      clickEvents: ce
    };
  }

  async function clickSideRaw(side) {
    side = nSide(side);
    const tail = sideTail(side);
    const n = findTailEnd(tail);
    if (!n) return { ok: false, reason: 'side_btn_not_found', side, tail };
    const clickNode = findClickableInSubtree(n, 6) || n;
    const before = readMark('before_click_' + side);
    const clickRes = emitClickDeep(clickNode);
    await sleep(150);
    const after = readMark('after_click_' + side);
    return {
      ok: !!clickRes.ok,
      side,
      tailNode: p(n),
      tailClick: p(clickNode),
      clickRes,
      guessedBefore: inferSideFromMark(before),
      guessedAfter: inferSideFromMark(after),
      before,
      after
    };
  }

  async function clickSideBtn(side) {
    side = nSide(side);
    const dbgFn = window.__tx_dbg_click_side;
    if (typeof dbgFn === 'function' && !dbgFn.__tx_fallback) {
      const dbg = await dbgFn(side);
      return {
        ok: !!(dbg && dbg.sideRes && dbg.sideRes.ok),
        side,
        via: '__tx_dbg_click_side',
        dbg
      };
    }
    return clickSideRaw(side);
  }

  async function ensureSide(side, retries = 3) {
    side = nSide(side);
    const opposite = side === 'TAI' ? 'XIU' : 'TAI';
    const attempts = [];
    for (let i = 0; i < retries; i++) {
      const flip = await clickSideBtn(opposite);
      await sleep(80);
      const target = await clickSideBtn(side);
      const guessed = inferSideFromMark(target && target.after);
      const accepted = guessed === side;
      attempts.push({
        attempt: i + 1,
        opposite: flip,
        target,
        guessed,
        accepted
      });
      if (accepted) {
        return {
          ok: true,
          side,
          attempts
        };
      }
      await sleep(120);
    }
    return {
      ok: false,
      side,
      attempts,
      finalMark: readMark('after_ensure_' + side)
    };
  }

  function classifyOutcome(side, delta) {
    const expected = side === 'TAI' ? delta.deltaTai : delta.deltaXiu;
    const opposite = side === 'TAI' ? delta.deltaXiu : delta.deltaTai;
    if (expected > 0 && opposite <= 0) return 'expected_side_changed';
    if (expected <= 0 && opposite > 0) return 'opposite_side_changed';
    if (expected <= 0 && opposite <= 0) return 'no_change';
    return 'both_changed';
  }

  window.__tx_test_probe_buttons = () => ({
    tai: sideBtnMeta('TAI'),
    xiu: sideBtnMeta('XIU'),
    at: Date.now()
  });
  window.__tx_test_click_side = async (side) => clickSideRaw(side);
  if (typeof window.__tx_dbg_click_side !== 'function') {
    const fallbackDbg = async (side) => window.__tx_test_click_side(side);
    fallbackDbg.__tx_fallback = true;
    window.__tx_dbg_click_side = fallbackDbg;
  }

  window.__tx_test_bet = async (side, amount = 1000) => {
    side = nSide(side);
    amount = Math.max(0, Math.floor(Number(amount) || 0));
    if (typeof window.__tx_dbg_prepare_only !== 'function' || typeof window.__tx_dbg_confirm_script !== 'function') {
      return { ok: false, reason: 'dbg_funcs_not_found' };
    }

    const out = {
      ok: false,
      side,
      amount,
      startedAt: Date.now(),
      steps: {}
    };

    out.steps.beforeAll = readMark('before_all');
    out.steps.buttonProbe = window.__tx_test_probe_buttons();

    out.steps.prepare = await window.__tx_dbg_prepare_only(side, amount);
    out.steps.afterPrepare = readMark('after_prepare_external');

    out.steps.ensureSide = await ensureSide(side, 3);

    out.steps.confirm = await window.__tx_dbg_confirm_script();
    await sleep(260);
    out.steps.afterConfirm = readMark('after_confirm_external');

    out.delta = moneyDelta(out.steps.beforeAll, out.steps.afterConfirm);
    out.outcome = classifyOutcome(side, out.delta);
    out.ok = !!(out.steps.prepare && out.steps.prepare.setRes && out.steps.prepare.setRes.ok &&
                out.steps.confirm && out.steps.confirm.confirmOk &&
                out.outcome === 'expected_side_changed');

    try {
      out.lastAccept = (typeof window.__tx_dbg_get_last_accept === 'function')
        ? window.__tx_dbg_get_last_accept()
        : null;
    } catch (_) {
      out.lastAccept = null;
    }

    out.finishedAt = Date.now();
    out.elapsedMs = out.finishedAt - out.startedAt;
    window.__tx_test_last = out;

    console.log('[tx-test] side=%s amount=%s outcome=%s dTai=%s dXiu=%s ok=%s',
      side, amount, out.outcome, out.delta.deltaTai, out.delta.deltaXiu, out.ok);
    console.log('[tx-test] detail:', out);

    return out;
  };

  window.__tx_testBetTai1000 = () => window.__tx_test_bet('TAI', 1000);
  window.__tx_testBetXiu1000 = () => window.__tx_test_bet('XIU', 1000);

  console.log('[tx-test] ready: await __tx_testBetTai1000(); await __tx_testBetXiu1000();');
  console.log('[tx-test] probe: __tx_test_probe_buttons(); last: __tx_test_last');
})();
