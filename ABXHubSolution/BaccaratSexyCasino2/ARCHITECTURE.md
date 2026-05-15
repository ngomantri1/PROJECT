# Architecture

## Project Structure
- `MainWindow.xaml` / `MainWindow.xaml.cs`
  - main UI, WebView host, authority selection, sequence/pool/history/task orchestration.
- `MainWindow.Startup.cs`
  - startup flow: config, WebView ready, navigate, auto login.
- `MainWindow.EmbedMode.cs`
  - embedded content for Hub.
- `WebView2LiveBridge.cs`
  - inject JS into top/frame, reinject by lifecycle.
- `Models.cs`
  - snapshot models from JS and frame scout.
- `v4_js_xoc_dia_live.js`
  - JS collector + canvas watch + DOM scan + net probe + click/bet executor.
- `Tasks/*`
  - betting strategies, money management, shared runtime utilities.
  - includes `SmartPrevTask` (strategy 5) and `SmartPrevAdvancedTask` (strategy 18).

## Main Modules
- UI module: `MainWindow.xaml`
- Bridge/injection module: `WebView2LiveBridge.cs`
- JS runtime module: `v4_js_xoc_dia_live.js`
- Network/sequence authority module: logic in `MainWindow.xaml.cs`
- Task engine: `GameContext`, `IBetTask`, `TaskUtil`, `MoneyManager`

## File Responsibilities
- `MainWindow.xaml.cs`
  - parse inbound messages,
  - choose authority frame,
  - bootstrap/append sequence,
  - finalize pending rows,
  - update WPF UI,
  - push accepted display snapshot to Canvas,
  - start/stop auto-bet tasks.
- `v4_js_xoc_dia_live.js`
  - frame context detection,
  - DOM scan for board/status/pool/account,
  - WebSocket/XHR probe,
  - Canvas Watch overlay,
  - JS-side bet enqueue/click logic.

## Strategy Notes (2026-05-15)
- Strategy 5 (`SmartPrevTask`):
  - splits parity into `seg1/seg2/seg3` from right,
  - uses `seg1 == seg3` vs `seg1 != seg3` to pick reverse/follow.
- Strategy 18 (`SmartPrevAdvancedTask`):
  - keeps the same task runtime pipeline as strategy 5,
  - only decision rule differs:
    - `seg3 == 1`: `seg1 == 1` -> reverse, `seg1 > 1` -> follow,
    - `seg3 > 1`: always follow.
- UI/runtime mapping:
  - combo index `4` => strategy 5,
  - combo index `17` => strategy 18.

## Data Flow
1. JS builds snapshot / probe packet.
2. WebView2 posts message to `MainWindow`.
3. C# parses JSON loosely.
4. C# routes:
   - `tick` -> snapshot authority/UI/pool/progress/status
   - `frame_scout` -> authority scoring
   - `net_probe` -> network sequence / diagnostics
5. Accepted state updates:
   - WPF labels/tables
   - push snapshot back to JS Canvas

## WebSocket Packet Flow
- JS intercepts WS/XHR and sends compact probe.
- Relevant packet types:
  - `GameHallInfo handler=1/2/4`
  - `GameInfo handler=1/3/4`
  - `roadInfo.winCounts`
- C# stages:
  - `ObserveNetworkGameState(...)`
  - `TryBuildRoadInfoCountsPacket...`
  - `BuildWinnersFromRoadInfoCountsLocked(...)`
  - `ProcessNetworkWinnerPacket(...)`

## Sequence Authority Flow
- Bootstrap:
  - DOM raw board from `singleBacTable.jsp`.
- Append:
  - `roadInfo.winCounts` from network/CDP.
- Repair:
  - only trusted fallback raw board from correct active single-bac table.
- Waiting state:
  - `waiting-board-bootstrap` is used instead of rendering empty sequence.

## Pending / Settle Flow
- `PlaceBet(...)` -> `_pendingRows`.
- `FinalizeLastBet(...)` uses:
  - context match,
  - sequence advance match,
  - network round/version fallback,
  - special reset fallback using `SettleTargetTableId/Shoe/Round`.
- Reset network paths that must mark pending immediately:
  - `roadinfo-shoe-change`
  - `roadinfo-same-shoe-reset`
  - `winner-shoe-change`
- Late first winner after reset:
  - may retarget pending row via `TARGET-RETARGET` to the real round seen on the first winner.
- Multi-match guard:
  - finalize only one preferred row,
  - keep other ambiguous rows pending,
  - log `HOLD-AMBIGUOUS`,
  - do not write `RESET-DUP`.
- After finalize:
  - update result/winlose/account,
  - persist CSV,
  - refresh history UI.

## Bet Pipeline Notes (2026-05-14)
- C# send path:
  - `TaskUtil.PlaceBet(...)` builds `roundId` from snapshot `seqVersion` (fallback `seq.Length`),
  - sends to JS via `window.__cw_bet_enqueue(intent)`.
- JS queue path:
  - `normalizeIntent(...)` keeps incoming `roundId`,
  - `processBetQueue(...)` computes `currentRound` from `getRoundIdSafe()`,
  - stale filter `job.roundId < currentRound` has been removed.
- C# bet gate now blocks send when:
  - status is changing-shoe (`status-blocked-changing-shoe`),
  - sequence is bootstrap-wait (`seq-not-ready-bootstrap-wait`),
  - `prog` is invalid/too low (`prog-too-low ... (<3)`).
- Pending/history behavior remains optimistic:
  - `PlaceBet(...)` can create pending row before JS click confirmation,
  - `bet_exec_done ok=0` is currently diagnostic, not a hard rollback.
- Diagnostics:
  - C#: `[BET-SEND][CTX]`, `[BET-SEND][BEGIN]`, `[BET-SEND][OK]`, `[BETQ][ENQ]`, `[BETQ][RUN]`, `[BETQ][DONE]`, `[BETQ][DROP]`
  - JS: `bet_queued`, `bet_exec_begin`, `bet_exec_done`, `bet`.
