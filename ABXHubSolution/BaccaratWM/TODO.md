# TODO

## Task đang làm
- Theo dõi hậu kiểm sau đợt fix popup guard (retry budget/cooldown/fallback suppression).
- Đo lại log thực tế để xác nhận giảm dứt điểm loop:
- `Err ConnectionAborted | about:blank`
- `block redirect canceled`
- `recover navigate wm`
- `fallback-main`

## Task chưa hoàn thành
- Ổn định hoàn toàn việc vào game WM ở mọi phiên chạy (vẫn có ca chậm/không ổn định).
- Chuẩn hóa parser feed khi payload WM đổi schema.
- Giảm phụ thuộc vào một file orchestrator quá lớn (`MainWindow.xaml.cs`).

## Task cần refactor
- Tách `PopupNavigationGuardService` khỏi `MainWindow.xaml.cs`.
- Tách `RoomFeedService` và `PendingFinalizeService` có interface rõ ràng.
- Gom helper parse/probe/network vào module riêng có unit test.

## Task ưu tiên cao
- Thu thập log sau fix mới và tune ngưỡng:
- `PopupAboutBlankRetryMaxPerWindow`
- `PopupBlockRecoverMaxPerWindow`
- cooldown/recover hold
- Bổ sung metric tổng hợp theo phiên popup để dễ chẩn đoán (counter/burst).
- Khóa thêm nhánh fallback-main khi main cũng bị redirect sang blockmsg.

## Task cần test lại
- E2E login -> mở game popup -> vào bàn trên nhiều lần chạy liên tiếp.
- Đa bàn: tạo/chạy nhiều bàn và quan sát độ ổn định sau fix guard.
- Pending/finalize theo table-session khi popup chậm hoặc hop URL nhiều lần.
- Tương thích plugin mode trong ABX Hub sau thay đổi popup flow.
