# Current Project State

## Live-authority diagnosis after shoe transition — 2026-08-04

- The 2026-08-04 runtime log placed successfully through 02:46:50, then first
  emitted the former generic no-live-authority message at 02:47:03 after the
  shoe changed. It contains no configuration-save or explicit Auto-off event.
  The historical log alone cannot prove which authority condition failed.
- `AutoBettor._arm_bet_signal()` now writes one structured
  `NO_ELIGIBLE_AUTHORITY` warning when every evaluated Live tab is rejected.
  It records each tab's mode, stake, strategy decision and RiskDecision code,
  reason and execution mode, plus session `auto_bet` and pending state. It
  contains no credentials, token or casino payload.
- The exact cause remains pending the next runtime occurrence; no casino page
  or physical-money click was used to add this diagnostic.

## Live stake synchronization and unconfirmed intent settlement — 2026-08-04

- `HistoryWatcher._sync_live_money_managers()` now compares the full
  `money_config_fingerprint`, not merely the manager ID. Saving a changed tab
  configuration replaces its in-memory MoneyManager immediately; an obsolete
  SQLite snapshot is not restored. The next strategy quote therefore uses the
  stake chain shown by that tab (for example, 10 rather than a stale 20).
- A multi-live journal intent begins with `ready_to_resolve=False`. It becomes
  resolvable only after the executor finalizes its kept allocations. If an
  authoritative result arrives while placement is still unconfirmed, the row
  is parked as `deferred`; no outcome, P&L or MoneyManager progression is
  invented.
- Focused regressions cover both cases. The 47-test journal/tab/lifecycle/
  money-state group passes, and no casino page or physical-money click was
  used for this change.

## Table-scoped pending and truthful placement evidence — 2026-08-04

- DOM chip values are authoritative when the tray exposes at least two positive
  denominations. `[10, 50, 100, 500, 0]` no longer becomes a synthetic tray.
- Execution distinguishes `cancelled` (no zone click) from evidence that a zone
  click may have occurred. Like the old ToolBet, an unconfirmed executor does
  not block later rounds; the new journal preserves it as `deferred` instead of
  deleting it. It never emits `multi_live_placed` for that failed path.
- On Start/strategy arm, active work owned by another table is parked as
  `deferred`. It does not block the current table but still blocks an exact
  duplicate on its original table/shoe/round. Other-table metadata cannot
  quarantine it.
- Restart no longer restores `placing`/`uncertain` as an active run blocker,
  matching the old ToolBet's process-local pending behavior. Such rows become
  `deferred`; no outcome or P&L is invented. The blocker
  `ACTIVE_PENDING_FOR_TABLE` applies only to genuinely active current-process
  work. Existing bet #52 was not directly edited during implementation.
- Focused journal/executor/lifecycle/UI/release coverage passes 86 tests. No
  casino page or physical-money click was used. Full discovery ran 244 tests:
  241 passed, 2 skipped and the pre-existing signed license-cache restore test
  remains the only failure.

## Strategy tabs fully replace legacy 1-1 / Bet×2 runtime — 2026-08-04

- The legacy `legacy_patterns` option is removed from the strategy catalogue,
  new-tab default and normalization fallback. Old saved IDs normalize to
  `follow_last`; already selected strategies such as `smart_prev` are unchanged.
- Ordinary history refresh no longer evaluates/logs 1-1 or Bet×2, and the base
  overlay payload no longer publishes their signal, matched/building state or
  catalogue. The legacy decision-shadow path is disabled by default.
- `AutoBettor` no longer falls back to a legacy pattern when the strategy-tab
  evaluator is missing. Simulation status and live authority come only from
  the selected tab's strategy; displayed side, stake and level come from that
  strategy decision and its tab-owned MoneyManager.
- Focused strategy/lifecycle/shadow coverage passes 33 tests and the complete
  v2 UI runtime group passes 25 tests. No browser casino session or physical
  click was used.

## vipbet root URL no longer triggers false room recovery — 2026-08-04

- The old and current recovery implementations were compared directly. Their
  `src/ae_sexy.py` files are byte-identical and the navigation/recovery logic in
  `main.py` differs only in v2 overlay installation, not room-exit detection.
- Runtime evidence showed `https://vipbet389.com/` still had room UI, C01
  identity, a healthy stream and advancing HTTP history while the URL-only
  phase shortcut reported `PHASE_WEB`. That false phase escalated to
  `_recover_session()`, which navigated the otherwise healthy room to `/casino`.
