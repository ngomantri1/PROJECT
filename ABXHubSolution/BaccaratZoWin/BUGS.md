# BUGS

> Danh sách bug/rủi ro đang biết tới theo trạng thái hiện tại của app Baccarat ZoWin.

## Bug hiện tại

### 0. Chuỗi kết quả visual road không đồng bộ lên panel C#

- Triệu chứng:
  - `await __cw_showRoadSeqDebug(8)` trong DevTools đọc được chuỗi đúng từ visual road.
  - Panel C# `CHUỖI KẾT QUẢ` hiển thị chuỗi khác, chuỗi bị sai vùng, hoặc hiện tại không hiển thị chuỗi kết quả nữa.
  - Countdown đã được xác nhận đang đồng bộ OK và không phải trọng tâm bug này.
- Yêu cầu đúng:
  - panel C# phải đồng bộ với `rawSeq` của `await __cw_showRoadSeqDebug(8)`.
  - sau lần đồng bộ đầu, JS chỉ kiểm tra thưa và chỉ đẩy lên C# khi visual rawSeq thay đổi để tránh cao tải.
- Nguyên nhân đã thấy trong log:
  - `brCommitProbeRoadPack(...)` từng lỗi `ReferenceError: _forcePushOnce is not defined`.
  - probe nền `buildSnapshotNow-empty-pull` có lúc chọn ROI sai như `auto-road-b`.
  - các probe nền có thể ghi đè chuỗi đúng từ visual debug nếu không khóa quyền authority.
  - C# nhận `main-pull` nhưng payload có thể `rawSeq` rỗng hoặc khác visual debug.
  - Log runtime mới cho thấy app chạy embedded JS `len=792314`, probe có `probe-canvas-frames-hit`, nhưng `[PULLRAW]` vẫn `seq=""`, `rawSeq=""`.
  - Lý do cụ thể: reason `buildSnapshotNow-empty-pull` không thuộc visual authority, nên dù probe/cache có rawSeq, state `window.__cw_seq*` không được publish vào tick.
- Trạng thái:
  - chưa fix dứt điểm.
  - đã thử thêm `push-visual-sync`, visual authority và ưu tiên `left-road-a/b/c/d`, nhưng người dùng báo bản hiện tại không còn hiển thị chuỗi.
  - đã vá tiếp để `buildSnapshotNow('pull')` khi rỗng kick `push-visual-sync` và thêm log `buildSnapshotNow-empty-pull-kick-visual-sync`, `visual-road-publish-state`, `readSeqStateSafe-published-fallback`.
  - bản vá mới nhất chưa được kiểm chứng runtime vì build output bị khóa bởi `BaccaratZoWin` và `Microsoft Visual Studio 2022`.
- Cần kiểm tra tiếp:
  - JS embedded đã rebuild chưa, vì app đang chạy sẽ khóa exe và build copy fail.
  - `Loaded JS from embedded | len=...` trong log đã đổi sau build chưa.
  - `push-visual-sync` có chạy trong live frame thật không.
  - `window.__cw_force_push_once` có được bridge đọc và reset không.
  - `visual-road-publish-state` có publish `seq/len` đúng không.
  - `readSeqStateSafe-published-fallback` có trả seq khi `readTKSeq()` rỗng không.
  - `[PULLRAW]` payload có `rawSeq` không.
  - `[SEQ][UI][RENDER]` có chạy không.

### 1. Panel C# vẫn có thể chậm/đơ sau một thời gian ngắn

- Triệu chứng:
  - mới mở app thấy đồng bộ ổn
  - sau vài giây đến vài chục giây panel chậm hoặc đứng
  - countdown có lúc đứng
  - nút vẫn hiện nhưng state không cập nhật đúng
- Nguyên nhân đã xác định một phần:
  - pull snapshot sai frame
  - log/tick dày
  - từng có CDP websocket flood
  - một số callback nền chạm UI sai cách
- Tình trạng:
  - đã giảm được một phần
  - chưa thể kết luận fix dứt điểm nếu chưa test lại trên runtime mới nhất

### 2. Snapshot vẫn có thể rơi về `top` thay vì live frame

- Triệu chứng:
  - `reason=exact-live-frame` đã xuất hiện trong log
  - nhưng một số snapshot/pull diag vẫn cho thấy source từ `top`
- Hậu quả:
  - countdown/status/seq có thể sai hoặc stale
  - panel C# dễ diverge so với Canvas Watch/live frame thật

### 3. Pending row có thể không settle đúng ở lần đầu

- Triệu chứng:
  - row history vẫn ở trạng thái `Chờ` / `Đang chờ`
  - dù round đã có kết quả
- Khu vực nghi ngờ:
  - settle gating
  - late-bind context
  - round advance detection

### 4. Countdown vẫn có rủi ro dừng cập nhật

- Triệu chứng:
  - số giây bị đứng
  - panel status không đổi
- Liên quan:
  - tick pipeline
  - frame source
  - fallback pull

## Bug đã fix

### 1. Build lỗi `private is not valid for this item`

- Nguyên nhân:
  - chuỗi verbatim string bị escape sai trong `MainWindow.xaml.cs`
- Trạng thái:
  - đã sửa xong

### 2. Click 3 cửa chỉ ăn `PLAYER`, không ăn `BANKER/TIE`

