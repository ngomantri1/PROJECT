# Project Context

## Overview
- `BaccaratSexyCasino2` is a WPF + WebView2 app that:
  - opens live baccarat in WebView,
  - injects JS into `webMain.jsp` / `singleBacTable.jsp`,
  - reads table status, countdown, winner sequence, betting pool, account/balance,
  - runs auto-bet tasks.
- C# is the final authority for UI, bet history, and runtime state.
- JS is only probe / collector / click executor / canvas debug layer.

## Tech Stack
- C# / .NET 8.0 / WPF.
- WebView2 (`Microsoft.Web.WebView2`).
- Injected JavaScript: `v4_js_xoc_dia_live.js`.
- Optional plugin mode via `ABX.Core`.
- Logs in `%LocalAppData%\BaccaratSexyCasino2\logs`.

## Main Runtime Flow
1. `RunStartupAsync()` loads config, initializes WebView2, navigates, auto-logins.
2. `WebView2LiveBridge` injects top script + frame shim + app JS.
3. JS sends `tick`, `frame_scout`, `net_probe`, debug batch to C#.
4. C# selects the authority frame, preferring `singleBacTable.jsp`.
5. C# parses snapshots, merges state, and accepts authority snapshot.
6. C# pushes accepted display snapshot back to JS so Canvas Watch renders only accepted data.
7. Winner sequence:
   - bootstrap from DOM board,
   - then append from CDP/network `roadInfo.winCounts`.
8. Task runtime gets `GameContext`, waits for bet window, sends bet via JS, records pending, waits for settle.

## Latest Updates (2026-05-15)
- Added strategy `18) Bám cầu trước nâng cao`.
- New task class: `Tasks/SmartPrevAdvancedTask.cs`.
- UI strategy list now has 18 items; runtime map now routes `BetStrategyIndex == 17` to strategy 18.
- Strategy 18 reuses the same runtime flow as strategy 5 and only changes decision logic:
  - if `seg3 == 1`: `seg1 == 1` -> reverse last result, `seg1 > 1` -> follow last result,
  - if `seg3 > 1`: always follow last result.
- Tooltip mapping for strategy index 17/18 was synchronized in `MainWindow.xaml.cs`.

## Latest Updates (2026-05-19)
- Verified by log that both strategy tabs can enqueue in the same round (same timestamp/round can contain two `BET-JS` + two `BET ACK`).
- Still observed runtime mismatch on some hands:
  - logs show both queue jobs done,
  - real table can reflect only one accepted bet amount.
- Updated `Tasks/TaskUtil.cs` `PlaceBet(...)` to remove local C# send choke:
  - removed hard block `send-in-flight`,
  - removed hard block `skip duplicate send` (same round + same side).
- Local duplicate cases are now informational only:
  - `[BET][INFO] duplicate-send-allowed ...`.
- Current behavior goal for testing:
  - C# always pushes bet intent down to JS queue (fire-and-forget),
  - let JS/game acceptance decide real execution.

## Latest Updates (2026-05-23)
- Popup refresh guard for `new.wencheng.cc` was patched in `MainWindow.xaml.cs`:
  - add grace window when popup enters `thirdg.html`,
  - suppress immediate auto-stop/reset during provider transit,
  - reset only on real provider error.
- New popup refresh diagnostics are now available in logs:
  - `[PopupWeb][REFRESH-NORMAL]`
  - `[PopupWeb][REFRESH-FAIL]`
  - reset reason `popup-provider-error`.
- Live verification with `%LocalAppData%\\BaccaratSexyCasino2\\logs\\20260523.log` shows:
  - patch markers appear and old `popup-nav-start` auto-stop was not triggered in the observed run,
  - there is a real runtime case where game context drops from `popup-frame/webMain.jsp` back to `popup-pull/thirdg.html`,
  - after the drop, tool keeps running tick/canvas with last accepted snapshot but no longer has active game frame authority.
- Current interpretation:
  - this failure mode is mostly provider/site context drop/redirect (session/game frame left),
  - tool-side gap is missing auto-recovery when stuck on `thirdg.html` without recovering game frame.

## Latest Updates (2026-05-20)
- UI/state validation for pattern strategies was re-synced:
  - `<mau_qua_khu>` max length updated from `10` to `20` for both B/P and I/N pattern validators.
  - related tooltip/error text now matches runtime validation (`1-20`).
- Sequence authority policy was tightened to CDP-first after bootstrap:
  - DOM is used to bootstrap/rebase initial board state.
  - append after bootstrap must come from CDP/network winner packets.
  - DOM append remains diagnostic when ahead (`DOM-APPEND-BLOCK`).
- Added guard in `MainWindow.xaml.cs` to prevent JS append contract from mutating authoritative sequence in CDP-first mode.
- Live log investigation notes:
  - cases like `DOM delta=B/T` can appear,
  - if CDP/network confirms a different winner (for example `P`), authoritative sequence follows CDP/network.

