# Current Project State

## Phase 6 table-scoped deferred pending — 2026-08-03

- Confirmed `placed` pending is no longer allowed to consume the next result
  from an unrelated table. On restart, or when a later result belongs to a
  different/mismatched server round, it is stored as `status=deferred` with an
  audit event and removed from in-memory betting/progression state.
- A deferred bet only resolves automatically from authoritative
  `gp-winner`/`road-info-round` metadata matching the exact table, game shoe
  and game round. DOM/canvas/lobby history and a merely newer result cannot
  resolve it. `placing`/`uncertain` remains a global fail-closed recovery lock.
- Deferred records remain visible to the manual reconciliation workflow but no
  longer block pilot preflight or an unrelated live table. The stopped real DB
  was not mutated while implementing this change; bet 27 remains `placed` until
  a source run performs the explicit deferred transition.
- Full source suite passes **184 tests**. No release build was made for this
  source-only change; it will be used by `ToolBet.bat` on the next start.

## Phase 5 finite small-stake canary — 2026-08-03

- Real execution now requires a local `SMALL_STAKE_PILOT.json` lease in
  addition to the existing kill-switch, license, UI, balance and round gates.
  The lease binds one exact live `tab_id`, SQLite path, expiry, aggregate
  per-round stake cap, maximum real-bet count, stop-loss and baseline bet id.
- `AutoBettor` checks the lease and authoritative SQLite state before creating
  an intent and again immediately before each physical click. Missing, expired
  or changed lease/tab/stake/pending state auto-demotes live execution. Tie
  nurture is deliberately excluded from the first canary.
- If the final check rejects an intent before any click, it is closed as
  `cancelled` with zero P&L. A rejection after a partial multi-side click keeps
  the durable recovery lock and requires reconciliation.
- Added source/packaged `small-stake-pilot arm|status|finish|close`; `arm` uses
  the same production-license and SQLite preflight and creates the lease
  atomically. `finish` is read-only and requires at least one resolved real bet
  within all lease limits; `close` revokes by recoverably renaming the lease.
- Full suite passes **181 tests**. The real `arm` command remains correctly
  blocked by bet `id=27`, no live tab/stake envelope, disabled production
  license and the active kill switch. No real lease was created, no browser was
  started and no casino click or production-DB mutation occurred.
- On 2026-08-03 the stopped local runtime configuration was checked and set to
  `betting.auto_bet=false`; `betting.tie_nurture.enabled` was already `false`.
  Both stake-zero and small-stake preflight remain blocked by the preserved
  pending and lack of a live tab/authoritative stake envelope.
- Internal snapshot `ToolBet2-0.8.0-phase5-internal-win-x64.zip` passed packaged
  self-check, manifest verification, runtime-secret audit and packaged
  status/finish against an isolated fake SQLite/lease. SHA-256:
  `dbd104faf8c11992a45ace5a76b35db9e62c8a77250f894d4f8982cfa20794cd`.

## Phase 4 stake-zero evidence gate — 2026-08-02

- Added durable `bets.execution_mode` (`virtual`/`real`). Existing stake-zero
  rows are backfilled to `virtual`; every new single, Tie and multi-live intent
  records its mode before execution.
- Added source and packaged `stake-zero-audit start|finish`. `start` records the
  authoritative bet baseline only after the existing stake-zero preflight
  passes. `finish` reads the DB without mutation and requires every new bet to
  be virtual, stake 0 and resolved, and every allocation to be stake 0 with
  `placement_status=virtual`.
- Regression tests prove both the lowest click executor and the waiting path
  return for stake 0 without invoking chip/zone click execution.
- Removed Game/Tool usernames from login-success/runtime configuration logs and
  extended runtime/support-bundle redaction for username fields and historical
  login-success messages.
- Full suite passes **176 tests**. The real `stake_zero` start remains correctly
  blocked by bet `id=27`, zero live tabs and no authoritative live stake chain;
  no browser pilot was started and no runtime data was changed.
