# Bugs

## Current Bugs
- Active bug focus (2026-05-14): some hands still show computed decision in UI but real chip placement does not happen.
- Symptom chain seen in logs:
  - C# logs `[BET-SEND][OK]` and records `[BET][HIST][PENDING]` (optimistic),
  - JS logs `[BETQ][DONE] ok=0` or `delta=0`,
  - C# can still finalize from network winner, creating virtual win/loss not backed by real chip placement.
- Active bug focus (2026-07-08): intended 30k can result in only 20k real table placement.
  - JS split plan expects `20 + 10`.
  - observed log showed the `10` step did not reflect on target side.
  - root issue is execution fidelity/verification, not strategy decision.
- Active bug focus (2026-07-08): app can reload popup after game has already loaded in iframe.
  - game frame reaches `webMain.jsp` authority and accepted ticks,
  - watchdog sees top-level wrapper URL still at `thirdg.html`,
  - watchdog recovery navigates away and breaks the active game frame.

## Recently Fixed
- Strategy list/state sync now includes strategy 18 end-to-end:
  - UI combo item added,
  - runtime switch map added (`index 17`),
  - tooltip index 17/18 corrected.
- `gamehall.jsp` can no longer bootstrap/rebase real game sequence authority.
- Initial table entry no longer gets stuck with only tiny bead `B` when valid full raw board exists.
- First hand after `gameShoe` change can append via deterministic `roadInfo` rebuild.
- First hand after same-shoe shuffle reset can append via deterministic `roadInfo` reset.
- Pending rows no longer block the bet pipe.
- JS queue no longer drops by `roundId < currentRound` stale-check (temporarily disabled for test).
- Bet gate now requires `prog >= 3` and blocks on changing-shoe/bootstrap-wait statuses.
- Canvas now keeps one authority panel instead of flickering top/frame source.
- These reset paths now mark pending rows immediately at real reset time:
  - `roadinfo-shoe-change`
  - `roadinfo-same-shoe-reset`
  - `winner-shoe-change`
- Kept pending rows now carry:
  - `SettleTargetTableId`
  - `SettleTargetShoe`
  - `SettleTargetRound`
- `FinalizeLastBet(...)` now settles reset cases using the stored target instead of only `round == 1`.
- Late first winner after reset can retarget to the real round via `TARGET-RETARGET`.
- `multi-match-guard` no longer writes wrong history rows as `RESET-DUP/B o qua`; ambiguous extra rows stay pending and log `HOLD-AMBIGUOUS`.
- `v4_js_xoc_dia_live.js` now retries and validates each DOM split chip step before confirm.
- `v4_js_xoc_dia_live.js` can tolerate missing confirm button only when the expected stake is already visible.
- `MainWindow.xaml.cs` popup watchdog now skips recovery when `HasRecentGameSignal(...)` reports a fresh accepted game tick/snapshot.

## Not Fully Fixed Yet
- JS stale-drop guard `roundId < currentRound` has been removed for testing; long-term stale policy is still undecided.
- Need to prevent pending/final from bets that were not executed (`ok=0` / `delta<=0`).
- Need to prevent pending/final from partially executed split bets:
  - example: intended 30k, actual visible placement only 20k.
- Need live confirmation that chip 10k is both scanned and placeable on the target side in DOM mode.
- Need live confirmation that popup watchdog no longer reloads after iframe game authority starts.
- Need runtime confirmation that settle after reset is now stable in all real cases.
- Need root-cause analysis for rare cases where more than one pending row still passes the same settle gate.
- Strategy 18 is newly added and still needs runtime soak verification against expected seg-rule outcomes.
- Need continued validation for source disagreement visibility:
  - DOM board can show ahead `B/T` while CDP/network confirms a different winner.
  - authoritative sequence intentionally follows CDP/network in these cases.

## Root Causes
- Optimistic send-only mode in C# records pending before JS confirms actual click execution result.
- Current finalize path still depends mainly on network winner context, not strict JS execution confirmation.
- JS chip split can partially place money when a later denomination click does not reflect on the side area.
- C# currently records the intended amount before JS proves the full intended amount is visible/accepted.
- Popup watchdog previously used only top-level `CoreWebView2.Source` as readiness signal.
- Provider game can live in child frame `/player/webMain.jsp` while top-level popup remains wrapper `/home/thirdg.html`.
- Because of that mismatch, watchdog could classify a successful iframe game as stuck and call `Stop()` + `Navigate(...)`.
- Reset context can happen in multiple branches:
  - observed reset
  - roadInfo shoe change
  - same-shoe shuffle reset
  - winner shoe change
- Before today s patch, not every branch marked old pending rows with the same mechanism.
- Before today s patch, reset fallback settle depended too much on round/version gating.
- Old `multi-match-guard` treated every multi-match case as a true duplicate and wrote wrong history state.
- Multi-frame wrapper still makes lobby/game-table context competition fragile if guards loosen.

## Temporary Workarounds
- Use the latest Release build.
- Keep phase guard + `prog >= 3` enabled to avoid sending during clear non-playable phase.
- For chip split issues:
  - inspect `[BETQ][DONE] clicks/before/after/delta`,
  - inspect denomination-level JS logs such as `click cửa không ghi nhận tiền`,
  - do not trust `[BET-SEND][OK]` alone as real money acceptance.
- For popup reload issues:
  - inspect `[AUTH][LOCK-PROXY]`, `[GAMEBOOT][authority_started]`, `[TICK][ACCEPT]`,
  - if these appear before `[PopupWeb][STUCK-RECOVERY]`, the reload is tool-side watchdog behavior.
