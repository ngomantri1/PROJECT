# ARCHITECTURE.md

# High-Level Architecture

```text
React/Vite UI
    ↓ REST polling/fetch
Django REST API
    ↓
Django ORM ───────────────→ PostgreSQL
    ↓ create task
Celery Worker ← Redis Broker/Result Backend
    ↓
ScanOrchestrator
    ↓
CoinGecko + Binance public REST APIs

Celery Beat
    ↓ mỗi 60 giây
Schedule Dispatcher
    ↓
Celery Worker
```

Hệ thống hiện là một monorepo nhỏ gồm frontend React và backend Django. Không có service Selenium, WebSocket, OCR hoặc Nginx production trong source hiện tại.

# Project Structure

```text
frontend/
  src/App.tsx          UI, routes, dashboard, settings
  src/api.ts           REST client
  src/types.ts         TypeScript data contracts
  src/styles.css       CSS toàn app

backend/
  config/              Django/Celery bootstrap
  scanner/             Domain app duy nhất
    models.py          ORM schema
    services.py        HTTP clients và calculations
    orchestrator.py    Pipeline sáu bước
    tasks.py           Celery tasks/scheduler
    views.py           REST endpoints
    serializers.py     DRF serialization/validation
    migrations/        Initial schema
  rules/v8_1/
    defaults.json      Default profile/rules

docs/
  specification/       Nguồn nghiệp vụ V8.1
  design/              Ảnh UI đã duyệt
```

# Module Ownership

- `backend/scanner`: owns profiles, schedules, scan runs, candidates, notifications, REST serialization, Celery dispatch, and the implemented scan rules.
- `backend/config`: owns Django/Celery composition and environment-based runtime settings.
- `backend/rules/v8_1/defaults.json`: owns the immutable default-rule data; it is loaded into profiles by `seed_v81`.
- `frontend/src`: owns presentation and API polling only; it is not the authority for a business decision.
- `docs/specification`: owns the confirmed V8.1 product specification. It is broader than the currently implemented baseline.

# Dependency Flow

## Backend request flow

```text
URL
→ DRF View/ViewSet
→ Serializer validation
→ Django Model
→ PostgreSQL
```

## Scan flow

```text
Dashboard/Start API
→ create_scan_run()
→ ScanRun + six ScanStepRun records
→ run_scan.delay()
→ ScanOrchestrator.execute()
→ step handlers
→ PublicMarketClient
→ external APIs
→ Candidate/Run/Step persistence
→ dashboard polling response
```

## Configuration flow

```text
Settings UI
→ Profile API
→ ChecklistProfileSerializer
→ ChecklistProfile.config JSON
→ profile checksum/version
→ ScanRun.profile_snapshot at scan start
```

# Data Flow

## Universe data

1. `PublicMarketClient.coingecko_markets()` lấy Top N theo cấu hình.
2. `PublicMarketClient.binance_exchange_info()` lấy pair Binance.
3. `valid_binance_usdt_symbols()` tạo map base asset → symbol info.
4. `excluded_token()` và MC/volume filters loại candidate.
5. `provisional_quality()` tạo Quality Range proxy.
6. Candidate được bulk insert với `stage=RESEARCH_POOL`.
7. Counters được ghi vào `ScanRun.counters` làm Universe Accounting sơ bộ.

## Market regime data

1. Lấy BTC/ETH `1d` và `4h` klines.
2. `kline_summary()` tính SMA/ATR.
3. Đếm bốn điều kiện `above_sma20`.
4. Gán regime và lưu vào `ScanRun.results.market_regime`.

## Execution data

1. Lấy tối đa `execution_verification_count` coin đầu shortlist.
2. Lấy Binance depth và D1/4H.
3. Tính spread/depth/slippage và kline summary.
4. Lưu trong `Candidate.details.execution`.
5. Unlock, stop và RR được lưu `UNKNOWN`/`None`; Entry không được chấm.

## Output data

- `step_scoring_validation()` đặt `buy_setup=0` và `capital_plan.usdt_pct=100`.
- `step_investment_results()` tạo ranking tối đa 15 coin trong `ScanRun.results`.
- Frontend đọc `ScanRunSerializer` và hiển thị table.

# Important Runtime Flows

## 1. Full Scan

Source:
- `backend/scanner/views.py` — `ScanRunViewSet.start()`
- `backend/scanner/tasks.py` — `create_scan_run()`, `run_scan()`
- `backend/scanner/orchestrator.py` — `ScanOrchestrator.execute()`

Flow:

1. API kiểm tra không có run `QUEUED/RUNNING`.
2. Chọn active profile hoặc `profile_id` được gửi lên.
3. Tạo config snapshot.
4. Tạo sáu Step Run với policy lấy từ `StepSchedule`.
5. Celery xử lý tuần tự.
6. Bất kỳ exception nào làm cả run `FAILED` và task re-raise.
7. Khi hoàn tất, tạo notification success/warning.

## 2. Run Single Step

Frontend gọi `startScan(profileId, [step_key])`.

`create_scan_run()` tìm sequence lớn nhất trong request và thêm tất cả bước tiên quyết từ bước 1 đến bước đó. Vì vậy “chạy riêng” không thực sự bỏ qua prerequisite.

## 3. Scheduled Step

Source:
- `backend/config/settings.py` — `CELERY_BEAT_SCHEDULE`
- `backend/scanner/tasks.py` — `dispatch_due_schedules()`

Flow:

1. Beat gọi dispatcher mỗi phút.
2. Query schedule active có `next_run_at <= now` và profile active.
3. Nếu không có run cùng step đang queued/running, tạo Scan Run.
4. `next_run_at` được tăng theo `interval_minutes`.
5. Requested step vẫn được mở rộng thêm prerequisite.

