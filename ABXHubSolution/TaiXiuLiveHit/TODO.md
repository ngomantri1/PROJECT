# TODO

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
- Test lại luồng pending: tạo bet -> chờ `seq` đổi -> kiểm tra `Result/WinLose/Account` được chốt đúng cho mọi dòng pending.
- Regression Task 5 vs Task 18 trên cùng dữ liệu đầu vào.
- Play/Stop liên tục khi nhiều tab chạy song song.
- Reinject bridge khi iframe/navigation thay đổi nhanh.
- Task 17 (multi-side): finalize winners + account delta + pending rows.
- Trial/license expiry theo local timezone và release lease khi đóng app.
- Lock mouse trên VPS/RDP khi toggle nhiều lần.