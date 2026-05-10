# Bugs

## Current Bugs / Open Issues

## 1. `SAP_DOI` Khong Con Thay Tren Layout Moi
- Layout B52 hien tai da xac thuc 6 cua:
  - `CHAN`, `LE`, `TRANG3_DO1`, `DO3_TRANG1`, `TU_TRANG`, `TU_DO`
- Khong thay exact DOM cua `SAP_DOI` tren layout nay.
- He qua:
  - cac flow multi-side neu van bat buoc `SAP_DOI` se fail click neu khong co guard
- Trang thai:
  - da bo selector cu `gate4` ra khoi exact map moi
  - can quyet dinh co disable han trong strategy/flow hay khong

## 2. Home JS Resource Gap
- `LoadHomeJsAsync()` co doc `js_home_v2.js` embedded resource
- File `js_home_v2.js` khong co trong tree hien tai va cung khong thay khai bao embed trong `.csproj`
- He qua:
  - `home_tick` co the khong phat
  - `__abx_hw_startPush` co the khong ton tai
  - Home auto-login / auto-play / early game hint de roi ve fallback C# hoac manual flow

## 3. Warning Debt Rat Lon
- Build hien van thanh cong khi du moi truong, nhung con rat nhieu warnings
- Nhom warning chinh:
  - nullable reference
  - obsolete property `Username`
  - unreachable code
  - async method khong `await`

## 4. Bridge Logic Bi Trung
- Ca `MainWindow.xaml.cs` va `WebView2LiveBridge.cs` deu chua logic inject/forward/reinject tuong tu
- He qua:
  - sua mot noi de quen noi con lai
  - hanh vi top/frame co the drift theo thoi gian

## 5. Packet Debug Chua Tron Ven
- CDP websocket tap da bat
- Log cua `webSocketFrameReceived` va `webSocketFrameSent` dang comment out
- He qua:
  - kho debug packet-level issue khi can so sanh voi scene scan

## 6. Lease / License Username Chua Authoritative
- Code co `_homeUsername` tu `home_tick`, nhung `EnsureLicenseAsync()` va `ResolveLeaseUsername()` van dung `TxtUser`
- He qua:
  - neu textbox lech voi username thuc te tu Home, lease/license co the khong bam dung account dang choi

## 7. Pending Finalize Generic Van Nhay Cam Voi `totals.A`
- Luong finalize generic trong `MainWindow.xaml.cs` chi goi `FinalizeLastBet()` khi co `seq` moi va `snap.totals.A` co gia tri.
- Trieu chung da gap tren layout moi:
  - pending row them thanh cong
  - `Ket qua` / `Thang-Thua` dung `-`
  - `Tai khoan` bang `0` hoac `-`
- Nguyen nhan da thay:
  - tail account cu khong con dung tren layout moi nen `totals.A` null
- Trang thai:
  - da doi exact tail account sang `MainXocDia/Canvas/MainUIParent/RoomScene/FooterRoomUi/Left/avatar/moneyLabel`
  - can verify lai runtime xem pending finalize da on dinh chua

## Fixed / Mitigated Bugs Seen In Current Code

## 1. Countdown UI Jump / Clamp
- Da co smoothing o C#:
  - `GetStableCountdownDisplaySec`
  - `GetStableCountdownDisplayRatio`
  - hard cap `CountdownMaxHardCapSec`
- Update moi nhat:
  - countdown progress bar da quay ve thang co dinh `20s`
  - khong con tu tang max runtime theo `prog` lon nhat tung thay

## 2. Bet Finalize Sai Thoi Diem
- Finalize khong con phu thuoc timer tho
- Da chot theo `seq` advance qua `TaskUtil.TryGetSeqAdvance`
- Multi-side co `FinalizePendingBetsWithWinners`
- Update moi nhat:
  - `TaskUtil.TryGetSeqAdvance()` da fix cho `seq` dang sliding window do dai co dinh
  - trieu chung cu: task dat duoc 1 van roi treo mai trong `WaitRoundFinishAndJudge()`
  - log dien hinh: `reset/rebuild detected while waiting result: baseLen=32, curLen=32`
