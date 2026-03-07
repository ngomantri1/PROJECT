(function () {
  const PATCH = 'tx-result-probe-r1';

  function foldVi(s) {
    s = String(s || '');
    try {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (_) {}
    return s.replace(/\u0111/g, 'd').replace(/\u0110/g, 'D').toLowerCase();
  }

  function normSideToken(s) {
    const f = foldVi(s).replace(/[^a-z]/g, '');
    if (!f) return '';
    if (f[0] === 't') return 'TAI';
    if (f[0] === 'x') return 'XIU';
    return '';
  }

  function toTxSide(text) {
    const f = foldVi(text);
    if (!f) return '';
    if (f.indexOf('tai') !== -1 || /^t\b/.test(f) || f === 't') return 'TAI';
    if (f.indexOf('xiu') !== -1 || /^x\b/.test(f) || f === 'x') return 'XIU';
    return '';
  }

  function parseSession(text) {
    const m = String(text || '').match(/#\s*(\d{4,})/);
    return m ? Number(m[1]) : null;
  }

  function parseMatchId(text) {
    const m = String(text || '').match(/(\d{4,})/);
    return m ? Number(m[1]) : null;
  }

  function getScene() {
    try {
      if (window.cc && cc.director && cc.director.getScene) return cc.director.getScene();
    } catch (_) {}
    return null;
  }

  function active(node) {
    try {
      if (node && node.activeInHierarchy != null) return !!node.activeInHierarchy;
    } catch (_) {}
    return false;
  }

  function pathOf(node) {
    const out = [];
    let n = node;
    let guard = 0;
    while (n && guard++ < 120) {
      out.push(String(n.name || ''));
      n = n.parent || n._parent || null;
    }
    return out.reverse().join('/');
  }

  function walkNodes(cb) {
    const root = getScene();
    if (!root) return;
    const seen = [];
    const st = [root];
    while (st.length) {
      const n = st.pop();
      if (!n || seen.indexOf(n) !== -1) continue;
      seen.push(n);
      try { cb(n); } catch (_) {}
      const kids = n.children || n._children || [];
      for (let i = 0; i < kids.length; i++) st.push(kids[i]);
    }
  }

  function getNodeText(node) {
    if (!node || !window.cc) return '';
    try {
      const lb = node.getComponent && node.getComponent(cc.Label);
      if (lb && lb.string != null) return String(lb.string).trim();
    } catch (_) {}
    try {
      const rt = node.getComponent && node.getComponent(cc.RichText);
      if (rt && rt.string != null) return String(rt.string).trim();
    } catch (_) {}
    try {
      const eb = node.getComponent && node.getComponent(cc.EditBox);
      if (eb && eb.string != null) return String(eb.string).trim();
    } catch (_) {}
    return '';
  }

  function safeRect(node) {
    try {
      if (typeof window.wRect === 'function') return window.wRect(node) || null;
    } catch (_) {}
    return null;
  }

  function collectLabelsCompat() {
    if (typeof window.collectLabels === 'function') {
      try { return window.collectLabels() || []; } catch (_) {}
    }
    const out = [];
    walkNodes(function (n) {
      const text = getNodeText(n);
      if (!text) return;
      const r = safeRect(n) || {};
      out.push({
        text: text,
        tail: pathOf(n),
        x: Number(r.x) || 0,
        y: Number(r.y) || 0,
        w: Number(r.w) || 0,
        h: Number(r.h) || 0,
        active: active(n)
      });
    });
    return out;
  }

  function readMatchId() {
    const tails = [
      'HomeScene/MINI_GAME_18/bgTxBanChoi/lblMatchId',
      'HomeScene/MINI_GAME_18/lblMatchId'
    ];
    for (let i = 0; i < tails.length; i++) {
      const want = tails[i].toLowerCase();
      let found = null;
      walkNodes(function (n) {
        if (found) return;
        const p = pathOf(n).toLowerCase();
        if (p === want) found = n;
      });
      if (found) {
        const text = getNodeText(found);
        const session = parseMatchId(text);
        if (session) {
          return { session: session, text: text, tail: pathOf(found) };
        }
      }
    }
    return { session: null, text: '', tail: '' };
  }

  function parseDiceOrSum(text, path) {
    let m = String(text || '').match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
    if (m) return { d1: Number(m[1]), d2: Number(m[2]), d3: Number(m[3]), sum: Number(m[1]) + Number(m[2]) + Number(m[3]) };

    const nums = String(text || '').match(/\d+/g) || [];
    if (nums.length === 1) return { d1: null, d2: null, d3: null, sum: Number(nums[0]) };

    m = String(path || '').match(/\((\d+)\s*-\s*(\d+)\s*-\s*(\d+)\)/);
    if (m) return { d1: Number(m[1]), d2: Number(m[2]), d3: Number(m[3]), sum: Number(m[1]) + Number(m[2]) + Number(m[3]) };

    return { d1: null, d2: null, d3: null, sum: null };
  }

  function collectIconResultRows() {
    const rows = [];
    const labels = collectLabelsCompat();
    for (let i = 0; i < labels.length; i++) {
      const L = labels[i] || {};
      const tail = String(L.tail || '').replace(/\\/g, '/');
      const low = tail.toLowerCase();
      if (low.indexOf('/buttons/icon_results/') === -1) continue;
      if (!/\/lbl_sum$/i.test(low)) continue;

      const session = parseSession(L.text) || parseSession(tail);
      const sideFromPath = (function () {
        let s = '';
        try {
          const decoded = decodeURIComponent(tail);
          const m = foldVi(decoded).match(/&([^\/()]+)\(/);
          if (m && m[1]) s = normSideToken(m[1]);
        } catch (_) {}
        if (!s) {
          const f = foldVi(tail);
          if (f.indexOf('&tai(') !== -1) s = 'TAI';
          else if (f.indexOf('&xiu(') !== -1) s = 'XIU';
        }
        return s;
      })();

      const parsed = parseDiceOrSum(L.text, tail);
      const side = sideFromPath || (parsed.sum != null ? (parsed.sum > 10 ? 'TAI' : 'XIU') : '');

      rows.push({
        session: session,
        side: side,
        sum: parsed.sum,
        d1: parsed.d1,
        d2: parsed.d2,
        d3: parsed.d3,
        text: String(L.text || ''),
        tail: tail,
        x: Number(L.x) || 0,
        active: L.active !== false,
        source: 'labels'
      });
    }

    if (!rows.length) {
      walkNodes(function (n) {
        if (!active(n)) return;
        const tail = pathOf(n);
        const low = tail.toLowerCase();
        if (low.indexOf('/buttons/icon_results/') === -1) return;
        if (!/\/lbl_sum$/i.test(low)) return;

        const text = getNodeText(n);
        const session = parseSession(text) || parseSession(tail);
        const parsed = parseDiceOrSum(text, tail);
        let side = '';
        try {
          const decoded = decodeURIComponent(tail);
          const m = foldVi(decoded).match(/&([^\/()]+)\(/);
          if (m && m[1]) side = normSideToken(m[1]);
        } catch (_) {}
        if (!side && parsed.sum != null) side = parsed.sum > 10 ? 'TAI' : 'XIU';
        rows.push({
          session: session,
          side: side,
          sum: parsed.sum,
          d1: parsed.d1,
          d2: parsed.d2,
          d3: parsed.d3,
          text: text,
          tail: tail,
          x: Number((safeRect(n) || {}).x) || 0,
          active: true,
          source: 'nodes'
        });
      });
    }

    rows.sort(function (a, b) {
      const sa = a.session == null ? -Infinity : a.session;
      const sb = b.session == null ? -Infinity : b.session;
      return (sb - sa) || ((b.x || 0) - (a.x || 0));
    });
    return rows;
  }

  function collectLightResult() {
    const out = { tai: false, xiu: false };
    walkNodes(function (n) {
      const p = pathOf(n).toLowerCase();
      if (p.endsWith('/btntaibet/light_result_tai')) out.tai = active(n);
      else if (p.endsWith('/btnxiubet/light_result_xiu')) out.xiu = active(n);
    });
    return out;
  }

  function getSpriteFrameName(node) {
    if (!node || !window.cc) return '';
    try {
      const sp = node.getComponent && node.getComponent(cc.Sprite);
      const sf = sp && sp.spriteFrame;
      if (!sf) return '';
      if (sf.name) return String(sf.name);
      if (sf._name) return String(sf._name);
      if (sf.texture && sf.texture.url) return String(sf.texture.url);
    } catch (_) {}
    return '';
  }

  function parseDiceValueFromSpriteName(name) {
    name = String(name || '').toLowerCase();
    if (!name) return null;
    let m = name.match(/(?:^|[^a-z])dice[_-]?([1-6])(?:[^0-9]|$)/i);
    if (m) return Number(m[1]);
    m = name.match(/(?:^|[^a-z])mat[_-]?([1-6])(?:[^0-9]|$)/i);
    if (m) return Number(m[1]);
    m = name.match(/(?:^|[^a-z])xx[_-]?([1-6])(?:[^0-9]|$)/i);
    if (m) return Number(m[1]);
    return null;
  }

  function getComponentNames(node) {
    try {
      const arr = node && (node._components || node.__components || []);
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        const name = c && c.constructor && c.constructor.name ? String(c.constructor.name) : '';
        if (name) out.push(name);
      }
      return out;
    } catch (_) {}
    return [];
  }

  function collectBoardCandidates() {
    const out = [];
    const kw = /(mini_game_18\/bgtxbanchoi).*(xuc|dice|tong|result|ket|qua|mat|xx|tai|xiu|bat|dia)/i;
    walkNodes(function (n) {
      const p = pathOf(n);
      const low = p.toLowerCase();
      if (low.indexOf('mini_game_18/bgtxbanchoi') === -1) return;
      if (!kw.test(low)) return;

      const text = getNodeText(n);
      const sprite = getSpriteFrameName(n);
      const comps = getComponentNames(n);
      const r = safeRect(n) || {};
      out.push({
        path: p,
        name: String(n.name || ''),
        active: active(n),
        text: text,
        sprite: sprite,
        comps: comps,
        x: Number(r.x) || 0,
        y: Number(r.y) || 0,
        w: Number(r.w) || 0,
        h: Number(r.h) || 0
      });
    });

    out.sort(function (a, b) {
      const sa = a.active ? 1 : 0;
      const sb = b.active ? 1 : 0;
      return (sb - sa) || ((a.path || '').localeCompare(b.path || ''));
    });
    return out;
  }

  function findNodeByTailEnd(tailEnd) {
    const want = String(tailEnd || '').toLowerCase().replace(/\\/g, '/');
    let found = null;
    walkNodes(function (n) {
      if (found) return;
      const p = pathOf(n).toLowerCase().replace(/\\/g, '/');
      if (p.endsWith(want)) found = n;
    });
    return found;
  }

  function readDiceEndResult() {
    const tails = [
      'HomeScene/MINI_GAME_18/bgTxBanChoi/diceEnd/dice1',
      'HomeScene/MINI_GAME_18/bgTxBanChoi/diceEnd/dice2',
      'HomeScene/MINI_GAME_18/bgTxBanChoi/diceEnd/dice3'
    ];
    const rows = [];
    for (let i = 0; i < tails.length; i++) {
      const node = findNodeByTailEnd(tails[i]);
      const sprite = getSpriteFrameName(node);
      const value = parseDiceValueFromSpriteName(sprite);
      rows.push({
        tail: tails[i],
        found: !!node,
        active: !!(node && active(node)),
        sprite: sprite,
        value: value
      });
    }

    const ok = rows.every(function (x) { return x.found && x.active && x.value != null; });
    const sum = ok ? (rows[0].value + rows[1].value + rows[2].value) : null;
    const side = sum == null ? '' : (sum > 10 ? 'TAI' : 'XIU');

    return {
      ok: ok,
      source: 'diceEnd',
      dice: rows,
      sum: sum,
      side: side
    };
  }

  function buildCurrentResult() {
    const match = readMatchId();
    const rows = collectIconResultRows();
    const lights = collectLightResult();
    const diceEnd = readDiceEndResult();

    let current = null;
    if (match.session != null) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].session === match.session) {
          current = rows[i];
          break;
        }
      }
    }
    if (!current && rows.length) current = rows[0];
    if (!current && diceEnd.ok) {
      current = {
        session: match.session,
        side: diceEnd.side,
        sum: diceEnd.sum,
        d1: diceEnd.dice[0].value,
        d2: diceEnd.dice[1].value,
        d3: diceEnd.dice[2].value,
        text: '',
        tail: 'HomeScene/MINI_GAME_18/bgTxBanChoi/diceEnd',
        source: 'diceEnd'
      };
    }

    const sideFromLight = lights.tai && !lights.xiu ? 'TAI'
      : lights.xiu && !lights.tai ? 'XIU'
      : '';

    return {
      ok: !!current,
      patch: PATCH,
      match: match,
      current: current ? current : (sideFromLight ? {
        session: match.session,
        side: sideFromLight,
        sum: null,
        d1: null,
        d2: null,
        d3: null,
        text: '',
        tail: sideFromLight === 'TAI'
          ? 'HomeScene/MINI_GAME_18/bgTxBanChoi/btnTaiBet/light_result_tai'
          : 'HomeScene/MINI_GAME_18/bgTxBanChoi/btnXiuBet/light_result_xiu',
        source: 'light_result'
      } : null),
      rows: rows.slice(0, 10),
      diceEnd: diceEnd,
      lightTai: lights.tai,
      lightXiu: lights.xiu,
      ts: Date.now()
    };
  }

  window.__tx_result_probe_once = function () {
    const r = buildCurrentResult();
    window.__tx_result_probe_last = r;
    console.log('[tx-result] once:', r);
    return r;
  };

  window.__tx_result_probe_watch_stop = function () {
    if (window.__tx_result_probe_timer) {
      clearInterval(window.__tx_result_probe_timer);
      window.__tx_result_probe_timer = 0;
    }
    return 'stopped';
  };

  window.__tx_result_probe_watch = function (seconds, intervalMs) {
    seconds = Number(seconds) || 20;
    intervalMs = Number(intervalMs) || 150;
    const endAt = Date.now() + seconds * 1000;
    const logs = [];
    let lastSig = '';

    window.__tx_result_probe_watch_stop();
    window.__tx_result_probe_timer = setInterval(function () {
      const r = buildCurrentResult();
      const c = r.current || {};
      const sig = [
        r.match && r.match.session,
        c.session,
        c.side,
        c.sum,
        c.d1, c.d2, c.d3,
        r.lightTai ? 'LT' : '',
        r.lightXiu ? 'LX' : ''
      ].join('|');

      if (sig !== lastSig) {
        lastSig = sig;
      const row = {
          at: new Date().toLocaleTimeString(),
          match: r.match ? r.match.session : null,
          currentSession: c.session || null,
          side: c.side || '',
          sum: c.sum == null ? null : c.sum,
          dice: [c.d1, c.d2, c.d3],
          diceSource: c.source || '',
          text: c.text || '',
          tail: c.tail || '',
          lightTai: !!r.lightTai,
          lightXiu: !!r.lightXiu
        };
        logs.push(row);
        console.log('[tx-result][watch]', row);
      }

      if (Date.now() >= endAt) {
        window.__tx_result_probe_watch_stop();
        window.__tx_result_probe_watch_last = logs.slice();
        console.log('[tx-result] watch done:', logs);
      }
    }, intervalMs);

    return { ok: true, patch: PATCH, seconds: seconds, intervalMs: intervalMs };
  };

  window.__tx_result_probe_dump = function () {
    const r = buildCurrentResult();
    const out = {
      patch: PATCH,
      match: r.match,
      current: r.current,
      rows: r.rows,
      diceEnd: r.diceEnd,
      lightTai: r.lightTai,
      lightXiu: r.lightXiu,
      ts: r.ts
    };
    console.log('[tx-result] dump:', out);
    return out;
  };

  window.__tx_result_probe_dice = function () {
    const r = readDiceEndResult();
    console.log('[tx-result] dice:', r);
    return r;
  };

  window.__tx_result_probe_candidates = function () {
    const rows = collectBoardCandidates();
    const out = {
      patch: PATCH,
      count: rows.length,
      rows: rows.slice(0, 120)
    };
    console.log('[tx-result] candidates:', out);
    return out;
  };

  console.log('[tx-result] ready:',
    'once=__tx_result_probe_once()',
    'watch=__tx_result_probe_watch(20,150)',
    'dump=__tx_result_probe_dump()',
    'dice=__tx_result_probe_dice()',
    'candidates=__tx_result_probe_candidates()');
})();
