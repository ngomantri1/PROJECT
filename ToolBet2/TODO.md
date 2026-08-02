# TODO

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
2. Validate a small-stake pilot only after the operator enables a production
   license authority, public key and customer-build signing configuration as
   described in `LICENSE_DEPLOYMENT.md` and `PILOT_RUNBOOK.md`.
3. Exercise real browser recovery around an aggregate multi-live pending bet,
   including a Player+Banker round. Current evidence is unit/fixture coverage,
   not a casino end-to-end run.
4. Measure CPU/RAM for a pilot-duration session and compare it with
   `RESOURCE_BASELINE.md`.
5. Complete the fail-closed preflight and pending-recovery work. A live pilot
   must remain blocked while any unresolved/uncertain bet exists.

## Test and observability gaps

- Add browser/integration fixtures for AE SEXY chip placement and for
  WS/HTTP reconciliation without connecting to a real casino.
- Add an integration case for partial aggregate placement (one of Player or
  Banker succeeds) and recovery/restart while the aggregate pending bet is
  awaiting its result.
- If operator-facing per-tab live-bet reporting is required, add a queryable
  allocation model. At present the aggregate `BetRecord` is durable and the
  allocation detail is emitted as events; individual MoneyManager state is
  persisted separately.

## Maintenance

- Resolve or suppress the Python 3.13 `<prefix>` startup warning after verifying
  the interpreter/venv configuration; it is non-blocking for the current 154
  passing tests.
- Keep `credentials.yaml`, `config.yaml`, `data/toolbet.db` and
  `data/cdp_profile/` out of version control and release artifacts.

## Completed work intentionally not kept as TODO

- UI runtime v2/workspace persistence, Tool Login gate, 8 MoneyManagers,
  license authority/client, phase-G strategies, packaging support, direct
  simulation/live tabs and concurrent Player/Banker aggregate placement are
  implemented in source and covered by the current test suite.
