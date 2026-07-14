# TODO

## Task Dang Lam / Gan Nhat
- AI15 / `AiExpertPanelTask`: da co file task rieng, muc tieu Expert Panel Top10/Guard/Regime.
- File note `tom tat task AI15...txt` dang bi loi encoding hien thi, nhung noi dung noi ve AI15 warm-seed 50, 100 experts, Top10 log.
- Multi-tab strategy runtime da ton tai; legacy wrappers van con de tuong thich.

## Chua Hoan Thanh
- Can test lai AI15 tren du lieu live: warm-seed, Top10 log, switch expert sau thua.
- Can test `JackpotMultiSideTask` finalize winners vi no bo qua finalize mac dinh.
- Can xac nhan `__cw_bet` that su thanh cong, vi JS hien tra `'ok'` ngay sau khi enqueue.
- Can test plugin Debug trong ABX Hub sau moi thay doi resource/bridge.
- Can test Release standalone voi fixed WebView2 runtime zip.

## Can Refactor
- `MainWindow.xaml.cs` qua lon, nen tach dan:
  - WebView2/bootstrap/bridge.
  - Strategy tab runtime.
  - Bet history/pending.
  - License/trial.
  - Auto-login/navigation.
- Bridge logic dang co ca `WebView2LiveBridge.cs` va duplicate trong `MainWindow.xaml.cs`; can hop nhat mot nguon.
- Legacy flow va multi-tab flow dang song song; can xoa legacy khi chac khong con dung.
- Nhieu `catch {}` im lang; nen them log o cac vung quan trong.
- CSV history parse bang `Split(',')`; nen dung CSV parser neu field co dau phay.

## Uu Tien Cao
- Kiem tra bug `TaskUtil.PlaceBet()` dang set `bool ok = true` bat chap ket qua JS.
- Kiem tra start/stop multi-tab co clear cooldown dung tab hay clear global qua `ClearBetCooldown()`.
- Kiem tra pending rows khi nhieu tab cung dat trong cung van.
- Kiem tra `_activeTask` global voi multi-tab: finalize mac dinh dung no de bo qua `JackpotMultiSideTask`, co the sai khi task active theo tab.
- Kiem tra encoding cac file note/log tieng Viet de tranh mojibake.

## Can Test Lai
- Auto-login va click vao Xoc Dia Live tu Home.
- Inject JS vao iframe sau navigation/reload.
- `WaitForBridgeAndGameDataAsync()` voi game load cham.
- Progress threshold `DecisionPercent` va `WaitUntilBetWindow()`.
- NI sequence update khi `seq` doi.
- Bet history paging khi dang xem trang cu.
- Money strategies:
  - `IncreaseWhenLose`
  - `IncreaseWhenWin`
  - `Victor2`
  - `ReverseFibo`
  - `IncreaseEveryRound`
  - `WinUpLoseKeep`
  - MultiChain flow trong `MoneyHelper`.

## Khi Them Strategy Moi
- Tao file trong `Tasks/`.
- Implement `IBetTask`.
- Dung `TaskUtil.WaitUntilBetWindow()` hoac `WaitUntilNewRoundStart()`.
- Dung `TaskUtil.PlaceBet()`.
- Goi `MoneyManager.OnRoundResult(win)` sau moi van.
- Dang ky strategy trong switch cua `PlayXocDia_Click` va legacy switch neu legacy con can.
- Them validate input neu strategy dung `BetSeq`/`BetPatterns`.
