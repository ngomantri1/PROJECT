# ARCHITECTURE

## Cấu trúc project
```text
XocDiaSoiVIP389/
  App.xaml, App.xaml.cs
  MainWindow.xaml, MainWindow.xaml.cs
  MainWindow.Startup.cs
  MainWindow.EmbedMode.cs
  Models.cs
  WebView2LiveBridge.cs
  XocDiaSoiVIP389Plugin.cs
  PluginProbe.cs
  Tasks/
    IBetTask.cs
    GameContext.cs
    TaskUtil.cs
    MoneyManager.cs
    MoneyHelper.cs
    ... 35 strategy tasks (CL + TX + AI + Jackpot)
  Compat/PackRes.cs
  Assets/
  Views/PluginStubView.xaml(.cs)
  v4_js_xoc_dia_live.js
  ThirdParty/WebView2Fixed_win-x64.zip
```

## Module chính
- `MainWindow`:
- Orchestrator trung tâm: config, UI, WebView2 lifecycle, bridge, start/stop task, license/lease, history.
- `Tasks/*`:
- Engine chiến lược cược; mỗi task implement `IBetTask.RunAsync(GameContext, CancellationToken)`.
- `TaskUtil` + `MoneyManager` + `MoneyHelper`:
- Primitive dùng chung cho timing vào cược, place bet, chấm thắng/thua, quản lý vốn.
- `v4_js_xoc_dia_live.js`:
- Scanner scene/canvas + push tick + bet queue + trace.
- `XocDiaSoiVIP389Plugin`:
- Adapter để chạy trong AutoBetHub.

## Dependency giữa các module
- `MainWindow` -> `Tasks/*` qua `IBetTask` và `GameContext`.
- `Tasks/*` -> `TaskUtil`, `MoneyManager`, `MoneyHelper`.
- `MainWindow` <-> JS bridge (`v4_js_xoc_dia_live.js`) qua `WebView2.ExecuteScriptAsync` và `WebMessageReceived`.
- Plugin mode: `XocDiaSoiVIP389Plugin` -> `MainWindow.RunStartupAsync(host)`.
- Resource fallback: `PackRes`/`FallbackIcons` -> `Assets/*`.

## File nào phụ trách gì
- `MainWindow.xaml.cs`: nghiệp vụ runtime gần như toàn bộ.
- `MainWindow.Startup.cs`: startup sequence dùng chung standalone + hub.
- `MainWindow.EmbedMode.cs`: tạo content để nhúng.
- `Models.cs`: model snapshot/totals/decision state.
- `Tasks/*Task.cs`: logic chọn cửa theo từng chiến lược.
- `TaskUtil.cs`: wait window, place bet, judge round, apply money.
- `v4_js_xoc_dia_live.js`: thu thập dữ liệu game + thực thi click cược.
- `WebView2LiveBridge.cs`: bridge wrapper cũ/nhẹ (hiện logic bridge chính vẫn nằm trong `MainWindow`).
- `XocDiaSoiVIP389.csproj`: build mode, resource embed, plugin copy step.

## Data flow
- Input config:
- `%LOCALAPPDATA%\XocDiaSoiVIP389\config.json` + `stats.json` + AI state files.
- Runtime state:
- JS tạo snapshot -> C# deserialize `CwSnapshot` -> lưu `_lastSnap` (lock) -> cập nhật UI và feed tasks.
- Bet history:
- Khi bet issue: add pending row `_pendingRows` + `_betAll`.
- Khi có kết quả: finalize pending -> ghi `logs/bets-yyyyMMdd.csv`.

## WebSocket packet flow
- Mặc định: không parse packet WS thật ở C#.
- Nguồn dữ liệu chính là JS tick (`abx:tick`) đã tổng hợp từ scene/canvas.
- Optional debug:
- C# bật CDP `Network.webSocket*` events khi `TXLS_CDP_TAP=1`.
- URL WS map theo `requestId` và có sanitize preview trước log.

## UI update flow
- `WebMessageReceived` nhận `abx:*` -> parse -> `Dispatcher.BeginInvoke` cập nhật controls:
- progress bar/time, trạng thái phiên, chuỗi kết quả, side/stake/winloss, số dư.
- Strategy tab runtime state (`StrategyTabState`) là source of truth cho mini panel và stats.
- Khi đổi tab: apply config + runtime state của tab đó vào UI.

## OCR/canvas flow (nếu có)
- Không dùng thư viện OCR ngoài.
- JS đọc trực tiếp Cocos scene/canvas text map (`buildTextRects`, `sampleTotalsNow`, `readTKSeq`).
- Dùng `tail path + x/y` để nhận diện label/tổng tiền/kết quả.
- Có `cw_page_probe` để xác nhận đúng frame/page game trước khi boot scanner.
