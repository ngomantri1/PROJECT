# Architecture

## Cau truc project

```text
BaccaratEzugiCasino/
- App.xaml, App.xaml.cs
- MainWindow.xaml
- MainWindow.xaml.cs
- MainWindow.Startup.cs
- MainWindow.EmbedMode.cs
- WebView2LiveBridge.cs
- Models.cs
- BaccaratEzugiCasinoPlugin.cs
- PluginProbe.cs
- ProgressWidthConverter.cs
- SeqIconVM.cs
- Compat/
  - PackRes.cs
- Views/
  - PluginStubView.xaml(.cs)
- Tasks/
  - cac chien luoc IBetTask + MoneyHelper/MoneyManager/TaskUtil/GameContext
- Assets/
  - icon / image resource
- ThirdParty/
  - WebView2Fixed_win-x64.zip
- v4_js_xoc_dia_live.js
- worker.js
- devtool_*.js
```

## Module chinh

- `App.xaml.cs`
  - global exception logging.
- `MainWindow*`
  - UI, config, stats, WebView lifecycle, bridge, popup routing, license/lease, betting runtime, history settlement.
- `Tasks/*`
  - strategy engine doc lap theo `IBetTask`.
- `v4_js_xoc_dia_live.js`
  - boot game hook, authority scout, push snapshot, bet queue/click, canvas-watch panel, network hooks phia JS.
  - hien co them logic rieng cho `play.livetables.io/baccarat`:
    - panel visibility default reset,
    - game popup detection,
    - exact balance tail,
    - countdown `span.seconds`,
    - smoothing display countdown tren panel.
- `WebView2LiveBridge.cs`
  - bridge wrapper doc lap cho inject/hook frame.
  - hien tai bi overlap mot phan voi logic bridge nam ngay trong `MainWindow`.
- `worker.js`
  - lease/trial/acquire/heartbeat/release.
- `BaccaratEzugiCasinoPlugin.cs`
  - adapter giua app va `ABX.Core`.

## Dependency giua cac module

- `MainWindow` phu thuoc:
  - `Models`
  - `Tasks`
  - `PackRes`
  - `WebView2`
  - `ABX.Core` khi chay plugin.
- `Tasks/*` chi phu thuoc:
  - `GameContext`
  - `TaskUtil`
  - `MoneyHelper/MoneyManager`
  - `Models` gian tiep qua snapshot.
- `BaccaratEzugiCasinoPlugin` tao `MainWindow` va goi `RunStartupAsync(host)`.
- `worker.js` doc lap voi app runtime, chi dung qua HTTP.

## File nao phu trach gi

- `MainWindow.xaml`: layout WPF, login, strategy tabs, money config, status, bet history grid.
- `MainWindow.xaml.cs`
  - config/stats persistence
  - runtime profile
  - WebView + popup host
  - bridge inject/reinject
  - authority frame lock
  - CDP tap va parse packet
  - startup perf probe va UI queue timing log
  - seq/context synchronization
  - csharp display snapshot push-back sang JS panel
  - WPF countdown interpolation cho `PrgBet` + `LblProg`
  - start/stop strategy
  - pending/finalized bet history
  - license/trial/lease
- `MainWindow.Startup.cs`: startup flow chuan.
- `Models.cs`: `CwSnapshot`, `CwTotals`, `FrameScoutSnapshot`, `DecisionState`.
- `Tasks/GameContext.cs`: contract giua UI/runtime va strategy.
- `Tasks/TaskUtil.cs`: place bet, wait round, dedupe send, cooldown, settle don gian.
- `Tasks/MoneyHelper.cs`, `Tasks/MoneyManager.cs`: quan ly von.
- `v4_js_xoc_dia_live.js`:
  - detect game frame
  - build context/frame scout
  - authority mode
  - read seq/status/totals
  - push snapshot ve host
  - click chip/cua cuoc/confirm
- `worker.js`: khoa 1 account/1 session bang KV TTL.

## Data flow

1. Page/frame load trong WebView2.
2. C# inject JS vao top doc va frame.
3. JS doc DOM/canvas/Cocos, build snapshot `CwSnapshot` va `FrameScoutSnapshot`.
4. Snapshot ve C# qua `WebMessageReceived`.
5. C# chon authority frame.
6. Song song, CDP doc:
   - WebSocket winner/history/bet pool
   - HTTP response body quan trong
7. C# merge DOM snapshot + network seq/context.
8. C# co the gui snapshot authoritative da hop nhat nguoc lai JS de panel debug hien cung 1 state.
9. `BuildContext()` cung cap snapshot authoritative cho strategy task.
10. Strategy goi `PlaceBet()` -> JS `__cw_bet_enqueue`.
11. Khi winner ve, history pending duoc settle va UI/stat duoc refresh.

## Countdown / Progress flow

- Nguon countdown moi cho `play.livetables.io` la `span.seconds`.
- JS panel va WPF UI khong nen doc lai countdown tu UI text ben ngoai.
- Flow dung la:
  1. DOM/authority snapshot dua ra `raw prog`.
  2. JS panel noi suy `display prog` cho canvas panel.
  3. C# UI noi suy `display prog` cho `PrgBet` + `LblProg`.
