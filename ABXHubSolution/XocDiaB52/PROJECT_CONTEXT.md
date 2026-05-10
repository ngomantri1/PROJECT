# Project Context

## Overview
- `XocDiaB52` la app WPF desktop cho game Xoc Dia B52.
- App co 2 mode chay: standalone `WinExe` va plugin cho `AutoBetHub`.
- Luong chinh khong dua vao backend rieng. Du lieu game duoc doc tu WebView2 bang JS inject vao trang/game frame.
- Logic cuoc nam o C# `Tasks/*`. JS chi lam bridge, scan scene, queue bet, day snapshot len host.

## Tech Stack
- C# / .NET 8 / WPF
- WebView2
- JS inject vao Cocos scene cua game
- `ABX.Core` khi chay trong Hub
- HTTP dung cho license/trial/lease
- Du lieu local luu JSON/CSV/log file trong `%LOCALAPPDATA%\XocDiaB52`

## Main Runtime Flow
- App load config va stats tu local JSON.
- WebView2 khoi tao bang fixed runtime neu co, fallback sang system runtime.
- App inject `v4_js_xoc_dia_live.js` vao top document va frame.
- JS scan scene, tao snapshot `{ abx:'tick', prog, totals, seq, username, accountRaw, status, ts }`.
- `MainWindow` nhan `tick`, cap nhat `_lastSnap`, UI, countdown, status, seq, account.
- Khi user start strategy, C# build `GameContext`, cho bridge/game data san sang, roi chay `IBetTask`.
- Task doc `_lastSnap`, quyet dinh cua dat, goi `TaskUtil.PlaceBet()`.
- JS queue bet, goi `cwBet`, roi post `abx:'bet'` hoac `abx:'bet_error'`.
- C# them dong pending bet khi nhan `abx:'bet'`.
- Khi `seq` advance sang ket qua moi, C# finalize pending rows va cap nhat win/loss.

## Message Contract
- JS -> C#:
  - `abx:'tick'`
  - `abx:'bet'`
  - `abx:'bet_error'`
  - `abx:'bet_queued'`
  - `abx:'bet_dropped'`
  - `abx:'result'`
  - `abx:'home_tick'`
  - `abx:'game_hint'`
- Khong doi ten cac message nay neu chua sua dong bo ca JS bridge va C#.

## Pending Bet Flow
- Pending row duoc tao dung luc nhan `abx:'bet'`.
- Row duoc insert vao `_betAll` dung 1 lan va them vao `_pendingRows`.
- Finalize chi dien ra khi phat hien `seq` advance hoac strategy multi-side cung cap winners ro rang.
- Khong duoc add lai row vao `_betAll` luc finalize.
- `_pendingRows` phai duoc clear sau khi chot van.

## Current Betting DOM
- Exact bet DOM da xac thuc:
  - `CHAN` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/btnChan/btn1`
  - `LE` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/btnLe/btn1`
  - `TRANG3_DO1` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/Btn3White/btn1`
  - `DO3_TRANG1` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/Btn3Red/btn1`
  - `TU_TRANG` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/Btn4White/btn1`
  - `TU_DO` -> `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/Btn4Red/btn1`
- `SAP_DOI` khong thay tren layout/trang hien tai.
- Flow dat cuoc layout moi khong nen con phu thuoc vao selector cu kieu `betnode/gate*`.
- Exact chip DOM da xac thuc:
  - `Entry_1 = 100`
  - `Entry_2 = 500`
  - `Entry_3 = 1000`
  - ...
  - `Entry_11 = 10000000`
- Root chip hien tai:
  - `MainXocDia/Canvas/MainUIParent/XocDiaViewModel/ld_bg/btnChoseCoin/New Node/zcontent/Entry_*`

## Current Profile Tails
- Exact tail ten nhan vat ingame hien tai:
  - `MainXocDia/Canvas/MainUIParent/RoomScene/FooterRoomUi/Left/avatar/NameUser`
- Exact tail tai khoan ingame hien tai:
  - `MainXocDia/Canvas/MainUIParent/RoomScene/FooterRoomUi/Left/avatar/moneyLabel`
- Da bo fallback ve cac tail profile/home/game cu cho username va account; JS hien chi doc exact tail layout moi.

## Seq Behavior
- B52 hien co the tra `seq` dang "sliding window" do dai co dinh, khong phai luc nao cung append dai dan.
- `TaskUtil.TryGetSeqAdvance()` da duoc sua de nhan ca 2 truong hop:
  - append kieu cu: `base + newTail`
  - slide kieu moi: `base[1..] == current[..^1]`
- Neu bo logic nay, task co the dat duoc 1 van roi treo trong `WaitRoundFinishAndJudge()`.

## Coding Rules
- Khi them strategy moi:
  - implement `IBetTask`
  - chi dung `GameContext`
  - dung `TaskUtil.WaitUntil*`, `TaskUtil.PlaceBet`, `TaskUtil.WaitRoundFinishAndJudge`
- Khong dua business cuoc xuong JS tru queue/click bridge.
- Khong doc UI control truc tiep tu `Tasks/*`.
- Selector/scene scan thay doi thi uu tien sua JS inject hoac probe file, khong pha flow C#.
- Build phai giu duoc ca standalone va plugin mode.
- Phan dat cuoc hien tai da bo fallback cu:
  - C# `TaskUtil.PlaceBet()` chi day vao `__cw_bet_enqueue`
  - JS `cwBet` khong fallback ve `old_cwBet`

## Important Rules
- `tick` snapshot la nguon du lieu game chinh cho task engine.
- Status UI dang dua vao JS `status` field; JS hien suy ra theo `prog`.
- Countdown UI co smoothing o C#; khong revert ve hien thi raw gay nhay so.
- Countdown progress bar hien phai chia theo thang co dinh `20s`; khong duoc tu dong phong max theo gia tri `prog` lon nhat tung thay.
- Start strategy phai cho `__cw_bet`, Cocos scene, va it nhat mot `tick`.
- Home/Game frame injection phai idempotent.
- Menh gia chip toi thieu hien tai la `100`, khong con `1000`.

## Wait Rules
- `TaskUtil.WaitUntilNewRoundStart()` hien chi can nhan ra da sang vong moi va `prog > 0` de cho dat cuoc ngay.
- `DecisionSeconds` van con tac dung voi cac task di qua `WaitUntilBetWindow()`.

## Absolute Do-Not-Break Rules
- Khong doi contract `abx:*` neu chua sua dong bo ca hai dau.
- Khong bypass `_pendingRows` de chot thang thua bang timer tho.
- Khong bo `Dispatcher` khi update UI.
- Khong pha `MultiChain` va `WinUpLoseKeep` state handling trong `MoneyHelper`.
- Khong sua business strategy chi vi selector game thay doi.
- Khong lam mat kha nang chay trong Hub plugin mode.

## Known Constraints
- `MainWindow.xaml.cs` la orchestrator rat lon; sua nho co the anh huong nhieu flow.
- `v4_js_xoc_dia_live.js` chua nhieu selector/debug/overlay logic, rat nhay voi DOM/scene moi.
- Du an hien khong co test tu dong; xac nhan chu yeu bang build + runtime verify.
- Moi truong build co the fail do thieu `ABX.Core.dll` cua `AutoBetHub`; can phan biet voi regression do code.
