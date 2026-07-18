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
- Policy detail (2026-05-20):
  - after bootstrap, authoritative append is CDP/network-only.
  - DOM/JS ahead signals are diagnostic and do not append sequence directly.
  - JS append contract path is blocked in CDP-first mode (`UseDomBootstrapCdpAppendSeq`).

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

## Bet Pipeline Notes (2026-05-19)
- `TaskUtil.PlaceBet(...)` local throttle was relaxed for multi-strategy push testing:
  - removed local block by `_betInFlightByTab` (`send-in-flight`),
  - removed local block by same-round/same-side cooldown (`skip duplicate send`).
- Duplicate send context is kept as log-only signal:
  - `[BET][INFO] duplicate-send-allowed`.
- Effective behavior now:
  - if run is active and pipe ready, C# pushes intent to JS queue without local per-round choke,
  - JS queue still serializes execution order on its side.
- Important diagnostic interpretation:
  - `BET ACK` currently means JS queue job finished, not guaranteed game/server accepted money.

## Bet Execution / Chip Split Notes (2026-07-08)
- `TaskUtil.PlaceBet(...)` sends an intent amount in app chip units:
  - `30` means 30k,
  - `100` means 100k.
- `v4_js_xoc_dia_live.js` owns actual chip execution:
  - `cwBet(side, amount)` normalizes amount,
  - scans available chip denominations,
  - builds a greedy split plan from largest visible denomination to smallest,
  - focuses a chip denomination, then clicks the target betting area.
- Runtime denomination interpretation:
  - DOM mode: raw amount is already chip unit (`30` -> 30),
  - non-DOM/Cocos mode: raw amount is scaled to casino numeric value (`30` -> 30000).
- Typical split examples:
  - 30k -> `20 + 10` if no exact 30 chip exists and both chips are visible,
  - 100k -> `100` if chip 100 is visible, otherwise split by available chips.
- Confirm flow:
  - JS validates visible stake movement after chip clicks,
  - confirm button should be clicked only after the table reflects the intended side amount,
  - missing confirm button can be tolerated only when the expected stake is already visible.
- Diagnostic interpretation:
  - `[BET-SEND][OK]` means C# sent/queued the intent and may have recorded pending optimistically.
  - `[BETQ][DONE] ok=0` means JS execution failed or could not prove real placement.
  - `click cửa không ghi nhận tiền` for `denom=10` means the chip step did not reflect on the target side; this is different from not finding/scanning chip 10.

## Popup Refresh / Context Guard (2026-05-23)
- `MainWindow.xaml.cs` popup flow now keeps local refresh state:
  - `_popupRefreshArmed`
  - `_popupRefreshGraceUntilUtc`
  - `_popupRefreshEntryUrl`
- URL classifiers used by popup navigation handling:
  - `IsPopupThirdgEntryUrl(...)`
  - `IsProviderLoginTransitUrl(...)`
  - `IsPopupRefreshGraceActive()`
- Navigation behavior:
  - on `thirdg.html` entry: arm grace and log `[PopupWeb][REFRESH-NORMAL] phase=entry`,
  - during grace/transit: suppress popup auto-stop reset path and keep popup host visible,
  - on real provider error URL: log provider error + `[REFRESH-FAIL]` and reset via `popup-provider-error`.
- Operational gap still open:
  - if provider/site drops context from `webMain.jsp` to `gamehall/thirdg` and never returns to game iframe,
  - system currently keeps last accepted snapshot/tick loop but has no forced auto-recovery to re-enter the game frame.

## Popup Transit Watchdog (2026-07-08)
- `NewWindowRequested(...)` can defer popup activation when the opened target is a wrapper/gateway URL.
- `PopupWeb_NavigationCompleted(...)` may arm `ArmPopupTransitWatch(...)` while the top-level popup URL is still `thirdg.html`.
- Important WebView2 detail:
  - `CoreWebView2.Source` is only the top-level popup URL,
  - the real game can already be active in a child frame at `/player/webMain.jsp` with a nested `/player/singleBacTable.jsp`.
- Previous failure mode:
  - watchdog waited `PopupTransitWatchdogSeconds` (12s),
  - top-level source still looked non-game,
  - watchdog called `Stop()` and `Navigate(recoverUrl)`,
  - this unloaded a valid game iframe and left the popup stuck on `new.wencheng.cc/home/thirdg.html`.
- Current guard:
  - before recovery navigation, `ArmPopupTransitWatch(...)` also checks `HasRecentGameSignal(...)`,
  - recent accepted game tick/snapshot is considered success,
  - recovery is skipped and watchdog is cancelled when frame authority is already live.

## UI Validation Notes (2026-05-20)
- Pattern validator limits in `MainWindow.xaml.cs`:
  - B/P strategy pattern `<mau_qua_khu>`: `1..20`
  - I/N strategy pattern `<mau_qua_khu>`: `1..20`
- Tooltip/error text was synchronized with validator limits to avoid UI-state mismatch.
