// Canvas chỉ xuất hiện ở wrapper/game surface, không phủ trang chủ hoặc các trang HTTPS khác.
// Nhận diện theo path để không hardcode domain/provider.
const isGameSurface = /\/(?:home\/)?thirdg\.html|\/player\/(?:webMain|singleBacTable)\.jsp/i.test(location.pathname);

// Canvas UI chỉ chạy ở top frame, cố định bằng Shadow DOM để không ảnh hưởng CSS của game.
if (window.top !== window || !isGameSurface) {
  // Game iframe vẫn có content-bridge.js để gửi snapshot; không tạo panel trùng lặp.
} else {
const host = document.createElement("div");
host.id = "baccarat-chrome-agent-overlay";
host.style.cssText = "position:fixed;top:14px;right:14px;z-index:2147483647;pointer-events:none;display:block;";
const shadow = host.attachShadow({ mode: "closed" });
const canvas = document.createElement("canvas");
canvas.width = 330;
canvas.height = 110;
canvas.style.cssText = "width:330px;height:110px;border-radius:8px;box-shadow:0 3px 14px #0008;";
shadow.append(canvas);

function ensureAttached() {
  if (!host.isConnected) (document.body ?? document.documentElement).append(host);
}
ensureAttached();
new MutationObserver(ensureAttached).observe(document.documentElement, { childList: true, subtree: true });

const ctx = canvas.getContext("2d");
let state = { connection: "connecting", status: "Đang kết nối Engine", sequence: "" };

function draw() {
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = state.connection === "connected" ? "#22c55e" : "#f59e0b";
  ctx.beginPath(); ctx.arc(18, 20, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f9fafb";
  ctx.font = "bold 14px Arial";
  ctx.fillText("Baccarat Chrome Agent", 32, 25);
  ctx.font = "12px Arial";
  ctx.fillStyle = "#d1d5db";
  ctx.fillText(String(state.status ?? "-"), 14, 53);
  ctx.fillStyle = "#9ca3af";
  ctx.fillText(`Table: ${state.tableId ?? "-"} | Round: ${state.round ?? "-"}`, 14, 76);
  ctx.fillText(`Seq: ${String(state.sequence ?? "").slice(-35) || "-"}`, 14, 97);
}

window.addEventListener("bca-engine-state", (event) => {
  const next = event.detail ?? {};
  for (const field of ["tableId", "tableName", "round", "sequence", "status"]) {
    if (next[field] === null || next[field] === undefined || next[field] === "") delete next[field];
  }
  state = { ...state, ...next };
  draw();
});
draw();
}