- Nguyên nhân:
  - tail/DOM vùng cược cũ không còn khớp site mới
  - vùng khoanh ban đầu lấy sai, chồng lấn
- Trạng thái:
  - đã sửa lại logic chọn vùng và tail theo layout mới

### 3. Click vùng cược sai khi đổi độ phân giải

- Nguyên nhân:
  - vùng click bị phụ thuộc kích thước cứng
- Trạng thái:
  - đã cải thiện theo hướng bám frame/context mới

### 4. Lỗi đọc UI từ background thread trong `SaveConfigAsync`

- Triệu chứng:
  - `InvalidOperationException: The calling thread cannot access this object because a different thread owns it`
- Trạng thái:
  - đã sửa bằng cách marshal về `Dispatcher`

### 5. CDP websocket làm nặng app nhưng không cho dữ liệu hữu ích

- Triệu chứng:
  - `wsR` tăng rất mạnh
  - `obsPkt=0`
  - `winnerPkt=0`
- Trạng thái:
  - đã tắt hẳn trong runtime hiện tại

## Bug chưa fix dứt điểm

- Chuỗi visual road từ `await __cw_showRoadSeqDebug(8)` chưa đồng bộ ổn định lên panel C#.
- Freeze/lag tổng thể của panel C#
- Tick vẫn có lúc không bám live frame tuyệt đối
- Pending settle lần đầu chưa được xác nhận ổn định hoàn toàn
- Countdown đứng sau một thời gian chạy

## Nguyên nhân bug

### Nguyên nhân kiến trúc

- `MainWindow.xaml.cs` quá lớn, nhiều flow chồng nhau.
- Có nhiều nguồn dữ liệu cùng lúc:
  - top shell
  - main frame
  - popup frame
  - live frame
- Các event WebView2/frame có thể đến bất kỳ lúc nào.

### Nguyên nhân từ provider/site

- ZoWin thay đổi:
  - frame
  - DOM
  - tail
  - layout
  - tỷ lệ hiển thị
- Các route thực tế đang dùng:
  - `.../internal/livestream_page/...bcrlive...`

### Nguyên nhân runtime

- Flood message bridge từ window/frame lạ
- Pull fallback lấy sai frame
- CDP websocket flood
- Log quá dày
- UI access sai thread
- Road sequence có nhiều writer cạnh tranh:
  - probe visual đúng
  - probe nền
  - cached/published state
  - panel text fallback
  Nếu không khóa source authority, chuỗi đúng có thể bị ghi đè.

## Workaround tạm thời

- Khi nghi panel C# sai chuỗi:
  - chạy `await __cw_showRoadSeqDebug(8)` để xem visual rawSeq, ROI, cell count, row count
  - kiểm tra `(await __cw_probeRoadSeqFrames(8)).rawSeq`
  - so với panel `CHUỖI KẾT QUẢ`
  - kiểm tra log `[JSSEQ][probe-canvas-visual-authority]`, `[JSSEQ][buildSnapshotNow-empty-pull-kick-visual-sync]`, `[JSSEQ][visual-road-publish-state]`, `[JSSEQ][readSeqStateSafe-published-fallback]`, `[PULLRAW]`, `[SEQ][RX]`, `[SEQ][UI][RENDER]`
- Khi nghi freeze:
  - kiểm tra log runtime đầu phiên xem `tap=0` chưa
  - kiểm tra xem tick còn đến không
- Khi build lỗi copy exe/dll:
  - tắt app đang chạy
  - stop debug/đóng Visual Studio nếu log báo lock bởi `Microsoft Visual Studio 2022`
  - build lại và xác nhận `Loaded JS from embedded` đổi `len`
- Khi build solution lỗi:
  - build `AutoBetHub` trước để có `ABX.Core.dll`

## Vùng code dễ lỗi

- `MainWindow.xaml.cs`
  - `ExecuteOnBetWebAsync(...)`
  - `PULL_POPUP_TICK_NOW`
  - frame arm/re-arm/drop
  - tick dispatch
  - pending/history settle
  - config save/load
- `v4_js_xoc_dia_live.js`
  - `__cw_readSnapshot`
  - `__cw_showRoadSeqDebug`
  - `brReadCanvasRoadSeq`
  - `brKickProbeRoadSeqFrames`
  - `brCommitProbeRoadPack`
  - `buildSnapshotNow`
  - `__cw_startPush`
  - road probe
  - countdown source
  - bet tail/click logic
- `DevTools\cw_probe_seq_roi.js`
  - ROI scan
  - frame probing

## Invariant phải giữ

- Không để shell frame thắng live frame khi live frame đã sẵn sàng.
- Không settle pending nếu chưa qua gating hợp lệ.
- Không update WPF control ngoài `Dispatcher`.
- Không dùng lại CDP websocket cho runtime ZoWin hiện tại nếu chưa chứng minh được giá trị thật.
- Không để panel C# hiển thị chuỗi khác `rawSeq` mà không có lý do/log rõ ràng.
- Không phá countdown hiện tại; người dùng đã xác nhận countdown đồng bộ OK.
- Không để phần thống kê `CON/HÒA/CÁI` hoặc vùng dealer/video bị tính vào road sequence.
- Không để probe nền không có visual authority ghi đè kết quả của `await __cw_showRoadSeqDebug(8)`.
