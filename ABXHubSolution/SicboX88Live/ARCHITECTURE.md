# Architecture

## High-Level Shape
- UI shell: `MainWindow.xaml` + `MainWindow.xaml.cs`
- Startup/plugin shell: `MainWindow.Startup.cs`, `MainWindow.EmbedMode.cs`, `SicboX88LivePlugin.cs`
- Game bridge: `v4_js_xoc_dia_live.js`
- Strategy engine: `Tasks/*.cs`
- Shared models/utilities: `Models.cs`, `Tasks/GameContext.cs`, `Tasks/TaskUtil.cs`, `Tasks/MoneyManager.cs`

## Project Structure
- `App.xaml*`: entry WPF
- `MainWindow.xaml`: layout chinh
- `MainWindow.xaml.cs`: runtime core, bridge dispatch, task orchestration, history, license, CDP websocket tap
- `MainWindow.Startup.cs`: startup dung chung host/standalone
- `MainWindow.EmbedMode.cs`: embedded mode cho Hub
- `SicboX88LivePlugin.cs`: adapter `IGamePlugin`
- `Models.cs`: snapshot/totals/state
- `Tasks/*`: strategy + helper
- `Compat/PackRes.cs`: resource fallback
- `v4_js_xoc_dia_live.js`: scan scene, queue bet, debug panel `Canvas Watch`
- `devtools_ws_bet_totals_probe.js`: probe websocket trong DevTools de test 4 tong cuoc ma khong can build app

## Main Modules

### MainWindow Runtime
- Quan ly `WebView2`, inject JS, nhan `WebMessageReceived`.
- Giu `_lastSnap`, update UI, pending rows, CSV, stats.
- Start/stop strategy, license/trial/lease, config tabs.
- Nghe CDP `Network.webSocket*`, parse packet server de override nhung field scene graph khong doc on dinh.

### JS Bridge
- Detect page/frame game.
- Scan `canvas` + `cc.director.getScene()`.
- Lay `prog`, `status`, `seq`, totals, account text, last result.
- Queue click bet.
- Day cac tool debug: `Canvas Watch`, `TextMap`, `MoneyMap`, `BetMap`, `Scan1000Text`, `FindCdTail`, `FindCdDeep`.

### CDP Packet Tap
- Bật trong `MainWindow.xaml.cs`.
- `Network.enable`
- `Network.webSocketCreated`
- `Network.webSocketFrameReceived`
- Dang whitelist socket:
- `wss://livecasino.azhkthg1.net/websocket`
- Packet parser hien tai da lay duoc:
- countdown (`timeBetCountdown`, `timeBet`, `stopBetSecond`, `status`)
- packet state co `bs[]`

### Strategy Engine
- Moi task implement `IBetTask`.
- Doc `GameContext`.
- Quyet dinh side/stake.
- Goi `TaskUtil.PlaceBet`.
- Wait round finish, judge, apply money rule.

## Module Dependencies
- `MainWindow` -> `Models`, `Tasks`, `PackRes`, `ABX.Core`, `WebView2`
- `Tasks/*` -> `GameContext`, `TaskUtil`, `MoneyManager`, `Models`
- `TaskUtil` -> JS bridge API `__cw_bet_enqueue`
- `v4_js_xoc_dia_live.js` -> DOM game, Cocos runtime, `chrome.webview.postMessage`
- Plugin shell -> `MainWindow`, `PackRes`, `ABX.Core`

## File Responsibilities
- `MainWindow.xaml.cs`
- webview lifecycle
- JS loader/inject
- bridge dispatch
- pending/finalize/history
- CDP websocket tap + packet parse
- server-state override cho countdown/status
- `v4_js_xoc_dia_live.js`
- scene traversal
- path/tail matching
- text extraction
- bet zone lookup
- debug panel mount/visibility
- username/account tail mapping
- `Tasks/TaskUtil.cs`
- place bet
- wait/cooldown
- judge result
- money apply

## Data Flow
1. JS scan game -> tao snapshot `tick`.
2. C# deserialize -> update `_lastSnap`.
3. CDP websocket packet neu co field on dinh hon se override mot phan snapshot.
4. UI cap nhat qua `Dispatcher`.
5. Strategy doc snapshot.
6. Strategy enqueue bet qua `TaskUtil`.
7. C# ghi pending row.
8. JS click queue vao canvas.
9. Round doi -> C# finalize pending.

## WebMessage Flow
- JS -> C#
- `tick`
- `home_tick`
- `bet`
- `bet_error`
- `bet_trace`
- `cw_page_probe`
- `cw_ui_state`
- `cw_js_error`
- `game_hint`
- C# -> JS
- `ExecuteScriptAsync(...)`
- `PostWebMessageAsJson(...)`

## Websocket Packet Flow
- Khong can gui them request len server; CDP chi nghe traffic da ton tai.
- `MainWindow.xaml.cs` theo doi `webSocketCreated` va `webSocketFrameReceived`.
- Countdown production da lay tu packet websocket thay vi scene tail.
- Tong cuoc `CHAN/LE/TAI/XIU` dang huong toi packet `bs[]`, nhung chua chot production UI.

## UI Update Flow
- `tick` vao se update:
- progress/prog
- status
- last result
- seq
- username/balance
- mini pending panel
- history/stats
- Countdown/status hien tai co the bi override boi server packet:
- `Prog` lay tu `timeBetCountdown` / fallback `timeBet`
- `Status` map sang `Phiên mới`, `Ngừng đặt cược`, `Đang đợi kết quả`
- `SetStatusText(...)` dong thoi dat mau chu theo trang thai.

## Canvas / Scene Flow
- He thong goc uu tien scene graph Cocos.
- Tren trang moi:
- `Tên nhân vật` da chot tail: `userData/lbl_username`
- `Tài khoản` da chot tail: `userData/lbl_userMoney`
- Countdown giua ban khong co node/tail production-ready.
- Tong cuoc 4 cua hien tai cung chua co tail dang tin cay.

## Countdown Diagnostic Flow
- Nhieu probe DevTools da duoc tao:
- `__cdTailFinder`
- `__cd2`
- `__cd3`
- `devtools_countdown_*`
- Ket luan kien truc:
- countdown giua ban khong nen tiep tuc truy bang tail
- countdown production da chuyen sang CDP websocket

## Bet Totals Diagnostic Flow
- Da thu 2 huong:
- scan tail/scene -> nham `lbl_currentBet`, `ChipPanel/lbl_value`, `last_result`, `popup`, hoac ra `null`
- websocket DevTools probe -> `devtools_ws_bet_totals_probe.js`
- Probe websocket phai hook socket truoc khi game tao websocket, nen can `Snippet + reload`.

## Current Architecture Risks
- `MainWindow.xaml.cs` rat lon, coupling cao.
- `v4_js_xoc_dia_live.js` vua scan scene, vua click, vua log, vua mount debug UI.
- Bridge dang rat nhay cam voi thay doi tail/path/layout trang game.
- Loader JS uu tien file disk truoc embedded; tot cho debug nhanh, nhung tang rui ro lech version neu session cu chua reload.
- 4 tong cuoc `CHAN/LE/TAI/XIU` dang o giai doan hybrid: scene tail da fail, websocket packet dang debug de chuyen sang production.