- Internal snapshot `ToolBet2-0.8.0-phase4-internal-win-x64.zip` passed packaged
  self-check, manifest verification, runtime-secret audit and packaged
  stake-zero start/finish against an isolated fixture. SHA-256:
  `a9c3cafb14cff906979edf011085b327d569f97beabde986e7d8d26eb977c117`.
- The production SQLite file was inspected read-only after the build. Bet 27 is
  still unchanged and the new additive column has not yet been applied there;
  migration will run only when the application is deliberately started.

## Phase 3 trusted pending reconciliation — 2026-08-02

- Added offline `scripts/reconcile_pending.py`: listing is read-only; resolve
  requires the active kill switch, exact bet/round identity, trusted-result
  evidence and a fixed operator acknowledgement.
- Resolve creates and verifies an online SQLite backup before mutation, then
  updates the bet, allocation/group summaries and `pending_reconciled` audit
  event in one `BEGIN IMMEDIATE` transaction.
- Only confirmed `placed` bets can be result-reconciled. `placing`, `uncertain`,
  missing aggregate journals or allocations not `placed`/`virtual` are rejected.
- Bet `id=27` remains unchanged because no trusted round-39 evidence was
  supplied. It continues to block pilot progression.
- Internal snapshot `ToolBet2-0.8.0-phase3-internal-win-x64.zip` passed the
  168-test build, packaged self-check, manifest verification, packaged
  reconciliation-list fixture and runtime-secret audit. SHA-256:
  `9b66198adde387d529f890a68314e3dd5654d992d4a298d29f97a5331abafc32`.
  It remains an internal artifact; the kill switch was not removed.

## Phase 2 durable placement journal and restart gate — 2026-08-02

- Bet intent is persisted as `placing` before physical click. Multi-live plans
  are stored in `bet_allocations` before the first side and updated per side.
- Partial placement or post-click SQLite failure retains pending, disables auto
  betting and blocks new bets instead of clearing memory.
- Startup reconstructs one main and one independent Tie pending. Every
  restart-recovered pending requires trusted reconciliation and is never
  automatically matched to an unrelated later result.
- Crash/partial/restart/write-failure coverage and the full suite pass:
  **168 tests**. No casino session or physical chip click was used.

## Phase 1 fail-closed pilot preflight — 2026-08-02

- Pilot preflight now resolves `database.path` relative to the selected config
  file unless `--database` explicitly overrides it. Source and packaged CLI use
  the same read-only `inspect_pilot_runtime()` contract.
- `stake_zero` and `small_stake` no longer trust `betting.stakes` in YAML. They
  require exactly one live tab with `auto_bet=false`, read that tab's selected
  MoneyManager configuration from `strategy_money_configs` (falling back to
  the tab row only when no manager-specific row exists), include MultiChain
  chains and include Victor2's possible doubled quote.
- Every bet with `outcome IS NULL`, malformed/missing SQLite schema, an invalid
  manager or an unreadable/empty live stake envelope blocks the transition.
- `small_stake` additionally verifies an HTTPS production license URL, public
  key, device-bound signed cache, signature, refresh token, expiry/offline
  grace and `live_bet` capability without refreshing or mutating the token.
- Windows maintenance CLI output is forced to UTF-8 so fail-closed Vietnamese
  messages do not crash under a CP1252 console.
- `scripts/run_tests.ps1` passes **157 tests**. The real Phase 0 database remains
  correctly blocked by bet `id=27`, no live tab, missing production license and
  the active kill switch.
- Internal snapshot `ToolBet2-0.8.0-phase1-20260802-internal-win-x64.zip` passed
  packaged self-check, manifest verification, secret/runtime-file audit and the
  packaged fail-closed preflight. SHA-256:
  `2aeae722110c8cc604fa18230347bb03b423d6d93fd1750a861f65e69c8fa811`.
  It remains an internal, license-disabled artifact rather than a customer
  money-stake build.

## Phase 0 live-readiness checkpoint — 2026-08-02

