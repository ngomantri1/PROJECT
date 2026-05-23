# PROJECT_CONTEXT

## Tổng quan project
- `BaccaratWM` là app WPF (.NET 8) tự động hóa Baccarat bằng `WebView2` + bridge JS (`js_home_v2.js`) + parser CDP network.
- Chạy 2 chế độ: standalone và plugin trong ABX Hub.
- Logic runtime tập trung chủ yếu ở `MainWindow.xaml.cs`.

## Trạng thái hiện tại (23/05/2026)
- Đã giảm lag lúc vào trang đáng kể.
- Vấn đề chính còn lại: vào game WM vẫn có lúc chậm hoặc không ổn định do loop điều hướng popup.
- Đã triển khai đợt fix mới:
- Giới hạn retry `about:blank`.
- Giới hạn recover `blockmsg -> wm`.
- Cooldown theo cửa sổ thời gian.
- Chặn `fallback-main` trong pha `block-recover`.
- Log tham chiếu chính: `C:\Users\Admin\AppData\Local\BaccaratWM\logs\20260523.log`.

## Công nghệ sử dụng
- C#: WPF, async/await, `Dispatcher`, lock gate theo domain.
- Web runtime: `WebView2`, CDP (`CallDevToolsProtocolMethodAsync`), script injection.
- JS bridge: `window.chrome.webview.postMessage`.
- Data: config/stats JSON local, CSV history, log runtime.

## Flow hoạt động chính
- Khởi tạo WebView2, inject script nền (`TOP_FORWARD`, `FRAME_AUTOSTART`, `js_home_v2.js`...).
- JS gửi `home_tick`, `table_update`, `bet_diag` về host.
- C# song song đọc CDP network/websocket và parse feed room/protocol.
- Task chiến lược tính side/tiền cược rồi gọi bridge `__cw_bet`.
- C# tạo pending, theo dõi session/round, finalize và cập nhật UI/thống kê.

## Coding rules
- Mọi update UI phải qua `Dispatcher`.
- Mọi state chia sẻ phải đi qua gate/lock hiện có.
- JS eval từ C# phải theo đường serialize (`_domActionLock`, helper hiện hữu).
- Parser phải tolerant, không hard-code một schema packet.
- Giữ log prefix chuẩn để điều tra thực địa.

## Naming rules
- Side chuẩn: `P/B/T` hoặc `PLAYER/BANKER/TIE` và normalize trước khi so sánh.
- Key session/table luôn normalize trước khi đưa vào map.
- `Try*` cho check/parse, `Ensure*` cho init, `Finalize*` cho chốt phiên.
- Tên biến pending/state phải phản ánh đúng scope table/session.

## Các rule quan trọng
- Ưu tiên nguồn room feed theo thứ tự tin cậy runtime: `protocol35` > `protocol21 wrapped` > DOM `table_update`.
- Dedupe/finalize theo table-session là bắt buộc.
- Overlay chỉ là lớp thao tác UI, không phải source of truth duy nhất.
- Không sửa/chuyển mã tiếng Việt UI/comment nếu không liên quan nghiệp vụ.

## WebSocket flow
- JS hook `WebSocket/fetch/XHR` gửi signal về host.
- C# bắt CDP `Network.*` để lấy raw payload.
- Parser merge room state vào cache và publish danh sách bàn.
- Nếu parser miss thì fallback sang DOM/table_update.

## Pending flow
- Dispatch bet thành công thì tạo pending row theo table.
- Theo dõi session key và round state.
- Chỉ finalize một lần cho mỗi table-session.
- Finalize xong mới clear pending và cập nhật stats/log/CSV.

## Threading/UI rules
- Không block UI thread bằng IO/network dài.
- Không sửa collection bind UI từ thread nền.
- Lock scope ngắn, tránh lock chồng không cần thiết.
- State chạy đa bàn phải qua gate quản lý task/table.

## Những điều tuyệt đối không được phá
- Cơ chế inject `js_home_v2.js` (disk/embedded fallback).
- Luồng popup/new-window và cert bypass cho host game.
- Guard dedupe dispatch/finalize.
- Arbitration room feed đa nguồn.
- Pipeline plugin debug trong `.csproj` và fallback resource icon.