- When settle looks suspicious, inspect logs:
  - `[BETQ][ENQ]`
  - `[BETQ][RUN]`
  - `[BETQ][DONE]`
  - `[BETQ][ACK]`
  - `[BETQ][DROP]` (only if JS emits)
  - `[CTX][SHOE-ARM]`
  - `[NETSEQ][ROADINFO-WINNER]`
  - `[BET][HIST][KEEP]`
  - `[BET][HIST][TARGET-RETARGET]`
  - `[BET][HIST][CHECK]`
  - `[BET][HIST][FINAL]`
  - `[BET][HIST][HOLD-AMBIGUOUS]`
- If sequence appended but history did not update:
  - check `ctxMatch`
  - check `settleShoe/settleRound`
  - check `await-final-winner-after-shoe-reset`
  - check `targetTable/targetShoe/targetRound`

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
  - `MarkPendingRowsAwaitFinalWinnerForReset(...)`
  - `NewWindowRequested(...)`
  - `PopupWeb_NavigationStarting(...)`
  - `PopupWeb_NavigationCompleted(...)`
  - `ArmPopupTransitWatch(...)`
  - `HasRecentGameSignal(...)`
- `v4_js_xoc_dia_live.js`
  - authority visibility / single panel enforcement
  - DOM board bootstrap waiting states
  - `net_probe` extraction for `roadInfo`
  - `cwBet(...)`
  - chip denomination scan/focus helpers
  - DOM split plan execution and confirm click

## Symptoms To Watch
- Repeated pattern: `BET-SEND OK` then `BETQ DONE ok=0` or `delta=0`.
- `BETQ ACK` appears but bet amount on table side does not increase.
- Intended amount differs from visible side delta, especially 30k -> only 20k.
- Denomination log says `click cửa không ghi nhận tiền` for `denom=10`.
- Popup log sequence:
  - `[AUTH][LOCK-PROXY]` or `[GAMEBOOT][authority_started]`,
  - `[TICK][ACCEPT] reason=authority`,
  - then `[PopupWeb][STUCK-RECOVERY] action=navigate-retry`.
- After bad popup recovery:
  - repeated `popup-pull` at `https://new.wencheng.cc/home/thirdg.html`,
  - `score=0`,
  - no active `popup-frame/webMain.jsp` authority.
- `seqLen` increases but history row is still waiting.
- `ctxSkip > 0` in `[BET][HIST][CHECK]`.
- `pending-not-settled | reason=context-mismatch`.
- `matched > 1` or `[BET][HIST][HOLD-AMBIGUOUS]` appears.
- `DOM-BOOTSTRAP-BLOCK` when active table is correct but full board is still rejected.
- `ROADINFO-SEED` appears but expected `ROADINFO-WINNER` does not follow.
- `DOM-APPEND-BLOCK reason=cdp-only-policy` repeats while DOM delta differs from network winner.

## Update (2026-05-19)
- Confirmed by logs: two strategies can both enqueue and both receive JS ACK in the same round.
- Still open bug:
  - JS ACK/done is internal queue completion, not guaranteed server-side money acceptance.
  - In some rounds, intended two bets are logged, but table balance/amount reflects only one real accepted bet.
- C# local blocking was removed in `TaskUtil.PlaceBet(...)` to avoid artificial suppression.
- Remaining gap is execution fidelity between JS click completion and real game acceptance.

## Update (2026-05-20)
- Clarified by live logs (table C06 case):
  - DOM reported `delta=B` and was blocked by `cdp-only-policy`.
  - CDP/network winner packet finalized as `P`, and sequence advanced by network winner path.
- This behavior is now explicitly intended:
  - DOM append is diagnostic after bootstrap,
  - authoritative append must come from CDP/network only.
- UI/state bug from accidental revert was fixed again:
  - pattern `<mau_qua_khu>` length limit restored to `1-20`.

## Update (2026-05-23)
- New observed runtime issue in `%LocalAppData%\\BaccaratSexyCasino2\\logs\\20260523.log`:
  - popup can drop from active game context (`popup-frame` at `webMain.jsp`) to transit/lobby context (`popup-pull` at `thirdg.html`),
  - UI then shows stale carry-forward values and appears visually disconnected (gray game area / broken-content icon symptom).
- Evidence pattern in logs:
  - just before drop: normal `popup-frame` authority with `ws-recv` and accepted pool/status,
  - after drop: repetitive `DOM-TABLE-SKIP reason=non-singlebac-seq-source` + `incoming-without-pool`,
  - tick remains alive but only on `popup-pull` context (`score=0`, no game signals).
- Important negative findings for this incident:
  - no `popup-nav-start` auto-stop/reset loop at the failing moment,
  - no `popup-provider-error` marker at the failing moment.
- Working diagnosis:
  - primary trigger is provider/site context drop or redirect out of game iframe,
  - tool defect is lack of automatic re-entry/recovery when the context remains stuck on `thirdg.html`.

## Update (2026-07-08)
- Log `D:\NOTE\OneDrive\Desktop\log\20260708.log`:
  - intended bet amount 30,
  - JS attempted split placement,
  - 10k step failed to reflect on target side,
  - final JS result was `ok=0`; C# pending amount was still optimistic.
- Log `%LocalAppData%\BaccaratSexyCasino2\logs\20260708.log`:
  - app successfully reached game iframe authority,
  - watchdog fired about 12 seconds after wrapper navigation completed,
  - recovery navigation to `new.wencheng.cc/home/thirdg.html` unloaded the valid iframe.
- Fixes applied:
  - JS split validation/retry in `v4_js_xoc_dia_live.js`,
  - popup watchdog recent-game-signal skip in `MainWindow.xaml.cs`.
- Remaining risk:
  - C# history/pending still needs stricter reconciliation with actual JS execution result and actual visible table amount.
