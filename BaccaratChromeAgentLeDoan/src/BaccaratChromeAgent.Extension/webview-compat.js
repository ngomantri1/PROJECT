// Chrome compatibility transport for the untouched legacy bridge.
// The legacy script calls chrome.webview.postMessage(JSON.stringify(tick)).
// In Chrome we preserve that exact JSON string and expose it to the isolated
// content bridge; no tick field is parsed, filtered, or reconstructed here.
(() => {
  const publish = (rawTick) => {
    try {
      const raw = typeof rawTick === "string" ? rawTick : JSON.stringify(rawTick);
      window.postMessage({ source: "bca-webview-compat", type: "legacy_raw_tick", rawTick: raw }, "*");
    } catch (_) {}
  };

  try {
    const chromeObject = window.chrome || (window.chrome = {});
    const current = chromeObject.webview;
    if (!current || typeof current.postMessage !== "function") {
      const webview = { postMessage: publish };
      try {
        Object.defineProperty(chromeObject, "webview", {
          value: webview,
          configurable: true,
          writable: true
        });
      } catch (_) {
        chromeObject.webview = webview;
      }
    }
  } catch (_) {
    // The legacy safePost fallback posts to parent. Its message remains usable
    // on pages where Chrome prevents exposing the compatibility property.
  }
})();
