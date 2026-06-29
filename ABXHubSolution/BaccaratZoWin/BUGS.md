# BUGS

## Cap nhat bug 2026-06-29

### Bug pending update cham

- Trieu chung: bang dieu khien da co thang/thua nhung pending history van `Dang cho`, chi update khi seq/tick advance hoac sang van sau.
- Nguyen nhan da thay: UI win/loss co luc den sau khi seq da settle; `FinalizeLastBet(...)` phu thuoc gating seq/context voi mot so nguon; `WaitAuthoritySettleAsync` nhieu luc duoc publish tu seq gate nen khong som hon seq.
- Fix moi: them `FinalizeOldestPendingBetTrusted(...)` de dong pending cu nhat khi co result tin cay, khong doi seq advanced.
- Nguon da noi vao fix: `net-gp-winner`, `UiFinalizeBetResult`, UI win/loss fallback, `FinalizePendingBetsWithWinners`.
- Log xac minh: `[BET][HIST][TRUSTED-FINAL]`.
- Neu van loi: xem `[BET][HIST][TRUSTED-SKIP]`, `pending=0`, hoac khong co log trusted nao.

### Bug dat tien chua du

- Trieu chung: dat 30 banker nhung chi vao 10.
- Nguyen nhan nghiep vu: verify tien tren ban cham/sai nhip lam code dung sau click dau.
- Huong fix da chot: khong verify tien da phan anh sau moi click; click dung so luong can thiet la xong.

### Bug balance nhay ve `-`

- Trieu chung: tai khoan nhay ve `-` roi ve so dung.
- Huong fix da chot: khong ghi de UI bang `-` khi snapshot thieu balance; giu balance cuoi hop le.

### Bug road ROI unstable

- Trieu chung: `__cw_showRoadSeqDebug(8)` co luc lay thong ke phia tren hoac max/cup phia duoi.
- Nguyen nhan: ROI/filter qua rong, bam toa do/layout tuyet doi va scoring chua loai du vung khong phai road.
- Workaround: khong sua ROI neu da dung; khi can sua thi dung overlay va log `rejectedRows`, `rejectedCellsLen`, `shapeSizeMed` de xac minh.

> Danh sách bug/rủi ro đang biết tới theo trạng thái hiện tại của app Baccarat ZoWin.

## Bug hiện tại

### 0. Chuỗi kết quả visual road không đồng bộ lên panel C#

- Triệu chứng:
  - `await __cw_showRoadSeqDebug(8)` trong DevTools hiện vẫn có thể đọc sai vì overlay ROI lấy cả phần thống kê `CON/HÒA/CÁI`.
  - Panel C# `CHUỖI KẾT QUẢ` hiển thị chuỗi khác hoặc sai theo cùng nguồn visual road sai.
  - Ví dụ mới nhất: overlay có row đầu `n=3` là thống kê, nhưng vẫn bị đưa vào rawSeq.
  - Countdown đã được xác nhận đang đồng bộ OK và không phải trọng tâm bug này.
- Yêu cầu đúng:
  - `__cw_showRoadSeqDebug(8)` trước hết phải chỉ lấy road kết quả, không lấy thống kê.
  - panel C# phải đồng bộ với `rawSeq` visual road đã đúng.
  - sau lần đồng bộ đầu, JS chỉ kiểm tra thưa và chỉ đẩy lên C# khi visual rawSeq thay đổi để tránh cao tải.
  - nếu visual road reset về rỗng, chuỗi rỗng vẫn phải được đẩy để clear panel.