- `raw prog` van quan trong cho authority/log; `display prog` chi phuc vu UX.
- Tinh den 2026-05-10:
  - C# dung `DispatcherTimer` 100ms de repaint `PrgBet/LblProg`.
  - C# dung them `System.Threading.Timer` 220ms de trace countdown nen.
  - JS dung hold-window `UI_PROG_HOLD_MS = 14000` de giu nhip display khi raw tick den thua.
  - Van co kha nang thay raw jump `12 -> 6 -> 0`, nen muc tieu hien tai la giu `display` giam deu 1s trong khi van ton trong raw authority.
- Logging countdown da bo sung ro 3 lop:
  - C#: `[COUNTDOWN][UI][RAW]`
  - C#: `[COUNTDOWN][UI][DISPLAY]`, `[COUNTDOWN][TRACE]`
  - JS: `CWDBG COUNTDOWN raw/display`

## WebSocket packet flow

- `CoreWebView2.CallDevToolsProtocolMethodAsync("Network.enable")`
- Subscribe:
  - `Network.webSocketCreated`
  - `Network.webSocketFrameReceived`
  - `Network.webSocketFrameSent`
  - HTTP response related events
- Packet duoc loc theo URL/payload hint.
- Cac nhanh chinh:
  - `TryProcessNetworkWinnerPayload/Packet`
  - `TryProcessNetworkHistoryPayload`
  - `TryProcessNetworkBetPoolPayload`
- Winner packet co the:
  - append seq binh thuong,
  - seed block cho DOM bootstrap,
  - settle late-context pending.

## UI update flow

- Snapshot moi -> `HandleIncomingWebMessageAsync()` -> update `_lastSnap`.
- Sau do UI dung:
  - `UpdateSeqUI`
  - `SetLastResultUI`
  - cac label status/progress/totals
- Strategy tab update qua callback trong `GameContext`:
  - `UiSetSide`
  - `UiSetStake`
  - `UiRecordBetIssued`
  - `UiAddWin`
  - `UiWinLoss`
  - `UiSetWinLossText`
  - `UiSetChainLevel`
- Bet history grid dung `_betAll`, `_betPage`, `_pendingRows`.

## Authority / popup routing

- `Web` la host page chinh.
- `PopupWeb` duoc mo khi provider launch game ra cua so phu hoac iframe can tach.
- `GetBetWebView()` chon noi bet thuc su.
- `frame_scout` lien tuc cham diem frame theo:
  - URL
  - visibility
  - game signals
  - bead road / zone bet / canvas / cocos
- Frame tot nhat duoc lock thanh `_authorityContextId`.
- Chi tick thuoc authority moi duoc dung lam snapshot hop le.

## Canvas flow

- Khong co OCR.
- Co canvas/Cocos flow:
  - JS detect `window.cc`, `canvas`, `bead road`, `zone bet`.
  - JS dung `Canvas Watch` panel de debug snapshot/render.
  - C# co them logic `PushAcceptedDisplayToCanvas` va apply csharp display snapshot nguoc ve JS.
- Canvas panel hien tai da:
  - doc duoc balance exact tail moi tren `play.livetables.io`,
  - doc duoc countdown `span.seconds`,
  - hien duoc `Prog` smoothing.
- Van con bug UX:
  - `Prog` chua luon di theo tung buoc `12 -> 11 -> 10 -> ... -> 0`.
- Noi ngan gon: JS doc game state, C# quyet dinh state authoritative, roi co the day snapshot da chot nguoc lai panel debug.

## Deploy / runtime note

- `v4_js_xoc_dia_live.js` dang duoc nap tu `EmbeddedResource` trong DLL.
- Sua file `.js` tren disk nhung khong rebuild plugin DLL + restart `AutoBetHub` thi runtime se van chay script cu.
- Vi vay, khi bug countdown "khong thay doi", can xac nhan lai log `[Bridge] Loaded JS from embedded: ... sha256=...` de biet host da nap ban moi chua.

## Chien luoc cuoc

- Contract chung: `IBetTask.RunAsync(GameContext, CancellationToken)`.
- Nhom strategy:
  - sequence/pattern thu cong: 1,2,3,4
  - heuristic don gian: 5,6,8,9,11,12,13,17
  - learning/voting: 7,10,14,15,16
- Moi strategy dung cung bet pipe va history settle cua `MainWindow`.

## Diem kien truc can nho

- Day la kien truc `stateful + event-driven`, khong phai MVVM sach.
- `MainWindow.xaml.cs` la "god object".
- Hau het bug kho nam o giao giua:
  - JS snapshot
  - authority frame
  - CDP network seq
  - pending settle
- countdown UX hien tai nam dung o giao giua:
  - DOM countdown source
  - authority snapshot cadence
  - JS display smoothing
  - WPF UI smoothing
  - deploy path (embedded JS trong DLL) de dam bao thay doi code da vao runtime that
