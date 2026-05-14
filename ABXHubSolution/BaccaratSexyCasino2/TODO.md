# TODO

## Current Work
- Fix round-basis mismatch between C# and JS bet queue after shuffle.
- Prevent `BETQ reason=stale` false drops when C# round resets to `1..n` but JS local read round is still old shoe length.
- Stop creating pending/finalized history rows for bets that JS dropped before click execution.

## High Priority
- Rework JS stale-check policy in `processBetQueue(...)`:
  - keep stale protection for truly old jobs,
  - bypass stale-drop during shuffle/bootstrap transitional events.
- Align round basis used by C# `roundId` and JS `currentRound`:
  - choose one source of truth for bet execution round.
- Add C# correlation for JS `bet_dropped`:
  - suppress/void pending row when dropped before real execution.
- Retest these reset paths:
  - `roadinfo-shoe-change`
  - `roadinfo-same-shoe-reset`
  - `winner-shoe-change`
- Retest reset settle using real target `table/shoe/round`, not only `settleRound == 1`.
- Retest `TARGET-RETARGET` when the first winner after reset arrives later than the default target round.
- Find why rare cases can still produce more than one pending row passing the same settle gate.

## Need To Finish
- Confirm no sequence of:
  - `[BET-SEND][OK]` then `[BETQ][DROP] reason=stale`
  - followed by `[BET][HIST][FINAL]` for the dropped id.
- Confirm `AwaitingFinalWinnerAfterShoeReset` is set on every real reset path.
- Confirm `SettleTargetTableId/Shoe/Round` is set correctly on every kept row.
- Confirm first winner after reset:
  - appends sequence,
  - updates result cell,
  - updates win/loss,
  - removes the correct pending row.
- Confirm `multi-match-guard` now:
  - finalizes only one row,
  - keeps the rest pending,
  - never writes `RESET-DUP/B o qua`.

## Need Retest
- First app open into table:
  - full DOM bootstrap must be correct, not only tiny `B`.
- Table switching:
  - must not flicker between lobby and game table.
- First hand after shoe reset:
  - sequence appends correctly,
  - pending settles correctly.
- First hand after same-shoe shuffle reset:
  - sequence appends correctly,
  - bet is executed (not dropped stale),
  - pending settles correctly.
- Late first winner after reset:
  - waiting row retargets to real round,
  - no `ctxMatch=False`.
- Rare multi-match case:
  - history does not show `RESET-DUP`,
  - secondary row remains pending.
- Tie result:
  - append `T`,
  - history row shows `Hoa`.

## Refactor Candidates
- Split reset/settle logic out of `MainWindow.xaml.cs`:
  - authority/context reset
  - roadInfo count state
  - pending history settle
- Group reset helpers:
  - shoe change
  - same-shoe shuffle reset
  - table switch reset

## Secondary Tasks
- Recheck `pending network history cache` because it may affect bootstrap/rebase.
- Recheck throttle for `pending-not-settled` logs.
- Standardize docs/log markers for:
  - bootstrap
  - repair
  - rebuild
  - keep-await-final-winner
  - hold-ambiguous

## Low Priority
- Continue splitting `MainWindow.xaml.cs`.
- Clean up JS devtool probes not used regularly.