- `detect_ae_sexy_phase()` now treats an allowlisted `casino_iframe` root SPA as
  a possible game host and lets shell/room probes decide before returning
  `PHASE_WEB`. Unrelated web pages retain the fast WEB short-circuit.
- Two focused regressions and `compileall src main.py` pass. A controlled
  non-money browser soak is still required to confirm the observed casino DOM.

## Betting no longer reads account balance — 2026-08-04

- Physical execution now follows the older ToolBet contract: account balance
  is not read and does not participate in arm, intent, allocation or pre-click
  decisions. `read_account_balance()` and all execution call sites were removed.
- Multi-live still aggregates each tab's stake by Player/Banker and retains
  Tool/execution policy, pending, exact-round deduplication, durable journal,
  UI/countdown readiness and final pre-click guard behavior.
- Focused journal/live/lifecycle/risk coverage passes 44 tests. The full suite
  runs 235 tests: 232 pass, 2 skip and only the pre-existing signed
  license-cache test fails. No casino browser or physical click was used.

## Live mode is operator-owned — 2026-08-04

- Runtime UI/browser/license/strategy warnings no longer call
  `StrategyLifecycleService.demote_live()` and therefore never rewrite a Live
  tab to Simulation in SQLite. Only the operator's “Chỉ mô phỏng/test” checkbox
  changes the durable tab mode.
- A transient failed `is_game_ui_alive()` probe while a decision is armed now
  keeps the arm and polls again every 500 ms within the existing bounded
  betting-window watcher. It proceeds only after UI health recovers, so the
  change preserves the pre-click readiness checks without silently changing
  the requested mode.
- Focused live-policy/lifecycle coverage passes 23 tests; the journal-inclusive
  group passes 36 tests. The full suite runs 237 tests: 234 pass, 2 skip and
  only the pre-existing signed license-cache test fails. No casino browser or
  physical click was used.

## Run latch survives overlay reinstall — 2026-08-04

- `GameOverlay` now stores the operator `run_enabled` latch separately from
  `auto_bet` and includes it in every v2 snapshot, including payload-free
  install/reinstall snapshots after navigation, reload or DOM loss.
- `HistoryWatcher._handle_set_run_enabled()` is the only path that updates the
  overlay copy. Internal execution pauses can set `auto_bet=false` without
  changing the visible “Dừng chạy” state.
- The reproduced DOM-delete/reinstall path and focused live/UI coverage pass
  33 tests. The full suite runs 235 tests: 232 pass, 2 skip and only the
  pre-existing signed license-cache test fails. No browser casino session or
  physical click was used.

## Immediate operator-start arm — 2026-08-04

- A successful explicit Start with at least one enabled Live tab now evaluates
  the already-loaded table history immediately and arms the next round through
  `AutoBettor.arm_from_current_history()`; it no longer requires history length
  to increase once after Start.
- `operator-start` is an explicit allowed trigger source. The existing betting
  window watcher still waits for the current/next open window, and pending,
  exact-round deduplication, round metadata, journal and pre-click
  checks are unchanged.
- Empty history, a missing/closed page or an unknown table does not arm; runtime
  remains enabled and waits for table data. Focused lifecycle, decision and UI
  coverage passes 54 tests. See the newer run-latch section above for the
  latest complete-suite count. No casino browser or physical click was used.

## BaccaratChromeAgent2 strategy alignment — 2026-08-03

- `dual_schedule_hedge` now uses its reference-local `AiStatMini` behavior:
  longest suffix, majority successor, and reverse-last when successor counts tie.
- Online N-gram records the undecidable bit for a Tie/Push but leaves loss
  streak, safety hold and auto-decay unchanged, matching the C# early return.
- Top10 only adds the newly settled rightmost 10-result window once at least 50
  B/P results exist; its short-history seed remains available but does not grow.
- Added deterministic strategy vectors for SmartPrev, SmartPrevAdvanced,
  AI-Stat, State Transition, Run Length, KNN, Time-Sliced and Dual Schedule.
  The C# harness loads the current BaccaratChromeAgent2 Desktop assembly and
  invokes its private decision functions; Python/C# match side, stake, P&L,
  level, next stake and schedule position for all checked vectors.
