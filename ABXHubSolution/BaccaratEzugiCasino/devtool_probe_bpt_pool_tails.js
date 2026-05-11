(() => {
  "use strict";

  const TAILS = {
    BANKER: "div#main-bets > div.css-1o2wumy:nth-of-type(3)",
    PLAYER: "div#main-bets > div.css-1or1crx:nth-of-type(1)",
    TIE: "div#statistics > div.users-amount-container > div.statistics-amount-container:nth-of-type(2)"
  };
  const TIE_ALT_TAILS = [
    "div#main-bets > div:nth-of-type(2)"
  ];

  function parseMoneyToken(tok) {
    const t = String(tok || "").trim().toUpperCase();
    if (!t) return null;
    const m = t.match(/^(\d+(?:[.,]\d+)?)([KMB])?$/i);
    if (!m) return null;
    const n = Number(String(m[1]).replace(/,/g, "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    const u = String(m[2] || "").toUpperCase();
    const mul = u === "K" ? 1e3 : u === "M" ? 1e6 : u === "B" ? 1e9 : 1;
    return Math.round(n * mul);
  }

  function extractMoney(text) {
    const txt = String(text || "").replace(/\u00A0/g, " ");
    if (!txt) return null;
    const re = /\d+(?:[.,]\d+)?\s*[KMB]\b|\d{1,3}(?:[,\s]\d{3})+|\d{4,}/g;
    let best = null;
    let m;
    while ((m = re.exec(txt)) !== null) {
      const token = String(m[0] || "").trim();
      if (!token) continue;
      const idx = Number(m.index || 0);
      const prev = idx > 0 ? txt.charAt(idx - 1) : "";
      const next = txt.charAt(idx + token.length);
      if (prev === ":" || next === ":") continue;
      const v = parseMoneyToken(token.replace(/\s+/g, ""));
      if (v == null || v < 1000 || v > 200000000) continue;
      let score = v;
      if (/[KMB]/i.test(token)) score += 1000000;
      if (/[.,]/.test(token)) score += 250000;
      if (!best || score > best._score) best = { token, value: v, _score: score };
    }
    return best ? { token: best.token, value: best.value } : null;
  }

  function readSideBySelector(side, selector) {
    if (!selector) return null;
    let el = null;
    try { el = document.querySelector(selector); } catch (_) { el = null; }
    if (!el) return null;

    let stake = extractMoney(el.innerText || el.textContent || "");
    if ((!stake || stake.value == null) && el.querySelectorAll) {
      const leaves = el.querySelectorAll("span,p,div,b,strong,label,small");
      let best = null;
      for (let i = 0; i < leaves.length && i < 80; i++) {
        const leaf = leaves[i];
        if (!leaf) continue;
        const st = extractMoney(leaf.innerText || leaf.textContent || "");
        if (!st || st.value == null) continue;
        let score = Number(st.value || 0);
        const cls = String(leaf.className || "");
        if (/amount|pool|stake|money|users-amount|statistics/i.test(cls)) score += 800000;
        if (!best || score > best._score) best = { value: st.value, token: st.token, _score: score };
      }
      if (best) stake = { value: best.value, token: best.token };
    }
    if (!stake || stake.value == null) return null;

    return { side, value: stake.value, raw: stake.token, tail: selector };
  }

  function readSide(side) {
    if (side !== "TIE") return readSideBySelector(side, TAILS[side]);

    const picks = [TAILS.TIE, ...TIE_ALT_TAILS]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .map((sel) => readSideBySelector("TIE", sel))
      .filter(Boolean);

    if (!picks.length) return null;
    return picks[0];
  }

  function scanOnce() {
    const bySide = {
      BANKER: readSide("BANKER"),
      PLAYER: readSide("PLAYER"),
      TIE: readSide("TIE")
    };

    if (bySide.TIE && bySide.PLAYER && bySide.TIE.value === bySide.PLAYER.value) {
      for (const sel of TIE_ALT_TAILS) {
        const alt = readSideBySelector("TIE", sel);
        if (alt && alt.value != null && alt.value !== bySide.PLAYER.value) {
          bySide.TIE = alt;
          break;
        }
      }
    }

    const out = {
      ok: !!(bySide.BANKER && bySide.PLAYER && bySide.TIE),
      mode: "preferred-tail-only",
      values: {
        BANKER: bySide.BANKER ? bySide.BANKER.value : null,
        PLAYER: bySide.PLAYER ? bySide.PLAYER.value : null,
        TIE: bySide.TIE ? bySide.TIE.value : null
      },
      tails: {
        BANKER: bySide.BANKER ? bySide.BANKER.tail : "",
        PLAYER: bySide.PLAYER ? bySide.PLAYER.tail : "",
        TIE: bySide.TIE ? bySide.TIE.tail : ""
      },
      patch: {
        TAIL_POOL_BANKER: TAILS.BANKER,
        TAIL_POOL_PLAYER: TAILS.PLAYER,
        TAIL_POOL_TIE: TAILS.TIE
      },
      at: new Date().toISOString()
    };

    console.table([
      { side: "BANKER", value: out.values.BANKER, raw: bySide.BANKER ? bySide.BANKER.raw : "", tail: out.tails.BANKER },
      { side: "PLAYER", value: out.values.PLAYER, raw: bySide.PLAYER ? bySide.PLAYER.raw : "", tail: out.tails.PLAYER },
      { side: "TIE", value: out.values.TIE, raw: bySide.TIE ? bySide.TIE.raw : "", tail: out.tails.TIE }
    ]);
    console.log("[ABX][POOL][BPT][PREFERRED_ONLY]", out);
    console.log("var TAIL_POOL_BANKER = " + JSON.stringify(TAILS.BANKER) + ";");
    console.log("var TAIL_POOL_PLAYER = " + JSON.stringify(TAILS.PLAYER) + ";");
    console.log("var TAIL_POOL_TIE = " + JSON.stringify(TAILS.TIE) + ";");
    return out;
  }

  window.__abx_probe_pool_bpt_tails = scanOnce;
  return scanOnce();
})();
