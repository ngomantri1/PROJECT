// Mirrors the old WebView2 bridge: the legacy script scouts every frame, then
// only the chosen frame receives __abxStartAuthority() and starts its push loop.
(() => {
  const intervalMs = 360;
  let activeCommand = null;
  let retryTimer = null;
  let attempt = 0;
  let lastResult = "";

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
