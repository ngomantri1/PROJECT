// Attach Chrome Network monitoring before the game iframe starts creating sockets.
// This script is isolated-world and intentionally does not inspect or modify page data.
const isGameContainer = /\/home\/(?:thirdg|live)\.html$/i.test(location.pathname);
if (window.top === window && isGameContainer) {
  chrome.runtime.sendMessage({ type: "ensure_debugger" }).catch(() => {});
}
