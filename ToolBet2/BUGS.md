# Bugs

## Open investigation: Live authority disappears after a shoe transition — 2026-08-04

- Evidence: physical placement succeeded through 02:46:50; the first generic
  no-authority log followed at 02:47:03 after shoe `25991 -> 25992`. No tab
  save or explicit Auto-off event appears in that interval.
- Status: the former log did not preserve the rejected tab/RiskDecision fields,
  so it cannot establish a root cause retrospectively. The new structured
  `NO_ELIGIBLE_AUTHORITY` diagnostic must be collected before changing any
  authority or shoe-transition rule.

## Live stake and unconfirmed-intent fixes — 2026-08-04

### Saved stake chain could leave the live executor on an old quote

- Cause: `HistoryWatcher._sync_live_money_managers()` compared only the
  MoneyManager ID. Editing a chain such as 20 to 10 therefore left the existing
  in-memory manager active, even though SQLite and the UI showed 10.
- Fix: compare `money_config_fingerprint` for the complete manager
  configuration. A changed configuration replaces the runtime manager and
  saves the fresh state when the old persisted snapshot cannot match it.

### A multi-live journal intent could settle before placement was confirmed

- Cause: the journal allocation is created before executor completion, but a
  result could reach the resolver while that allocation was still `placing`.
- Fix: use `ready_to_resolve`; an unconfirmed intent is parked as `deferred`
  and cannot alter allocation outcome, P&L or MoneyManager state.

## Fixed in the current work — 2026-08-04

### Partial chip DOM caused a synthetic tray and false placement evidence

- Cause: a zero/unknown DOM token triggered a count-based fallback, while the
  boolean executor result could not distinguish pre-click cancellation from a
  possible zone click.
- Fix: retain positional DOM denominations, raise `BetPlacementUncertain` only
  after a possible zone click, cancel pre-click failures and use
  `multi_live_partial`/`multi_live_uncertain` instead of a false placed event.

### Pending from C01 could block C02 and use C02 metadata

- Fix: park other-table work as `deferred`, scope active preflight counts to the
  current table, reject cross-table metadata as reconciliation evidence and
  retain exact-round duplicate protection on the original identity.
- Old-project comparison: the old ToolBet kept pending only in RAM and ignored
  it after restart. Current code now matches the non-blocking behavior while
  retaining the SQLite row as `deferred`, rather than losing the evidence.
- Bet #52 still requires trustworthy casino evidence; this patch did not alter
  its stored status or outcome.

## Open bugs

### License-cache restore regression makes the full suite fail

- Current evidence: the focused runtime regressions pass, but the latest
  complete suite runs 235 tests (232 pass, 2 skip) with one failure in
  `test_tool_session_restores_from_valid_signed_cache`. Re-running that test
  alone reproduces the failure: `ToolAuthService.is_authenticated()` is false
  after constructing a new service from a signed cache created in the test.
- The intended workspace snapshot change was regenerated and passes. The
  license-cache cause has not yet been confirmed; do not claim a clean
  full-suite result.

### Stateful reference persistence is not yet equivalent

- BaccaratChromeAgent2 persists Online N-gram model/adaptive state and reads
  external N-gram/Expert Panel configuration from AppData. ToolBet currently
  warm-starts N-gram in memory and uses the documented default Expert Panel
  parameters.
- Random, Hot-back and random-tie branches are seeded per ToolBet tab for
  reproducible runs, whereas the C# tasks seed from time/thread.
- These are known cross-process/config differences, not covered by the new
  deterministic strategy vectors. A persistence/config contract is required
  before claiming full strategy equivalence.

### UI scroll/focus regression test is intermittently timing-sensitive

- One 91-test combined focused run observed
  `test_realtime_update_preserves_unsaved_form_scroll_and_focus` return scroll
  0 instead of 240. The same test passed immediately in isolation and passed
  in the preceding 223-test full run.
- This is not yet confirmed as a runtime defect, but the debounce/render timing
  should be diagnosed before treating repeated long browser suites as fully
  deterministic.

### Operational small-stake canary is still blocked

- Runtime guard and evidence tooling are complete, but the real environment
  still has no confirmed live tab/readable stake envelope. Bet `id=27` is now
  a non-blocking deferred warning. No canary lease exists on the real data directory.

### Runtime-sensitive files remain tracked by Git

- Project ignore rules now cover `config.yaml`, `credentials.yaml`, the
  database and Chrome profile, but files committed earlier remain in the Git
  history. Phase 0 staged their removal from the current Git index without
  deleting local files; the cleanup is not durable until that staged change is
  committed.
- The internal Phase 0 release artifact was audited clean. Repository cleanup
  remains a separate required hygiene change and must preserve the local files.

## Fixed in the current work

