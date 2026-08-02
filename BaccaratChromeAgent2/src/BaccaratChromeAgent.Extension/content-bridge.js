// Read-only bridge for the selected legacy snapshot in this frame.
const frameKey = `${location.origin}${location.pathname}`;
let legacySnapshot = null;
const recoveryProbeRequests = new Map();
const RECOVERY_PROBE_TIMEOUT_MS = 1800;

function isShown(element) {
  try {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 100 && rect.height > 80 &&
      style.display !== "none" && style.visibility !== "hidden";
  } catch (_) { return false; }
}

function findProviderFrame(id, pageNames) {
  try {
    const names = Array.isArray(pageNames) ? pageNames : [pageNames];
    const matchesProviderPage = (frame) => {
      const src = String(frame?.getAttribute("src") || frame?.src || "").toLowerCase();
      return names.some((pageName) => src.includes(String(pageName).toLowerCase()));
    };
    const byId = document.getElementById(id);
    // iframeGame can stay visible while its src has changed to the hall. Its
    // id alone must never classify that hall as a live Baccarat table.
    if (byId && matchesProviderPage(byId)) return byId;
    const frames = document.querySelectorAll("iframe,frame");
    for (const frame of frames) {
      if (matchesProviderPage(frame)) return frame;
    }
  } catch (_) {}
  return null;
}

function sendRecoveryBridgeDiagnostic(event, detail = {}) {
  chrome.runtime.sendMessage({
    type: "probe_diagnostic",
    payload: {
      event,
      href: location.href,
      framePath: frameKey,
      ...detail,
      observedAtUtc: new Date().toISOString()
    }
  }).catch(() => {});
}

// Đây là heartbeat độc lập với legacy push. Khi singleBacTable bị treo/ẩn,
// legacy tick có thể vẫn nhỏ giọt từ frame cũ nên không thể dùng tick để biết
// game còn sống. Content script chạy trong từng frame và biết chính xác URL
// frame hiện tại, vì vậy GAME_HALL là điểm điều hướng đáng tin cậy để vào lại bàn.
function readFrameRecoveryContext() {
  try {
    const href = String(location.href || "");
    const lowHref = href.toLowerCase();
    // URL của frame con là đủ để log/debug; trạng thái sống/chết chỉ được
    // service worker chấp nhận từ webMain có iframe controller bên dưới.
    const gameFrame = findProviderFrame("iframeGame", ["singlebactable.jsp"]);
    const hallFrame = findProviderFrame("iframeGameHall", ["gamehall.jsp", "gamehallbacktogame.jsp"]);
    const gameVisible = isShown(gameFrame);
    const hallVisible = isShown(hallFrame);
    let kind = "";

    if (/\/player\/singlebactable\.jsp/i.test(lowHref)) kind = "GAME_TABLE";
    else if (/\/player\/gamehall(?:backtogame)?\.jsp/i.test(lowHref)) kind = "GAME_HALL";
    else if (gameVisible) kind = "GAME_TABLE";
    else if (hallVisible) kind = "GAME_HALL";
    else if (/\/player\/webmain\.jsp/i.test(lowHref) || gameFrame || hallFrame) kind = "PROVIDER_ENTRY";
    if (!kind) return null;

    return {
      kind,
      href,
      controller: gameFrame || hallFrame ? 1 : 0,
      isProviderController: gameFrame || hallFrame ? 1 : 0,
      gameFrameVisible: gameVisible ? 1 : 0,
      hallFrameVisible: hallVisible ? 1 : 0,
      gameFrameHref: String(gameFrame?.getAttribute("src") || gameFrame?.src || ""),
      hallFrameHref: String(hallFrame?.getAttribute("src") || hallFrame?.src || "")
    };
  } catch (error) {
    sendRecoveryBridgeDiagnostic("recovery-frame-context-read-error", {
      error: String(error?.message ?? error)
    });
    return null;
  }
}

sendRecoveryBridgeDiagnostic("recovery-frame-context-bridge-boot");

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

