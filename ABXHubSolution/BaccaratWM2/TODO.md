# TODO

## Task đang làm
- Theo dõi hậu kiểm sau patch `31/05/2026`:
- `v9 passive transit hold` cho WM wrapper trên VPS.
- Xác nhận popup WM có tự đi hết transit khi chờ đủ lâu hay không.

## Task chưa hoàn thành
- Ổn định hoàn toàn việc vào sảnh WM ở các site dùng wrapper `Lobby/Navigation -> LoginToSupplier`.
- Chốt ngưỡng timeout/grace tối ưu cho VPS yếu mà không làm chậm các máy khỏe quá mức.
- Phân biệt rõ `transit chậm nhưng sống` với `transit chết thật` để giảm retry sai.

## Task ưu tiên cao
- Thu thập log sau patch `v9` và đo theo phiên popup WM:
- Thời gian từ `Lobby/Navigation` tới `LoginToSupplier`.
- Thời gian từ `LoginToSupplier` tới `wmvn.m8810.com`.
- Có hay không `TRANSIT-HOLD` kéo dài nhưng cuối cùng vào được game.
- Có còn phát sinh `STUCK-RECOVERY` sai trong transit WM hợp lệ hay không.

## Task tối ưu tiếp theo
- Nếu `v9` vẫn còn case đứng mãi, bổ sung nhận diện lỗi transit thật bằng tín hiệu mạnh hơn:
- server error page
- top-level hoặc iframe dừng hẳn không có network mới
- popup process/navigation error
- Nếu cần, tách policy timeout riêng cho:
- `about:blank`
- wrapper `Lobby/Navigation`
- `LoginToSupplier`
- host game WM thật
- Tối ưu thêm log marker để dễ đối chiếu giữa app và Chrome trên cùng VPS.

## Task cần refactor
- Tách `PopupNavigationGuardService` khỏi `MainWindow.xaml.cs`.
- Tách riêng `WmTransitService` hoặc `PopupTransitService` để gom timeout/recovery/probe của WM popup.
- Tách `RoomFeedService` và `PendingFinalizeService` có interface rõ ràng.
- Gom helper parse/probe/network vào module riêng có unit test.

## Task cần test lại
- E2E login -> mở wrapper WM -> vào sảnh WM trên nhiều lần chạy liên tiếp.
- Test trên VPS yếu, máy local và môi trường plugin mode.
- Case transit cực chậm: chờ 10-15 phút để xác nhận app không phá flow tự nhiên.
- Case lỗi thật: `about:blank`, server error page, navigation error.
- Đa bàn: tạo/chạy nhiều bàn và quan sát ổn định sau patch transit-hold.
- Tương thích plugin mode trong ABX Hub sau thay đổi popup flow.
