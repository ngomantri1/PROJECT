// This bridge intentionally reads only the unchanged legacy reader.
// No DOM-road or network result inference is performed here.
(() => {
  const post = (type, payload) => window.postMessage({ source: "bca-page-probe", type, payload }, "*");
  let lastKey = "";

  function query(selector) {
    try { return Boolean(document.querySelector(selector)); } catch (_) { return false; }
  }

  function gameScore() {
    let score = 0;
    if (query("#beadBPRoad,.road_bead,.road_grid")) score += 1000;
    if (query("#betBoxPlayer,#betBoxBanker,#betBoxTie,[id*=betBox],.zone_bet_bottom")) score += 1000;
    if (query("#processStatus,#processBar.info_status p#processStatus")) score += 700;
    if (query("#processBar,.info_status")) score += 700;
    if (query(".game_main,#themeZone .game_main")) score += 500;
    if (query(".zone_bet,.zone_bet_bottom,.zone_bet_top")) score += 500;
    if (query("#themeZone.game,#themeZone.game.baccarat_normal,#themeZone.game\\.baccarat_normal,#themeZone")) score += 350;
    try {
      if (window.cc && window.cc.director && window.cc.director.getScene) score += 300;
      score += Math.min(500, document.querySelectorAll("canvas").length * 120);
    } catch (_) {}
    return score;
  }

  function readLegacySnapshot() {
    const score = gameScore();
    if (score < 1200 && !/\/player\/(?:webMain|singleBacTable|gamehall)\.jsp/i.test(location.pathname)) return;

    try {
      if (typeof window.__cw_startPush === "function") window.__cw_startPush(360);
      const snapshot = typeof window.__cw_readSnapshot === "function"
        ? window.__cw_readSnapshot()
        : window.__cw_last_panel_snapshot;
      const sequence = String(snapshot?.seq ?? "").replace(/[^BPT]/g, "");
      if (!sequence) return;

      const tableName = String(snapshot?.seqTableName ?? snapshot?.tableName ?? "") || null;
      let tableId = String(snapshot?.seqTableId ?? snapshot?.tableId ?? "") || null;
      if (!tableId && tableName) {
        const match = tableName.match(/\bC\s*0*(\d{1,3})\b/i);
        if (match) tableId = String(1000 + Number(match[1]));
      }
      const payload = {
        tableId,
        tableName,
        sequence,
        sequenceVersion: Number(snapshot?.seqVersion ?? 0),
        sequenceEvent: String(snapshot?.seqEvent ?? ""),
        contextScore: Number(snapshot?.contextScore ?? score) || score,
        href: String(snapshot?.dataHref ?? snapshot?.href ?? location.href),
        framePath: String(snapshot?.dataFramePath ?? snapshot?.framePath ?? ""),
        observedAtUtc: new Date().toISOString()
      };
      const key = `${payload.sequenceVersion}|${payload.sequenceEvent}|${payload.sequence}|${payload.href}`;
      if (key === lastKey) return;
      lastKey = key;
      post("legacy_snapshot", payload);
    } catch (_) {}
  }

  setTimeout(readLegacySnapshot, 400);
  setInterval(readLegacySnapshot, 360);
})();
