# PROJECT_CONTEXT

## Cập nhật hôm nay (2026-05-27)
- Đã fix lỗi: có kết quả rồi nhưng bản ghi lịch sử cược `pending` không cập nhật `Result` và `WinLose`.
- Nguyên nhân chính: finalize pending đang phụ thuộc lock `NI` (`_lockMajorMinorUpdates`) + mốc `prog==0`, nên có trường hợp `seq` đã đổi nhưng không vào nhánh finalize.
- Đã thêm state nội bộ `_pendingBaseSeq` để bám `seq` tại thời điểm tạo lô pending.
- Đã bổ sung nhánh finalize trực tiếp theo điều kiện `seq` đổi so với `_pendingBaseSeq` (không phụ thuộc lock `NI`).
- Sau finalize: reset `_pendingBaseSeq` cùng `_pendingRows.Clear()` để tránh dính state sang ván sau.
- Phạm vi sửa: chỉ `MainWindow.xaml.cs` (logic giao diện và đồng bộ state nội bộ), không can thiệp hệ thống bên ngoài.

## Cập nhật hôm nay (2026-05-13)
- Đã thêm `Task 18) Bám cầu trước nâng cao` (`SmartPrevAdvancedTask`).
- Tổng số chiến lược hiện tại: `18` (index `0..17`).
- Task 18 giữ nguyên pipeline của Task 5, chỉ đổi rule quyết định theo `seg1/seg3`:
- `seg1=1` và `seg3=1` -> đánh đảo.
- `seg1=1` và `seg3>=2` -> đánh theo.
- `seg1>=2` -> luôn đánh theo.

## Tổng quan project
- `TaiXiuLiveHit` là app WPF (.NET 8) auto-bet Tài/Xỉu Live qua WebView2.
- Chạy được 2 mode:
- Standalone (Release `WinExe`).
- Plugin cho `AutoBetHub`/`ABX.Core` (Debug).
- Core nghiệp vụ nằm ở `MainWindow.xaml.cs`, `Tasks/*.cs`, `v4_js_xoc_dia_live.js`.

## Công nghệ sử dụng
- `net8.0-windows`, WPF.
- `Microsoft.Web.WebView2`.
- `System.Text.Json` cho config/stats/state.
- `Task`, `CancellationToken`, `Dispatcher` cho runtime realtime.
- JS bridge qua `chrome.webview.postMessage`.

## Flow hoạt động chính
1. `Window_Loaded`: load config/stats/tab, init WebView2, register/inject bridge.
2. Navigate URL, autofill login.
3. JS `__cw_startPush(240)` gửi `tick` liên tục (`progress/seq/totals/session/username`).
4. `WebMessageReceived` cập nhật snapshot/UI/trạng thái ván.
5. Play:
- Validate input theo chiến lược.
- Chờ `WaitForBridgeAndGameDataAsync`.
- Build `GameContext`.
- Chạy `IBetTask.RunAsync(...)` theo index `0..17`.
6. Task gọi `TaskUtil.PlaceBet` -> JS queue `__cw_bet` -> `bet/bet_error/bet_perf`.
7. Khi ván chốt: finalize pending rows, cập nhật win/loss/stats/money.

## Coding rules
- UI update chỉ qua `Dispatcher`.
- Save config/stats có gate (`SemaphoreSlim`) + ghi file atomic (`.tmp` -> `File.Move`).
- Hook WebView2 có guard 1 lần (`_webHooked`, `_webMsgHooked`, `_frameHooked`, `_domHooked`).
- Loop dài bắt buộc check `CancellationToken`.
- Log qua queue, không block UI.

## Naming rules
- Strategy class: `*Task` + `IBetTask`.
- Side nội bộ: `TAI`/`XIU`; parity: `T`/`X`; major/minor: `N`/`I`.
- Bridge message dùng `abx`: `tick`, `bet`, `bet_error`, `bet_perf`, `cw_diag`, `js_loaded`.

## Rule quan trọng
- Phải `EnsureWebReadyAsync` trước inject/call JS.
- Chỉ start task khi bridge/game data đã sẵn sàng.
- Không update UI trực tiếp từ background thread.
- Không bỏ qua finalize `_pendingRows` khi round kết thúc.
- Không phá sync global fields giữa tabs (`SyncGlobalFieldsFromActive`).

## WebSocket/bridge flow
- Nguồn dữ liệu nghiệp vụ chính là bridge `postMessage`.
- CDP `Network.webSocket*` chỉ để quan sát packet (recv/send log đang tắt).
- Bridge có cơ chế reinject + probe readiness cho top doc và frame.

## Pending flow
- `abx='bet'` -> tạo `BetRow` placeholder và thêm `_pendingRows`.
- Khi round chốt (`seq` đổi):
- Luồng thường: finalize bằng `FinalizeLastBet(...)` theo `_pendingBaseSeq`.
- Luồng multi-side: finalize bằng `FinalizePendingBetsWithWinners(...)`.
- Sau finalize phải `Clear` pending để tránh dính ván sau.

## Threading/UI rules
- Task chạy nền (`Task.Run`) nhưng callback UI trong `GameContext` đều marshal về `Dispatcher`.
- Timer nền (`System.Threading.Timer`) khi vào UI phải `Dispatcher.Invoke/BeginInvoke`.
- Shared state có lock/gate (`_snapLock`, `_cfgWriteGate`, `_statsWriteGate`).

## Tuyệt đối không được phá
- Contract JS: `window.__cw_bet`, `window.__cw_startPush`, schema `abx=*`.
- Flow start an toàn: ensure web -> inject bridge -> wait data -> run task.
- Mapping strategy index `0..17`.
- Logic money strategy (`MoneyManager`/`MoneyHelper`) và state MultiChain trong `GameContext`.
- Cơ chế license/trial/lease và release lease khi stop/close.
- Atomic save config/stats.