- Nguyên nhân đã thấy trong log:
  - `brCommitProbeRoadPack(...)` từng lỗi `ReferenceError: _forcePushOnce is not defined`.
  - probe nền `buildSnapshotNow-empty-pull` có lúc chọn ROI sai như `auto-road-b`.
  - các probe nền có thể ghi đè chuỗi đúng từ visual debug nếu không khóa quyền authority.
  - C# nhận `main-pull` nhưng payload có thể `rawSeq` rỗng hoặc khác visual debug.
  - Log runtime mới cho thấy app chạy embedded JS `len=792314`, probe có `probe-canvas-frames-hit`, nhưng `[PULLRAW]` vẫn `seq=""`, `rawSeq=""`.
  - Lý do cụ thể: reason `buildSnapshotNow-empty-pull` không thuộc visual authority, nên dù probe/cache có rawSeq, state `window.__cw_seq*` không được publish vào tick.
  - Log/ảnh mới hơn cho thấy `debug-road-source-pack` có thể chọn ROI bắt cả vùng thống kê, hoặc overlay `__cw_showRoadSeqDebug(8)` có row thống kê đầu tiên.
  - ROI/filter hiện tại chưa loại chắc hàng thống kê khi row thống kê có 3 ô trải rộng ngang tương đương road.
- Trạng thái:
  - chưa fix dứt điểm.
  - đã thử thêm `push-visual-sync`, `auto-visual-road-sync`, visual authority, bỏ validate, và chỉ send khi chuỗi thay đổi.
  - đã đổi để chuỗi rỗng là state hợp lệ, dùng để clear panel khi road reset.
  - đã bỏ ROI `left-road-live-*` và chỉnh scoring ở `r57-roi-score`.
  - đã thêm rule bỏ row thống kê đầu ở `r58-drop-stat-row`, nhưng người dùng báo vẫn bị lấy phần thống kê, nên rule này chưa đủ.
- Cần kiểm tra tiếp:
  - JS embedded đã rebuild chưa, vì app đang chạy sẽ khóa exe và build copy fail.
  - `Loaded JS from embedded | len=...` trong log đã đổi sau build chưa.
  - log revision có phải `SEQFIX-20260627-r58-drop-stat-row` hoặc bản mới hơn không.
  - `await __cw_showRoadSeqDebug(8)` còn row thống kê đầu `n=3`/`n=4` không.
  - `debug-road-source-pack.rawSeq`, `rows`, `cellsLen`, `roi` có khớp road thật không.
  - `canvas-road-candidates.selected` có ROI phủ lên thống kê không.
  - `[PULLRAW]` payload có `rawSeq` đúng không.
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

- Chuỗi visual road từ `await __cw_showRoadSeqDebug(8)` vẫn có thể lấy cả hàng thống kê, nên chưa thể coi là nguồn đúng.
- Panel C# chưa thể ổn định chuỗi kết quả cho đến khi ROI/filter visual road loại được thống kê.
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
- Road scanner hiện có rủi ro nhầm hàng thống kê với road:
  - hàng thống kê có màu xanh/tím/đỏ giống kết quả.
  - row thống kê thường có 3 item và nằm ngay trên road.
  - nếu ROI auto bắt quá cao hoặc filter không bỏ row đầu, rawSeq sẽ bị chèn ký tự sai ở đầu.

## Workaround tạm thời

- Khi nghi panel C# sai chuỗi:
  - chạy `await __cw_showRoadSeqDebug(8)` để xem visual rawSeq, ROI, cell count, row count
  - quan sát overlay: nếu thấy row đầu là thống kê `CON/HÒA/CÁI` thì kết quả debug đang sai, chưa dùng để so panel.
  - kiểm tra object trả về:
    - `rawSeq`
    - `rows.map(x => x.seq)`
    - `roi`
    - `cells.length`
  - kiểm tra `(await __cw_probeRoadSeqFrames(8)).rawSeq`
  - so với panel `CHUỖI KẾT QUẢ`
  - kiểm tra log `[JSSEQ][debug-road-source-pack]`, `[JSSEQ][canvas-road-candidates]`, `[JSSEQ][visual-road-apply-candidate]`, `[JSSEQ][visual-road-apply-state]`, `[JSSEQ][visual-road-apply-unchanged]`, `[PULLRAW]`, `[SEQ][RX]`, `[SEQ][UI][RENDER]`
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
  - `brFilterCanvasRoadBodyItems`
  - `brAutoDetectCanvasRoadRois`
  - `brShouldPreferCanvasRoadPack`
  - `brSelectBestProbeRoadFrame`
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
