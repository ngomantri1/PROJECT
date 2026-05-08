# TODO

## Current Work
- Keep pending settle stable for the first hand after shuffle / shoe reset.
- Verify all network reset paths mark old pending rows into wait-for-final-winner state.
- Verify ambiguous multi-match rows no longer become `RESET-DUP/B o qua`.

## High Priority
- Retest these reset paths:
  - `roadinfo-shoe-change`
  - `roadinfo-same-shoe-reset`
  - `winner-shoe-change`
- Retest reset settle using real target `table/shoe/round`, not only `settleRound == 1`.
- Retest `TARGET-RETARGET` when the first winner after reset arrives later than the default target round.
- Find why rare cases can still produce more than one pending row passing the same settle gate.

## Need To Finish
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
