# TODO

## Cap nhat TODO 2026-06-29

### Task dang lam / can test ngay

- Test trusted pending finalize sau khi restart app/build moi.
- Khi co ket qua moi, pending row phai co `[BET][HIST][TRUSTED-FINAL]` som nhat co the.
- Neu van cham, kiem tra co log nao xuat hien truoc: `[NETSEQ][WINNER][TRUSTED-FINALIZE]`, `[BET][AUTH][TRUSTED-FINALIZE]`, `[BET][HIST][UI-WL]`.
- Xac nhan `UiFinalizeBetResult` duoc goi truoc `UiWinLoss` trong log/task.

### Task can test lai

- Dat cuoc 30/10/10... phai click du tien, khong dung sau click dau vi verify tien chua thay.
- Tai khoan khong nhay ve `-`; giu balance cuoi hop le.
- `await __cw_showRoadSeqDebug(8)` khong lay thong ke, max/cup/dealer.
- Thay doi do phan giai: road seq van dung.

### Refactor sau

- Tach pending/history settle ra `PendingHistoryService`.
- Tach road scanner/ROI rules ra module rieng trong JS de giam rui ro sua lech ROI.

> Danh sách việc theo trạng thái hiện tại của code và cuộc chat này.

## Task đang làm

- Ổn định exact live frame cho ZoWin Baccarat.
- Ổn định luồng `rawSeq -> C# display`.
- Sửa bug hiện tại: `await __cw_showRoadSeqDebug(8)` vẫn đang lấy cả phần thống kê `CON/HÒA/CÁI` phía trên road, làm `rawSeq` sai ngay từ nguồn visual debug.
- Giữ rule mới của visual road sync: đọc được pack thì sanitize, so sánh với chuỗi hiện tại, chỉ đẩy C# khi khác; chuỗi rỗng vẫn là state hợp lệ để clear panel.
- Giảm lag/freeze của panel C#.
- Giữ countdown đồng bộ và không đứng.
- Giữ click bet 3 cửa đúng 1 lần.

## Task chưa hoàn thành

- Debug/sửa tiếp phần đọc visual road:
  - chạy `await __cw_showRoadSeqDebug(8)` và xác nhận overlay không còn row thống kê ở trên cùng.
  - nếu overlay vẫn có row thống kê `n=3`/`n=4`, sửa tiếp `brFilterCanvasRoadBodyItems(...)`.
  - kiểm tra `brAutoDetectCanvasRoadRois(...)` có tạo ROI quá cao không.
  - kiểm tra `brShouldPreferCanvasRoadPack(...)` có để pack chứa thống kê thắng pack road thật không.
  - kiểm tra `brSelectBestProbeRoadFrame(...)` có ưu tiên frame theo `rawSeq/cells/rows` road thật không.
  - xác nhận `debug-road-source-pack.rawSeq` khớp các bóng road, không khớp phần thống kê.
  - sau khi debug source đúng, xác nhận C# nhận tick có `rawSeq` đúng và `UpdateSeqUI(...)` render đúng.
- Debug tiếp luồng visual road sync sau khi source visual road đã đúng:
  - xác nhận `auto-visual-road-sync`/`push-visual-sync` chỉ gửi khi chuỗi khác hiện tại.
  - xác nhận `visual-road-apply-unchanged` xuất hiện khi chuỗi không đổi và không spam C#.
  - xác nhận chuỗi rỗng được gửi khi road reset từ có dữ liệu về rỗng.
  - xác nhận `visual-road-apply-state` và `visual-road-apply-send` có `rawSeq` đúng khi chuỗi thay đổi.
- Xác nhận sau khi tắt CDP websocket thì freeze giảm rõ trên máy thực tế.
- Xác nhận `PULL_POPUP_TICK_NOW` luôn chọn live frame thay vì `top`.
- Xác nhận countdown vẫn chạy ổn sau vài phút, không chỉ vài giây đầu.
- Xác nhận pending row luôn update/settle đúng ở round đầu tiên khi có kết quả.
- Xác nhận nút `Bắt đầu cược` / `Dừng đặt cược` không còn rơi vào trạng thái click được nhưng state không đổi.

## Task cần refactor

- Tách `MainWindow.xaml.cs` thành các khối nhỏ hơn:
  - `BridgeService`
  - `FrameSelectionService`
  - `TickPipelineService`
  - `PendingHistoryService`
  - `RuntimeProfileService`
- Tách phần log runtime/perf khỏi nghiệp vụ chính.
- Tách logic `PULL_POPUP_TICK_NOW` khỏi chuỗi string lớn trong C# nếu còn tiếp tục mở rộng.

## Task ưu tiên cao

- Ưu tiên số 1 hiện tại: sửa `__cw_showRoadSeqDebug(8)`/ROI/filter để không lấy phần thống kê; nguồn visual debug phải đúng trước khi đồng bộ C#.
- Sau khi source visual debug đúng, ưu tiên số 2 là panel C# đồng bộ đúng theo `rawSeq` đó.
- Trước khi test runtime, phải đảm bảo build output mới được copy thành công:
  - đóng app `BaccaratZoWin`
  - stop debug/đóng Visual Studio nếu đang khóa `BaccaratZoWin.dll`
  - build `AutoBetHub` Debug nếu thiếu `ABX.Core.dll`
  - build lại `BaccaratZoWin`
  - mở app lại và kiểm tra log có revision JS mới nhất, ví dụ `SEQFIX-20260627-r58-drop-stat-row` hoặc bản mới hơn
