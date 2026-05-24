# BUGS

## Bug hiện tại
- Vào game WM chưa ổn định tuyệt đối theo từng phiên chạy.
- Triệu chứng còn gặp:
- Có phiên chỉ tới `PopupWeb NavigationStarting: .../thirdg.html` rồi không thấy `NavigationCompleted`.
- Có phiên vào được bình thường tới `NavigationCompleted OK | wmvn...`.

## Bug đã giảm/đã khắc phục một phần
- Giảm mạnh hiện tượng `double-open` do retry quá dày ở lobby.
- Giảm race lúc popup transition nhờ:
- Guard mở game tăng từ `3000ms` -> `7000ms`.
- Retry loop từ `200ms` -> `1000ms`.
- Cờ `busy` chặn callback async chồng lặp.

## Bug đã fix bổ sung (24/05/2026)
- Thêm self-heal cho case `thirdg` treo:
- Nếu `thirdg` không completed trong `8s` -> retry đúng `1` lần.
- Không lặp vô hạn, không đụng flow mở game chính.

## Bug chưa fix
- Vẫn còn case intermittent liên quan runtime phiên popup (có thể close/restart giữa chừng trước khi `thirdg` complete).
- Chưa có dashboard metric tổng hợp theo phiên popup để nhìn nhanh tỉ lệ thành công/thất bại.
- Warning build cũ của solution vẫn nhiều (không chặn build nhưng gây nhiễu khi điều tra).

## Nguyên nhân bug (theo log gần nhất)
- Vấn đề hiện tại chủ yếu nằm ở pha chuyển tiếp popup (`thirdg -> wmvn`) chứ không phải pinRooms.
- Trong log mới không thấy `POPUPNAV [BLOCK]`, nên không phải do nav block guard chặn nhầm.
- Cert fail từng xuất hiện ở log cũ; log mới nhất không còn cert fail nhưng vẫn có phiên dừng ở `thirdg`.

## Workaround tạm thời
- Khi gặp popup đen/kẹt, xem ngay log phiên mới nhất tại:
- `C:\Users\Admin\AppData\Local\BaccaratWM\logs\20260524.log`
- Theo dõi các marker:
- `NewWindowRequested thirdg`
- `[PopupWeb][thirdg-watch] timeout -> retry once`
- `NavigationCompleted: OK | wmvn...`

## Vùng code dễ lỗi
- `MainWindow.xaml.cs`:
- `PopupWeb_NewWindowRequested`
- `PopupWeb_NavigationStarting`
- `PopupWeb_NavigationCompleted`
- `StartPopupThirdgTimeoutWatch` / `StopPopupThirdgTimeoutWatch`

- `js_home_v2.js`:
- `clickBaccNhieuBanFromHome` (guard mở game)
- `__abx_bacc_lobby_retry` (interval retry + busy guard)
