// Mirrors the old WebView2 bridge: the legacy script scouts every frame, then
// only the chosen frame receives __abxStartAuthority() and starts its push loop.
(() => {
  const intervalMs = 360;
  let activeCommand = null;
  let retryTimer = null;
  let attempt = 0;
  let lastResult = "";

  function findReturnToGameControl() {
    try {
      const nodes = document.querySelectorAll("a,button,[role=button],[onclick],div,span");
      for (const node of nodes) {
        const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
        if (!/^(trở về game|tro ve game|return to game|back to game)$/i.test(text)) continue;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        if (rect.width > 4 && rect.height > 4 && style.display !== "none" && style.visibility !== "hidden") return node;
      }
    } catch (_) {}
    return null;
  }

  function readRecoveryContext() {
    let context = {};
    try {
      if (typeof window.__cw_detectBaccaratContext === "function")
        context = JSON.parse(String(window.__cw_detectBaccaratContext() || "{}"));
    } catch (_) {}
    const returnControl = findReturnToGameControl();
    if (returnControl) {
      context.returnToGame = 1;
      context.kind = "RETURN_TO_GAME";
    }
    return context;
  }

  function openProviderFromWrapper() {
    try {
      const href = String(location.href || "");
      if (/\/player\//i.test(href))
        return { ok: false, reason: "not-wrapper" };
      const nodes = Array.from(document.querySelectorAll(
        "a[href],button,[role=button],[onclick],[data-game-code],[data-gamecode],[data-code],li,div"
      ));
      let best = null;
      let bestScore = 0;
      for (const node of nodes) {
        const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
        const signal = [
          node.getAttribute?.("href"),
          node.getAttribute?.("onclick"),
          node.getAttribute?.("data-game-code"),
          node.getAttribute?.("data-gamecode"),
          node.getAttribute?.("data-code")
        ].filter(Boolean).join(" ");
        let score = 0;
        if (/AWC_S/i.test(signal)) score += 300;
        if (/SEXY/i.test(signal) && /BACCARAT|CASINO/i.test(signal + " " + text)) score += 180;
        if (/^(TRUYỀN THỐNG|TRUYEN THONG|TRADITIONAL)$/i.test(text)) score += 90;
        if (/BACCARAT|SEXY CASINO/i.test(text)) score += 70;
        if (text.length > 80) score -= 80;
        try {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          if (rect.width < 4 || rect.height < 4 || style.display === "none" || style.visibility === "hidden")
            score = 0;
        } catch (_) { score = 0; }
        if (score > bestScore) {
          best = node;
          bestScore = score;
        }
      }
      if (!best || bestScore < 70)
        return { ok: false, reason: "provider-control-not-found" };
      const target = best.closest?.("a[href],button,[role=button],[onclick]") ||
        best.querySelector?.("a[href],button,[role=button],[onclick]") || best;
      target.scrollIntoView?.({ block: "center", inline: "center" });
      target.click();
      return {
        ok: true,
        reason: "provider-control-clicked",
        score: bestScore,
        text: String(target.innerText || target.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80)
      };
    } catch (error) {
      return { ok: false, reason: "provider-control-click-error", error: String(error?.message ?? error) };
    }
  }

  // Watchdog này chạy ở controller/top frame, không phải iframe game authority.
  // Vì vậy khi singleBacTable bị unload và chỉ còn gamehall, Extension vẫn nhận
  // được context để service worker khởi động luồng vào lại bàn.
  function publishTopRecoveryContext() {
    try {
      const context = readRecoveryContext();
      const href = String(location.href || "");
      const kind = String(context?.kind || "").toUpperCase();
      // webMain.jsp là controller thực tế trong iframe của casino; top ngoài
      // cùng không nhìn được DOM cùng-origin của iframe này.
      // gamehall.jsp và singleBacTable.jsp có thể không có iframe controller.
      // Cả GAME_HALL lẫn GAME_TABLE đều phải gửi heartbeat để worker phát hiện
      // authority tick bị mất dù giao diện vẫn còn nằm trong iframe game.
      if (!context?.controller && !context?.returnToGame && kind !== "GAME_HALL" &&
          kind !== "GAME_TABLE" && kind !== "DISCONNECTED" &&
          !/\/player\/webMain\.jsp/i.test(href)) return;
      window.postMessage({
        source: "bca-legacy-top-context",
        context,
        observedAtUtc: new Date().toISOString()
      }, "*");
    } catch (_) {}
  }

  function publishResult(result) {
    if (result === lastResult && attempt % 20 !== 0) return;
    lastResult = result;
    window.postMessage({
      source: "bca-legacy-authority",
      type: "authority_result",
      contextId: String(activeCommand?.contextId ?? ""),
      attempt,
      hasStartPush: typeof window.__cw_startPush === "function" ? 1 : 0,
      hasReadSnapshot: typeof window.__cw_readSnapshot === "function" ? 1 : 0,
      bootDone: window.__cw_boot_done ? 1 : 0,
      readyState: String(document.readyState ?? ""),
      result
    }, "*");
  }

  function applyAuthority() {
    if (!activeCommand) return;
    attempt += 1;
    let result = "pending:no-authority-api";
    try {
      if (typeof window.__abxStartAuthority === "function") {
        result = String(window.__abxStartAuthority(
          String(activeCommand.token ?? ""),
          String(activeCommand.contextId ?? ""),
          intervalMs
        ));
      }
    } catch (error) {
      result = `error:${String(error?.message ?? error)}`;
    }

    publishResult(result);
    if (result === "started" && typeof window.__cw_startBaccaratRecoveryWatchdog === "function") {
      try { window.__cw_startBaccaratRecoveryWatchdog({}); } catch (_) {}
    }
    if (result === "started" || result.startsWith("skip:not-authority") || attempt >= 120) {
      if (retryTimer) clearInterval(retryTimer);
      retryTimer = null;
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "bca-content-bridge" ||
        event.data?.type !== "start_legacy_authority") return;
    activeCommand = event.data.payload ?? {};
    attempt = 0;
    lastResult = "";
    if (retryTimer) clearInterval(retryTimer);
    applyAuthority();
    if (!retryTimer && (lastResult.startsWith("pending:") || lastResult.startsWith("error:"))) {
      retryTimer = setInterval(applyAuthority, 500);
    }
  });

  setTimeout(publishTopRecoveryContext, 500);
  setInterval(publishTopRecoveryContext, 1000);

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "bca-content-bridge" ||
        event.data?.type !== "execute_legacy_recovery") return;

    const payload = event.data.payload ?? {};
    const commandId = String(payload.commandId ?? "");
    const command = String(payload.command ?? "");
    const request = payload.request ?? {};
    (async () => {
      let result = { ok: false, reason: "recovery-api-missing" };
      try {
        let raw = "";
        if (command === "detect")
          raw = JSON.stringify(readRecoveryContext());
        else if (command === "resume_game") {
          const control = findReturnToGameControl();
          if (!control) raw = JSON.stringify({ ok: false, reason: "return-to-game-control-not-found" });
          else {
            control.scrollIntoView({ block: "center", inline: "center" });
            control.click();
            raw = JSON.stringify({ ok: true, reason: "return-to-game-clicked" });
          }
        }
        else if (command === "go_hall" && typeof window.__cw_goBaccaratHall === "function")
          raw = await window.__cw_goBaccaratHall();
        else if (command === "load_table" && typeof window.__cw_loadBaccaratTable === "function")
          raw = await window.__cw_loadBaccaratTable(request);
        else if (command === "open_provider")
          raw = JSON.stringify(openProviderFromWrapper());
        if (raw) {
          try { result = JSON.parse(String(raw)); }
          catch (_) { result = { ok: String(raw).indexOf("err:") !== 0, reason: String(raw) }; }
        }
      } catch (error) {
        result = { ok: false, reason: "recovery-command-error", error: String(error?.message ?? error) };
      }
      window.postMessage({
        source: "bca-legacy-recovery-result",
        commandId,
        command,
        result
      }, "*");
    })();
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "bca-content-bridge" ||
        event.data?.type !== "execute_legacy_bet") return;

    const payload = event.data.payload ?? {};
    const requestId = String(payload.requestId ?? "");
    const side = String(payload.side ?? "");
    const amount = Number(payload.amount ?? 0);
    const roundId = Number(payload.roundId ?? 0);

    (async () => {
      let result;
      try {
        if (typeof window.__cw_bet_enqueue !== "function") {
          result = "err:legacy-bet-enqueue-missing";
        } else {
          // This is the original legacy implementation, running in the
          // authority frame selected from its own frame scouts.
          result = String(await window.__cw_bet_enqueue({
            tabId: "chrome-native-host",
            roundId,
            side,
            amount
          }));
        }
      } catch (error) {
        result = `err:${String(error?.message ?? error)}`;
      }
      window.postMessage({
        source: "bca-legacy-bet-result",
        payload: { requestId, side, amount, roundId, result, observedAtUtc: new Date().toISOString() }
      }, "*");
    })();
  });

  // The original script already starts its own scout loop. This callback is
  // deliberately not a direct __cw_startPush call: authority must be granted
  // first, exactly as it was by the old WebView2 host.
})();
