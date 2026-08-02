# Bugs

## Open bugs

### Operational small-stake canary is still blocked

- Runtime guard and evidence tooling are complete, but the real environment
  still has bet `id=27`, no live tab/readable stake envelope, no enabled
  production license and an active kill switch.
- This is an intentional fail-closed blocker, not permission to edit SQLite or
  remove the kill switch. No canary lease exists on the real data directory.

### Stale placed bet cannot be safely reconciled after restart

- Confirmed state: bet `id=27` is still `placed` with no outcome. It targets
  Baccarat C03, shoe 24963, round 39 and has stake 0; group 7 is still open.
- Available trusted history ends at round 38 and no matching resolve event
  exists. Startup now reconstructs this pending and locks automatic execution,
  preventing an unrelated later result from resolving it.
- Phase 3 provides a backup-first audited reconciliation command, but it still
  requires trusted round-39 evidence. Bet `id=27` remains unchanged; do not
  delete it or invent an outcome before a live pilot.

### Runtime-sensitive files remain tracked by Git

- Project ignore rules now cover `config.yaml`, `credentials.yaml`, the
  database and Chrome profile, but files committed earlier remain in the Git
  history. Phase 0 staged their removal from the current Git index without
  deleting local files; the cleanup is not durable until that staged change is
  committed.
- The internal Phase 0 release artifact was audited clean. Repository cleanup
  remains a separate required hygiene change and must preserve the local files.

## Fixed in the current work

### Pending cũ có thể nhận nhầm kết quả của bàn khác

- Trước đây đường resolve không so sánh table/shoe/round, nên kết quả mới đầu
  tiên có thể chốt pending của bàn khác. Pending `placed` sau restart cũng có
  thể bị bỏ ngoài memory.
- Fix: dùng `deferred` theo bàn; chỉ `gp-winner`/`road-info-round` với exact
  table/shoe/round mới resolve. `placing`/`uncertain` vẫn fail-closed toàn cục.
- Regression coverage: `tests/test_bet_journal.py`.

### Preflight stake cap could drift before a physical click

- A finite lease now binds the exact SQLite/live tab and limits time, aggregate
  stake, bet count and loss. Runtime reloads lease and DB state before each
  physical click; missing/changed state blocks and demotes live execution.
- Tie nurture is disabled for the first canary. Pre-click rejected intents are
  closed as `cancelled`; partial physical placement still uses the durable
  uncertainty/reconciliation path.
- Regression coverage: `tests/test_small_stake_guard.py` and
  `tests/test_bet_journal.py`.

### Runtime log exposed Game and Tool usernames

- Login-success and saved-Game-account messages no longer include usernames.
- Runtime logging and diagnostics redact `username`/`user` fields plus the old
  login-success message form, with regression coverage in
  `tests/test_release_support.py`.
- Existing pre-fix raw log files may still contain identifiers and must remain
  treated as sensitive; diagnostics export redacts them but does not rewrite
  the original logs.

### Stake-zero pilot had no durable proof of virtual execution

- Every bet now snapshots `execution_mode`; the start/finish audit verifies all
  new bets and allocations were virtual, zero-stake and resolved.
- Tests prove stake 0 does not call the click executor. The real pilot remains
  blocked by the preserved stale pending and missing live-tab configuration.

### Bet intent was persisted only after an irreversible chip click

- Fix: persist `placing` before click, journal multi-live allocations and keep
  an `uncertain` pending on partial placement or post-click SQLite failure.
- Restart restores durable pending and requires explicit trusted
  reconciliation before new automatic bets.
- Regression coverage: `tests/test_bet_journal.py` and
  `tests/test_pending_reconciliation.py`.

### Pilot preflight trusted YAML instead of per-tab SQLite stakes

- Fix: source and packaged preflight now read the selected live tab and
  MoneyManager config from SQLite, including MultiChain chains and Victor2's
  possible doubled quote. Missing/malformed runtime state fails closed.
- The small-stake gate also verifies the device-bound signed `live_bet` cache,
  HTTPS production URL, public key and validity window without mutating the
  token.
- Regression coverage: `tests/test_release_support.py` proves a YAML-small /
  SQLite-large mismatch is blocked, Victor2 doubling is included and a valid
  signed live capability is accepted.

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
  it did not prevent the current 176-test run.
- Database migrations are additive but production SQLite data should be backed up
  before a release upgrade.

### Workspace configuration could revert after Game Login

- Cause: `HistoryWatcher.run()` assigned the complete config returned by
  `update_site_url()`. That new config came from YAML and replaced the
  SQLite-backed strategy workspace that had been loaded at startup.
- Fix: reload `strategy_tabs` from `StrategyTabStore` after the site update.
  SQLite remains authoritative when active rows exist; the database is not
  rewritten by this reload.
- Regression coverage: `test_fresh_yaml_config_does_not_replace_saved_sqlite_tabs`.
