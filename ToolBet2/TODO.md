# TODO

## Shoe-transition authority diagnosis — 2026-08-04

- [x] Add structured per-tab diagnostics when all Live authorities are rejected.
- [ ] On the next non-money reproduction after a shoe transition, collect the
  first `NO_ELIGIBLE_AUTHORITY` entry and fix only the condition it proves.

## Live stake/runtime consistency — completed 2026-08-04

- [x] Compare the full MoneyManager configuration when synchronizing a live
  tab, so a saved stake-chain edit replaces the stale in-memory manager and
  the next executor quote matches the UI/SQLite configuration.
- [x] Do not settle a multi-live `placing` intent. Park it as `deferred` until
  placement evidence is confirmed; do not change P&L or MoneyManager state.
- [ ] Verify the corrected stake hand-off in a controlled non-money browser
  session with a real chip tray and authoritative result metadata.

## Placement evidence and table-scoped pending — completed 2026-08-04

- [x] Trust partial DOM chip trays without substituting fake denominations.
- [x] Record no-zone-click failures as `cancelled` and possible-click failures
  as `uncertain`; never emit `multi_live_placed` for a failed path.
- [x] Park other-table pending while retaining exact-round protection.
- [x] Match the old ToolBet restart behavior: do not restore ambiguous journal
  rows as active blockers; preserve them as `deferred` evidence instead.
- [ ] Reconcile bet #52 only from trustworthy casino evidence; do not guess
  whether it was placed or its outcome.

## Current live-runtime follow-up

- [x] Remove the KILL_SWITCH sentinel/environment gate, its UI state and its
  source/packaged operator launchers; retain execution mode, Tool capability,
  pending/exact-round, journal and executor checks.
- [x] Stop the transient aggregate `risk tổng hợp` snapshot from cancelling a
  multi-live signal before `wait_and_place_bet()` can wait for the next betting
  window; retain independent real-guard/journal checks.
- [x] Add `disabled`/`pilot`/`production` execution policy without bypassing
  Tool/license, RiskDecision, exact-round or executor gates.
- [x] Allow simulation-only Start independently of live gates and keep
  `run_enabled` session-only.
- [x] Defer confirmed/virtual old bets, quarantine authoritative-stale
  ambiguous clicks, and create a MoneyManager recovery epoch from the last
  settled snapshot.
- [x] Expose live blockers/warnings and pending classifications in the runtime
  snapshot/workspace.
- [ ] Diagnose the pre-existing signed license-cache restore regression. It is
  the only known full-suite failure after the intended UI snapshot update.
- [ ] Run a controlled non-money browser soak to observe classification and UI
  banners with real WS/HTTP metadata. No casino browser was used for this patch.
- [ ] Diagnose the one-off scroll/focus fixture failure seen only in a combined
  focused run; isolated rerun and the preceding full run passed.

- [x] Match reference Banker whole-chip rounding and add the optional per-tab
  capital reset when recovery P&L reaches zero or above.
- [x] Port per-tab runtime state machines for `top10_pattern` and
  `parity_hotback`; retain their reference transition rules after settlement.
- [x] Replace shared reduced Ensemble/N-gram logic with independent
  reference-derived per-tab implementations for `ensemble_majority`,
  `online_ngram`, and `expert_panel`.
- [x] Add the three missing B/P reference strategies: configured sequence,
  configured pattern queue, and random side; persist their tab input through
  an additive SQLite migration.
- [x] Create shared C#/Python golden vectors that compare per-round bet side,
  stake, level, chain and P&L for all eight MoneyManagers.
- [x] Match Dual Schedule's reference-local AI tie-break, N-gram Tie safety
  behavior and Top10's 50-result update boundary.
- [x] Add C#/Python strategy vectors for eight deterministic reference tasks,
  comparing side, stake, P&L, level, next stake and schedule position.
- [x] Synchronize the session run button after an ordinary v2 runtime refresh,
  including its visible state and next start/stop command.
- [x] Persist a simulation/live checkbox change immediately to the SQLite-owned
  tab workspace so a quick refresh/re-entry cannot lose the selected mode.
- [x] Keep the process-local operator run latch enabled across internal
  execution pauses; only the explicit Stop command clears it.
- [x] Preserve that run latch in every `GameOverlay` install/reinstall snapshot
  so DOM recovery cannot redraw “Dừng chạy” as “Bắt đầu chạy”.
- [x] On explicit Start, evaluate the loaded table history and arm immediately
  for the betting window instead of requiring one additional result event.
- [x] Make the SQLite Live/Simulation mode operator-owned: runtime warnings may
  recover, wait or block the current click, but must not auto-demote a Live tab.
  Keep an armed decision across a transient failed UI-health probe.
- [x] Match the older ToolBet betting contract by removing account-balance
  reads and balance-based rejection from both single and multi-live execution.
