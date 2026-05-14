# TODO

## Task đang làm
- Ổn định toàn bộ luồng `no-cc` cho page mới (tick/prog/seq/status).
- Giữ đồng bộ hiển thị giữa canvas panel và bảng điều khiển phải.

## Task chưa hoàn thành
- Thêm log debug toggleable cho parser seq/prog (bật/tắt theo flag).
- Rà soát lại các tail DOM còn hard-code để giảm phụ thuộc class động.
- Dọn warning nullable lớn trong `MainWindow`/`Tasks`.

## Task cần refactor
- Tách `MainWindow.xaml.cs` thành các service:
- `BridgeMessageRouter`.
- `UiStateUpdater`.
- `BetHistoryService`.
- Chuẩn hóa parser JS thành từng module nhỏ (`prog`, `seq`, `totals`, `status`).

## Task ưu tiên cao
- Kiểm thử hồi quy sau đổi page:
- `TextMap`.
- `Prog` countdown 20->0 không kẹt 1s.
- `Seq` 0..4 khớp road thực tế.
- Chuẩn hóa bộ icon `Assets/Seq` đồng nhất kích thước/style (hiện 0/1/2/3/4 đã lên 32x32 style mới).

## Task cần test lại
- Chuyển trang liên tục rồi quay lại game: verify `__cw_startPush` autostart no-cc vẫn chạy.
- `home_tick` rỗng không được xóa tên/tài khoản đang hiển thị.
- Status rule cứng theo prog:
- `prog > 0` luôn xanh `Đang cược`.
- `prog <= 0/null` luôn đỏ `Chờ kết quả`.
- `ScanTK` và luồng task đọc `snap.seq` trên chuỗi dài > 52 ký tự.
- Build Debug khi app đang mở/đóng (lock exe + ABX.Core dependency).
