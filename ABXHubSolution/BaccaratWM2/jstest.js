(() => {
  const OV_ID = "__abx_rm_overlay_v16";
  const ST = (window.__abxRM16 = window.__abxRM16 || {
    last: null,
    forceFirst: null,
    colorMap: { red: "B", blue: "P" } // mặc định Banker=đỏ, Player=xanh
  });

  // ================= Overlay =================
  function ensureOv() {
    let ov = document.getElementById(OV_ID);
    if (!ov) {
      ov = document.createElement("div");
      ov.id = OV_ID;
      ov.style.cssText =
        "position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483646;pointer-events:none;font-family:Arial;";
      (document.body || document.documentElement).appendChild(ov);
    }
    return ov;
  }
  function clearOv() { const ov = document.getElementById(OV_ID); if (ov) ov.innerHTML = ""; }
  function drawBox(r, css) {
    const ov = ensureOv();
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;${css}`;
    ov.appendChild(d);
  }
  function drawLabel(x, y, text, css) {
    const ov = ensureOv();
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText = `position:fixed;left:${x}px;top:${y}px;${css}`;
    ov.appendChild(d);
  }
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  function containsPoint(r, x, y, pad = 0) {
    return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
  }

  // ================= Clipboard =================
  async function tryCopy(text) {
    try { if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (_) {}
    try {
      const host = document.body || document.documentElement;
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      host.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      host.removeChild(ta);
      return true;
    } catch (_) {}
    return false;
  }

  // ================= Color utils =================
  function parseRGB(s) {
    const t = String(s || "").trim().toLowerCase();
    if (!t || t === "none" || t === "transparent") return null;

    let m = t.match(/rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*(?:,\s*|\/\s*)([\d.]+))?\s*\)/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: (m[4] == null ? 1 : +m[4]) };

    m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let hex = m[1];
      if (hex.length === 3) hex = hex.split("").map(ch => ch + ch).join("");
      const n = parseInt(hex, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    return null;
  }

  function dist2(a, b) {
    if (!a || !b) return 1e18;
    const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
    return dr*dr + dg*dg + db*db;
  }

  function rgbSat(rgb) {
    if (!rgb) return 0;
    const mx = Math.max(rgb.r, rgb.g, rgb.b);
    const mn = Math.min(rgb.r, rgb.g, rgb.b);
    return mx - mn;
  }

  function rgbToHue(rgb) {
    if (!rgb) return null;
    let r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const d = mx - mn;
    if (d < 1e-6) return null;
    let h = 0;
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h;
  }

  function classifyRedBlue(rgb) {
    const sat = rgbSat(rgb);
    const hue = rgbToHue(rgb);
    if (hue == null || sat < 10) return { cls: null, hue, sat, why: "low-sat/hue-null" };

    if (hue <= 28 || hue >= 332) return { cls: "red", hue, sat, why: "hue-red" };
    if (hue >= 175 && hue <= 265) return { cls: "blue", hue, sat, why: "hue-blue" };

    const rb = rgb.r - rgb.b;
    if (Math.abs(rb) > 16) return { cls: (rb > 0 ? "red" : "blue"), hue, sat, why: "rb-fallback" };

    return { cls: null, hue, sat, why: "ambiguous" };
  }

  function cssEscapeSafe(s) {
    try { return (CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\w-]/g, "\\$&"); }
    catch (_) { return String(s).replace(/[^\w-]/g, "\\$&"); }
  }

  function extractUrlId(s) {
    const t = String(s || "").trim();
    const m = t.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    if (!m) return null;
    const u = m[1];
    const hash = u.indexOf("#");
    if (hash >= 0) return u.slice(hash + 1);
    return u.startsWith("#") ? u.slice(1) : null;
  }

  function normalizeToken(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function extractHexColor(s) {
    const m = String(s || "").match(/#([0-9a-f]{3}|[0-9a-f]{6})/i);
    if (!m) return null;
    return parseRGB("#" + m[1]);
  }

  function inferBPFromToken(s) {
    const raw = String(s || "");
    const m = raw.match(/bigroad[-_]?([bp])/i);
    if (m) return m[1].toUpperCase();
    const t = normalizeToken(raw);
    if (!t) return null;
    if (t.includes("banker") || t.includes("bank") || t.includes("nhacai")) return "B";
    if (t.includes("player") || t.includes("play") || t.includes("nguoichoi")) return "P";
    if (t.includes("bigroadb")) return "B";
    if (t.includes("bigroadp")) return "P";
    if (t.includes("red")) return (ST.colorMap?.red || "B");
    if (t.includes("blue")) return (ST.colorMap?.blue || "P");
    return null;
  }

  function inferColorFromToken(s) {
    const raw = String(s || "");
    const unescaped = raw.includes("%23") ? raw.replace(/%23/gi, "#") : raw;
    const hex = extractHexColor(unescaped);
    if (hex) return hex;

    const t = normalizeToken(raw);
    if (!t) return null;
    if (t.includes("red")) return { r: 220, g: 40, b: 40, a: 1 };
    if (t.includes("blue")) return { r: 40, g: 130, b: 220, a: 1 };
    return null;
  }

  function getInlineStyleProp(styleStr, prop) {
    const s = String(styleStr || "");
    const m = s.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
    return m ? m[1].trim() : "";
  }

  // lấy stroke/fill theo thứ tự: computedStyle -> attr -> inline style -> bò lên parent tới svg
  function getPaintPropDeep(el, prop, svgRoot, maxUp = 7) {
    let cur = el;
    let up = 0;
    while (cur && up <= maxUp) {
      try {
        const cs = getComputedStyle(cur);
        const v = (cs && cs[prop]) ? String(cs[prop]).trim() : "";
        if (v && v !== "none" && v !== "transparent") return v;
      } catch (_) {}

      try {
        const a = cur.getAttribute?.(prop);
        if (a && String(a).trim() && String(a).trim() !== "none") return String(a).trim();
      } catch (_) {}

      try {
        const st = cur.getAttribute?.("style") || "";
        const v2 = getInlineStyleProp(st, prop);
        if (v2 && v2 !== "none" && v2 !== "transparent") return v2;
      } catch (_) {}

      cur = cur.parentElement || cur.parentNode;
      up++;
    }
    return "";
  }

  function resolveVarDeep(varExpr, el, svgRoot, maxUp = 10) {
    const t = String(varExpr || "").trim();
    const m = t.match(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/i);
    if (!m) return null;
    const name = m[1];
    const fallback = m[2] ? m[2].trim() : "";

    let cur = el, up = 0;
    while (cur && up <= maxUp) {
      try {
        const v = getComputedStyle(cur).getPropertyValue(name).trim();
        if (v) return v;
      } catch (_) {}
      cur = cur.parentElement || cur.parentNode;
      up++;
    }
    return fallback || null;
  }

  function resolveCurrentColorDeep(el, svgRoot, maxUp = 10) {
    let cur = el, up = 0;
    while (cur && up <= maxUp) {
      try {
        const c = String(getComputedStyle(cur).color || "").trim();
        const rgb = parseRGB(c);
        if (rgb && rgb.a > 0.05) return rgb;
      } catch (_) {}
      cur = cur.parentElement || cur.parentNode;
      up++;
    }
    return null;
  }

  function resolvePaintToRGB(paintStr, el, svgRoot, depth = 0) {
    if (depth > 7) return null;
    const s0 = String(paintStr || "").trim();
    if (!s0 || s0 === "none" || s0 === "transparent") return null;

    const low = s0.toLowerCase();

    if (low === "currentcolor") return resolveCurrentColorDeep(el, svgRoot);

    if (low.startsWith("var(")) {
      const v = resolveVarDeep(s0, el, svgRoot);
      if (!v) return null;
      return resolvePaintToRGB(v, el, svgRoot, depth + 1);
    }

    if (low.startsWith("url(")) {
      const id = extractUrlId(s0);
      if (!id) return null;

      let def = null;
      try { def = svgRoot?.querySelector?.(`#${cssEscapeSafe(id)}`) || null; } catch (_) {}
      if (!def) { try { def = document.getElementById(id); } catch (_) {} }
      if (!def) return null;

      const tag = (def.tagName || "").toLowerCase();

      if (tag === "lineargradient" || tag === "radialgradient") {
        const stops = Array.from(def.querySelectorAll("stop"));
        if (!stops.length) return null;
        let best = null;
        for (const st of stops) {
          let c = parseRGB(st.getAttribute("stop-color") || "");
          if (!c) {
            try {
              const cs = getComputedStyle(st);
              c = parseRGB(cs.stopColor || cs.color || "");
            } catch (_) {}
          }
          if (!c) continue;
          const sat = rgbSat(c);
          if (!best || sat > best.sat) best = { c, sat };
        }
        return best ? best.c : null;
      }

      if (tag === "pattern") {
        const sh = def.querySelector("rect,circle,ellipse,path,polygon,polyline,use,image");
        if (!sh) return null;
        if ((sh.tagName || "").toLowerCase() === "image") {
          const href = sh.getAttribute("href") || sh.getAttribute("xlink:href") || "";
          const cImg = inferColorFromToken(href);
          if (cImg) return cImg;
        }
        const fill = getPaintPropDeep(sh, "fill", svgRoot);
        const stroke = getPaintPropDeep(sh, "stroke", svgRoot);
        return resolvePaintToRGB(stroke || fill, sh, svgRoot, depth + 1);
      }

      return null;
    }

    const c = parseRGB(s0);
    if (c) return c;

    try {
      const tmp = document.createElement("span");
      tmp.style.color = s0;
      (document.body || document.documentElement).appendChild(tmp);
      const cc = parseRGB(getComputedStyle(tmp).color);
      tmp.remove();
      return cc;
    } catch (_) {}
    return null;
  }

  function resolveUseRef(sh, svg) {
    if (!sh || (sh.tagName || "").toLowerCase() !== "use") return null;
    const href = sh.getAttribute("href") || sh.getAttribute("xlink:href") || "";
    if (!href || !href.startsWith("#")) return null;
    const id = href.slice(1);
    let ref = null;
    try { ref = svg.querySelector(`#${cssEscapeSafe(id)}`); } catch (_) {}
    if (!ref) { try { ref = document.getElementById(id); } catch (_) {} }
    return ref || null;
  }

  // ---- NEW: thử suy ra B/P từ class name (nhiều site gắn class banker/player) ----
  function inferBPByClass(td) {
    try {
      const svg = td.querySelector("svg");
      if (!svg) return null;
      const nodes = [td, svg, ...Array.from(svg.querySelectorAll("*"))];
      const lim = Math.min(260, nodes.length);
      for (let i = 0; i < lim; i++) {
        const n = nodes[i];
        const dataBp = (n.getAttribute?.("data-bp") || "").trim().toUpperCase();
        if (dataBp === "B" || dataBp === "P") return dataBp;

        const attrs = [
          n.getAttribute?.("class"),
          n.getAttribute?.("id"),
          n.getAttribute?.("data-name"),
          n.getAttribute?.("data-label"),
          n.getAttribute?.("data-result"),
          n.getAttribute?.("data-outcome"),
          n.getAttribute?.("data-type"),
          n.getAttribute?.("data-color"),
          n.getAttribute?.("aria-label"),
          n.getAttribute?.("title")
        ];

        const tag = (n.tagName || "").toLowerCase();
        if (tag === "title" || tag === "desc") attrs.push(n.textContent || "");
        if (tag === "use" || tag === "image") {
          const href = n.getAttribute?.("href") || n.getAttribute?.("xlink:href");
          if (href) attrs.push(href);
        }

        for (const v of attrs) {
          const bp = inferBPFromToken(v);
          if (bp) return bp;
        }

        if (tag === "use") {
          const ref = resolveUseRef(n, svg);
          if (ref) {
            const bp =
              inferBPFromToken(ref.getAttribute?.("class")) ||
              inferBPFromToken(ref.getAttribute?.("id")) ||
              inferBPFromToken(ref.getAttribute?.("data-name")) ||
              inferBPFromToken(ref.getAttribute?.("data-type")) ||
              inferBPFromToken(ref.getAttribute?.("data-result")) ||
              inferBPFromToken(ref.getAttribute?.("data-outcome"));
            if (bp) return bp;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  // ưu tiên marker circle/ellipse; ưu tiên sat cao; nếu không có màu -> trả null
  function pickBestPaintFromSvg(svg) {
    const nodes = Array.from(svg.querySelectorAll("circle,ellipse,use,path,rect,polygon,polyline,image"));
    if (!nodes.length) return null;

    let best = null;

    for (const node0 of nodes) {
      let node = node0;
      const ref = resolveUseRef(node0, svg);
      if (ref) node = ref;

      const tag0 = (node0.tagName || "").toLowerCase();
      const tag = (node.tagName || "").toLowerCase();

      const typeW =
        (tag0 === "circle" || tag0 === "ellipse" || tag === "circle" || tag === "ellipse") ? 1400 :
        (tag0 === "path" || tag === "path") ? 750 :
        (tag0 === "use" || tag === "use") ? 650 :
        (tag0 === "rect" || tag === "rect") ? 260 : 420;

      let area = 1;
      try {
        if (typeof node0.getBBox === "function") {
          const bb = node0.getBBox();
          if (bb && bb.width > 0.1 && bb.height > 0.1) area = bb.width * bb.height;
        } else if (typeof node0.getBoundingClientRect === "function") {
          const r = node0.getBoundingClientRect();
          if (r && r.width > 0.1 && r.height > 0.1) area = r.width * r.height;
        }
      } catch (_) {}

      const strokeStr = getPaintPropDeep(node0, "stroke", svg) || getPaintPropDeep(node, "stroke", svg);
      const fillStr   = getPaintPropDeep(node0, "fill", svg)   || getPaintPropDeep(node, "fill", svg);

      const cStroke = resolvePaintToRGB(strokeStr, node0, svg);
      const cFill   = resolvePaintToRGB(fillStr, node0, svg);

      let pick = (cStroke && cStroke.a > 0.05) ? cStroke : (cFill && cFill.a > 0.05 ? cFill : null);
      if (!pick && (tag0 === "image" || tag === "image")) {
        const href =
          node0.getAttribute?.("href") || node0.getAttribute?.("xlink:href") ||
          node.getAttribute?.("href") || node.getAttribute?.("xlink:href") || "";
        const cImg = inferColorFromToken(href);
        if (cImg) pick = cImg;
      }
      if (!pick) continue;

      const sat = rgbSat(pick);
      const lum = 0.2126 * pick.r + 0.7152 * pick.g + 0.0722 * pick.b;

      const bgLike = (sat < 8) || (lum > 248) || (lum < 6);

      // score: ưu tiên sat mạnh để tránh dính nền
      let score = typeW + sat * 30 + Math.sqrt(area);
      if (bgLike) score *= 0.12;

      const cand = { rgb: pick, stroke: strokeStr || "", fill: fillStr || "", tag: tag0, area, sat, lum, score };
      if (!best || cand.score > best.score) best = cand;
    }

    return best;
  }

  function getMainShapeColorRGB(td) {
    const svg = td.querySelector("svg");
    if (!svg) return null;
    const best = pickBestPaintFromSvg(svg);
    if (!best || !best.rgb) return null;
    return {
      rgb: best.rgb,
      stroke: best.stroke,
      fill: best.fill,
      area: best.area,
      tag: best.tag,
      sat: best.sat,
      lum: best.lum
    };
  }

  // ================= Find ref colors from UI (fallback) =================
  function findRefColorByText(textNeedle) {
    const needle = String(textNeedle).toUpperCase();
    const els = Array.from(document.querySelectorAll("button,div,span,a"));
    let best = null;

    for (let i = 0; i < Math.min(3500, els.length); i++) {
      const el = els[i];
      const t = (el.innerText || "").trim().toUpperCase();
      if (!t || !t.includes(needle)) continue;

      let c = null;
      try {
        const cs = getComputedStyle(el);
        c = parseRGB(cs.backgroundColor || "") || parseRGB(cs.color || "");
      } catch (_) {}
      if (!c || c.a <= 0.05) continue;

      const sat = rgbSat(c);
      const score = sat * 10 + c.a * 1000;
      if (!best || score > best.score) best = { rgb: c, el, score };
    }
    return best;
  }

  function getRefs() {
    const banker = findRefColorByText("NHÀ CÁI") || findRefColorByText("NHA CAI");
    const player = findRefColorByText("NGƯỜI CHƠI") || findRefColorByText("NGUOI CHOI");

    const bRef = banker?.rgb || { r: 220, g: 40, b: 40, a: 1 };
    const pRef = player?.rgb || { r: 40, g: 130, b: 220, a: 1 };

    return { bRef, pRef, bankerEl: banker?.el || null, playerEl: player?.el || null };
  }

  // ================= Table detect =================
  function findBestTableAtPoint(x, y) {
    const tables = Array.from(document.querySelectorAll("table.nM_nR, table"));
    let best = null;

    for (const t of tables) {
      const r = rectOf(t);
      if (r.w < 120 || r.h < 40) continue;
      if (!containsPoint(r, x, y, 8)) continue;

      let tdCount = 0, svgTd = 0, trCount = 0;
      try {
        trCount = Array.from(t.querySelectorAll("tr")).length;
        const tds = Array.from(t.querySelectorAll("td"));
        tdCount = tds.length;
        const lim = Math.min(900, tds.length);
        for (let i = 0; i < lim; i++) if (tds[i].querySelector("svg")) svgTd++;
      } catch (_) {}

      const rowLike = (trCount >= 5 && trCount <= 8) ? 20000 : 0;
      const isNM = t.classList && t.classList.contains("nM_nR");
      const score = (isNM ? 1_000_000 : 0) + rowLike + svgTd * 1200 + tdCount * 2 + Math.min(900, (r.w * r.h) / 400);

      if (!best || score > best.score) best = { table: t, rect: r, tdCount, svgTd, trCount, score };
    }
    return best;
  }

  // ================= Grid occupancy + tie =================
  function readCell(td) {
    const svg = td.querySelector("svg");
    if (!svg) return { has: false, tie: 0, td };

    const has = !!svg.querySelector("circle,ellipse,path,rect,polygon,polyline,use,image");
    let tie = 0;
    const txt = (svg.querySelector("text")?.textContent || "").trim();
    if (/^\d+$/.test(txt)) tie = parseInt(txt, 10);

    return { has, tie, td };
  }

  function buildGrid(table) {
    const tbody = table.querySelector("tbody");
    const trs = Array.from((tbody || table).querySelectorAll("tr"));
    const rows = trs.length;
    let cols = 0;
    const cells = [];

    for (let r = 0; r < trs.length; r++) {
      const tds = Array.from(trs[r].querySelectorAll("td"));
      cols = Math.max(cols, tds.length);
      cells[r] = [];
      for (let c = 0; c < tds.length; c++) {
        const info = readCell(tds[c]);
        cells[r][c] = { r, c, ...info };
      }
    }
    return { rows, cols, cells };
  }

  function colHasAny(grid, c) {
    for (let r = 0; r < grid.rows; r++) if (grid.cells[r]?.[c]?.has) return true;
    return false;
  }

  // ================= Groups + simulate path (không giới hạn 6) =================
  function splitGroups(grid) {
    const groups = [];
    let cur = null;

    for (let c = 0; c < grid.cols; c++) {
      if (!colHasAny(grid, c)) continue;
      const topHas = !!grid.cells[0]?.[c]?.has;

      if (topHas || !cur) {
        cur = { startCol: c, cols: [c] };
        groups.push(cur);
      } else {
        cur.cols.push(c);
      }
    }

    for (const g of groups) {
      g.colSet = new Set(g.cols);
      g.occFinal = new Set();
      g.len = 0;

      for (const c of g.cols) {
        for (let r = 0; r < grid.rows; r++) {
          if (grid.cells[r]?.[c]?.has) {
            g.len++;
            g.occFinal.add(`${r},${c}`);
          }
        }
      }

      const used = new Set();
      const path = [];

      let r = 0, c = g.startCol;
      if (!g.occFinal.has(`0,${c}`)) {
        let found = false;
        for (let rr = 0; rr < grid.rows; rr++) {
          if (g.occFinal.has(`${rr},${c}`)) { r = rr; found = true; break; }
        }
        if (!found) { g.path = []; continue; }
      }

      for (let i = 0; i < g.len; i++) {
        const key = `${r},${c}`;
        if (!g.occFinal.has(key) || used.has(key)) {
          let pick = null;
          for (const k of g.occFinal) { if (!used.has(k)) { pick = k; break; } }
          if (!pick) break;
          const [rr, cc] = pick.split(",").map(Number);
          r = rr; c = cc;
        }

        used.add(`${r},${c}`);
        const cell = grid.cells[r]?.[c];
        if (cell) path.push(cell);

        const downKey = `${r + 1},${c}`;
        if (r + 1 < grid.rows && g.occFinal.has(downKey) && !used.has(downKey)) {
          r = r + 1;
          continue;
        }

        let moved = false;
        for (let cc = c + 1; cc < grid.cols; cc++) {
          if (!g.colSet.has(cc)) continue;
          const rk = `${r},${cc}`;
          if (g.occFinal.has(rk) && !used.has(rk)) { c = cc; moved = true; break; }
        }
        if (moved) continue;

        break;
      }

      g.path = path;
    }

    return groups;
  }

  // ================= Color clustering fallback (k=2) =================
  function meanRGB(list) {
    if (!list.length) return null;
    let r = 0, g = 0, b = 0;
    for (const x of list) { r += x.r; g += x.g; b += x.b; }
    return { r: r / list.length, g: g / list.length, b: b / list.length, a: 1 };
  }

  function kmeans2(samples) {
    if (samples.length < 4) return null;

    // init: farthest pair
    const c1 = samples[0].rgb;
    let far = samples[0].rgb, farD = -1;
    for (const s of samples) {
      const d = dist2(c1, s.rgb);
      if (d > farD) { farD = d; far = s.rgb; }
    }
    let mu1 = { ...c1 }, mu2 = { ...far };

    for (let it = 0; it < 7; it++) {
      const a = [], b = [];
      for (const s of samples) {
        const d1 = dist2(s.rgb, mu1);
        const d2 = dist2(s.rgb, mu2);
        (d1 <= d2 ? a : b).push(s.rgb);
      }
      const n1 = meanRGB(a), n2 = meanRGB(b);
      if (n1) mu1 = n1;
      if (n2) mu2 = n2;
    }

    const sep = dist2(mu1, mu2);
    return { mu1, mu2, sep };
  }

  function centroidToRedBlue(mu, refs) {
    const c = classifyRedBlue(mu);
    if (c.cls) return { cls: c.cls, why: c.why, hue: c.hue, sat: c.sat };

    // fallback refs
    const dB = dist2(mu, refs.bRef);
    const dP = dist2(mu, refs.pRef);
    const gap = Math.abs(dB - dP) / Math.max(dB, dP, 1);
    if (gap > 0.06) {
      // gần banker => "red" giả định, gần player => "blue" giả định (vì colorMap sẽ map về B/P)
      return { cls: (dB <= dP ? "red" : "blue"), why: "refs-fallback", hue: c.hue, sat: c.sat };
    }

    // fallback cuối: r vs b
    const rb = mu.r - mu.b;
    if (Math.abs(rb) > 10) return { cls: (rb > 0 ? "red" : "blue"), why: "rb-last", hue: c.hue, sat: c.sat };

    return { cls: null, why: "unknown" };
  }

  function collectSamplesFromGrid(groups, grid, max = 40) {
    const samples = [];

    // ưu tiên từ group đầu tiên vài nhóm đầu
    const maxG = Math.min(groups.length, 10);
    for (let gi = 0; gi < maxG && samples.length < max; gi++) {
      for (const cell of (groups[gi].path || [])) {
        if (samples.length >= max) break;
        const td = cell.td;
        const byCls = inferBPByClass(td);
        const p = getMainShapeColorRGB(td);
        if (p?.rgb) {
          samples.push({ rgb: p.rgb, sat: p.sat || rgbSat(p.rgb), td, gi, byCls: byCls || null });
        }
      }
    }

    // nếu vẫn ít, quét trái->phải một ít
    if (samples.length < 8) {
      for (let c = 0; c < grid.cols && samples.length < max; c++) {
        for (let r = 0; r < grid.rows && samples.length < max; r++) {
          const cell = grid.cells[r]?.[c];
          if (!cell?.has) continue;
          const td = cell.td;
          const byCls = inferBPByClass(td);
          const p = getMainShapeColorRGB(td);
          if (p?.rgb) samples.push({ rgb: p.rgb, sat: p.sat || rgbSat(p.rgb), td, gi: -1, byCls: byCls || null });
        }
      }
    }

    return samples;
  }

  // ================= AUTO-FIRST =================
  function sampleGroupBestPaint(group, maxCells = 14) {
    if (!group?.path?.length) return null;
    let best = null;

    for (const cell of group.path.slice(0, maxCells)) {
      const td = cell.td;

      // nếu có class banker/player thì trả thẳng (độ tin cậy cao nhất)
      const byCls = inferBPByClass(td);
      if (byCls === "B" || byCls === "P") {
        return { td, byCls, rgb: null, sat: 999, area: 0, tag: "byClass", stroke: "", fill: "" };
      }

      const p = getMainShapeColorRGB(td);
      if (!p?.rgb) continue;

      const sat = p.sat != null ? p.sat : rgbSat(p.rgb);
      const score = sat * 30 + Math.log(1 + (p.area || 1));

      if (!best || score > best.score) best = { ...p, score, td, byCls: null };
    }
    return best;
  }

  function detectFirstBP(groups, grid) {
    const refs = getRefs();
    const g1 = groups[0];
    const g2 = groups[1];

    if (!g1 || !g1.path?.length) return { ok: false, reason: "G1 empty", refs };

    const p1 = sampleGroupBestPaint(g1, 16);
    const p2 = (g2?.path?.length) ? sampleGroupBestPaint(g2, 10) : null;

    // 1) Ưu tiên tuyệt đối: class banker/player
    if (p1?.byCls === "B" || p1?.byCls === "P") {
      return { ok: true, first: p1.byCls, conf: 1, mode: "byClass", refs, td0: p1.td, paint: p1, g1cls: "class", g2cls: null };
    }

    if (!p1?.rgb) {
      return { ok: false, reason: "cannot resolve color from G1 (no usable paint)", refs };
    }

    // 2) Hue-based
    const c1 = classifyRedBlue(p1.rgb);
    const c2 = (p2?.rgb) ? classifyRedBlue(p2.rgb) : { cls: null };

    let cls = c1.cls;
    if (!cls && c2.cls) cls = (c2.cls === "red" ? "blue" : "red");

    if (cls) {
      const firstBP = ST.colorMap?.[cls] ? ST.colorMap[cls] : (cls === "red" ? "B" : "P");
      let conf = Math.min(1, Math.max(0.35, (c1.sat || rgbSat(p1.rgb)) / 120));
      if (c2.cls && c2.cls !== cls) conf = Math.min(1, conf + 0.25);
      return { ok: true, first: firstBP, conf, mode: `hue(${c1.why})`, paint: p1, refs, td0: p1.td, g1cls: cls, g2cls: c2.cls, hue: c1.hue, sat: c1.sat };
    }

    // 3) Ref distance (nếu đủ chênh)
    const dB = dist2(p1.rgb, refs.bRef);
    const dP = dist2(p1.rgb, refs.pRef);
    const gap = Math.abs(dB - dP) / Math.max(dB, dP, 1);
    if (gap >= 0.08) {
      const first = (dB <= dP) ? "B" : "P";
      return { ok: true, first, conf: Math.min(1, Math.max(0.35, gap)), mode: "dist2(refs)", paint: p1, refs, td0: p1.td, g1cls: null, g2cls: c2.cls };
    }

    // 4) NEW: Clustering toàn bảng -> suy ra 2 màu chủ đạo rồi map về B/P
    const samples = collectSamplesFromGrid(groups, grid, 45).filter(s => s && s.rgb);
    const km = kmeans2(samples);

    if (km && km.sep > 250) {
      const cA = centroidToRedBlue(km.mu1, refs);
      const cB2 = centroidToRedBlue(km.mu2, refs);

      // nếu centroid chưa phân loại được, fallback r-b
      const clsA = cA.cls || ((km.mu1.r - km.mu1.b) >= 0 ? "red" : "blue");
      const clsB = cB2.cls || ((km.mu2.r - km.mu2.b) >= 0 ? "red" : "blue");

      // đảm bảo 2 cluster khác nhau; nếu trùng thì ép theo r-b
      const aFinal = clsA;
      const bFinal = (clsB !== aFinal) ? clsB : (aFinal === "red" ? "blue" : "red");

      // p1 gần centroid nào?
      const near1 = (dist2(p1.rgb, km.mu1) <= dist2(p1.rgb, km.mu2)) ? 1 : 2;
      const g1cls = (near1 === 1) ? aFinal : bFinal;

      const firstBP = ST.colorMap?.[g1cls] ? ST.colorMap[g1cls] : (g1cls === "red" ? "B" : "P");
      const conf = Math.min(1, Math.max(0.25, Math.sqrt(km.sep) / 90));

      return {
        ok: true,
        first: firstBP,
        conf,
        mode: `kmeans2(sep=${Math.round(km.sep)})`,
        paint: p1,
        refs,
        td0: p1.td,
        g1cls,
        g2cls: null,
        cluster: {
          mu1: km.mu1, mu2: km.mu2, sep: km.sep,
          mu1cls: aFinal, mu2cls: bFinal,
          mu1why: cA.why, mu2why: cB2.why
        }
      };
    }

    // 5) vẫn bất phân -> fail (lúc này bắt buộc ép)
    return {
      ok: false,
      reason: "G1 color ambiguous (hue+refs+kmeans all weak) => hãy ép __abxRM16_setFirst('B'|'P')",
      refs,
      paint: p1,
      td0: p1.td
    };
  }

  function opposite(bp) { return bp === "B" ? "P" : "B"; }

  function tieCompact(n) {
    n = n | 0;
    if (n <= 0) return "";
    if (n > 25) n = 25;
    return "T".repeat(n); // T(2)->TT
  }

  function buildSequence(groups, firstBP) {
    const tokens = [];
    const compact = [];

    for (let gi = 0; gi < groups.length; gi++) {
      const bp = (gi % 2 === 0) ? firstBP : opposite(firstBP);
      for (const cell of (groups[gi].path || [])) {
        tokens.push(bp);
        compact.push(bp);

        const t = cell.tie || 0;
        if (t > 0) {
          tokens.push(`T(${t})`);
          compact.push(tieCompact(t));
        }
      }
    }

    return { tokens, tokenStr: tokens.join(" "), compactStr: compact.join("") };
  }

  // ================= Run =================
  async function runAtPoint(x, y, opts) {
    opts = opts || {};
    const labelN = Math.max(0, Math.min(220, opts.labelN ?? 80));

    const best = findBestTableAtPoint(x, y);
    if (!best) {
      alert("❌ RM16: không tìm thấy TABLE roadmap tại điểm click. Click đúng vào lưới Big Road.");
      return null;
    }

    const grid = buildGrid(best.table);
    const groups = splitGroups(grid);

    let markers = 0, tieSum = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r]?.[c];
        if (!cell) continue;
        if (cell.has) markers++;
        if (cell.tie) tieSum += cell.tie;
      }
    }

    let det = detectFirstBP(groups, grid);

    // manual override
    if (ST.forceFirst === "B" || ST.forceFirst === "P") {
      det = { ...det, ok: true, first: ST.forceFirst, conf: 1, mode: "manual-override" };
    }

    // highlight
    clearOv();
    drawBox(best.rect, "border:2px solid rgba(255,255,0,0.95);background:rgba(255,255,0,0.04);border-radius:6px;");
    drawBox({ x: x - 4, y: y - 4, w: 8, h: 8 },
      "background:rgba(255,255,0,0.9);border-radius:999px;box-shadow:0 0 12px rgba(255,255,0,0.9);");

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const outline = (gi % 2 === 0) ? "rgba(0,255,255,0.95)" : "rgba(255,0,255,0.95)";
      if (g.path && g.path.length) {
        const rrTop = rectOf(g.path[0].td);
        drawLabel(rrTop.x + 1, rrTop.y + 1, `G${gi + 1}(${g.len})`,
          "font-size:10px;line-height:10px;padding:1px 3px;border-radius:4px;background:rgba(0,0,0,0.65);color:#fff;");
      }
      for (const cell of g.path || []) {
        const rr = rectOf(cell.td);
        drawBox({ x: rr.x - 1, y: rr.y - 1, w: rr.w + 2, h: rr.h + 2 },
          `outline:2px solid ${outline};background:rgba(255,255,255,0.02);border-radius:3px;`);
      }
    }

    let seqPack = null;
    if (det.ok) {
      seqPack = buildSequence(groups, det.first);

      let idx = 0;
      for (let gi = 0; gi < groups.length && idx < labelN; gi++) {
        for (const cell of groups[gi].path || []) {
          if (idx >= labelN) break;
          const rr = rectOf(cell.td);
          drawLabel(rr.x + 1, rr.y + 12, String(idx + 1),
            "font-size:10px;line-height:10px;padding:1px 3px;border-radius:4px;background:rgba(0,0,0,0.65);color:#fff;");
          idx++;
        }
      }

      if (det.td0) {
        const rr = rectOf(det.td0);
        drawBox({ x: rr.x - 2, y: rr.y - 2, w: rr.w + 4, h: rr.h + 4 },
          "outline:3px solid rgba(255,255,0,0.95);background:rgba(255,255,0,0.06);border-radius:4px;");
      }
    }

    const prev = [];
    const maxR = Math.min(6, grid.rows);
    const maxC = Math.min(60, grid.cols);
    for (let r = 0; r < maxR; r++) {
      const row = [];
      for (let c = 0; c < maxC; c++) row.push(grid.cells[r]?.[c]?.has ? "X" : ".");
      prev.push(`r${r + 1}: ` + row.join(" "));
    }

    const seqTokenStr = seqPack ? seqPack.tokenStr : "(FAIL)";
    const seqCompact = seqPack ? seqPack.compactStr : "(FAIL)";
    const detStr = det.ok
      ? `AUTO-FIRST=${det.first}  conf≈${(det.conf ?? 0).toFixed(2)}  mode=${det.mode || "?"}  g1=${det.g1cls || "?"}`
      : `AUTO-FIRST FAIL: ${det.reason}`;

    const debugDet = det.ok
      ? (() => {
          let s = "";
          if (det.paint?.rgb) {
            s += `DetectPaint tag=${det.paint.tag} sat≈${Math.round(det.paint.sat || 0)}\n`;
            s += `stroke="${det.paint.stroke}"\nfill="${det.paint.fill}"\n`;
            s += `rgb(${Math.round(det.paint.rgb.r)},${Math.round(det.paint.rgb.g)},${Math.round(det.paint.rgb.b)})\n`;
          } else if (det.paint?.byCls) {
            s += `DetectPaint byClass=${det.paint.byCls}\n`;
          }
          if (det.cluster) {
            const m1 = det.cluster.mu1, m2 = det.cluster.mu2;
            s += `kmeans sep≈${Math.round(det.cluster.sep)}\n`;
            s += `mu1 rgb(${Math.round(m1.r)},${Math.round(m1.g)},${Math.round(m1.b)}) cls=${det.cluster.mu1cls} why=${det.cluster.mu1why}\n`;
            s += `mu2 rgb(${Math.round(m2.r)},${Math.round(m2.g)},${Math.round(m2.b)}) cls=${det.cluster.mu2cls} why=${det.cluster.mu2why}\n`;
          }
          s += `colorMap(red->${ST.colorMap.red}, blue->${ST.colorMap.blue})`;
          return s;
        })()
      : "";

    const msg =
      `RM16\n` +
      `✅ RM16 AUTO Baccarat\n` +
      `rows=${grid.rows}, cols≈${grid.cols} tableRect=${Math.round(best.rect.w)}x${Math.round(best.rect.h)}\n` +
      `markers=${markers}  tieSum=${tieSum}  total≈${markers + tieSum}\n` +
      `groups=${groups.length}\n` +
      `${detStr}\n\n` +
      `SEQ COMPACT (T(2)->TT):\n${seqCompact.slice(0, 240)}${seqCompact.length > 240 ? " ..." : ""}\n\n` +
      `Occupancy preview:\n${prev.join("\n")}\n\n` +
      (det.ok ? `Detect debug:\n${debugDet}\n\n` : "") +
      `Copy: đã copy FULL output.\n` +
      `Clear: __abxRM16_clear()`;

    const fullOut =
      `${msg}\n\n` +
      `FULL_SEQUENCE_TOKENS:\n${seqTokenStr}\n\n` +
      `FULL_SEQUENCE_COMPACT:\n${seqCompact}\n`;

    await tryCopy(fullOut);
    alert(msg);

    ST.last = { best, grid, groups, det, seq: seqPack };
    window.__abxRM16_last = ST.last;
    return ST.last;
  }

  // ================= Public =================
  window.__abxRM16_clear = function () { clearOv(); return "cleared"; };

  window.__abxRM16_setFirst = function (bp) {
    bp = String(bp || "").toUpperCase();
    if (bp !== "B" && bp !== "P") { ST.forceFirst = null; return "OK: forceFirst cleared."; }
    ST.forceFirst = bp;
    return `OK: forceFirst=${bp}. Click lại để chạy.`;
  };

  window.__abxRM16_swapColors = function () {
    ST.colorMap = { red: ST.colorMap.blue, blue: ST.colorMap.red };
    return `OK: colorMap(red->${ST.colorMap.red}, blue->${ST.colorMap.blue})`;
  };

  window.__abxRM16_clickPickAuto = function (opts) {
    function handler(ev) {
      (async () => {
        try {
          ev.preventDefault?.();
          ev.stopPropagation?.();
          await runAtPoint(ev.clientX, ev.clientY, opts || {});
        } finally {
          document.removeEventListener("click", handler, true);
        }
      })();
    }
    document.addEventListener("click", handler, true);
    alert(
      "🟡 RM16 AutoFirst đã bật.\n" +
      "CLICK vào Big Road (lưới vòng tròn).\n\n" +
      "- Nếu theme đảo màu: __abxRM16_swapColors() rồi click lại.\n" +
      "- Nếu vẫn fail: __abxRM16_setFirst('B'|'P') để ép FIRST."
    );
  };

  window.__abxRM16_help = function () {
    alert(
      "RM16:\n" +
      "1) __abxRM16_clickPickAuto({labelN:80})\n" +
      "2) __abxRM16_swapColors()\n" +
      "3) __abxRM16_setFirst('B'|'P') hoặc __abxRM16_setFirst(null)\n" +
      "4) __abxRM16_clear()\n"
    );
  };

  alert("✅ Đã nạp RM16.\nChạy: __abxRM16_clickPickAuto({labelN:80}) rồi click vào Big Road.\nHelp: __abxRM16_help()");
})();