function sendLegacySeqDiagnostic(value) {
  try {
    chrome.runtime.sendMessage({
      type: "probe_diagnostic",
      payload: {
        event: "seq-diag",
        reason: String(value?.reason ?? ""),
        rev: String(value?.rev ?? ""),
        session: String(value?.session ?? ""),
        data: value?.data ?? {},
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
    else if (value?.abx === "seq_diag") sendLegacySeqDiagnostic(value);
    else if (value?.abx === "table_recovery_needed") {
      chrome.runtime.sendMessage({
        type: "legacy_recovery_needed",
        payload: {
          recovery: value,
          href: location.href,
          framePath: frameKey,
          observedAtUtc: new Date().toISOString()
        }
      }).catch(() => {});
    }
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
  if (event.data?.source === "bca-webview-compat" && event.data.type === "legacy_raw_message") {
    receiveLegacyRaw(event.data.rawMessage);
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

  if (event.data?.abx === "seq_diag") {
    sendLegacySeqDiagnostic(event.data);
    return;
  }

  if (event.source !== window) return;

  // Temporary diagnostics fallback only. It is not the primary Desktop path.
  if (event.data?.source === "bca-page-probe" && event.data.type === "legacy_snapshot") {
    legacySnapshot = event.data.payload;
    sendSnapshot();
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "bca-legacy-recovery-result") return;
  const commandId = String(event.data?.commandId ?? "");
  const pendingProbe = recoveryProbeRequests.get(commandId);
  if (pendingProbe) {
    recoveryProbeRequests.delete(commandId);
    clearTimeout(pendingProbe.timeout);
    const context = event.data?.result ?? null;
    pendingProbe.sendResponse({
      ok: Boolean(context?.ok ?? context?.kind),
      context,
      href: location.href,
      framePath: frameKey,
      source: "main-world-detect",
      observedAtUtc: new Date().toISOString()
    });
    return;
  }
  chrome.runtime.sendMessage({
    type: "legacy_recovery_result",
    payload: {
      commandId,
      command: String(event.data?.command ?? ""),
      result: event.data?.result ?? null,
      href: location.href,
      observedAtUtc: new Date().toISOString()
    }
  }).catch(() => {});
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "bca-legacy-top-context") return;
  chrome.runtime.sendMessage({
    type: "legacy_top_context",
    payload: {
      context: event.data?.context ?? {},
      href: location.href,
      observedAtUtc: String(event.data?.observedAtUtc ?? new Date().toISOString())
    }
  }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "probe_recovery_context") {
    // Use the exact MAIN-world API used by recovery detect. The isolated
    // world cannot reliably observe provider frame visibility, which caused
    // false PROVIDER_ENTRY misses while the same controller reported
    // GAME_TABLE to execute_legacy_recovery.
    const commandId = `probe-${crypto.randomUUID()}`;
    const timeout = setTimeout(() => {
      const pendingProbe = recoveryProbeRequests.get(commandId);
      if (!pendingProbe) return;
      recoveryProbeRequests.delete(commandId);
      pendingProbe.sendResponse({
        ok: false,
        context: { kind: "NO_RESPONSE", reason: "main-world-detect-timeout" },
        href: location.href,
        framePath: frameKey,
        source: "main-world-detect",
        observedAtUtc: new Date().toISOString()
      });
    }, RECOVERY_PROBE_TIMEOUT_MS);
    recoveryProbeRequests.set(commandId, { sendResponse, timeout });
    window.postMessage({
      source: "bca-content-bridge",
      type: "execute_legacy_recovery",
      payload: { commandId, command: "detect", request: {} }
    }, "*");
    return true;
  }
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
  if (message.type === "execute_legacy_recovery") {
    // legacy-push-start.js owns the recovery API in MAIN world. Native
    // Messaging reaches this isolated script first, so explicitly bridge it.
    window.postMessage({
      source: "bca-content-bridge",
      type: "execute_legacy_recovery",
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
