const NATIVE_HOST_NAME = "com.abx.baccarat_chrome_agent";
let port = null;
const sessions = new Map();
const debugTabs = new Set();
const roadPacketCounts = new Map();
const webSocketFrameCounts = new Map();
const activeTables = new Map();
const activeGameFrames = new Map();
const legacyAuthorities = new Map();

function legacyFrameScore(payload) {
  const href = String(payload?.diagnostics?.frameHref ?? "");
  const score = Number(payload?.diagnostics?.gameScore ?? 0) || 0;
  return score + (String(payload?.sequence ?? "") ? 100 : 0) +
    (/\/player\/singleBacTable\.jsp/i.test(href) ? 500 : 0);
}

function selectLegacyGameFrame(tabId, frameId, payload) {
  const href = String(payload?.diagnostics?.frameHref ?? "");
  const rawScore = Number(payload?.diagnostics?.gameScore ?? 0) || 0;
  if (rawScore < 1200 && !/\/player\/singleBacTable\.jsp/i.test(href)) return false;
  const candidate = {
    frameId,
    score: legacyFrameScore(payload),
    href,
    tableId: String(payload?.tableId ?? "")
  };
  const current = activeGameFrames.get(tabId);
  if (!current || current.frameId === frameId || candidate.score > current.score) {
    activeGameFrames.set(tabId, candidate);
    sendDiagnostic(tabId, "legacy-game-frame-selected", candidate);
    return true;
  }
  return false;
}

function connectNative() {
  if (port) return port;
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    port.onMessage.addListener((message) => {
      if (message?.type === "bet_command") {
        const target = sessions.get(message.sessionId);
        if (!target) return;
        chrome.tabs.sendMessage(target.tabId, {
          type: "execute_legacy_bet",
          payload: message.payload ?? {}
        }, { frameId: target.frameId }).catch((error) => {
          sendDiagnostic(target.tabId, "legacy-bet-delivery-failed", {
            requestId: String(message?.payload?.requestId ?? ""),
            frameId: target.frameId,
            error: String(error?.message ?? error)
          });
        });
        return;
      }
      const target = sessions.get(message.sessionId);
      if (target) {
        chrome.tabs.sendMessage(target.tabId, { type: "engine_response", payload: message.payload }, { frameId: target.frameId }).catch(() => {});
        // Canvas chỉ nằm ở top frame, nhưng snapshot có thể xuất phát từ game iframe.
        if (target.frameId !== 0) {
          chrome.tabs.sendMessage(target.tabId, { type: "engine_response", payload: message.payload }, { frameId: 0 }).catch(() => {});
        }
      }
    });
    port.onDisconnect.addListener(() => { port = null; });
  } catch (_) {
    port = null;
  }
  return port;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeUrl(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/;jsessionid=[^/?#]+/i, ";jsessionid=***")}`;
  } catch (_) { return ""; }
}

