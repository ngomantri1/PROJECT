(() => {
  const KEY = "__resultChainProbe";
  if (window[KEY] && typeof window[KEY].stop === "function") {
    window[KEY].stop();
  }

  const TAIL_LAST_RESULT_ROWS = "lastresult/results/row-";
  const ROW_ORDER = [4, 3, 2, 1];
  const COL_ORDER = [0, 1, 2, 3, 4, 5, 6];
  const V2 = ((window.cc && (cc.v2 || cc.Vec2)) || function (x, y) {
    return { x, y };
  });

  const state = {
    timer: 0,
    panel: null,
    cells: [],
    seq: "",
    seqDecoded: ""
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

  function isNodeActive(n) {
    if (!n) return false;
    if (typeof n.activeInHierarchy !== "undefined") return !!n.activeInHierarchy;
    if (typeof n._activeInHierarchy !== "undefined") return !!n._activeInHierarchy;
    if (typeof n.active !== "undefined") return !!n.active;
    return true;
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

    let p = null;
    try {
      if (node.convertToWorldSpaceAR) p = node.convertToWorldSpaceAR(new V2(0, 0));
    } catch (_) {}
    try {
      if (!p && node.getWorldPosition) p = node.getWorldPosition();
    } catch (_) {}
    p = p || { x: 0, y: 0 };

    if (!cs) {
      return { sx: p.x || 0, sy: p.y || 0, sw: 0, sh: 0 };
    }

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

  function soicauCode(name) {
    const s = String(name || "").toLowerCase();
    if (s.indexOf("ig_soicau_xiuchan") !== -1) return "0";
    if (s.indexOf("ig_soicau_xiule") !== -1) return "1";
    if (s.indexOf("ig_soicau_taichan") !== -1) return "2";
    if (s.indexOf("ig_soicau_taile") !== -1) return "3";
    return "";
  }

  function decodeCode(code) {
    if (code === "0") return "XC";
    if (code === "1") return "XL";
    if (code === "2") return "TC";
    if (code === "3") return "TL";
    return "?";
  }

  function limitSeq52(seq) {
    if (!seq) return "";
    return seq.length <= 52 ? seq : seq.slice(-52);
  }

  function collectCells() {
    const cells = [];
    walkNodes(node => {
      if (!isNodeActive(node)) return;
      const full = fullPath(node, 180);
      const fullL = norm(full);
      if (fullL.indexOf(TAIL_LAST_RESULT_ROWS) === -1) return;

      const mRow = /\/row-(\d{3})\//i.exec(full);
      const mCol = /\/ig_soicau_[^\/]*-(\d{3})(?:\/|$)/i.exec(full);
      if (!mRow || !mCol) return;

      const row = parseInt(mRow[1], 10);
      const col = parseInt(mCol[1], 10);
      if (isNaN(row) || isNaN(col)) return;

      const comps = node._components || [];
      let v = "";
      let sfName = "";
      for (let i = 0; i < comps.length; i += 1) {
        const c = comps[i];
        const sf = c && (c.spriteFrame || c._spriteFrame);
        if (!sf) continue;
        const name = sf.name || sf._name || (sf._texture && sf._texture.name) || "";
        const code = soicauCode(name);
        if (!code) continue;
        v = code;
        sfName = String(name || "");
        break;
      }
      if (!v) return;

      const r = rectFromNode(node);
      cells.push({
        row,
        col,
        v,
        decoded: decodeCode(v),
        sprite: sfName,
        x: Math.round(r.sx || 0),
        y: Math.round(r.sy || 0),
        w: Math.round(r.sw || 0),
        h: Math.round(r.sh || 0),
        tail: full
      });
    });

    state.cells = cells;
    return cells;
  }

  function buildSeq() {
    const cells = collectCells();
    if (!cells.length) {
      state.seq = "";
      state.seqDecoded = "";
      render();
      return [];
    }

    const matrix = {};
    for (let i = 0; i < cells.length; i += 1) {
      const it = cells[i];
      if (!matrix[it.row]) matrix[it.row] = {};
      matrix[it.row][it.col] = it;
    }

    const out = [];
    const outDecoded = [];
    for (let ri = 0; ri < ROW_ORDER.length; ri += 1) {
      const rr = ROW_ORDER[ri];
      for (let ci = 0; ci < COL_ORDER.length; ci += 1) {
        const cc = COL_ORDER[ci];
        const cell = matrix[rr] ? matrix[rr][cc] : null;
        if (!cell) continue;
        out.push(cell.v);
        outDecoded.push(cell.decoded);
      }
    }

    state.seq = limitSeq52(out.join(""));
    state.seqDecoded = outDecoded.join("-");
    render();
    return cells;
  }

  function ensurePanel() {
    if (state.panel) return state.panel;
    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed",
      "top:12px",
      "right:12px",
      "z-index:2147483647",
      "min-width:420px",
      "max-width:920px",
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
    const lines = [
      "Result chain probe",
      "Cells: " + state.cells.length,
      "SEQ: " + (state.seq || "--"),
      "DEC: " + (state.seqDecoded || "--"),
      "",
      "Map: 0=XC, 1=XL, 2=TC, 3=TL",
      "",
      "API:",
      "- __resultChainProbe.report()",
      "- __resultChainProbe.text()",
      "- __resultChainProbe.seq()",
      "- __resultChainProbe.stop()"
    ];
    panel.textContent = lines.join("\n");
  }

  function report() {
    buildSeq();
    console.table(state.cells.map((c, i) => ({
      "#": i,
      row: c.row,
      col: c.col,
      code: c.v,
      dec: c.decoded,
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
      sprite: c.sprite,
      tail: c.tail
    })));
    return state.cells.slice();
  }

  function text() {
    buildSeq();
    const lines = [
      "SEQ=" + (state.seq || ""),
      "DEC=" + (state.seqDecoded || "")
    ];
    for (let i = 0; i < state.cells.length; i += 1) {
      const c = state.cells[i];
      lines.push(
        "#" + i +
        " | row=" + c.row +
        " | col=" + c.col +
        " | code=" + c.v +
        " | dec=" + c.decoded +
        " | rect=" + [c.x, c.y, c.w, c.h].join(",") +
        " | sprite=" + c.sprite +
        " | tail=" + c.tail
      );
    }
    const out = lines.join("\n");
    console.log(out);
    return out;
  }

  function seq() {
    buildSeq();
    return {
      seq: state.seq,
      decoded: state.seqDecoded
    };
  }

  function start(ms) {
    const every = Math.max(600, Number(ms) || 1200);
    if (state.timer) clearInterval(state.timer);
    buildSeq();
    state.timer = setInterval(buildSeq, every);
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
    seq,
    stop
  };

  start(1200);
  console.log("[result-chain-probe] started");
})();