- `scripts/verify_golden_vectors.ps1` passes all four C#/Python money and
  strategy checks. The focused Python group passes 56 tests (2 C# checks skip
  unless explicitly enabled). The full suite runs 231 tests: 228 pass, 2 skip,
  and the same pre-existing signed license-cache failure remains.

## Durable tab mode and sticky operator run latch — 2026-08-03

- Changing “Chỉ mô phỏng/test” now saves the selected tab mode immediately
  through `src/ui/bridge.js` to the SQLite-owned strategy workspace. Re-entering
  the table or reinstalling the overlay reloads that persisted `simulation` or
  `live` value; ordinary runtime snapshots do not reread SQLite.
- `HistoryWatcher._run_enabled` is the process-local operator run latch. Only an
  explicit Start/Stop command changes it. Internal preflight/config/license
  handling may pause `BettingSession.state.auto_bet`, but no longer turns the
  visible control back to “Bắt đầu chạy”.
- A process restart still starts stopped by design. While the same process is
  alive, the button remains “Dừng chạy” until the operator presses it.
- The focused lifecycle/store/UI/live-policy group passes 52 tests. No casino
  browser or physical chip click was used for this change. The full suite runs
  226 tests (224 pass, 1 skip, 1 pre-existing signed license-cache failure).

## KILL_SWITCH removed — 2026-08-03

- The current source no longer has a sentinel file or environment-variable
  KILL_SWITCH. `src/kill_switch.py`, the source/packaged ALLOW/STOP launchers,
  runtime/preflight/pilot checks and the workspace KILL status were removed to
  match the older ToolBet execution model requested by the operator.
- Start/live execution is still governed by `live_execution.mode`, Tool
  capability, active pending and exact-round duplicate protection, durable
  intent/allocation journaling and the bounded UI executor.
- Historical Phase 0–6 notes below that mention KILL_SWITCH describe the old
  implementation only and are superseded by this section.
- Focused live-policy/release/pilot/journal coverage passes 31 tests. The full
  suite runs 223 tests (221 pass, 1 skip, 1 pre-existing signed license-cache
  failure). No casino browser or physical click was used for this change.

## Multi-live waits for the betting window — 2026-08-03

- The one-shot `risk tổng hợp không an toàn` check in
  `AutoBettor._try_place_multi_live()` is now advisory. A transient closed UI,
  low countdown, shuffle/session signal or not-ready room probe is logged as
  `RISK_THAM_KHAO` and no longer cancels the allocation before the waiting
  executor runs.
- `wait_and_place_bet()` again owns the bounded wait for chips, the requested
  side zone and the betting window, matching the older single-bet flow.
- Independent physical-execution controls are unchanged except for the removed
  KILL_SWITCH: production/pilot mode, Tool capability and the real-bet guard are checked before
  intent and immediately before click; pending/exact-round journal checks also
  remain.
- Focused journal, live-policy, lifecycle and pilot-guard suites pass 33 tests.
  The full suite runs 224 tests with the same pre-existing signed license-cache
  restore failure (222 pass, 1 skip, 1 fail). No casino browser or physical
  click was used for this change.

## Session run/live policy and bounded pending recovery — 2026-08-03

- `run_enabled` remains process-local and starts `false`. Start with only
  enabled simulation tabs ignores live-only gates; Stop prevents new decisions
  and intents while authoritative collection/resolution continues.
- `live_execution.mode` now separates `disabled`, `pilot` and `production`.
  Pilot requires the finite small-stake lease. Production removes only that
  lease requirement; Tool/session capability, RiskDecision,
  exact-round duplicate, source/shuffle/UI/countdown, journal and final
  pre-click checks remain mandatory.
- Restart parks every confirmed `placed` bet as `deferred`, including virtual
  stake-zero records. `placing`/`uncertain` remains active until authoritative
  `gp-winner`/`road-info-round` proves the target round has closed/advanced;
  it then becomes `quarantined`, leaves in-memory pending and creates a new
  MoneyManager recovery epoch from the last settled snapshot without changing
  confirmed P&L or inventing an outcome.
- Deferred/quarantined rows are warnings rather than global blockers. The
  journal still rejects an exact `(table, game_shoe, game_round)` duplicate,
  including an old deferred row, but permits later rounds.
- Runtime snapshot/UI now expose live policy, preflight result,
  active/deferred/quarantined counts, stable blockers/warnings and enabled
  simulation/live tab counts.
