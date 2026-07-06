# TODO

## Task dang lam
- Cap nhat context theo chat moi:
  - URL game `https://v.hitclub.yoga/`.
  - Canvas Watch visibility guard.
  - Scan phinh/chip bang `cwScanChips`.
  - Countdown/prog HIT lay tu `HUD/countDownProgress`.
  - Status tinh tu `prog` va C# doi mau xanh/do.
  - Ten nhan vat/tai khoan lay theo tail HIT moi va on dinh theo player khop username.
  - Tong cuoc 7 cua lay tu `ld_bg/ListLabel/TotalMoney` voi mapping layout da chot.
  - Chuoi ket qua HIT da doi sang `ld_bg/box_ketqua`, doc zig-zag 8 cot va map `red@2x=>2`, `white@2x=>1`.

## Task chua hoan thanh / can kiem chung
- Kiem thu day du cac strategy index 0..16 sau cac thay doi gan day trong `MainWindow.xaml.cs`.
- Kiem thu plugin mode trong AutoBetHub: open, stop, close window, reopen, lease release.
- Kiem thu standalone Release voi fixed WebView2 runtime embedded.
- Kiem thu `JackpotMultiSideTask` voi 7 cua, pending history va payout thuc te.
- Kiem thu `MultiChain` voi tung task, dac biet update level UI va reset profit.
- Kiem thu `WinUpLoseKeep` S7 reset flag voi win tax va cut profit/loss.
- Kiem thu URL `https://v.hitclub.yoga/` tren app moi build: canvas load dung, bridge inject dung, khong can `?a=hitclub`.
- Kiem thu `Canvas Watch` sau reload/inject/navigation: panel khong bi an; `window.__cw_show_panel()` phai hien lai panel.
- Kiem thu countdown/prog: `Prog` phai chay theo `HUD/countDownProgress`, mac dinh 0 khi khong dong bo, va ve 0 o trang thai cho ket qua.
- Kiem thu status: `prog > 0` hien `Chờ đặt cược` mau xanh la cay, `prog = 0` hien `Chờ kết quả` mau do.
- Kiem thu tong cuoc 7 cua: CHAN/LE/SAP_DOI/TRANG3_DO1/DO3_TRANG1/TU_TRANG/TU_DO phai khop so tien tren canvas, dac biet mapping top[1]=CHAN, top[0]=LE, bottom[0]=SAP_DOI, bottom[1]=DO3_TRANG1, bottom[2]=TRANG3_DO1, bottom[3]=TU_TRANG, bottom[4]=TU_DO.
- Kiem thu phinh: `Scan200Text` phai in `(Chip scan from Scan200Text)` voi `Entry_2..Entry_9` va amount `1000..5000000`.
- Kiem thu chuoi ket qua: Canvas Watch va UI phai hien du 32 ky tu digit 2/1; convert sang C/L phai khop bang game, vi du `2/1 -> CCCLLLLCLLCLLLLCLLCLLLLCLCLLCLLL`.
- Kiem thu cac chien luoc CHAN/LE sau khi doi seq dai dien 2/1; dac biet `SeqToParityString`, `IsWin`, `SetLastResultUI` van dung.
- Kiem thu Task 17/no hu neu con dung: nguon `box_ketqua` khong phan biet chinh xac `0/1/2/3/4`, can nguon khac neu cham cua dac biet.

## Task can refactor
- Tach `MainWindow.xaml.cs` thanh cac partial ro module:
  - WebView/bridge
  - config/input validation
  - task runtime/tab state
  - bet history
  - license/lease
  - UI helpers/converters
- Giam duplicate giua flow tab moi va legacy (`StartTaskAsync_Legacy`, `StopTask_Legacy`, old Play/Stop).
- Hop nhat bridge logic trong `MainWindow` va `WebView2LiveBridge` de tranh inject/tracking trung.
- Chuan hoa encoding Vietnamese text trong source, mot so file/task hien co mojibake.
- Tao test/unit helper cho `MoneyHelper`, `MoneyManager`, `SideRateParser`, `TaskUtil` parity.
- Tach JS `v4_js_xoc_dia_live.js` thanh cac module logical neu build pipeline cho phep.
- Tach rieng cac helper canvas debug trong JS: progress/countdown, chip scan, overlay panel, bet queue.
- Chuan hoa contract progress: C# nen co field `progSec/progTail` trong `CwSnapshot` neu can hien giay/tail tren UI/log.

## Task uu tien cao
- Bao ve khong dat cuoc dup khi nhieu tab/task hoac JS queue cham: tiep tuc dung `TaskUtil.PlaceBet`.
- Kiem tra `PlaceBet` hien dang set `ok = true` bat ke raw result; can parse result that bai neu JS tra `bet_error/no/err`.
- Kiem tra finalization pending khi seq doi nhung account balance chua cap nhat kip.
- Kiem tra lifecycle cleanup de khong giu WebView frame event/CTS sau khi plugin dong.
- Kiem tra `_activeTask` vs `tab.ActiveTask` trong tick finalize Task 17; dung sai reference co the finalize nham.
- Kiem tra `collectProgress()` moi: `cc.ProgressBar.progress` tu `HUD/countDownProgress` co phu hop voi `DecisionPercent` trong tat ca strategy.
- Kiem tra totals 7 cua sau moi lan game doi layout; neu sai khong fallback tail cu, chay MoneyMap/Scan probe de xac nhan lai layout `TotalMoney`.
- Kiem tra `_panelWatchdog` khong gay leak/nhan timer khi inject lai nhieu lan; `teardown()` da clear nhung can verify.

## Task can test lai
- Start khi dang o Home: auto click Xoc Dia Live, inject JS, wait bridge/game data.
- Reload/navigation frame: script phai reinject va `__cw_startPush` phai tu bat lai.
- Stop/start lien tuc: khong duplicate WebMessageReceived, khong duplicate bet, khong stale cooldown.
- Multi-tab: moi tab co stake/runtime/cooldown rieng, UI active tab hien dung state.
- Bet history pagination: pending row update tai cho, khong add duplicate.
- License/trial expire khi task dang chay: task dung, lease release, UI khong crash.
- Bấm `Scan200Text` sau khi mo panel chip: phinh van scan duoc, WebView khong lag, Canvas Watch khong bien mat.
- Reload game/frame: `__cw_show_panel`, push tick, progress/status/totals/username/account van duoc re-register.

## Ghi chu cho AI coding tiep theo
- Truoc khi sua logic bet, doc `TaskUtil.cs`, `GameContext.cs`, `MoneyHelper.cs`, vung `BuildContext` va `PlayXocDia_Click`.
- Neu sua JS bet flow, doc vung `__cw_bet`, `BET_QUEUE`, `cwBet` trong `v4_js_xoc_dia_live.js`.
- Neu sua pending/history, doc `WebMessageReceived` va `FinalizeLastBet`.
- Neu sua countdown/progress/status, doc `HIT_COUNTDOWN_PROGRESS_TAIL`, `collectProgress`, `statusByProg`, `TaskUtil.WaitUntil*`.
- Neu sua totals/account, doc `TAIL_TOTAL_EXACT`, `pickHitTotalsByLayout`, `TAIL_USERNAME_EXACT`, `TAIL_PLAYER_NAME_EXACT`, `TAIL_ACC_EXACT`.
- Neu sua chuoi ket qua, doc `readBoxKetQuaSeq` trong `v4_js_xoc_dia_live.js`; giu `snap.seq` la digit, khong doi thanh C/L.
- Neu Canvas Watch bi an trong runtime, dung DevTools console: `window.__cw_show_panel && window.__cw_show_panel()`.
