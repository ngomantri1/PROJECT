# Architecture

## High-Level Shape
- UI shell: `MainWindow.xaml` + `MainWindow.xaml.cs`
- Startup/plugin shell: `MainWindow.Startup.cs`, `MainWindow.EmbedMode.cs`, `SicboX88LivePlugin.cs`
- Game bridge: `v4_js_xoc_dia_live.js`
- Strategy engine: `Tasks/*.cs`
- Shared models/utilities: `Models.cs`, `Tasks/GameContext.cs`, `Tasks/TaskUtil.cs`, `Tasks/MoneyManager.cs`

## Main Modules

### MainWindow Runtime
- Quan ly `WebView2`, inject JS, nhan `WebMessageReceived`.
- Giu `_lastSnap`, update UI, pending rows, CSV, stats.
- Start/stop strategy, license/trial/lease, config tabs.
- Nghe CDP `Network.webSocket*`, parse packet server de override nhung field scene graph khong doc on dinh.

### JS Bridge
- Detect page/frame game.
- Scan `canvas` + `cc.director.getScene()`.
- Lay text, totals, username, balance, va queue click bet.
- Mount debug panel `Canvas Watch`.
- Day payload `tick` ve C#.

### CDP Packet Tap
- Nam trong `MainWindow.xaml.cs`.
- Su dung:
- `Network.enable`
- `Network.webSocketCreated`
- `Network.webSocketFrameReceived`
- Socket production:
- `wss://livecasino.azhkthg1.net/websocket`
- Packet parser hien tai da lay duoc:
- countdown/status
- totals `bs[]`
- `resultRaw`

## Data Flow
1. JS scan game -> tao snapshot `tick`.
2. C# deserialize -> update `_lastSnap`.
3. CDP websocket packet neu co field on dinh hon se override mot phan snapshot.
4. UI cap nhat qua `Dispatcher`.
5. Strategy doc snapshot.
6. Strategy enqueue bet qua `TaskUtil`.
7. C# ghi pending row.
8. JS click queue vao canvas.
9. Round doi -> C# finalize pending.

## Current Production Mapping

### Countdown / Status
- Source of truth: CDP packet.
- Flow:
- `TryUpdateServerCountdownFromPayload(...)`
- `TryGetServerCountdownSnapshot(...)`
- `MapServerStatusToUi(...)`
- UI status color:
- xanh = `Phiên mới`
- do = `Ngừng đặt cược`
- vang = `Đang đợi kết quả`

### Username / Balance
- Source of truth: JS tail.
- File: [D:\PROJECT\ABXHubSolution\SicboX88Live\v4_js_xoc_dia_live.js](/D:/PROJECT/ABXHubSolution/SicboX88Live/v4_js_xoc_dia_live.js)
- Tail:
- `userData/lbl_username`
- `userData/lbl_userMoney`

### 4 Bet Totals
- Source of truth: JS scene tail, khong fallback lai tail cu.
- Tail chung:
- `BetArea/lbl_totalbet`
- Kien truc phan biet:
- scan tat ca instance cung tail
- chia 2 hang theo Y
- sort trai/phai theo X trong moi hang
- map:
- hang duoi: `XIU`, `TAI`
- hang tren: `LE`, `CHAN`
- Muc tieu: tranh phu thuoc pixel tuyet doi khi doi do phan giai.

### Result Sequence
- Source of truth: CDP `resultRaw` chi khi `status=ENDED`.
- Khong lay tu popup history.
- Khong lay tu bead scene graph.
- Khong load lai tu state/log cu.
- `resultRaw` parser:
- `TryParseResultRawSum(...)` -> tong `3..18`
- `SumToResultCode(...)` -> ma `0/1/2/3`
- `TryUpdateServerResultSequenceFromPayload(...)`
- `PushServerResultSumSeqToPageAsync(...)`
- `tick` snapshot:
- `snap.sumSeq` = chuoi tong `3..18`
- `snap.seq` = chuoi ma noi bo `0/1/2/3`

## Result Code Semantics
- `0 = XC`
- `1 = XL`
- `2 = TC`
- `3 = TL`

Rule chi tiet:
- `3,5,7,9 => XL`
- `4,6,8,10 => XC`
- `11,13,15,17 => TL`
- `12,14,16,18 => TC`

## Important Runtime Detail
- Packet `BETTING` co the van mang `resultRaw` cua van truoc.
- Vi vay parser `ResultSeq` phai bo qua moi packet khong phai `ENDED`.
- Neu append o `BETTING`, session se bi danh dau da xu ly som va ket qua moi that su cua `ENDED` se bi mat.

## JS Rendering Detail
- `v4_js_xoc_dia_live.js` uu tien:
- `window.__cw_result_sum_seq`
- khong fallback lai `seq` icon khi hien text `Chuỗi kết quả`
- `__cw_renderPanel()` co the duoc goi tu C# sau moi lan CDP append chuoi moi.

## Current Architecture Risks
- `MainWindow.xaml.cs` van rat lon, coupling cao.
- `v4_js_xoc_dia_live.js` vua scan scene, vua click, vua mount debug UI.
- Bridge dang nhay cam voi thay doi scene graph game.
- 4 tong cuoc dang dung scene geometry; neu game doi bo cuc 2x2, map nay se can sua lai.
- Loader JS uu tien file disk truoc embedded; neu session cu chua reload, app co the dang chay JS cu.
