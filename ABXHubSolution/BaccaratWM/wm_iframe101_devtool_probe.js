(() => {
  const isChild = window.self !== window.top;
  const isGameHost = /^games\./i.test(location.hostname || "");
  const isWmHost =
    /(?:^|\.)m8810\.com$/i.test(location.hostname || "") ||
    /^wmvn\./i.test(location.hostname || "") ||
    /(?:^|\/)iframe_(?:101|109)(?:\/|$)/i.test(location.pathname || "") ||
    /[?&]co=wm(?:&|$)/i.test(location.search || "");

  const visibleRect = (el) => {
    try {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? `${Math.round(r.width)}x${Math.round(r.height)}` : "";
    } catch (_) {
      return "";
    }
  };

  const roots = Array.from(document.querySelectorAll('div[id^="groupMultiple_"]'))
    .map((el) => ({
      id: String(el.id || ""),
      size: visibleRect(el),
      player: !!document.getElementById(`${el.id}_lightPlayer`),
      banker: !!document.getElementById(`${el.id}_lightBanker`),
      confirm: !!document.getElementById(`${el.id}_confirm`),
    }))
    .filter((x) => x.id && !/_opencard$/i.test(x.id))
    .slice(0, 12);

  const result = {
    href: location.href,
    host: location.host,
    name: window.name || "",
    isChild,
    isGameHost,
    isWmHost,
    oldGuardWouldReturn: isChild && !isGameHost,
    patchedGuardWouldAllow: !isChild || isGameHost || isWmHost,
    frameGate: window.__cw_frame_gate || null,
    homeRev: window.__cw_home_js_rev || "",
    types: {
      __cw_bet: typeof window.__cw_bet,
      betNormalizeSide: typeof window.betNormalizeSide,
      betResolveRootFromOverlay: typeof window.betResolveRootFromOverlay,
      betFindChipByAmount: typeof window.betFindChipByAmount,
      betBuildChipPlan: typeof window.betBuildChipPlan,
    },
    roots,
  };

  console.table(result.types);
  console.log("[ABX][iframe101 probe]", result);
  return result;
})();
