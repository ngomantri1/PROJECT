# BUGS

## Cập nhật hôm nay (2026-07-25)
- Đã phát hiện và fix lỗi `MultiChainAdvanced`: net nội bộ reset nhưng ô `TIỀN THẮNG` UI vẫn giữ giá trị cũ.
- Đã phát hiện và fix lỗi hiển thị `MỨC TIỀN` cho nhóm đa tầng: `MultiChain`/`MultiChainAdvanced` không nên suy ra level bằng `Array.IndexOf(stake)` vì tiền có thể trùng giữa nhiều dòng; hiện dùng `UiSetChainLevel(chainIndex, levelIndex)`.
- Đã phát hiện và fix lệch ngưỡng `MultiChainAdvanced`: ngưỡng đúng hiện là tổng các phần tử của dòng tiền, không phải `mức 1 * số phần tử`.
- Đã bổ sung xử lý ký tự `0` trong chuỗi T/X và I/N để bỏ qua ván mà không cập nhật money.

## Cập nhật hôm nay (2026-06-02)
- Đã phát hiện và fix bug runtime money: sửa `TxtStakeCsv` khi đang `Dừng đặt cược` nhưng ván sau vẫn lấy stake từ chuỗi cũ.

## Cập nhật hôm nay (2026-05-27)
- Đã phát hiện và fix bug pending history không chốt `Result/WinLose` dù đã có kết quả ván.

## Cập nhật hôm nay (2026-05-13)
- Chưa phát hiện bug mới do việc thêm Task 18.
- Thay đổi hôm nay chỉ thêm chiến lược mới + mapping index/UI.

## Bug hiện tại
- `Tasks/TaskUtil.cs`: `PlaceBet(...)` đang set `ok=true` gần như luôn thành công ở tầng C#.
- `Tasks/TaskUtil.cs`: `WaitRoundFinishAndJudge(...)` phụ thuộc đổi `session`; có thể chờ lâu/vô hạn nếu session rỗng hoặc không đổi.
- `Tasks/TaskUtil.cs`: dùng `curSeq[^1]` khi session đổi nhưng chưa guard chuỗi rỗng.
- `MainWindow.xaml.cs`: validate chuỗi T/X/0 và I/N/0 đang cho tối đa `100` nhưng text rule hiển thị `2-50`.
- Lease heartbeat bị vô hiệu hóa (`if (false)`), nhưng flow start/stop heartbeat vẫn tồn tại.

## Bug đã fix (đã có trong code)
- `MainWindow.xaml.cs`: fix finalize pending theo `_pendingBaseSeq` khi `seq` đổi, không còn phụ thuộc riêng lock `NI`/`prog==0`.
- `MainWindow.xaml.cs` + `Tasks/GameContext.cs` + `Tasks/MoneyManager.cs`: fix đổi chuỗi tiền live khi task đang chạy; ván kế tiếp lấy đúng mức tương ứng của chuỗi mới.
- `MainWindow.xaml` + `Tasks/MoneyHelper.cs` + `Tasks/TaskUtil.cs`: thêm `MultiChainAdvanced` và cập nhật logic ngưỡng cộng dồn theo tổng từng dòng tiền.
- `Tasks/TaskUtil.cs` + `MainWindow.xaml.cs`: fix đồng bộ UI `TIỀN THẮNG` và `MỨC TIỀN` cho nhóm đa tầng.
- `Tasks/SeqParityFollowTask.cs` + `Tasks/SeqMajorMinorTask.cs`: thêm ký tự `0` để bỏ qua đúng 1 ván trong chuỗi cầu T/X và I/N.
- Guard start strategy bằng `WaitForBridgeAndGameDataAsync(...)`.
- Bridge reinject theo lifecycle top doc + frame.
- Save config/stats dạng atomic (`.tmp` -> `File.Move`).
- Countdown license/trial dùng mốc local time (`DateTimeOffset.Now`).
- JS bet queue có fallback + `bet_perf` metrics.

## Bug chưa fix
- Chưa có nguồn truth thống nhất cho kết quả bet ở tầng C#.
- Chưa xử lý triệt để case round mới nhưng `session` không đổi.
- Chưa chuẩn hóa xong việc tách legacy/new flow trong `MainWindow`.

## Nguyên nhân bug
- `MainWindow.xaml.cs` đang gộp quá nhiều trách nhiệm.
- Bridge logic hiện phân tán ở nhiều nơi.
- State round phụ thuộc heuristic (`session`, `seq`, `prog`) hơn là state machine tách biệt.
- Tồn tại song song branch legacy/new làm tăng độ phức tạp.
- Money runtime trước đây snapshot chuỗi tiền lúc start và `MoneyManager` giữ `_seq` cố định, nên thay đổi UI không vào được vòng task đang chạy.

## Workaround tạm thời
- Trước khi Play, kiểm tra có `tick` ổn định và log bridge ready.
- Nếu loop đứng lâu, Stop/Play lại để reset token/bridge probe.
- Theo dõi `bet_error`/`bet_perf` thay vì chỉ tin giá trị trả về `PlaceBet`.
- Giữ `DecisionSeconds` vùng an toàn (đặc biệt nhóm N/I).
- Không còn cần workaround Stop/Play lại chỉ để đổi chuỗi tiền; runtime đã hỗ trợ ăn chuỗi mới từ ván kế tiếp.

## Vùng code dễ lỗi
- `MainWindow.xaml.cs`: `WebMessageReceived`, play/stop, bridge inject/probe, timers license/trial.
- `Tasks/TaskUtil.cs`: place/judge/post-round money.
- `v4_js_xoc_dia_live.js`: click canvas, queue cược, fallback totals/session/progress.
- Config/stats I/O khi save liên tiếp nhiều tab.
