# CURRENT_STATE.md

# Current Project State

- Release declared in `VERSION.json`: `0.1.0-baseline`; status: `RUNNABLE_FOUNDATION`.
- Project root for this context is `D:\PROJECT\coin-spot-scanner-v8.1` (contains `AGENTS.md`). The enclosing Git worktree root is `D:\PROJECT`; this project directory is currently untracked there. Do not treat unrelated changes under `D:\PROJECT` as this project's changes.
- Implemented baseline: React/Vite frontend, Django REST API, PostgreSQL-or-SQLite persistence, Redis/Celery scheduling, CoinGecko/Binance public-data clients, and a six-step scan pipeline.
- Runtime/build evidence: not verified in this documentation pass. No build, test, Docker command, external API call, or database mutation was run.
- Integrity posture: the current pipeline forces `buy_setup=0`, `WATCH_ONLY`, and `FULL_SCAN_RESEARCH`; it does not produce a `BUY_SETUP`.

# Current Work

No active work item is evidenced inside this project. The parent worktree has unrelated modified and untracked paths; preserve them. `docs/PHASE_STATUS.md` lists the next implementation areas.

# Recently Changed

No commit history or project-local change record is available to establish a reliable recent-change list. The entries below are current source facts, not a changelog:

- `ScanRun`, `ScanStepRun`, `Candidate`, profile, schedule, and notification models exist in the initial migration.
- The orchestrator implements the six named steps and persists per-run snapshots/results.
- The dashboard and Settings route exist; several navigation targets remain placeholders.

# Active Areas

- `backend/scanner/orchestrator.py`: scan pipeline and validation gate.
- `backend/scanner/services.py`: public market clients and baseline calculations.
- `backend/scanner/tasks.py`: Celery task dispatch and scan-run construction.
- `backend/rules/v8_1/defaults.json`: locked V8.1 configuration.
- `frontend/src/App.tsx`: current UI shell, dashboard, modal, and settings.

# Current Known Problems

- Unlock/product/token-value evidence, complete technical entry calculation, and full report output are absent; see `TODO.md`.
- Cancellation, pause, UI actions, schedule update behavior, and some exclusions have confirmed gaps; see `BUGS.md`.
- The parent Git worktree arrangement can obscure project-local status; see the first state item above.

# Next Actions

1. Address confirmed lifecycle and UI bugs without weakening V8.1 integrity gates.
2. Add evidence adapters and persistence before enabling final Quality/Entry/Opportunity scoring.
3. Implement freshness/policy invalidation and complete execution calculations.
4. Add focused tests, then verify Docker/runtime and frontend build.

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
