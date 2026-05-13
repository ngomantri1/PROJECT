# BUGS

## Bug hiện tại
- Build `Debug` thất bại nếu app đang chạy:
- Lỗi `MSB3027/MSB3021` do `bin\Debug\...\XocDiaSoiVIP389.exe` bị lock bởi process đang mở.
- Cảnh báo xung đột `ABX.Core` khi build:
- Có đồng thời `Reference Include="ABX.Core"` (Debug) và `ProjectReference` -> warning resolve conflict.
- `AutoFillLoginAsync` đang bị disable logic thực thi:
- Hàm log `"[AutoFill] skipped (sync disabled)"` rồi `return` sớm, nên autofill không chạy.
- Thiếu file Home JS rõ ràng trong repo:
- `LoadHomeJsAsync()` có loader `js_home_v2.js` nhưng không thấy file tương ứng trong source tree.

## Bug đã fix (thể hiện trong code hiện tại)
- Chống duplicate lịch sử bet:
- Dùng key `tab|round|side|amount` + nguồn `csharp-enqueue` trước khi add pending.
- Chống nhảy ngược countdown:
- Có cơ chế `_pendingRiseSec/_pendingRiseHits` để lọc spike ảo `0s -> 35s -> 0s`.
- Chống double-start/double-stop:
- Guard `_playStartInProgress` và `_stopInProgress` tránh re-entry khi click liên tục.
- Chống inject JS trùng:
- Guard `_lastDocKey`, `_injectDocBusy`, hook idempotent trên frame/doc.
- Chặn bet stale trong JS queue:
- `__cw_bet_enqueue` drop lệnh nếu `roundId` cũ hơn round hiện tại.

## Bug chưa fix / còn tồn tại
- Nhiều warning nullable và null-deref tiềm ẩn (`CS8602/CS8618`) trên `MainWindow`, `Tasks`, `Models`, `GameContext`.
- Nhiều `catch {}` nuốt lỗi làm khó điều tra sự cố production.
- Một số warning `unreachable code`/`async without await` còn tồn đọng.
- Chuỗi tiếng Việt trong một số task/parser có dấu hiệu lỗi encoding (mojibake trong output tool).

## Nguyên nhân bug
- Coupling cao trong `MainWindow.xaml.cs` (web runtime + UI + license + strategy + history trong 1 file lớn).
- Runtime WebView2/frame/game page biến động mạnh, nhiều fallback nên logic phân nhánh dày.
- Kế thừa code theo nhiều đợt vá nhanh (guard/fallback nhiều, thiếu dọn kỹ sau vá).
- Build pipeline vừa plugin-mode vừa standalone-mode làm tham chiếu dễ xung đột.

## Workaround tạm thời
- Trước khi build: tắt process `XocDiaSoiVIP389.exe` đang chạy.
- Nếu autofill không hoạt động: đăng nhập thủ công (do autofill đang disable).
- Nếu Home flow không ổn định: điều hướng trực tiếp URL game và gọi lại inject/push (`__cw_startPush`).
- Khi debug mạng: bật `TXLS_CDP_TAP=1` để xem ws events qua CDP.

## Vùng code dễ lỗi
- `MainWindow.xaml.cs`: `EnsureWebReadyAsync`, `WebMessageReceived`, `InjectOnNewDocAsync`, `PlayXocDia_Click`, `FinalizeLastBet`.
- `v4_js_xoc_dia_live.js`: bet queue, click simulation trên canvas, detector scene/frame.
- `Tasks/TaskUtil.cs`: `PlaceBet`, wait window logic, apply money.
- `Tasks/*MajorMinor*` và `Tasks/*NGram*`: phụ thuộc mạnh vào chất lượng snapshot/timing.
- `XocDiaSoiVIP389.csproj`: cấu hình Debug plugin + Release standalone + ABX.Core reference.
