# PROJECT_CONTEXT

## Tổng quan
- `BaccaratWM` là app WPF (`net8.0-windows`) tự động theo dõi bàn Baccarat và đặt cược qua `WebView2` + JavaScript bridge.
- Chạy 2 mode chính.
- Mode standalone app.
- Mode plugin cho ABX Hub (`ABX_HUB`, `BaccaratWMPlugin.cs`).
- Logic nghiệp vụ tập trung chủ yếu ở `MainWindow.xaml.cs` và `js_home_v2.js`.

## Công nghệ
- C#: .NET 8, WPF, async/await, `Dispatcher`, `INotifyPropertyChanged`.
- Web: WebView2 + CDP (`CallDevToolsProtocolMethodAsync`) + script injection.
- JS bridge: `window.chrome.webview.postMessage` cho message `abx`.
- Data/IO: JSON config cục bộ, CSV lịch sử cược, log chẩn đoán.

## Flow hoạt động chính
- Khởi tạo WebView2, inject script (`TOP_FORWARD`, `GAME_TABLE_PUSH_JS`, `FRAME_AUTOSTART`, `js_home_v2.js`).
- JS thu thập trạng thái lobby/game và gửi về C# (`home_tick`, `table_update`).
- C# đồng thời nghe network/CDP để parse feed protocol (`20/21/24/25/26/33/35/38...`) và cập nhật room/cache.
- Task chiến lược (`Tasks/*`) quyết định side + amount rồi gọi bridge đặt cược `__cw_bet`.
- Khi dispatch bet, C# ghi `pending`; khi có tín hiệu kết thúc phiên/round thì finalize kết quả + cập nhật thống kê/UI.

## Coding rules
- Mọi cập nhật UI phải đi qua `Dispatcher`.
- Mọi truy cập shared mutable state phải giữ đúng lock gate hiện có (`_pendingBetGate`, `_roomFeedGate`, `_tableTasksGate`, `_popupServerRoadGate`, ...).
- Gọi JS từ C# ưu tiên đường đã serialize (`EvalJsLockedAsync`, `_domActionLock`) để tránh race.
- Không thêm parser “cứng” theo 1 payload duy nhất; giữ parse tolerant vì feed WM thay đổi format.
- Không bỏ log prefix chuẩn (`[WM_DIAG]`, `[ROOMDBG]`, `[OVERLAY]`, `[HIST]`) vì đang dùng để điều tra thực địa.

## Naming rules
- Side dùng chuẩn `P/B/T` hoặc `PLAYER/BANKER/TIE`; normalize trước khi so sánh.
- Session/table key phải normalize trước khi dùng map/queue (`NormalizeSessionKey`, table id canonical).
- Tên method flow theo động từ rõ nghĩa: `Try*` cho parse/check, `Ensure*` cho init, `Finalize*` cho chốt phiên.
- Trạng thái tạm/pending phải phản ánh scope theo tên biến (`_pendingRow`, `_pendingBetsByTable`, `LastFinalizedSessionKey`).

## Rule quan trọng
- Ưu tiên nguồn room feed theo độ tin cậy runtime.
- `protocol35` > `protocol21` wrapped > `table_update` DOM.
- Cơ chế dedupe/finalize theo session là bắt buộc, không được bỏ.
- Overlay là lớp hiển thị điều phối thao tác; không được biến overlay thành nguồn sự thật duy nhất của engine.

## WebSocket flow
- JS hook `WebSocket`, `fetch`, `XHR` để bắt tín hiệu và emit message về host.
- C# đăng ký CDP `Network.webSocketFrameReceived/Sent`, `Network.responseReceived`, `Network.loadingFinished` để lấy payload raw.
- Parser C# tách room/game state từ protocol feed, merge vào cache `_protocol21Rooms`, rồi publish room list.
- Khi parser miss, hệ thống giữ fallback đường DOM/`table_update` và ghi `WM_DIAG`.

## Pending flow
- Khi lệnh bet được dispatch thành công, tạo `BetRow` pending và enqueue theo table.
- Theo dõi session key + trạng thái round từ popup-road/home tick.
- Dùng `TryMarkFinalizeOncePerTableSession` để đảm bảo mỗi table/session chỉ finalize 1 lần.
- Finalize ghi kết quả thắng/thua/hòa, account, CSV, stats overlay, rồi clear pending đúng table.

## Threading/UI rules
- Không block UI thread bằng network/IO dài; dùng async và marshal lại UI bằng `Dispatcher`.
- Không thao tác collection bind UI từ thread nền.
- Lock scope càng nhỏ càng tốt; tuyệt đối tránh lock chồng nhiều gate không cần thiết.
- Mọi thay đổi state task đang chạy phải qua gate `_tableTasksGate`.

## Tuyệt đối không được phá
- Cơ chế inject `js_home_v2.js` từ disk/embedded fallback.
- Dedupe dispatch-ack/pending finalize theo session.
- Room feed arbitration giữa protocol35/protocol21/table_update.
- Plugin debug pipeline trong `.csproj` (copy plugin sang `AutoBetHub/Plugins`, bind `ABX.Core`).
- Fallback icon/resource (`FallbackIcons`, `PackRes`) để UI không vỡ khi thiếu resource runtime.
