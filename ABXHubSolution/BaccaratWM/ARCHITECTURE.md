# ARCHITECTURE

## Cấu trúc project
- `MainWindow.xaml` + `MainWindow.xaml.cs`: UI và orchestrator trung tâm.
- `js_home_v2.js`: bridge web, hook network runtime, hỗ trợ bet/overlay.
- `Tasks/`: chiến lược cược (`IBetTask`, `TaskUtil`, từng task cụ thể).
- `WebView2LiveBridge.cs`: cầu nối message WebView2.
- `MainWindow.Startup.cs`, `MainWindow.EmbedMode.cs`, `BaccaratWMPlugin.cs`: bootstrap và plugin mode.
- `Models.cs`, `MoneyManager.cs`, `MoneyHelper.cs`: model và vốn.

## Module chính
- UI Orchestrator: điều phối state tổng, timer, pending, room, popup.
- Popup Navigation Guard: kiểm soát retry/cooldown/fallback khi điều hướng game popup.
- Popup Thirdg Watchdog (mới): theo dõi `thirdg.html`, timeout thì retry đúng 1 lần.
- Network Parser: parse packet CDP/WS/HTTP thành room/game state.
- Strategy Engine: quyết định side/stake theo chuỗi kết quả.
- JS Bridge Layer: thực thi thao tác DOM/game và trả signal về host.

## Dependency giữa các module
- Orchestrator phụ thuộc JS Bridge để thao tác bàn.
- Orchestrator phụ thuộc Network Parser để lấy room realtime ổn định.
- Strategy Engine nhận `GameContext` do Orchestrator cấp và gọi ngược UI/bet callbacks.
- Popup Guard + Thirdg Watchdog nằm trong Orchestrator, phụ thuộc trạng thái popup + source URL + timer.

## File nào phụ trách gì
- `MainWindow.xaml.cs`: runtime chính, parse feed, popup route, pending/finalize, state UI.
- `js_home_v2.js`: hook websocket/xhr/fetch, xác định bàn, bet bridge `__cw_bet`, overlay JS.
- `Tasks/*`: thuật toán vào lệnh và quản lý nhịp cược.
- `BaccaratWM.csproj`: build standalone/plugin, resource/script embedding.

## Data flow
- Web page -> JS hook -> `postMessage(abx)` -> C#.
- CDP events -> parser -> cache room/protocol -> publish room list.
- Strategy đọc state + history -> tạo lệnh cược -> gọi JS bet.
- Bet result/session end -> finalize pending -> cập nhật UI/stat/log.

## Popup/game navigation flow
- `NewWindowRequested` route sang `PopupWeb`.
- Popup mở `thirdg.html` rồi hop sang `wmvn.m8810.com`.
- Nếu gặp `blockmsg.greennet` thì cancel redirect và recover theo budget/cooldown.
- Nếu `thirdg` không completed trong timeout (`8s`), watchdog tự retry URL `thirdg` đúng 1 lần.
- Watchdog dừng khi đã hop sang `wmvn` hoặc khi có `NavigationCompleted` hợp lệ.

## JS auto-open stabilization (24/05/2026)
- Guard mở game tăng lên `7000ms`.
- Auto-retry lobby giảm còn `1000ms`.
- Có cờ `busy` để tránh callback `setInterval(async...)` chồng lặp.
- Mục tiêu: giảm `double-open` và giảm race lúc popup đang transition.

## UI update flow
- Tất cả update UI đi qua `Dispatcher`.
- Callback từ task chỉ push state, không trực tiếp chạm control từ worker thread.
- Overlay update qua JS API (`window.__abxTableOverlay.*`) và đồng bộ với state C#.

## OCR/canvas flow
- Không có OCR native.
- Dữ liệu board/history đọc từ DOM/SVG/canvas introspection trong JS.
- Khi DOM yếu thì ưu tiên feed network parser để giữ ổn định room state.
