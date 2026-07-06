# BUGS

## Bug hien tai / rui ro dang thay tu code
- `TaskUtil.PlaceBet` hien coi bet la thanh cong vi `ok = true` sau khi goi JS, chua parse chac chan `rRaw`; neu JS tra `no/err` van co the set cooldown va UI nhu da bet.
- Co ca bridge trong `MainWindow` va `WebView2LiveBridge`; neu khong giu guard idempotent co nguy co inject/hook trung.
- `_activeTask` global va `tab.ActiveTask` cung ton tai; tick finalize co check `_activeTask is not JackpotMultiSideTask`, co rui ro sai voi flow multi-tab.
- Nhieu `catch {}` im lang quanh WebView/JS/IO lam kho trace loi that.
- Source co mojibake tieng Viet trong mot so string/comment/task; co the anh huong UI/log va diff sau nay.
- Pending finalize dua vao seq doi va account `totals.A`; neu balance update tre, history Account co the khong dung thoi diem.
- `MultiChain` state trong `GameContext` la ban runtime cua task; can dong bo UI/state can than neu tab switch.
- Totals 7 cua phu thuoc layout `TotalMoney`; neu game doi thu tu label theo dong/x thi can chay MoneyMap probe va cap nhat `pickHitTotalsByLayout`, khong fallback ve tail cu.
- Chuoi ket qua tu `box_ketqua` chi co thong tin mau red/white, nen chi dai dien CHAN/LE bang digit `2/1`; neu chien luoc nao can ket qua dac biet `0/1/2/3/4` that thi can nguon khac.

## Bug da fix / guard da co trong code
- Chong start song song: `_playStartInProgress`.
- Chong stop song song: `_stopInProgress`.
- Chong gan `WebMessageReceived` nhieu lan: `_webMsgHooked`.
- Chong dat dup cung tab/round/side trong 3s: `TaskUtil` cooldown + semaphore theo tab.
- Chay task chi sau khi co bridge/game data: `WaitForBridgeAndGameDataAsync` check `__cw_bet`, cocos scene, `_lastSnap.seq`.
- JS bet da co queue `BET_QUEUE` de serialize nhieu lenh bet.
- Plugin close da goi `ShutdownFromHost`, cleanup WebView va bao Hub `OnPluginWindowClosed`.
- Pending history da fix theo huong insert row luc bet ack, finalize update tai cho, khong add duplicate.
- URL da chot lay thang `DEFAULT_URL = https://v.hitclub.yoga/`; bo `LEGACY_URL`/migration theo yeu cau.
- `IsGameUrlLike` da nhan host `v.hitclub.yoga`.
- `Scan200Text` da scan ra phinh qua `cwScanChips`, log thay `Entry_2..Entry_9` voi amount `1000..5000000`.
- Canvas Watch co `window.__cw_show_panel()` va watchdog ep hien panel, clear trong `teardown`.
- Countdown/progress HIT da chot doc 1 nguon `HUD/countDownProgress`; `prog` giu dang ratio `0..1`.
- Status JS da chot theo `prog`: `prog > 0` la `Chờ đặt cược`, con lai la `Chờ kết quả`; C# hien xanh la cay/do theo status.
- Ten nhan vat/tai khoan da on dinh: ten tu `NameUser`, tai khoan tu player subtree co `PlayerName/name` khop ten nhan vat roi lay `PlayerName/Mn/mn`.
- Tong cuoc 7 cua da doi sang tail HIT `ld_bg/ListLabel/TotalMoney`, mapping hien tai: top[1]=CHAN, top[0]=LE, bottom[0]=SAP_DOI, bottom[1]=DO3_TRANG1, bottom[2]=TRANG3_DO1, bottom[3]=TU_TRANG, bottom[4]=TU_DO.
- Chuoi ket qua da fix cho HIT:
  - Bo nguon cu `thongke1/thongke2/label/num`.
  - Doc `ld_bg/box_ketqua` voi sprite `red@2x`/`white@2x`.
  - Thu tu zig-zag theo cot: cot le tren->duoi, cot chan duoi->tren.
  - Map `red@2x=>2`, `white@2x=>1` de giu contract `snap.seq` dang digit.
  - Da sua bug chi hien 1 ky tu do dedup gom tat ca node khi toa do/rect khong hop le; dung toa do `convertToWorldSpaceAR(cc.v2(0,0))` va chi dedup khi toa do khac `0,0`.

## Bug chua fix / can xu ly
- Parse ket qua `__cw_bet` trong C# va chi set cooldown/lastBet khi JS xac nhan thanh cong.
- Lam ro `_activeTask` global trong flow tab moi; thay bang active tab/task context khi finalize.
- Chuan hoa encoding UTF-8 cho source va resource text.
- Giam silent catch, them log co context o cac boundary quan trong.
- Test/guard account balance khi finalize pending: co the can delay hoac lay balance tu snap dung thoi diem.
- Neu can debug progress sau nay, them log rieng cho `HUD/countDownProgress`; khong them lai fallback countdown label cu.
- Kiem thu lai totals 7 cua trong runtime sau rebuild/reload de xac nhan mapping khop canvas.
- Kiem thu lai chuoi ket qua sau reload/reinject/navigation: phai du 32 digit 2/1, khong quay lai 1 ky tu.
- Neu Task 17/no hu can chay dung theo cua dac biet, can tim nguon ket qua 0..4 that thay vi `box_ketqua` red/white.

