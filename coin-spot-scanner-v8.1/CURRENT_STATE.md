# CURRENT_STATE.md

# Current Project State

- Release declared in `VERSION.json`: `0.1.0-baseline`; status: `RUNNABLE_FOUNDATION`.
- Project root for this context is `D:\PROJECT\coin-spot-scanner-v8.1` (contains `AGENTS.md`). The enclosing Git worktree root is `D:\PROJECT`; this project directory is currently untracked there. Do not treat unrelated changes under `D:\PROJECT` as this project's changes.
- Implemented baseline: React/Vite frontend, Django REST API, PostgreSQL-or-SQLite persistence, Redis/Celery scheduling, CoinGecko/Binance public-data clients, and a six-step scan pipeline.
- Runtime evidence (2026-08-08): normal full run `e1015994-a1ba-4750-8162-d861b6d9196b` completed B1-B6 with `COMPLETED_WITH_WARNINGS`, `RESEARCH_EVIDENCE_PRIORITY`, research shortlist count 15 and `BUY_SETUP=0`; DefiLlama was not degraded.
- Runtime evidence (2026-08-08): forced provider-failure run `e6d8fa5e-6b99-49dc-acd9-ac575b59fc15` kept B3 `COMPLETED_WITH_WARNINGS`, used `PREFILTER_ONLY_FALLBACK`, recorded five unavailable DefiLlama sources, preserved a 224-character message, continued B4-B6 and ended `COMPLETED_WITH_WARNINGS`.
- Verification (2026-08-08): Docker build/recreate, migration check, Django check, 49 Django tests, backend `compileall`, frontend typecheck/build and `git diff --check` passed. The build emitted only the existing Vite large-chunk warning.
- Integrity posture: full and partial lifecycle statuses are explicit; `buy_setup=0` and 100% USDT remain enforced when critical evidence is missing. Research selection uses Evidence Priority when available and safe prefilter fallback on provider gaps. No numeric V8.1 Quality Score is fabricated.

# Current Work

- Pipeline Status Integrity and Research Provider Fallback V1.1 are implemented and runtime/test-verified. Remaining work is evidence coverage and full Quality/Entry engines, not the resolved lifecycle/message bugs.

- Unlock Data Provider V4: P0 propagation/precedence is enforced; OfficialSchedule persistence, Django Admin, JSON import command, coverage validation, cliff/linear calculation and provider snapshot cache are present. Optional paid/web providers remain disabled without verified contracts or credentials.
- Runtime verification fixtures now cover complete official schedule PASS and insufficient 90D coverage UNKNOWN; no production unlock schedule is seeded.
- Public web unlock crawler phases 1-11 are implemented as a conservative optional provider: explicit HTML table/embedded JSON parsing, CoinGecko-page link discovery, 90D horizon gate, cache, reconciliation path, Celery crawl task and queue wiring. Enable with `UNLOCK_WEB_CRAWL_ENABLED=true`; explicit `unlock_urls` are preferred, otherwise only keyword-matched public links are discovered. No anti-bot bypass and no production schedule is fabricated.

- Execution Verification integrity update (2026-08-08): Universe exclusions now reject tokenized-stock, bridged, LST and index candidates before the research pool. Step 4 uses only closed D1/4H candles with explicit freshness, applies configured spread/slippage limits, and persists structured per-coin blockers. Unlock, stop and RR remain `UNKNOWN`/`NOT_SCORED`, so this update does not permit `BUY_SETUP`.

Market Regime v1 đã được triển khai trong source hiện tại: step 2 tạo payload evidence 9 nhóm, completeness động, bounded request retry và UI panel chi tiết. Runtime full scan gần nhất xác nhận `TRUNG TÍNH`, `PROVISIONAL`, `6/9 PASS`; đây là trạng thái của run cụ thể, không phải invariant cố định. Chưa có bằng chứng runtime cho `FINAL`.

Gói context tư vấn được xuất thành `COIN_SPOT_SCANNER_V8_1_STEP2_CONSULTATION_20260808.zip` và có bản tóm tắt tại `STEP_2_MARKET_REGIME_CONSULTATION.md`. Đây là artifact hỗ trợ tư vấn, không phải source of truth thay thế repository.

# Recently Changed

No commit history or project-local change record is available to establish a reliable recent-change list. The entries below are current source facts, not a changelog:

- `ScanRun`, `ScanStepRun`, `Candidate`, profile, schedule, and notification models exist in the initial migration.
- The orchestrator implements the six named steps and persists per-run snapshots/results.
- The dashboard and Settings route exist; dashboard keeps the latest failed run separate from the latest successful result and several navigation targets remain placeholders.
- Market Regime evidence coverage remains incomplete by design: BTC Dominance/TOTAL3 lack verified history and Macro/Event Risk has no configured provider/manual evidence.

# Active Areas

- `backend/scanner/orchestrator.py`: scan pipeline and validation gate.
- `backend/scanner/market_regime.py`: pure calculations, closed-candle validation and 9-group evidence.
- `backend/scanner/services.py`: public market clients, market calculations and the non-Quality `research_prefilter()` used only to prioritize deeper research.
- `backend/scanner/tasks.py`: Celery task dispatch and scan-run construction.
- `backend/rules/v8_1/defaults.json`: locked V8.1 configuration.
- `frontend/src/App.tsx`: current UI shell, dashboard, modal, and settings.
- `frontend/src/types.ts` and `frontend/src/styles.css`: Market Regime payload contract and responsive evidence panel.

# Current Known Problems

- Research Product/Usage evidence v1 now enriches candidates from DefiLlama public protocol/chain/fees/DEX datasets and Binance 24H quote volume. Coverage is sector-dependent and secondary-source only, so full Product rubric, Token Value Capture, full X2/X3 valuation, moat/team/catalyst, technical entry calculation and full report output remain incomplete; Quality stays `NOT_SCORED`.
- Cancellation, schedule update behavior, and some exclusions have confirmed gaps; pause remains unavailable and is explicitly disabled in the UI; see `BUGS.md`.
- The prior worker queue-routing failure is fixed and runtime-verified; see `BUGS.md`.
- The parent Git worktree arrangement can obscure project-local status; see the first state item above.

# Next Actions

1. Add approved historical adapters for BTC Dominance, TOTAL3/proxy and Macro/Event Risk, with source/timestamp/freshness evidence.
2. Add retry/provider fixtures and full orchestrator persistence/integration coverage.
3. Address confirmed lifecycle and UI bugs without weakening V8.1 integrity gates.
4. Keep unlock, execution calculations and final scoring blocked until critical evidence is available.

# Files For Next Session

1. `AGENTS.md`
2. `BUSINESS_RULES.md`
3. `BUGS.md`
4. `TODO.md`
5. `backend/scanner/orchestrator.py`
6. `backend/scanner/services.py`
7. `backend/scanner/tasks.py`
8. `backend/rules/v8_1/defaults.json`
9. `docs/specification/README_V8_1.md`
