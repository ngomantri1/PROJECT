# PROJECT_CONTEXT

## Cập nhật hôm nay (2026-07-10)
- Đã xử lý lại bridge/canvas cho HIT Tài Xỉu theo đúng nghiệp vụ `T/X`, không còn dùng lại field Chẵn/Lẻ `C/L`.
- Canvas Watch panel được điều khiển bằng biến JS `SHOW_CANVAS_WATCH` trong `v4_js_xoc_dia_live.js`; muốn ẩn/hiện chỉ đổi `true/false`.
- Bridge readiness phải đợi root Canvas Watch `__cw_root_allin` tồn tại. Nếu `window.cc` đã có nhưng root chưa có thì phải reinject `_appJs`; không được coi bridge ready quá sớm.
- Luồng mở game từ trang chủ đã dùng cơ chế click mở Tài Xỉu từ home, giống project ZoWin, thay vì chỉ mở popup/trang rời.
- Nguồn username/tên nhân vật duy nhất: `LobbyNew/Canvas/MainUIParent/NewLobby/Footder/footerBar/Normal/lbNameUser`.
- Nguồn tài khoản duy nhất: `LobbyNew/Canvas/MainUIParent/NewLobby/Footder/footerBar/Normal/lbMoneyYser`. Lưu ý tail game viết là `lbMoneyYser`, không sửa thành `lbMoneyUser`.
- Nguồn phiên: `LobbyNew/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbSesionId`.
- Nguồn tổng cược Tài/Xỉu dùng chung tail `LobbyNew/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbTotal`, phân biệt bằng tọa độ `x=313` cho Tài và `x=799` cho Xỉu.
- `CwTotals` chỉ còn `T`, `X`, `A`. Tài Xỉu không có `SD`, `TT`, `T3T`, `T3D`, `TD`; không thêm lại các field/cửa của Chẵn/Lẻ.
- `Scan500Text` thay cho `Scan200Text`, có scan cả text dạng tiền để tìm tail mới khi game đổi UI.

## Cập nhật hôm nay (2026-06-02)
- Đã fix lỗi: khi task nghiệp vụ đang chạy (`Bắt đầu cược` đã chuyển sang `Dừng đặt cược`), sửa `TxtStakeCsv` nhưng ván sau vẫn ăn chuỗi tiền cũ.
- Kỳ vọng nghiệp vụ mới:
- Nếu đang ở mức `n`, khi người dùng đổi chuỗi tiền trong lúc chạy thì ván kế tiếp phải lấy mức `n` của chuỗi mới.
- Ví dụ: đang từ chuỗi `1000-2000-4000`, sau đó sửa thành `10000-20000-40000`, nếu ván sau lên mức `2` thì phải đánh `20000`, không còn `2000`.
- Nguyên nhân chính: runtime đang snapshot `RunStakeSeq`/`RunStakeChains` lúc start và `MoneyManager` giữ `_seq` cố định suốt vòng đời task.
- Đã thêm cập nhật runtime live cho chuỗi tiền:
- `MainWindow.xaml.cs`: khi `TxtStakeCsv` đổi sẽ cập nhật lại `RunStakeSeq`, `RunStakeChains`, `RunStakeChainTotals` cho tab đang chạy.
- `Tasks/GameContext.cs`: cho phép `StakeSeq`, `StakeChains`, `StakeChainTotals` được cập nhật trong khi task đang chạy.
- `Tasks/MoneyManager.cs`: đổi sang đọc chuỗi tiền hiện hành theo provider mỗi ván, nhưng vẫn giữ nguyên level/state hiện tại.
- Phạm vi sửa: `MainWindow.xaml.cs`, `Tasks/GameContext.cs`, `Tasks/MoneyManager.cs`, và các task đang khởi tạo `MoneyManager`.

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
- `TaiXiuThuongHit` là app WPF (.NET 8) auto-bet Tài/Xỉu Live qua WebView2.
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
3. Từ trang chủ HIT, click mở Tài Xỉu bằng JS/home click flow; không phụ thuộc popup rời.
4. JS `__cw_startPush(240)` gửi `tick` liên tục (`progress/seq/totals/session/username`).
5. `WebMessageReceived` cập nhật snapshot/UI/trạng thái ván.
6. Play:
- Validate input theo chiến lược.
- Chờ `WaitForBridgeAndGameDataAsync`.
- Build `GameContext`.
- Chạy `IBetTask.RunAsync(...)` theo index `0..17`.
7. Task gọi `TaskUtil.PlaceBet` -> JS queue `__cw_bet` -> `bet/bet_error/bet_perf`.
8. Khi ván chốt: finalize pending rows, cập nhật win/loss/stats/money.
9. Nếu đang chạy mà người dùng sửa `TxtStakeCsv`, runtime phải ăn chuỗi tiền mới từ ván kế tiếp mà không restart task.

## Coding rules
- UI update chỉ qua `Dispatcher`.
- Save config/stats có gate (`SemaphoreSlim`) + ghi file atomic (`.tmp` -> `File.Move`).
- Hook WebView2 có guard 1 lần (`_webHooked`, `_webMsgHooked`, `_frameHooked`, `_domHooked`).
- Loop dài bắt buộc check `CancellationToken`.
- Log qua queue, không block UI.

## Naming rules
- Strategy class: `*Task` + `IBetTask`.
- Side nội bộ: `TAI`/`XIU`; parity: `T`/`X`; major/minor: `N`/`I`.
- Totals Tài/Xỉu chỉ dùng `T`/`X`/`A`; không dùng `C`/`L` và không dùng field phụ của Chẵn/Lẻ.
- Bridge message dùng `abx`: `tick`, `bet`, `bet_error`, `bet_perf`, `cw_diag`, `js_loaded`.

## Rule quan trọng
- Phải `EnsureWebReadyAsync` trước inject/call JS.
- Chỉ start task khi bridge/game data đã sẵn sàng.
- Không update UI trực tiếp từ background thread.
- Không bỏ qua finalize `_pendingRows` khi round kết thúc.
- Không phá sync global fields giữa tabs (`SyncGlobalFieldsFromActive`).
- Không làm mất level/state quản lý vốn hiện tại khi chỉ đổi chuỗi tiền lúc task đang chạy.
- Không thay các tail HIT hiện tại nếu chưa có log `Scan500Text` xác nhận tail mới.
- Không thêm lại các cửa Chẵn/Lẻ (`Sấp đôi`, `Tứ trắng`, `Tứ đỏ`, `3 trắng`, `3 đỏ`) vào Canvas Watch hoặc `CwTotals` của project Tài Xỉu HIT.

## WebSocket/bridge flow
- Nguồn dữ liệu nghiệp vụ chính là bridge `postMessage`.
- CDP `Network.webSocket*` chỉ để quan sát packet (recv/send log đang tắt).
- Bridge có cơ chế reinject + probe readiness cho top doc và frame.
- Probe bridge phải kiểm tra cả `window.cc`, các hàm bridge, và DOM root `__cw_root_allin` để tránh trạng thái hàm có nhưng Canvas Watch chưa dựng.

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
- Cơ chế sửa chuỗi tiền live: đổi chuỗi mới nhưng vẫn giữ level hiện tại để ván sau lấy đúng mức tương ứng của chuỗi mới.
- Cơ chế license/trial/lease và release lease khi stop/close.
- Atomic save config/stats.
