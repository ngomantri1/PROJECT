# PROJECT_CONTEXT

> Tài liệu phục vụ AI coding. Ưu tiên logic đang chạy thực tế, không phải spec lý tưởng.

## Tổng quan project

- `BaccaratZoWin` là app `WPF .NET 8`, đồng thời có thể chạy như plugin cho `ABX.Core`.
- App điều khiển `WebView2`, tiêm JS runtime `v4_js_xoc_dia_live.js`, đọc trạng thái game realtime, chạy strategy, quản lý vốn, lưu history/stats.
- Code điều phối trung tâm vẫn là `MainWindow.xaml.cs`.
- Runtime hiện tại ưu tiên `same-page flow` trên ZoWin/shell host mới, không ưu tiên route cũ kiểu `webMain.jsp` / `singleBacTable.jsp`.

## Công nghệ sử dụng

- `C#`, `WPF`, `net8.0-windows`
- `Microsoft.Web.WebView2`
- `ABX.Core`
- Embedded JS runtime: `v4_js_xoc_dia_live.js`
- `System.Text.Json`
- `DPAPI`
- CDP / `CallDevToolsProtocolMethodAsync`

## Flow hoạt động chính

1. `MainWindow` khởi tạo config, stats, log, WebView2.
2. C# inject bridge script vào top doc, frame, popup khi cần.
3. JS quét canvas/DOM/text và đẩy `tick` về C#.
4. C# hợp nhất `tick` với authority từ network/CDP.
5. Strategy đọc snapshot authoritative qua `GameContext`.
6. `TaskUtil.PlaceBet()` gọi JS queue đặt cược.
7. Pending row được giữ tới khi settle đủ `context + seq gating`.
8. UI/history/stats được cập nhật trên `Dispatcher`.

## Coding rules

- Không bypass `TaskUtil.PlaceBet()` và flow settle authoritative.
- Không update WPF control ngoài `Dispatcher`.
- Không đổi contract JSON JS ↔ C# nếu chưa sửa cả hai đầu.
- Không đưa logic nghiệp vụ mới trực tiếp vào handler UI nếu có thể tách vào `Tasks\*.cs`.
- Mọi thay đổi JS phải nhớ: file đang là embedded resource, phải rebuild thì runtime mới nhận bản mới.

## Naming rules

- Side chuẩn: `BANKER`, `PLAYER`, `TIE`
- Sequence chuẩn: `B`, `P`, `T`
- Major/minor: `N`, `I`
- Runtime strategy dùng `IBetTask.Id`
- Log prefix cần rõ nghĩa: `[Bridge]`, `[SEQ]`, `[BET]`, `[NETSEQ]`, `[CWUSER]`

## Rule quan trọng

- `MainWindow.xaml.cs` vẫn là orchestration thật, sửa nhỏ và đúng chỗ.
- Snapshot cho strategy phải là snapshot authoritative, không dùng text UI raw.
- Pending bet chỉ được settle khi qua `context + seq gating`.
- Với ZoWin hiện tại, không được kéo logic quay về assumption `webMain.jsp` / `singleBacTable.jsp`.
- `same-page flow` và popup flow cùng tồn tại; phải biết host nào dùng path nào.

## WebSocket / network flow

- Có 2 nguồn dữ liệu:
  - JS `tick` từ page/frame
  - network/CDP packet cho observed context / winner
- JS tick nhanh cho UI và board snapshot.
- Network/CDP là authority bổ sung để tránh settle sai.
- C# hợp nhất thành `_netSeq*`, observed context và settle authority.

## Pending flow

- Khi bet được queue/send, app tạo `_pendingRows`.
- Pending row giữ `IssuedSeqVersion`, `IssuedTableId`, `IssuedGameShoe`, `IssuedObservedRound`.
- Khi settle:
  - match theo context nếu có
  - check `seq advanced`
  - reject multi-match sai
- Nếu issue time thiếu context, code dùng `late bind`.
- Đổi table/shoe có thể drop pending cũ để tránh settle nhầm.

## Threading / UI rules

- Task/strategy chạy nền; UI luôn quay về `Dispatcher`.
- WebView event rất dày; đã có coalesce/throttle ở nhiều nhánh.
- Không đưa IO/blocking dài lên UI thread.
- Popup/main/frame bridge đều có thể callback bất kỳ lúc nào; tránh assumption thread đơn giản.

## Canvas / debug rules

- `Canvas Watch` là panel debug trong `v4_js_xoc_dia_live.js`.
- Overlay debug mặc định phải click-through, không chặn click web.
- `TextMap/MoneyMap/BetMap` phụ thuộc đúng game frame/context.
- Nếu canvas có dữ liệu nhưng panel C# không có:
  - ưu tiên kiểm tra `main-pull` / `PULL_POPUP_TICK_NOW`
  - kiểm tra host đang kéo snapshot từ top/frame nào
  - không kết luận vội là scanner canvas hỏng

## Chuỗi kết quả / road sequence

- Nguồn chuẩn để đối chiếu khi debug hiện tại là:
  - `(await __cw_probeRoadSeqFrames(8)).rawSeq`
- `DevTools\cw_probe_seq_roi.js` là script manual probe/reference để xác nhận ROI và sequence trong DevTools.
- `readDomBeadSeq()` / `buildSnapshotNow()` phải ưu tiên `rawSeq` từ probe-canvas khi chuỗi đủ tin cậy.
- Có 2 nhóm lỗi thực tế:
  - ROI nuốt nhầm hàng thống kê `CON/HOÀ/CÁI`
  - C# giữ authority cũ ngắn hơn `rawSeq`, làm UI hiển thị sai dù probe đúng

## Cập nhật từ chat 2026-06-23

- Đã hoàn thiện nhánh `auto-road` theo hướng bám sát `DevTools\cw_probe_seq_roi.js`.
- Đã thêm log/diagnostic để soi `rawSeq`, `seqWhich`, source build snapshot và authority C#.
- Đã thêm nhánh authority mới trong C#:
  - `reason=stale-authority-resync`
  - dùng khi `rawSeq` khớp board count nhưng `_netSeqDisplay` hiện tại stale/quá ngắn
- Đã xác nhận một lớp lỗi presentation:
  - trước đây UI `CHUỖI KẾT QUẢ` auto-scroll sang phải nên người dùng chỉ nhìn thấy phần đuôi
  - giờ rule mong muốn là hiển thị toàn bộ chuỗi giống `rawSeq`
- Rule hiển thị mới:
  - không auto-scroll right
  - ưu tiên wrap nhiều dòng
  - phải nhìn được toàn bộ nội dung chuỗi

## Những điều tuyệt đối không được phá

- Contract JS ↔ C# của `tick`, `bet`, `bet_error`, `result`
- Sequence authority sync khi đổi table/shoe
- Pending settle gating theo `context + version`
- Embedded JS load path
- Plugin lifecycle `CreateView()` / `Stop()`
- Click-through của overlay debug
- Flow same-page trên ZoWin hiện tại
- Nguồn tên nhân vật giữa canvas và panel C# phải hội tụ về một snapshot