- [x] Prevent vipbet's root SPA URL from being treated as proof that the player
  left a healthy room; preserve the WEB short-circuit for unrelated pages.
- [x] Retire the 1-1/Bet×2 runtime models as a decision/default/fallback source;
  make strategy tabs and their MoneyManagers the only simulation/live authority.
- [ ] Keep `sequence_major_minor` and `pattern_major_minor` unavailable until
  the collector provides trustworthy Banker/Player pool totals and an explicit
  N/I sequence; do not infer N/I from B/P history.
- [ ] Decide whether Online N-gram's reference AppData persistence should be
  represented by an explicit versioned ToolBet persistence contract; current
  implementation intentionally warm-starts in memory to avoid an unreviewed
  database/config change.
- [ ] Decide whether Start should reset capital runtime like the reference task
  constructor or continue ToolBet's SQLite-restored per-tab MoneyManager state.
- [ ] Extend cross-language strategy vectors to stateful Ensemble, N-gram,
  Expert Panel, Top10 and Hot-back after defining deterministic state/config
  injection for their random and persisted inputs.

## Phase 6 table-scoped deferred pending

- [x] Defer confirmed placed pending on restart/table-or-round mismatch instead
  of consuming an unrelated next result.
- [x] Require exact table/shoe/round metadata from WS/HTTP sources before an
  automatic deferred resolution; preserve manual reconciliation.
- [x] Keep current-round `placing`/`uncertain` fail-closed; after authoritative
  round closure/advance, quarantine it, start a recovery epoch and remove it
  from active pending without guessing placement/outcome.
- [ ] Run a controlled source-runtime browser session that switches tables and
  capture evidence that a deferred record is neither mis-resolved nor included
  in new-table progression.

## Phase 5 finite small-stake canary

- [x] Add an atomic local lease bound to one live tab and SQLite, with expiry,
  aggregate stake cap, maximum bet count, stop-loss and baseline.
- [x] Recheck lease, tab binding, authoritative stake envelope and journal
  immediately before every real click without blocking the asyncio loop.
- [x] Exclude Tie nurture from the first canary and preserve durable recovery
  if a multi-side placement becomes partial.
- [x] Add source/packaged arm/status/finish/close commands and regression tests.
- [x] Bet `id=27` is preserved as virtual stake-zero `deferred`; it no longer
  blocks a later round. Trusted evidence is still required to resolve outcome.
- [ ] With the operator present, backup DB, run `arm`, complete at most the
  approved bets, turn Auto off, run `finish`, then `close`.

## Phase 4 stake-zero evidence gate

- [x] Persist `execution_mode` for every bet and backfill historical stake-zero
  rows as virtual through the additive migration.
- [x] Add source/packaged start-finish audit for a stake-zero bet window.
- [x] Prove stake zero never invokes the chip-click executor in focused tests.
- [x] Remove Game/Tool usernames from runtime logs and redact historical login
  identifiers from diagnostics.
- [ ] Trusted exact evidence may still resolve bet `id=27`; this is no longer a
  prerequisite for starting a different round.
- [ ] Only after the real preflight passes, run the controlled browser ca and
  produce a PASS finish report; this operational step was not forced.

## Phase 3 trusted pending reconciliation

- [x] Add read-only inspection and explicit resolve gated by exact
  identity, evidence and fixed acknowledgement.
- [x] Create and verify a SQLite backup before reconciliation mutation.
- [x] Resolve confirmed Player/Banker or fully confirmed aggregate bets in one
  transaction with an audit event; reject ambiguous placement.
- [ ] Supply trusted shoe 24963 / round 39 evidence before reconciling bet
  `id=27`; never guess this result.
- [ ] Specify a separate historical Tie-nurture workflow if needed because the
  applicable payout was not snapshotted in old `bets` rows.

## Phase 2 durable pending journal

- [x] Persist intent before click and per-allocation multi-live placement state.
- [x] Keep pending and fail closed on partial placement or post-click DB error.
- [x] Restore durable main/Tie pending on restart and require trusted
  reconciliation before automatic execution can resume.
- [x] Run focused recovery tests and the full 168-test suite.

## Phase 1 fail-closed preflight

- [x] Resolve the authoritative SQLite path from the selected config file.
- [x] Validate the selected per-tab MoneyManager stakes/chains from SQLite,
  including MultiChain and Victor2 doubled quotes; do not use YAML stakes as a
  live pilot authority.
- [x] Require exactly one live tab, `auto_bet=false`, no unresolved bet and a
  readable live stake envelope for `stake_zero`/`small_stake` transitions.
- [x] Verify the device-bound signed `live_bet` license cache and HTTPS
  production configuration without mutating the cached refresh token.
