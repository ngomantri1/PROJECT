# Bugs

## Current Bugs
- Active bug focus (2026-05-14): some hands still show computed decision in UI but real chip placement does not happen.
- Symptom chain seen in logs:
  - C# logs `[BET-SEND][OK]` and records `[BET][HIST][PENDING]` (optimistic),
  - JS logs `[BETQ][DONE] ok=0` or `delta=0`,
  - C# can still finalize from network winner, creating virtual win/loss not backed by real chip placement.

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

## Not Fully Fixed Yet
- JS stale-drop guard `roundId < currentRound` has been removed for testing; long-term stale policy is still undecided.
- Need to prevent pending/final from bets that were not executed (`ok=0` / `delta<=0`).
- Need runtime confirmation that settle after reset is now stable in all real cases.
- Need root-cause analysis for rare cases where more than one pending row still passes the same settle gate.
- Strategy 18 is newly added and still needs runtime soak verification against expected seg-rule outcomes.
- Need continued validation for source disagreement visibility:
  - DOM board can show ahead `B/T` while CDP/network confirms a different winner.
  - authoritative sequence intentionally follows CDP/network in these cases.

## Root Causes
- Optimistic send-only mode in C# records pending before JS confirms actual click execution result.
- Current finalize path still depends mainly on network winner context, not strict JS execution confirmation.
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
- `v4_js_xoc_dia_live.js`
  - authority visibility / single panel enforcement
  - DOM board bootstrap waiting states
  - `net_probe` extraction for `roadInfo`

## Symptoms To Watch
- Repeated pattern: `BET-SEND OK` then `BETQ DONE ok=0` or `delta=0`.
- `BETQ ACK` appears but bet amount on table side does not increase.
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
