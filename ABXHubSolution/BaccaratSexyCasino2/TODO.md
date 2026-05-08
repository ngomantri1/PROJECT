# TODO

## Current Work
- Ổn định hoàn toàn pending settle cho ván đầu tiên sau shuffle / shoe reset.
- Xác nhận mọi reset path network đều mark pending cũ sang trạng thái chờ final winner đầu.

## High Priority
- Rà soát và vá dứt điểm:
  - `roadinfo-shoe-change`
  - `roadinfo-same-shoe-reset`
  - `winner-shoe-change`
  để pending row không bị `context-mismatch`.
- Chuẩn hóa fallback settle sau reset:
  - dùng target `table/shoe/round` của reset thật,
  - không chỉ dựa vào `settleRound == 1`.

## Need To Finish
- Xác nhận `AwaitingFinalWinnerAfterShoeReset` được set ở mọi đường reset thật.
- Xác nhận winner đầu sau reset:
  - append seq,
  - cập nhật ô kết quả,
  - cập nhật thắng/thua,
  - remove pending row.

## Refactor Candidates
- Tách logic reset/settle khỏi `MainWindow.xaml.cs` sang module riêng:
  - authority/context reset
  - roadInfo count state
  - pending history settle.
- Gom helper cho reset:
  - shoe change
  - same-shoe shuffle reset
  - table switch reset

## Need Retest
- Lần đầu mở app vào bàn:
  - full DOM bootstrap phải đúng, không chỉ `B`.
- Chuyển bàn qua lại:
  - không nháy giữa lobby/game table.
- Ván đầu sau shoe reset:
  - seq append đúng ngay ván 1.
  - pending settle đúng ngay ván 1.
- Ván đầu sau same-shoe shuffle reset:
  - seq append đúng.
  - pending settle đúng.
- Tie result:
  - append `T`,
  - history row ra `Hòa`.

## Secondary Tasks
- Rà lại `pending network history cache` vì có thể ảnh hưởng bootstrap/rebase.
- Rà log throttle cho `pending-not-settled` để vẫn đủ diagnostic nhưng không spam.
- Chuẩn hóa docs/log marker cho các nhánh:
  - bootstrap
  - repair
  - rebuild
  - keep-await-final-winner

## Low Priority
- Tiếp tục chia nhỏ `MainWindow.xaml.cs`.
- Dọn các devtool JS probe không còn dùng thường xuyên.
