# PROJECT_CONTEXT

## Phạm vi

`TaiXiuLiveHit` là ứng dụng WPF .NET 8, chạy độc lập ở Release và làm plugin cho AutoBetHub/ABX ở Debug. Ứng dụng đọc dữ liệu Tài/Xỉu Live trong WebView2, điều phối strategy theo tab và gọi JavaScript để đặt cược.

## Điểm vào và tài liệu chuẩn

- UI/orchestration: `MainWindow.xaml`, `MainWindow.xaml.cs`, `MainWindow.Startup.cs`, `MainWindow.EmbedMode.cs`.
- Bridge: `WebView2LiveBridge.cs` và resource `v4_js_xoc_dia_live.js`.
- Strategy/money: `Tasks/*.cs`, đặc biệt `Tasks/TaskUtil.cs`, `Tasks/GameContext.cs`, `Tasks/MoneyManager.cs`, `Tasks/MoneyHelper.cs`.
- Mô tả module: `ARCHITECTURE.md`.
- Rule nghiệp vụ: `BUSINESS_RULES.md`.
- Trạng thái hiện tại: `CURRENT_STATE.md`.
- Việc còn lại và rủi ro: `TODO.md`, `BUGS.md`.

## Invariants cần giữ khi coding

- Luồng chạy phải bảo đảm WebView/bridge/game data sẵn sàng trước khi chạy task.
- Contract JavaScript hiện tại gồm `window.__cw_startPush`, `window.__cw_bet` và message `abx`.
- Update WPF từ task/timer nền phải qua `Dispatcher`; loop dài phải hỗ trợ `CancellationToken`.
- State quản lý vốn phải giữ đúng khi người dùng đổi chuỗi tiền trong lúc chạy; chuỗi mới áp dụng từ ván kế tiếp.
- Ký tự `0` trong chuỗi T/X hoặc I/N bỏ qua đúng một ván, không bet và không cập nhật money/win-loss.
- Config/stats phải giữ cơ chế ghi atomic và gate hiện có.

Không dùng TODO/BUGS làm mô tả kiến trúc; đó là danh sách công việc/rủi ro có thể thay đổi.
