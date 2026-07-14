# PROJECT CONTEXT

## Tong Quan
- Project `XocDiaLiveHit0` la ung dung WPF/.NET 8 cho Xoc Dia Live.
- Chay duoc 2 che do:
  - Standalone EXE khi `Release`.
  - Plugin cho `ABX Hub` khi `Debug` qua `XocDiaLiveHit0Plugin`.
- Muc tieu chinh: mo WebView2, vao game, inject JS bridge, doc snapshot live, chay chien luoc cuoc, ghi lich su bet.

## Cong Nghe
- C# WPF, `net8.0-windows`.
- WebView2 (`Microsoft.Web.WebView2`).
- ABX.Core plugin API (`IGamePlugin`, `IGameHostContext`).
- JavaScript embedded resource: `v4_js_xoc_dia_live.js`.
- Local config/stats/log CSV trong AppData.
- Assets WPF pack resource + fallback file loader cho plugin.

## Flow Hoat Dong Chinh
- `XocDiaLiveHit0Plugin.CreateView()` tao/mo `MainWindow`, inject resource anh, goi `RunStartupAsync()`.
- `RunStartupAsync()` load config, khoi tao WebView2, navigate URL, auto-fill login, apply background.
- `EnsureWebReadyAsync()` tao CoreWebView2, hook events, bat WebMessage.
- Bridge JS duoc inject vao top document va iframe de bat `tick`, `bet`, `bet_error`.
- Khi bam Play:
  - save config, validate input, dam bao `window.__cw_bet` san sang.
  - start `window.__cw_startPush(240)`.
  - chon `IBetTask` theo strategy index.
  - tao `GameContext`, chay task bang `Task.Run`.
- Task doc snapshot qua `ctx.GetSnap()`, dat cuoc qua `TaskUtil.PlaceBet()`, cho ket qua qua `WaitRoundFinishAndJudge()`.

## Coding Rules
- Khong rewrite/doi flow lon neu khong can.
- Uu tien sua nho, giu hanh vi cu.
- Task moi phai implement `IBetTask`, dung `GameContext`, `TaskUtil`, `MoneyManager`.
- Khong tu dinh nghia lai helper trung ten nhu `PlaceBet`, `MoneyManager`, `Log`.
- UI update phai di qua `Dispatcher`/`ctx.UiDispatcher`.
- WebView2 API phai goi tu UI thread neu lien quan control WPF.
- Bat loi bridge/WebView nen log gon, khong crash Hub.

## Naming Rules
- Strategy task: `*Task.cs`, class `sealed`, namespace `XocDiaLiveHit0.Tasks`.
- Side cuoc chuan: `"CHAN"` / `"LE"`.
- Chuoi parity: `C` / `L`; digit result `0,2,4 => C`, `1,3 => L`.
- Chuoi money side: `N` / `I`.
- Packet JS co truong `abx`: `tick`, `bet`, `bet_error`, `result`, `game_hint`.
- Resource key anh quan trong: `ImgCHAN`, `ImgLE`, `ImgTHANG`, `ImgTHUA`, `ImgBALL0..4`.

## Rule Quan Trong
- Debug build copy plugin DLL sang `AutoBetHub\Plugins`.
- Release publish single-file EXE, co fixed WebView2 runtime zip.
- `v4_js_xoc_dia_live.js` la embedded resource, khong duoc quen update/reinject khi sua JS.
- `TaskUtil.PlaceBet()` hien dang co cooldown/gate theo `TabId`; giu de tranh ban dup.
- Multi-tab runtime rieng nam trong `StrategyTabState`, khong dung nham legacy state neu sua flow moi.
- Lich su bet: them row khi nhan `abx=bet`, finalize sau khi co ket qua.

## WebSocket / Packet Flow
- CDP network tap trong `MainWindow` chi dung log packet/debug, khong phai nguon data chinh.
- Nguon data chinh la JS bridge doc state game/Cocos/canvas va post message ve C#.
- JS push snapshot dinh ky:
  - `window.__cw_startPush(240)` tao interval.
  - Gui `{abx:'tick', prog, totals, username, seq, status, ts}`.
- C# `WebMessageReceived` parse JSON, update `_lastSnap`, UI, sequence, pending bet.
- JS dat cuoc:
  - C# goi `window.__cw_bet(side, amount)`.
  - JS enqueue job, goi `cwBet`, post `{abx:'bet'}` neu ok hoac `{abx:'bet_error'}`.

## Pending Flow
- Khi C# nhan `abx='bet'`:
  - tao `BetRow` voi `Result='-'`, `WinLose='-'`.
  - insert vao `_betAll`, add vao `_pendingRows`.
- Khi `tick` phat hien `seq` doi so voi `_baseSeq`:
  - suy ra ket qua moi tu digit cuoi.
  - goi `FinalizeLastBet()` neu co pending va khong phai `JackpotMultiSideTask`.
- `JackpotMultiSideTask` co flow multi-side rieng, finalize qua `FinalizePendingBetsWithWinners()`.
- Sau finalize: cap nhat row, append CSV, clear `_pendingRows`.

## Threading / UI Rules
- Background task chay bang `Task.Run(() => StartTaskAsync(...))`.
- Moi update label/grid/tab state phai dung `Dispatcher.BeginInvoke/Invoke/InvokeAsync`.
- Snapshot `_lastSnap` duoc bao ve bang `_snapLock`.
- Start button co guard `_playStartInProgress`.
- Stop co guard `_stopInProgress`.
- Config save co `_cfgWriteGate`; khong ghi song song.

## Nhung Dieu Tuyet Doi Khong Duoc Pha
- Khong bo `TOP_FORWARD`, `FRAME_SHIM`, `FRAME_AUTOSTART`; chung giu bridge iframe -> host.
- Khong dat cuoc truc tiep bo qua `TaskUtil.PlaceBet()`.
- Khong update WPF UI tu thread task truc tiep.
- Khong clear/re-add bet history khi finalize; row da duoc add o thoi diem `abx=bet`.
- Khong xoa fallback load resource anh; plugin mode phu thuoc vao no.
- Khong doi mapping result digit/parity neu khong co yeu cau nghiep vu ro.
- Khong de exception tu plugin/window cleanup vang len ABX Hub.
