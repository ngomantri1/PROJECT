# Project Context

## Overview
- `SicboX88Live` la app WPF `.NET 8` dieu khien auto bet cho game live qua `WebView2`.
- Runtime chinh la cau noi `C# <-> JS`.
- C# quan ly UI, config, task, pending history, license/trial, va CDP websocket tap.
- JS trong page game scan `canvas/Cocos`, doc state, va click bet.
- Hai file thay doi nhieu nhat hien tai la:
- `MainWindow.xaml.cs`
- `v4_js_xoc_dia_live.js`

## Tech Stack
- `C#`, `WPF`, `net8.0-windows`
- `Microsoft.Web.WebView2`
- `System.Text.Json`
- `ABX.Core`
- JS bridge: `v4_js_xoc_dia_live.js`

## Main Flow
1. `MainWindow` khoi tao config/log/stats va `WebView2`.
2. C# inject JS bridge vao page game.
3. JS scan `cc.director.getScene()` + DOM/canvas roi post `tick` ve C#.
4. C# cap nhat `_lastSnap`, UI, pending history, va state round.
5. Strategy chay background, doc `GameContext`, goi `TaskUtil.PlaceBet`.
6. Pending row duoc ghi ngay luc enqueue, khong cho JS ack.
7. Khi ket qua doi, C# finalize pending row va cap nhat CSV/UI/stats.

## Current Source Of Truth

### Countdown / Status
- Countdown production hien tai lay tu websocket CDP, khong con phu thuoc `tail` countdown trong scene.
- Nguon du lieu:
- `timeBetCountdown`
- fallback `timeBet`
- `stopBetSecond`
- `status`
- Trang thai UI map dung tu server:
- `Phiên mới` -> mau xanh
- `Ngừng đặt cược` -> mau do
- `Đang đợi kết quả` -> mau vang

### Tên nhân vật / Tài khoản
- Van lay tu `tail` JS/Cocos:
- `tx_live_tamtam/Canvas/root/userData/lbl_username`
- `tx_live_tamtam/Canvas/root/userData/lbl_userMoney`
- Khong fallback lai `avatar_node/*` cu.

### 4 tong cuoc `CHAN/LE/TAI/XIU`
- Hien tai JS production da dung `1 tail chung`:
- `tx_live_tamtam/Canvas/root/BetArea/lbl_totalbet`
- Phan biet 4 cua bang bo cuc hinh hoc 2x2 cua cac instance cung tail, khong dung pixel anchor cung, khong dung tail cu.
- Thu tu map:
- hang duoi: trai `XIU`, phai `TAI`
- hang tren: trai `LE`, phai `CHAN`

### Chuỗi kết quả
- Khong con lay tu popup hay scene `tail`.
- Chuỗi ket qua hien tai chi den tu CDP websocket packet `ENDED` co `resultRaw`.
- `resultRaw` la 3 mat xuc xac, vi du:
- `345` -> `3+4+5=12`
- `113` -> `1+1+3=5`
- `144` -> `1+4+4=9`
- Chuỗi hien thi tren UI la `sumSeq` dang `3..18`, vi du `15,14,11,10,9,7`.
- Khong bootstrap tu log cu, khong load `result-seq.json`, khong fallback sang scene graph.
- Khi mo app moi, `sumSeq` bat dau rong va chi append khi co packet `ENDED + resultRaw` moi tu CDP.

## Internal Result Code Rules
- `3,5,7,9` => `XL` => ma `1`
- `4,6,8,10` => `XC` => ma `0`
- `11,13,15,17` => `TL` => ma `3`
- `12,14,16,18` => `TC` => ma `2`
- `sumSeq` la chuoi hien thi cho user.
- `seq` ma `0/1/2/3` van duoc giu cho mot so logic noi bo va icon ket qua.

## CDP WebSocket Rules
- CDP network tap dang bat thuong truc, khong con phu thuoc env `TXLS_CDP_TAP`.
- Socket dang dung:
- `wss://livecasino.azhkthg1.net/websocket`
- CDP chi nghe traffic san co, khong tao them request len server.
- `ResultSeq` parser phai:
- chi xu ly packet `status=ENDED`
- chi append khi co `resultRaw`
- dedupe theo `sessionId/sid` top-level cuoi cung cua packet
- khong duoc lay `resultRaw` cu con treo trong packet `BETTING`

## Coding Rules
- Khong rewrite flow bet-history: nguon su that la C# enqueue, khong phai JS ack.
- Moi update WPF phai qua `Dispatcher`/`UiDispatcher`.
- Moi doc/ghi snapshot song song phai qua `_snapLock`.
- Moi thay doi bridge phai giu nguyen contract `abx`.
- Khong block UI thread bang loop/poll/file IO/network IO.
- Khong sua logic task neu issue chi nam o `tail`, scene path, hay CDP parse.

## Important Rules
- Khong doi semantics finalize: chi finalize khi round/`seq` da doi.
- Khong duplicate row tu JS ack.
- Khong pha thu tu JS bet queue.
- Khong bo qua `WaitForBridgeAndGameDataAsync()` truoc khi start strategy.
- Khong de debug panel/canvas hook lam anh huong flow dat cuoc.

## Threading And UI Rules
- Strategy chay background, UI phai marshal ve `Dispatcher`.
- `GameContext` la entry point an toan cho task thay vi cham truc tiep `MainWindow`.
- Log/file write di qua queue, khong ghi truc tiep trong loop nong.
- `CancellationToken` la co che stop chuan.

## Current Known Gaps
- Chuỗi kết quả hien tai chi tich luy tu luc app chay; khong phuc hoi lich su cu, do da bo fallback theo yeu cau.
- 4 tong cuoc da map production bang scene tail chung + geometry, can tiep tuc theo doi tren nhieu layout neu game doi bo cuc.
- `AutoFillLoginAsync()` dang bi tat bang early return.
- `js_home_v2.js` khong ton tai trong project.
- `MainWindow.xaml.cs` va `v4_js_xoc_dia_live.js` van la 2 vung rui ro cao nhat khi sua.