### Retired 1-1 and Bet×2 models still ran beside strategy tabs

- Cause: the old pattern analyzer still ran on every history refresh, remained
  the default/fallback `legacy_patterns` strategy and powered the diagnostic
  decision-shadow path after strategy tabs became authoritative.
- Fix: remove `legacy_patterns` from the catalogue/default/fallback, stop
  publishing or logging its overlay analysis, disable legacy shadow by default
  and reject a missing strategy evaluator instead of arming a legacy signal.
- The selected tab's `status.current` remains the sole source for displayed
  recommendation, virtual stake and level; live execution uses the matching
  tab-owned strategy authority and MoneyManager quote.
- Regression coverage: `tests/test_strategy_tabs.py`,
  `tests/test_strategy_lifecycle.py`, `tests/test_decision_pipeline.py` and
  `tests/test_ui_runtime.py`.

### A healthy vipbet room was navigated back to webmain by false recovery

- Cause: `detect_ae_sexy_phase()` returned `PHASE_WEB` from the root URL
  `https://vipbet389.com/` before checking shell mode. The live game can remain
  inside a casino iframe on that root SPA URL. Logs simultaneously confirmed
  C01 room/stream health, a false-lobby veto and advancing HTTP history.
- Effect: repeated `is_game_ui_alive()` failures escalated through
  `HistoryWatcher._needs_recovery()` to `_recover_session()`, which closed the
  overlay and navigated to `/casino`; the software therefore created the exit
  that it then tried to recover.
- Fix: allowlisted `casino_iframe` root pages run the existing shell/room probe
  before WEB classification. Other sites/pages still short-circuit as WEB.
- Comparison: the old snapshot has the same `src/ae_sexy.py` hash and the same
  recovery decision/navigation code; the desired old behavior was not a
  separate implementation that could be copied verbatim.
- Regression coverage: `tests/test_ae_sexy_phase.py`.

### A new balance gate blocked the older ToolBet execution flow

- Cause: current live execution introduced `read_account_balance()` even though
  the older project did not use account balance to decide whether to bet. The
  reader required a “Số dư/Balance” label and returned `None` on the observed
  vipbet header, cancelling a valid Player 20 decision before the executor.
- Fix: remove the balance reader and all balance requirements from single and
  multi-live execution. Stake aggregation, journal, pending/exact-round and
  pre-click UI/guard behavior remain.
- Regression evidence: journal/live/lifecycle/risk focused group passes 44
  tests without mocking any account balance.

### A transient UI probe silently changed a Live tab to Simulation

- Cause: `AutoBettor._poll_bet_on_open()` called the shared runtime-unsafe
  callback after one failed `is_game_ui_alive()` probe. That callback invoked
  `StrategyLifecycleService.demote_live()` and persisted `mode=simulation`
  before the UI recovery loop could finish.
- Fix: the bounded watcher keeps the armed decision and polls again while the
  UI is temporarily unavailable. Runtime issue reporting no longer changes the
  durable tab mode; only the checkbox can do that.
- Regression coverage:
  `test_transient_ui_failure_keeps_live_arm_until_ui_recovers` and
  `test_runtime_issue_never_demotes_the_operator_live_tab`.

### Overlay reinstall redrew “Dừng chạy” as “Bắt đầu chạy”

- Cause: `GameOverlay._build_ui_snapshot()` omitted `run_enabled` when an
  install/reinstall was built without a runtime betting payload. `bridge.js`
  normalized the missing value to false even though
  `HistoryWatcher._run_enabled` was still true.
- Fix: `GameOverlay` owns a separate mirrored run latch and includes it in
  every snapshot. Explicit Start/Stop synchronizes the mirror; internal
  `auto_bet` pauses do not.
- Regression coverage deletes the workspace DOM while running, reinstalls it
  and verifies the button remains “Dừng chạy”.

### Start required one extra result before the first strategy bet

- Cause: the Start command only enabled `auto_bet`; `_arm_bet_signal()` was
  reached later only from `on_history_grew()`. A history snapshot already
  loaded before Start therefore could not drive the current betting window.
- Fix: Start now invokes `AutoBettor.arm_from_current_history()` with the
  explicit `operator-start` source. Empty/unavailable table state remains a
  no-arm condition, while exact-round and pending protections are unchanged.
- Regression coverage verifies the UI command calls immediate arm, valid
  current history creates an armed live decision, and empty history does not.

### Three reference strategy edge cases produced different state or side

- Dual Schedule incorrectly reused the main AI-Stat tie-break; for history
  `BPBB` its AI slots selected Banker while C# `AiStatMini` selects Player.
  It now has a dedicated reference-matching helper.
- Online N-gram allowed a Tie to advance stable-round decay. It now records the
  undecidable bit and returns before changing safety state, as C# does.
