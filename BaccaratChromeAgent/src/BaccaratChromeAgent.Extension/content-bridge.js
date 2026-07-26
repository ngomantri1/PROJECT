// Read-only bridge for the selected legacy snapshot in this frame.
const frameKey = `${location.origin}${location.pathname}`;
let legacySnapshot = null;

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
  if (event.source !== window || event.data?.source !== "bca-page-probe") return;
  if (event.data.type !== "legacy_snapshot") return;
  legacySnapshot = event.data.payload;
  sendSnapshot();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "engine_response") return;
  window.dispatchEvent(new CustomEvent("bca-engine-state", { detail: message.payload.display ?? {} }));
});