function findRoad(root, depth = 0) {
  if (!root || depth > 7) return null;
  if (typeof root === "string") {
    if (!root.includes("winCounts")) return null;
    const start = root.search(/[\[{]/);
    if (start < 0) return null;
    try { return findRoad(JSON.parse(root.slice(start)), depth + 1); } catch (_) { return null; }
  }
  if (Array.isArray(root)) {
    for (const item of root) { const found = findRoad(item, depth + 1); if (found) return found; }
    return null;
  }
  if (typeof root !== "object") return null;
  if (Array.isArray(root.winCounts) && root.winCounts.length >= 3) return root;
  for (const value of Object.values(root)) { const found = findRoad(value, depth + 1); if (found) return found; }
  return null;
}

function latestRoadCode(road) {
  const direct = road.latestRoad ?? road.latestRoadCode ?? road.lastRoad ?? road.lastRoadCode;
  if (Number.isFinite(Number(direct))) return Number(direct);
  const markers = Array.isArray(road.markerRoads) ? road.markerRoads : [];
  let best = null;
  markers.forEach((item, index) => {
    const code = Number(item?.road);
    const stamp = number(item?.stampTime ?? item?.time ?? item?.ts);
    if (!Number.isFinite(code)) return;
    if (!best || stamp > best.stamp || (stamp === best.stamp && index > best.index)) best = { code, stamp, index };
  });
  return best?.code ?? null;
}

function parseRoadInfo(payload) {
  if (typeof payload !== "string" || !payload.includes("winCounts")) return null;
  const start = payload.search(/[\[{]/);
  if (start < 0) return null;
  try {
    const road = findRoad(JSON.parse(payload.slice(start)));
    if (!road) return null;
    return {
      tableId: String(road.tableID ?? road.tableId ?? road.tableNo ?? "") || null,
      shoe: String(road.gameShoe ?? road.currentGameShoe ?? road.shoe ?? road.shoeNo ?? "") || null,
      round: number(road.gameRound ?? road.currentGameRound ?? road.round ?? road.roundNo ?? road.roundId) || null,
      bankerCount: Math.max(0, number(road.winCounts[0])),
      playerCount: Math.max(0, number(road.winCounts[1])),
      tieCount: Math.max(0, number(road.winCounts[2])),
      latestRoadCode: latestRoadCode(road),
      observedAtUtc: new Date().toISOString()
    };
  } catch (_) { return null; }
}

async function ensureNetworkDebugger(tabId) {
  if (debugTabs.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");
    debugTabs.add(tabId);
    sendDiagnostic(tabId, "debugger-attached", { domain: "Network" });
  } catch (error) {
    sendDiagnostic(tabId, "debugger-attach-failed", { error: String(error?.message ?? error) });
    // Có thể DevTools khác đang attach; DOM collector vẫn tiếp tục hoạt động read-only.
  }
}

function sendDiagnostic(tabId, event, detail = {}) {
  connectNative()?.postMessage({
    type: "diagnostic",
    sessionId: String(tabId),
    payload: { event, ...detail, observedAtUtc: new Date().toISOString() }
  });
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  const tabId = source.tabId;
  if (tabId === undefined) return;

  if (method === "Network.webSocketCreated") {
    sendDiagnostic(tabId, "websocket-created", { url: safeUrl(params?.url) });
    return;
  }

  if (method === "Network.webSocketFrameError" || method === "Network.webSocketClosed") {
    sendDiagnostic(tabId, method, { requestId: params?.requestId ?? "" });
    return;
  }

  if (method !== "Network.webSocketFrameReceived") return;
  const frameCount = (webSocketFrameCounts.get(tabId) ?? 0) + 1;
  webSocketFrameCounts.set(tabId, frameCount);
  const payloadData = params?.response?.payloadData;
  const payloadText = typeof payloadData === "string" ? payloadData : "";
  const hasWinCounts = payloadText.includes("winCounts");
  if (frameCount <= 3 || frameCount % 25 === 0 || hasWinCounts) {
    sendDiagnostic(tabId, "websocket-frame", {
      count: frameCount,
      opcode: params?.response?.opcode ?? null,
      payloadLength: payloadText.length,
      hasWinCounts
    });
  }

  const roadInfo = parseRoadInfo(params?.response?.payloadData);
  if (!roadInfo || !sessions.has(String(tabId))) return;
  const activeTableId = String(activeTables.get(tabId) ?? "");
  if (!activeTableId || String(roadInfo.tableId ?? "") !== activeTableId) return;

  const count = (roadPacketCounts.get(tabId) ?? 0) + 1;
  roadPacketCounts.set(tabId, count);
  const nativePort = connectNative();
  nativePort?.postMessage({
    type: "game_snapshot",
    sessionId: String(tabId),
    payload: {
      tableId: roadInfo.tableId,
      tableName: null,
      shoe: roadInfo.shoe,
      round: roadInfo.round,
      sequence: "",
      phase: "Network roadInfo",
      progress: null,
      bankerPool: null,
      playerPool: null,
      tiePool: null,
      roadInfo,
      diagnostics: { frameHref: "chrome-debugger", isGameFrame: true, roadPacketCount: count, lastRoadPacketAtUtc: roadInfo.observedAtUtc },
      observedAtUtc: roadInfo.observedAtUtc
    }
  });
});

chrome.debugger.onDetach.addListener((source) => {
  debugTabs.delete(source.tabId);
  webSocketFrameCounts.delete(source.tabId);
  roadPacketCounts.delete(source.tabId);
  if (source.tabId !== undefined) sendDiagnostic(source.tabId, "debugger-detached");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    activeTables.delete(tabId);
    activeGameFrames.delete(tabId);
    roadPacketCounts.delete(tabId);
    legacyAuthorities.delete(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "ensure_debugger") {
    if (sender.tab?.id !== undefined) ensureNetworkDebugger(sender.tab.id);
    return;
  }
  if (message.type === "probe_diagnostic") {
    if (sender.tab?.id !== undefined) {
      connectNative()?.postMessage({ type: "diagnostic", sessionId: String(sender.tab.id), payload: message.payload });
    }
    return;
  }
  if (message.type === "legacy_scout") {
    const tabId = sender.tab?.id;
    const frameId = sender.frameId ?? 0;
    const scout = message.payload?.scout;
    const score = Number(scout?.score ?? 0) || 0;
    const contextId = String(scout?.contextId ?? "");
    if (tabId === undefined || !contextId || score < 1200) return;

    const href = String(scout?.href ?? "");
    const preferredScore = score + (/\/player\/singleBacTable\.jsp/i.test(href) ? 1200 : 0);
    const current = legacyAuthorities.get(tabId);
    const sameContext = current?.frameId === frameId && current?.contextId === contextId;
    if (sameContext) return;
    // Keep one stable authority. webMain can proxy the game and report a high
    // score, but the original data owner is singleBacTable.
    if (current && preferredScore <= current.preferredScore + 250) return;

    const authority = { frameId, contextId, score, preferredScore, token: crypto.randomUUID() };
    legacyAuthorities.set(tabId, authority);
    sendDiagnostic(tabId, "legacy-authority-selected", {
      frameId,
      contextId,
      score,
      preferredScore,
      href
    });
    chrome.tabs.sendMessage(tabId, {
      type: "start_legacy_authority",
      payload: { contextId: authority.contextId, token: authority.token }
    }, { frameId }).catch((error) => {
      sendDiagnostic(tabId, "legacy-authority-delivery-failed", { frameId, error: String(error?.message ?? error) });
    });
    return;
  }
  if (message.type === "legacy_tick") {
    const rawTick = String(message.payload?.rawTick ?? "");
    let tick;
    try { tick = JSON.parse(rawTick); } catch (_) { return; }
    if (tick?.abx !== "tick") return;

    const nativePort = connectNative();
    const tabId = sender.tab?.id;
    const frameId = sender.frameId ?? 0;
    const selectionPayload = {
      tableId: String(tick.seqTableId ?? tick.tableId ?? ""),
      tableName: String(tick.seqTableName ?? tick.tableName ?? ""),
      sequence: String(tick.seq ?? ""),
      diagnostics: {
        frameHref: String(message.payload?.href ?? ""),
        isGameFrame: true,
        gameScore: Number(tick.contextScore ?? 0) || 0
      }
    };

    if (tabId !== undefined && !selectLegacyGameFrame(tabId, frameId, selectionPayload)) return;
    if (tabId !== undefined && selectionPayload.tableId && !activeTables.has(tabId)) {
      activeTables.set(tabId, selectionPayload.tableId);
      sendDiagnostic(tabId, "active-table-selected", { tableId: selectionPayload.tableId });
    }

    const sessionId = `${tabId ?? "unknown"}`;
    if (tabId !== undefined) sessions.set(sessionId, { tabId, frameId });
    if (!nativePort) return;
    nativePort.postMessage({
      type: "legacy_tick",
      sessionId,
      payload: {
        rawTick,
        tabId: tabId ?? null,
        frameId,
        href: String(message.payload?.href ?? ""),
        framePath: String(message.payload?.framePath ?? ""),
        observedAtUtc: String(message.payload?.observedAtUtc ?? new Date().toISOString())
      }
    });
    return;
  }

  if (message.type === "legacy_bet_result") {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    connectNative()?.postMessage({
      type: "bet_result",
      sessionId: String(tabId),
      payload: message.payload ?? {}
    });
    return;
  }

  if (message.type !== "game_snapshot" && message.type !== "ping" && message.type !== "stop") return;

  const nativePort = connectNative();
  // Một tab game có wrapper + nhiều iframe. Engine cần nhìn chúng như một phiên chung.
  const sessionId = `${sender.tab?.id ?? "unknown"}`;
  const tabId = sender.tab?.id;
  const snapshotTableId = String(message.payload?.tableId ?? "");
  const frameId = sender.frameId ?? 0;
  if (message.type === "game_snapshot" && !String(message.payload?.sequence ?? "")) return;
  if (message.type === "game_snapshot" && tabId !== undefined &&
      !selectLegacyGameFrame(tabId, frameId, message.payload)) return;
  const roadTableId = String(message.payload?.roadInfo?.tableId ?? "");
  const isNamedBaccaratTable = /^Baccarat\s+C\d+/i.test(String(message.payload?.tableName ?? ""));
  if (tabId !== undefined && snapshotTableId && !activeTables.has(tabId) &&
      (message.payload?.diagnostics?.isGameFrame || isNamedBaccaratTable)) {
    activeTables.set(tabId, snapshotTableId);
    sendDiagnostic(tabId, "active-table-selected", { tableId: snapshotTableId });
  }
  const activeTableId = tabId === undefined ? "" : String(activeTables.get(tabId) ?? "");
  if (message.type === "game_snapshot" && activeTableId && roadTableId && roadTableId !== activeTableId) {
    return;
  }
  if (sender.tab?.id !== undefined) sessions.set(sessionId, { tabId: sender.tab.id, frameId });
  if (!nativePort) {
    chrome.tabs.sendMessage(sender.tab?.id ?? 0, {
      type: "engine_response",
      payload: { display: { connection: "disconnected", status: "Chưa kết nối Native Host" } }
    }).catch(() => {});
    return;
  }

  nativePort.postMessage({
    type: message.type,
    sessionId,
    payload: message.payload,
    tabId: sender.tab?.id,
    frameId: sender.frameId
  });
});
