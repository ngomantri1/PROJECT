# PROJECT_CONTEXT.md

# Project Overview

## Mục đích

`COIN SPOT SCANNER V8.1 — EXECUTION INTEGRITY` là ứng dụng web hỗ trợ nghiên cứu altcoin Spot. Hệ thống lấy dữ liệu thị trường công khai, chạy quy trình sáu bước, lưu candidate và chỉ đưa ra trạng thái đầu tư khi dữ liệu đáp ứng rule engine.

Bản hiện tại là `0.1.0-baseline`, được mô tả trong `VERSION.json` là `RUNNABLE_FOUNDATION`. Source hiện chủ động hạ kết quả xuống `FULL_SCAN_RESEARCH` và giữ `100% USDT` vì unlock, product evidence, stop và RR chưa hoàn chỉnh.

## Người dùng chính

- Người dùng cá nhân chạy scanner trên máy local bằng Docker.
- Quản trị viên cấu hình checklist qua giao diện và Django Admin.
- Lập trình viên/AI coding tiếp tục hoàn thiện các adapter, rule engine và UI.

## Chức năng chính hiện có

- Dashboard sáu bước và nút chạy toàn bộ.
- Chạy riêng một bước; backend tự thêm các bước tiên quyết.
- Scheduler theo từng bước bằng Celery Beat.
- Cấu hình V8.1 mặc định và clone profile tùy chỉnh.
- Universe Scan từ CoinGecko + kiểm tra Binance Spot/USDT.
- Market Regime sơ bộ từ BTC/ETH D1/4H và CoinGecko Global.
- Research Shortlist sơ bộ.
- Execution Verification cơ bản bằng Binance depth và kline.
- Integrity Gate ép `BUY_SETUP = 0` khi dữ liệu critical thiếu.
- Lưu Scan Run, Step Run, Candidate và Notification.

# Technology Stack

## Frontend

- TypeScript.
- React `19.2.0`.
- React DOM `19.2.0`.
- Vite `8.1.0`.
- Ant Design `6.5.2`.
- React Router DOM `^7.8.0`.
- Fetch API trong `frontend/src/api.ts`.

## Backend

- Python 3.12 image.
- Django `5.2.17`.
- Django REST Framework.
- django-cors-headers.
- Celery `5.6.3`.
- Redis.
- `httpx` cho HTTP client.
- Gunicorn.

## Data/Runtime

- PostgreSQL 17 Alpine trong Docker.
- SQLite fallback khi `DB_HOST` không được cấu hình.
- Redis 7 Alpine cho broker/result backend.
- Docker Compose gồm `postgres`, `redis`, `backend`, `celery`, `celery-beat`, `frontend`.

# Main Business Flow

1. Backend startup chạy migration và `seed_v81`.
2. `seed_v81` tạo profile V8.1 mặc định và sáu `StepSchedule`.
3. Frontend gọi `GET /api/dashboard/` mỗi 4 giây.
4. Người dùng bấm chạy toàn bộ hoặc chạy một bước.
5. `POST /api/scan-runs/start/` tạo `ScanRun`, chụp `profile.config` vào `profile_snapshot` và tạo sáu `ScanStepRun`.
6. Celery task `scanner.tasks.run_scan` gọi `ScanOrchestrator.execute()`.
7. Orchestrator chạy tuần tự các handler từ Universe đến Investment Results.
8. Kết quả được lưu trong PostgreSQL và frontend hiển thị qua polling.
9. Validation Gate luôn trả mode `FULL_SCAN_RESEARCH` trong baseline hiện tại.

# Stable Domain Decisions

- The product is a research and screening tool; it does not place trades.
- A `BUY_SETUP` is prohibited until all critical execution data is present and no Hard Rule blocks it.
- A scan run captures a profile snapshot so later profile changes do not rewrite historical run inputs.
- Quality, Entry, and Opportunity scores are separate concepts; the baseline currently exposes only a provisional Quality range.

# Important Components

## Backend

`backend/scanner/models.py`
- `ChecklistProfile`: hồ sơ cấu hình, JSON config, version và checksum.
- `StepSchedule`: lịch và policy của từng bước.
- `ScanRun`: trạng thái một lần quét và profile snapshot.
- `ScanStepRun`: trạng thái từng bước.
- `Candidate`: dữ liệu coin, score status, action, risk codes và details.
- `Notification`: thông báo trong ứng dụng.

`backend/scanner/services.py`
- `PublicMarketClient`: CoinGecko/Binance REST client.
- `valid_binance_usdt_symbols()`: lọc pair Binance đang `TRADING` và có Spot permission.
- `excluded_token()`: loại stablecoin, wrapped token và leveraged token theo logic hiện tại.
- `kline_summary()`: SMA20/50/200 và ATR14.
- `depth_metrics()`: spread, depth và slippage mua.
- `provisional_quality()`: Quality Range proxy của baseline.

