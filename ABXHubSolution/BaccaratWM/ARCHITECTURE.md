# ARCHITECTURE

## Cấu trúc project
- `MainWindow.xaml` + `MainWindow.xaml.cs`: UI + orchestration trung tâm.
- `js_home_v2.js`: bridge/automation/overlay phía web, bơm trạng thái về C#.
- `Tasks/`: các chiến lược cược cài `IBetTask`.
- `WebView2LiveBridge.cs`: lớp cầu nối message WebView2.
- `BaccaratWMPlugin.cs`, `PluginProbe.cs`, `MainWindow.EmbedMode.cs`: tích hợp ABX Hub/plugin.
- `Models.cs`: model dữ liệu cơ bản (bet/stat/config view model phụ trợ).
- `Compat/PackRes.cs`, `Assets/*`, `Images.xaml`: resource/fallback ảnh.
- `MainWindow.Startup.cs`: bootstrap/khởi tạo cửa sổ.

## Module chính
- UI Orchestrator: điều khiển state, timer, task, pending, room refresh (`MainWindow.xaml.cs`).
- Web Bridge JS: `__cw_bet`, `home_tick`, `table_update`, `__abxTableOverlay` (`js_home_v2.js`).
- Network Parser: parse protocol packet từ CDP + wrapper push (`MainWindow.xaml.cs`).
- Strategy Engine: quyết định lệnh cược theo history (`Tasks/*.cs`).
- Money Engine: quản lý vốn/cấp cược (`MoneyManager.cs`, `MoneyHelper.cs`).
- Plugin Adapter: đóng gói để chạy trong Hub và copy artifact debug.

## Dependency giữa module
- UI Orchestrator phụ thuộc Web Bridge JS để thao tác bàn và nhận trạng thái realtime.
- Strategy Engine phụ thuộc `GameContext` + util (`TaskUtil`) và callback UI/bridge do MainWindow cấp.
- Network Parser phụ thuộc WebView2 CDP events; kết quả feed vào UI Orchestrator.
- Plugin Adapter phụ thuộc MainWindow lifecycle + `ABX.Core` (debug bind từ Hub DLL nếu có).

## File nào phụ trách gì
- `MainWindow.xaml.cs`: state machine runtime, dispatch bet, finalize, parse feed, dashboard.
- `js_home_v2.js`: hook web API, phát hiện bàn, đặt chip, xác nhận cược, overlay room.
- `WebView2LiveBridge.cs`: đăng ký/điều phối message JS->C#.
- `Tasks/IBetTask.cs`: contract strategy.
- `Tasks/GameContext.cs`: context và callback để task thao tác UI/bet.
- `Tasks/TaskUtil.cs`: vòng wait/countdown/session helpers.
- `Tasks/*Task.cs`: chiến lược cụ thể (pattern/stat/ensemble/ngram/hedge...).
- `BaccaratWM.csproj`: cấu hình build plugin/standalone + embed JS/resource + post-build copy.

## Data flow
- Web runtime -> JS bridge: thu thập room/status/history.
- JS -> C#: `postMessage` object `abx` (`home_tick`, `table_update`, `bet_result`, `bet_diag`).
- C# -> Parser/State: normalize + merge room cache + cập nhật table state.
- Strategy task đọc history/state -> tạo quyết định cược -> gọi JS bet.
- Kết quả round/session -> finalize pending -> update UI/stats/log/CSV.

## WebSocket packet flow
- CDP bắt frame/payload network.
- Lọc payload có dấu hiệu WM/protocol.
- Parse snapshot protocol21/protocol35 thành `Protocol21RoomState`.
- Map room visible + publish `latestNetworkRooms`.
- Nếu miss parse: giữ cache cũ + fallback refresh room list từ DOM/table_update.

## UI update flow
- Mọi update control/observable chạy trong `Dispatcher`.
- Task nền gửi callback (`UiSetSide`, `UiSetStake`, `UiAddWin`, ...).
- Overlay update qua script call `window.__abxTableOverlay.*`.
- Dashboard account/room/state đồng bộ từ cả `home_tick` và parser network.

## OCR/canvas flow
- Không có OCR engine native.
- Dự án đang dùng DOM/SVG/canvas introspection trong JS để đọc history/map board.
- Nếu không đọc được trực tiếp, fallback qua nhiều nguồn tín hiệu (overlay state, network feed, table_update).
