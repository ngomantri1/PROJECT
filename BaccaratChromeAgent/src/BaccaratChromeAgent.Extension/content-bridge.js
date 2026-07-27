// Read-only bridge for the selected legacy snapshot in this frame.
const frameKey = `${location.origin}${location.pathname}`;
let legacySnapshot = null;

function sendRawLegacyTick(rawTick) {
  if (typeof rawTick !== "string" || !rawTick) return;
  try {
    const tick = JSON.parse(rawTick);
    if (tick?.abx !== "tick") return;
    chrome.runtime.sendMessage({
      type: "legacy_tick",
      payload: {
        rawTick,
        href: location.href,
        framePath: frameKey,
        observedAtUtc: new Date().toISOString()
      }
    }).catch(() => {});
  } catch (_) {}
}

function sendLegacyScout(rawScout) {
  if (typeof rawScout !== "string" || !rawScout) return;
  try {
    const scout = JSON.parse(rawScout);
    if (scout?.abx !== "frame_scout") return;
    chrome.runtime.sendMessage({
      type: "legacy_scout",
      payload: {
        scout,
        href: location.href,
        framePath: frameKey,
        observedAtUtc: new Date().toISOString()
      }
    }).catch(() => {});
  } catch (_) {}
}

function receiveLegacyRaw(raw) {
  if (typeof raw !== "string" || !raw) return;
  try {
    const value = JSON.parse(raw);
    if (value?.abx === "tick") sendRawLegacyTick(raw);
    else if (value?.abx === "frame_scout") sendLegacyScout(raw);
  } catch (_) {}
}

function sendSnapshot() {
  if (!legacySnapshot?.sequence) return;
  const href = legacySnapshot.href || location.href;
  chrome.runtime.sendMessage({
    type: "game_snapshot",
    payload: {
      tableId: legacySnapshot.tableId,
      tableName: legacySnapshot.tableName,
      shoe: null,
      round: null,
      sequence: legacySnapshot.sequence,
      phase: document.visibilityState === "visible" ? "Dang quan sat" : "Frame an",
      progress: null,
      bankerPool: null,
      playerPool: null,
      tiePool: null,
      roadInfo: null,
      diagnostics: {
        frameHref: href,
        isGameFrame: true,
        gameScore: legacySnapshot.contextScore ?? 0,
        roadPacketCount: 0,
        lastRoadPacketAtUtc: null
      },
      observedAtUtc: legacySnapshot.observedAtUtc,
      source: frameKey
    }
  }).catch(() => {});
}

window.addEventListener("message", (event) => {
  if (event.data?.source === "bca-webview-compat" && event.data.type === "legacy_raw_tick") {
    receiveLegacyRaw(event.data.rawTick);
    return;
  }

  // The untouched legacy safePost uses parent.postMessage when Chrome does
  // not permit the WebView compatibility property in a nested game frame.
  // Accept only the original tick contract; no fields are inferred here.
  if (event.data?.abx === "tick") {
    try {
      sendRawLegacyTick(JSON.stringify(event.data));
    } catch (_) {}
    return;
  }

  if (event.data?.abx === "frame_scout") {
    try {
      sendLegacyScout(JSON.stringify(event.data));
    } catch (_) {}
    return;
  }

  if (event.source !== window) return;

  // Temporary diagnostics fallback only. It is not the primary Desktop path.
  if (event.data?.source === "bca-page-probe" && event.data.type === "legacy_snapshot") {
    legacySnapshot = event.data.payload;
    sendSnapshot();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "start_legacy_authority") {
    // postMessage crosses Chrome's ISOLATED -> MAIN world boundary reliably.
    window.postMessage({
      source: "bca-content-bridge",
      type: "start_legacy_authority",
      payload: message.payload ?? {}
    }, "*");
    return;
  }
  if (message.type === "execute_legacy_bet") {
    window.postMessage({
      source: "bca-content-bridge",
      type: "execute_legacy_bet",
      payload: message.payload ?? {}
    }, "*");
    return;
  }
  if (message.type !== "engine_response") return;
  window.dispatchEvent(new CustomEvent("bca-engine-state", { detail: message.payload.display ?? {} }));
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "bca-legacy-authority") return;
  chrome.runtime.sendMessage({
    type: "probe_diagnostic",
    payload: {
      event: "legacy-authority-result",
      result: String(event.data?.result ?? ""),
      attempt: Number(event.data?.attempt ?? 0) || 0,
      hasStartPush: Number(event.data?.hasStartPush ?? 0) || 0,
      hasReadSnapshot: Number(event.data?.hasReadSnapshot ?? 0) || 0,
      bootDone: Number(event.data?.bootDone ?? 0) || 0,
      readyState: String(event.data?.readyState ?? ""),
      contextId: String(event.data?.contextId ?? ""),
      href: location.href,
      observedAtUtc: new Date().toISOString()
    }
  }).catch(() => {});
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "bca-legacy-bet-result") return;
  chrome.runtime.sendMessage({
    type: "legacy_bet_result",
    payload: event.data.payload ?? {}
  }).catch(() => {});
});