## Nguyen nhan bug thuong gap
- WebView2 frame navigation lam mat injected JS; can reinject top/frame/document.
- Cocos/game state chua san sang nhung task da doc `seq` hoac goi `__cw_bet`.
- UI thread violation khi task background update control truc tiep.
- Race giua JS bet ack, tick result, pending row va balance update.
- Duplicate event handler khi init WebView/bridge nhieu lan.
- Money strategy bi doi tren UI khi task dang chay; code da co dong bang `moneyStrategyId` trong context, can giu.
- Overlay Canvas Watch co the bi an khi JS cu con trong WebView cache, khi panel bi keo ra ngoai man hinh, hoac khi inject loi truoc khi tao root.
- `Scan200Text` qua rong co the lam WebView lag; hien da giam va tach chip scan, nhung can giu log vua du.
- Doi `prog` tu ratio sang giay se lam sai `TaskUtil.WaitUntilBetWindow/WaitUntilNewRoundStart`; neu can giay thi dung field rieng `progSec`.
- Dung tail text hoac tail player chung cho tai khoan co the nhay sang nguoi choi khac; phai neo theo username chinh chu.
- Dung tail totals cu `XDLive/Canvas/Bg/footer/listLabel/totalBet` tren HIT se lam totals rong/`--`.
- Dung path seq cu `thongke1/thongke2/label/num` tren HIT se khong ra chuoi ket qua hien tai.
- Dedup seq theo toa do khi toa do tra `0,0` se gom 32 bi thanh 1 ky tu; chi dedup khi toa do hop le.

## Workaround tam thoi
- Neu bridge chua co `__cw_bet`, start flow auto click game, force refresh bridge, cho toi 30s.
- Neu chua co tick/seq, gia han `__cw_startPush(240)` va wait them.
- Neu stop task, van giu push chay de UI tiep tuc cap nhat snapshot.
- Neu resource anh loi trong plugin, `FallbackIcons` va `PackRes.EnsureGlobalResourcesLoaded` co fallback.
- Task 17 tu finalize multi-side bang winners thay vi pending CHAN/LE mac dinh.
- Neu Canvas Watch bi an: chay console `window.__cw_show_panel && window.__cw_show_panel()`; neu undefined thi reload/reinject JS.
- Neu progress chua bat: mo `Canvas Watch`, xem `Prog`, va probe `HUD/countDownProgress`; mac dinh khong fallback label countdown cu.
- Neu tong cuoc 7 cua sai: chay MoneyMap/console probe de lay lai cac label tail `ld_bg/ListLabel/TotalMoney`, doi mapping trong `pickHitTotalsByLayout`.
- Neu phinh khong scan: mo bang chip truoc roi bam `Scan200Text`; xem block `(Chip scan from Scan200Text)`.
- Neu chuoi ket qua chi hien 1 ky tu: kiem tra `readBoxKetQuaSeq`, dac biet toa do `boxKetQuaPoint` va logic dedup; chay lai khhoi JS doc `box_ketqua` doc zig-zag de doi chieu.

## Vung code de loi
- `MainWindow.xaml.cs` vung WebMessageReceived/tick/pending: khoang logic cap nhat snap, NI, pending.
- `MainWindow.xaml.cs` vung Play/Stop/BuildContext/legacy duplicate.
- `v4_js_xoc_dia_live.js` vung `cwBet`, chip plan, `__cw_bet`, `BET_QUEUE`.
- `v4_js_xoc_dia_live.js` vung `Canvas Watch` root `__cw_root_allin`, `ensureCanvasWatchVisible`, `_panelWatchdog`.
- `v4_js_xoc_dia_live.js` vung `HIT_COUNTDOWN_PROGRESS_TAIL`, `collectProgress`, `statusByProg`.
- `v4_js_xoc_dia_live.js` vung `readBoxKetQuaSeq`, `spriteFrameName`, `boxKetQuaPoint`, `clusterByX`; sai toa do/dedup se lam chuoi ket qua thieu ky tu.
- `v4_js_xoc_dia_live.js` vung `TAIL_TOTAL_EXACT`, `pickHitTotalsByLayout`, `readOwnUsername`, `readOwnAccountMoney`.
- `v4_js_xoc_dia_live.js` vung `cwScanChips`, `wideScan`, `Scan200Text` chip output.
- `MoneyHelper.UpdateAfterRoundMultiChain` va S7 temp profit/reset.
- `SideRateParser.NormalizeSide` mapping ten cua dac biet.
- License/lease timers khi dong plugin hoac expire giua task.
