# Current Project State

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

- `scripts/run_tests.ps1` passes: **154 tests** in ~30 seconds. The active
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