- Top10 added sliding windows between 10 and 49 B/P results. It now updates the
  settled rightmost window only when the frame has 50 results.
- Regression coverage includes focused edge tests and direct C#/Python strategy
  vectors through the current BaccaratChromeAgent2 assembly.

### Live checkbox could be lost before the debounced save completed

- Cause: “Chỉ mô phỏng/test” shared the generic 500 ms form debounce, so a fast
  overlay reinstall or table transition could reload the older SQLite mode.
- Fix: its `change` event now cancels the pending debounce and saves the complete
  valid tab draft immediately. SQLite remains authoritative on the next overlay
  install.
- Regression coverage: `test_simulation_checkbox_persists_live_mode_immediately`
  plus the existing SQLite lifecycle persistence test.

### Internal execution pause changed “Dừng chạy” back to “Bắt đầu chạy”

- Cause: preflight/config/license paths reused the operator Stop handler and
  cleared `HistoryWatcher._run_enabled` while only intending to pause execution.
- Fix: `HistoryWatcher._apply_execution_enabled()` controls internal
  `auto_bet` without changing the operator latch. Only
  `_handle_set_run_enabled(False)` clears the latch.
- Regression coverage:
  `test_internal_execution_pause_keeps_operator_run_latch` and
  `test_explicit_stop_is_the_only_path_that_clears_run_latch`.

### KILL_SWITCH could block live execution independently of the run control

- Removed by confirmed operator decision. The sentinel/environment checks,
  UI blocker, source/packaged ALLOW/STOP commands and pilot/preflight coupling
  no longer exist in current source.
- Execution mode, Tool capability, pending/exact-round protection, durable
  journal and bounded executor checks remain.

### Multi-live cancelled immediately before the betting window opened

- Cause: `_try_place_multi_live()` sampled UI/countdown once immediately after
  a result and returned `risk tổng hợp không an toàn` before the existing
  bounded waiting executor could observe the next open betting window.
- Fix: that combined snapshot is advisory and logged as `RISK_THAM_KHAO`;
  `wait_and_place_bet()` continues waiting and owns chip/zone/window readiness.
  Execution policy, real-bet guard, durable intent and
  exact-round duplicate protection remain independent.
- Regression coverage:
  `test_multi_live_combined_risk_is_advisory_before_waiting_executor` plus the
  existing live execution policy and small-stake guard suites.

### Old pending could lock all future live rounds indefinitely

- Cause: restart restored `placing`/`uncertain` into a durable global blocker,
  and preflight counted almost every unresolved row without round scope.
- Fix: confirmed/virtual old rows become `deferred`; an ambiguous real click
  remains active only until authoritative WS/HTTP proves the target round has
  closed/advanced, then becomes `quarantined`. Recovery starts a new per-tab
  epoch from the last settled MoneyManager snapshot without changing confirmed
  P&L or inventing an outcome.
- Deferred/quarantined rows are warnings. A DB-backed exact-round guard still
  rejects the old `(table, shoe, round)` but permits the next round. Bet 27 was
  inspected read-only as preserved `deferred`, virtual stake 0, outcome null.
- Regression coverage: `tests/test_bet_journal.py`,
  `tests/test_money_state_store.py`, `tests/test_live_execution_policy.py`.

### Run button could display stale stopped state after a runtime refresh

- Fix: `bridge.js` now replaces the run control only when `run_enabled`
  changes, updating its label, visual class, accessibility label and the next
  command payload together.
- Regression coverage: `test_runtime_refresh_updates_run_toggle_and_its_next_action`.

### Money-manager equivalence had no C# / Python regression contract

- Fixed: eight manager vectors now run through the Python production manager
  and a C# harness linking the reference source, including Banker rounding,
  Victor2 double phase and MultiChain transitions.
- Run `scripts/verify_golden_vectors.ps1` after changes to stake, level or P&L
  semantics. The standalone harness may emit a nullable warning from the
  unmodified reference `MoneyHelper.cs`; its output comparison still passes.

### Three B/P reference strategies were absent from the workspace

- Fixed: `sequence_follow`, `pattern_follow`, and `random_side` are available
  in the strategy selector with independent per-tab runtime state.
- The sequence/pattern field is durable in SQLite. Old databases receive the
  additive `strategy_input` column on normal application startup.

### Ensemble, Online N-gram and Expert Panel shared reduced logic

- Fixed: each strategy now owns its corresponding reference-derived model and
  per-tab runtime state. Ensemble has rolling expert scores; N-gram has a
  warm-started 1..6-gram model; Expert Panel has mock-vote/guard/EWMA/beauty
  state and default contrarian output.
