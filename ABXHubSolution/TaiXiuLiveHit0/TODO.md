# TODO

## Cập nhật hôm nay (2026-07-25)
- Đã hoàn thành: bật/tắt Canvas Watch bằng cấu hình `SHOW_CANVAS_WATCH`.
- Đã hoàn thành: đồng bộ countdown canvas theo `progSec` để khớp bảng C#.
- Đã hoàn thành: thay tail mới cho `Phiên`, `TK`, `Username`, tổng cược `Tài/Xỉu` theo scene `LobbyNew`.
- Đã hoàn thành: bỏ fallback tail cũ cho `Phiên`, `TK`, `Username`.
- Đã hoàn thành: C# chỉ dùng một luồng `snap.username` và `snap.totals.A` cho `Tên nhân vật` và `Tài khoản`.
- Đã hoàn thành: xóa các cửa Xóc Đĩa còn sót khỏi canvas/model (`Sấp đôi`, `Tứ trắng`, `Tứ đỏ`, `3 trắng`, `3 đỏ`).
- Cần test lại sau restart app/plugin: Canvas Watch hiển thị `TK | TÀI | XỈU` đúng với hình game và bảng C#.

## Cập nhật hôm nay (2026-06-02)
- Đã hoàn thành: fix đổi `TxtStakeCsv` khi task đang chạy để ván kế tiếp ăn chuỗi tiền mới.
- Đã hoàn thành: giữ nguyên level hiện tại nhưng map sang giá trị của chuỗi mới cho non-`MultiChain`.
- Đã hoàn thành: refresh `StakeChains`/`StakeChainTotals` live cho `MultiChain` mà không cần restart task.

## Cập nhật hôm nay (2026-05-27)
- Đã hoàn thành: fix pending history không cập nhật `Result/WinLose` sau khi có kết quả.
- Đã hoàn thành: tách trigger finalize pending khỏi lock `NI` bằng `_pendingBaseSeq`.

## Cập nhật hôm nay (2026-05-13)
- Đã hoàn thành: thêm `Task 18) Bám cầu trước nâng cao` từ Task 5.
- Đã hoàn thành: nối UI + mapping runtime cho index `17`.
- Đã hoàn thành: cập nhật context docs.

## Task đang làm
- Ổn định bridge WebView2/frame reinject + probe readiness.
- Duy trì `18` strategy chạy theo tab độc lập.
- Đồng bộ config/stats theo tab + global credentials.

## Task chưa hoàn thành
- Tách nhỏ `MainWindow.xaml.cs` (đang quá lớn).
- Hợp nhất 2 nhánh bridge (`WebView2LiveBridge` và bridge nội tại `MainWindow`) để giảm drift.
- Chuẩn hóa encoding comment/log tiếng Việt cũ.

## Task cần refactor
- Tách service theo domain: Web, StrategyRunner, License, BetHistory, Tabs.
- `TaskUtil.PlaceBet`: xác nhận success theo kết quả JS thực tế, không hardcode.
- Tách/loại bớt flow legacy (`*_Legacy`) nếu không còn dùng.

## Task ưu tiên cao
- Sửa logic success/fail trong `TaskUtil.PlaceBet`.
- Sửa `ValidateSeqCL/ValidateSeqNI` cho khớp rule hiển thị (2-50).
- Gia cố `WaitRoundFinishAndJudge` để tránh loop vô hạn khi session rỗng/không đổi.
- Quyết định lại heartbeat lease (đang tắt bằng `if(false)`).

## Task cần test lại
- Test Canvas Watch sau khi reload JS embedded: không còn các cửa Xóc Đĩa.
- Test `Tên nhân vật` và `Tài khoản` trên bảng C# khớp canvas.
- Test tổng cược `TÀI/XỈU` trên canvas khớp số hiển thị trong game.
- Test countdown canvas và C# cùng số giây.
- Test đổi chuỗi tiền khi đang chạy:
- đang ở mức 1 của chuỗi cũ -> sửa chuỗi mới -> ván sau lên mức 2 phải lấy mức 2 của chuỗi mới.
- Test cả non-`MultiChain` và `MultiChain` khi sửa `TxtStakeCsv` giữa phiên.
- Test lại luồng pending: tạo bet -> chờ `seq` đổi -> kiểm tra `Result/WinLose/Account` được chốt đúng cho mọi dòng pending.
- Regression Task 5 vs Task 18 trên cùng dữ liệu đầu vào.
- Play/Stop liên tục khi nhiều tab chạy song song.
- Reinject bridge khi iframe/navigation thay đổi nhanh.
- Task 17 (multi-side): finalize winners + account delta + pending rows.
- Trial/license expiry theo local timezone và release lease khi đóng app.
- Lock mouse trên VPS/RDP khi toggle nhiều lần.
