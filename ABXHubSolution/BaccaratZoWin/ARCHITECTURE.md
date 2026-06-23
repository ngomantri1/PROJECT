# ARCHITECTURE

> Kiến trúc thực tế sau các chỉnh sửa gần đây. Tập trung vào module và flow AI cần hiểu đúng.

## Cấu trúc project

- `App.xaml`, `App.xaml.cs`: bootstrap app
- `MainWindow.xaml`, `MainWindow.xaml.cs`: UI + orchestration chính
- `MainWindow.Startup.cs`: startup/public entry
- `MainWindow.EmbedMode.cs`: mode chạy trong Hub
- `BaccaratZoWinPlugin.cs`: adapter plugin
- `Models.cs`: snapshot/runtime/settle models
- `Tasks\*.cs`: strategy + money logic
- `Tasks\TaskUtil.cs`: place bet / wait settle / cooldown
- `WebView2LiveBridge.cs`: helper bridge legacy/tham khảo, không phải flow chính
- `Compat\PackRes.cs`: resource fallback
- `Views\PluginStubView.*`: host stub
- `v4_js_xoc_dia_live.js`: runtime JS chính trong game

## Module chính

### 1. UI shell

- `MainWindow.xaml`
- Login/nav, strategy tabs, money settings, status, history, stats, popup host

### 2. Orchestration

- `MainWindow.xaml.cs`
- Chịu trách nhiệm:
  - config/stats/log
  - WebView2 main/popup
  - bridge injection
  - CDP/network tap
  - start/stop strategy
  - seq authority
  - pending rows
  - license/trial

### 3. Web bridge

- C# inject `TOP_FORWARD`, `FRAME_SHIM`, JS app script
- JS push `tick`
- C# parse `tick`, `game_hint`, `bet`, `result`, diagnostics

### 4. Strategy engine

- `Tasks\IBetTask.cs`
- `Tasks\*.cs`
- Strategy chỉ đọc `GameContext`, không chạm thẳng UI

### 5. Money engine

- `Tasks\MoneyManager.cs`
- `Tasks\MoneyHelper.cs`

### 6. Plugin integration

- `BaccaratZoWinPlugin.cs`

## Dependency giữa các module

- `MainWindow` -> `Tasks\*` qua `GameContext`
- `MainWindow` -> `v4_js_xoc_dia_live.js` qua WebView2 injection
- `TaskUtil` -> callback/state của `MainWindow`
- `JS tick` + `CDP/network` -> authority sync trong `MainWindow`
- `Plugin` -> `MainWindow`

## File nào phụ trách gì

- `MainWindow.xaml.cs`
  - runtime entry
  - same-page launch flow
  - popup fallback
  - bridge/frame injection
  - `PULL_POPUP_TICK_NOW` để kéo snapshot khi cần
  - chọn bridge result giữa top/frame qua `ExecuteOnBetWebAsync` / `ShouldPreferFrameBridgeResult`
  - seq sync
  - pending settle
  - DevTools hotkey
- `v4_js_xoc_dia_live.js`
  - detect game context
  - scan canvas/DOM/text
  - render Canvas Watch
  - build `totals()` / `snapshot` / `username`
  - TextMap / MoneyMap / BetMap
  - queue bet JS side
- `Tasks\TaskUtil.cs`
  - safe place bet
  - anti-duplicate/in-flight guard
  - wait round finish and judge
- `Models.cs`
  - `CwSnapshot`, `CwTotals`, settle info, state DTO

## Data flow

1. Top document và frame được inject script.
2. JS xác định context game thật.
3. JS quét canvas/DOM/text rồi push `tick`.
4. C# parse `tick` và merge với authority từ network.
5. `GameContext.GetSnap()` trả snapshot authoritative cho strategy.
6. Strategy tính quyết định.
7. `TaskUtil.PlaceBet()` gọi JS bet queue.
8. Pending row được giữ cho tới khi settle đủ điều kiện.

## Luồng tên nhân vật / account hiện tại

1. JS scan text/canvas và tạo `t.N` trong `totals()`.
2. `buildSnapshotNow()` ưu tiên đẩy `snap.username` từ chính nguồn này.
3. Canvas Watch render dòng `TÊN NHÂN VẬT : ...` từ snapshot đó.
4. `__cw_last_panel_snapshot.username` cache lại giá trị đang render.
5. C# dùng `PULL_POPUP_TICK_NOW` hoặc `tick` thường để lấy JSON snapshot.
6. `HandleIncomingWebMessageAsync("tick")` -> `QueueTickUiUpdate(...)`.
7. `Dispatcher` apply vào `LblUserName`.

