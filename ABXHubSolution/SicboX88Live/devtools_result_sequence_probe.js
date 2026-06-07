(() => {
  const KEY = "__resultSeqProbe";
  if (window[KEY] && typeof window[KEY].stop === "function") {
    window[KEY].stop();
  }

  const V2 = ((window.cc && (cc.v2 || cc.Vec2)) || function (x, y) {
    return { x, y };
  });

  const state = {
    timer: 0,
    panel: null,
    cells: [],
    cluster: [],
    rows: [],
    cols: [],
    rowSeq: "",
    colSeq: "",
    decodedRows: "",
    decodedCols: ""
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

  function collectCells() {
    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;
    const cells = [];

    walkNodes(node => {
      if (!isNodeActive(node)) return;
      const comps = node._components || [];
      if (!comps.length) return;

      let code = "";
      let sfName = "";
      for (let i = 0; i < comps.length; i += 1) {
        const c = comps[i];
        const sf = c && (c.spriteFrame || c._spriteFrame);
        if (!sf) continue;
        const name = sf.name || sf._name || (sf._texture && sf._texture.name) || "";
        const hit = soicauCode(name);
        if (!hit) continue;
        code = hit;
        sfName = String(name || "");
        break;
      }
      if (!code) return;

      const rect = rectFromNode(node);
      if (!rect) return;
      if (rect.sw < 6 || rect.sh < 6) return;
      if (rect.sx < -20 || rect.sy < -20 || rect.sx > W + 20 || rect.sy > H + 20) return;

      cells.push({
        v: code,
        dec: decodeCode(code),
        sprite: sfName,
        x: Math.round(rect.sx + rect.sw / 2),
        y: Math.round(rect.sy + rect.sh / 2),
        w: Math.round(rect.sw),
        h: Math.round(rect.sh),
        tail: fullPath(node, 180)
      });
    });

    state.cells = cells;
    return cells;
  }

  function clusterCells(cells) {
    if (!cells.length) return [];
    const avgW = cells.reduce((s, c) => s + Math.max(1, c.w || 0), 0) / cells.length;
    const avgH = cells.reduce((s, c) => s + Math.max(1, c.h || 0), 0) / cells.length;
    const dxMax = Math.max(60, Math.round(avgW * 4.5));
    const dyMax = Math.max(50, Math.round(avgH * 4.5));
    const groups = [];
    const seen = new Set();

    for (let i = 0; i < cells.length; i += 1) {
      if (seen.has(i)) continue;
      const q = [i];
      seen.add(i);
      const items = [];
      while (q.length) {
        const idx = q.pop();
        const a = cells[idx];
        items.push(a);
        for (let j = 0; j < cells.length; j += 1) {
          if (seen.has(j)) continue;
          const b = cells[j];
          if (Math.abs(a.x - b.x) <= dxMax && Math.abs(a.y - b.y) <= dyMax) {
            seen.add(j);
            q.push(j);
          }
        }
      }
      groups.push(items);
    }

    groups.sort((a, b) => b.length - a.length);
    return groups;
  }

  function median(arr) {
    const b = arr.slice().sort((x, y) => x - y);
    return b[Math.floor(b.length / 2)] || 0;
  }

  function clusterRows(items) {
    if (!items.length) return [];
    const ys = [];
    for (let i = 0; i < items.length; i += 1) {
      const y = Math.round(items[i].y);
      if (ys.indexOf(y) === -1) ys.push(y);
    }
    ys.sort((a, b) => a - b);
    const diffs = [];
    for (let i = 1; i < ys.length; i += 1) diffs.push(ys[i] - ys[i - 1]);
    const spacing = diffs.length ? median(diffs) : 24;
    const thr = Math.max(8, Math.round(spacing * 0.55));

    const rows = [];
    const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 0; i < sorted.length; i += 1) {
      const it = sorted[i];
      let row = null;
      for (let j = 0; j < rows.length; j += 1) {
        if (Math.abs(rows[j].cy - it.y) <= thr) {
          row = rows[j];
          break;
        }
      }
      if (!row) {
        row = { cy: it.y, items: [] };
        rows.push(row);
      }
      row.items.push(it);
      row.cy = (row.cy * (row.items.length - 1) + it.y) / row.items.length;
    }
    rows.sort((a, b) => a.cy - b.cy);
    for (let i = 0; i < rows.length; i += 1) {
      rows[i].items.sort((a, b) => a.x - b.x);
    }
    return rows;
  }

  function clusterCols(items) {
    if (!items.length) return [];
    const xs = [];
    for (let i = 0; i < items.length; i += 1) {
      const x = Math.round(items[i].x);
      if (xs.indexOf(x) === -1) xs.push(x);
    }
    xs.sort((a, b) => a - b);
    const diffs = [];
    for (let i = 1; i < xs.length; i += 1) diffs.push(xs[i] - xs[i - 1]);
    const spacing = diffs.length ? median(diffs) : 28;
    const thr = Math.max(8, Math.round(spacing * 0.6));

    const cols = [];
    const sorted = items.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    for (let i = 0; i < sorted.length; i += 1) {
      const it = sorted[i];
      let col = null;
      for (let j = 0; j < cols.length; j += 1) {
        if (Math.abs(cols[j].cx - it.x) <= thr) {
          col = cols[j];
          break;
        }
      }
      if (!col) {
        col = { cx: it.x, items: [] };
        cols.push(col);
      }
      col.items.push(it);
      col.cx = (col.cx * (col.items.length - 1) + it.x) / col.items.length;
    }
    cols.sort((a, b) => a.cx - b.cx);
    for (let i = 0; i < cols.length; i += 1) {
      cols[i].items.sort((a, b) => a.y - b.y);
    }
    return cols;
  }

  function chooseMainCluster(groups) {
    if (!groups.length) return [];
    const W = window.innerWidth || 1;
    let best = null;
    let bestScore = -1e9;

    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i];
      if (!g.length) continue;
      const minX = Math.min.apply(null, g.map(x => x.x));
      const maxX = Math.max.apply(null, g.map(x => x.x));
      const minY = Math.min.apply(null, g.map(x => x.y));
      const maxY = Math.max.apply(null, g.map(x => x.y));
      const width = maxX - minX;
      const height = maxY - minY;
      const cx = (minX + maxX) / 2;
      const rows = clusterRows(g).length;
      const cols = clusterCols(g).length;
      let score = g.length * 20 + rows * 25 + cols * 12;
      if (rows >= 3) score += 80;
      if (cols >= 6) score += 80;
      if (cx > W * 0.52) score += 30;
      if (width > 160) score += 20;
      if (height > 60) score += 20;
      if (score > bestScore) {
        bestScore = score;
        best = g;
      }
    }
    return best || groups[0];
  }

  function buildSequence() {
    const cells = collectCells();
    const groups = clusterCells(cells);
    const cluster = chooseMainCluster(groups);
    state.cluster = cluster || [];

    if (!cluster || !cluster.length) {
      state.rows = [];
      state.cols = [];
      state.rowSeq = "";
      state.colSeq = "";
      state.decodedRows = "";
      state.decodedCols = "";
      render();
      return [];
    }

    const rows = clusterRows(cluster);
    const cols = clusterCols(cluster);
    state.rows = rows;
    state.cols = cols;

    const rowParts = [];
    const rowDecParts = [];
    for (let i = 0; i < rows.length; i += 1) {
      rowParts.push(rows[i].items.map(x => x.v).join(""));
      rowDecParts.push(rows[i].items.map(x => x.dec).join("-"));
    }

    const colParts = [];
    const colDecParts = [];
    for (let i = 0; i < cols.length; i += 1) {
      colParts.push(cols[i].items.map(x => x.v).join(""));
      colDecParts.push(cols[i].items.map(x => x.dec).join("-"));
    }

    state.rowSeq = rowParts.join(" ");
    state.colSeq = colParts.join(" ");
    state.decodedRows = rowDecParts.join(" | ");
    state.decodedCols = colDecParts.join(" | ");
    render();
    return cluster;
  }

  function ensurePanel() {
    if (state.panel) return state.panel;
    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed",
      "top:12px",
      "right:12px",
      "z-index:2147483647",
      "min-width:440px",
      "max-width:980px",
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
      "Result sequence probe",
      "All cells: " + state.cells.length,
      "Main cluster: " + state.cluster.length,
      "Rows: " + state.rows.length,
      "Cols: " + state.cols.length,
      "ROW_SEQ: " + (state.rowSeq || "--"),
      "COL_SEQ: " + (state.colSeq || "--"),
      "ROW_DEC: " + (state.decodedRows || "--"),
      "COL_DEC: " + (state.decodedCols || "--"),
      "",
      "Map: 0=XC, 1=XL, 2=TC, 3=TL",
      "",
      "API:",
      "- __resultSeqProbe.report()",
      "- __resultSeqProbe.text()",
      "- __resultSeqProbe.values()",
      "- __resultSeqProbe.stop()"
    ];
    panel.textContent = lines.join("\n");
  }

  function report() {
    buildSequence();
    console.table(state.cluster.map((c, i) => ({
      "#": i,
      code: c.v,
      dec: c.dec,
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
      sprite: c.sprite,
      tail: c.tail
    })));
    return {
      all: state.cells.slice(),
      cluster: state.cluster.slice(),
      rowSeq: state.rowSeq,
      colSeq: state.colSeq
    };
  }

  function text() {
    buildSequence();
    const lines = [
      "ROW_SEQ=" + (state.rowSeq || ""),
      "COL_SEQ=" + (state.colSeq || ""),
      "ROW_DEC=" + (state.decodedRows || ""),
      "COL_DEC=" + (state.decodedCols || "")
    ];
    for (let i = 0; i < state.cluster.length; i += 1) {
      const c = state.cluster[i];
      lines.push(
        "#" + i +
        " | code=" + c.v +
        " | dec=" + c.dec +
        " | rect=" + [c.x, c.y, c.w, c.h].join(",") +
        " | sprite=" + c.sprite +
        " | tail=" + c.tail
      );
    }
    const out = lines.join("\n");
    console.log(out);
    return out;
  }

  function values() {
    buildSequence();
    return {
      rowSeq: state.rowSeq,
      colSeq: state.colSeq,
      rowDecoded: state.decodedRows,
      colDecoded: state.decodedCols
    };
  }

  function start(ms) {
    const every = Math.max(700, Number(ms) || 1200);
    if (state.timer) clearInterval(state.timer);
    buildSequence();
    state.timer = setInterval(buildSequence, every);
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
    values,
    stop
  };

  start(1200);
  console.log("[result-seq-probe] started");
})();