## Latest Updates (2026-05-14)
- Bet gate in C# now blocks send when phase is not playable:
  - blocked status contains `Vui lòng đợi`, `xáo bài`, `changing shoe`,
  - blocked sequence event contains `shoe-reset-arm-no-board`, `waiting-board-bootstrap`, `short-board-bootstrap-wait`, `table-switch-wait-bead`.
- Bet gate now also requires `prog >= 3` before sending.
- JS queue stale-drop condition `roundId < currentRound` was removed in `processBetQueue(...)` (test mode).
- Added/kept JS-C# bet diagnostics:
  - `[BETQ][RUN]` logs `curRound` and enqueue/exec context,
  - `[BETQ][DONE]` logs `ok`, `clicks`, `before/after/delta`, `rawType/raw`,
  - C# keeps `[BETQ][DROP]` + `TryDropPendingRowForJsDrop(...)` if JS emits `bet_dropped`.
- Current focus moved to execution fidelity:
  - optimistic pending row is still created from `PlaceBet(...)`,
  - if JS returns `ok=0` or click delta is zero, UI/history can still drift from real chip placement.

## Coding Rules
- Do not let JS local/fallback become authority when C# already has authority.
- Do not use network/text fallback as pool authority for Canvas.
- Do not hardcode domain; use frame path / href / signals.
- Prefer `singleBacTable.jsp` as real table data source.
- `gamehall.jsp` is only lobby/wrapper diagnostic, never bootstrap/rebase seq authority.
- Any WPF UI update from background thread must go through `Dispatcher`.
- Do not break existing log tag invariants.

## Naming Rules
- Snapshot models use prefix `Cw*`.
- Network sequence logic uses prefix/tag `NETSEQ`.
- Pending/history uses tag `BET][HIST`.
- Context/authority uses tags `AUTH`, `CTX`, `TICK`.

## Important Invariants
- Accepted C# snapshot is the only display source for Canvas.
- `singleBacTable.jsp` is DOM authority for board/pool/status.
- `roadInfo.winCounts` is the main source to append new winners.
- Pending history must settle from the same network winner source that appends sequence.
- On context reset / shoe reset / shuffle reset:
  - sequence authority must not jump to lobby,
  - valid pending rows must not be lost,
  - DOM fallback must not use wrong table.
- Bet send and bet execution must remain on a consistent round basis, especially if stale guards are re-enabled later.

## WebSocket / Network Flow
- JS captures WebSocket/XHR hints and sends `abx: net_probe`.
- JS extracts:
  - `tableID`
  - `gameShoe`
  - `gameRound`
  - `roadInfo.winCounts`
  - `latestRoad`
- C# handles through:
  - `ObserveNetworkGameState(...)`
  - `BuildWinnersFromRoadInfoCountsLocked(...)`
  - `ApplyNetworkWinnerLocked(...)`
  - `ProcessNetworkWinnerPacket(...)`

## Pending Flow
- On successful bet:
  - `UiRecordBetIssued`
  - add `BetRow` into `_pendingRows`
  - save `IssuedTableId`, `IssuedGameShoe`, `IssuedObservedRound`, `IssuedSeqVersion`, `IssuedSeqEvent`.
- On winner:
  - `FinalizeLastBet(...)` matches pending row by table/shoe/round/version/display advance.
- On reset:
  - stale rows may be dropped,
  - rows waiting for final winner may be kept with `AwaitingFinalWinnerAfterShoeReset`,
  - kept rows now carry `SettleTargetTableId`, `SettleTargetShoe`, `SettleTargetRound`,
  - reset paths must mark pending immediately at the real reset point,
  - ambiguous extra matches must remain pending; they must not be rewritten as `RESET-DUP/B o qua`.

## Threading / UI Rules
- `_roundStateLock` protects network seq state, authority seq state, round counters.
- `_snapLock` protects `_lastSnap`.
- UI labels, grids, history refresh must use `Dispatcher`.

## Absolutely Must Not Break
- Do not let authority jump between `gamehall.jsp` and `singleBacTable.jsp`.
- Do not let lobby DOM rebase real game sequence.
- Do not let pending history block bet pipe.
- Do not let first winner after shoe reset / shuffle reset become seed-only without append.
- Do not let sequence append and pending settle use different winner sources.
- Do not break these log tags:
  - `[NETSEQ][ROADINFO-*]`
  - `[BET][HIST][*]`
  - `[CTX][*]`
  - `[AUTH][*]`
  - `[POOL][DISPLAY-*]`

## Current High-Risk Areas
- Pending settle after shoe reset / same-shoe shuffle reset.
- First winner after reset arriving later than expected target round.
- Ambiguous multi-match settle where more than one pending row passes one winner gate.
- DOM bootstrap while wrapper/lobby still mixes board data.
- Late `roadInfo` packet after new observed round.
