# TODO

> Danh sách việc theo trạng thái hiện tại của code và cuộc chat này.

## Task đang làm

- Ổn định exact live frame cho ZoWin Baccarat.
- Ổn định luồng `rawSeq -> C# display`.
- Sửa bug hiện tại: `await __cw_showRoadSeqDebug(8)` đọc ra chuỗi đúng nhưng panel C# không đồng bộ, hiện có lúc không hiển thị chuỗi kết quả.
- Xác nhận patch mới nhất đã thật sự được build/restart vào app, vì lần gần nhất `BaccaratZoWin.dll` bị khóa bởi `BaccaratZoWin` và Visual Studio nên runtime chưa thể nhận source JS mới.
- Giảm lag/freeze của panel C#.
- Giữ countdown đồng bộ và không đứng.
- Giữ click bet 3 cửa đúng 1 lần.

## Task chưa hoàn thành

- Debug tiếp luồng visual road sync sau patch gần nhất:
  - xác nhận `push-visual-sync` có chạy thật trong live frame không
  - xác nhận log `buildSnapshotNow-empty-pull-kick-visual-sync` xuất hiện khi `[PULLRAW]` đang rỗng
  - xác nhận log `visual-road-publish-state` xuất hiện sau khi probe chọn được ROI/seq hợp lệ
  - xác nhận log `readSeqStateSafe-published-fallback` xuất hiện khi `readTKSeq()` trả rỗng nhưng published seq có dữ liệu
  - xác nhận `brCommitProbeRoadPack(...)` không còn lỗi `_forcePushOnce is not defined`
  - xác nhận C# nhận tick có `rawSeq` khác rỗng
  - xác nhận `UpdateSeqUI(...)` render đúng cùng chuỗi với `await __cw_showRoadSeqDebug(8)`
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

- Ưu tiên số 1 hiện tại: khôi phục hiển thị chuỗi kết quả ở panel C# và bắt nó đồng bộ theo `await __cw_showRoadSeqDebug(8)`.
- Trước khi test runtime, phải đảm bảo build output mới được copy thành công:
  - đóng app `BaccaratZoWin`
  - stop debug/đóng Visual Studio nếu đang khóa `BaccaratZoWin.dll`
  - build `AutoBetHub` Debug nếu thiếu `ABX.Core.dll`
  - build lại `BaccaratZoWin`
  - mở app lại và kiểm tra `Loaded JS from embedded | len=...` đã đổi theo source mới
- Kiểm tra log mới phải có hoặc phải giải thích vì sao không có:
  - `[JSSEQ][probe-canvas-visual-authority]`
  - `[JSSEQ][buildSnapshotNow-empty-pull-kick-visual-sync]`
  - `[JSSEQ][visual-road-publish-state]`
  - `[JSSEQ][readSeqStateSafe-published-fallback]`
  - `reason=push-visual-sync`
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
- Test riêng visual road sync:
  - lúc mới vào bàn
  - sau khi đổi bàn/frame live reload
  - sau khi chuỗi tăng thêm 1 kết quả
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
