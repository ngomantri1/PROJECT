(() => {
  const TAG = "[ABX CONFIRM]";
  const OVERLAY_ID = "__abx_confirm_probe_overlay";

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
    if (Number(cs.opacity || "1") <= 0.02) return false;
    return true;
  }

  function shouldIgnore(el) {
    if (!el || !el.closest) return true;
    if (el.closest(`#${OVERLAY_ID}`)) return true;
    const flat = stripDiacritics(tailOf(el));
    return (
      flat.includes("chat") ||
      flat.includes("history") ||
      flat.includes("road") ||
      flat.includes("countdown") ||
      flat.includes("processbar") ||
      flat.includes("setchips")
    );
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

  const CONFIRM_RX = [
    /\bxac nhan\b/i,
    /\bxác nhận\b/i,
    /\bconfirm\b/i,
    /\bok\b/i
  ];

  function looksLikeConfirm(text) {
    const txt = normSpace(text);
    if (!txt) return false;
    return CONFIRM_RX.some((rx) => rx.test(txt));
  }

  function isExactConfirmText(text) {
    const flat = stripDiacritics(normSpace(text));
    if (!flat) return false;
    return flat === "xac nhan" || flat === "confirm" || flat === "ok";
  }

  function targetHostOf(el) {
    if (!el || !el.closest) return null;
    const ownText = textOf(el);
    if (isExactConfirmText(ownText)) return el;
    const selectors = [
      "button",
      "span",
      "p",
      "[role='button']",
      ".btn",
      ".button",
      ".confirm",
      ".btn_confirm",
      ".game_btn",
      ".zone_bet_bottom button",
      ".zone_bet_bottom > div",
      ".zone_bet_bottom > li",
      ".zone_bet_bottom li"
    ];
    for (const sel of selectors) {
      const host = el.closest(sel);
      if (!host) continue;
      const txt = textOf(host);
      if (!looksLikeConfirm(txt) && !looksLikeConfirm(ownText)) continue;
      if (!isExactConfirmText(txt) && !isExactConfirmText(ownText)) continue;
      return host;
    }
    return isExactConfirmText(ownText) ? el : null;
  }

  function scoreContext(doc) {
    let score = 0;
    for (const el of doc.querySelectorAll("body *")) {
      if (!isVisible(el) || shouldIgnore(el)) continue;
      const txt = textOf(el);
      if (looksLikeConfirm(txt)) score += 50;
    }
    return score;
  }

  function collectCandidates(doc, source) {
    const rows = [];
    let idx = 0;
    for (const el of doc.querySelectorAll("body *")) {
      if (!isVisible(el) || shouldIgnore(el)) continue;
      const host = targetHostOf(el);
      if (!host || shouldIgnore(host)) continue;
      const txt = textOf(host) || textOf(el);
      if (!looksLikeConfirm(txt) || !isExactConfirmText(txt)) continue;
      const rect = host.getBoundingClientRect();
      if (rect.top < doc.defaultView.innerHeight * 0.70) continue;
      if (rect.width < 40 || rect.height < 20) continue;
      if (rect.width > 180 || rect.height > 90) continue;
      const cs = doc.defaultView.getComputedStyle(host);
      rows.push({
        idx: ++idx,
        text: txt,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        source,
        opacity: cs.opacity || "",
        enabled:
          Number(cs.opacity || "1") > 0.2 &&
          !host.hasAttribute("disabled") &&
          !String(host.getAttribute("aria-disabled") || "").match(/true/i),
        tail: tailOf(host),
        el: host
      });
    }
    const bestByKey = new Map();
    for (const row of rows) {
      const key = `${Math.round(row.x / 8)}|${Math.round(row.y / 8)}|${Math.round(row.w / 8)}|${Math.round(row.h / 8)}`;
      const prev = bestByKey.get(key);
      if (!prev || row.w * row.h > prev.w * prev.h) bestByKey.set(key, row);
    }
    return Array.from(bestByKey.values()).sort((a, b) => a.y - b.y || a.x - b.x);
  }

  function pickBestConfirm(contexts) {
    let best = null;
    for (const ctx of contexts) {
      const candidates = collectCandidates(ctx.win.document, ctx.source);
      for (const c of candidates) {
        let score = 0;
        score += c.source === "top/frame[1]" ? 300 : 0;
        score += c.y > ctx.win.innerHeight * 0.78 ? 220 : 0;
        score += Math.min(c.w * c.h, 40000) / 250;
        score -= Math.max(0, c.w - 140) * 2;
        score -= Math.max(0, c.h - 60) * 3;
        if (/zone_bet_bottom|betbox|confirm|btn/i.test(c.tail)) score += 180;
        if (isExactConfirmText(c.text)) score += 260;
        if (c.enabled) score += 60;
        c._score = score;
        if (!best || score > best._score) best = { ...c, href: ctx.href, doc: ctx.win.document };
      }
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

  function listConfirm() {
    const contexts = [];
    walkSameOriginFrames(window.top, "top", contexts);
    const contextRows = contexts.map((ctx) => ({
      source: ctx.source,
      href: ctx.href,
      score: scoreContext(ctx.win.document)
    }));
    const best = pickBestConfirm(contexts);
    console.log(`${TAG} contexts=`);
    console.table(contextRows);
    console.log(`${TAG} result=`, best ? {
      source: best.source,
      href: best.href,
      x: best.x,
      y: best.y,
      w: best.w,
      h: best.h,
      enabled: best.enabled,
      text: best.text,
      tail: best.tail
    } : null);
    if (!best) {
      window.__abx_confirm_result = { contexts: contextRows, confirm: null };
      return window.__abx_confirm_result;
    }
    addBox(best.doc, ensureOverlay(best.doc), best.x, best.y, best.w, best.h, "#ffd54f", "CONFIRM");
    window.__abx_confirm_result = {
      contexts: contextRows,
      confirm: {
        source: best.source,
        href: best.href,
        x: best.x,
        y: best.y,
        w: best.w,
        h: best.h,
        enabled: best.enabled,
        text: best.text,
        tail: best.tail
      }
    };
    return window.__abx_confirm_result;
  }

  function focusConfirm() {
    const res = listConfirm();
    if (!res.confirm) return null;
    console.log(`${TAG} focus=`, res.confirm);
    return res.confirm;
  }

  function clickConfirm() {
    const contexts = [];
    walkSameOriginFrames(window.top, "top", contexts);
    const best = pickBestConfirm(contexts);
    if (!best) {
      console.warn(`${TAG} confirm not found`);
      return null;
    }
    addBox(best.doc, ensureOverlay(best.doc), best.x, best.y, best.w, best.h, "#ff3b30", "CLICK CONFIRM");
    fireClick(best.doc.defaultView, best.el);
    const result = {
      source: best.source,
      href: best.href,
      x: best.x,
      y: best.y,
      w: best.w,
      h: best.h,
      enabled: best.enabled,
      text: best.text,
      tail: best.tail
    };
    console.log(`${TAG} click=`, result);
    window.__abx_confirm_last_click = result;
    return result;
  }

  window.__abx_list_confirm = listConfirm;
  window.__abx_focus_confirm = focusConfirm;
  window.__abx_click_confirm = clickConfirm;
  window.__abx_confirm_clear = clearOverlay;

  console.log(`${TAG} ready`);
  console.log("__abx_list_confirm()");
  console.log("__abx_focus_confirm()");
  console.log("__abx_click_confirm()");
  console.log("__abx_confirm_clear()");
})();