- The active SQLite was inspected read-only after implementation: bet `id=27`
  remains present as `deferred`, `virtual`, stake 0 and `outcome=NULL`; it is
  not an active blocker and was not assigned a guessed result.
- Core policy/journal/money coverage passes 22 focused tests. The latest full
  suite runs 223 tests; the intended UI baseline was updated, while the known
  signed license-cache restore regression still prevents a clean full-suite
  PASS. One later combined focused run also observed the existing UI
  scroll/focus test fail once; that exact test passed immediately when rerun
  alone and had passed in the full run. No casino browser or physical-money
  execution was run.

## Run-toggle runtime refresh — 2026-08-03

- The v2 bridge synchronizes the run button's text, visual state and next action
  from the process-local operator `run_enabled` latch. Ordinary execution-state
  refreshes cannot clear that latch; only an explicit Stop command can.
- Browser regression coverage verifies a refresh from stopped to running and
  that the refreshed button dispatches the following stop action correctly.
- Focused UI tests and `compileall src` pass. The latest complete suite ran
  212 tests but has one unrelated failing license-cache restore test; do not
  record a full-suite pass until that regression is resolved.

## N/I strategies remain unavailable — 2026-08-03

- `sequence_major_minor` and `pattern_major_minor` remain hard `skip` and
  reject any request to enter live mode. Their B/P history is never used to
  infer an N/I input.
- Regression coverage now enforces both the strategy-decision and lifecycle
  paths for both IDs. Revisit only after the collector supplies trustworthy
  Banker/Player pool totals and an explicit N/I sequence.

## Cross-language golden vectors — 2026-08-03

- Added shared fixed vectors for all eight MoneyManagers. Each round records
  B/P/T result, selected bet side, stake, round/session P&L, next level, next
  chain and next stake.
- Python evaluates vectors through `ReferenceMoneyManager`; the standalone C#
  harness compiles the reference `MoneyManager.cs`/`MoneyHelper.cs` directly.
  Both match the checked-in expected observations.
- Run `scripts/verify_golden_vectors.ps1` to execute both implementations.

## Three missing B/P strategies — 2026-08-03

- Added `sequence_follow` (configured B/P cycle), `pattern_follow` (configured
  `lhs-rhs` pattern queue), and `random_side` to the workspace registry.
- A tab now persists `strategy_input` in SQLite. The workspace shows the
  relevant input for the two configurable strategies and saves it with the
  existing debounce flow. The additive migration preserves old databases.
- All three keep per-tab runtime state and advance only after that tab settles.

## Independent Ensemble / N-gram / Expert Panel ports — 2026-08-03

- `ensemble_majority`, `online_ngram`, and `expert_panel` no longer share the
  former reduced `_ensemble`/`_ngram` helpers. Each now owns an independent
  reference-derived decision and runtime model per strategy tab.
- Ensemble keeps five expert rolling-10 performance trackers and applies its
  weighted regime vote. Online N-gram warm-starts a 6-gram Laplace model then
  updates it only after settlement. Expert Panel keeps its own mock Top10 vote,
  guard, EWMA, beauty and default contrarian state.
- The new runtime is process-local. Unlike the C# application's AppData files,
  Online N-gram state is not persisted yet; it warm-starts from current table
  history at runtime creation.

## Top10 / Hot-back state machines — 2026-08-03

- `top10_pattern` and `parity_hotback` now keep their own runtime state for
  each strategy tab, instead of recalculating a stateless shortcut from every
  history snapshot. State starts again when the tab runtime resets and advances
  only after that tab's allocation settles.
- Top10 preserves its 50-result window counts, newest-tick tie-break, selected
  10-result pattern and cursor; it switches to a newly best pattern only after
  a win. Hot-back preserves its candidate set and five-result cursor, removes
  the inverse candidate, and resets the current pattern only on a loss.
- Focused regression tests cover the two state transitions and existing
  lifecycle/schedule tests. No browser or real-money session was run.

## Banker rounding and capital recovery reset — 2026-08-03

- Banker win P&L now rounds `stake × 0.95` to a whole chip with
  midpoint-away-from-zero rounding.
- Each tab has a SQLite-persisted, default-off “Reset vốn khi P&L ≥ 0” option.
  A negative-to-nonnegative recovery resets only the stake progression; session
  P&L and statistics stay intact.

## Schedule-strategy runtime counters — 2026-08-03

