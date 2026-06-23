# TODO

> Danh sách cô đọng theo trạng thái code hiện tại.

## Task đang làm

- Ổn định same-page game detection trên `zowin` và shell host mới
- Giữ `TextMap/MoneyMap/BetMap` bám đúng game frame thật
- Giữ settle authoritative giữa JS tick và network/CDP
- Ổn định lại luồng `chuỗi kết quả` theo scan mới, không quay về nghiệp vụ road cũ
- Sửa dứt điểm việc canvas có sequence đúng nhưng panel C# vẫn hiển thị sai

## Task chưa hoàn thành

- Chuẩn hóa một nguồn nhận diện game context giữa C# và JS
- Tách `MainWindow.xaml.cs` thành service nhỏ hơn
- Làm rõ vai trò `WebView2LiveBridge.cs`
- Khóa lại contract `PULL_POPUP_TICK_NOW` để không trả snapshot rỗng khi canvas vẫn có dữ liệu

## Task cần refactor

- Tách:
  - `BridgeService`
  - `GameLaunchService`
  - `SeqSyncService`
  - `PendingBetService`
- Giảm duplication giữa main/popup/frame inject path
- Tách Canvas Watch/debug config khỏi business flow

## Task ưu tiên cao

- Test lại nhánh authority `stale-authority-resync`
- Xác nhận `__cw_probeRoadSeqFrames(8).rawSeq` và panel `CHUỖI KẾT QUẢ` luôn cùng nội dung
- Rà lại `header-prune` trong `cw_probe_seq_roi.js` / `v4_js_xoc_dia_live.js` trên nhiều layout
- Giữ popup fallback chỉ cho host legacy, không lấn flow same-page

## Task cần test lại

- `zowin` same-page launch flow
- `Canvas Watch`:
  - hiện panel
  - hiện đủ info
  - không chặn click web
- rebuild embedded JS và binary copy path
- đổi table/shoe khi có pending bet
- chuỗi kết quả:
  - probe đúng
  - snapshot đúng
  - authority đúng
  - panel hiển thị đúng toàn bộ chuỗi

## Cập nhật từ chat 2026-06-23

### Task gấp

- Tắt app, rebuild binary mới, chạy lại để chắc XAML/embedded JS mới đã được nạp.
- Test log `reason=stale-authority-resync` trên host thực.
- Xác nhận panel `CHUỖI KẾT QUẢ` không còn chỉ hiện phần đuôi.

### Chưa xong

- Xác nhận `stale-authority-resync` không cướp authority nhầm khi:
  - changing shoe
  - no-board
  - table-switch transient
- Rà lại `cw_probe_seq_roi.js` trên các bàn có cùng UI nhưng khác tỉ lệ.

### Checklist debug sequence

1. Probe:
   - `(await __cw_probeRoadSeqFrames(8)).rawSeq`
2. Snapshot:
   - `readDomBeadSeq()`
   - `buildSnapshotNow()`
3. Authority:
   - `[NETSEQ][RAW-AUTHORITY]`
   - `[NETSEQ][COUNT-ONLY-HOLD]`
4. UI:
   - `[SEQ][UI][QUEUE]`
   - `[SEQ][UI][APPLY]`
