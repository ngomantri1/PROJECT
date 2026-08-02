# Bugs

## Open bugs

### Stale placed bet cannot be safely reconciled after restart

- Confirmed state: bet `id=27` is still `placed` with no outcome. It targets
  Baccarat C03, shoe 24963, round 39 and has stake 0; group 7 is still open.
- Available trusted history ends at round 38 and no matching resolve event
  exists. The current startup path does not reconstruct this pending bet into
  `BettingSession`.
- Phase 0 preserved the record and created a verified backup. Do not delete it
  or invent an outcome. A domain recovery/reconciliation workflow is required
  before a live pilot.

### Pilot preflight does not validate authoritative per-tab stakes

- `src/release_support.py:pilot_preflight()` checks `betting.stakes` from YAML,
  while live-tab MoneyManager configuration is authoritative in SQLite.
- A small-stake preflight can therefore pass even when a live tab can quote a
  stake above the pilot cap. This must be fixed and regression-tested before
  the `small_stake` gate is trusted.

### Runtime-sensitive files remain tracked by Git

- Project ignore rules now cover `config.yaml`, `credentials.yaml`, the
  database and Chrome profile, but files committed earlier remain in the Git
  history. Phase 0 staged their removal from the current Git index without
  deleting local files; the cleanup is not durable until that staged change is
  committed.
- The internal Phase 0 release artifact was audited clean. Repository cleanup
  remains a separate required hygiene change and must preserve the local files.

### Runtime log exposes the Game username

- The current `logs/toolbet.log` records the selected/login Game username.
  Passwords were not observed in this check, but logging a username still
  violates the project rule against credential identifiers in operational logs.
- Redact the username at the logging call sites and add a regression test before
  exporting diagnostics or running a customer pilot.

## Fixed in the current work

### Workspace state was overwritten by routine UI refresh

- Cause: ordinary snapshots rebuilt the workspace root, replacing form controls
  and allowing stale snapshots to overwrite newer UI state.
- Fix: `src/ui_runtime.py` rejects stale revisions and coalesces updates;
  `src/ui/bridge.js` keeps the form/scroll/focus DOM and patches only runtime
  regions when the structure is unchanged.
- Regression coverage: `tests/test_ui_runtime.py` covers stale revisions,
  unsaved form state, scrolling/focus and no full form rebuild.

### Table history briefly appeared and then disappeared

- Fix: the UI bridge keeps same-table history while a transient empty snapshot
  arrives and renders later non-empty history in the dedicated region.
- Regression coverage: `test_table_history_stays_visible_during_same_table_empty_snapshot`.

### Workspace configuration could revert after reopening

- Fix: `StrategyTabStore` persists tab configuration/runtime/history in SQLite;
  the UI preserves catalogue IDs when an incoming snapshot lacks a catalogue.
- Regression coverage: `tests/test_strategy_tab_store.py` and
  `tests/test_ui_runtime.py`.

### Browser was reconnected while its logged-in context was still alive

- Cause: `BrowserManager.is_connected()` could return `None` instead of `True`.
- Fix: the live-context check now returns `True`; its browser startup regression
  tests pass.

### Documentation advertised a missing `build.bat` and omitted a progression mode

- Fixed in `HUONG_DAN_CAI_DAT.md` and `config.example.yaml`: deployment uses
  `ToolBet.bat`; `profit_lock_loss_up` is documented with the other progression
  modes.

## Known limitations / risks (not confirmed bugs)

- The external casino/provider can change selectors, iframe structure, payloads
  or chip UI.
- Multi-live Player+Banker placement and aggregate-pending recovery have unit
  coverage, but have not been proven by a real-casino end-to-end session.
- Python 3.13 prints `Could not find platform independent libraries <prefix>`;
  it did not prevent the current 154-test run.
- Database migrations are additive but production SQLite data should be backed up
  before a release upgrade.