- `time_sliced_hedge` and `dual_schedule_hedge` now each keep a separate
  in-memory 0–9 counter per strategy tab. The counter starts at zero whenever
  a tab enters/leaves live mode or the process starts, and advances only after
  that tab's allocation is settled; it is no longer inferred from history.
- `dual_schedule_hedge` now follows its reference 10-round schedule exactly:
  follow 1–3, reverse 4, AI-stat 5–7, reverse 8, follow 9, AI-stat 10.
- Focused regression coverage passes for both schedules, independent tab
  counters, tie settlement in preview replay, and the existing lifecycle path.

## Phase 6 table-scoped deferred pending — 2026-08-03 (superseded above)

- Confirmed `placed` pending is no longer allowed to consume the next result
  from an unrelated table. On restart, or when a later result belongs to a
  different/mismatched server round, it is stored as `status=deferred` with an
  audit event and removed from in-memory betting/progression state.
- A deferred bet only resolves automatically from authoritative
  `gp-winner`/`road-info-round` metadata matching the exact table, game shoe
  and game round. DOM/canvas/lobby history and a merely newer result cannot
  resolve it. The later bounded-recovery patch above replaces the former
  permanent global lock for stale `placing`/`uncertain` rows.
- Deferred records remain visible to the manual reconciliation workflow but no
  longer block pilot preflight or an unrelated live table. Bet 27 has since
  transitioned to `deferred`; it still has no outcome.
- Full source suite passes **184 tests**. No release build was made for this
  source-only change; it will be used by `ToolBet.bat` on the next start.

## Phase 5 finite small-stake canary — 2026-08-03

- In `live_execution.mode=pilot`, real execution requires a local
  `SMALL_STAKE_PILOT.json` lease in addition to the existing kill-switch,
  license, UI and round gates. The newer production policy described
  above removes only this lease requirement.
  The lease binds one exact live `tab_id`, SQLite path, expiry, aggregate
  per-round stake cap, maximum real-bet count, stop-loss and baseline bet id.
- `AutoBettor` checks the lease and authoritative SQLite state before creating
  an intent and again immediately before each physical click. Missing, expired
  or changed lease/tab/stake/pending state blocks that physical execution; the
  later operator-owned mode rule above prevents automatic demotion. Tie nurture
  is deliberately excluded from the first canary.
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
  shuffle/source and UI/countdown. Account balance is deliberately not read or
  used as a gate. Unsafe browser/page/UI/license states wait, recover or reject the
  current click; they do not rewrite the tab's durable Live/Simulation mode.
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

## Bet history pagination — 2026-08-03

- Renamed the workspace card to “Lịch sử cược”. History is read newest-first
  from SQLite with bounded 10/20/50-row `LIMIT/OFFSET` pages; page 1 is newest.
- The chosen page size is stored in browser localStorage, avoiding database
  writes for a display-only preference.

## Workspace scroll on first mount — 2026-08-03

- A newly created control-panel DOM starts at the top, including one animation
  frame after its first layout so browser scroll restoration cannot leave it in
  the middle. Reinstalling an existing panel and ordinary runtime updates keep
  the current scroll position.

## MultiChain multiline stake editor — 2026-08-03

- The `MultiChain` MoneyManager now uses a multiline stake editor: each line
  is one independent chain and persists as one `stake_chains` entry. Existing
  semicolon-separated values remain accepted for backward compatibility.
- It uses the same one-line visual height as the other text boxes; additional
  chains remain editable through the textarea without a resize grip. The
  MultiChain label uses explicit Unicode text to avoid mojibake.

## Run control wording and visibility — 2026-08-03

- The visible control is now “Bắt đầu chạy”/“Dừng chạy” and remains visible
  when “Chỉ mô phỏng/test” is checked. That checkbox only controls whether the
  tab is simulation or live; production authorization and runtime safety gates
  remain independent and cannot change the checkbox automatically.

## Workspace height — 2026-08-03

- The desktop workspace keeps equal 10px top and bottom margins instead of
  being capped at 900px.

## Session run state and Tool authorization — 2026-08-03

- `Bắt đầu chạy`/`Dừng chạy` now controls an in-memory `run_enabled` state.
  It always starts false after a process restart and is never written back to
  `config.yaml`; `auto_bet` is the derived internal execution switch.
- A valid Tool session authorizes use of both simulation and live tabs; there
  is no separate `live_bet` license-capability check in the UI run command.
  Pending/duplicate-round protections, table checks, and
  the configured real-bet guard remain independent safeguards.
