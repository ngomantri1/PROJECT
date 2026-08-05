(() => {
  const TAG = "[ABX CHIP]";
  const OVERLAY_ID = "__abx_chip_probe_overlay";

  function normSpace(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function stripDiacritics(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function textOf(el) {
    if (!el) return "";
    return normSpace(el.innerText || el.textContent || "");
  }

  function parseChipValueFromClasses(el) {
    const cls = normSpace((el && el.className) || "");
    const m = cls.match(/\bchips3d-(\d+)\b/i);
    if (!m) return null;
    return parseChipValue(m[1]);
  }

  function shouldIgnoreNode(el) {
    if (!el || !el.closest) return true;
    if (el.closest(`#${OVERLAY_ID}`)) return true;
    const flat = stripDiacritics(tailOf(el));
    if (
      flat.includes("info_money") ||
      flat.includes("info_people") ||
      flat.includes("statistics") ||
      flat.includes("zone_bet") ||
      flat.includes("processbar") ||
      flat.includes("countdown") ||
      flat.includes("chat")
    ) {
      return true;
    }
    return false;
  }

  function chipHostOf(el) {
    if (!el || !el.closest) return null;
    return (
      el.closest(".chips3d") ||
      el.closest(".list_select_chips3d > div") ||
      el.closest(".list_select_chips3d")
    );
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return false;
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    if (!cs) return false;
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (Number(cs.opacity || "1") <= 0.05) return false;
    return true;
  }

  function parseChipValue(raw) {
    const t = normSpace(raw).toUpperCase();
    if (!t) return null;
    const m = t.match(/^(\d+(?:\.\d+)?)(K)?$/);
    if (!m) return null;
    let n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    if (m[2] === "K") n *= 1000;
    n = Math.round(n);
    if (n < 10 || n > 50000) return null;
    return n;
  }

  function looksLikeChipValue(raw) {
    return parseChipValue(raw) != null;
  }

  function tailOf(el) {
    if (!el) return "";
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 7) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += "#" + cur.id;
      const cls = normSpace(cur.className || "")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .join(".");
      if (cls) p += "." + cls;
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  function walkSameOriginFrames(win, source, out) {
    out.push({ win, source, href: String(win.location.href || "") });
    const frames = win.frames || [];
    for (let i = 0; i < frames.length; i++) {
      try {
        const child = frames[i];
        void child.location.href;
        walkSameOriginFrames(child, `${source}/frame[${i}]`, out);
      } catch {
        // skip cross-origin
      }
    }
  }

  function scoreContext(doc) {
    const all = Array.from(doc.querySelectorAll("body *"));
    let score = 0;
    let chipLike = 0;
    let titleLike = 0;
    for (const el of all) {
      if (!isVisible(el)) continue;
      const txt = textOf(el);
      if (!txt) continue;
      const flat = stripDiacritics(txt);
      if (looksLikeChipValue(txt)) {
        chipLike++;
        score += 50;
      }
      if (
        flat.includes("chip") ||
        flat.includes("cai dat") ||
        flat.includes("lua chon") ||
        flat.includes("so luong")
      ) {
        titleLike++;
        score += 25;
      }
    }
    score += Math.min(chipLike, 20) * 10;
    score += Math.min(titleLike, 6) * 8;
    return score;
  }

  function dedupeCandidates(rows) {
    const bestByKey = new Map();
    for (const row of rows) {
      const key = `${row.value}|${Math.round(row.cx / 8)}|${Math.round(row.cy / 8)}`;
      const prev = bestByKey.get(key);
      if (!prev || row.w * row.h < prev.w * prev.h) {
        bestByKey.set(key, row);
      }
    }
    return Array.from(bestByKey.values())
      .sort((a, b) => a.y - b.y || a.x - b.x || a.value - b.value)
      .map((x, i) => ({ ...x, idx: i + 1 }));
  }

  function chipIdKeyOf(el, value, x, y) {
    if (el && el.closest) {
      const li = el.closest("[id^='Chips_'], [id^='iChips_']");
      if (li && li.id) return li.id.toLowerCase();
    }
    return `${value}|${Math.round(x / 10)}|${Math.round(y / 10)}`;
  }

  function findChipCandidates(doc, source) {
    const rows = [];
    const nodes = Array.from(doc.querySelectorAll("body *"));
    let idx = 0;
    const chipPanelNodes = Array.from(doc.querySelectorAll(".list_select_chips3d, .chips3d"));
    const preferChipPanel = chipPanelNodes.length > 0;
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      if (shouldIgnoreNode(el)) continue;
      const host = chipHostOf(el);
      if (preferChipPanel && !host) continue;
      const base = host || el;
      if (shouldIgnoreNode(base)) continue;
      const txt = textOf(base);
      const value = parseChipValue(txt) ?? parseChipValueFromClasses(base);
      if (value == null) continue;
      const rect = base.getBoundingClientRect();
      const cs = doc.defaultView.getComputedStyle(el);
      const enabled =
        Number(cs.opacity || "1") > 0.5 &&
        !base.hasAttribute("disabled") &&
        !String(base.getAttribute("aria-disabled") || "").match(/true/i);
      rows.push({
        idx: ++idx,
        label: normSpace(txt || String(value)).toUpperCase(),
        value,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        cx: Math.round(rect.left + rect.width / 2),
        cy: Math.round(rect.top + rect.height / 2),
        enabled,
        opacity: cs.opacity || "",
        source,
        tail: tailOf(base),
        el: base,
        doc
      });
    }
    return dedupeCandidates(rows);
  }

  function findSettingsPanel(doc, source) {
    const chips = Array.from(doc.querySelectorAll("body *"))
      .filter((el) => isVisible(el) && !shouldIgnoreNode(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const txt = textOf(el);
        const value = parseChipValue(txt) ?? parseChipValueFromClasses(el);
        return {
          el,
          rect,
          value,
          label: normSpace(txt || ""),
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2
        };
      })
      .filter((x) => x.value != null)
      .filter((x) => x.rect.top > 120 && x.rect.top < 760)
      .filter((x) => x.rect.left > 180 && x.rect.left < 980)
      .filter((x) => x.rect.width >= 18 && x.rect.width <= 140)
      .filter((x) => x.rect.height >= 18 && x.rect.height <= 140);

    if (chips.length < 6) return null;

    const groups = [];
    for (const chip of chips) {
      let g = groups.find(
        (x) => Math.abs(x.centerY - chip.cy) <= 180 && Math.abs(x.centerX - chip.cx) <= 240
      );
      if (!g) {
        g = { chips: [], centerX: chip.cx, centerY: chip.cy };
        groups.push(g);
      }
      g.chips.push(chip);
      g.centerX = g.chips.reduce((s, it) => s + it.cx, 0) / g.chips.length;
      g.centerY = g.chips.reduce((s, it) => s + it.cy, 0) / g.chips.length;
    }

    let best = null;
    for (const group of groups) {
      if (group.chips.length < 6) continue;
      const xs = group.chips.map((x) => x.rect.left);
      const ys = group.chips.map((x) => x.rect.top);
      const rs = group.chips.map((x) => x.rect.right);
      const bs = group.chips.map((x) => x.rect.bottom);
      const rect = {
        left: Math.min(...xs),
        top: Math.min(...ys),
        right: Math.max(...rs),
        bottom: Math.max(...bs)
      };
      rect.width = rect.right - rect.left;
      rect.height = rect.bottom - rect.top;
      const values = new Set(group.chips.map((x) => x.value));
      const topChips = group.chips.filter((x) => x.cy < rect.top + rect.height * 0.55);
      const bottomChips = group.chips.filter((x) => x.cy >= rect.top + rect.height * 0.55);
      const distinctRows = new Set(group.chips.map((x) => Math.round(x.rect.top / 32))).size;
      const distinctCols = new Set(group.chips.map((x) => Math.round(x.rect.left / 40))).size;

      let score = 0;
      score += group.chips.length * 90;
      score += values.size * 120;
      if (group.chips.length >= 10) score += 500;
      if (topChips.length >= 5 && bottomChips.length >= 2) score += 350;
      if (rect.top > 180 && rect.top < 700) score += 220;
      if (rect.left > 220 && rect.left < 950) score += 120;
      if (values.has(10) && values.has(20) && values.has(50) && values.has(100) && values.has(200)) score += 400;
      if (values.has(500) && values.has(1000) && values.has(2000) && values.has(5000)) score += 300;
      if (rect.width > 280 && rect.width < 520) score += 120;
      if (rect.height > 180 && rect.height < 420) score += 120;
      if (distinctRows >= 3) score += 180;
      if (distinctCols >= 4) score += 180;
      if (rect.top < 760 && rect.bottom < 860) score += 220;
      if (group.chips.some((x) => x.label === "0")) score -= 140;
      if (group.chips.some((x) => x.rect.top > 780)) score -= 300;

      const panel = {
        el: group.chips[0].el.parentElement || group.chips[0].el,
        rect,
        hosts: group.chips.map((x) => ({
          label: normSpace(x.label || textOf(x.el) || ""),
          value: x.value,
          el: x.el
        })),
        values,
        score,
        source,
        doc
      };
      if (!best || panel.score > best.score) best = panel;
    }
    return best;
  }

  function pickBestPanelInSource(candidates) {
    if (!candidates.length) return null;
    const groups = [];
    for (const c of candidates) {
      let g = groups.find(
        (x) => Math.abs(x.centerY - c.cy) <= 160 && Math.abs(x.centerX - c.cx) <= 260
      );
      if (!g) {
        g = { items: [], centerX: c.cx, centerY: c.cy };
        groups.push(g);
      }
      g.items.push(c);
      g.centerX = Math.round(g.items.reduce((s, it) => s + it.cx, 0) / g.items.length);
      g.centerY = Math.round(g.items.reduce((s, it) => s + it.cy, 0) / g.items.length);
    }

    let best = null;
    for (const g of groups) {
      const values = new Set(g.items.map((x) => x.value));
      const enabledCount = g.items.filter((x) => x.enabled).length;
      const xs = g.items.map((x) => x.x);
      const ys = g.items.map((x) => x.y);
      const rs = g.items.map((x) => x.x + x.w);
      const bs = g.items.map((x) => x.y + x.h);
      const box = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...rs) - Math.min(...xs),
        h: Math.max(...bs) - Math.min(...ys)
      };

      let score = 0;
      score += values.size * 120;
      score += enabledCount * 24;
      score += g.items.length * 10;
      score -= Math.abs(box.w - 520) * 0.08;
      score -= Math.abs(box.h - 360) * 0.06;
      if (box.y > 650) score += 180;
      if (values.has(10) && values.has(20) && values.has(50) && values.has(100) && values.has(200)) {
        score += 300;
      }
      const source = String(g.items[0].source || "");
      if (source === "top/frame[1]") score += 220;

      const cur = { items: g.items, values, enabledCount, box, score, source };
      if (!best || cur.score > best.score) best = cur;
    }
    return best;
  }

  function pickBestPanel(candidates) {
    if (!candidates.length) return null;
    const bySource = new Map();
    for (const c of candidates) {
      const key = String(c.source || "");
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(c);
    }

    const sourceScores = Array.from(bySource.entries()).map(([source, items]) => {
      let score = 0;
      const values = new Set(items.map((x) => x.value));
      score += values.size * 80;
      score += items.length * 12;
      if (source === "top/frame[1]") score += 200;
      return { source, score, items };
    }).sort((a, b) => b.score - a.score);

    let best = null;
    for (const src of sourceScores) {
      const panel = pickBestPanelInSource(src.items);
      if (!panel) continue;
      if (!best || panel.score > best.score) best = panel;
    }
    return best;
  }

  function ensureOverlay(doc) {
    const old = doc.getElementById(OVERLAY_ID);
    if (old) old.remove();
    const root = doc.createElement("div");
    root.id = OVERLAY_ID;
    root.style.position = "fixed";
    root.style.left = "0";
    root.style.top = "0";
    root.style.width = "100vw";
    root.style.height = "100vh";
    root.style.pointerEvents = "none";
    root.style.zIndex = "2147483647";
    doc.body.appendChild(root);
    return root;
  }

  function addBox(doc, root, x, y, w, h, color, text) {
    const box = doc.createElement("div");
    box.style.position = "fixed";
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${Math.max(0, w)}px`;
    box.style.height = `${Math.max(0, h)}px`;
    box.style.border = `2px solid ${color}`;
    box.style.boxSizing = "border-box";
    box.style.pointerEvents = "none";
    box.style.background = "rgba(255,255,255,0.03)";
    root.appendChild(box);

    const label = doc.createElement("div");
    label.textContent = text;
    label.style.position = "fixed";
    label.style.left = `${x}px`;
    label.style.top = `${Math.max(0, y - 18)}px`;
    label.style.padding = "1px 4px";
    label.style.font = "12px Consolas, monospace";
    label.style.color = "#fff";
    label.style.background = color;
    label.style.pointerEvents = "none";
    root.appendChild(label);
  }

  function clearOverlay() {
    try {
      const contexts = [];
      walkSameOriginFrames(window.top, "top", contexts);
      for (const ctx of contexts) {
        const old = ctx.win.document.getElementById(OVERLAY_ID);
        if (old) old.remove();
      }
    } catch {
      // ignore
    }
  }

  function run() {
    const contexts = [];
    walkSameOriginFrames(window.top, "top", contexts);

    const contextRows = contexts.map((ctx) => ({
      source: ctx.source,
      href: ctx.href,
      score: scoreContext(ctx.win.document)
    }));

    console.log(`${TAG} contexts=`);
    console.table(contextRows);

    let popupPanel = null;
    for (const ctx of contexts) {
      const found = findSettingsPanel(ctx.win.document, ctx.source);
      if (found && (!popupPanel || found.score > popupPanel.score)) popupPanel = found;
    }

    if (popupPanel) {
      const panelDoc = popupPanel.doc;
      const overlay = ensureOverlay(panelDoc);
      addBox(
        panelDoc,
        overlay,
        Math.round(popupPanel.rect.left),
        Math.round(popupPanel.rect.top),
        Math.round(popupPanel.rect.width),
        Math.round(popupPanel.rect.height),
        "#00ff88",
        "CHIP SETTINGS"
      );

      const chips = popupPanel.hosts
        .map((host, i) => {
          const rect = host.el.getBoundingClientRect();
          const cs = panelDoc.defaultView.getComputedStyle(host.el);
          const idKey = chipIdKeyOf(host.el, host.value, rect.left, rect.top);
          const hostLi = host.el.closest && host.el.closest("[id^='Chips_'], [id^='iChips_']");
          const hostClass = `${host.el.className || ""} ${hostLi && hostLi.className ? hostLi.className : ""}`.toLowerCase();
          const selected = Number(cs.opacity || "1") > 0.8 && hostClass.includes("select");
          return {
            idx: i + 1,
            label: normSpace(textOf(host.el) || String(host.value)).toUpperCase(),
            value: host.value,
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            enabled: Number(cs.opacity || "1") > 0.5,
            selected,
            opacity: cs.opacity || "",
            source: popupPanel.source,
            tail: tailOf(host.el),
            _dedupeKey: idKey
          };
        })
        .reduce((acc, item) => {
          const prev = acc.map.get(item._dedupeKey);
          if (!prev || item.w * item.h > prev.w * prev.h) {
            acc.map.set(item._dedupeKey, item);
          }
          return acc;
        }, { map: new Map() });

      const dedupedChips = Array.from(chips.map.values())
        .sort((a, b) => a.y - b.y || a.x - b.x || a.value - b.value)
        .map((x, i) => {
          const { _dedupeKey, ...rest } = x;
          return { ...rest, idx: i + 1 };
        });

      for (const chip of dedupedChips) {
        addBox(
          panelDoc,
          overlay,
          chip.x,
          chip.y,
          chip.w,
          chip.h,
          chip.selected ? "#00d0ff" : (chip.enabled ? "#ffd54f" : "#9e9e9e"),
          chip.label
        );
      }

      const selectedChips = dedupedChips.filter((x) => x.selected);
      console.log(`${TAG} panel=`, {
        mode: "settings-popup",
        score: popupPanel.score,
        count: dedupedChips.length,
        selectedCount: selectedChips.length,
        values: dedupedChips.map((x) => x.value).sort((a, b) => a - b),
        x: Math.round(popupPanel.rect.left),
        y: Math.round(popupPanel.rect.top),
        w: Math.round(popupPanel.rect.width),
        h: Math.round(popupPanel.rect.height)
      });
      console.log(`${TAG} chips=`);
      console.table(dedupedChips);

      window.__abx_chip_probe_result = {
        contexts: contextRows,
        panel: {
          mode: "settings-popup",
          score: popupPanel.score,
          count: dedupedChips.length,
          selectedCount: selectedChips.length,
          values: dedupedChips.map((x) => x.value).sort((a, b) => a - b),
          x: Math.round(popupPanel.rect.left),
          y: Math.round(popupPanel.rect.top),
          w: Math.round(popupPanel.rect.width),
          h: Math.round(popupPanel.rect.height)
        },
        chips: dedupedChips,
        allChips: dedupedChips,
        selectedChips
      };
      return window.__abx_chip_probe_result;
    }

    let allCandidates = [];
    for (const ctx of contexts) {
      const found = findChipCandidates(ctx.win.document, ctx.source);
      allCandidates = allCandidates.concat(found);
    }

    const panel = pickBestPanel(allCandidates);
    if (!panel) {
      console.warn(`${TAG} no chip panel found`);
      window.__abx_chip_probe_result = {
        contexts: contextRows,
        panel: null,
        chips: []
      };
      return window.__abx_chip_probe_result;
    }

    const panelDoc = panel.items[0].doc;
    const overlay = ensureOverlay(panelDoc);
    addBox(panelDoc, overlay, panel.box.x, panel.box.y, panel.box.w, panel.box.h, "#00ff88", "CHIP PANEL");
    for (const chip of panel.items) {
      addBox(
        panelDoc,
        overlay,
        chip.x,
        chip.y,
        chip.w,
        chip.h,
        chip.enabled ? "#ffd54f" : "#9e9e9e",
        `${chip.label}`
      );
    }

    const chips = panel.items
      .sort((a, b) => a.y - b.y || a.x - b.x || a.value - b.value)
      .map((x, i) => ({
        idx: i + 1,
        label: x.label,
        value: x.value,
        x: x.x,
        y: x.y,
        w: x.w,
        h: x.h,
        enabled: x.enabled,
        opacity: x.opacity,
        source: x.source,
        tail: x.tail
      }));

    console.log(`${TAG} panel=`, {
      score: panel.score,
      count: panel.items.length,
      enabledCount: panel.enabledCount,
      values: Array.from(panel.values).sort((a, b) => a - b),
      x: panel.box.x,
      y: panel.box.y,
      w: panel.box.w,
      h: panel.box.h
    });
    console.log(`${TAG} chips=`);
    console.table(chips);

    window.__abx_chip_probe_result = {
      contexts: contextRows,
      panel: {
        mode: "active-bar",
        score: panel.score,
        count: panel.items.length,
        enabledCount: panel.enabledCount,
        values: Array.from(panel.values).sort((a, b) => a - b),
        x: panel.box.x,
        y: panel.box.y,
        w: panel.box.w,
        h: panel.box.h
      },
      chips,
      allChips: chips,
      selectedChips: chips.filter((x) => x.enabled)
    };
    return window.__abx_chip_probe_result;
  }

  window.__abx_probe_chips_clear = clearOverlay;
  window.__abx_probe_chips = run;
  run();
})();
