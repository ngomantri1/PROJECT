# TODO.md

## Market Regime v1 follow-up

- Add approved historical adapters for BTC dominance, TOTAL3/proxy and macro event risk before marking those groups PASS.
- Add fixture coverage for provider rate-limit retry and full orchestrator payload persistence.

Chỉ các mục có bằng chứng từ source, README, `docs/PHASE_STATUS.md` hoặc UI hiện tại được ghi là **Confirmed TODO**.

# High Priority

## Confirmed TODO — Unlock multi-source collector

- Xây adapter unlock 7D/30D/90D, conflict handling và Selenium worker khi cần JavaScript.
- Hiện `step_execution_verification()` hard-code unlock `UNKNOWN`.
- Liên quan: `backend/scanner/orchestrator.py`, `backend/scanner/services.py`.
- Status: Pending.

## Confirmed TODO — Product metrics và Token Value Capture

- Tạo adapter theo ngành và evidence engine; hiện Quality chỉ là proxy MC/volume/FDV.
- Liên quan: `backend/scanner/services.py` — `provisional_quality()`.
- Status: Pending.

## Confirmed TODO — Technical execution engine

- Implement setup, entry, stop, TP, RR, relative strength/volume và Overhead Supply.
- Hiện stop/RR là `None`, Entry là `NOT_SCORED`.
- Liên quan: `backend/scanner/orchestrator.py` — `step_execution_verification()`, `step_scoring_validation()`.
- Status: Pending.

## Confirmed TODO — Total-scan policy enforcement

- Implement cache/freshness cho `ALWAYS_REFRESH`, `REFRESH_IF_STALE`, `USE_LATEST_VALID`.
- Implement dependency invalidation/`STALE` khi đầu vào đổi.
- Hiện model/UI lưu policy nhưng orchestrator không nhánh theo policy.
- Liên quan: `StepSchedule`, `ScanStepRun`, `ScanOrchestrator._run_step()`.
- Status: Pending.

## Confirmed TODO — Worker lifecycle

- Implement pause/resume, revoke/cooperative cancel, checkpoint và queue behavior.
- UI/model có trạng thái PAUSED/CANCELLED nhưng worker không kiểm tra trạng thái giữa các bước.
- Liên quan: `backend/scanner/tasks.py`, `backend/scanner/orchestrator.py`, `frontend/src/App.tsx`.
- Status: Pending.

# In Progress

Không có marker hoặc git metadata xác nhận một hạng mục cụ thể đang được triển khai dở tại thời điểm tạo tài liệu.

# Pending

## Confirmed TODO — Complete Risk Register

- Hiện Candidate chỉ có `risk_codes` JSON; chưa có model trạng thái/severity/history/clear condition.
- Nguồn: `docs/PHASE_STATUS.md`.

## Confirmed TODO — Full report output

- Xuất đầy đủ theo `docs/specification/03_OUTPUT_V8_1.md`, gồm HTML/JSON/CSV/PDF.
- Hiện output chỉ là ranking JSON và executive decision ngắn.
- Nguồn: `docs/PHASE_STATUS.md`, `step_investment_results()`.

## Confirmed TODO — Complete settings profile features

Các nút hiện có UI nhưng chưa nối hành vi đầy đủ:

- `Lưu thành cấu hình mới`.
- `So sánh`.
- `Chạy thử cấu hình`.
- `Khôi phục mặc định V8.1`.
- Import/export/version history theo kế hoạch chưa có.

Liên quan: `frontend/src/App.tsx` — `Settings()`; backend mới có clone/activate/reset cơ bản.

## Confirmed TODO — Complete application routes

Các route sau đang render `ComingSoon`:

- `/progress`.
- `/coins`.
- `/coin`.
- `/risk`.
- `/reports`.

Liên quan: `frontend/src/App.tsx` — `Shell()`, `ComingSoon()`.

## Confirmed TODO — CoinMarketCap source

- UI có option `COINMARKETCAP (chưa cấu hình API)` nhưng backend chỉ dùng CoinGecko.
- Liên quan: `frontend/src/App.tsx`, `PublicMarketClient`.

## Confirmed TODO — Full token exclusions

- Config có bridged, LST, tokenized stock và index, nhưng `excluded_token()` chưa xử lý.
- Liên quan: `backend/rules/v8_1/defaults.json`, `backend/scanner/services.py`.

## Confirmed TODO — Evidence persistence

- Cần model/source timestamp/Evidence Level/freshness/parser version; hiện chủ yếu lưu raw snapshot trong Candidate.details.
- Nguồn: kế hoạch triển khai và yêu cầu V8.1; source hiện chưa có model tương ứng.

## Confirmed TODO — Production deployment

- Nginx, HTTPS, Lightsail scripts, backup/restore và production compose chưa có.
- Nguồn: `docs/PHASE_STATUS.md`.

# Refactor / Technical Debt

## Confirmed Technical Debt — Monolithic frontend component

- `frontend/src/App.tsx` chứa layout, dashboard, modal, table và settings trong một file.
- Không chặn chức năng hiện tại nhưng làm tăng rủi ro khi mở rộng các route.
- Status: Defer until feature behavior ổn định.

## Confirmed Technical Debt — Business logic split giữa JSON và Python

- Default thresholds nằm trong JSON nhưng nhiều decision hard-code trong orchestrator/services.
- Cần giữ tương thích khi triển khai configurable rule engine.
- Status: Pending architecture work.

# Needs Testing

## Confirmed Testing Need — Docker runtime

- Chạy `docker compose up -d --build`, migrations, seed và health checks trên Windows/Docker Desktop.

## Confirmed Testing Need — External API behavior

- Rate limit, empty response, Binance permission schema changes, partial CoinGecko pages.

## Confirmed Testing Need — Scheduler/concurrency

- Nhiều schedule đến hạn cùng lúc.
- Duplicate run prevention.
- Interval update.
- Cancel/pause/resume.

## Confirmed Testing Need — Profile lifecycle

- Clone, update, activate, reset, snapshot immutability và checksum/version.

# Suggested Improvements

Các mục dưới đây là đề xuất, không phải yêu cầu đã được xác nhận:

- Tách App.tsx theo feature folders sau khi API ổn định.
- Thêm OpenAPI schema và generated frontend client.
- Thêm structured logging và task correlation ID.
- Thêm source adapter contract tests bằng fixtures.
