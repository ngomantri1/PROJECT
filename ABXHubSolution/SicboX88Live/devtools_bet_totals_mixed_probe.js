(() => {
  const KEY = "__betMixedProbe";
  if (window[KEY] && typeof window[KEY].stop === "function") {
    window[KEY].stop();
  }

  const V2 = ((window.cc && (cc.v2 || cc.Vec2)) || function (x, y) {
    return { x, y };
  });

  const TAIL_HINTS = [
    "tx_live_tamtam/Canvas/root/BetArea/lbl_totalbet",
    "tx_live_tamtam/Canvas/root/BetArea/lbl_currentBet",
    "tx_live_tamtam/Canvas/root/Right/ChipPanel/view/content/lbl_value"
  ];

  const state = {
    timer: 0,
    panel: null,
    rows: [],
    picks: {},
    anchors: {
      XIU: { x: 150, y: 705 },
      TAI: { x: 1022, y: 705 },
      LE: { x: 342, y: 560 },
      CHAN: { x: 853, y: 560 }
    }
  };

  function norm(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/\/+$/g, "");
  }

  function fullPath(node, limit) {
    const parts = [];
    let cur = node;
    let depth = 0;
    const max = limit || 180;
    while (cur && depth < max) {
      if (cur.name) parts.push(cur.name);
      cur = cur.parent || cur._parent || null;
      depth += 1;
    }
    return parts.reverse().join("/");
  }

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
      const node = stack.pop();
      if (!node || seen.has(node)) continue;
      seen.add(node);
      try {
        cb(node);
      } catch (_) {}
      const kids = node.children || node._children || [];
      for (let i = kids.length - 1; i >= 0; i -= 1) {
        if (kids[i]) stack.push(kids[i]);
      }
    }
  }

  function readCompText(comp) {
    if (!comp) return "";
    const keys = ["string", "_string", "_N$string", "text", "_text"];
    for (const key of keys) {
      try {
        if (comp[key] != null) {
          const s = String(comp[key]).trim();
          if (s) return s;
        }
      } catch (_) {}
    }
    return "";
  }

  function readNodeText(node) {
    if (!node) return "";
    try {
      if (window.cc && cc.Label && node.getComponent) {
        const label = node.getComponent(cc.Label);
        const txt1 = readCompText(label);
        if (txt1) return txt1;
      }
      if (window.cc && cc.RichText && node.getComponent) {
        const rich = node.getComponent(cc.RichText);
        const txt2 = readCompText(rich);
        if (txt2) return txt2;
      }
    } catch (_) {}

    const comps = node._components || [];
    for (let i = 0; i < comps.length; i += 1) {
      const txt = readCompText(comps[i]);
      if (txt) return txt;
    }
    return "";
  }

  function parseMoney(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().toUpperCase();
    if (!s) return null;
    s = s.replace(/\s+/g, "");
    let mul = 1;
    if (/K$/.test(s)) mul = 1e3;
    else if (/M$/.test(s)) mul = 1e6;
    else if (/B$/.test(s)) mul = 1e9;
    if (mul !== 1) s = s.slice(0, -1);
    s = s.replace(/,/g, "");
    const v = parseFloat(s);
    if (Number.isFinite(v)) return Math.round(v * mul);
    const digits = s.replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : null;
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
    return { x: p && p.x || 0, y: p && p.y || 0 };
  }

  function rectFromNode(node) {
    if (!node) return null;
    let cs = null;
    try {
      if (node.getContentSize) cs = node.getContentSize();
    } catch (_) {}
    if ((!cs || (!cs.width && !cs.height)) && cc.UITransform && node.getComponent) {
      try {
        const ut = node.getComponent(cc.UITransform);
        if (ut && ut.contentSize) cs = ut.contentSize;
      } catch (_) {}
    }
    if (!cs || (!cs.width && !cs.height)) return null;

    let p = null;
    try {
      if (node.convertToWorldSpaceAR) p = node.convertToWorldSpaceAR(new V2(0, 0));
    } catch (_) {}
    try {
      if (!p && node.getWorldPosition) p = node.getWorldPosition();
    } catch (_) {}
    p = p || { x: 0, y: 0 };

    const w = cs.width || 0;
    const h = cs.height || 0;
    const ax = node.anchorX != null ? node.anchorX : 0.5;
    const ay = node.anchorY != null ? node.anchorY : 0.5;
    const blx = (p.x || 0) - w * ax;
    const bly = (p.y || 0) - h * ay;
    const sp1 = toScreenPt(node, new V2(blx, bly));
    const sp2 = toScreenPt(node, new V2(blx + w, bly + h));
    return {
      sx: Math.min(sp1.x, sp2.x),
      sy: Math.min(sp1.y, sp2.y),
      sw: Math.abs(sp2.x - sp1.x),
      sh: Math.abs(sp2.y - sp1.y)
    };
  }

  function pathMatches(path) {
    const p = norm(path);
    return TAIL_HINTS.some(h => {
      const hh = norm(h);
      return p.includes(hh) || p.endsWith(hh) || hh.endsWith(p);
    });
  }

  function hintName(path) {
    const p = norm(path);
    if (p.includes("lbl_currentbet")) return "lbl_currentBet";
    if (p.includes("lbl_totalbet")) return "lbl_totalbet";
    if (p.includes("lbl_value")) return "lbl_value";
    return "?";
  }

  function collectRows() {
    const rows = [];
    walkNodes(node => {
      if (!node || node.activeInHierarchy === false) return;
      const path = fullPath(node, 180);
      if (!pathMatches(path)) return;
      const text = readNodeText(node);
      const rect = rectFromNode(node);
      rows.push({
        text,
        value: parseMoney(text),
        path,
        hint: hintName(path),
        rect,
        comps: ((node._components || []).map(c => {
          try {
            return String((c && c.constructor && c.constructor.name) || c.name || typeof c);
          } catch (_) {
            return "?";
          }
        })).join(",")
      });
    });
    state.rows = rows;
    return rows;
  }

  function scoreForSide(side, row) {
    const a = state.anchors[side];
    if (!a || !row.rect) return -9999;
    const cx = row.rect.sx + row.rect.sw / 2;
    const cy = row.rect.sy + row.rect.sh / 2;
    const dist = Math.abs(cx - a.x) + Math.abs(cy - a.y);
    let score = 0;

    if (row.value != null) score += 80;
    if (/[KMB]/i.test(row.text)) score += 20;
    if (/^\d+(\.\d+)?[KMB]?$/i.test(row.text)) score += 20;

    if (dist < 80) score += 45;
    else if (dist < 160) score += 25;
    else if (dist < 260) score += 10;
    else score -= Math.min(120, Math.round(dist / 8));

    if (row.hint === "lbl_totalbet") score += 30;
    if (row.hint === "lbl_currentBet") score -= 25;

    if (side === "TAI") {
      if (row.hint === "lbl_value") score -= 120;
      if (row.hint === "lbl_totalbet") score += 50;
      if (cy < 500) score -= 80;
    }

    if (side === "XIU") {
      if (row.hint === "lbl_totalbet") score += 40;
      if (cy < 500) score -= 60;
    }

    if (side === "LE" || side === "CHAN") {
      if (row.hint === "lbl_value") score -= 120;
    }

    if (/popup|history|chat|loading|mask|background/i.test(norm(row.path))) score -= 60;
    return score;
  }

  function pickAll() {
    collectRows();
    const sides = ["XIU", "TAI", "LE", "CHAN"];
    const picks = {};
    for (const side of sides) {
      const scored = state.rows.map(r => ({
        side,
        score: scoreForSide(side, r),
        text: r.text,
        value: r.value,
        path: r.path,
        hint: r.hint,
        rect: r.rect,
        comps: r.comps
      })).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((b.value || 0) !== (a.value || 0)) return (b.value || 0) - (a.value || 0);
        return (a.path || "").length - (b.path || "").length;
      });
      picks[side] = scored[0] || null;
    }
    state.picks = picks;
    render();
    return picks;
  }

  function ensurePanel() {
    if (state.panel) return state.panel;
    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed",
      "top:12px",
      "right:12px",
      "z-index:2147483647",
      "min-width:360px",
      "max-width:760px",
      "padding:10px 12px",
      "background:rgba(0,0,0,.86)",
      "color:#9ff7c2",
      "font:12px/1.45 Consolas,Menlo,monospace",
      "white-space:pre-wrap",
      "border:1px solid rgba(120,255,180,.45)",
      "border-radius:8px"
    ].join(";");
    document.body.appendChild(el);
    state.panel = el;
    return el;
  }

  function render() {
    const panel = ensurePanel();
    const p = state.picks || {};
    const lines = [
      "Bet totals mixed probe",
      "XIU : " + (p.XIU ? p.XIU.text : "--"),
      "TAI : " + (p.TAI ? p.TAI.text : "--"),
      "LE  : " + (p.LE ? p.LE.text : "--"),
      "CHAN: " + (p.CHAN ? p.CHAN.text : "--"),
      "",
      "API:",
      "- __betMixedProbe.report()",
      "- __betMixedProbe.text()",
      "- __betMixedProbe.rows()",
      "- __betMixedProbe.stop()"
    ];
    panel.textContent = lines.join("\n");
  }

  function report() {
    pickAll();
    const rows = [];
    ["XIU", "TAI", "LE", "CHAN"].forEach(side => {
      const r = state.picks[side];
      if (r) rows.push(r);
    });
    console.table(rows.map((r, i) => ({
      "#": i,
      side: r.side,
      score: r.score,
      text: r.text,
      value: r.value,
      hint: r.hint,
      x: r.rect ? Math.round(r.rect.sx) : null,
      y: r.rect ? Math.round(r.rect.sy) : null,
      w: r.rect ? Math.round(r.rect.sw) : null,
      h: r.rect ? Math.round(r.rect.sh) : null,
      tail: r.path
    })));
    return rows;
  }

  function text() {
    pickAll();
    const out = ["XIU", "TAI", "LE", "CHAN"].map((side, i) => {
      const r = state.picks[side];
      if (!r) return "#" + i + " side=" + side + " | <null>";
      return (
        "#" + i +
        " side=" + side +
        " | score=" + r.score +
        " | text=" + r.text +
        " | value=" + (r.value == null ? "" : r.value) +
        " | hint=" + r.hint +
        " | rect=" + (
          r.rect
            ? [Math.round(r.rect.sx), Math.round(r.rect.sy), Math.round(r.rect.sw), Math.round(r.rect.sh)].join(",")
            : ""
        ) +
        " | tail=" + r.path
      );
    }).join("\n");
    console.log(out);
    return out;
  }

  function rows() {
    collectRows();
    console.table(state.rows.map((r, i) => ({
      "#": i,
      text: r.text,
      value: r.value,
      hint: r.hint,
      x: r.rect ? Math.round(r.rect.sx) : null,
      y: r.rect ? Math.round(r.rect.sy) : null,
      w: r.rect ? Math.round(r.rect.sw) : null,
      h: r.rect ? Math.round(r.rect.sh) : null,
      tail: r.path
    })));
    return state.rows.slice();
  }

  function start(ms) {
    const every = Math.max(500, Number(ms) || 1000);
    if (state.timer) clearInterval(state.timer);
    pickAll();
    state.timer = setInterval(pickAll, every);
    return "started";
  }

  function stop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = 0;
    }
    if (state.panel) {
      try {
        state.panel.remove();
      } catch (_) {}
      state.panel = null;
    }
  }

  window[KEY] = {
    report,
    text,
    rows,
    stop
  };

  start(1000);
  console.log("[bet-mixed-probe] started");
})();
