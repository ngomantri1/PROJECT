# TODO

## Task đang làm (suy luận từ code hiện tại)
- Ổn định lấy danh sách bàn từ nhiều nguồn (`protocol35/protocol21/table_update`) và giảm miss room feed.
- Đồng bộ overlay room state với pending/finalize để tránh lệch trạng thái play/stop.
- Củng cố bridge bet `__cw_bet` cho nhiều layout bàn/iframe WM.

## Task chưa hoàn thành
- Nối cấu hình `DecisionSeconds` vào runtime decision window thực tế (`_decisionPercent` chưa thấy cập nhật theo UI/config).
- Chuẩn hóa hoàn toàn parser protocol mới khi payload WM đổi schema.
- Tách bớt nghiệp vụ khỏi `MainWindow.xaml.cs` (file quá lớn, khó bảo trì).
- Chuẩn hóa tài liệu vận hành build plugin/standalone trong repo (chưa có docs chính thức).

## Task cần refactor
- Chia `MainWindow.xaml.cs` theo domain.
- `RoomFeedService`.
- `BetDispatchService`.
- `PendingFinalizeService`.
- `OverlaySyncService`.
- Gom các regex/parser helper đang rải rác thành module riêng có test.
- Tách interface cho JS bridge để mock test chiến lược dễ hơn.

## Task ưu tiên cao
- Fix mismatch validation `ValidateSeqNI` (logic 2..100 nhưng message báo 2..50).
- Rà soát asset key trong `App.xaml` (`Assets/kq/BANKER.png`, `PLAYER.png`) so với file thực tế.
- Đảm bảo không có nhánh phụ thuộc `_appJs` legacy gây hiểu nhầm khi inject script.
- Bổ sung guard cho thao tác finalize khi session nhảy nhanh (race giữa nguồn popup/network/home).

## Task cần test lại
- E2E đặt cược thật/ảo qua `__cw_bet` trên nhiều bàn WM.
- Pending queue theo từng table khi chạy nhiều task đồng thời.
- Dedupe finalize: 1 table-session chỉ chốt 1 lần.
- Refresh room list khi chỉ có protocol21 wrapped và khi protocol35 xuất hiện trễ.
- Plugin debug copy sang `AutoBetHub/Plugins` và tương thích `ABX.Core` theo cả 2 nhánh (Hub DLL/fallback ProjectReference).
- Release single-file kèm fallback WebView2 fixed runtime.
