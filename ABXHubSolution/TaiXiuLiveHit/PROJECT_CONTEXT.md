# PROJECT_CONTEXT

## Cập nhật hôm nay (2026-07-25)
- Đã thêm quản lý vốn `8. Quản lý vốn đa tầng nâng cao` (`MultiChainAdvanced`).
- `MultiChainAdvanced` dùng chung `StakeChains`/`MoneyChainIndex`/`MoneyChainStep` với `MultiChain`, nhưng cách xét tầng dựa trên `MoneyChainProfit` như net xuyên suốt toàn bộ cụm chuỗi.
- Ngưỡng từng dòng của `MultiChainAdvanced` hiện là tổng các phần tử trong dòng tiền, ví dụ `5000-3000-2000-1000` có ngưỡng `11,000`.
- Mapping tầng nâng cao dựa trên ngưỡng cộng dồn: dòng 1 khi `net > -threshold[0]`; dòng n khi `-(sum threshold[0..n]) < net <= -(sum threshold[0..n-1])`.
- Nếu `net > 0` hoặc `net <= -sum(all thresholds)` thì reset về dòng 1, mức 1 và `net=0`.
- Đã sửa hiển thị `MỨC TIỀN` cho cả `MultiChain` và `MultiChainAdvanced`: dùng vị trí phẳng toàn bộ chuỗi, ví dụ `5000(1)-3000(2)-...-33000(32)` hiển thị `1/32..32/32`.
- Đã sửa luồng `MultiChainAdvanced` để khi net reset về `0` thì ô `TIỀN THẮNG` trên UI cũng reset theo state nội bộ.
- Đã thêm ký tự `0` cho chiến lược `1) Chuỗi cầu T/X` và `3) Chuỗi cầu I/N`.
- Với chuỗi cầu, `0` nghĩa là bỏ qua đúng 1 ván: không đặt cược, không cập nhật thắng/thua, không cập nhật quản lý vốn, chỉ chờ `session` đổi rồi chuyển sang ký tự tiếp theo.
- Phạm vi sửa chính: `MainWindow.xaml`, `MainWindow.xaml.cs`, `Tasks/GameContext.cs`, `Tasks/MoneyHelper.cs`, `Tasks/TaskUtil.cs`, `Tasks/SeqParityFollowTask.cs`, `Tasks/SeqMajorMinorTask.cs`, và các task dùng `MoneyHelper.IsMultiChainStrategy(...)`.

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
- Chuỗi cầu T/X và I/N cho phép ký tự `0` để bỏ qua đúng 1 ván.
- Chờ `WaitForBridgeAndGameDataAsync`.
- Build `GameContext`.
- Chạy `IBetTask.RunAsync(...)` theo index `0..17`.
6. Task gọi `TaskUtil.PlaceBet` -> JS queue `__cw_bet` -> `bet/bet_error/bet_perf`.
7. Khi ván chốt: finalize pending rows, cập nhật win/loss/stats/money.
8. Nếu đang chạy mà người dùng sửa `TxtStakeCsv`, runtime phải ăn chuỗi tiền mới từ ván kế tiếp mà không restart task.
9. Với `MultiChainAdvanced`, post-round money cập nhật net xuyên suốt, map lại dòng/mức theo ngưỡng cộng dồn, rồi đồng bộ `TIỀN THẮNG` và `MỨC TIỀN` UI.

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
- Không làm mất level/state quản lý vốn hiện tại khi chỉ đổi chuỗi tiền lúc task đang chạy.
- Không cập nhật quản lý vốn/thắng thua khi chuỗi cầu gặp ký tự `0` skip ván.

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
- Logic money strategy (`MoneyManager`/`MoneyHelper`) và state MultiChain/MultiChainAdvanced trong `GameContext`.
- Cơ chế sửa chuỗi tiền live: đổi chuỗi mới nhưng vẫn giữ level hiện tại để ván sau lấy đúng mức tương ứng của chuỗi mới.
- Cơ chế license/trial/lease và release lease khi stop/close.
- Atomic save config/stats.
