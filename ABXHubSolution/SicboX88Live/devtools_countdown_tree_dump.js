(() => {
  if (window.__cdTreeDump && typeof window.__cdTreeDump.stop === 'function') {
    window.__cdTreeDump.stop();
  }

  const ROOT_DOC = document;
  const state = {
    overlay: null,
    panel: null,
    box: null,
    phase: 'pick_a',
    p1: null,
    p2: null,
    region: null
  };

  function ensureUi() {
    if (!state.overlay) {
      state.overlay = ROOT_DOC.createElement('div');
      state.overlay.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;cursor:crosshair;pointer-events:auto;background:transparent;';
      ROOT_DOC.body.appendChild(state.overlay);
    }
    if (!state.panel) {
      state.panel = ROOT_DOC.createElement('div');
      state.panel.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;min-width:360px;max-width:860px;padding:10px 12px;background:rgba(0,0,0,.84);color:#A8FFD5;font:12px/1.45 Consolas,Menlo,monospace;white-space:pre-wrap;border:1px solid rgba(168,255,213,.45);border-radius:8px;pointer-events:none;';
      ROOT_DOC.body.appendChild(state.panel);
    }
    if (!state.box) {
      state.box = ROOT_DOC.createElement('div');
      state.box.style.cssText = 'position:fixed;z-index:2147483647;border:2px solid #00E5FF;background:rgba(0,229,255,.10);pointer-events:none;display:none;box-sizing:border-box;';
      ROOT_DOC.body.appendChild(state.box);
    }
  }

  function setInfo(lines) {
    ensureUi();
    state.panel.textContent = lines.join('\n');
  }

  function regionFromPoints(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    return { x, y, w, h };
  }

  function paintRegion(region) {
    if (!state.box || !region) return;
    state.box.style.display = 'block';
    state.box.style.left = `${Math.round(region.x)}px`;
    state.box.style.top = `${Math.round(region.y)}px`;
    state.box.style.width = `${Math.max(4, Math.round(region.w))}px`;
    state.box.style.height = `${Math.max(4, Math.round(region.h))}px`;
  }

  function V2(x, y) {
    const T = (window.cc && (cc.v2 || cc.Vec2)) || function (xx, yy) { return { x: xx, y: yy }; };
    return new T(x, y);
  }

  function toScreenPt(node, p) {
    try {
      let cam = null;
      if (cc.Camera && cc.Camera.findCamera) cam = cc.Camera.findCamera(node);
      else if (cc.Camera && cc.Camera.main) cam = cc.Camera.main;
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
    try {
      if (cc.view && cc.view._convertPointWithScale) {
        const sp2 = cc.view._convertPointWithScale(p);
        if (sp2) return { x: sp2.x, y: sp2.y };
      }
    } catch (_) {}
    return { x: (p && p.x) || 0, y: (p && p.y) || 0 };
  }

  function rect(node) {
    try {
      const p = node.convertToWorldSpaceAR(V2(0, 0));
      const cs = node.getContentSize ? node.getContentSize() : (node._contentSize || { width: 0, height: 0 });
      const ax = node.anchorX != null ? node.anchorX : 0.5;
      const ay = node.anchorY != null ? node.anchorY : 0.5;
      const wx = p.x || 0;
      const wy = p.y || 0;
      const ww = cs.width || 0;
      const wh = cs.height || 0;
      const blx = wx - ww * ax;
      const bly = wy - wh * ay;
      const sp1 = toScreenPt(node, V2(blx, bly));
      const sp2 = toScreenPt(node, V2(blx + ww, bly + wh));
      return {
        x: Math.min(sp1.x, sp2.x),
        y: Math.min(sp1.y, sp2.y),
        w: Math.abs(sp2.x - sp1.x),
        h: Math.abs(sp2.y - sp1.y)
      };
    } catch (_) {
      return { x: 0, y: 0, w: 0, h: 0 };
    }
  }

  function intersects(a, b) {
    const ax2 = a.x + Math.max(0, a.w);
    const ay2 = a.y + Math.max(0, a.h);
    const bx2 = b.x + Math.max(0, b.w);
    const by2 = b.y + Math.max(0, b.h);
    return !(ax2 < b.x || bx2 < a.x || ay2 < b.y || by2 < a.y);
  }

  function fullPath(node, limit = 220) {
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

  function compNames(node) {
    try {
      return ((node && node._components) || []).map((c) => {
        try {
          return String((c && c.constructor && c.constructor.name) || c.name || typeof c);
        } catch (_) {
          return '?';
        }
      }).join(',');
    } catch (_) {
      return '';
    }
  }

  function readTexts(node) {
    const vals = [];
    const comps = node._components || [];
    for (const comp of comps) {
      for (const key of ['string', '_string', '_N$string', 'text', '_text']) {
        try {
          if (comp && comp[key] != null) {
            const s = String(comp[key]).trim();
            if (s && vals.indexOf(s) === -1) vals.push(s);
          }
        } catch (_) {}
      }
    }
    return vals.join('|');
  }

  function sceneRoot() {
    try {
      return window.cc && cc.director && cc.director.getScene ? cc.director.getScene() : null;
    } catch (_) {
      return null;
    }
  }

  function walkNodes(cb) {
    const scene = sceneRoot();
    if (!scene) return;
    const stack = [scene];
    const seen = new Set();
    while (stack.length) {
      const n = stack.pop();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      try { cb(n); } catch (_) {}
      const kids = n.children || n._children || [];
      for (let i = kids.length - 1; i >= 0; i -= 1) {
        if (kids[i]) stack.push(kids[i]);
      }
    }
  }

  function scoreRow(row) {
    let score = 0;
    const p = row.tail.toLowerCase();
    if (row.text) score += 20;
    if (/count|countdown|time|timer|clock|round|remain|session|bao|result/i.test(p)) score += 18;
    if (row.w >= 10 && row.w <= 160) score += 8;
    if (row.h >= 10 && row.h <= 120) score += 8;
    if (row.active) score += 4;
    if (row.opacity > 0) score += 4;
    if (/popup|history|last_result|betarea|buttons-otherinfos|chip|moneywin|currentbet/i.test(p)) score -= 40;
    if (/\/canvas\/root$|\/loading_view$|\/screen_view$|\/mask$|\/background$|\/black_bg$/i.test(p)) score -= 24;
    return score;
  }

  function dumpRegion() {
    if (!state.region) return [];
    const rows = [];
    walkNodes((node) => {
      const r = rect(node);
      if (r.w <= 0 || r.h <= 0) return;
      if (!intersects(r, state.region)) return;
      const row = {
        tail: fullPath(node, 220),
        comps: compNames(node),
        text: readTexts(node),
        active: !!node.active,
        opacity: Number(node.opacity != null ? node.opacity : -1),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.w),
        h: Math.round(r.h),
        childCount: ((node.children || node._children || []).length | 0)
      };
      row.score = scoreRow(row);
      rows.push(row);
    });
    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.tail.localeCompare(b.tail);
    });
    console.clear();
    console.table(rows.slice(0, 50).map((row, i) => ({
      '#': i,
      score: row.score,
      text: row.text,
      active: row.active,
      opacity: row.opacity,
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
      kids: row.childCount,
      comps: row.comps,
      tail: row.tail
    })));
    setInfo([
      'Countdown tree dump',
      `Region: ${Math.round(state.region.x)},${Math.round(state.region.y)},${Math.round(state.region.w)},${Math.round(state.region.h)}`,
      `Rows: ${rows.length}`,
      '',
      rows.slice(0, 10).map((row, i) => `#${i} score=${row.score} text=${row.text || '-'} kids=${row.childCount} comps=${row.comps || '-'} tail=${row.tail}`).join('\n'),
      '',
      'API:',
      '- __cdTreeDump.report()',
      '- __cdTreeDump.text(20)',
      '- __cdTreeDump.stop()'
    ]);
    return rows;
  }

  function onMove(ev) {
    if (state.phase === 'pick_a') {
      setInfo([
        'Countdown tree dump',
        `Move: ${ev.clientX}, ${ev.clientY}`,
        'Click goc tren-trai cua o countdown 07/00.',
        'Sau do click goc duoi-phai.'
      ]);
      return;
    }
    if (state.phase === 'pick_b' && state.p1) {
      const region = regionFromPoints(state.p1, { x: ev.clientX, y: ev.clientY });
      paintRegion(region);
      setInfo([
        'Countdown tree dump',
        `Preview: ${Math.round(region.x)},${Math.round(region.y)},${Math.round(region.w)},${Math.round(region.h)}`,
        'Click goc duoi-phai cua o countdown.'
      ]);
    }
  }

  function onClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (state.phase === 'pick_a') {
      state.p1 = { x: ev.clientX, y: ev.clientY };
      state.phase = 'pick_b';
      paintRegion({ x: state.p1.x, y: state.p1.y, w: 2, h: 2 });
      setInfo([
        'Countdown tree dump',
        `P1: ${state.p1.x}, ${state.p1.y}`,
        'Click goc duoi-phai cua o countdown.'
      ]);
      return;
    }
    if (state.phase === 'pick_b') {
      state.p2 = { x: ev.clientX, y: ev.clientY };
      state.region = regionFromPoints(state.p1, state.p2);
      state.phase = 'done';
      paintRegion(state.region);
      dumpRegion();
    }
  }

  function stop() {
    try { state.overlay && state.overlay.remove(); } catch (_) {}
    try { state.panel && state.panel.remove(); } catch (_) {}
    try { state.box && state.box.remove(); } catch (_) {}
    state.overlay = null;
    state.panel = null;
    state.box = null;
  }

  ensureUi();
  state.overlay.addEventListener('mousemove', onMove, true);
  state.overlay.addEventListener('click', onClick, true);
  setInfo([
    'Countdown tree dump',
    'Click goc tren-trai cua o countdown 07/00.',
    'Sau do click goc duoi-phai.'
  ]);

  window.__cdTreeDump = {
    report() {
      return dumpRegion();
    },
    text(n) {
      const rows = dumpRegion().slice(0, Number(n) || 20);
      const text = rows.map((row, i) =>
        `#${i} | score=${row.score} | text=${row.text || ''} | active=${row.active} | opacity=${row.opacity} | rect=${row.x},${row.y},${row.w},${row.h} | kids=${row.childCount} | comps=${row.comps} | tail=${row.tail}`
      ).join('\n');
      console.log(text);
      return text;
    },
    stop
  };

  console.log('[cd-tree-dump] ready');
})();