- [x] Add focused regressions and run the full 157-test suite.
- [x] Build and verify the Phase 1 internal snapshot, including packaged
  preflight and secret/runtime-file audit.
- [x] Implement durable pending recovery and trusted reconciliation. The kill
  switch remains active because bet `id=27` still lacks evidence.

## Phase 0 live-readiness checkpoint

- [x] Create and verify an online backup of the active SQLite database without
  stopping the running ToolBet session.
- [x] Build an internal preservation snapshot and verify that it excludes
  runtime credentials, config, database, Chrome profile and license cache.
- [x] Historical Phase 0 used `data/KILL_SWITCH`; the mechanism and operator
  launchers were removed from current source on 2026-08-03.
- [ ] Reconcile bet `id=27` only from a trusted round-39 result or through an
  explicit domain recovery workflow. Current evidence stops at shoe 24963,
  round 38, so the unresolved stake-0 record and open group 7 were preserved.
- [x] Stage repository hygiene: add the project `.gitignore` and remove
  previously committed `config.yaml`, `credentials.yaml` and
  `data/cdp_profile/` content from the Git index with `git rm --cached`. Local
  runtime files remain present. A later commit must preserve these staged
  removals.

## Required before an operational live pilot

1. Run controlled browser sessions with `auto_bet=false`, then stake 0, to
   observe AE SEXY collection, recovery and the live-tab decision path without
   chip clicks.
2. Run the finite small-stake canary only after the operator enables a
   production license authority, public key and customer-build signing
   configuration and the `small-stake-pilot arm` gate passes.
3. Exercise real browser recovery around an aggregate multi-live pending bet,
   including a Player+Banker round. Current evidence is unit/fixture coverage,
   not a casino end-to-end run.
4. Measure CPU/RAM for a pilot-duration session and compare it with
   `RESOURCE_BASELINE.md`.
5. Reconcile active current-round pending. Deferred/quarantined historical
   records remain warnings; they must not be deleted or assigned guessed
   outcomes, but they no longer block a different exact round after recovery.

## Test and observability gaps

- Add browser/integration fixtures for AE SEXY chip placement and for
  WS/HTTP reconciliation without connecting to a real casino.
- Add a browser-level integration case for partial aggregate placement and
  recovery; durable SQLite coverage now exists.
- If richer operator reporting is required, expose the queryable
  `bet_allocations` journal in the workspace.

## Maintenance

- Resolve or suppress the Python 3.13 `<prefix>` startup warning after verifying
  the interpreter/venv configuration; it is non-blocking for the current 176
  passing tests.
- Keep `credentials.yaml`, `config.yaml`, `data/toolbet.db` and
  `data/cdp_profile/` out of version control and release artifacts.

## Completed — workspace persistence (2026-08-03)

- [x] Correct the two 10-round schedule strategies and give each live tab an
  independent runtime-only schedule counter that advances after settlement.
- [x] Keep persisted strategy, MoneyManager and stake-chain settings after
  Tool Login/Game Login. Reload SQLite-owned `strategy_tabs` after the site URL
  update; do not overwrite them with fresh YAML defaults.
- [x] Remove the manual workspace save button. Persist each valid tab edit to
  SQLite automatically after a short debounce while preserving incomplete
  name/stake input locally until it is valid.
- [x] Rehydrate SQLite-owned workspace settings only when the panel is
  installed again; do not poll SQLite during ordinary UI refreshes. Hide the
  start-real action for the selected simulation tab while preserving stop.
- [x] Give every tab × MoneyManager pair an independent durable stake chain;
  seed missing manager records on save/reload with zero-stake defaults and
  preserve all existing configurations.
- [x] Recognise the v2 workspace in the health presence check so a live panel
  is not repeatedly reinstalled and its header does not flicker.
- [x] Add newest-first, SQL-paginated bet history with 10/20/50 page sizes and
  a persisted browser-side display preference.
- [x] Reset the control-panel scroll only on its first DOM mount; preserve it
  during reinstalls and ordinary runtime updates.
- [x] Render MultiChain stake chains one per line and save each valid line as
  its own durable `stake_chains` record.
- [x] Keep the run control visible for both simulation and live tabs, with the
  concise “Bắt đầu chạy”/“Dừng chạy” visible labels.
- [x] Extend the desktop workspace to the viewport bottom while retaining its
  existing top margin.
- [x] Decouple the session-only Run control from persisted `betting.auto_bet`.
  A valid Tool session can start a simulation-only or mixed workspace; tab mode
  alone determines whether an eligible bet reaches the live executor.

## Completed work intentionally not kept as TODO

- UI runtime v2/workspace persistence, Tool Login gate, 8 MoneyManagers,
  license authority/client, phase-G strategies, packaging support, direct
  simulation/live tabs and concurrent Player/Banker aggregate placement are
  implemented in source and covered by the current test suite.