- Kiểm tra log mới phải có hoặc phải giải thích vì sao không có:
  - `[JSSEQ][debug-road-source-pack]`
  - `[JSSEQ][canvas-road-candidates]`
  - `[JSSEQ][visual-road-apply-candidate]`
  - `[JSSEQ][visual-road-apply-state]` khi chuỗi đổi
  - `[JSSEQ][visual-road-apply-unchanged]` khi chuỗi không đổi
  - `reason=push-visual-sync` hoặc `reason=auto-visual-road-sync`
  - `[PULLRAW]` payload có `rawSeq` đúng
  - `[SEQ][RX] seqLen > 0`
  - `[SEQ][UI][RENDER] len > 0`
- Test lại runtime sau khi:
  - off hẳn CDP websocket
  - tăng điểm exact live frame trong JS pull
  - marshal `SaveConfigAsync` về UI thread
- Kiểm tra log mới phải có:
  - `tap=0`
  - `tapDbg=0`
  - `tapCtx=0`
- Kiểm tra tick/pull trả từ frame game thật, không còn `contextSource=top` trong case live frame đã sẵn sàng.
- Kiểm tra click 3 cửa:
  - `PLAYER`
  - `BANKER`
  - `TIE`
  vẫn hoạt động ở nhiều độ phân giải.

## Task cần test lại

- `Bắt đầu cược`:
  - click vào có đổi sang `Dừng đặt cược`
  - countdown vẫn chạy tiếp
  - panel không đơ sau 2-5 giây
- `Dừng đặt cược`:
  - dừng strategy thật
  - không để pending state lơ lửng
- Chuỗi kết quả:
  - `(await __cw_probeRoadSeqFrames(8)).rawSeq`
  - `await __cw_showRoadSeqDebug(8)`
  - panel C#
  - history settle
  phải nhất quán
- Test riêng trường hợp overlay không được lấy thống kê:
  - hàng thống kê `CON/HÒA/CÁI` không xuất hiện trong `rows.map(x => x.seq)`.
  - `rawSeq` không bắt đầu bằng ký tự lấy từ số thống kê.
  - ROI vàng chỉ phủ vùng road kết quả, không phủ hàng count phía trên.
- Test riêng visual road sync:
  - lúc mới vào bàn
  - sau khi đổi bàn/frame live reload
  - sau khi chuỗi tăng thêm 1 kết quả
  - khi bàn reset road về rỗng
  - khi road có `T`
  - khi road dài nhiều hàng
- Countdown:
  - progress bar mượt
  - màu không giật
  - số giây giảm đều
- History/pending:
  - round đầu tiên có kết quả phải cập nhật pending row đúng
  - không giữ `Đang chờ` sai lâu

## Task cần theo dõi thêm

- `main-pull` có còn spam log `JSSEQ` quá nhiều hay không.
- `buildSnapshotNow-empty-pull` không được ghi đè chuỗi visual authority.
- ROI auto như `auto-road-b` không được thắng `left-road-a` nếu dẫn đến chuỗi panel khác visual debug.
- Nếu panel C# trống chuỗi:
  - kiểm tra `rawSeqFreshLen`
  - kiểm tra `window.__cw_bead_raw_seq`
  - kiểm tra `window.__cw_seq_pub`
  - kiểm tra trong log có `buildSnapshotNow-empty-pull-kick-visual-sync` không
  - kiểm tra `visual-road-publish-state` có seq/len đúng không
  - kiểm tra `readSeqStateSafe-published-fallback` có được gọi không
  - kiểm tra source tick là `main-pull`, `main-frame`, hay live frame
- Nếu source đã sửa nhưng app không thay đổi:
  - kiểm tra build có fail vì `BaccaratZoWin.exe`/`BaccaratZoWin.dll` bị lock không
  - kiểm tra lock bởi `BaccaratZoWin` hoặc `Microsoft Visual Studio 2022`
  - kiểm tra `Loaded JS from embedded` trong log để biết app đang chạy bản JS nào
- Nếu vẫn còn đơ:
  - giảm tiếp tần suất pull fallback
  - throttle thêm log `JSSEQ`, `HUDBAL`, `SEQ UI`
- Kiểm tra các branch `raw-direct`, `board-fallback`, `version-regress`, `table-switch-wait-bead` có còn gây rewrite chuỗi bất thường không.

## Task đã chốt về nghiệp vụ

- Không quay lại dùng `%` cho điều kiện đặt cược.
- Không khôi phục CDP websocket cho ZoWin runtime hiện tại nếu chưa có chứng cứ nó thật sự hữu ích.
- Không quay lại phụ thuộc `snap.seq` cho display khi `rawSeq` đã đủ tốt.
