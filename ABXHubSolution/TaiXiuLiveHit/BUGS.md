# BUGS

Chỉ ghi vấn đề/rủi ro còn mở và có bằng chứng trong source hoặc kiểm tra hiện tại. Không dùng file này làm lịch sử fix.

## Đang mở

- `Tasks/TaskUtil.cs:PlaceBet`: kết quả JavaScript được log nhưng biến `ok` bị đặt `true` cố định; tầng C# chưa phản ánh thất bại thực tế.
- `Tasks/TaskUtil.cs:WaitRoundFinishAndJudge`: chỉ kết thúc khi `session` đổi; nếu session rỗng/không đổi có thể chờ vô hạn. Khi session đổi, `curSeq[^1]` chưa được guard chuỗi rỗng.
- `MainWindow.xaml.cs:ValidateSeqCL/ValidateSeqNI`: validator cho phép tối đa 100 ký tự nhưng thông báo/UI nêu giới hạn 2–50.
- `MainWindow.xaml.cs:StartLeaseHeartbeat`: toàn bộ heartbeat hiện nằm sau `if (false)`; cần quyết định rõ có bật lại hay loại bỏ flow.
- Chưa có nguồn truth thống nhất để xác nhận bet thành công ở tầng C#; đây là cùng nhóm rủi ro với `PlaceBet`.
- `MainWindow.xaml.cs` còn gộp nhiều trách nhiệm và tồn tại bridge logic song song; đây là rủi ro bảo trì, chưa phải bug runtime đã tái hiện.

## Bằng chứng đã xác nhận là đã sửa

Các thay đổi sau có mặt trong source hiện tại, nhưng chưa được đánh dấu là regression-tested trong repository:

- finalize pending theo `_pendingBaseSeq` khi `seq` đổi;
- đổi chuỗi tiền live qua `GameContext`/provider;
- `MultiChainAdvanced`, mapping level phẳng và reset UI;
- ký tự `0` trong `SeqParityFollowTask` và `SeqMajorMinorTask`;
- bridge readiness/reinject và ghi config/stats atomic.

## Vùng cần thận trọng

`MainWindow.xaml.cs`, `Tasks/TaskUtil.cs`, `v4_js_xoc_dia_live.js` và các đường ghi config/stats là vùng có tác động chéo lớn.
