const NATIVE_HOST_NAME = "com.abx.baccarat_chrome_agent";
let port = null;
let watchdogPulseLogged = false;
const sessions = new Map();
const debugTabs = new Set();
const roadPacketCounts = new Map();
const webSocketFrameCounts = new Map();
const activeTables = new Map();
const activeGameFrames = new Map();
const legacyAuthorities = new Map();
// Recovery bookmark sống lâu hơn một lần navigation. activeTables dùng cho
// packet network hiện tại nên có thể reset; bookmark mới là bàn cần quay lại.
const recoveryBookmarks = new Map();
const recoveryEntryUrls = new Map();
const recoveryWrapperUrls = new Map();
const recoveryFlows = new Map();
const recoveryControllers = new Map();
const recoveryProviderContexts = new Map();
const lastGameTableContextAt = new Map();
const lastRecoveryStartAt = new Map();
const recoveryCheckLockedUntil = new Map();
const recoveryWatchLogAt = new Map();
const recoveryProbeStates = new Map();
const recoveryProbeInFlight = new Set();
const lastRecoveryReloadAt = new Map();
const RECOVERY_RETRY_DELAY_MS = 1200;
const RECOVERY_GAME_CONTEXT_WAIT_MS = 12000;
const RECOVERY_MAX_ATTEMPTS = 3;
const RECOVERY_MISS_LIMIT = 3;
const RECOVERY_START_COOLDOWN_MS = 10000;
const RECOVERY_CHECK_LOCK_MS = 10000;
const RECOVERY_COMMAND_TIMEOUT_MS = 5000;
const RECOVERY_ENTRY_NAVIGATION_WAIT_MS = 3000;
const RECOVERY_RELOAD_SETTLE_MS = 1000;
const RECOVERY_RELOAD_WAIT_MS = 15000;
const RECOVERY_RELOAD_COOLDOWN_MS = 10000;
const RECOVERY_BOOKMARK_STORAGE_PREFIX = "bca-recovery-bookmark:";
const RECOVERY_GAME_CONTEXT_STORAGE_PREFIX = "bca-game-table-context:";
const RECOVERY_ENTRY_URL_STORAGE_PREFIX = "bca-recovery-entry-url:";
const RECOVERY_WRAPPER_URL_STORAGE_PREFIX = "bca-recovery-wrapper-url:";

function sendRecoveryWatchLog(tabId, event, detail = {}, minIntervalMs = 3000) {
  const now = Date.now();
  const byEvent = recoveryWatchLogAt.get(tabId) ?? {};
  if (now - Number(byEvent[event] ?? 0) < minIntervalMs) return;
  byEvent[event] = now;
  recoveryWatchLogAt.set(tabId, byEvent);
  sendDiagnostic(tabId, event, detail);
}

function recoveryStorageKey(prefix, tabId) {
  return `${prefix}${tabId}`;
}

function saveRecoverySessionValue(key, value) {
  try { chrome.storage.session.set({ [key]: value }).catch(() => {}); } catch (_) {}
}

async function loadRecoverySessionValue(key) {
  try {
    const result = await chrome.storage.session.get(key);
    return result?.[key] ?? null;
  } catch (_) { return null; }
}

function clearRecoverySessionValue(key) {
  try { chrome.storage.session.remove(key).catch(() => {}); } catch (_) {}
}

function rememberRecoveryEntry(tabId, href) {
  const entryUrl = String(href ?? "");
  if (!/\/player\/webMain\.jsp/i.test(entryUrl)) return;
  if (recoveryEntryUrls.get(tabId) === entryUrl) return;
  recoveryEntryUrls.set(tabId, entryUrl);
  saveRecoverySessionValue(recoveryStorageKey(RECOVERY_ENTRY_URL_STORAGE_PREFIX, tabId), entryUrl);
}

