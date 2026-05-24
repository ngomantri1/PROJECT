# TODO

## Task đang làm
- Theo dõi hậu kiểm sau các patch ngày `24/05/2026`:
- Giảm tần suất retry + tăng guard trong `js_home_v2.js`.
- Watchdog timeout `thirdg` retry 1 lần trong `MainWindow.xaml.cs`.

## Task chưa hoàn thành
- Ổn định hoàn toàn việc vào game WM ở mọi phiên chạy (vẫn còn ca intermittent).
- Chốt chính xác ngưỡng timeout tối ưu cho `thirdg` (hiện tại `8s`).
- Giảm thêm hiện tượng startup đơ ngắn trong lần đầu mở app.

## Task ưu tiên cao
- Thu thập log sau patch và đo theo phiên popup:
- Số lần `NewWindowRequested thirdg`.
- Số lần `thirdg timeout -> retry once`.
- Tỷ lệ `NavigationCompleted OK` của `wmvn`.
- Số phiên dừng ở `NavigationStarting thirdg` không completed.

## Task tối ưu tiếp theo (không đụng flow mở game chính)
- Nếu watchdog retry 1 lần vẫn fail, bổ sung metric nguyên nhân rõ hơn (timeout vs close/restart).
- Ràng buộc reset state watchdog khi app restart/close popup để tránh trạng thái treo giả.
- Tối ưu thêm các nhịp nền startup không cần thiết trước khi người dùng bấm vào game.

## Task cần refactor
- Tách `PopupNavigationGuardService` khỏi `MainWindow.xaml.cs`.
- Tách `RoomFeedService` và `PendingFinalizeService` có interface rõ ràng.
- Gom helper parse/probe/network vào module riêng có unit test.

## Task cần test lại
- E2E login -> mở game popup -> vào bàn trên nhiều lần chạy liên tiếp.
- Case timeout thật: `thirdg` treo > timeout, xác nhận chỉ retry đúng 1 lần.
- Đa bàn: tạo/chạy nhiều bàn và quan sát ổn định sau patch guard/watchdog.
- Tương thích plugin mode trong ABX Hub sau thay đổi popup flow.
