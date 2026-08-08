# ARCHITECTURE

## Các lớp chính

- `MainWindow*`: lifecycle ứng dụng, WebView2, tab state, play/stop, history và UI.
- `WebView2LiveBridge`: inject/reinject bridge cho document/frame.
- `v4_js_xoc_dia_live.js`: quét scene/canvas, phát `tick`, xếp hàng lệnh bet và trả event bet.
- `Tasks/*.cs`: strategy (`IBetTask`) và tiện ích chờ round, đặt bet, judge, cập nhật money.
- `Models.cs`: snapshot và model dùng chung.
- `TaiXiuLiveHitPlugin.cs`: adapter plugin ở Debug.

## Luồng runtime

1. `MainWindow` load config/stats, khởi tạo WebView2 và inject bridge.
2. JavaScript phát `tick` qua `chrome.webview.postMessage`; `MainWindow` cập nhật snapshot/UI.
3. Khi Play, `MainWindow` validate input, chờ bridge/game data, tạo `GameContext` và chạy task theo strategy index `0..17`.
4. Task gọi `TaskUtil.PlaceBet`; C# gọi `window.__cw_bet` trong JavaScript.
5. Khi round được nhận là đã đổi, C# judge và finalize history; sau đó cập nhật money/UI.

## State và persistence

- `GameContext` chứa snapshot provider, callback UI và chuỗi tiền runtime. `StakeSeq`, `StakeChains`, `StakeChainTotals` có thể được refresh khi đang chạy.
- `MoneyManager` đọc chuỗi tiền hiện hành qua provider nhưng giữ level/state hiện tại.
- `MultiChainAdvanced` dùng net `MoneyChainProfit` và ngưỡng mỗi dòng bằng tổng các phần tử của dòng; mapping và reset nằm trong `Tasks/MoneyHelper.cs`.
- Config/stats/state/log được quản lý từ `MainWindow.xaml.cs`; UI callback phải marshal qua `Dispatcher`.

## Tích hợp

- Project target `net8.0-windows`, WPF, package chính `Microsoft.Web.WebView2`.
- Release là self-contained single-file `win-x64`; Debug tham chiếu `ABX.Core` từ AutoBetHub theo `.csproj`.
- CDP/WebSocket chỉ là quan sát nếu được bật; nguồn nghiệp vụ chính vẫn là bridge `postMessage`.