- Phase 0 did not enable `auto_bet` or intentionally stop/reload the live
  session. Final verification found no remaining `main.py` process after the
  runtime log ended with repeated `socket.send()` warnings; the tool was not
  restarted. The persisted gate is fail-closed: `auto_bet=false`, no active
  live tab and one unresolved stake-0 bet remains in SQLite.
  `data/KILL_SWITCH` is active for the source runtime, so new live bets remain
  blocked while Phase 0 issues are open.
- An online SQLite backup was created at
  `data/backups/toolbet-phase0-20260802-230544.db`. `PRAGMA quick_check` returned
  `ok`; the backup contains 51 bets, 1,027 rounds and 119 events. SHA-256:
  `d20d5f6694be6b448e5cf6e6a2758042ee535d71413c7b6e1770dee7301e73ff`.
- Bet `id=27` targets `Baccarat C03`, shoe `24963`, round `39`, Player, stake
  `0`. Trusted SQLite history ends at round 38 and there is no resolve event or
  round-39 result, so the bet was deliberately not guessed, deleted or updated
  by manual SQL. Group 7 remains open and the record continues to block a live
  pilot until an explicit reconciliation path is implemented or a trusted
  result is supplied.
- Internal snapshot `ToolBet2-0.8.0-phase0-20260802-internal-win-x64.zip` was
  built through the existing release pipeline. Tests, packaged self-check and
  manifest verification passed. The artifact audit found no real
  `config.yaml`, `credentials.yaml`, `toolbet.db`, Chrome profile or license
  cache. SHA-256:
  `490b65fd46dd1f14d6664548c365ef076f6c6ddd394859b62b83dfe3d0208b85`.
- This is an internal preservation checkpoint, not a customer/live release. It
  uses an auto-off, license-disabled template and is not authorized for a
  money-stake pilot.
- Repository hygiene is staged separately: project `.gitignore` was added and
  tracked `config.yaml`, `credentials.yaml` and `data/cdp_profile/` entries were
  removed from the Git index with `git rm --cached`. All local runtime files
  were preserved; the staged removals still require a later commit.

## Verified status — 2026-08-02

- `scripts/run_tests.ps1` passes: **157 tests** in ~30 seconds. The active
  Python 3.13 environment prints `Could not find platform independent libraries
  <prefix>`, but the test run completes successfully.
- ToolBet keeps the existing Python/asyncio/Playwright/CDP engine for Chrome,
  Game login, captcha, AE SEXY navigation, result collection, recovery and bet
  execution. The UI is HTML/CSS/JavaScript injected into the game page; no C#
  or WPF code is used.
- Tool Login gates Game Login. The Game-login, captcha and AE SEXY adapter flow
  remain in the existing browser engine.
- UI runtime v2 is the default workspace; the legacy overlay remains available
  behind `ui.legacy_overlay_enabled` as a rollback path. `UiRuntime` rejects
  stale snapshots and `src/ui/bridge.js` patches runtime regions instead of
  recreating the whole panel for ordinary updates. SQLite is authoritative for
  strategy-tab configuration, runtime and history.
- Each tab is currently either `simulation` or `live`. A live tab has its own
  `MoneyManager`. More than one tab can be live. When live tabs select Player
  and Banker in one round, `AutoBettor` can place both sides as one aggregate
  pending transaction and resolves each tab's money state separately. Stake 0
  remains virtual and does not click chips.
- The direct live switch does not require a Shadow threshold or a Promote UI.
  Older Shadow contract code remains for comparison/diagnostics compatibility;
  it is not the workspace's current activation path.
- Eight reference MoneyManagers, license client/authority, packaging scripts,
  and phase-G statistical strategies exist and have unit coverage. Customer
  deployment still needs production license credentials and an operational
  pilot.

## Safety and persistence invariants

- `AutoBettor` remains the only component allowed to reserve, click and persist
  a real bet. UI commands only save configuration or toggle the global run
  switch.
