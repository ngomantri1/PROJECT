# BUGS

## Bug hiện tại
- Vào game WM chưa ổn định tuyệt đối.
- Triệu chứng: có phiên vẫn chậm hoặc không vào sâu game dù app đã bớt lag.
- Dấu hiệu log: xuất hiện cụm loop điều hướng popup và redirect chặn mạng.

- Room feed có thể trống sau chuỗi điều hướng lỗi.
- Triệu chứng UI: danh sách bàn có lúc rỗng (`Không có mục nào`) dù đã login.

## Bug đã fix
- Lag nặng lúc vào trang do loop điều hướng dày đã được giảm mạnh.
- Đã thêm guard runtime:
- Retry budget + cooldown cho `about:blank`.
- Recover budget + cooldown cho `blockmsg -> wm`.
- Suppress `fallback-main` trong cửa sổ `block-recover`.

- Lỗi ký tự tiếng Việt bị sai mã trong phần chỉnh sửa trước đã được cảnh báo và yêu cầu tránh tái diễn.

## Bug chưa fix
- Vẫn còn case không ổn định khi hop từ `thirdg.html` sang WM game host.
- Chưa có dashboard metric gọn theo phiên popup để nhìn nhanh nguyên nhân fail.
- Một số warning build cũ của solution vẫn tồn tại (không chặn build nhưng tăng nhiễu).

## Nguyên nhân bug
- Luồng popup phụ thuộc redirect nhiều bước và môi trường mạng chặn trung gian (`blockmsg.greennet`).
- Trước đây policy retry/recover quá nhanh gây vòng lặp dày, bào tài nguyên UI/thread.
- Runtime có nhiều nguồn tín hiệu song song (JS/CDP/popup/main) dễ tạo race nếu không có guard.

## Workaround tạm thời
- Khi game chưa vào ổn định, ưu tiên quan sát log phiên mới nhất trước khi chạy nhiều bàn.
- Giữ số bàn chạy thấp trong lúc tune threshold popup guard.
- Nếu room rỗng, refresh đúng sau khi popup đã ổn định URL game host.

## Vùng code dễ lỗi
- `MainWindow.xaml.cs`:
- `PopupWeb_NavigationStarting`
- `PopupWeb_NavigationCompleted`
- `StartPopupNavigationWatchdog`
- `FallbackPopupToMainAsync`

- `js_home_v2.js`:
- hook websocket/xhr/fetch
- bridge `__cw_bet`
- overlay state sync

- Parser room feed protocol (ưu tiên/fallback giữa nhiều nguồn).
