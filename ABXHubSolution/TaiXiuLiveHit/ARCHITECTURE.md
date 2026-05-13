# ARCHITECTURE

## Cập nhật hôm nay (2026-05-13)
- Thêm `Tasks/SmartPrevAdvancedTask.cs` cho chiến lược 18.
- `CmbBetStrategy` đã có item `18) Bám cầu trước nâng cao`.
- Mapping task trong `MainWindow.xaml.cs` đã hỗ trợ index `17`.
- Guard load config strategy index đổi từ `<=16` sang `<=17`.

## Cấu trúc project
- `MainWindow.xaml` / `MainWindow.xaml.cs`: UI + orchestration runtime.
- `MainWindow.Startup.cs`: startup pipeline standalone/plugin.
- `MainWindow.EmbedMode.cs`: embed mode cho Hub.
- `WebView2LiveBridge.cs`: bridge inject/reinject cho top doc/frame.
- `v4_js_xoc_dia_live.js`: đọc dữ liệu game + đặt cược.
- `Tasks/`: chiến lược + utility bet/money.
- `TaiXiuLiveHitPlugin.cs`: adapter plugin.
- `Models.cs`: snapshot/totals/decision model.

## Module chính
- UI/Orchestrator: `MainWindow*`.
- Bridge: `WebView2LiveBridge` + JS bridge.
- Strategy Engine: `Tasks/*.cs` (`18` strategy).
- Money Engine: `MoneyManager`, `MoneyHelper`.
- Persistence: config/stats/bet logs/AI state.
- License/Trial/Lease: trong `MainWindow.xaml.cs`.

## Dependency giữa module
- `MainWindow` -> `Tasks` (build context, start/stop).
- `Tasks` -> `TaskUtil` -> `EvalJsAsync` -> JS.
- `MainWindow` -> WebView2 -> JS bridge -> `postMessage` -> `MainWindow`.
- `MainWindow` -> money engine cho stake/result update.
- `MainWindow` -> filesystem cho config/stats/log/state.

## File trách nhiệm chính
- `MainWindow.xaml.cs`:
- lifecycle web/app
- `WebMessageReceived`
- tab runtime
- play/stop/finalize
- `Tasks/TaskUtil.cs`:
- wait bet window
- place bet (`__cw_bet`)
- judge round
- post-round money
- `Tasks/SmartPrevTask.cs`:
- chiến lược 5 (seg1/seg3 rule cũ)
- `Tasks/SmartPrevAdvancedTask.cs`:
- chiến lược 18 (seg1/seg3 rule mới)
- `v4_js_xoc_dia_live.js`:
- push `tick`
- bet queue
- `bet/bet_error/bet_perf`

## Data flow
1. JS scan scene -> emit `tick`.
2. C# parse tick -> cập nhật `_lastSnap` + UI.
3. Task đọc snapshot qua `GameContext.GetSnap()`.
4. Task quyết định side/stake -> `PlaceBet`.
5. JS xử lý queue cược và trả event.
6. C# finalize pending rows khi round chốt.

## Websocket packet flow
- CDP `Network.enable` bật receiver cho:
- `webSocketCreated`
- `webSocketFrameReceived`
- `webSocketFrameSent`
- Packet flow hiện là observer; nghiệp vụ vẫn dùng bridge tick.

## UI update flow
- Source-of-truth runtime: `_lastSnap` + `StrategyTabState`.
- Tick update: progress, status, account, seq/result.
- Task callback update: side/stake/win-loss/level/win total/stats.
- Tất cả update UI qua `Dispatcher`.

## OCR/canvas flow
- Không dùng OCR lib.
- Dùng Cocos scene traversal + tail matching trong JS.
- Dùng `PointerEvent` lên canvas để click chip/side/confirm.
- Có fallback source cho progress/seq/totals/username.