- Main betting keeps one aggregate pending transaction per round; Nuôi Hòa has
  its independent pending path. Duplicate/recovery guards still apply.
- The final real-bet gate checks Tool/license state, pending/duplicate,
  shuffle/source, UI/countdown and the header balance against the aggregate
  stake. Unsafe browser/page/UI/license states demote live tabs and persist
  `auto_bet: false`.
- On restart, money-manager state is restored per tab but `auto_bet` remains
  disabled until the operator starts real running again.

## Verified, not yet operationally proven

- Browser fixtures cover injection, DOM deletion, reload, responsive layouts,
  stale snapshots, form preservation, table-history retention and dragging.
- Unit tests cover multiple live tabs and Player+Banker allocation/resolve.
- There is **no recorded end-to-end real-casino validation** of a multi-live
  physical chip placement, recovery during that pending transaction, or a
  money-stake pilot.

## Key continuation points

- `main.py` — `HistoryWatcher`, UI commands, live-tab evaluation and allocation
  resolution.
- `src/auto_bettor.py` — aggregate live placement/resolution.
- `src/strategy_lifecycle.py`, `src/strategy_tab_store.py`,
  `src/money_state_store.py` — tab mode and durable state.
- `src/ui_runtime.py`, `src/ui/bridge.js` — workspace lifecycle and partial UI
  updates.
- `src/ae_sexy_collector.py`, `src/ae_sexy.py`, `src/ae_sexy_betting.py` —
  provider collection/navigation/execution.

## Workspace persistence fix — 2026-08-03

- Fixed a post-login regression: `update_site_url()` creates a fresh YAML
  `AppConfig`, which had replaced the SQLite-backed strategy-tab workspace
  after Game Login. `HistoryWatcher.run()` now reloads only `strategy_tabs`
  from `StrategyTabStore` immediately afterwards. Existing SQLite records are
  read only; they are imported from YAML only when no active records exist.
- Verified with `tests.test_strategy_tab_store` (6 tests) and Python
  `compileall` for `main.py` and `src`. No build was run and no runtime DB was
  modified by this source change.

## Workspace auto-save — 2026-08-03

- Removed the manual “Lưu cấu hình” action. Valid edits to a tab's strategy,
  MoneyManager, stake chain, limits, enabled flag or mode are debounced for
  500 ms then persisted through the existing SQLite bridge. Empty tab names or
  invalid/empty stake chains remain in the form and cannot replace saved data.
- `tests.test_ui_runtime` passes 19 tests; it verifies the button is absent and
  a normal form edit is saved automatically without runtime-only fields.

## Workspace rehydrate on re-entry — 2026-08-03

- Strategy tabs are reloaded from SQLite once immediately before each workspace
  overlay installation (entering a table again, recovery, reload or lost DOM).
  Normal overlay updates do not query SQLite for configuration.
- The start-real action is hidden while the selected tab has “Chỉ mô phỏng/test”
  checked and reappears immediately when it is unchecked. A running session
  always retains its visible stop action. SQLite's live-tab state is reconciled
  at rehydrate; `auto_bet` remains the current session state and is disabled if
  no live tab remains.

## Independent MoneyManager stake chains — 2026-08-03

- Each strategy tab now seeds one SQLite `strategy_money_configs` record for
  every one of the eight MoneyManagers when saved or first reloaded. Missing
  managers start with `[0]`
  (`MultiChain` with `[[0]]`); existing manager-specific chains are preserved.
- Changing a manager's chain only updates that tab/manager record. Selecting a
  different manager reloads its own saved chain rather than copying the active
  manager's chain.

## Workspace header stability — 2026-08-03

- Fixed the v2 workspace presence check: it now recognises `BrowserUiRuntime`
  before checking legacy DOM. The health loop no longer repeatedly reinstalls a
  live v2 panel, so the LOCAL · DISABLED badge and Tool Logout control remain
  stable and SQLite rehydrate occurs only after the workspace is truly gone.
