# PROJECT_CONTEXT

## Tổng quan project
- `BaccaratWM2` là app WPF (.NET 8) tự động hóa Baccarat bằng `WebView2` + bridge JS (`js_home_v2.js`) + parser CDP network.
- Chạy 2 chế độ: standalone và plugin trong ABX Hub.
- Logic runtime tập trung chủ yếu ở `MainWindow.xaml.cs`.

## Trạng thái hiện tại (31/05/2026)
- Trọng tâm hiện tại là luồng mở sảnh WM từ trang wrapper kiểu:
- `https://shbett7.vip/Lobby/Navigation?url=%2FAccount%2FLoginToSupplier%3FSupplierType%3DWM`
- Vấn đề thực địa trên VPS:
- Có phiên popup mở ra nhưng chỉ trắng/đen hoặc đứng lâu ở wrapper/transit WM.
- Có phiên nếu chờ đủ lâu thì vẫn tự đi tiếp sang WM thật (`wmvn.m8810.com`) và load room thành công.
- Kết luận điều tra log:
- Điểm nghẽn chính không còn là `thirdg.html` như nhánh cũ, mà là transit WM rất chậm trên VPS yếu.
- `Lobby/Navigation` chỉ là wrapper top-level; transit thật nằm ở `Account/LoginToSupplier?SupplierType=WM` trong iframe hoặc chặng chuyển tiếp nội bộ.
- Trên Chrome, transit này vẫn tự hoàn tất.
- Trên WebView2, nếu app can thiệp quá sớm bằng retry/kick thì dễ làm hỏng flow hoặc dừng trước khi transit tự hoàn tất.

## Patch gần nhất đã áp dụng
- `MainWindow.xaml.cs`:
- Đã thêm build marker điều tra theo từng vòng patch `v6`, `v7`, `v8`, `v9`.
- Đã ép `User-Agent` desktop cho cả Web chính và `PopupWeb`.
- Đã sửa `NewWindowRequested` để giữ đúng flow `about:blank` popup trước khi provider tự write/navigate.
- Đã thêm log chẩn đoán transit WM:
- `WM_TRANSIT_DIAG`
- `WM_TRANSIT_HTTP`
- `POPUPFRAME[TRANSIT]`
- `v8` từng thử kick trực tiếp `LoginToSupplier` frame, nhưng phát sinh điều hướng nhầm sang URL rác và gây `Server Error in '/' Application`.
- Patch hiện tại `v9` đã bỏ hướng kick transit frame, chuyển sang `passive transit hold`:
- Giữ popup sống lâu hơn cho transit WM hợp lệ.
- Chỉ recovery khi có dấu hiệu lỗi thật như `about:blank` kéo dài hoặc `NavigationCompleted` lỗi.
- Build pass (`dotnet build`, 0 error).

## Log tham chiếu chính
- `D:\NOTE\OneDrive\Desktop\log\20260531.log`
- `D:\NOTE\OneDrive\Desktop\log\network-log.har`
- `D:\NOTE\OneDrive\Desktop\log\shbett7.vip.har`
- Dấu cần theo dõi:
- `[BUILD] diag-probe-matrix-v9-passive-transit-hold`
- `NewWindowRequested -> Lobby/Navigation?...SupplierType=WM`
- `WM_TRANSIT_DIAG`
- `[PopupWeb][TRANSIT-HOLD]`
- `[PopupWeb][STUCK-RECOVERY]`
- `NavigationStarting/Completed -> LoginToSupplier`
- `PopupWeb NavigationStarting/Completed`
- `NavigationCompleted: OK | https://wmvn.m8810.com/?sid=...`
- `Gateway.php`
- `rooms=39`

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
- Không bypass hệ thống ngoài, không gian lận, không đổi kết quả thật.
- Với WM transit trên wrapper, ưu tiên sửa logic UI/state nội bộ và timeout/recovery của `WebView2`, không đổi endpoint thật của nhà cái.

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
- Luồng popup/new-window cho wrapper WM và host game.
- Guard dedupe dispatch/finalize.
- Arbitration room feed đa nguồn.
- Pipeline plugin debug trong `.csproj` và fallback resource icon.
