(() => {
  const TAG = "[ABX BET TARGET]";
  const OVERLAY_ID = "__abx_bet_target_overlay";

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
    if (Number(cs.opacity || "1") <= 0.05) return false;
    return true;
  }

  function shouldIgnore(el) {
    if (!el || !el.closest) return true;
    if (el.closest(`#${OVERLAY_ID}`)) return true;
    const flat = stripDiacritics(tailOf(el));
    return (
      flat.includes("chat") ||
      flat.includes("countdown") ||
      flat.includes("processbar") ||
      flat.includes("road") ||
      flat.includes("history") ||
      flat.includes("result") ||
      flat.includes("process_status") ||
      flat.includes("processstatus") ||
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
        // ignore cross-origin
      }
    }
  }

  const SIDE_ALIASES = {
    PLAYER: [
      /\bplayer\b/i,
      /\btay con\b/i,
      /\b闲\b/i
    ],
    BANKER: [
      /\bbanker\b/i,
      /\bnha cai\b/i,
      /\bnhà cái\b/i,
      /\b庄\b/i
    ],
    TIE: [
      /\btie\b/i,
      /\bhoa\b/i,
      /\bhòa\b/i,
      /\b和\b/i
    ]
  };

  function matchSide(text) {
    const txt = normSpace(text);
    if (!txt) return null;
    for (const side of ["PLAYER", "BANKER", "TIE"]) {
      for (const rx of SIDE_ALIASES[side]) {
        if (rx.test(txt)) return side;
      }
    }
    return null;
  }

  function targetHostOf(el) {
    if (!el || !el.closest) return null;
    const text = textOf(el);
    const ownSide = matchSide(text);
    const selectors = [
      "li[id^='betBox']",
      ".zone_bet_bottom > li",
      ".zone_bet_bottom li",
      ".ga .zone_bet_bottom > li",
      ".ga .zone_bet_bottom li",
      ".zone_bet_bottom > div",
      ".zone_bet_bottom div"
    ];
    for (const sel of selectors) {
      const host = el.closest(sel);
      if (!host) continue;
      const hostText = textOf(host);
      const flatTail = stripDiacritics(tailOf(host));
      if (!flatTail.includes("zone_bet_bottom") && !flatTail.includes("betbox")) continue;
      if (matchSide(hostText) || ownSide) return host;
    }
    return null;
  }

  function scoreContext(doc) {
    const all = Array.from(doc.querySelectorAll("body *"));
    let score = 0;
    let targetLike = 0;
    for (const el of all) {
      if (!isVisible(el) || shouldIgnore(el)) continue;
      const txt = textOf(el);
      if (!txt) continue;
      if (matchSide(txt)) {
        targetLike++;
        score += 80;
      }
    }
    score += Math.min(targetLike, 12) * 10;
    return score;
  }

  function collectCandidates(doc, source) {
    const rows = [];
    const nodes = Array.from(doc.querySelectorAll("body *"));
    let idx = 0;
    for (const el of nodes) {
      if (!isVisible(el) || shouldIgnore(el)) continue;
      const host = targetHostOf(el);
      if (!host || shouldIgnore(host)) continue;
      const txt = textOf(host);
      const side = matchSide(txt) || matchSide(textOf(el));
      if (!side) continue;
      const rect = host.getBoundingClientRect();
      if (rect.top < doc.defaultView.innerHeight * 0.60) continue;
      if (rect.width < 50 || rect.height < 30) continue;
      const flatTail = stripDiacritics(tailOf(host));
      if (!flatTail.includes("zone_bet_bottom") && !flatTail.includes("betbox")) continue;
      const key = `${side}|${Math.round(rect.left / 8)}|${Math.round(rect.top / 8)}`;
      const cs = doc.defaultView.getComputedStyle(host);
      rows.push({
        idx: ++idx,
        side,
        text: txt,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        cx: Math.round(rect.left + rect.width / 2),
        cy: Math.round(rect.top + rect.height / 2),
        source,
        opacity: cs.opacity || "",
        enabled: Number(cs.opacity || "1") > 0.2,
        tail: tailOf(host),
        el: host,
        _key: key
      });
    }

    const bestByKey = new Map();
    for (const row of rows) {
      const prev = bestByKey.get(row._key);
      if (!prev || row.w * row.h > prev.w * prev.h) bestByKey.set(row._key, row);
    }
    return Array.from(bestByKey.values()).sort((a, b) => a.y - b.y || a.x - b.x);
  }

  function pickBestTargets(contexts) {
    let best = null;
    for (const ctx of contexts) {
      const candidates = collectCandidates(ctx.win.document, ctx.source);
      if (!candidates.length) continue;
      const bySide = new Map();
      for (const c of candidates) {
        const prev = bySide.get(c.side);
        let score = 0;
        score += c.source === "top/frame[1]" ? 250 : 0;
        score += c.y > ctx.win.innerHeight * 0.68 ? 200 : 0;
        score += Math.min(c.w * c.h, 60000) / 400;
        if (/zone_bet_bottom|betbox/i.test(c.tail)) score += 300;
        if (/\b1:1\b/.test(c.text)) score += 50;
        if (c.side === "TIE" && /\b1:8\b/.test(c.text)) score += 120;
        if ((c.side === "PLAYER" || c.side === "BANKER") && /\b1:1\b/.test(c.text)) score += 80;
        c._score = score;
        if (!prev || score > prev._score) bySide.set(c.side, c);
      }
      const sides = ["PLAYER", "BANKER", "TIE"].filter((s) => bySide.has(s));
      const totalScore =
        scoreContext(ctx.win.document) +
        sides.reduce((sum, s) => sum + bySide.get(s)._score, 0) +
        (sides.length * 500);
      const result = {
        source: ctx.source,
        href: ctx.href,
        score: totalScore,
        targets: {
          PLAYER: bySide.get("PLAYER") || null,
          BANKER: bySide.get("BANKER") || null,
          TIE: bySide.get("TIE") || null
        },
        doc: ctx.win.document
      };
      if (!best || result.score > best.score) best = result;
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

  function renderTargets(result) {
    if (!result || !result.doc) return;
    const root = ensureOverlay(result.doc);
    const colors = {
      PLAYER: "#2d8cff",
      BANKER: "#ff3b30",
      TIE: "#8bc34a"
    };
    for (const side of ["PLAYER", "BANKER", "TIE"]) {
      const t = result.targets[side];
      if (!t) continue;
      addBox(result.doc, root, t.x, t.y, t.w, t.h, colors[side], side);
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

  function normalizeSide(side) {
    const s = normSpace(side).toUpperCase();
    if (s === "P" || s === "PLAYER") return "PLAYER";
    if (s === "B" || s === "BANKER") return "BANKER";
    if (s === "T" || s === "TIE" || s === "HOA" || s === "HÒA") return "TIE";
    return null;
  }

  function listTargets() {
    const contexts = [];
    walkSameOriginFrames(window.top, "top", contexts);
    const contextRows = contexts.map((ctx) => ({
      source: ctx.source,
      href: ctx.href,
      score: scoreContext(ctx.win.document)
    }));
    const result = pickBestTargets(contexts);
    console.log(`${TAG} contexts=`);
    console.table(contextRows);
    console.log(`${TAG} result=`, result ? {
      source: result.source,
      href: result.href,
      score: result.score
    } : null);
    if (!result) {
      window.__abx_bet_target_result = { contexts: contextRows, targets: null };
      return window.__abx_bet_target_result;
    }
    renderTargets(result);
    const targets = ["PLAYER", "BANKER", "TIE"]
      .map((side) => {
        const t = result.targets[side];
        return t ? {
          side,
          x: t.x,
          y: t.y,
          w: t.w,
          h: t.h,
          enabled: t.enabled,
          opacity: t.opacity,
          source: t.source,
          text: t.text,
          tail: t.tail
        } : null;
      })
      .filter(Boolean);
    console.log(`${TAG} targets=`);
    console.table(targets);
    window.__abx_bet_target_result = {
      contexts: contextRows,
      source: result.source,
      href: result.href,
      score: result.score,
      targets
    };
    return window.__abx_bet_target_result;
  }

  function focusTarget(side) {
    const want = normalizeSide(side);
    if (!want) {
      console.warn(`${TAG} invalid side`, side);
      return null;
    }
    const contexts = [];
    walkSameOriginFrames(window.top, "top", contexts);
    const result = pickBestTargets(contexts);
    if (!result || !result.targets[want]) {
      console.warn(`${TAG} target not found`, want);
      return null;
    }
    renderTargets(result);
    const t = result.targets[want];
    addBox(result.doc, ensureOverlay(result.doc), t.x, t.y, t.w, t.h, "#ffd54f", `FOCUS ${want}`);
    const out = {
      side: want,
      source: t.source,
      text: t.text,
      tail: t.tail,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h
    };
    console.log(`${TAG} focus=`, out);
    return out;
  }

  function clickTarget(side) {
    const want = normalizeSide(side);
    if (!want) {
      console.warn(`${TAG} invalid side`, side);
      return null;
    }
    const contexts = [];
    walkSameOriginFrames(window.top, "top", contexts);
    const result = pickBestTargets(contexts);
    if (!result || !result.targets[want]) {
      console.warn(`${TAG} target not found`, want);
      return null;
    }
    renderTargets(result);
    const t = result.targets[want];
    addBox(result.doc, ensureOverlay(result.doc), t.x, t.y, t.w, t.h, "#ffeb3b", `CLICK ${want}`);
    fireClick(result.doc.defaultView, t.el);
    const out = {
      side: want,
      source: t.source,
      text: t.text,
      tail: t.tail,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h
    };
    console.log(`${TAG} click=`, out);
    window.__abx_bet_target_last_click = out;
    return out;
  }

  window.__abx_list_bet_targets = listTargets;
  window.__abx_focus_bet_target = focusTarget;
  window.__abx_click_bet_target = clickTarget;
  window.__abx_bet_target_clear = clearOverlay;

  console.log(`${TAG} ready`);
  console.log("__abx_list_bet_targets()");
  console.log("__abx_focus_bet_target('BANKER')");
  console.log("__abx_click_bet_target('BANKER')");
  console.log("__abx_bet_target_clear()");
})();
