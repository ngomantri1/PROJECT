# TODO

> Danh sách cô đọng theo trạng thái code hiện tại.

## Task đang làm

- Ổn định same-page game detection trên `zowin` và shell host mới
- Giữ `TextMap/MoneyMap/BetMap` bám đúng game frame thật
- Giữ settle authoritative giữa JS tick và network/CDP
- Ổn định lại luồng `chuỗi kết quả` theo scan mới, không quay về nghiệp vụ road cũ
- Sửa dứt điểm việc canvas có `tên nhân vật` nhưng bảng điều khiển C# vẫn rỗng

## Task chưa hoàn thành

- Đổi tên helper/log legacy còn sót:
  - `TryRouteRecentPlayerFlowGameToPopupAsync`
  - `TryRouteHostIframeToPopupAsync`
  - các tên còn mang dấu vết `player-flow`
- Chuẩn hóa một nguồn nhận diện game context giữa C# và JS
- Chuẩn hóa một nguồn `tên nhân vật` giữa canvas và `LblUserName`
- Tách `MainWindow.xaml.cs` thành service nhỏ hơn
- Làm rõ vai trò `WebView2LiveBridge.cs`
- Xác nhận lại `TAIL_USER_NAME` / rule chọn candidate trên site mới
- Khóa lại contract `PULL_POPUP_TICK_NOW` để không trả tick rỗng khi canvas vẫn có dữ liệu

## Task cần refactor

- Tách:
  - `BridgeService`
  - `GameLaunchService`
  - `SeqSyncService`
  - `PendingBetService`
  - `LicenseService`
- Gom shared host detection rule vào một chỗ
- Giảm duplication giữa main/popup/frame inject path
- Tách Canvas Watch/debug config khỏi business flow
- Tách riêng helper chẩn đoán username/seq khỏi business snapshot nếu log đã đủ ổn định

## Task ưu tiên cao

- Rà lại `isLikelyGameContext()` trong JS để bỏ hẳn heuristics URL cũ nếu không còn cần
- Rà lại strategy index/tooltip mismatch
- Rà lại pending settle khi đổi table/shoe/round
- Giữ popup fallback chỉ cho host legacy, không để lấn flow same-page
- Kiểm tra lại `ShouldPreferFrameBridgeResult(...)` để chắc `PULL_POPUP_TICK_NOW` lấy đúng top-level best candidate
- Test lại parser panel fallback của `PULL_POPUP_TICK_NOW` với cả `TÊN NHÂN VẬT` và `TÀI KHOẢN`
- Theo dõi log `[CWUSER]` và `main-pull` để xác nhận user/balance/seq cùng một snapshot

## Task cần test lại

- `zowin` same-page launch flow
- `TextMap` sau khi trang đổi layout/frame
- `Canvas Watch`:
  - hiện panel
  - hiện đủ info
  - không chặn click web
- `F12` / `Ctrl+Shift+I` mở DevTools đúng WebView
- rebuild embedded JS và plugin copy path
- popup fallback trên host legacy
- start/stop strategy nhiều lần cùng tab
- đổi table/shoe khi có pending bet
- tên nhân vật:
  - canvas và `LblUserName` phải cùng nguồn
  - không được còn trường hợp canvas hiện `minoauto6` nhưng panel phải là `-`
- `LblAmount`:
  - thiếu dữ liệu thì phải hiện `-`
  - không được tự default `0` gây chẩn đoán sai
- chuỗi kết quả:
  - canvas có dữ liệu
  - panel/phần điều khiển nhận đúng chuỗi đó
  - không fallback lại rule road cũ

## Gợi ý thứ tự

1. Chốt lại luồng `main-pull` để tên nhân vật và chuỗi kết quả không bị rỗng khi canvas đang có
2. Test trên host thực với log `[CWUSER]`, `main-pull`, `seqScriptRev`
3. Chuẩn hóa rule game detection C# + JS
4. Dọn helper/log legacy còn sót
5. Tách `PendingBetService`
6. Tách `BridgeService`
