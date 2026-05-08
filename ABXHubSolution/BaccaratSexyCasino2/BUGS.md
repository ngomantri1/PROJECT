# Bugs

## Current Bugs
- No new confirmed bug is open after today s patch set, but runtime retest is still required.

## Recently Fixed
- `gamehall.jsp` can no longer bootstrap/rebase real game sequence authority.
- Initial table entry no longer gets stuck with only tiny bead `B` when valid full raw board exists.
- First hand after `gameShoe` change can append via deterministic `roadInfo` rebuild.
- First hand after same-shoe shuffle reset can append via deterministic `roadInfo` reset.
- Pending rows no longer block the bet pipe.
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
- Need runtime confirmation that settle after reset is now stable in all real cases.
- Need root-cause analysis for rare cases where more than one pending row still passes the same settle gate.

## Root Causes
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
- When settle looks suspicious, inspect logs:
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
- `seqLen` increases but history row is still waiting.
- `ctxSkip > 0` in `[BET][HIST][CHECK]`.
- `pending-not-settled | reason=context-mismatch`.
- `matched > 1` or `[BET][HIST][HOLD-AMBIGUOUS]` appears.
- `DOM-BOOTSTRAP-BLOCK` when active table is correct but full board is still rejected.
- `ROADINFO-SEED` appears but expected `ROADINFO-WINNER` does not follow.