function isRecoveryWrapperUrl(href) {
  try {
    const url = new URL(String(href ?? ""));
    if (!/^https?:$/i.test(url.protocol)) return false;
    const lowPath = String(url.pathname ?? "").toLowerCase();
    if (/\/player\//i.test(lowPath) || /\/error(?:\/|$)/i.test(lowPath)) return false;
    return /\/home\/thirdg\.html$/i.test(lowPath) ||
      /(^|\.)new\.wencheng\.cc$/i.test(String(url.hostname ?? ""));
  } catch (_) { return false; }
}

function rememberRecoveryWrapper(tabId, href) {
  const wrapperUrl = String(href ?? "");
  if (!isRecoveryWrapperUrl(wrapperUrl)) return;
  if (recoveryWrapperUrls.get(tabId) === wrapperUrl) return;
  recoveryWrapperUrls.set(tabId, wrapperUrl);
  saveRecoverySessionValue(recoveryStorageKey(RECOVERY_WRAPPER_URL_STORAGE_PREFIX, tabId), wrapperUrl);
  sendRecoveryWatchLog(tabId, "recovery-wrapper-remembered", {
    href: safeUrl(wrapperUrl)
  }, 10000);
}

async function getRecoveryWrapper(tabId) {
  let wrapperUrl = recoveryWrapperUrls.get(tabId) ?? "";
  if (!wrapperUrl) {
    wrapperUrl = String(await loadRecoverySessionValue(
      recoveryStorageKey(RECOVERY_WRAPPER_URL_STORAGE_PREFIX, tabId)
    ) ?? "");
    if (wrapperUrl) recoveryWrapperUrls.set(tabId, wrapperUrl);
  }
  return isRecoveryWrapperUrl(wrapperUrl) ? wrapperUrl : "";
}

function armRecoveryFromGameTick(tabId) {
  let state = recoveryProbeStates.get(tabId);
  if (!state) {
    state = { misses: 0, lastKind: "", armed: false, lastProbeAt: 0 };
    recoveryProbeStates.set(tabId, state);
  }
  if (state.armed) return;
  state.armed = true;
  state.misses = 0;
  lastGameTableContextAt.set(tabId, Date.now());
  saveRecoverySessionValue(recoveryStorageKey(RECOVERY_GAME_CONTEXT_STORAGE_PREFIX, tabId), Date.now());
  sendDiagnostic(tabId, "recovery-armed-game-tick", { source: "legacy-game-authority" });
}

function resetRecoveryMisses(tabId, reason) {
  const state = recoveryProbeStates.get(tabId);
  if (!state) return;
  state.misses = 0;
  state.lastKind = "";
  sendRecoveryWatchLog(tabId, "recovery-misses-reset", { reason }, 900);
}

function completeRecoveryFromGameTick(tabId, frameId, href) {
  const flow = recoveryFlows.get(tabId);
  if (!flow || flow.state !== "wait-game-context" ||
      Date.now() < Number(flow.gameContextNotBefore ?? Number.MAX_SAFE_INTEGER)) return;
  clearRecoveryCommandTimeout(flow);
  resetRecoveryMisses(tabId, "authority-tick-after-load-table");
  recoveryFlows.delete(tabId);
  sendDiagnostic(tabId, "recovery-success-game-tick", {
    request: flow.request,
    frameId,
    href: safeUrl(href)
  });
}

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
    port.postMessage({
      type: "diagnostic",
      sessionId: "runtime",
      payload: {
        event: "runtime-ready",
        extensionVersion: String(chrome.runtime.getManifest().version ?? ""),
        observedAtUtc: new Date().toISOString()
      }
    });
    port.onMessage.addListener((message) => {
      if (message?.type === "watchdog_pulse") {
        if (!watchdogPulseLogged) {
          watchdogPulseLogged = true;
          port?.postMessage({
            type: "diagnostic",
            sessionId: "watchdog",
            payload: {
              event: "watchdog-pulse-received",
              sequence: Number(message?.payload?.sequence ?? 0),
              observedAtUtc: new Date().toISOString()
            }
          });
        }
        void runRecoveryProbeCycle(message.payload ?? {});
        return;
      }
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

function tableCode(value) {
  const match = String(value ?? "").match(/\bC\s*0*(\d{1,3})\b/i);
  return match ? `C${String(Number(match[1])).padStart(2, "0")}` : "";
}

function makeRecoveryBookmark(tick, fallback = {}) {
  const tableId = String(tick?.seqTableId ?? tick?.tableId ?? fallback.tableId ?? "");
  const tableName = String(tick?.seqTableName ?? tick?.tableName ?? fallback.tableName ?? "");
  const code = String(fallback.tableCode ?? tableCode(tableName) ?? "").toUpperCase();
  return { tableId, tableName, tableCode: code };
}

function bookmarkMatchesTick(bookmark, tick) {
  if (!bookmark) return false;
  const candidate = makeRecoveryBookmark(tick);
  if (bookmark.tableId && candidate.tableId) return bookmark.tableId === candidate.tableId;
  if (bookmark.tableCode && candidate.tableCode) return bookmark.tableCode === candidate.tableCode;
  return Boolean(bookmark.tableName && candidate.tableName && bookmark.tableName === candidate.tableName);
}

async function findLiveRecoveryController(tabId) {
  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  const topFrame = (frames ?? []).find((frame) => Number(frame?.frameId ?? -1) === 0);
  if (topFrame?.url) rememberRecoveryWrapper(tabId, topFrame.url);
  const candidates = (frames ?? []).filter((frame) =>
    /\/player\/webMain\.jsp/i.test(String(frame?.url ?? "")));
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const aNested = Number(a?.parentFrameId ?? -1) >= 0 ? 1 : 0;
    const bNested = Number(b?.parentFrameId ?? -1) >= 0 ? 1 : 0;
    return bNested - aNested;
  });
  const selected = candidates[0];
  return {
    frameId: Number(selected.frameId),
    href: String(selected.url ?? ""),
    parentFrameId: Number(selected.parentFrameId ?? -1)
  };
}

async function recoverMissingController(flow, command) {
  // Không điều hướng webMain.jsp thành top-level: URL này mang jsessionid của
  // provider và sẽ mắc kẹt ở maintenance.logout khi session đã hết hạn.
  if (Number(flow.reloadAttempts ?? 0) < 1) {
    await reloadRecoveryTab(flow, `missing-controller:${command}`);
    return;
  }
  if (retryControllerAfterReload(flow, "missing-controller-after-wrapper-refresh"))
    return;
  failRecovery(flow, "live-webmain-controller-not-found-after-wrapper-refresh");
}

function clearRecoveryReloadTimeout(flow) {
  if (!flow?.reloadTimeout) return;
  clearTimeout(flow.reloadTimeout);
  flow.reloadTimeout = null;
}

function resumeRecoveryAfterReload(flow, source) {
  if (!flow || recoveryFlows.get(flow.tabId) !== flow ||
      flow.state !== "reload-wait" || flow.reloadResumeStarted) return;
  flow.reloadResumeStarted = true;
  clearRecoveryReloadTimeout(flow);
  sendDiagnostic(flow.tabId, "recovery-reload-ready", {
    source,
    request: flow.request
  });
  setTimeout(() => {
    if (recoveryFlows.get(flow.tabId) !== flow) return;
    flow.state = "detect";
    sendRecoveryCommand(flow, "detect");
  }, RECOVERY_RELOAD_SETTLE_MS);
}

function retryControllerAfterReload(flow, reason) {
  if (!flow || recoveryFlows.get(flow.tabId) !== flow ||
      Number(flow.reloadAttempts ?? 0) < 1 ||
      Date.now() >= Number(flow.reloadReadyDeadline ?? 0)) return false;
  clearRecoveryCommandTimeout(flow);
  flow.state = "reload-controller-wait";
  sendRecoveryWatchLog(flow.tabId, "recovery-reload-controller-wait", {
    reason,
    remainingMs: Math.max(0, Number(flow.reloadReadyDeadline ?? 0) - Date.now()),
    request: flow.request
  }, 1500);
  flow.commandTimeout = setTimeout(() => {
    if (recoveryFlows.get(flow.tabId) !== flow) return;
    flow.state = "detect";
    sendRecoveryCommand(flow, "detect");
  }, 750);
  return true;
}

async function reloadRecoveryTab(flow, reason) {
  if (!flow || recoveryFlows.get(flow.tabId) !== flow) return;
  clearRecoveryCommandTimeout(flow);
  clearRecoveryReloadTimeout(flow);
  const now = Date.now();
  const lastReloadAt = Number(lastRecoveryReloadAt.get(flow.tabId) ?? 0);
  if (Number(flow.reloadAttempts ?? 0) >= 1 ||
      now - lastReloadAt < RECOVERY_RELOAD_COOLDOWN_MS) {
    sendDiagnostic(flow.tabId, "recovery-reload-skip", {
      reason,
      reloadAttempts: Number(flow.reloadAttempts ?? 0),
      cooldownRemainingMs: Math.max(0, RECOVERY_RELOAD_COOLDOWN_MS - (now - lastReloadAt)),
      request: flow.request
    });
    failRecovery(flow, `reload-unavailable:${reason}`);
    return;
  }

  flow.reloadAttempts = Number(flow.reloadAttempts ?? 0) + 1;
  flow.reloadResumeStarted = false;
  flow.reloadReadyDeadline = now + RECOVERY_RELOAD_WAIT_MS;
  flow.state = "reload-wait";
  lastRecoveryReloadAt.set(flow.tabId, now);
  recoveryControllers.delete(flow.tabId);
  recoveryProviderContexts.delete(flow.tabId);
  activeGameFrames.delete(flow.tabId);
  legacyAuthorities.delete(flow.tabId);
  const probeState = recoveryProbeStates.get(flow.tabId);
  if (probeState) probeState.misses = 0;
  sendDiagnostic(flow.tabId, "recovery-reload-start", {
    reason,
    attempt: flow.reloadAttempts,
    request: flow.request
  });
  flow.reloadTimeout = setTimeout(() => {
    resumeRecoveryAfterReload(flow, "reload-timeout");
  }, RECOVERY_RELOAD_WAIT_MS);
  try {
    const wrapperUrl = await getRecoveryWrapper(flow.tabId);
    const tab = await chrome.tabs.get(flow.tabId);
    const currentUrl = String(tab?.url ?? "");
    if (wrapperUrl) {
      sendDiagnostic(flow.tabId, "recovery-wrapper-refresh-start", {
        reason,
        mode: currentUrl === wrapperUrl ? "reload-wrapper" : "navigate-wrapper",
        wrapperHref: safeUrl(wrapperUrl),
        currentHref: safeUrl(currentUrl),
        request: flow.request
      });
      if (currentUrl === wrapperUrl)
        await chrome.tabs.reload(flow.tabId, { bypassCache: false });
      else
        await chrome.tabs.update(flow.tabId, { url: wrapperUrl });
    } else {
      sendDiagnostic(flow.tabId, "recovery-wrapper-missing-fallback-reload", {
        reason,
        currentHref: safeUrl(currentUrl),
        request: flow.request
      });
      await chrome.tabs.reload(flow.tabId, { bypassCache: false });
    }
  } catch (error) {
    sendDiagnostic(flow.tabId, "recovery-reload-failed", {
      reason,
      error: String(error?.message ?? error),
      request: flow.request
    });
    failRecovery(flow, "reload-failed");
  }
}

async function sendRecoveryCommand(flow, command) {
  if (!flow || recoveryFlows.get(flow.tabId) !== flow) return;
  const commandId = crypto.randomUUID();
  clearRecoveryCommandTimeout(flow);
  flow.commandId = commandId;
  flow.command = command;
  flow.updatedAt = Date.now();
  if (command === "load_table") {
    flow.gameContextNotBefore = Date.now();
    recoveryCheckLockedUntil.set(flow.tabId, Date.now() + RECOVERY_CHECK_LOCK_MS);
    sendDiagnostic(flow.tabId, "recovery-check-lock", { command, lockedMs: RECOVERY_CHECK_LOCK_MS });
  }
  if (command === "open_provider") {
    flow.controllerFrameId = 0;
    try {
      await chrome.tabs.sendMessage(flow.tabId, {
        type: "execute_legacy_recovery",
        payload: { commandId, command, request: flow.request }
      }, { frameId: 0 });
      sendDiagnostic(flow.tabId, "recovery-wrapper-command", {
        command,
        commandId,
        frameId: 0,
        request: flow.request
      });
      flow.commandTimeout = setTimeout(() => {
        if (recoveryFlows.get(flow.tabId) !== flow || flow.commandId !== commandId) return;
        if (!retryControllerAfterReload(flow, "open-provider-timeout"))
          failRecovery(flow, "open-provider-timeout");
      }, RECOVERY_COMMAND_TIMEOUT_MS);
    } catch (error) {
      sendDiagnostic(flow.tabId, "recovery-wrapper-command-failed", {
        command,
        error: String(error?.message ?? error),
        request: flow.request
      });
      if (!retryControllerAfterReload(flow, "open-provider-delivery-failed"))
        failRecovery(flow, "open-provider-delivery-failed");
    }
    return;
  }
  // Controller là webMain.jsp (có thể là iframe sâu), không nhất thiết frame 0.
  let controller = null;
  try {
    controller = await findLiveRecoveryController(flow.tabId);
  } catch (error) {
    sendDiagnostic(flow.tabId, "recovery-controller-resolve-failed", {
      command,
      error: String(error?.message ?? error)
    });
  }
  if (!controller || recoveryFlows.get(flow.tabId) !== flow) {
    if (Number(flow.reloadAttempts ?? 0) > 0) {
      // Lần 1 có thể chỉ mở nhóm "Truyền Thống"; lần 2 mới thấy card AWC/Sexy.
      if (Number(flow.wrapperProviderAttempts ?? 0) < 2 &&
          Date.now() < Number(flow.reloadReadyDeadline ?? 0)) {
        flow.wrapperProviderAttempts = Number(flow.wrapperProviderAttempts ?? 0) + 1;
        flow.state = "open-provider";
        sendRecoveryCommand(flow, "open_provider");
        return;
      }
      if (retryControllerAfterReload(flow, "controller-not-ready"))
        return;
      failRecovery(flow, "controller-not-ready-after-reload");
      return;
    }
    await recoverMissingController(flow, command);
    return;
  }
  rememberRecoveryEntry(flow.tabId, controller.href);
  recoveryControllers.set(flow.tabId, {
    ...controller,
    kind: "",
    at: Date.now(),
    source: "pull-probe",
    provider: 1
  });
  const frameId = controller.frameId;
  flow.controllerFrameId = frameId;
  try {
    await chrome.tabs.sendMessage(flow.tabId, {
      type: "execute_legacy_recovery",
      payload: { commandId, command, request: flow.request }
    }, { frameId });
  } catch (error) {
    const errorText = String(error?.message ?? error);
    sendDiagnostic(flow.tabId, "recovery-command-delivery-failed", {
      command, commandId, frameId, error: errorText
    });
    if (Number(flow.reloadAttempts ?? 0) < 1) {
      await reloadRecoveryTab(flow, `command-delivery-failed:${errorText}`);
      return;
    }
    if (retryControllerAfterReload(flow, `command-delivery-failed:${errorText}`))
      return;
    failRecovery(flow, "command-delivery-failed");
    return;
  }
  sendDiagnostic(flow.tabId, "recovery-command", {
    command,
    commandId,
    frameId,
    controllerHref: safeUrl(controller.href),
    request: flow.request
  });
  flow.commandTimeout = setTimeout(() => {
    if (recoveryFlows.get(flow.tabId) !== flow || flow.commandId !== commandId) return;
    sendDiagnostic(flow.tabId, "recovery-command-timeout", {
      command,
      commandId,
      frameId,
      timeoutMs: RECOVERY_COMMAND_TIMEOUT_MS,
      request: flow.request
    });
    failRecovery(flow, `${command}:timeout`);
  }, RECOVERY_COMMAND_TIMEOUT_MS);
}

function clearRecoveryCommandTimeout(flow) {
  if (!flow?.commandTimeout) return;
  clearTimeout(flow.commandTimeout);
  flow.commandTimeout = null;
}

function failRecovery(flow, reason) {
  if (!flow || recoveryFlows.get(flow.tabId) !== flow) return;
  clearRecoveryCommandTimeout(flow);
  clearRecoveryReloadTimeout(flow);
  if (flow.attempt >= RECOVERY_MAX_ATTEMPTS) {
    recoveryFlows.delete(flow.tabId);
    resetRecoveryMisses(flow.tabId, "recovery-failed");
    sendDiagnostic(flow.tabId, "recovery-failed", { reason, attempts: flow.attempt, request: flow.request });
    return;
  }
  flow.attempt += 1;
  flow.state = "retry-wait";
  sendDiagnostic(flow.tabId, "recovery-retry", { reason, attempt: flow.attempt, request: flow.request });
  setTimeout(() => {
    if (recoveryFlows.get(flow.tabId) !== flow) return;
    flow.state = "detect";
    sendRecoveryCommand(flow, "detect");
  }, RECOVERY_RETRY_DELAY_MS);
}

async function startRecovery(tabId, request, reason, controllerFrameId = null) {
  const previous = recoveryFlows.get(tabId);
  if (previous) {
    sendRecoveryWatchLog(tabId, "recovery-skip-inflight", { state: previous.state, reason });
    return;
  }
  const now = Date.now();
  const lockedUntil = Number(recoveryCheckLockedUntil.get(tabId) ?? 0);
  if (now < lockedUntil) {
    sendRecoveryWatchLog(tabId, "recovery-check-locked", {
      remainingMs: lockedUntil - now,
      reason
    });
    return;
  }
  const lastStartAt = Number(lastRecoveryStartAt.get(tabId) ?? 0);
  if (now - lastStartAt < RECOVERY_START_COOLDOWN_MS) {
    sendRecoveryWatchLog(tabId, "recovery-start-cooldown", {
      remainingMs: RECOVERY_START_COOLDOWN_MS - (now - lastStartAt),
      reason
    });
    return;
  }
  let remembered = recoveryBookmarks.get(tabId) ?? null;
  if (!remembered) {
    remembered = await loadRecoverySessionValue(
      recoveryStorageKey(RECOVERY_BOOKMARK_STORAGE_PREFIX, tabId)
    );
    if (remembered) recoveryBookmarks.set(tabId, remembered);
  }
  // Worker có thể bị suspend trong lúc đọc storage. Không tạo flow trùng nếu
  // heartbeat khác đã mở recovery trong khoảng thời gian đó.
  if (recoveryFlows.has(tabId)) return;
  remembered ??= {};
  const merged = {
    tableId: String(request?.tableId ?? remembered.tableId ?? ""),
    tableName: String(request?.tableName ?? remembered.tableName ?? ""),
    tableCode: String(request?.tableCode ?? remembered.tableCode ?? "").toUpperCase()
  };
  if (!merged.tableId && !merged.tableCode && !merged.tableName) {
    lastRecoveryStartAt.set(tabId, now);
    sendDiagnostic(tabId, "recovery-skip-no-bookmark", { reason });
    return;
  }
  const flow = { tabId, request: merged, reason, state: "detect", attempt: 1, startedAt: Date.now(), commandId: "", command: "", controllerFrameId, reloadAttempts: 0, reloadResumeStarted: false };
  recoveryFlows.set(tabId, flow);
  lastRecoveryStartAt.set(tabId, now);
  sendDiagnostic(tabId, "recovery-start", { reason, request: merged });
  if (/pull-probe-(no_response|no_webmain)-/i.test(String(reason ?? ""))) {
    await reloadRecoveryTab(flow, reason);
    return;
  }
  sendRecoveryCommand(flow, "detect");
}

function handleRecoveryResult(tabId, payload) {
  const flow = recoveryFlows.get(tabId);
  if (!flow || String(payload?.commandId ?? "") !== flow.commandId) return;
  clearRecoveryCommandTimeout(flow);
  const command = String(payload?.command ?? "");
  const result = payload?.result ?? {};
  sendDiagnostic(tabId, "recovery-result", {
    command,
    ok: result?.ok ? 1 : 0,
    reason: String(result?.reason ?? ""),
    kind: String(result?.kind ?? ""),
    href: safeUrl(result?.href),
    controller: result?.controller ? 1 : 0,
    gameFrameVisible: result?.gameFrameVisible ? 1 : 0,
    hallFrameVisible: result?.hallFrameVisible ? 1 : 0,
    request: flow.request
  });
  if (command === "open_provider") {
    sendDiagnostic(tabId, "recovery-wrapper-command-result", {
      ok: result?.ok ? 1 : 0,
      reason: String(result?.reason ?? ""),
      request: flow.request
    });
    if (retryControllerAfterReload(flow, result?.ok ? "provider-opened" : "provider-open-missed"))
      return;
    failRecovery(flow, `open-provider:${String(result?.reason ?? "failed")}`);
    return;
  }
  if (!result?.ok) {
    failRecovery(flow, `${command}:${String(result?.reason ?? "failed")}`);
    return;
  }
  if (command === "detect") {
    const kind = String(result?.kind ?? "").toUpperCase();
    if (kind === "SESSION_EXPIRED") {
      if (Number(flow.reloadAttempts ?? 0) < 1) {
        void reloadRecoveryTab(flow, "detect-session-expired");
        return;
      }
      if (retryControllerAfterReload(flow, "session-expired-after-wrapper-refresh"))
        return;
      failRecovery(flow, "session-expired-after-wrapper-refresh");
      return;
    }
    if (kind === "RETURN_TO_GAME" || result?.returnToGame === 1 || result?.returnToGame === true) {
      flow.state = "resume-game";
      sendRecoveryCommand(flow, "resume_game");
      return;
    }
    if (kind === "GAME_TABLE") {
      const staleGameTable = String(flow.reason ?? "").includes("game-table") &&
        String(flow.reason ?? "").includes("stale");
      if (staleGameTable) {
        flow.state = "go-hall";
        sendDiagnostic(tabId, "recovery-stale-game-table-normalize", {
          staleReason: flow.reason,
          detectedKind: kind,
          controllerFrameId: flow.controllerFrameId,
          request: flow.request
        });
        sendRecoveryCommand(flow, "go_hall");
        return;
      }
      // A controller probe is authoritative for the currently visible provider
      // frame.  If it already reports GAME_TABLE, recovery has succeeded; do
      // not require a later legacy tick, because a quiet table can otherwise
      // be incorrectly failed after RECOVERY_GAME_CONTEXT_WAIT_MS.
      clearRecoveryCommandTimeout(flow);
      resetRecoveryMisses(tabId, "detect-game-table-success");
      recoveryFlows.delete(tabId);
      sendDiagnostic(tabId, "recovery-success-game-table-detect", {
        request: flow.request,
        frameId: flow.controllerFrameId,
        href: safeUrl(result?.href),
        reason: flow.reason
      });
      return;
    }
    if (kind === "GAME_HALL") {
      flow.state = "load-table";
      sendRecoveryCommand(flow, "load_table");
      return;
    }
    if (Number(flow.reloadAttempts ?? 0) < 1) {
      void reloadRecoveryTab(flow, `detect-${kind || "unknown"}`);
      return;
    }
    flow.state = "go-hall";
    sendRecoveryCommand(flow, "go_hall");
    return;
  }
  if (command === "resume_game") {
    flow.state = "resume-wait";
    setTimeout(() => {
      if (recoveryFlows.get(tabId) !== flow) return;
      flow.state = "detect";
      sendRecoveryCommand(flow, "detect");
    }, RECOVERY_RETRY_DELAY_MS);
    return;
  }
  if (command === "go_hall") {
    flow.state = "hall-wait";
    setTimeout(() => {
      if (recoveryFlows.get(tabId) !== flow) return;
      // Không click bàn theo timer. Phải xác nhận controller đã ở GAME_HALL.
      flow.state = "confirm-hall";
      sendRecoveryCommand(flow, "detect");
    }, RECOVERY_RETRY_DELAY_MS);
    return;
  }
  if (command === "load_table") {
    flow.state = "wait-game-context";
    setTimeout(() => {
      if (recoveryFlows.get(tabId) !== flow || flow.state !== "wait-game-context") return;
      failRecovery(flow, "no-game-context-after-table-click");
    }, RECOVERY_GAME_CONTEXT_WAIT_MS);
  }
}

async function handleRecoveryFrameContext(tabId, frameId, payload, source) {
  // Deprecated: recovery is driven only by watchdog pull probes.
  return;
  const context = payload?.context ?? {};
  const kind = String(context?.kind ?? "").toUpperCase();
  if (!kind) return;

  const now = Date.now();
  const href = String(payload?.href ?? context?.href ?? "");
  rememberRecoveryEntry(tabId, href);
  const isProviderController = context?.isProviderController === 1 ||
    context?.isProviderController === true || context?.controller === 1 ||
    context?.controller === true;

  // Chỉ webMain/provider controller biết iframe nào ĐANG HIỂN THỊ. Không dùng
  // tick, DOM hay heartbeat của singleBacTable con vì frame cũ có thể còn sống
  // sau khi người dùng đã bị out về hall.
  if (!isProviderController) {
    sendRecoveryWatchLog(tabId, "recovery-frame-context-ignored-non-controller", {
      source,
      kind,
      frameId,
      href: safeUrl(href)
    });
    return;
  }

  recoveryProviderContexts.set(tabId, { frameId, href, kind, at: now });
  recoveryControllers.set(tabId, { frameId, href, kind, at: now, source, provider: 1 });
  if (kind === "GAME_TABLE") {
    lastGameTableContextAt.set(tabId, now);
    saveRecoverySessionValue(recoveryStorageKey(RECOVERY_GAME_CONTEXT_STORAGE_PREFIX, tabId), now);
    const flow = recoveryFlows.get(tabId);
    if (flow && flow.state === "wait-game-context" &&
        now >= Number(flow.gameContextNotBefore ?? Number.MAX_SAFE_INTEGER)) {
      clearRecoveryCommandTimeout(flow);
      resetRecoveryMisses(tabId, "probe-game-table-success");
      recoveryFlows.delete(tabId);
      sendDiagnostic(tabId, "recovery-success-game-context", {
        request: flow.request,
        frameId,
        href: safeUrl(href)
      });
    }
  }

  let lastGameAt = Number(lastGameTableContextAt.get(tabId) ?? 0);
  if (!lastGameAt) {
    lastGameAt = Number(await loadRecoverySessionValue(
      recoveryStorageKey(RECOVERY_GAME_CONTEXT_STORAGE_PREFIX, tabId)
    ) ?? 0);
    if (lastGameAt > 0) lastGameTableContextAt.set(tabId, lastGameAt);
  }
  const staleMs = lastGameAt > 0 ? now - lastGameAt : 0;
  const lockedUntil = Number(recoveryCheckLockedUntil.get(tabId) ?? 0);
  sendRecoveryWatchLog(tabId, "recovery-frame-context", {
    source,
    kind,
    frameId,
    href: safeUrl(href),
    provider: 1,
    staleMs,
    lockedMs: Math.max(0, lockedUntil - now),
    flowState: recoveryFlows.get(tabId)?.state ?? ""
  });

  if (kind !== "GAME_TABLE" && lastGameAt > 0 && staleMs >= RECOVERY_STALE_TICK_MS) {
    sendRecoveryWatchLog(tabId, "game-table-context-stale", {
      source,
      kind,
      frameId,
      href: safeUrl(href),
      staleMs
    });
    void startRecovery(
      tabId,
      recoveryBookmarks.get(tabId) ?? {},
      `game-table-context-stale-${staleMs}`,
      recoveryControllers.get(tabId)?.frameId ?? frameId
    );
  }
}

async function handleRecoveryProbeObservation(tabId, frameId, payload) {
  const now = Date.now();
  const context = payload?.context ?? {};
  const kind = String(context?.kind ?? "NO_CONTEXT").toUpperCase();
  const href = String(payload?.href ?? context?.href ?? "");
  let state = recoveryProbeStates.get(tabId);
  if (!state) {
    const storedGameAt = Number(await loadRecoverySessionValue(
      recoveryStorageKey(RECOVERY_GAME_CONTEXT_STORAGE_PREFIX, tabId)
    ) ?? 0);
    state = { misses: 0, lastKind: "", armed: storedGameAt > 0, lastProbeAt: 0 };
    recoveryProbeStates.set(tabId, state);
  }

  state.lastProbeAt = now;
  recoveryProviderContexts.set(tabId, { frameId, href, kind, at: now });
  recoveryControllers.set(tabId, {
    frameId,
    href,
    kind,
    at: now,
    source: "pull-probe",
    provider: 1
  });

  if (kind === "GAME_TABLE") {
    state.misses = 0;
    state.armed = true;
    state.lastKind = kind;
    lastGameTableContextAt.set(tabId, now);
    saveRecoverySessionValue(recoveryStorageKey(RECOVERY_GAME_CONTEXT_STORAGE_PREFIX, tabId), now);
    const flow = recoveryFlows.get(tabId);
    if (flow && flow.state === "wait-game-context" &&
        now >= Number(flow.gameContextNotBefore ?? Number.MAX_SAFE_INTEGER)) {
      clearRecoveryCommandTimeout(flow);
      resetRecoveryMisses(tabId, "probe-game-table-success");
      recoveryFlows.delete(tabId);
      sendDiagnostic(tabId, "recovery-success-game-context", {
        request: flow.request,
        frameId,
        href: safeUrl(href)
      });
    }
    sendRecoveryWatchLog(tabId, "recovery-probe", {
      kind,
      frameId,
      misses: 0,
      armed: 1,
      href: safeUrl(href),
      flowState: recoveryFlows.get(tabId)?.state ?? ""
    });
    return;
  }

  state.misses += 1;
  state.lastKind = kind;
  const lockedUntil = Number(recoveryCheckLockedUntil.get(tabId) ?? 0);
  sendRecoveryWatchLog(tabId, "recovery-probe", {
    kind,
    frameId,
    misses: state.misses,
    armed: state.armed ? 1 : 0,
    href: safeUrl(href),
    lockedMs: Math.max(0, lockedUntil - now),
    flowState: recoveryFlows.get(tabId)?.state ?? ""
  }, 900);

  if (state.armed && state.misses >= RECOVERY_MISS_LIMIT) {
    sendRecoveryWatchLog(tabId, "recovery-probe-stale", {
      kind,
      frameId,
      href: safeUrl(href),
      misses: state.misses
    }, 900);
    void startRecovery(
      tabId,
      recoveryBookmarks.get(tabId) ?? {},
      `pull-probe-${kind.toLowerCase()}-${state.misses}-misses`,
      frameId
    );
  }
}

async function probeRecoveryTab(tabId, pulse) {
  if (recoveryProbeInFlight.has(tabId)) return;
  recoveryProbeInFlight.add(tabId);
  try {
    const controller = await findLiveRecoveryController(tabId);
    if (!controller) {
      await handleRecoveryProbeObservation(tabId, -1, {
        context: { kind: "NO_WEBMAIN" },
        href: ""
      });
      return;
    }
    rememberRecoveryEntry(tabId, controller.href);

    let response = null;
    try {
      response = await chrome.tabs.sendMessage(tabId, {
        type: "probe_recovery_context",
        payload: { sequence: Number(pulse?.sequence ?? 0) }
      }, { frameId: controller.frameId });
    } catch (error) {
      sendRecoveryWatchLog(tabId, "recovery-probe-delivery-failed", {
        frameId: controller.frameId,
        href: safeUrl(controller.href),
        error: String(error?.message ?? error)
      }, 900);
    }
    await handleRecoveryProbeObservation(tabId, controller.frameId, response ?? {
      context: { kind: "NO_RESPONSE" },
      href: controller.href
    });
  } catch (error) {
    sendRecoveryWatchLog(tabId, "recovery-probe-error", {
      error: String(error?.message ?? error)
    }, 900);
  } finally {
    recoveryProbeInFlight.delete(tabId);
  }
}

async function runRecoveryProbeCycle(pulse) {
  const tabIds = new Set();
  for (const target of sessions.values()) {
    if (Number.isInteger(target?.tabId)) tabIds.add(target.tabId);
  }
  for (const tabId of recoveryBookmarks.keys()) tabIds.add(tabId);
  for (const tabId of tabIds) void probeRecoveryTab(tabId, pulse);
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
  if (changeInfo.url) rememberRecoveryWrapper(tabId, changeInfo.url);
  if (changeInfo.status === "loading") {
    // Không xóa recoveryBookmarks: chính navigation/disconnect là lúc cần nhớ
    // bàn cũ để quay lại. Bookmark chỉ được thay bởi tick authority mới.
    activeTables.delete(tabId);
    activeGameFrames.delete(tabId);
    roadPacketCounts.delete(tabId);
    legacyAuthorities.delete(tabId);
  }
  if (changeInfo.status === "complete") {
    const flow = recoveryFlows.get(tabId);
    if (flow?.state === "reload-wait")
      resumeRecoveryAfterReload(flow, "tab-complete");
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTables.delete(tabId);
  activeGameFrames.delete(tabId);
  legacyAuthorities.delete(tabId);
  recoveryBookmarks.delete(tabId);
  recoveryEntryUrls.delete(tabId);
  recoveryWrapperUrls.delete(tabId);
  recoveryFlows.delete(tabId);
  recoveryControllers.delete(tabId);
  recoveryProviderContexts.delete(tabId);
  lastGameTableContextAt.delete(tabId);
  lastRecoveryStartAt.delete(tabId);
  recoveryCheckLockedUntil.delete(tabId);
  recoveryWatchLogAt.delete(tabId);
  recoveryProbeStates.delete(tabId);
  recoveryProbeInFlight.delete(tabId);
  lastRecoveryReloadAt.delete(tabId);
  clearRecoverySessionValue(recoveryStorageKey(RECOVERY_BOOKMARK_STORAGE_PREFIX, tabId));
  clearRecoverySessionValue(recoveryStorageKey(RECOVERY_GAME_CONTEXT_STORAGE_PREFIX, tabId));
  clearRecoverySessionValue(recoveryStorageKey(RECOVERY_ENTRY_URL_STORAGE_PREFIX, tabId));
  clearRecoverySessionValue(recoveryStorageKey(RECOVERY_WRAPPER_URL_STORAGE_PREFIX, tabId));
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
  if (message.type === "legacy_recovery_needed") {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    sendRecoveryWatchLog(tabId, "legacy-recovery-request-ignored-pull-watchdog", {
      reason: String(message.payload?.recovery?.reason ?? "unknown")
    });
    return;
  }
  if (message.type === "recovery_session_expired") {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    sendDiagnostic(tabId, "recovery-session-expired-signal", {
      href: safeUrl(message.payload?.href),
      reason: String(message.payload?.reason ?? "session-expired"),
      frameId: Number(sender.frameId ?? -1)
    });
    void startRecovery(
      tabId,
      recoveryBookmarks.get(tabId) ?? {},
      "session-expired-immediate",
      Number(sender.frameId ?? -1)
    );
    return;
  }
  if (message.type === "legacy_recovery_result") {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) handleRecoveryResult(tabId, message.payload ?? {});
    return;
  }
  if (message.type === "recovery_frame_context") {
    return;
  }
  if (message.type === "legacy_top_context") {
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
    if (tabId !== undefined && selectionPayload.tableId) {
      const bookmark = makeRecoveryBookmark(tick);
      const previous = recoveryBookmarks.get(tabId);
      activeTables.set(tabId, selectionPayload.tableId);
      recoveryBookmarks.set(tabId, bookmark);
      saveRecoverySessionValue(recoveryStorageKey(RECOVERY_BOOKMARK_STORAGE_PREFIX, tabId), bookmark);
      // A fresh authority tick only arms recovery. Pull probes remain the sole
      // signal that the table has been left, so a stale tick cannot mask an out.
      armRecoveryFromGameTick(tabId);
      completeRecoveryFromGameTick(tabId, frameId, String(message.payload?.href ?? ""));
      if (!previous || !bookmarkMatchesTick(previous, tick))
        sendDiagnostic(tabId, "active-table-selected", bookmark);
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
