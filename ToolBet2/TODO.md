# TODO

## Phase 6 table-scoped deferred pending

- [x] Defer confirmed placed pending on restart/table-or-round mismatch instead
  of consuming an unrelated next result.
- [x] Require exact table/shoe/round metadata from WS/HTTP sources before an
  automatic deferred resolution; preserve manual reconciliation.
- [x] Keep `placing`/`uncertain` global fail-closed and exclude only deferred
  records from unrelated-table pilot gates.
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
- [ ] Obtain trusted evidence and reconcile or defer bet `id=27`; configure
  exactly one approved live tab and a production signed `live_bet` license.
- [ ] With the operator present, backup DB, clear the kill switch only for the
  approved window, run `arm`, complete at most the approved bets, turn Auto off,
  run `finish`, then `close` and re-enable the kill switch.

## Phase 4 stake-zero evidence gate

- [x] Persist `execution_mode` for every bet and backfill historical stake-zero
  rows as virtual through the additive migration.
- [x] Add source/packaged start-finish audit for a stake-zero bet window.
- [x] Prove stake zero never invokes the chip-click executor in focused tests.
- [x] Remove Game/Tool usernames from runtime logs and redact historical login
  identifiers from diagnostics.
- [ ] Reconcile bet `id=27` from trusted evidence, then configure exactly one
  live tab whose authoritative MoneyManager envelope is entirely zero.
- [ ] Only after the real preflight passes, run the controlled browser ca and
  produce a PASS finish report; this operational step was not forced.

## Phase 3 trusted pending reconciliation

- [x] Add read-only inspection and explicit resolve gated by kill switch, exact
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
- [x] Activate the source-runtime `data/KILL_SWITCH`; keep it in place until
  stale pending reconciliation and fail-closed preflight work are complete.
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
5. Reconcile every pending from trusted evidence. Recovery is implemented, and
   pilot remains blocked while any unresolved/uncertain bet exists.

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

- [x] Keep persisted strategy, MoneyManager and stake-chain settings after
  Tool Login/Game Login. Reload SQLite-owned `strategy_tabs` after the site URL
  update; do not overwrite them with fresh YAML defaults.
- [x] Remove the manual workspace save button. Persist each valid tab edit to
  SQLite automatically after a short debounce while preserving incomplete
  name/stake input locally until it is valid.

## Completed work intentionally not kept as TODO

- UI runtime v2/workspace persistence, Tool Login gate, 8 MoneyManagers,
  license authority/client, phase-G strategies, packaging support, direct
  simulation/live tabs and concurrent Player/Banker aggregate placement are
  implemented in source and covered by the current test suite.
