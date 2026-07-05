# ARCHITECTURE

## Cau truc project
- `XocDiaTuLinhHit.csproj`: WPF app/plugin build rules, WebView2 package, embedded JS, resource images, copy Debug plugin sang Hub.
- `App.xaml`, `App.xaml.cs`: WPF application shell.
- `MainWindow.xaml`: UI chinh.
- `MainWindow.xaml.cs`: logic UI, config, WebView2, bridge, license, tab/task runtime, bet history.
- `MainWindow.Startup.cs`: startup dung chung cho standalone/plugin.
- `MainWindow.EmbedMode.cs`: tao content nhung vao Hub theo embedded mode.
- `XocDiaTuLinhHitPlugin.cs`: ABX Hub plugin adapter.
- `WebView2LiveBridge.cs`: bridge helper rieng de inject JS/top/frame/autostart.
- `Models.cs`: DTO `CwSnapshot`, `CwTotals`, `DecisionState`.
- `Tasks/`: cac strategy va helper dat cuoc.
- `Assets/`, `Assets/Images.xaml`, `Compat/PackRes.cs`: icon/resource fallback.
- `v4_js_xoc_dia_live.js`: scan canvas/cocos, map bet buttons/chips, push tick, queue bet.
- Game entry URL: `MainWindow.DEFAULT_URL = https://v.hitclub.yoga/`; `IsGameUrlLike` nhan host `v.hitclub.yoga`.

## Module chinh
- UI/runtime: `MainWindow`.
- Plugin boundary: `XocDiaTuLinhHitPlugin`, `PluginStubView`.
- Browser bridge: `EnsureWebReadyAsync`, `EnsureBridgeRegisteredAsync`, `WebView2LiveBridge`, JS resource.
- Canvas overlay/debug: `Canvas Watch` trong JS, co `window.__cw_show_panel()` va watchdog giu panel hien.
- Strategy engine: `IBetTask`, `GameContext`, `TaskUtil`, `MoneyManager`, `MoneyHelper`.
- Money/risk: stake CSV, `MultiChain`, cut profit/loss, S7 `WinUpLoseKeep`.
- Bet history: `_betAll`, `_pendingRows`, CSV append, pagination.
- License/lease: license check, trial, expiry countdown, heartbeat.

## Dependency giua module
- Hub -> `XocDiaTuLinhHitPlugin` -> `MainWindow`.
- `MainWindow` -> WebView2 -> injected JS -> game frame/canvas.
- JS -> `chrome.webview.postMessage` -> `MainWindow.WebMessageReceived`.
- `MainWindow` -> `GameContext` -> `Tasks`.
- `Tasks` -> `TaskUtil.PlaceBet` -> `GameContext.EvalJsAsync` -> `window.__cw_bet`.
- `Tasks` -> `MoneyManager/MoneyHelper` -> UI callbacks in `GameContext`.
- `Assets/Compat` -> App/Window resources -> converters/shared icon cache.

## File phu trach gi
- `TaskUtil.cs`: wait round, convert parity, place bet with per-tab gate/cooldown, judge result.
- `GameContext.cs`: contract giua UI/runtime va task.
- `MoneyManager.cs`: quan ly von 1 chuoi.
- `MoneyHelper.cs`: helper stake, update sau round, MultiChain, S7 temp profit.
- `SideRateParser.cs`: parse va normalize cac cua cho Jackpot multi-side.
- `AiExpertPanelTask.cs`: AI panel/guard/contrarian strategy.
- `JackpotMultiSideTask.cs`: dat nhieu cua theo ti le va tinh payout rieng.
- `Top10PatternFollowTask.cs`: follow top pattern 10 trong window 50.

## Data flow
- Game state: JS scan -> `{abx:"tick", prog, progSec, progTail, totals, seq, status, username}` -> deserialize `CwSnapshot` (C# hien dung `prog/totals/seq/status`, extra fields la debug).
- Snapshot: `_lastSnap` duoc update trong lock; task doc qua `ctx.GetSnap()`.
- Start task: UI config -> `ApplyStakeRuntime` -> `BuildContext` -> `IBetTask.RunAsync`.
- Bet decision: task doc `seq/prog/totals` -> chon side/stake -> `PlaceBet`.
- Result: task cho `seq` doi -> judge -> `UiWinLoss`, `UiAddWin`, money update.
- History: JS bet ack -> pending row; tick seq doi -> finalize pending row.

## Websocket packet flow
- Packet chinh tu JS:
  - `abx:"tick"`: snapshot lien tuc, cap nhat UI/snap/status.
  - `abx:"bet"`: bet thanh cong, tao pending history row.
  - `abx:"bet_error"`: log loi bet.
  - `abx:"result"`: response cho eval/await bridge neu co id.
  - `abx:"game_hint"`: synthetic tick/update health.
- JS bet queue:
  - C# goi `window.__cw_bet(side, amount)`.
  - JS push vao `BET_QUEUE`, `processBetQueue()` goi `cwBet` lan luot.
  - JS post `bet` hoac `bet_error` ve C#.
- Countdown/progress:
  - `readCountdownSec()` quet node label theo tail `xdtl_jackpot_anim_right/left/lbl_countdown`, fallback `lbl_countdown`.
  - `collectProgress()` uu tien countdown, quy doi giay ve ratio `0..1`; neu khong co countdown thi fallback `cc.ProgressBar`.
  - JS ghi debug `window.__cw_prog_sec`, `window.__cw_prog_tail`, panel hien `Countdown`/`ProgTail`.

## UI update flow
- `tick` update progress bar, label %, last result, account header, seq UI, status text.
- `MainWindow` hien `PrgBet/LblProg` tu `snap.prog` theo ratio; neu muon hien giay can doc them `progSec` vao model/C#.
- Task update mini panel qua callbacks:
  - `UiSetSide` -> `UpdateTabSide`.
  - `UiSetStake` -> `UpdateTabStake`.
  - `UiAddWin` -> `UpdateTabWin` + cut profit/loss check.
  - `UiWinLoss` -> `UpdateTabWinLoss`.
  - `UiSetChainLevel` -> `SetLevelForMultiChain`.
- Bet history UI sap xep moi nhat truoc; finalize khong insert duplicate.

## OCR/canvas flow
- Khong thay module OCR rieng.
- JS lam canvas/cocos/node scanning:
  - map total bet, money/account, text/status, side buttons, chip buttons.
  - `Scan200Text`, `BetMap`, `MoneyMap`, `CanvasWatch` trong `v4_js_xoc_dia_live.js`.
  - Ket qua seq/totals/status duoc day ve C# qua tick.
- Phinh/chip:
  - `cwScanChips()`/`wideScan()` tim phinh qua Label/RichText/SpriteFrame/node/path.
  - Log da xac nhan tail phinh: `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/btnChoseCoin/New Node/zcontent/Entry_2..Entry_9`.
  - `Scan200Text` in them `(Chip scan from Scan200Text)` de debug amount/x/y/w/h/clickable/tail.
- Canvas Watch visibility:
  - Root id `__cw_root_allin`; global recovery `window.__cw_show_panel()`.
  - `_panelWatchdog` goi `ensureCanvasWatchVisible()` moi 1s va duoc clear trong `teardown()`.

## Flow build/plugin
- Debug co `ABX_HUB`, tham chieu `ABX.Core.dll` cua Hub va copy output vao `AutoBetHub\Plugins`.
- Release self-contained single-file win-x64, co fixed WebView2 zip embedded.
- `PluginProbe` log assembly/ABX.Core load de debug plugin binding.
