# Giai đoạn 2 — Kiểm kê phụ thuộc WebView2

## Phạm vi

Nguồn kiểm kê chỉ đọc:

- `D:\PROJECT\ABXHubSolution\BaccaratSexyCasino2\MainWindow.xaml.cs`
- `D:\PROJECT\ABXHubSolution\BaccaratSexyCasino2\WebView2LiveBridge.cs`
- `D:\PROJECT\ABXHubSolution\BaccaratSexyCasino2\Tasks\GameContext.cs`
- `D:\PROJECT\ABXHubSolution\BaccaratSexyCasino2\Tasks\TaskUtil.cs`

Mục tiêu không phải chép WebView2 sang ứng dụng mới. Mục tiêu là thay đúng
biên giao tiếp bằng Chrome Extension/Native Host trong khi giữ nguyên nghiệp
vụ C# phía trên biên đó.

## Bridge cần có trước khi patch

`ChromeGameBridge` phải chỉ cung cấp các lệnh có chủ đích, không mở một API
"chạy JavaScript tùy ý" cho UI:

| API mới | Dữ liệu/ý nghĩa |
|---|---|
| `ConnectAsync()` | Kết nối Desktop Pipe với Native Host |
| `ReadSnapshotAsync()` | Đọc snapshot cuối cùng từ frame game Extension đã chọn |
| `StartPushAsync()` | Bảo đảm JS gốc đang chạy `__cw_startPush()` trong frame authority |
| `StopPushAsync()` | Dừng luồng push khi Desktop dừng/đóng |
| `GetReadiness()` | Trạng thái Native Host, Extension, frame game và snapshot |
| `PlaceBetAsync(BetIntent)` | Gửi một lệnh đặt cược có `RequestId`, bàn, shoe và round |
| `SetInputLockAsync(bool)` | Bật/tắt overlay khóa chuột do Extension thực hiện |
| `SnapshotReceived` | Sự kiện snapshot đã được Native Host nhận từ Extension |
| `NetworkPacketReceived` | Kênh tùy chọn cho packet network thô nếu cần giữ CDP parsing cũ |
| `ConnectionChanged` | Mất/kết nối lại Native Host hoặc Extension |

## 1. Đọc snapshot

| Điểm cũ | Vị trí | Mục đích cũ | Patch bridge chính xác |
|---|---:|---|---|
| `CoreWebView2_WebMessageReceived` | `MainWindow.xaml.cs:4658` | Nhận `tick`, `frame_scout`, `net_probe`, kết quả JS | Thay event WebView bằng `ChromeGameBridge.SnapshotReceived`; giữ `HandleIncomingWebMessageAsync` làm parser/đường tương thích trong lần chuyển đầu |
| `HandleIncomingWebMessageAsync` | `MainWindow.xaml.cs:4672` | Parse JSON và cập nhật snapshot/UI/history | Giữ nguyên phần parser nghiệp vụ; thêm adapter chuyển `GameSnapshot` Protocol thành payload/model `CwSnapshot` cũ |
| `ExecJsAsyncStr` | `MainWindow.xaml.cs:6957` | Chạy JS rồi trả kết quả chuỗi | Không gọi từ UI sau migration; các call snapshot đổi sang `ReadSnapshotAsync()` |
| `TryPullPopupTickFallbackAsync` | `MainWindow.xaml.cs:19549` | Poll snapshot khi popup không push | Bỏ; Extension là nguồn push duy nhất |
| `__cw_readSnapshot()` | probe/bridge cũ | Đọc snapshot trực tiếp trong frame | `ReadSnapshotAsync()` |

Quy tắc dữ liệu: snapshot rỗng không được ghi đè snapshot hợp lệ; cập nhật
chỉ được chấp nhận khi `table/shoe/round/seqVersion` hợp lệ và đúng authority
frame do Extension chọn.

## 2. Bắt đầu/dừng push và nhúng JavaScript

