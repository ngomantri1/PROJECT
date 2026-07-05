# PROJECT CONTEXT

## Tong quan
- Project WPF/.NET 8 cho tool auto bet Xoc Dia live, chay doc lap hoac duoc AutoBetHub load nhu plugin.
- UI chinh la `MainWindow`; game web duoc nhung bang WebView2; logic game duoc inject qua `v4_js_xoc_dia_live.js`.
- URL game mac dinh hien tai lay thang tu `DEFAULT_URL`: `https://v.hitclub.yoga/`; khong dung `LEGACY_URL`/migration URL cu.
- Cac chien luoc dat cuoc nam trong `Tasks/*Task.cs`, cung dung `IBetTask` + `GameContext`.
- Debug build copy DLL plugin sang `..\AutoBetHub\Plugins`; Release publish single-file EXE.

## Cong nghe
- C# 12 / .NET 8 Windows / WPF.
- Microsoft WebView2.
- ABX.Core plugin API: `IGamePlugin`, `IGameHostContext`.
- Embedded JS resource: `v4_js_xoc_dia_live.js`.
- Local config/log/state trong AppData/Local va thu muc app/plugin.

## Flow hoat dong chinh
- `Window_Loaded` load config, init icon/UI, init WebView2, dang ky bridge, inject JS, navigate URL neu co.
- Plugin mode: `XocDiaTuLinhHitPlugin.CreateView()` tao `MainWindow`, inject resource anh, show window, goi `RunStartupAsync(host)`.
- Start bet: `PlayXocDia_Click` save config, ensure WebView/JS bridge, wait game data, rebuild stake, tao `CancellationTokenSource`, chon `IBetTask`, chay task tren background.
- Stop bet: `StopXocDia_Click` cancel task tab hien tai; neu khong con tab chay thi clear cooldown, stop timer/license lease.
- Task loop: cho round/start window -> quyet dinh side/stake -> `TaskUtil.PlaceBet()` -> cho seq doi -> judge win/loss -> update UI/money state.

## Websocket / WebView flow
- JS hook trong game/cocos scan canvas/node state va push JSON ve C# bang `chrome.webview.postMessage`.
- `WebView2LiveBridge` va bridge noi bo trong `MainWindow` inject:
  - `TOP_FORWARD`: forward message tu frame/top ve host.
  - `FRAME_SHIM`: fallback frame -> parent/top neu `chrome.webview` loi.
  - `FRAME_AUTOSTART`: doi `__cw_startPush` san sang roi bat push.
  - `v4_js_xoc_dia_live.js`: exposes `__cw_startPush`, `__cw_stopPush`, `__cw_bet`, `cwBet`.
- `EnsureWebReadyAsync` gan `WebMessageReceived` dung 1 lan; `tick` cap nhat `_lastSnap`, UI, NI sequence va finalize pending bet.
- Start flow bat push moi 240ms: `window.__cw_startPush && window.__cw_startPush(240)`.
- Tick JS gui `prog` dang ratio `0..1`; nguon progress HIT duy nhat la `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/HUD/countDownProgress` (`cc.ProgressBar.progress`), khong fallback countdown/text tail cu. `progSec/progTail` neu co chi la field debug phu, khong dung lam nghiep vu.
- Status game tinh truc tiep tu `prog`: `prog > 0` la `Chờ đặt cược`, `prog = 0` hoac khong doc duoc la `Chờ kết quả`; C# hien `Chờ đặt cược` mau xanh la cay, `Chờ kết quả` mau do.

## Pending flow
- Khi JS gui `{abx:"bet"}`, C# tao `BetRow` placeholder va dua vao `_pendingRows`.
- Khi `tick` thay `seq` doi so voi `_baseSeq`, van cu dong lai; C# tinh ket qua CHAN/LE va goi `FinalizeLastBet`.
- `FinalizeLastBet` cap nhat Result/WinLose/Account cho tat ca `_pendingRows`, append CSV, refresh page, sau do clear pending.
- Task 17 `JackpotMultiSideTask` dung `FinalizePendingBetsWithWinners` vi mot van co nhieu cua thang.

## Threading/UI rules
- Moi update WPF UI phai qua `Dispatcher.Invoke/BeginInvoke/InvokeAsync`.
- Snapshot game dung `_snapLock`; task chi doc qua `GameContext.GetSnap`.
- `EvalJsAsync` phai chay tren UI Dispatcher vi WebView2 la UI component.
- Moi task phai ton trong `CancellationToken`.
- `TaskUtil.PlaceBet` da co gate/cooldown theo tab; khong dat cuoc truc tiep neu khong can.
- Canvas Watch phai luon co the hien bang `window.__cw_show_panel()`; JS co `_panelWatchdog` ep panel hien va clear trong `teardown`.

