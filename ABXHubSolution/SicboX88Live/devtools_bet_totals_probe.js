(() => {
  if (window.__betTotalsProbe && typeof window.__betTotalsProbe.stop === 'function') {
    window.__betTotalsProbe.stop();
  }

  const state = {
    timer: 0,
    panel: null,
    boxes: {},
    intervalMs: 500,
    last: null,
    sides: ['XIU', 'TAI', 'LE', 'CHAN'],
    colors: {
      XIU: '#00d8ff',
      TAI: '#ffb020',
      LE: '#ff67c4',
      CHAN: '#7dff6a'
    }
  };

  function getScene() {
    try {
      return window.cc && cc.director && cc.director.getScene ? cc.director.getScene() : null;
    } catch (_) {
      return null;
    }
  }

  function walkNodes(cb) {
    const scene = getScene();
    if (!scene) return;
    const stack = [scene];
    const seen = new Set();
    while (stack.length) {
      const n = stack.pop();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      try { cb(n); } catch (_) {}
      const kids = n.children || n._children || [];
      for (let i = kids.length - 1; i >= 0; i--) {
        if (kids[i]) stack.push(kids[i]);
      }
    }
  }

  function fullPath(node, limit = 140) {
    const parts = [];
    let cur = node;
    let i = 0;
    while (cur && i < limit) {
      if (cur.name) parts.push(cur.name);
      cur = cur.parent || cur._parent || null;
      i += 1;
    }
    return parts.reverse().join('/');
  }

  function normPath(s) {
    return String(s || '').toLowerCase().replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  function readCompText(comp) {
    const keys = ['string', '_string', '_N$string', 'text', '_text'];
    for (const k of keys) {
      try {
        if (comp && comp[k] != null) {
          const s = String(comp[k]).trim();
          if (s) return s;
        }
      } catch (_) {}
    }
    return '';
  }

  function normalizeText(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase()
      .trim();
  }

  function isMoneyLike(s) {
    return /^[0-9][0-9.,]*(?:[KMB])?$/i.test(String(s || '').trim());
  }

  function moneyOf(raw) {
    const s0 = String(raw || '').trim().toUpperCase();
    if (!s0) return null;
    let s = s0;
    let mul = 1;
    if (/[KMB]$/.test(s)) {
      if (/K$/.test(s)) mul = 1e3;
      else if (/M$/.test(s)) mul = 1e6;
      else if (/B$/.test(s)) mul = 1e9;
      s = s.slice(0, -1);
    }
    s = s.replace(/,/g, '');
    const v = parseFloat(s);
    return Number.isFinite(v) ? Math.round(v * mul) : null;
  }

  function shouldSkipPath(pathL) {
    return /popup\/|session_history|rank_node|tip_rank_node|bet_history_node|list_player_ingame|chat|btn_useronline|userdata\/|result_node\/.*moneywin|last_result\/|btn_tip_dealer|chippanel\/|loading_view\/|screen_view\/mask/i.test(pathL);
  }

  function worldPt(node, x, y) {
    try {
      const V2 = (window.cc && (cc.v2 || cc.Vec2)) || function (a, b) { return { x: a, y: b }; };
      if (node && node.convertToWorldSpaceAR) return node.convertToWorldSpaceAR(new V2(x, y));
    } catch (_) {}
    return { x: 0, y: 0 };
  }

  function screenPt(node, p) {
    try {
      let cam = null;
      if (window.cc && cc.Camera && cc.Camera.findCamera) cam = cc.Camera.findCamera(node);
      else if (window.cc && cc.Camera && cc.Camera.main) cam = cc.Camera.main;
      if (cam && cam.worldToScreen) {
        const sp = cam.worldToScreen(p);
        const fs = cc.view && cc.view.getFrameSize ? cc.view.getFrameSize() : null;
        const vs = cc.view && cc.view.getVisibleSize ? cc.view.getVisibleSize() : null;
        if (fs && vs && vs.width && vs.height) {
          return { x: sp.x * (fs.width / vs.width), y: sp.y * (fs.height / vs.height) };
        }
        return { x: sp.x, y: sp.y };
      }
    } catch (_) {}
    return { x: p.x || 0, y: p.y || 0 };
  }

  function rectOfNode(node) {
    try {
      const size = node.getContentSize ? node.getContentSize() : (node._contentSize || { width: 0, height: 0 });
      const w = size.width || 0;
      const h = size.height || 0;
      const ax = node.anchorX != null ? node.anchorX : 0.5;
      const ay = node.anchorY != null ? node.anchorY : 0.5;
      const p = worldPt(node, 0, 0);
      const x1 = (p.x || 0) - w * ax;
      const y1 = (p.y || 0) - h * ay;
      const p1 = screenPt(node, { x: x1, y: y1 });
      const p2 = screenPt(node, { x: x1 + w, y: y1 + h });
      return {
        sx: Math.min(p1.x, p2.x),
        sy: Math.min(p1.y, p2.y),
        sw: Math.abs(p2.x - p1.x),
        sh: Math.abs(p2.y - p1.y)
      };
    } catch (_) {
      return { sx: 0, sy: 0, sw: 0, sh: 0 };
    }
  }

  function cx(r) { return r.sx + r.sw / 2; }
  function cy(r) { return r.sy + r.sh / 2; }

  function collectTexts() {
    const rows = [];
    walkNodes(node => {
      const path = fullPath(node, 140);
      const pathL = normPath(path);
      if (shouldSkipPath(pathL)) return;
      const comps = node._components || [];
      if (!comps.length) return;
      const rect = rectOfNode(node);
      if (rect.sw < 4 || rect.sh < 4) return;
      for (const comp of comps) {
        const text = readCompText(comp);
        if (!text) continue;
        rows.push({
          path,
          pathL,
          text,
          textN: normalizeText(text),
          value: isMoneyLike(text) ? moneyOf(text) : null,
          rect
        });
      }
    });
    return rows;
  }

  function findAnchors(rows) {
    const map = {};
    for (const r of rows) {
      const t = r.textN;
      if (t === 'XIU' || t === 'TAI' || t === 'LE' || t === 'CHAN') {
        if (!map[t]) map[t] = [];
        map[t].push(r);
      }
    }
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => {
        const sa = scoreAnchor(a, key);
        const sb = scoreAnchor(b, key);
        return sb - sa;
      });
      map[key] = map[key][0] || null;
    });
    return map;
  }

  function scoreAnchor(row, side) {
    let score = 0;
    const r = row.rect;
    const x = cx(r);
    const y = cy(r);
    if (side === 'XIU') {
      score -= Math.abs(x - window.innerWidth * 0.10);
      score -= Math.abs(y - window.innerHeight * 0.34) * 0.6;
    } else if (side === 'TAI') {
      score -= Math.abs(x - window.innerWidth * 0.72);
      score -= Math.abs(y - window.innerHeight * 0.34) * 0.6;
    } else if (side === 'LE') {
      score -= Math.abs(x - window.innerWidth * 0.24);
      score -= Math.abs(y - window.innerHeight * 0.50) * 0.7;
    } else if (side === 'CHAN') {
      score -= Math.abs(x - window.innerWidth * 0.57);
      score -= Math.abs(y - window.innerHeight * 0.50) * 0.7;
    }
    if (r.sw > 40) score += 10;
    return score;
  }

  function scoreMoneyNearAnchor(row, anchor, side) {
    const rx = cx(row.rect);
    const ry = cy(row.rect);
    const ax = cx(anchor.rect);
    const ay = cy(anchor.rect);
    const dx = Math.abs(rx - ax);
    const dy = ry - ay;
    let score = 0;
    score -= dx * 1.0;
    score -= Math.abs(dy - 34) * 1.2;
    if (dy >= 8 && dy <= 80) score += 100;
    else score -= 120;
    if (/[KMB]$/i.test(row.text)) score += 120;
    if (row.value != null && row.value > 0) score += 80;
    if (/^0$/.test(row.text)) score -= 120;
    if (/lbl_totalbet/i.test(row.pathL)) score += 140;
    if (/lbl_currentbet/i.test(row.pathL)) score -= 160;
    if (/lbl_value$/i.test(row.pathL)) score -= 120;
    if (/tip_dealer/i.test(row.pathL)) score -= 200;
    if (/money_total_bet/i.test(row.pathL)) score += 70;
    return score;
  }

  function findMoneyForSide(rows, anchor, side) {
    if (!anchor) return { pick: null, candidates: [] };
    const arr = rows
      .filter(r => r.value != null)
      .map(r => Object.assign({}, r, { score: scoreMoneyNearAnchor(r, anchor, side) }))
      .filter(r => r.score > -220)
      .sort((a, b) => b.score - a.score);
    return { pick: arr[0] || null, candidates: arr };
  }

  function scan() {
    const rows = collectTexts();
    const anchors = findAnchors(rows);
    const picks = {};
    const candidates = {};
    state.sides.forEach(side => {
      const found = findMoneyForSide(rows, anchors[side], side);
      picks[side] = found.pick;
      candidates[side] = found.candidates;
    });
    state.last = { rows, anchors, picks, candidates, at: Date.now() };
    return state.last;
  }

  function ensureUi() {
    if (!state.panel) {
      state.panel = document.createElement('div');
      state.panel.style.cssText = [
        'position:fixed',
        'top:12px',
        'right:12px',
        'z-index:2147483647',
        'min-width:360px',
        'max-width:620px',
        'padding:10px 12px',
        'background:rgba(0,0,0,.84)',
        'color:#9ff7c2',
        'font:12px/1.45 Consolas,Menlo,monospace',
        'white-space:pre-wrap',
        'border:1px solid rgba(120,255,180,.45)',
        'border-radius:8px',
        'box-shadow:0 8px 28px rgba(0,0,0,.35)'
      ].join(';');
      document.body.appendChild(state.panel);
    }
    state.sides.forEach(side => {
      if (state.boxes[side]) return;
      const d = document.createElement('div');
      d.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'border:2px solid ' + state.colors[side],
        'background:transparent',
        'pointer-events:none',
        'box-sizing:border-box',
        'display:none'
      ].join(';');
      state.boxes[side] = d;
      document.body.appendChild(d);
    });
  }

  function render() {
    ensureUi();
    const out = scan();
    const lines = ['Bet totals probe'];
    state.sides.forEach(side => {
      const a = out.anchors[side];
      const p = out.picks[side];
      const box = state.boxes[side];
      if (a) {
        box.style.display = 'block';
        box.style.left = Math.round(a.rect.sx - 8) + 'px';
        box.style.top = Math.round(a.rect.sy - 6) + 'px';
        box.style.width = Math.max(12, Math.round(a.rect.sw + 16)) + 'px';
        box.style.height = Math.max(12, Math.round((p ? (p.rect.sy + p.rect.sh - a.rect.sy + 8) : (a.rect.sh + 36)))) + 'px';
      } else {
        box.style.display = 'none';
      }
      if (p) {
        lines.push(side + ': ' + p.text + ' | val=' + p.value + ' | tail=' + p.path);
      } else {
        lines.push(side + ': (none)');
      }
    });
    lines.push('');
    lines.push('API:');
    lines.push('- __betTotalsProbe.report()');
    lines.push('- __betTotalsProbe.text()');
    lines.push('- __betTotalsProbe.candidates("XIU", 8)');
    lines.push('- __betTotalsProbe.stop()');
    state.panel.textContent = lines.join('\n');
  }

  function report() {
    const out = state.last || scan();
    const rows = state.sides.map(side => {
      const p = out.picks[side];
      return {
        side,
        text: p ? p.text : '',
        value: p ? p.value : null,
        x: p ? Math.round(p.rect.sx) : null,
        y: p ? Math.round(p.rect.sy) : null,
        w: p ? Math.round(p.rect.sw) : null,
        h: p ? Math.round(p.rect.sh) : null,
        tail: p ? p.path : ''
      };
    });
    console.table(rows);
    return rows;
  }

  function text() {
    const out = state.last || scan();
    const lines = state.sides.map(side => {
      const p = out.picks[side];
      return p
        ? side + ' | text=' + p.text + ' | value=' + p.value + ' | rect=' +
            [Math.round(p.rect.sx), Math.round(p.rect.sy), Math.round(p.rect.sw), Math.round(p.rect.sh)].join(',') +
            ' | tail=' + p.path
        : side + ' | (none)';
    });
    const s = lines.join('\n');
    console.log(s);
    return s;
  }

  function candidates(side, limit = 8) {
    const out = state.last || scan();
    const key = String(side || '').toUpperCase();
    const arr = (out.candidates && out.candidates[key]) ? out.candidates[key] : [];
    const rows = arr.slice(0, Math.max(1, limit)).map(r => ({
      side: key,
      score: Math.round(r.score),
      text: r.text,
      value: r.value,
      x: Math.round(r.rect.sx),
      y: Math.round(r.rect.sy),
      w: Math.round(r.rect.sw),
      h: Math.round(r.rect.sh),
      tail: r.path
    }));
    console.table(rows);
    return rows;
  }

  function stop() {
    try { clearInterval(state.timer); } catch (_) {}
    state.timer = 0;
    try { state.panel && state.panel.remove(); } catch (_) {}
    state.sides.forEach(side => {
      try { state.boxes[side] && state.boxes[side].remove(); } catch (_) {}
    });
    state.panel = null;
    state.boxes = {};
  }

  window.__betTotalsProbe = {
    scan,
    report,
    text,
    candidates,
    stop
  };

  render();
  state.timer = window.setInterval(render, state.intervalMs);
  console.log('[bet-totals-probe] started');
})();
