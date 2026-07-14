# ARCHITECTURE

## Cau Truc Project
- `App.xaml`, `App.xaml.cs`: WPF app entry/resource.
- `MainWindow.xaml`: UI chinh, WebView2, controls cau hinh/chien luoc/history.
- `MainWindow.xaml.cs`: logic chinh cua app.
- `MainWindow.Startup.cs`: startup flow dung chung standalone/plugin.
- `MainWindow.EmbedMode.cs`: tao content nhung vao Hub neu can.
- `XocDiaLiveHit0Plugin.cs`: ABX Hub plugin wrapper.
- `WebView2LiveBridge.cs`: bridge inject JS vao top/frame WebView2.
- `v4_js_xoc_dia_live.js`: JS doc game, snapshot, click/dat cuoc.
- `Models.cs`: `CwSnapshot`, `CwTotals`, `DecisionState`.
- `Tasks/`: cac chien luoc cuoc va money helper.
- `Assets/`: icon side/result/sequence.
- `Compat/PackRes.cs`: merge/fallback resource.
- `Views/PluginStubView.*`: control stub tra ve cho Hub khi window plugin da mo rieng.

## Module Chinh
- UI Shell: `MainWindow.xaml(.cs)`.
- Web runtime: WebView2 init, fixed runtime extraction, navigation, auto-login.
- Bridge: `WebView2LiveBridge` + bridge code duplicate trong `MainWindow`.
- Strategy runtime: `IBetTask`, `GameContext`, `TaskUtil`, `MoneyManager`.
- History/runtime stats: `BetRow`, `_betAll`, `_pendingRows`, CSV `bets-*.csv`.
- Plugin integration: `XocDiaLiveHit0Plugin`, `PluginProbe`, resource injection.
- License/trial: license fetch/lease/heartbeat trong `MainWindow.xaml.cs`.

## Dependency Giua Module
- `XocDiaLiveHit0Plugin` -> `MainWindow`, `PackRes`, ABX.Core.
- `MainWindow` -> WebView2, `Tasks`, models, assets converters.
- `Tasks/*` -> `GameContext`, `TaskUtil`, `MoneyManager`.
- `GameContext` -> delegate do `MainWindow.BuildContext()` gan.
- `TaskUtil.PlaceBet()` -> `ctx.Ui*` + `ctx.EvalJsAsync("__cw_bet")`.
- `v4_js_xoc_dia_live.js` -> game DOM/Cocos/canvas + `chrome.webview.postMessage`.

## File Phu Trach
- `MainWindow.xaml.cs`
  - config/stats/load-save.
  - WebView2 lifecycle/navigation.
  - JS message handler.
  - multi-tab strategy runtime.
  - start/stop task.
  - bet history/pending/finalize.
  - license/trial/lease.
- `WebView2LiveBridge.cs`
  - register scripts on document created.
  - inject app JS vao iframe.
  - auto-start push khi Cocos san sang.
- `TaskUtil.cs`
  - wait bet window/new round.
  - place bet with per-tab gate/cooldown.
  - wait round finish and judge win/loss.
- `MoneyManager.cs`, `MoneyHelper.cs`
  - stake progression strategies.
- `AiOnlineNGramTask.cs`
  - AI n-gram local learning, state file.
- `AiExpertPanelTask.cs`
  - AI Expert Panel/Top10/regime.
- `JackpotMultiSideTask.cs`
  - multi-side jackpot betting, custom finalize winners.

## Data Flow
- JS snapshot -> WebMessage -> deserialize `CwSnapshot`.
- `MainWindow` stores latest snapshot in `_lastSnap`.
- `IBetTask` reads snapshot through `ctx.GetSnap()`.
- Task decides side/stake, uses `MoneyManager`.
- `TaskUtil.PlaceBet()` updates UI side/stake, calls JS `__cw_bet`.
- JS executes click/bet in canvas/Cocos and posts `abx=bet` or `bet_error`.
- C# adds pending row, waits for seq change, finalizes win/loss.

## WebSocket Packet Flow
- Network/CDP:
  - `EnableCdpNetworkTapAsync()` logs selected WS/network packets.
  - `IsInteresting()` filters hints: websocket/xoc/live/socket.
  - This is diagnostic only.
- Game data:
  - Actual app decisions use bridge snapshots from JS, not raw WS packets.
  - `tick` contains progress, totals, username, seq, status.

## UI Update Flow
- `WebMessageReceived` receives message on WebView callback.
- Heavy state update is protected; UI update uses `Dispatcher.BeginInvoke`.
- Strategy tasks call `ctx.UiDispatcher.InvokeAsync/Invoke`.
- Tab runtime UI:
  - `UpdateTabSide()`, `UpdateTabStake()`, `UpdateTabWin()`, `UpdateTabWinLoss()`.
  - Active tab mirrors values to visible labels.
- Bet grid:
  - `_betAll` holds newest-first records.
  - `_betPage` is current page ObservableCollection.
  - `ShowFirstPage()` if auto-follow newest.

## OCR / Canvas / Cocos Flow
- Khong thay OCR engine C# rieng.
- JS doc game bang Cocos scene/canvas/text map:
  - collect progress.
  - sample totals by coordinate/path.
  - read TK result sequence.
  - click chip/side/button in canvas/Cocos.
- Canvas click helpers nam trong `v4_js_xoc_dia_live.js` (`clickAtWin`, `clickRectCenter`, `clickableOf`, `cwBet`).
- UI C# chi nhan ket qua da chuan hoa qua bridge.

## Strategy Index Hien Tai
- `0`: `SeqParityFollowTask`
- `1`: `PatternParityTask`
- `2`: `SeqMajorMinorTask`
- `3`: `PatternMajorMinorTask`
- `4`: `SmartPrevTask`
- `5`: `RandomParityTask`
- `6`: `AiStatParityTask`
- `7`: `StateTransitionBiasTask`
- `8`: `RunLengthBiasTask`
- `9`: `EnsembleMajorityTask`
- `10`: `TimeSlicedHedgeTask`
- `11`: `KnnSubsequenceTask`
- `12`: `DualScheduleHedgeTask`
- `13`: `AiOnlineNGramTask`
- `14`: `AiExpertPanelTask`
- `15`: `Top10PatternFollowTask`
- `16`: `JackpotMultiSideTask`
