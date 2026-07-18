# TODO

## Done Today (2026-05-15)
- Added strategy `18) Bám cầu trước nâng cao` as `SmartPrevAdvancedTask`.
- Added strategy 18 option to UI combo list.
- Added runtime map `BetStrategyIndex == 17` -> strategy 18.
- Synced tooltip text for strategy index 17/18.

## Current Work
- Validate post-fix behavior after removing JS stale-drop gate (`roundId < curRound`).
- Enforce and monitor bet gate `prog >= 3` together with changing-shoe/bootstrap guards.
- Investigate and retest cases where UI computes normally but JS does not place all real chips.
- Retest 30k split placement after JS chip-step validation patch:
  - expected split: `20 + 10`,
  - verify both chip steps reflect on target side,
  - verify `[BETQ][DONE] ok=1` only when observed stake delta matches intended amount.
- Retest popup open into game after watchdog patch:
  - if `popup-frame` authority reaches `/player/webMain.jsp`,
  - `ArmPopupTransitWatch(...)` must log `skip recovery reason=recent-game-signal`,
  - no forced navigate to `https://new.wencheng.cc/home/thirdg.html`.
- Re-verify CDP-only sequence append behavior after latest policy lock:
  - DOM should bootstrap only,
  - post-bootstrap append should come only from CDP/network winner packets.
- Retest strategy 18 decision rule in live rounds:
  - `seg3 == 1 && seg1 == 1` -> reverse
  - `seg3 == 1 && seg1 > 1` -> follow
  - `seg3 > 1` -> follow

## High Priority
- Add fail-safe for `bet_exec_done ok=0` or `deltaSide <= 0`:
  - mark pending row as not-executed (or void),
  - prevent virtual finalize from network winner on non-executed bets.
- Add stronger correlation by `jobId` between:
  - send/queue/run/done events,
  - pending row lifecycle in C# history.
- Decide long-term C# behavior when JS reports partial split failure:
  - if intended 30k but observed 20k, pending should reflect actual placed amount or be voided,
  - do not finalize a 30k pending row as if full amount was accepted.
- Keep stale-drop path disabled during current testing window.
- Retest these reset paths:
  - `roadinfo-shoe-change`
  - `roadinfo-same-shoe-reset`
  - `winner-shoe-change`
- Retest reset settle using real target `table/shoe/round`, not only `settleRound == 1`.
- Retest `TARGET-RETARGET` when the first winner after reset arrives later than the default target round.
- Find why rare cases can still produce more than one pending row passing the same settle gate.

## Need To Finish
- Confirm no sequence of:
  - `[BETQ][DONE] ok=0`
  - followed by `[BET][HIST][FINAL]` as if bet was really executed.
- Confirm no sequence of:
  - `[BET-SEND][OK]` and `[BETQ][ACK]`
  - but `delta=0` repeatedly on the same side while history still finalizes.
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
- Confirm chip 10k scan and placement:
  - `cwScanChips()` should expose denomination key `10` in DOM mode,
  - if visible but placement fails, logs should show target-click/stake-reflect failure, not scan failure.
- Confirm popup watchdog does not reload a successful iframe game:
  - accepted authority tick exists before watchdog timeout,
  - watchdog skips recovery,
  - wrapper URL staying at `qh61.com/home/thirdg.html` is not treated as failure by itself.

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
  - bet is executed (see `BETQ DONE ok=1` and `delta > 0`),
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
- DOM vs CDP disagreement case:
  - when DOM shows `delta=B/T` but CDP confirms `P`, sequence must follow CDP.
  - ensure no DOM/JS append mutates authoritative sequence in this case.

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

## Update (2026-05-19)
- Keep C# in push-first mode for bet send:
  - no local choke by `send-in-flight`,
  - no local choke by same-round duplicate cooldown.
- Re-verify in live run that both strategy tabs place real money, not just JS ACK.
- Add a validation metric in log/UI:
  - compare intended total bet per round vs observed table-side delta after confirm.
- If mismatch persists, add optional retry policy at JS execution layer (not C# pre-block).

## Update (2026-05-20)
- Re-applied and verified UI limit patch after accidental revert:
  - `<mau_qua_khu>` max length is `20` (B/P and I/N),
  - error/tooltip text synced to `1-20`.
- Locked sequence behavior to "DOM bootstrap + CDP/network append only":
  - keep `EnableDomRecoveryAfterMissingNetworkWinner = false`,
  - block JS append contract in CDP-first mode.

## Update (2026-05-23)
- Add popup context auto-recovery when stuck state is detected:
  - repeated `src=popup-pull` + `href=thirdg.html`,
  - repeated `DOM-TABLE-SKIP reason=non-singlebac-seq-source`,
  - missing active `popup-frame/webMain.jsp` authority for a configurable timeout window.
- Add explicit recovery policy (non-cheat, normal flow):
  - re-open game from site flow (same user actions path),
  - re-arm popup and wait for `webMain.jsp` authority lock before resuming full trust.
- Add watchdog diagnostics for this failure mode:
  - time-in-stuck-state,
  - last-seen `popup-frame` timestamp,
  - last-seen provider `ws-recv` timestamp,
  - recovery attempt count and outcome.
- Add UI status hint when running with stale carried snapshot only:
  - distinguish "live game authority active" vs "carrying previous snapshot while context lost".

## Update (2026-07-08)
- Done:
  - identified why intended 30k could become only 20k real placement: split plan reached 20k, then 10k step did not reflect on target side.
  - added JS validation/retry around each DOM split chip click in `v4_js_xoc_dia_live.js`.
  - identified why app reloaded after successful game load: popup watchdog looked only at top-level URL and ignored fresh iframe authority/tick.
  - patched `MainWindow.xaml.cs` so watchdog skips recovery when `HasRecentGameSignal(...)` is true.
- Need live retest:
  - run one 30k bet and confirm real table shows full 30k before confirm/finalize,
  - run one app login/open-game flow and confirm no second forced load after frame authority starts.
