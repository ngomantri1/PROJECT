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