| Điểm cũ | Vị trí | Mục đích cũ | Patch bridge chính xác |
|---|---:|---|---|
| `WebView2LiveBridge.EnsureAsync` | `WebView2LiveBridge.cs:306` | Đăng ký script trên document và hook FrameCreated | Không chuyển; Extension `content-bridge/page-probe` làm việc này |
| `InjectOnPopupDocAsync` | `MainWindow.xaml.cs:4622` | Nhúng JS và gọi push vào popup WebView | Bỏ |
| `EnsureBridgeRegisteredAsync` | `MainWindow.xaml.cs:18895` | `AddScriptToExecuteOnDocumentCreatedAsync` cho top document | Bỏ |
| `InjectOnNewDocAsync` / `InjectGameBridgeOnFrameIfNeededAsync` | `MainWindow.xaml.cs:18935`, `19478` | Nhúng JS vào frame game và autostart | Bỏ; Extension chọn/tiêm đúng frame |
| direct `__cw_startPush(...)` | `MainWindow.xaml.cs:17960` | Bật lại push sau Start task | `await _chromeBridge.StartPushAsync()` |
| `FRAME_AUTOSTART`, `TOP_FORWARD`, `FRAME_SHIM` | hằng JS cũ | Chuyển message từ frame sang WebView host | Bỏ hoàn toàn; Chrome messaging thay thế |

## 3. Thực hiện đặt cược

| Điểm cũ | Vị trí | Mục đích cũ | Patch bridge chính xác |
|---|---:|---|---|
| `GameContext.EvalJsAsync` | `Tasks/GameContext.cs:21` | Dependency để task chạy lệnh JS | Giữ tạm trong patch tương thích, nhưng gán adapter gọi `PlaceBetAsync` thay vì WebView |
| `TaskUtil.PlaceBet` | `Tasks/TaskUtil.cs:170` | Tạo lệnh `__cw_bet_enqueue` / `__cw_bet` | Giữ toàn bộ guard, cooldown, chiến lược và tiền; thay đoạn thực thi JS bằng `ChromeGameBridge.PlaceBetAsync(BetIntent)` |
| `ExecuteOnBetWebAsync` | `MainWindow.xaml.cs:17062` | Chọn Web/popup/frame rồi chạy JS | Thay bằng `PlaceBetAsync` |
| `ExecuteOnBetWebAwaitResultAsync` | `MainWindow.xaml.cs:17246` | Chờ kết quả câu lệnh JS | Thay bằng `BetExecutionResult` có timeout/RequestId |
| `GetBetPipeReadyState` | `MainWindow.xaml.cs:16569` | Kiểm tra WebView, URL, snapshot, trạng thái cược | Giữ toàn bộ kiểm tra snapshot/round/trạng thái; thay các điều kiện WebView/URL bằng `GetReadiness()` |
| `__cw_bet_enqueue()` | `TaskUtil.cs:270` | Hàng đợi lệnh đặt cược trong JS | `PlaceBetAsync(BetIntent)` |
| `ChkLockMouse` / `LOCK_JS` | `MainWindow.xaml.cs:18021–18127` | Khóa chuột trên WebView | `SetInputLockAsync(bool)`; Extension dựng overlay ở frame game |

Không giữ hành vi "optimistic" cũ: Desktop chỉ tạo pending/history sau khi
`BetExecutionResult.Confirmed=true`, không phải chỉ khi hàng đợi JS trả về.

## 4. Điều hướng, popup và chọn frame

| Điểm cũ | Vị trí | Mục đích cũ | Patch bridge chính xác |
|---|---:|---|---|
| `EnsureWebReadyAsync` | `MainWindow.xaml.cs:3519` | Khởi tạo WebView2 và event hooks | Thay bằng `ConnectAsync()`; không tạo trình duyệt nhúng |
| `NavigateIfNeededAsync` | `MainWindow.xaml.cs:3610` | Điều hướng WebView tới lobby/game | Bỏ; người dùng mở Chrome và vào bàn |
| `Web_NavigationCompleted` / `PopupWeb_NavigationCompleted` | `MainWindow.xaml.cs:4231`, `6398` | Đổi UI theo URL | Thay bằng `ConnectionChanged` và `GameSnapshot.FrameHref` |
| Popup/host routing | khoảng `15577–16800` | Mở popup, dò iframe và route game | Bỏ; Chrome giữ nguyên tab/cửa sổ người dùng đang chơi |
| `CoreWebView2_FrameCreated_Bridge` | `MainWindow.xaml.cs:18991` | Theo dõi frame mới | Bỏ |
| `ReadFrameDocProbeAsync` | `MainWindow.xaml.cs:19419` | Chấm điểm frame Baccarat | Extension tiếp tục đảm nhiệm; kết quả authority gửi trong diagnostics/snapshot |
| `Frame_NavigationCompleted_Bridge` | `MainWindow.xaml.cs:19513` | Tiêm lại script sau chuyển frame | Bỏ; Extension tự re-arm |