- Update moi nhat:
  - `TaskUtil.WaitUntilNewRoundStart()` da bo gate `remainingSeconds <= DecisionSeconds`
  - voi nhom strategy dung helper nay, he thong vao lenh ngay khi nhan ra vong moi va `prog > 0`

## 3. Race Khi Start Strategy
- Co `WaitForBridgeAndGameDataAsync`
- Chi start khi bridge, Cocos va `tick` deu san sang

## 4. Frame Injection Mat Sau Navigation
- Co reinject o:
  - top `DOMContentLoaded`
  - frame `DOMContentLoaded`
  - frame `NavigationCompleted`

## 5. Duplicate History Insert
- Pending row chi insert `_betAll` luc `abx:'bet'`
- Finalize khong add lai vao `_betAll`

## 6. Betting DOM Cu Khong Con Dung
- Exact DOM dat cuoc va chip da duoc cap nhat sang layout moi `ld_bg/*`
- Menh gia chip toi thieu da giam tu `1000` xuong `100`
- Da bo fallback dat cuoc cu:
  - C# `TaskUtil.PlaceBet()` khong fallback goi `window.__cw_bet`
  - JS `cwBet` khong fallback ve `old_cwBet`
- Exact DOM moi da xac thuc cho:
  - `CHAN`, `LE`, `TRANG3_DO1`, `DO3_TRANG1`, `TU_TRANG`, `TU_DO`

## 7. Profile Tail Cu Khong Con Dung
- Tail cu cho username/account (`HomeScene/*`, `GateHeaderInGame/*`, `dual/*`) khong con phu hop voi layout Xoc Dia hien tai.
- Da xac thuc exact tail moi bang probe/log:
  - username -> `MainXocDia/Canvas/MainUIParent/RoomScene/FooterRoomUi/Left/avatar/NameUser`
  - account -> `MainXocDia/Canvas/MainUIParent/RoomScene/FooterRoomUi/Left/avatar/moneyLabel`
- Trang thai:
  - da bo fallback cu
  - JS profile reader hien chi doc exact tail moi

## Root Causes
- Game B52 thay scene/node/tail thuong xuyen
- Project phu thuoc nang vao WebView2 + JS inject + frame timing
- `MainWindow.xaml.cs` qua lon nen side effect cao
- Nhieu strategy copy pattern giong nhau, de drift logic
- Thieu test tu dong cho contract `tick/bet/finalize`
- Result board hien co the tra `seq` dang sliding window, khong con append vo han nhu gia dinh ban dau

## Temporary Workarounds
- Dung `devtools_*_probe.js` de verify selector truoc khi sua JS runtime
- Dung `WaitForBridgeAndGameDataAsync` truoc khi chay task
- Dung fallback C# click/navigation khi Home JS khong san
- Giu CDP tap de debug network khi can, du chua log full payload
- Dung probe exact DOM tren DevTools de xac thuc `ld_bg/btn*` truoc khi chot selector trong JS
- Dung probe text/tail trong DevTools de xac thuc exact path username/account truoc khi khoa tail trong JS

## Easy-To-Break Zones
- `MainWindow.xaml.cs`
  - play/stop
  - `WebMessageReceived`
  - pending finalize
  - license/lease
  - cleanup/shutdown
- `v4_js_xoc_dia_live.js`
  - countdown/status/totals/result board selectors
  - bet queue
  - exact DOM map cho 6 cua va day chip `Entry_*`
  - `safePost` / `__cw_startPush`
- `Tasks/*`
  - lap logic von nhieu noi
  - `MultiChain` path
  - sequence normalization `C/L`, `B/P`, digits

## What Not To Assume
- Khong assume Home JS luon co
- Khong assume websocket packet la source of truth
- Khong assume `seq` luon append dai hon sau moi van
- Khong assume plugin mode va standalone mode dung cung resource path/runtime path
