# ARCHITECTURE

## Cấu trúc project
```text
XocDiaSoiVIP389/
  MainWindow.xaml, MainWindow.xaml.cs
  MainWindow.Startup.cs
  MainWindow.EmbedMode.cs
  Models.cs
  WebView2LiveBridge.cs
  Tasks/*
  Assets/Seq/*.png
  v4_js_xoc_dia_live.js
  PROJECT_CONTEXT.md, ARCHITECTURE.md, TODO.md, BUGS.md
```

## Module chính
- `MainWindow`:
- Orchestrator runtime: WebView2, bridge, UI, strategy tab, license, history.
- `v4_js_xoc_dia_live.js`:
- Scanner + tick push + bet queue, hiện có nhánh `cc` và `no-cc`.
- `Tasks/*`:
- Chiến lược cược theo index.
- `Assets/Seq/*`:
- Icon hiển thị chuỗi kết quả.

## Dependency giữa các module
- `MainWindow` <-> JS bridge qua `ExecuteScriptAsync` + `WebMessageReceived`.
- `MainWindow` -> `Tasks/*` qua `GameContext`/`IBetTask`.
- `Tasks/*` -> snapshot từ `_lastSnap` (nguồn gốc JS tick).
- UI chuỗi kết quả phụ thuộc `snap.seq` + `Assets/Seq/*.png`.

## File phụ trách chính
- `MainWindow.xaml.cs`: nhận `abx:*`, cập nhật UI, điều phối strategy.
- `v4_js_xoc_dia_live.js`: đọc prog/totals/seq/status, push tick.
- `Models.cs`: `CwSnapshot`, `CwTotals`.
- `MainWindow.xaml`: template panel, `SeqIcons` ItemsControl, trạng thái/progress.

## Data flow
- JS đọc game -> tạo `snap` -> `abx:tick`.
- C# deserialize `CwSnapshot` -> lưu `_lastSnap` -> update UI -> task dùng.
- Bet history: issue pending -> finalize khi có kết quả mới từ `seq`.
- Bet command: `Tasks.TaskUtil.PlaceBet` -> `__cw_bet_enqueue(intent)` -> `processBetQueue()` -> `cwBet(side, amount)`.
- `processBetQueue()` chạy FIFO, không phụ thuộc kết quả thành công của job trước để chuyển job kế tiếp.

## Websocket packet flow
- Không dùng WS trực tiếp cho flow chính.
- Optional CDP tap chỉ để điều tra packet.
- Luồng chính luôn ưu tiên tick tổng hợp từ JS.

## Websocket packet flow (bridge message)
- JS post `abx:tick`, `abx:bet`, `abx:bet_error`, `abx:bet_trace`, `cw_page_probe`, `cw_js_error`.
- C# router theo `abx` và cập nhật phần tương ứng.

## Bet Queue Semantics
- Một queue toàn cục trong JS cho mọi strategy tab.
- Job được xử lý tuần tự theo thứ tự enqueue.
- Không còn chặn `stale round` trong queue processor; mục tiêu là không bỏ lệnh khi nhiều strategy bắn cùng lúc.

## UI update flow
- Tick -> `Dispatcher.BeginInvoke` -> cập nhật:
- Prog/time bar.
- Status text + màu (`Đang cược` xanh, `Chờ kết quả` đỏ).
- Tên nhân vật/tài khoản.
- Chuỗi kết quả `SeqIcons`.
- `home_tick` chỉ ghi đè khi dữ liệu không rỗng.

## OCR/canvas/DOM flow mới nhất
- `TextMap` no-cc: `buildTextRectsDom()` đọc text node từ DOM.
- Countdown no-cc:
- Ưu tiên tail `countdown-box/countdown-time`.
- Fallback selector count/timer/clock.
- Seq no-cc:
- `readTKSeqDomRoad()` lọc `cardroadtable-list1 span.cl_num`.
- Ghép chuỗi theo cột trái->phải, mỗi cột trên->dưới, chỉ digit `0..4`.
- Status:
- Tính cứng theo prog, không fallback label cũ.