## 4. Frontend Update Flow

Source: `frontend/src/App.tsx` — `Dashboard.load()`.

- Frontend polling dashboard mỗi 4 giây.
- Không có push realtime.
- `latest_run` là `ScanRun.objects.first()` theo ordering `-created_at`; `latest_successful_run` là run gần nhất có status `COMPLETED` hoặc `COMPLETED_WITH_WARNINGS`.
- UI lấy tiến trình lỗi/đang chạy từ `latest_run`. Khi latest run fail, UI chỉ dùng `latest_successful_run` dưới nhãn kết quả thành công gần nhất, không thay thế dữ liệu của run mới.

## 5. Profile Update Flow

- Default profile: serializer từ chối thay `config` hoặc `name`.
- Custom profile: `perform_update()` tăng version và cập nhật checksum.
- Clone copy config và schedule.
- Activate dùng transaction để tắt tất cả profile rồi bật một profile.
- Scan Run dùng snapshot nên thay profile sau khi chạy không đổi config của run đang tồn tại.

# Authentication/Authorization Flow

- `backend/config/settings.py` configures DRF `AllowAny`; the API has no authentication or ownership/data-scope enforcement in this baseline.
- The Django admin route is mounted at `/admin/`, but no product-facing authentication flow is implemented.
- This is a local-baseline fact and a production security risk, not evidence that production exposure is supported.

# API / Event Flow

- Root API prefix: `/api/` (`backend/config/urls.py`).
- Read endpoints: `GET /api/health/`, `GET /api/dashboard/`, DRF list/detail for `/api/profiles/` and `/api/scan-runs/`.
- Mutation endpoints: profile viewset actions `clone`, `activate`, `reset_default`; `POST /api/scan-runs/start/`; `POST /api/scan-runs/{id}/cancel/`; `PATCH /api/step-schedules/{id}/`.
- There is no WebSocket or SSE. `Dashboard.load()` polls the dashboard API every four seconds.

# Persistence / Migration / Snapshot Flow

- `backend/scanner/migrations/0001_initial.py` is the only migration and creates all current application tables and Candidate indexes.
- Docker uses PostgreSQL when `DB_HOST` is set; otherwise Django falls back to SQLite (`backend/config/settings.py`).
- `ScanRun.profile_snapshot` is copied at creation; candidates, counters, results, validation, and step payloads remain attached to that run.
- `Candidate.objects.filter(scan_run=self.run).delete()` rebuilds candidates only for the currently executing run's Universe step.

# Key Files / Classes

`backend/scanner/models.py`
- `ChecklistProfile`: profile JSON và lifecycle cơ bản.
- `StepSchedule`: policy/lịch từng step.
- `ScanRun`: aggregate root của một lần scan.
- `ScanStepRun`: progress/status từng step.
- `Candidate`: coin state và kết quả.
- `Notification`: feed UI.

`backend/scanner/services.py`
- `PublicMarketClient._get()`: synchronous public HTTP fetch.
- `PublicMarketClient.coingecko_markets()`.
- `PublicMarketClient.binance_exchange_info()`.
- `PublicMarketClient.binance_klines()`.
- `PublicMarketClient.binance_depth()`.
- `valid_binance_usdt_symbols()`.
- `excluded_token()`.
- `kline_summary()`.
- `depth_metrics()`.
- `provisional_quality()`.

`backend/scanner/orchestrator.py`
- `ScanOrchestrator.execute()`.
- `_run_step()`.
- `step_universe_scan()`.
- `step_market_regime()`.
- `step_research_shortlist()`.
- `step_execution_verification()`.
- `step_scoring_validation()`.
- `step_investment_results()`.
- `_validation_gate()`.

`backend/scanner/tasks.py`
- `run_scan()`.
- `dispatch_due_schedules()`.
- `create_scan_run()`.

`backend/scanner/views.py`
- `dashboard()`.
- `ChecklistProfileViewSet.clone()`.
- `ChecklistProfileViewSet.activate()`.
- `ChecklistProfileViewSet.reset_default()`.
- `ScanRunViewSet.start()`.
- `ScanRunViewSet.cancel()`.
- `update_step_schedule()`.

`backend/scanner/market_regime.py` owns pure Market Regime v1 calculations. Step 2 fetches BTC/ETH/ETHBTC/global evidence and bounded D1 batches for the current research pool, then persists the same payload in `ScanStepRun.payload` and `ScanRun.results["market_regime"]`. The frontend renders the payload without recomputing business rules.

`frontend/src/App.tsx`
- `Shell()`.
- `Dashboard()`.
- `StepCard()`.
- `CandidateTable()`.
- `StartModal()`.
- `Settings()`.

# Architectural Constraints

- Database là nơi sở hữu trạng thái run/step/candidate; frontend không giữ source of truth lâu dài.
- Worker hiện xử lý synchronous HTTP trong Celery process; không chuyển network loop vào Django request.
- `profile_snapshot` không được mutate sau khi run bắt đầu.
- Step keys và status string là contract giữa backend/frontend; đổi phải migration dữ liệu và cập nhật TypeScript.
- Default rules nằm trong JSON, nhưng một số logic vẫn hard-code trong Python; thay config không đảm bảo mọi rule đã được áp dụng.
- Celery task không có checkpoint/pause check trong loop hiện tại.
- `total_scan_policy` được persist và hiển thị nhưng chưa điều khiển cache/freshness trong orchestrator.
- UI routes ngoài `/` và `/settings` hiện trỏ đến `ComingSoon`.
- REST API hiện `AllowAny`; không giả định production security đã hoàn thành.
