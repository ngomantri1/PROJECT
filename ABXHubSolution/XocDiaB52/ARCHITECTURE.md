# Architecture

## Project Shape
- `MainWindow.xaml`
  - UI chinh: login/navigation, strategy config, status, stats, history
- `MainWindow.xaml.cs`
  - orchestrator trung tam
  - config/state, WebView2 lifecycle, JS message handling, strategy start/stop, pending bet, history, license, lease, UI update
- `MainWindow.Startup.cs`
  - startup flow cho host/plugin mode
- `MainWindow.EmbedMode.cs`
  - tao embedded content cho Hub
- `WebView2LiveBridge.cs`
  - bridge helper cho top/frame injection va autostart
- `v4_js_xoc_dia_live.js`
  - JS inject chinh cho game
- `Tasks/*`
  - engine chien luoc va helper cuoc
- `Models.cs`
  - `CwSnapshot`, `CwTotals`, `DecisionState`
- `XocDiaB52Plugin.cs`
  - adapter plugin cho `ABX.Core`
- `Compat/PackRes.cs`
  - merge resources / icon fallback khi chay plugin

## Main Modules

## UI Layer
- `MainWindow.xaml`
- `SeqIconVM.cs`
- converters trong `MainWindow.xaml.cs`
- trach nhiem:
  - render config/status/history
  - render countdown/progress
  - render chuoi ket qua

## Orchestration Layer
- `MainWindow.xaml.cs`
- trach nhiem:
  - giu app state
  - giu `_lastSnap`
  - nhan message tu JS
  - map strategy combobox -> `IBetTask`
  - finalize pending rows
  - save/load config & stats
  - manage WebView2, trial/license/lease

## Bridge Layer
- `WebView2LiveBridge.cs`
- phan bridge lap lai trong `MainWindow.xaml.cs`
- trach nhiem:
  - inject `TOP_FORWARD`, `FRAME_SHIM`, `FRAME_AUTOSTART`
  - forward message tu frame len host
  - reinject khi document/frame doi

## JS Scan / Bet Layer
- `v4_js_xoc_dia_live.js`
- trach nhiem:
  - scan Cocos scene / node / label / sprite
  - doc `prog`, totals, `seq`, username/account
  - suy ra status
  - queue bet va phat `abx:*`
  - exact scan DOM cuoc/chip moi trong `ld_bg/*`
  - render debug overlay `Canvas Watch`

## Strategy Layer
- `Tasks/IBetTask.cs`
- tung file `Tasks/*.cs`
- trach nhiem:
  - ra quyet dinh dat cuoc theo snapshot
  - dung helper thong nhat de cho vong moi, vao cuoc, cham ket qua

## Money Layer
- `Tasks/MoneyManager.cs`
- `Tasks/MoneyHelper.cs`
- trach nhiem:
  - quan ly step cho cac kieu von
  - ho tro `MultiChain`
  - ho tro `WinUpLoseKeep`

## File Responsibility Map
- `MainWindow.xaml.cs`
  - business orchestrator lon nhat
- `v4_js_xoc_dia_live.js`
  - selector/runtime bridge quan trong nhat ben JS
- `Tasks/GameContext.cs`
  - contract giua orchestrator va strategy
- `Tasks/TaskUtil.cs`
  - common betting/waiting/judge pipeline
  - hien da chua logic nhan dien `seq` sliding window
- `Tasks/MoneyHelper.cs`
  - update state sau moi van
- `Tasks/SideRateParser.cs`
  - parser cho chien luoc multi-side
- `Models.cs`
  - snapshot contract tu JS len C#
- `WebView2LiveBridge.cs`
  - bridge helper phu

## Current Betting DOM
- Bet exact path hien tai:
  - `CHAN` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/btnChan/btn1`
  - `LE` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/btnLe/btn1`
  - `TRANG3_DO1` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/Btn3White/btn1`
  - `DO3_TRANG1` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/Btn3Red/btn1`
  - `TU_TRANG` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/Btn4White/btn1`
  - `TU_DO` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/Btn4Red/btn1`
- `SAP_DOI` khong co tren layout moi dang dung.
- Flow bet layout moi da chuyen sang exact DOM `ld_bg/*` thay cho selector cu `betnode/gate*`.
- Chip exact path hien tai:
  - `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/btnChoseCoin/New Node/zcontent/Entry_*`
  - `Entry_1 = 100`, `Entry_2 = 500`, `Entry_3 = 1000`, ... `Entry_11 = 10000000`

## Current Profile DOM
- Username exact path hien tai:
  - `MainXocDia/Canvas/MainUIParent/RoomScene/FooterRoomUi/Left/avatar/NameUser`
- Account exact path hien tai:
  - `MainXocDia/Canvas/MainUIParent/RoomScene/FooterRoomUi/Left/avatar/moneyLabel`
- Profile scan hien tai da doi sang exact-tail only, khong con fallback ve `HomeScene/*`, `GateHeaderInGame/*` hay `dual/*` cho username/account.

## Data Flow
- Web page / game frame
- JS inject scan scene
- JS tao snapshot
- `chrome.webview.postMessage`
- `WebMessageReceived`
- deserialize `CwSnapshot`
- cap nhat `_lastSnap`
- update UI
- strategy doc `_lastSnap`
- strategy enqueue bet qua JS
- JS phat `abx:'bet'`
- C# tao pending row
- `seq` advance / slide 1 buoc
- finalize bet row / update stats

## Countdown Behavior
- `snap.prog` van la so giay con lai cua cua dat cuoc do JS doc tu countdown bar.
- Countdown UI C# co smoothing cho text va ratio.
- Thanh progress countdown hien su dung thang co dinh `20s`; khong con tu hoc max countdown runtime tu cac gia tri `prog` lon hon `20`.

## Wait Behavior
- Cac strategy dung `TaskUtil.WaitUntilNewRoundStart()` hien dat ngay khi helper nhan ra vong moi va `prog > 0`.
- Cac strategy dung `TaskUtil.WaitUntilBetWindow()` van la nhom vao muon theo `DecisionSeconds`.

## Seq Window Behavior
- Result board B52 hien co the tra `seq` dang cua so truot do dai co dinh.
- `TaskUtil.TryGetSeqAdvance()` da bo sung nhan dien:
  - append kieu cu
  - slide kieu moi
- `TaskUtil.IsSeqResetOrRebuilt()` khong duoc coi slide 1 buoc la reset.

## Runtime Split: Home vs Game
- Home:
  - login/autofill/play helpers
  - `home_tick` neu Home JS ton tai
  - `game_hint` de chuyen UI som
- Game:
  - `tick`
  - bet queue
  - status/countdown/seq/totals
  - finalize pending rows

## Architecture Risks
- `MainWindow.xaml.cs` qua lon va gom qua nhieu trach nhiem.
- Bridge logic dang ton tai o ca `MainWindow` va `WebView2LiveBridge`.
- `v4_js_xoc_dia_live.js` rat lon, de regression khi sua selector.
- Cac task va pending-finalize phu thuoc manh vao chat luong `seq`.
- Pending finalize generic trong `MainWindow` van dang phu thuoc vao du lieu `tick` (`seq`, `totals.A`) thay vi mot event ket qua rieng.