### Điểm yếu đang mở

- Canvas có thể đang đúng nhưng `main-pull` vẫn trả tick rỗng hoặc lấy từ sai context top/frame.
- Vì vậy `LblUserName` ở C# có thể là `-` trong khi canvas vẫn hiện `minoauto6`.
- Đây là divergence giữa `panel render` và `pull path`, không phải lúc nào cũng là lỗi scanner canvas.

## Flow vào game / launch flow

### Flow ưu tiên

- `same-page live flow`
- App click live item/card ngay trên trang host
- Chờ game signal / game-ready URL hiện đại

### Flow phụ

- popup route / frame route
- chỉ dùng khi host không đi theo same-page flow hoặc path hiện tại chưa lên game thật

### Rule hiện tại

- Nhận diện game theo modern route:
  - `activations/baccarat`
  - `selectedgame=baccarat` không phải lobby
  - shell host mới
- Không còn coi `webMain.jsp` / `singleBacTable.jsp` là flow đích chuẩn

## WebSocket packet flow

1. Enable CDP/network tap trên main/popup khi cần
2. Quan sát WebSocket / HTTP response
3. Parse:
  - table/shoe/round
  - winner / observed packets
4. Update `_netObserved*`, `_netSeq*`
5. Dùng làm authority bổ sung cho settle/history

## Websocket packet flow cho AI coding

- `tick` không đủ authority một mình
- network packet không đủ UI state một mình
- luôn xem đây là 2 luồng hợp nhất, không phải 1 nguồn duy nhất

## UI update flow

1. Tick mới vào host
2. Host lọc noisy/duplicate
3. Snapshot authoritative được cập nhật
4. `Dispatcher` apply UI:
  - progress/status
  - sequence
  - tên nhân vật
  - account/balance
  - history/stats
5. Strategy callback cập nhật panel chiến lược

### Ghi chú quan trọng về panel phải

- `LblUserName` nằm dưới nhãn `TÊN NHÂN VẬT`
- `LblAmount` nằm dưới nhãn `TÀI KHOẢN`
- Đã có giai đoạn `LblAmount` default `"0"` khi thiếu dữ liệu, gây hiểu nhầm là luồng account vẫn chạy tốt
- Hiện tại khi thiếu amount phải hiện `-` để phân biệt dữ liệu thật với giá trị mặc định

## WebView / frame architecture

- `Web` là main WebView
- `_popupWeb` là popup/fallback path
- Main frame, popup frame và current top doc đều có thể được inject
- Frame injection hiện vẫn khá dày vì phải xử lý host shell đổi layout liên tục

## OCR / canvas flow

- Không dùng OCR engine riêng
- Dùng JS scan `Cocos/canvas/DOM/text`
- `TextMap` hiện phụ thuộc đúng frame game
- `Canvas Watch` có panel debug:
  - auto-start
  - auto-show detail
  - overlay pass-through để không chặn click web
- Chuỗi kết quả hiện tại đã chuyển sang logic scan mới tham chiếu từ `DevTools\cw_probe_seq_roi.js`
- Không được fallback lại nghiệp vụ road cũ nếu phần scan mới đã là nguồn chuẩn

## Log/diagnostic architecture

- JS `console.*` có thể được mirror về log C# qua `js_console`
- Nhóm log `CWUSER` được dùng riêng để chẩn đoán luồng tên nhân vật:
  - host fallback có đang trả gì hay không
  - `TAIL_USER_NAME` có match trên site mới không
  - candidate nào được scanner nhìn thấy
  - canvas cuối cùng đang render giá trị nào
- C# cũng log lúc nạp embedded JS:
  - resource name
  - `seqScriptRev`
  - giúp phân biệt bản JS đang chạy thật

## Điểm kiến trúc quan trọng

- `MainWindow.xaml.cs` vẫn là monolith điều phối
- `WebView2LiveBridge.cs` không phải nguồn sự thật chính
- Same-page flow trên `zowin` là điều mới nhất cần ưu tiên
- Tên một số helper/log vẫn mang dấu vết legacy, nhưng logic đã chuyển sang modern shell flow
- `main-pull` không được phép làm mất dữ liệu mà canvas cùng thời điểm đang có
