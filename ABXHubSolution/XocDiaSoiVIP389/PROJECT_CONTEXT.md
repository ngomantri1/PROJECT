# PROJECT_CONTEXT

## Tổng quan
- `XocDiaSoiVIP389` là ứng dụng WPF (.NET 8) tự động phân tích/đặt cược game Xóc Đĩa Live qua `WebView2`.
- App chạy 2 mode:
- `Debug`: plugin cho AutoBetHub (qua `ABX.Core`).
- `Release`: EXE độc lập self-contained, single-file.
- Nghiệp vụ chính nằm ở `MainWindow.xaml.cs` + `Tasks/*` + bridge JS `v4_js_xoc_dia_live.js`.

## Công nghệ sử dụng
- C# `net8.0-windows`, WPF.
- `Microsoft.Web.WebView2` để host web game.
- JS inject nội bộ (`v4_js_xoc_dia_live.js`) để đọc state game và đặt cược.
- JSON config/state (`config.json`, `stats.json`, AI state trong `%LOCALAPPDATA%`).
- Plugin contract: `ABX.Core` (`IGamePlugin`, `IGameHostContext`).

## Flow hoạt động chính
- Khởi động: load config/stats -> init WebView2 (ưu tiên fixed runtime) -> navigate URL -> inject bridge JS -> bật push tick.
- JS gửi `abx:tick` định kỳ (progress, totals, seq, status) qua `chrome.webview.postMessage`.
- C# cập nhật snapshot/UI từ tick, đồng thời quản lý pending bet và finalize lịch sử khi có kết quả ván.
- Khi bấm chạy chiến lược: validate input -> preflight bridge (`__cw_bet`) + dữ liệu game -> tạo `IBetTask` theo index chiến lược -> chạy vòng cược theo tab.
- Đặt cược đi qua JS queue (`__cw_bet_enqueue`) để tuần tự hóa click.

## Coding rules
- UI state chỉ cập nhật trên `Dispatcher`.
- Task nền luôn đi với `CancellationToken`, không block UI thread.
- Dữ liệu snapshot dùng lock `_snapLock`.
- Giao tiếp JS/C# chuẩn hóa qua message JSON (`abx` field), không parse string tự do.
- Lịch sử cược ghi pending trước, finalize sau; không insert trùng khi chấm kết quả.

## Naming rules
- Strategy classes: `*Task` (C/L) và `*TxTask` (T/X).
- Strategy ID: lowercase-kebab (ví dụ `ai-online-ngram`, `seq-parity`).
- UI control: prefix theo loại (`Txt`, `Lbl`, `Btn`, `Chk`, `Cmb`, `Row`, `Group`).
- Money strategy ID phải giữ nguyên literal:
- `IncreaseWhenLose`, `IncreaseWhenWin`, `Victor2`, `ReverseFibo`, `MultiChain`, `IncreaseEveryRound`, `WinUpLoseKeep`.
- Side chuẩn hệ thống: `CHAN`, `LE`, `TAI`, `XIU`.

## Các rule quan trọng
- Mapping `CmbBetStrategy.SelectedIndex (0..34)` <-> class task là contract cứng.
- Dữ liệu cược phải đi qua `TaskUtil.PlaceBet` (để giữ cooldown, log, pending history).
- Chuỗi kết quả số map bất biến:
- parity: `0/2/4 -> C`, `1/3 -> L`.
- tài xỉu: `0/1 -> X`, `2/3/4/5/6 -> T`.
- Phải giữ cơ chế license/trial/lease trước khi cho start cược.

## WebSocket flow
- Flow chính không đọc WS trực tiếp từ C#; C# nhận state gián tiếp qua JS tick.
- JS thực tế đọc scene/canvas, tổng hợp thành `abx:tick`, `abx:bet`, `abx:bet_error`, `abx:bet_trace`.
- C# có CDP tap WS tùy chọn (`TXLS_CDP_TAP=1`) để debug packet, mặc định không bật.

## Pending flow
- Khi enqueue bet thành công phía C#, `RecordBetIssuedUi` tạo `BetRow` pending vào `_pendingRows`.
- Khi tick cho biết ván mới chốt (đuôi `seq` đổi), hệ thống gọi `FinalizeLastBet`/`FinalizePendingBetsWithWinners`.
- Mỗi pending row được cập nhật `Result/WinLose/Account`, rồi ghi CSV.
- Có dedup key `tab|round|side|amount` để tránh nhân đôi lịch sử.

## Threading/UI rules
- Không truy cập `WebView2` trực tiếp từ thread nền; dùng `Dispatcher.InvokeAsync`.
- Log UI/File dùng queue concurrent + pump nền, không append trực tiếp mỗi event.
- Re-entrancy guard bắt buộc giữ nguyên (`_playStartInProgress`, `_stopInProgress`, `_ensuringWeb`, `_injectDocBusy`).
- Mọi stop/closing phải cleanup timers/cts/web hooks để tránh zombie task.

## Những điều tuyệt đối không được phá
- Tên hàm JS bridge: `__cw_startPush`, `__cw_bet_enqueue`, `__cw_bet`.
- Schema message `abx:*` giữa JS và C#.
- Quy trình: enqueue cược -> pending history -> finalize khi có kết quả.
- Mapping chiến lược index và money strategy ID string.
- Luồng kiểm tra license/lease/trial trước khi bắt đầu cược.
- Hook inject idempotent theo document key (`performance.timeOrigin`) để tránh double-inject.
