# PROJECT_CONTEXT

## Tổng quan
- `XocDiaSoiVIP389` là app WPF (.NET 8) phân tích và auto-bet Xóc Đĩa Live qua `WebView2`.
- Chạy 2 mode:
- `Debug`: plugin cho AutoBetHub (`ABX.Core`).
- `Release`: app standalone.
- Logic chính: `MainWindow.xaml.cs` + `Tasks/*` + JS bridge `v4_js_xoc_dia_live.js`.

## Công nghệ sử dụng
- C# `net8.0-windows`, WPF, WebView2.
- JS inject runtime (DOM/Cocos scanner + bet queue + tick push).
- JSON config/state tại `%LOCALAPPDATA%\XocDiaSoiVIP389`.
- Plugin contract `ABX.Core`.

## Flow hoạt động chính
- Startup: load config -> init WebView2 -> inject JS -> start push tick.
- JS gửi `abx:tick` gồm `prog`, `totals`, `seq`, `status`.
- C# nhận tick, cập nhật UI/snapshot, và feed dữ liệu cho strategy tasks.
- Bet chạy qua JS queue (`__cw_bet_enqueue`) để tuần tự click.

## Coding rules
- UI update chỉ chạy trên `Dispatcher`.
- Task nền phải có `CancellationToken`, không block UI thread.
- Snapshot chia sẻ phải giữ lock (`_snapLock`).
- Message JS/C# phải theo schema `abx:*` JSON.

## Naming rules
- Strategy class: `*Task` (C/L), `*TxTask` (T/X).
- UI control: `Lbl*`, `Txt*`, `Btn*`, `Cmb*`, `Chk*`.
- Side chuẩn: `CHAN`, `LE`, `TAI`, `XIU`.
- Money strategy ID giữ nguyên literal hiện có.

## Các rule quan trọng
- Mapping `CmbBetStrategy.SelectedIndex (0..34)` là contract cứng.
- Mọi đặt cược phải đi qua luồng chuẩn (`TaskUtil`/bridge) để giữ pending/finalize đúng.
- Quy đổi parity giữ nguyên: `0/2/4 -> C`, `1/3 -> L`.
- Phải qua license/trial/lease trước khi start.

## Websocket flow
- Flow chính không phụ thuộc parse WS trực tiếp ở C#.
- State chính lấy từ JS `abx:tick`.
- CDP WS tap chỉ dùng debug (`TXLS_CDP_TAP=1`).

## Web/Canvas flow mới nhất
- Hỗ trợ `no-cc` đầy đủ:
- `TextMap` có fallback DOM (`buildTextRectsDom`) khi không có Cocos scene.
- `countdown/prog` ưu tiên tail DOM `span#countdown-time` trong `countdown-box`.
- `seq` đọc từ DOM road `cardroadtable-list1 span.cl_num` và trả chuỗi số `0..4`.
- `__cw_startPush` autostart cả khi `no-cc` (không phụ thuộc cứng `cc`).

## Pending flow
- Bet issue -> tạo row pending.
- Khi ván chốt (đuôi `seq` đổi) -> finalize pending theo kết quả thực.
- Có dedup key để tránh duplicate lịch sử.

## Threading/UI rules
- Không dùng WebView2 trực tiếp từ thread nền.
- Giữ guard re-entry (`_playStartInProgress`, `_stopInProgress`, `_injectDocBusy`...).
- Stop/close phải cleanup timer/cts/hooks.
- `home_tick` không được ghi đè rỗng lên `LblUserName`/`LblAmount`.

## Status/Prog rules mới nhất
- Không fallback text cũ.
- `Prog > 0` => `Đang cược`.
- `Prog <= 0` hoặc `null` => `Chờ kết quả`.
- UI màu trạng thái:
- `Đang cược`: xanh.
- `Chờ kết quả`: đỏ.
- Có chống kẹt `1s` ở no-cc (null-hit -> ép về `0`).

## Những điều tuyệt đối không được phá
- API bridge: `__cw_startPush`, `__cw_bet_enqueue`, `__cw_bet`.
- Schema `abx:*` và tick payload (`prog`, `totals`, `seq`, `status`).
- Flow pending -> finalize.
- Mapping strategy index + contract parity/side.
