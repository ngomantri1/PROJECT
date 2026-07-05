# TODO

## Task dang lam
- Cap nhat context theo chat moi:
  - URL game `https://v.hitclub.yoga/`.
  - Canvas Watch visibility guard.
  - Scan phinh/chip bang `cwScanChips`.
  - Countdown tail/prog moi.

## Task chua hoan thanh / can kiem chung
- Kiem thu day du cac strategy index 0..16 sau cac thay doi gan day trong `MainWindow.xaml.cs`.
- Kiem thu plugin mode trong AutoBetHub: open, stop, close window, reopen, lease release.
- Kiem thu standalone Release voi fixed WebView2 runtime embedded.
- Kiem thu `JackpotMultiSideTask` voi 7 cua, pending history va payout thuc te.
- Kiem thu `MultiChain` voi tung task, dac biet update level UI va reset profit.
- Kiem thu `WinUpLoseKeep` S7 reset flag voi win tax va cut profit/loss.
- Kiem thu URL `https://v.hitclub.yoga/` tren app moi build: canvas load dung, bridge inject dung, khong can `?a=hitclub`.
- Kiem thu `Canvas Watch` sau reload/inject/navigation: panel khong bi an; `window.__cw_show_panel()` phai hien lai panel.
- Kiem thu countdown: panel phai hien `Countdown: <s>` va `ProgTail: .../lbl_countdown`; `Prog` phai chay theo ratio de task vao cuoc dung.
- Kiem thu phinh: `Scan200Text` phai in `(Chip scan from Scan200Text)` voi `Entry_2..Entry_9` va amount `1000..5000000`.

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
- Kiem tra `collectProgress()` moi: countdown ratio `sec/COUNTDOWN_MAX_SEC` co phu hop voi `DecisionPercent` trong tat ca strategy.
- Kiem tra `COUNTDOWN_TAILS`; neu panel van `Countdown: -`, can chay `TextMap/Scan200Text` luc thanh countdown hien de lay tail that.
- Kiem tra `_panelWatchdog` khong gay leak/nhan timer khi inject lai nhieu lan; `teardown()` da clear nhung can verify.

## Task can test lai
- Start khi dang o Home: auto click Xoc Dia Live, inject JS, wait bridge/game data.
- Reload/navigation frame: script phai reinject va `__cw_startPush` phai tu bat lai.
- Stop/start lien tuc: khong duplicate WebMessageReceived, khong duplicate bet, khong stale cooldown.
- Multi-tab: moi tab co stake/runtime/cooldown rieng, UI active tab hien dung state.
- Bet history pagination: pending row update tai cho, khong add duplicate.
- License/trial expire khi task dang chay: task dung, lease release, UI khong crash.
- Bấm `Scan200Text` sau khi mo panel chip: phinh van scan duoc, WebView khong lag, Canvas Watch khong bien mat.
- Reload game/frame: `__cw_prog_tail`, `__cw_prog_sec`, `__cw_show_panel` van duoc re-register.

## Ghi chu cho AI coding tiep theo
- Truoc khi sua logic bet, doc `TaskUtil.cs`, `GameContext.cs`, `MoneyHelper.cs`, vung `BuildContext` va `PlayXocDia_Click`.
- Neu sua JS bet flow, doc vung `__cw_bet`, `BET_QUEUE`, `cwBet` trong `v4_js_xoc_dia_live.js`.
- Neu sua pending/history, doc `WebMessageReceived` va `FinalizeLastBet`.
- Neu sua countdown/progress, doc `readCountdownSec`, `COUNTDOWN_TAILS`, `collectProgress`, `TaskUtil.WaitUntil*`.
- Neu Canvas Watch bi an trong runtime, dung DevTools console: `window.__cw_show_panel && window.__cw_show_panel()`.
