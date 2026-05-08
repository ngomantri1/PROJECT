# Project Context

## Overview
- `BaccaratSexyCasino2` là ứng dụng WPF + WebView2 để:
  - mở casino live baccarat trong WebView2,
  - inject JS vào `webMain.jsp` / `singleBacTable.jsp`,
  - đọc trạng thái bàn, countdown, chuỗi kết quả, pool cược, tài khoản/số dư,
  - chạy task auto-bet theo chiến lược.
- C# là authority cuối cùng cho UI, lịch sử cược và state runtime.
- JS chỉ là probe / collector / click executor / canvas debug layer.

## Tech Stack
- C# / .NET 8.0 / WPF.
- WebView2 (`Microsoft.Web.WebView2`).
- Injected JavaScript: `v4_js_xoc_dia_live.js`.
- Optional plugin mode cho `AutoBetHub` qua `ABX.Core`.
- Logging file tại `%LocalAppData%\\BaccaratSexyCasino2\\logs`.

## Main Runtime Flow
1. `RunStartupAsync()` load config, init WebView2, navigate, auto login.
2. `WebView2LiveBridge` inject top script + frame shim + app JS.
3. JS gửi `tick`, `frame_scout`, `net_probe`, debug batch về C#.
4. C# chọn authority frame bằng score/signals, ưu tiên `singleBacTable.jsp`.
5. C# parse snapshot, merge state, chấp nhận snapshot authority.
6. C# push accepted display snapshot ngược lại JS để Canvas Watch chỉ render dữ liệu đã accept.
7. Chuỗi kết quả:
   - bootstrap full từ DOM board,
   - sau đó append bằng CDP/network `roadInfo.winCounts`.
8. Task runtime lấy `GameContext`, chờ cửa cược, gửi lệnh bet qua JS, ghi pending, chờ settle.

## Coding Rules
- Không để JS local/fallback tự làm authority khi C# đã có authority.
- Không dùng network/text fallback làm pool authority cho Canvas.
- Không hardcode domain; dựa vào frame path / href / signals.
- Ưu tiên `singleBacTable.jsp` cho data game thật.
- `gamehall.jsp` chỉ là lobby/wrapper diagnostic, không được làm nguồn bootstrap/rebase seq authority.
- Mọi update UI WPF phải qua `Dispatcher` khi đi từ background thread.
- Không phá invariant của log tag hiện tại; log là công cụ chẩn đoán chính.

## Naming Rules
- Snapshot models dùng prefix `Cw*` (`CwSnapshot`, `CwTotals`).
- Network sequence logic dùng prefix/tag `NETSEQ`.
- Pending/history dùng tag `BET][HIST`.
- Context/authority dùng tag `AUTH`, `CTX`, `TICK`.
- Helper liên quan JS raw/bootstrap/rebase phải thể hiện rõ purpose trong tên:
  - `TryBootstrap*`
  - `TryRepair*`
  - `BuildWinners*`
  - `Observe*`

## Important Invariants
- C# accepted snapshot là nguồn hiển thị duy nhất cho Canvas.
- `singleBacTable.jsp` là nguồn DOM authority cho board/pool/status thực.
- `roadInfo.winCounts` là nguồn chính để append kết quả mới.
- Pending history phải settle từ cùng network winner source đang append seq.
- Khi context reset / shoe reset / shuffle reset:
  - không được để seq authority nhảy sang lobby,
  - không được mất pending row hợp lệ,
  - không được dùng DOM fallback sai bàn.

## WebSocket / Network Flow
- JS bắt WebSocket/XHR payload hint và gửi `abx: net_probe`.
- JS extract:
  - `tableID`
  - `gameShoe`
  - `gameRound`
  - `roadInfo.winCounts`
  - `latestRoad`
- C# xử lý:
  - `ObserveNetworkGameState(...)`
  - `BuildWinnersFromRoadInfoCountsLocked(...)`
  - `ApplyNetworkWinnerLocked(...)`
  - `ProcessNetworkWinnerPacket(...)`
- `roadInfo.winCounts` được dùng để xác định cửa tăng:
  - `countBanker`
  - `countPlayer`
  - `countTie`

## Pending Flow
- Khi gửi cược thành công:
  - `UiRecordBetIssued`
  - thêm `BetRow` vào `_pendingRows`
  - lưu `IssuedTableId`, `IssuedGameShoe`, `IssuedObservedRound`, `IssuedSeqVersion`, `IssuedSeqEvent`.
- Khi winner về:
  - `FinalizeLastBet(...)` match row pending theo table/shoe/round/version/display advance.
- Khi context reset:
  - row cũ có thể bị drop nếu stale,
  - hoặc giữ lại với cờ `AwaitingFinalWinnerAfterShoeReset` nếu đang chờ kết quả cuối.

## Threading / UI Rules
- `_roundStateLock` bảo vệ network seq state, authority seq state, round counters.
- `_snapLock` bảo vệ `_lastSnap`.
- UI labels, grids, history refresh phải qua `Dispatcher`.
- Không gọi flow UI nặng từ JS message parse path nếu không cần.

## Absolutely Must Not Break
- Không để 2 canvas authority nháy qua lại giữa `gamehall.jsp` và `singleBacTable.jsp`.
- Không để DOM lobby rebase seq của game thật.
- Không để pending history chặn bet pipe chỉ vì còn pending.
- Không để first winner sau shoe reset / shuffle reset bị seed-only mà không append.
- Không để sequence append và pending settle dùng 2 source khác nhau.
- Không phá log tags sau:
  - `[NETSEQ][ROADINFO-*]`
  - `[BET][HIST][*]`
  - `[CTX][*]`
  - `[AUTH][*]`
  - `[POOL][DISPLAY-*]`

## Current High-Risk Areas
- Pending settle sau shoe reset / same-shoe shuffle reset.
- DOM bootstrap lần đầu khi wrapper/lobby còn lẫn dữ liệu card-road.
- Late roadInfo packet đến sau observed round mới.
- Context reset giữa `webMain.jsp`, `gamehall.jsp`, `singleBacTable.jsp`.