- Remaining deliberate gap: the reference N-gram AppData persistence is not
  represented in ToolBet yet. Runtime state is reset on process start and
  warm-started from the current table history.

### Top10 and Hot-back were recalculated as stateless shortcuts

- Fixed: each strategy tab now owns the reference runtime state for its
  selected Top10 or Hot-back task. The state advances only after its allocation
  settles, preserving the reference pattern/cursor/candidate transitions.
- Regression coverage: `tests/test_statistical_strategies.py` and existing
  strategy-lifecycle tests.

### Banker P&L did not use reference whole-chip rounding

- Fixed: Banker payout rounds `stake * 0.95` midpoint-away-from-zero. The
  optional per-tab recovery reset returns capital progression to level 1 when
  recovery P&L crosses from negative to nonnegative.

### Ten-round schedule position was inferred from history

- Fixed: `time_sliced_hedge` and `dual_schedule_hedge` now use a separate
  runtime counter per tab, advanced only after settlement. `dual_schedule_hedge`
  now uses the reference slots: follow 1–3/9, reverse 4/8, AI-stat 5–7/10.
- Covered by focused schedule, replay-with-Tie and independent-tab tests; the
  complete suite passes 196 tests.

### Pending cũ có thể nhận nhầm kết quả của bàn khác

- Trước đây đường resolve không so sánh table/shoe/round, nên kết quả mới đầu
  tiên có thể chốt pending của bàn khác. Pending `placed` sau restart cũng có
  thể bị bỏ ngoài memory.
- Fix: dùng `deferred` theo bàn; chỉ `gp-winner`/`road-info-round` với exact
  table/shoe/round mới resolve. Ambiguous current-round placement remains
  fail-closed, then moves to `quarantined` after authoritative closure/advance.
- Regression coverage: `tests/test_bet_journal.py`.

### Preflight stake cap could drift before a physical click

- A finite lease now binds the exact SQLite/live tab and limits time, aggregate
  stake, bet count and loss. Runtime reloads lease and DB state before each
  physical click; missing/changed state blocks the click without changing the
  operator-owned Live/Simulation mode.
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
- Tests prove stake 0 does not call the click executor. A stale virtual bet is
  now deferred and does not block a different round; operational configuration
  still governs a real pilot.

### Bet intent was persisted only after an irreversible chip click

- Fix: persist `placing` before click, journal multi-live allocations and keep
  an `uncertain` pending on partial placement or post-click SQLite failure.
- Restart restores active ambiguity; authoritative round advance can now
  quarantine it and unlock later rounds while preserving operator evidence.
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

### Control-panel scroll restored at an arbitrary position on first mount

- Fix: the first newly created panel resets to the top both immediately and
  after its first animation frame. Reinstalling an existing panel and ordinary
  updates preserve the current scroll position.
- Regression coverage: `tests/test_ui_runtime.py` verifies an existing panel
  retains a previously scrolled position through reinstall.

### MultiChain chains were shown as one hard-to-edit line

- Fix: MultiChain now renders as a multiline editor, one chain per line, while
  preserving the existing `stake_chains` persistence contract.
- Regression coverage: `tests/test_ui_runtime.py` verifies line-by-line input
  is saved as separate chains.

### MultiChain label displayed mojibake and the editor looked oversized

- Fix: the label now uses explicit Unicode text, and the textarea has the same
  one-line height as other text boxes without a resize handle.

### Run button disappeared when a tab was simulation-only

- Fix: the run control stays visible; the simulation checkbox only controls
  whether the tab can be live, not whether the control is rendered.
- Regression coverage: `tests/test_ui_runtime.py` verifies visibility remains
  stable while the checkbox changes.

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
- A configured real-bet guard can still reject a physical click while leaving
  the tab in Live mode. KILL_SWITCH is no longer present in current source.

### Workspace configuration could revert after Game Login

- Cause: `HistoryWatcher.run()` assigned the complete config returned by
  `update_site_url()`. That new config came from YAML and replaced the
  SQLite-backed strategy workspace that had been loaded at startup.
- Fix: reload `strategy_tabs` from `StrategyTabStore` after the site update.
  SQLite remains authoritative when active rows exist; the database is not
  rewritten by this reload.
- Regression coverage: `test_fresh_yaml_config_does_not_replace_saved_sqlite_tabs`.

### LOCAL · DISABLED badge and Tool Logout flickered

- Cause: health checking only recognised legacy overlay DOM. With the legacy
  overlay disabled, it treated the v2 workspace as missing and repeatedly
  reinstalled the whole panel.
- Fix: `GameOverlay._panels_present()` recognises a present `BrowserUiRuntime`
  first; legacy DOM is checked only when the legacy overlay is enabled.
- Regression coverage: `test_runtime_workspace_is_reported_present_without_legacy_panels`.
