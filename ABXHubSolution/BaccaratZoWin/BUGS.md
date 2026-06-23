# BUGS

> Chỉ liệt kê bug/điểm rủi ro đáng chú ý cho AI coding hiện tại.

## Bug hiện tại

### 1. Canvas có sequence đúng nhưng panel C# có thể hiển thị sai

- Triệu chứng:
  - `(await __cw_probeRoadSeqFrames(8)).rawSeq` đúng
  - panel `CHUỖI KẾT QUẢ` vẫn có thể hiển thị chuỗi ngắn/sai
- Nguyên nhân thực tế:
  - `_netSeqDisplay` trong C# có thể stale/ngắn hơn `rawSeq`
  - trước đây UI còn auto-scroll right nên người dùng chỉ nhìn thấy phần đuôi
- Vùng code:
  - `MainWindow.xaml.cs`
    - `SyncNetworkSeqFromSnapshot(...)`
    - `ApplyNetworkSeqAuthorityLocked(...)`
    - `QueueTickUiUpdate(...)`
    - `UpdateSeqUI(...)`

### 2. Auto ROI road có thể dính hàng thống kê hoặc bỏ mất bead row

- Triệu chứng:
  - include cả `CON/HOÀ/CÁI`
  - hoặc bỏ mất hàng bead trên cùng
- Vùng code:
  - `DevTools\cw_probe_seq_roi.js`
  - `v4_js_xoc_dia_live.js`
  - `filterRoadBodyItems` / `brFilterCanvasRoadBodyItems`

### 3. `main-pull` / snapshot path vẫn có rủi ro diverge với panel canvas

- Canvas Watch có thể đúng nhưng `main-pull` lấy sai context top/frame
- Hậu quả:
  - C# UI sai
  - authority giữ chuỗi cũ
  - user tưởng scanner canvas sai

## Bug đã fix

### 1. UI chuỗi kết quả chỉ focus phần cuối

- Nguyên nhân:
  - `ScrollViewer` ngang
  - `ScrollToRightEnd()` trong `UpdateSeqUI()`
- Đã fix:
  - bỏ `ScrollViewer`
  - đổi sang `WrapPanel`
  - bỏ auto scroll right

### 2. Authority C# có thể giữ chuỗi stale dù `rawSeq` đúng

- Nguyên nhân:
  - `_netSeqDisplay` đã có authority cũ ngắn
  - rule cũ không resync lại khi `rawSeq` khớp board count nhưng authority hiện tại không khớp
- Đã fix:
  - thêm nhánh `reason=stale-authority-resync`
  - khi `rawSeq` khớp board count và authority cũ stale, C# rebase sang `rawSeq`

## Bug chưa fix dứt điểm

- Auto ROI road vẫn cần test trên nhiều layout/tỉ lệ
- `main-pull` / `PULL_POPUP_TICK_NOW` vẫn cần xác nhận lại trên site mới
- Rule authority mới cần test vòng kín với changing shoe / no-board / table-switch

## Nguyên nhân bug chính

- Provider/host đổi layout, frame, route nhưng app vẫn phải hỗ trợ cả path cũ lẫn mới
- JS tick, network authority, popup/main/frame injection là nhiều luồng đồng thời
- `MainWindow.xaml.cs` quá lớn, invariant khó nhìn
- Embedded JS khiến rất dễ quên rebuild
- Có độ lệch giữa:
  - dữ liệu canvas đang render
  - dữ liệu `main-pull` đang kéo về host
  - dữ liệu authority C# đang giữ

## Workaround tạm thời

- Khi nghi UI sai chuỗi:
  1. chạy `(await __cw_probeRoadSeqFrames(8)).rawSeq`
  2. xem log `[NETSEQ][RAW-AUTHORITY]`
  3. xem log `[SEQ][UI][QUEUE]` và `[SEQ][UI][APPLY]`
- Khi build không copy được exe:
  - app đang chạy và khóa `BaccaratZoWin.exe`
  - phải tắt app rồi build lại
- Khi nghi ROI sai:
  - so trực tiếp với `DevTools\cw_probe_seq_roi.js`

## Vùng code dễ lỗi

- `MainWindow.xaml.cs`
  - launch flow
  - bridge inject
  - `PULL_POPUP_TICK_NOW`
  - seq authority
  - pending settle
- `v4_js_xoc_dia_live.js`
  - game context detect
  - `readDomBeadSeq()`
  - `buildSnapshotNow()`
  - probe cache / raw promotion
- `DevTools\cw_probe_seq_roi.js`
  - auto ROI
  - header prune
  - row filter

## Invariant phải giữ

- Không settle pending bet nếu chưa qua `context + seq gating`
- Không để JS tick rỗng overwrite authority tốt hơn
- Không update WPF control ngoài `Dispatcher`
- Không để UI hiển thị chuỗi khác với authority/snapshot đang dùng mà không có log giải thích
