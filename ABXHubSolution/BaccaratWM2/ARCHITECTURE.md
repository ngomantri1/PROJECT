# ARCHITECTURE

## Cấu trúc project
- `MainWindow.xaml` + `MainWindow.xaml.cs`: UI và orchestrator trung tâm.
- `js_home_v2.js`: bridge web, hook network runtime, hỗ trợ bet/overlay.
- `Tasks/`: chiến lược cược (`IBetTask`, `TaskUtil`, từng task cụ thể).
- `WebView2LiveBridge.cs`: cầu nối message WebView2.
- `MainWindow.Startup.cs`, `MainWindow.EmbedMode.cs`, `BaccaratWM2Plugin.cs`: bootstrap và plugin mode.
- `Models.cs`, `MoneyManager.cs`, `MoneyHelper.cs`: model và vốn.

## Module chính
- UI Orchestrator: điều phối state tổng, timer, pending, room, popup.
- Popup Navigation Guard: kiểm soát retry/cooldown/fallback khi điều hướng game popup.
- WM Transit Diagnostics: theo dõi wrapper `Lobby/Navigation`, `LoginToSupplier`, response/body transit và state iframe.
- WM Passive Transit Hold: giữ popup transit sống lâu trên VPS yếu, không kick sai vào `LoginToSupplier`.
- Network Parser: parse packet CDP/WS/HTTP thành room/game state.
- Strategy Engine: quyết định side/stake theo chuỗi kết quả.
- JS Bridge Layer: thực thi thao tác DOM/game và trả signal về host.

## Dependency giữa các module
- Orchestrator phụ thuộc JS Bridge để thao tác bàn.
- Orchestrator phụ thuộc Network Parser để lấy room realtime ổn định.
- Strategy Engine nhận `GameContext` do Orchestrator cấp và gọi ngược UI/bet callbacks.
- Popup Guard + WM Transit Hold nằm trong Orchestrator, phụ thuộc trạng thái popup + source URL + timer + frame probe.

## File nào phụ trách gì
- `MainWindow.xaml.cs`: runtime chính, parse feed, popup route, pending/finalize, state UI.
- `js_home_v2.js`: hook websocket/xhr/fetch, xác định bàn, bet bridge `__cw_bet`, overlay JS.
- `Tasks/*`: thuật toán vào lệnh và quản lý nhịp cược.
- `BaccaratWM2.csproj`: build standalone/plugin, resource/script embedding.

## Data flow
- Web page -> JS hook -> `postMessage(abx)` -> C#.
- CDP events -> parser -> cache room/protocol -> publish room list.
- Strategy đọc state + history -> tạo lệnh cược -> gọi JS bet.
- Bet result/session end -> finalize pending -> cập nhật UI/stat/log.

## Popup/game navigation flow
- `NewWindowRequested` route sang `PopupWeb`.
- Với site đóng gói WM kiểu `shbett7.vip`, popup đầu tiên đi vào wrapper:
- `Lobby/Navigation?url=%2FAccount%2FLoginToSupplier%3FSupplierType%3DWM`
- Wrapper top-level giữ shell UI; chặng transit thật nằm ở `LoginToSupplier` hoặc iframe con.
- Nếu transit thành công, popup tự hop sang domain WM thật như `wmvn.m8810.com`, sau đó mới mở `Gateway.php`, websocket và room feed.
- Trên VPS yếu, transit này có thể mất nhiều phút.
- Patch `v9` hiện tại:
- Không còn kick/submit/click trực tiếp vào `LoginToSupplier`.
- Chỉ giữ popup ở trạng thái `TRANSIT-HOLD` dài hơn.
- Chỉ recovery cho lỗi thật như `about:blank` kéo dài hoặc `NavigationCompleted` lỗi.

## WM transit instrumentation (31/05/2026)
- `WM_TRANSIT_DIAG_JS` chạy trên document popup để log:
- `readyState`, `title`, `href`, `form`, `iframe`, `window.open`, `submit`, `error`, `unhandledrejection`.
- CDP network tap log response/body của các URL transit WM qua:
- `WM_TRANSIT_HTTP`
- Frame popup có bridge state riêng để nhớ `LastNavUri`, probe game frame và phân biệt frame transit với frame game thật.

## UI update flow
- Tất cả update UI đi qua `Dispatcher`.
- Callback từ task chỉ push state, không trực tiếp chạm control từ worker thread.
- Overlay update qua JS API (`window.__abxTableOverlay.*`) và đồng bộ với state C#.

## OCR/canvas flow
- Không có OCR native.
- Dữ liệu board/history đọc từ DOM/SVG/canvas introspection trong JS.
- Khi DOM yếu thì ưu tiên feed network parser để giữ ổn định room state.