## 5. Theo dõi network/CDP

| Điểm cũ | Vị trí | Mục đích cũ | Patch bridge chính xác |
|---|---:|---|---|
| `EnableCdpNetworkTapAsync` | `MainWindow.xaml.cs:6983`, `7214` | Bật Network CDP và bắt XHR/WebSocket | Không còn Desktop WebView/CDP; chưa port vào Desktop |
| `CoreWebView2_WebResourceResponseReceived` | `MainWindow.xaml.cs:14097` | Đọc response network | Bỏ event WebView |
| `CallDevToolsProtocolMethodAsync` | `MainWindow.xaml.cs:7158`, `7232`, `7435`, `14508` | Lấy body, enable/disable Network, discovery | Nếu cần giữ network authority, Extension debugger phải gửi `network_packet`; Desktop tái sử dụng parser cũ qua `NetworkPacketReceived` |
| `TryProcessNetworkRoadInfoCountsPacket` | `MainWindow.xaml.cs:8315` | Tạo lịch sử từ `roadInfo.winCounts` | Giữ parser, nhưng chỉ gọi khi Extension gửi packet network hợp lệ |
| `ProcessNetworkWinnerPacket` | `MainWindow.xaml.cs:11877` | Append/settle bằng winner network | Giữ thuật toán settlement; nguồn packet đổi sang `NetworkPacketReceived` |

**Quyết định Giai đoạn 2A:** Extension/JS gốc đang lấy seq chính xác nên Desktop
sẽ ưu tiên `SnapshotReceived`. CDP/network cũ không được tự suy luận hoặc ghi
đè chuỗi trong lần nối đầu. Nó chỉ mở lại ở kênh riêng nếu golden test cho thấy
cần để giữ đúng chuỗi/settlement như C# cũ.

## Thứ tự patch thực hiện sau kiểm kê

1. Khôi phục Pipe client đã lưu ở `migration/stage0-desktop-skeleton` thành
   `ChromeGameBridge`.
2. Chuyển `DisplayState/GameSnapshot` Protocol sang `CwSnapshot` cũ và gọi
   luồng cập nhật UI hiện có.
3. Thay `EnsureWebReadyAsync`/startup bằng `ConnectAsync` + `StartPushAsync`.
4. Thay `GetBetPipeReadyState` để kiểm tra bridge readiness, nhưng vẫn khóa
   đặt cược ở chế độ dry-run.
5. Sau khi UI, table, round, seq, timer và balance trùng Chrome, mới patch
   `TaskUtil.PlaceBet` sang `PlaceBetAsync`.
6. Cuối cùng mới thêm channel network packet nếu đối chiếu C# cũ chứng minh
   snapshot JS không đủ cho settlement.

## File dự kiến sửa ở Giai đoạn 2A

- `src/BaccaratChromeAgent.Desktop/MainWindow.xaml.cs`
- `src/BaccaratChromeAgent.Desktop/MainWindow.Startup.cs`
- `src/BaccaratChromeAgent.Desktop/Bridge/ChromeGameBridge.cs` (mới)
- `src/BaccaratChromeAgent.Desktop/Bridge/DesktopPipeClient.cs` (mới)
- `src/BaccaratChromeAgent.Desktop/Bridge/LegacySnapshotAdapter.cs` (mới)
- `src/BaccaratChromeAgent.Protocol/Messages.cs` (bổ sung trường compatibility nếu thiếu)

`Tasks/TaskUtil.cs` và `Tasks/GameContext.cs` được giữ nguyên trong 2A; chúng
chỉ được sửa ở pha bridge đặt cược sau khi đồng bộ dữ liệu được nghiệm thu.
