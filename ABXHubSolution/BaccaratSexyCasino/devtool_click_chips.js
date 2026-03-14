(() => {
  const TAG = "[ABX CHIP CLICK]";
  const OVERLAY_ID = "__abx_chip_click_overlay";

  function normSpace(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function textOf(el) {
    if (!el) return "";
    return normSpace(el.innerText || el.textContent || "");
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

  function parseChipValueFromClasses(el) {
    const cls = normSpace((el && el.className) || "");
    const m = cls.match(/\bchips(?:3d)?[_-](\d+k?)\b/i);
    if (!m) return null;
    return parseChipValue(m[1]);
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

  function walkSameOriginFrames(win, source, out) {
    out.push({ win, source, href: String(win.location.href || "") });
    const frames = win.frames || [];
    for (let i = 0; i < frames.length; i++) {
      try {
        const child = frames[i];
        void child.location.href;
        walkSameOriginFrames(child, `${source}/frame[${i}]`, out);
      } catch {
        // ignore cross-origin
      }
    }
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

  function scoreSettingsChip(el) {
    let score = 0;
    const li = el.closest && el.closest("[id^='Chips_']");
    if (li) score += 200;
    const id = (li && li.id ? li.id : "").toLowerCase();
    if (id) score += 100;
    const txt = textOf(el);
    if (parseChipValue(txt) != null) score += 50;
    const rect = el.getBoundingClientRect();
    if (rect.top > 120 && rect.top < 760) score += 20;
    if (rect.left > 180 && rect.left < 980) score += 20;
    return score;
  }

  function gatherSettingsPopupChips(ctx) {
    const doc = ctx.win.document;
    const liNodes = Array.from(doc.querySelectorAll("[id^='Chips_']"))
      .filter((el) => isVisible(el))
      .filter((el) => parseChipValue(textOf(el)) != null || parseChipValueFromClasses(el) != null);

    if (!liNodes.length) return null;

    const chips = liNodes.map((li, i) => {
      const rect = li.getBoundingClientRect();
      const cs = doc.defaultView.getComputedStyle(li);
      const value = parseChipValue(textOf(li)) ?? parseChipValueFromClasses(li);
      const selected = /\bselect\b/i.test(li.className || "");
      return {
        idx: i + 1,
        label: normSpace(textOf(li) || String(value)).toUpperCase(),
        value,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        enabled: Number(cs.opacity || "1") > 0.5,
        selected,
        opacity: cs.opacity || "",
        source: ctx.source,
        tail: tailOf(li),
        el: li,
        score: scoreSettingsChip(li)
      };
    }).filter((x) => x.value != null);

    if (chips.length < 6) return null;

    const xs = chips.map((x) => x.x);
    const ys = chips.map((x) => x.y);
    const rs = chips.map((x) => x.x + x.w);
    const bs = chips.map((x) => x.y + x.h);
    const panel = {
      mode: "settings-popup",
      source: ctx.source,
      score: chips.reduce((s, x) => s + x.score, 0),
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...rs) - Math.min(...xs),
      h: Math.max(...bs) - Math.min(...ys)
    };

    return { panel, chips, doc };
  }

  function gatherActiveBarChips(ctx) {
    const doc = ctx.win.document;
    const chips = Array.from(doc.querySelectorAll(".list_select_chips3d > div, .list_select_chips3d > li, .chips3d"))
      .filter((el) => isVisible(el))
      .map((el, i) => {
        const rect = el.getBoundingClientRect();
        const value = parseChipValue(textOf(el)) ?? parseChipValueFromClasses(el);
        if (value == null) return null;
        const cs = doc.defaultView.getComputedStyle(el);
        return {
          idx: i + 1,
          label: normSpace(textOf(el) || String(value)).toUpperCase(),
          value,
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          enabled: Number(cs.opacity || "1") > 0.5,
          selected: true,
          opacity: cs.opacity || "",
          source: ctx.source,
          tail: tailOf(el),
          el,
          score: 1
        };
      })
      .filter(Boolean);

    if (!chips.length) return null;

    const deduped = new Map();
    for (const chip of chips) {
      const key = `${chip.value}|${Math.round(chip.x / 10)}|${Math.round(chip.y / 10)}`;
      if (!deduped.has(key)) deduped.set(key, chip);
    }
    const list = Array.from(deduped.values()).sort((a, b) => a.x - b.x || a.y - b.y);
    const xs = list.map((x) => x.x);
    const ys = list.map((x) => x.y);
    const rs = list.map((x) => x.x + x.w);
    const bs = list.map((x) => x.y + x.h);
    const panel = {
      mode: "active-bar",
      source: ctx.source,
      score: list.length * 100,
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...rs) - Math.min(...xs),
      h: Math.max(...bs) - Math.min(...ys)
    };
    return { panel, chips: list, doc };
  }

  function gatherChipPanel() {
    const contexts = [];
    walkSameOriginFrames(window.top, "top", contexts);
    let bestPopup = null;
    for (const ctx of contexts) {
      const popup = gatherSettingsPopupChips(ctx);
      if (popup && (!bestPopup || popup.panel.score > bestPopup.panel.score)) bestPopup = popup;
    }
    if (bestPopup) return { contexts, ...bestPopup };

    let bestBar = null;
    for (const ctx of contexts) {
      const bar = gatherActiveBarChips(ctx);
      if (bar && (!bestBar || bar.panel.score > bestBar.panel.score)) bestBar = bar;
    }
    if (bestBar) return { contexts, ...bestBar };
    return { contexts, panel: null, chips: [], doc: document };
  }

  function renderPanel(panelData) {
    if (!panelData || !panelData.panel) return;
    const root = ensureOverlay(panelData.doc);
    addBox(
      panelData.doc,
      root,
      panelData.panel.x,
      panelData.panel.y,
      panelData.panel.w,
      panelData.panel.h,
      "#00ff88",
      panelData.panel.mode === "settings-popup" ? "CHIP SETTINGS" : "ACTIVE CHIPS"
    );
    for (const chip of panelData.chips) {
      addBox(
        panelData.doc,
        root,
        chip.x,
        chip.y,
        chip.w,
        chip.h,
        chip.selected ? "#00d0ff" : "#ffd54f",
        chip.label
      );
    }
  }

  function fireClick(win, el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1
    };
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch {}
    try { el.focus && el.focus(); } catch {}
    el.dispatchEvent(new win.PointerEvent("pointerdown", opts));
    el.dispatchEvent(new win.MouseEvent("mousedown", opts));
    el.dispatchEvent(new win.PointerEvent("pointerup", opts));
    el.dispatchEvent(new win.MouseEvent("mouseup", opts));
    el.dispatchEvent(new win.MouseEvent("click", opts));
  }

  function normalizeChipTarget(v) {
    if (typeof v === "number") return v;
    return parseChipValue(v);
  }

  function listChips() {
    const data = gatherChipPanel();
    renderPanel(data);
    const contextRows = data.contexts.map((ctx) => ({
      source: ctx.source,
      href: ctx.href
    }));
    const chips = data.chips.map((x, i) => ({ ...x, idx: i + 1 }));
    console.log(`${TAG} contexts=`);
    console.table(contextRows);
    console.log(`${TAG} panel=`, data.panel);
    console.log(`${TAG} chips=`);
    console.table(chips.map(({ el, score, ...rest }) => rest));
    window.__abx_chip_click_result = {
      contexts: contextRows,
      panel: data.panel,
      chips: chips.map(({ el, score, ...rest }) => rest)
    };
    return window.__abx_chip_click_result;
  }

  function focusChip(target) {
    const value = normalizeChipTarget(target);
    if (value == null) {
      console.warn(`${TAG} invalid chip target`, target);
      return null;
    }
    const data = gatherChipPanel();
    renderPanel(data);
    const chip = data.chips.find((x) => x.value === value);
    if (!chip) {
      console.warn(`${TAG} chip not found`, { target, value, mode: data.panel && data.panel.mode });
      return null;
    }
    const root = ensureOverlay(data.doc);
    addBox(data.doc, root, chip.x, chip.y, chip.w, chip.h, "#ff5252", `FOCUS ${chip.label}`);
    console.log(`${TAG} focus=`, {
      target,
      value,
      mode: data.panel && data.panel.mode,
      source: chip.source,
      tail: chip.tail
    });
    return {
      target,
      value,
      mode: data.panel && data.panel.mode,
      source: chip.source,
      tail: chip.tail
    };
  }

  function clickChip(target) {
    const value = normalizeChipTarget(target);
    if (value == null) {
      console.warn(`${TAG} invalid chip target`, target);
      return null;
    }
    const data = gatherChipPanel();
    renderPanel(data);
    const chip = data.chips.find((x) => x.value === value);
    if (!chip) {
      console.warn(`${TAG} chip not found`, { target, value, mode: data.panel && data.panel.mode });
      return null;
    }
    addBox(data.doc, ensureOverlay(data.doc), chip.x, chip.y, chip.w, chip.h, "#ff1744", `CLICK ${chip.label}`);
    fireClick(data.doc.defaultView, chip.el);
    const result = {
      target,
      value,
      label: chip.label,
      mode: data.panel && data.panel.mode,
      selectedBefore: chip.selected,
      source: chip.source,
      tail: chip.tail
    };
    console.log(`${TAG} click=`, result);
    window.__abx_chip_click_last = result;
    return result;
  }

  window.__abx_list_chips = listChips;
  window.__abx_focus_chip = focusChip;
  window.__abx_click_chip = clickChip;
  window.__abx_chip_click_clear = clearOverlay;

  console.log(`${TAG} ready`);
  console.log("__abx_list_chips()");
  console.log("__abx_focus_chip(100)");
  console.log("__abx_click_chip(100)");
  console.log("__abx_chip_click_clear()");
})();
