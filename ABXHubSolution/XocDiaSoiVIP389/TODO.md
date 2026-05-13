# TODO

## Task đang làm
- Ổn định luồng bridge WebView2 + JS tick trong mọi ngữ cảnh `top/frame`.
- Giữ đồng bộ trạng thái UI theo `home_tick`/`game_hint`/`tick`.
- Duy trì cơ chế pending bet và finalize theo kết quả thực tế.

## Task chưa hoàn thành
- Bổ sung/nhúng `js_home_v2.js` để hoàn thiện luồng Home push (hiện loader có nhưng file không thấy trong repo).
- Dọn warning nullable lớn trong `MainWindow`, `Models`, `GameContext`, `Tasks`.
- Chuẩn hóa encoding chuỗi tiếng Việt trong vài file task/parser để tránh mojibake.
- Tài liệu hóa rõ contract message `abx:*` giữa JS và C# ở mức schema chính thức.

## Task cần refactor
- `MainWindow.xaml.cs` quá lớn (monolith): tách theo module:
- `WebViewRuntime`, `BridgeMessageRouter`, `StrategyOrchestrator`, `LicenseLeaseService`, `HistoryService`.
- Gom hằng số strategy/mapping index vào bảng cấu hình riêng thay vì `switch` dài.
- Chuẩn hóa duplicate logic giữa cặp task `*Task` và `*TxTask`.
- Giảm `catch {}` rỗng, thay bằng log mức tối thiểu để dễ truy vết lỗi.

## Task ưu tiên cao
- Sửa nguyên nhân build fail do file exe bị lock (đang có process `XocDiaSoiVIP389` chạy).
- Xử lý cảnh báo xung đột tham chiếu `ABX.Core` (vừa `Reference` vừa `ProjectReference`).
- Rà soát code unreachable (ví dụ `AutoFillLoginAsync` đang `return` sớm, các nhánh theo constant).
- Viết smoke test manual checklist cho start/stop đa tab + pending finalize + jackpot multi-side.

## Task cần test lại
- Start/stop liên tục nhiều tab, đảm bảo không còn task zombie.
- Chuyển Home <-> Game liên tục, verify `ApplyUiMode` không nháy sai.
- Jackpot strategy: nhiều cửa cùng ván, finalize winners và PnL tổng hợp.
- MultiChain money management: chuyển chuỗi, lùi chuỗi, auto reset level.
- License/trial/lease: acquire, heartbeat, recheck, expiry, release khi đóng app/plugin.
- Build Debug khi app đang chạy và khi app đã tắt (xác nhận behavior lock file).
