# Bugs

## Current Bugs
- Pending row đôi lúc không được cập nhật `Kết quả` và `Thắng/Thua` ở ván đầu sau shuffle/reset.
- Một số reset path vẫn có thể append seq đúng nhưng pending settle không chạy vì row cũ không được mark đúng.

## Recently Fixed
- `gamehall.jsp` không còn được quyền DOM bootstrap/rebase seq authority.
- Lúc đầu vào bàn không còn chỉ giữ bead nhỏ `B` nếu full raw board đúng active table đã có.
- Ván đầu sau `gameShoe` đổi:
  - `roadInfo` deterministic rebuild có thể append ngay.
- Ván đầu sau same-shoe shuffle reset:
  - `roadInfo` deterministic reset có thể append ngay.
- Pending không còn chặn bet pipe:
  - `_pendingRows` chỉ là history/chờ settle, không gate send.
- Canvas chỉ hiển thị 1 authority panel thay vì nháy top/frame sai nguồn.

## Not Fully Fixed Yet
- Settle pending sau reset vẫn chưa bền ở mọi ca.
- Có ca `roadInfo` append seq thành công nhưng history row cũ vẫn `Đang chờ`.
- Ca late network packet / context reset có thể làm `ctxMatch=False` nếu row không được keep đúng lúc.

## Root Causes
- Reset context xảy ra ở nhiều nhánh:
  - observed reset,
  - roadInfo shoe change,
  - same-shoe shuffle reset,
  - winner shoe change.
- Không phải nhánh nào cũng đang mark pending cũ bằng cùng một cơ chế.
- Fallback settle sau reset hiện phụ thuộc mạnh vào round/version gating.
- Wrapper nhiều frame khiến lobby/game table dễ tranh quyền context nếu guard không đủ chặt.

## Temporary Workarounds
- Luôn ưu tiên chạy bản Release mới nhất.
- Khi nghi ngờ miss settle, soi log:
  - `[CTX][SHOE-ARM]`
  - `[NETSEQ][ROADINFO-WINNER]`
  - `[BET][HIST][KEEP]`
  - `[BET][HIST][CHECK]`
  - `[BET][HIST][FINAL]`
- Nếu seq đã append nhưng history chưa update:
  - kiểm tra `ctxMatch`
  - kiểm tra `settleShoe/settleRound`
  - kiểm tra row có `reason=await-final-winner-after-shoe-reset` hay chưa.

## Fragile Code Areas
- `MainWindow.xaml.cs`
  - `BuildWinnersFromRoadInfoCountsLocked(...)`
  - `ApplyNetworkWinnerLocked(...)`
  - `ObserveNetworkGameState(...)`
  - `ObserveDomAuthorityContextLocked(...)`
  - `TryBootstrapRawBoardSeqLocked(...)`
  - `TryRepairTinyDomBootstrapLocked(...)`
  - `FinalizeLastBet(...)`
  - `InvalidatePendingRowsForContextReset(...)`
- `v4_js_xoc_dia_live.js`
  - authority visibility / single panel enforcement,
  - DOM board bootstrap waiting states,
  - `net_probe` extraction for `roadInfo`.

## Symptoms To Watch
- `seqLen` tăng nhưng history row vẫn `Đang chờ`.
- `ctxSkip > 0` trong `[BET][HIST][CHECK]`.
- `pending-not-settled | reason=context-mismatch`.
- `DOM-BOOTSTRAP-BLOCK` khi active table đúng nhưng full board vẫn bị reject.
- `ROADINFO-SEED` xuất hiện nhưng không có `ROADINFO-WINNER` ở ca đáng ra phải append.