`backend/scanner/orchestrator.py`
- `ScanOrchestrator.execute()`: chạy sáu bước tuần tự.
- `step_universe_scan()` đến `step_investment_results()`: implementation của pipeline.
- `_validation_gate()`: hạ mode và ngăn BUY_SETUP.

`backend/scanner/tasks.py`
- `run_scan`: Celery task chạy orchestrator.
- `dispatch_due_schedules`: task mỗi phút tìm schedule đến hạn.
- `create_scan_run()`: chụp cấu hình và tạo Step Run.

`backend/scanner/views.py`
- API dashboard, profile, start/cancel scan và update schedule.

## Frontend

`frontend/src/App.tsx`
- `Shell`: layout, sidebar và routes.
- `Dashboard`: polling, chạy scan, pipeline, table và notification.
- `StepCard`: schedule/policy của từng bước.
- `StartModal`: modal chạy toàn bộ.
- `Settings`: chỉnh Universe & Market Cap cho profile custom.

`frontend/src/api.ts`
- Wrapper API dùng `fetch`.

`frontend/src/types.ts`
- Shared frontend types cho profile, run, step và candidate.

# Coding Conventions

## Python

- Class: `PascalCase`.
- Function/field: `snake_case`.
- Status và step key: uppercase string constants.
- JSONField dùng cho config, counters, results, validation và details.
- External HTTP errors được chuẩn hóa thành `DataSourceError`.
- Orchestrator ghi trạng thái step/run trước và sau khi xử lý.

## Frontend

- Function component React.
- TypeScript types tập trung trong `frontend/src/types.ts`.
- API tập trung trong `frontend/src/api.ts`.
- Ant Design là UI framework chính.
- Dashboard polling `GET /api/dashboard/` mỗi 4 giây; chưa có realtime socket.

## Error Handling/Logging

- Backend worker bắt exception, ghi `FAILED`, `error_message` và tạo `Notification`.
- Frontend hiển thị lỗi bằng `message.error()`.
- Chưa có structured logging hoặc bảng job log riêng.

# Important Technical Rules

- `ScanRun.profile_snapshot` là nguồn config cố định cho run.
- Một request chạy một bước được mở rộng thành tất cả bước tiên quyết đến bước đó.
- Endpoint start từ chối nếu đang có run `QUEUED` hoặc `RUNNING`.
- Default profile bị khóa ở serializer; phải clone trước khi sửa.
- Quality hiện là `RANGE`, Entry/Opportunity là `NOT_SCORED` khi critical data thiếu.
- Baseline không được sinh BUY_SETUP; `_validation_gate()` kiểm tra điều này.
- Không được mô tả policy cache/freshness là đã hoạt động đầy đủ: model/UI có policy nhưng orchestrator hiện luôn thực thi handler.

# External Integration

## CoinGecko

- `/coins/markets`: universe, price, MC, FDV và volume.
- `/global`: BTC dominance và global data.

## Binance

- `/api/v3/exchangeInfo`: pair đang giao dịch.
- `/api/v3/klines`: D1/4H.
- `/api/v3/depth`: orderbook snapshot.

## Database

- PostgreSQL trong Docker; dữ liệu lưu qua Django ORM.

## Background Tasks

- Celery worker queue: `default,fast,crawl` nhưng hiện tất cả task dùng decorator mặc định.
- Celery Beat gọi `dispatch_due_schedules` mỗi 60 giây.

## Browser/OCR/WebSocket

- Source hiện chưa có Selenium, ChromeDriver, OCR, canvas automation hoặc WebSocket/SSE.

# Important Paths

- `README.md`: cách chạy và giới hạn bản hiện tại.
- `VERSION.json`: release/status hiện tại.
- `docker-compose.yml`: runtime services.
- `.env.example`: biến môi trường.
- `backend/config/settings.py`: Django/Celery/external source config.
- `backend/rules/v8_1/defaults.json`: thông số mặc định và locked rules.
- `backend/scanner/models.py`: database model.
- `backend/scanner/orchestrator.py`: pipeline chính.
- `backend/scanner/services.py`: collectors và phép tính nền tảng.
- `backend/scanner/tasks.py`: Celery orchestration/schedule.
- `backend/scanner/views.py`: REST API.
- `frontend/src/App.tsx`: UI hiện tại.
- `docs/specification/`: sáu tài liệu nghiệp vụ V8.1.
- `docs/PHASE_STATUS.md`: phạm vi đã hoàn thành và giai đoạn tiếp theo.
