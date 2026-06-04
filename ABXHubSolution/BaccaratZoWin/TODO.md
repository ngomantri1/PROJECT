# TODO

> Danh sách cô đọng theo trạng thái code hiện tại.

## Task đang làm

- Ổn định same-page game detection trên `zowin` và shell host mới
- Giữ `TextMap/MoneyMap/BetMap` bám đúng game frame thật
- Giữ settle authoritative giữa JS tick và network/CDP

## Task chưa hoàn thành

- Đổi tên helper/log legacy còn sót:
  - `TryRouteRecentPlayerFlowGameToPopupAsync`
  - `TryRouteHostIframeToPopupAsync`
  - các tên còn mang dấu vết `player-flow`
- Chuẩn hóa một nguồn nhận diện game context giữa C# và JS
- Tách `MainWindow.xaml.cs` thành service nhỏ hơn
- Làm rõ vai trò `WebView2LiveBridge.cs`

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

## Task ưu tiên cao

- Rà lại `isLikelyGameContext()` trong JS để bỏ hẳn heuristics URL cũ nếu không còn cần
- Rà lại strategy index/tooltip mismatch
- Rà lại pending settle khi đổi table/shoe/round
- Giữ popup fallback chỉ cho host legacy, không để lấn flow same-page

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

## Gợi ý thứ tự

1. Test ổn định same-page flow trên host thực
2. Dọn helper/log legacy còn sót
3. Chuẩn hóa rule game detection C# + JS
4. Tách `PendingBetService`
5. Tách `BridgeService`
