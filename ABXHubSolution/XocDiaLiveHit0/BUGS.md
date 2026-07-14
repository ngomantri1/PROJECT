# BUGS

## Bug Hien Tai / Rủi Ro Cao
- `TaskUtil.PlaceBet()` bo qua ket qua JS:
  - Code hien set `bool ok = true` sau khi `ctx.EvalJsAsync(js)`.
  - Neu JS tra `fail:*` hoac `no`, C# van coi nhu thanh cong va set cooldown.
  - Workaround tam: xem log `[BET-JS]` va `abx=bet_error`; can sua parse result truoc khi update cooldown.
- `window.__cw_bet()` tra `'ok'` ngay khi enqueue:
  - C# co the tiep tuc flow truoc khi click/bet thuc su xong.
  - JS van post `abx=bet_error` neu job fail, nhung caller C# khong cho ket qua do.
- Pending bet dung `_pendingRows` global:
  - Multi-tab cung chay co the tron pending rows neu nhieu tab dat cung luc.
  - Jackpot multi-side co finalize rieng, de sai neu global `_activeTask` khong khop tab.
- `_activeTask` la field global:
  - Multi-tab runtime moi gan `tab.ActiveTask`, nhung mot so finalize logic van check `_activeTask`.
  - Co nguy co finalize sai voi `JackpotMultiSideTask`.
- Nhieu `catch {}` im lang:
  - Loi WebView/JS/resource/history co the bi nuot, kho debug.

## Bug Da Fix / Co Dau Vet Da Xu Ly
- AI15 tung loi duplicate/ambiguous do tu khai bao helper rieng; note noi da sua bang cach dung `TaskUtil` + `MoneyManager` san co.
- Bet history finalize da co comment khong add lai `_betAll`, tranh duplicate row.
- Plugin resource co fallback pack/file loader va `InjectImagesTo()` de fix missing icon trong Hub.
- WebView2 fixed runtime co fallback Evergreen khi fixed runtime fail.
- Start Play co `_playStartInProgress` de chan double-click start song song.

## Bug Chua Fix / Can Xac Minh
- CSV history:
  - `AppendBetCsv()` ghi CSV thu cong, `LoadBetHistoryAsync()` split bang dau phay.
  - Neu field text co dau phay se parse sai.
- Encoding:
  - File note AI15 dang hien mojibake.
  - Mot so comment trong `MoneyManager.cs` bi loi encoding.
- Bridge duplicate:
  - Co the inject lap/khac hanh vi giua `WebView2LiveBridge` va code bridge trong `MainWindow`.
- Cooldown:
  - `ClearBetCooldown()` clear tat ca tab, co the anh huong tab khac neu multi-tab van chay.
- `WaitUntilBetWindow()` dua vao `prog <= DecisionPercent && p > 0`; can xac minh progress la thoi gian con lai hay da troi theo game hien tai.

## Nguyen Nhan Bug Thuong Gap
- Game/iframe load cham lam `__cw_bet` chua ton tai.
- JS inject chua vao dung iframe Cocos.
- DOM/canvas/Cocos path cua game thay doi.
- Snapshot `seq` khong doi hoac doi tre lam pending finalize sai thoi diem.
- WebView callback/background task update UI khong qua Dispatcher.
- Multi-tab dung lan state global va state theo tab.
- `catch {}` lam mat stack trace.

## Workaround Tam Thoi
- Neu bridge chua san sang: goi `ForceRefreshAsync()`, `__cw_startPush(240)`, cho `WaitForBridgeAndGameDataAsync()`.
- Neu icon plugin mat: kiem tra pack URI va file vat ly trong `Assets`.
- Neu bet khong vao: xem log `[BET-JS]`, `[BET][ERR]`, va JS panel/log; C# hien co the van bao ok.
- Neu history sai: xoa/backup `bets-*.csv` trong log dir va load lai.
- Neu WebView loi profile: dung reset WebView profile flow san co.

## Vung Code De Loi
- `MainWindow.xaml.cs`:
  - `EnsureWebReadyAsync()`
  - `WebMessageReceived`
  - `PlayXocDia_Click()`
  - `BuildContext()`
  - `FinalizeLastBet()`
  - `FinalizePendingBetsWithWinners()`
  - license/lease timers
- `TaskUtil.cs`:
  - `PlaceBet()`
  - cooldown/gate dictionaries
  - wait round finish logic
- `v4_js_xoc_dia_live.js`:
  - `__cw_startPush`
  - `__cw_bet`
  - `cwBet`
  - canvas/Cocos click helpers
- `XocDiaLiveHit0Plugin.cs`:
  - window lifetime, resource injection, Hub callback cleanup.
