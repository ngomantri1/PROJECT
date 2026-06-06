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
- `MainWindow.xaml.cs`: runtime core, bridge dispatch, task orchestration, history, license
- `MainWindow.Startup.cs`: startup dung chung host/standalone
- `MainWindow.EmbedMode.cs`: embedded mode cho Hub
- `SicboX88LivePlugin.cs`: adapter `IGamePlugin`
- `Models.cs`: snapshot/totals/state
- `Tasks/*`: strategy + helper
- `Compat/PackRes.cs`: resource fallback
- `v4_js_xoc_dia_live.js`: scan scene, queue bet, debug panel `Canvas Watch`

## Main Modules

### MainWindow Runtime
- Quan ly `WebView2`, inject JS, nhan `WebMessageReceived`.
- Giu `_lastSnap`, update UI, pending rows, CSV, stats.
- Start/stop strategy, license/trial/lease, config tabs.

### JS Bridge
- Detect page/frame game.
- Scan `canvas` + `cc.director.getScene()`.
- Lay `prog`, `status`, `seq`, totals, account text, last result.
- Queue click bet.
- Day cac tool debug: `Canvas Watch`, `TextMap`, `MoneyMap`, `BetMap`, `Scan1000Text`, `FindCdTail`, `FindCdDeep`.

### Strategy Engine
- Moi task implement `IBetTask`.
- Doc `GameContext`.
- Quyết dinh side/stake.
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
- task runtime
- `v4_js_xoc_dia_live.js`
- scene traversal
- path/tail matching
- text extraction
- bet zone lookup
- debug panel mount/visibility
- countdown detection helpers
- `Tasks/TaskUtil.cs`
- place bet
- wait/cooldown
- judge result
- money apply

## Data Flow
1. JS scan game -> tao snapshot `tick`.
2. C# deserialize -> update `_lastSnap`.
3. UI cap nhat qua `Dispatcher`.
4. Strategy doc snapshot.
5. Strategy enqueue bet qua `TaskUtil`.
6. C# ghi pending row.
7. JS click queue vao canvas.
8. Round doi -> C# finalize pending.

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
- Chi phuc vu debug.
- CDP nghe `Network.webSocket*`.
- Log vao file neu bat packet tap.
- Khong co parser business websocket de drive strategy.

## UI Update Flow
- `tick` vao se update:
- progress/prog
- status
- last result
- seq
- username/balance
- mini pending panel
- history/stats
- `Canvas Watch` la UI debug rieng, phai mount duoc ke ca khi `cc` len cham; data scan co the den sau.

## Canvas / Scene Flow
- He thong khong dung OCR pixel truyen thong.
- JS duyet scene graph Cocos, doc `tail/path`, component text, rect.
- Với trang moi:
- path match da phai noi long
- `nodeInGame()` da phai chap nhan nhieu moc path moi
- `TextMap` da fallback quet toan scene neu scan trong game-root that bai
- countdown `Prog` khong con map duoc bang tail cu, nghi nam trong cum `loading_view`, `screen_view`, hoac render kieu khong phai `Label.string`

## Countdown Diagnostic Flow
- In-app debug:
- `FindCdTail`
- `FindCdDeep`
- DevTools helper da duoc tao trong qua trinh debug:
- `__cdTailFinder`
- `__cd2`
- `__cd3`
- Muc tieu:
- quet node/text trong box countdown
- dump `tail`, `text`, `component`, `rect`
- chot exact tail moi ma khong dong vao logic bet

## Current Architecture Risks
- `MainWindow.xaml.cs` rat lon, coupling cao.
- `v4_js_xoc_dia_live.js` vua scan scene, vua click, vua log, vua mount debug UI.
- Bridge dang rat nhay cam voi thay doi tail/path/layout trang game.
- JS loader da cho phep uu tien file disk truoc embedded; tot cho debug nhanh, nhung tang rui ro lech version neu app dang mo session cu.