## Coding rules
- Khong rewrite code lon trong `MainWindow.xaml.cs` neu khong can; file nay dang gom nhieu flow cu/moi.
- Them chien luoc moi bang class rieng implement `IBetTask`, dang ky trong switch `_cfg.BetStrategyIndex`.
- Dung `GameContext` de truy cap snap, JS, log, UI callback, stake, money strategy.
- Dung `MoneyManager`/`MoneyHelper` cho quan ly von; khong duplicate logic tien trong task moi.
- Bat loi o boundary voi WebView/JS/plugin de khong lam sap Hub.

## Naming rules
- Task id nen kebab-case hoac namespace-like stable (`smart-prev`, `ai15.expert.panel`).
- Side chuan: `CHAN`, `LE`, `SAP_DOI`, `TRANG3_DO1`, `DO3_TRANG1`, `TU_TRANG`, `TU_DO`.
- Ket qua seq digit: `0/2/4 => CHAN`, `1/3 => LE`; ball result `BALL0..BALL4`.
- Money strategy id dang dung: `IncreaseWhenLose`, `IncreaseWhenWin`, `Victor2`, `ReverseFibo`, `IncreaseEveryRound`, `MultiChain`, `WinUpLoseKeep`.

## Rule quan trong
- Khong pha `__cw_bet` queue trong JS; C# co the goi lien tiep, JS tu serialize.
- Khong gan `WebMessageReceived` nhieu lan.
- Khong auto doi UI mode dua tren URL/isGame; comment code da ghi giu nguyen hanh vi nay.
- Neu sua URL game, chi sua `DEFAULT_URL` va `IsGameUrlLike`; khong them `LEGACY_URL` khi user yeu cau lay thang DEFAULT_URL.
- Khong xoa resource/image injection trong plugin, vi XAML va converter can StaticResource/shared icons.
- Khong doi cach tinh win tax: mac dinh win delta * 0.98, Task 17 co payout rieng.
- Khong bo wait bridge/game data truoc khi start task; no tranh crash khi chua co seq/cocos.
- Khong doi `prog` sang giay tho trong packet chinh; task hien dang so sanh `prog` voi `DecisionPercent` theo ratio.
- Countdown/progress HIT dung 1 nguon `HUD/countDownProgress`; khong dung fallback `lbl_countdown`, khong doi `prog` sang giay tho.
- Tong cuoc 7 cua HIT dung tail `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/ListLabel/TotalMoney`, gom theo layout 2 dong: top[1]=CHAN, top[0]=LE, bottom[0]=SAP_DOI, bottom[1]=DO3_TRANG1, bottom[2]=TRANG3_DO1, bottom[3]=TU_TRANG, bottom[4]=TU_DO.
- Ten nhan vat doc tu `RoomScenebinhThuongXocDia/FootterRoomUi/Left/buttonName/NameUser`; tai khoan doc bang cach tim `PlayerViewXocDia/PlayerName/name` khop ten nhan vat roi lay `PlayerName/Mn/mn` trong cung subtree, de tranh nhay sang nguoi choi khac.
- Scan phinh/chip: `Scan200Text` co block `(Chip scan from Scan200Text)` lay tu `cwScanChips`; cac tail phinh dang o `ld_bg/btnChoseCoin/New Node/zcontent/Entry_2..Entry_9`.

## Nhung dieu tuyet doi khong duoc pha
- Host/plugin lifecycle: `CreateView`, `Stop`, `ShutdownFromHost`, cleanup WebView/CTS/lease.
- Snapshot lock va Dispatcher rules.
- Bet history pending/finalize logic; khong add lai row khi finalize.
- Gate/cooldown chong ban dup trong `TaskUtil.PlaceBet`.
- Embedded resource `v4_js_xoc_dia_live.js` va build target copy plugin sang Hub.
- Multi-tab runtime state trong `StrategyTabState`; dung active tab dung cach.
- Canvas Watch overlay phuc vu debug/van hanh; khong an `root.style.display='none'`, khong xoa `__cw_show_panel`/watchdog neu chua co thay the.
- Khi sua totals/account/status/progress trong JS, khong fallback ve tail nghiep vu cu neu da chot tail HIT moi; sai tail se lam UI nhay gia tri hoac hien `--`.
