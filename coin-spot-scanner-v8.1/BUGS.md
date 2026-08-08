# BUGS.md

# Open Bugs

## Cancel không dừng Celery task đang chạy

- Triệu chứng: `POST /scan-runs/{id}/cancel/` đổi DB status thành `CANCELLED`, nhưng task vẫn tiếp tục chạy và có thể ghi lại status/result khi hoàn tất hoặc fail.
- Nguyên nhân: không lưu/revoke Celery task id; `ScanOrchestrator.execute()` và loop không kiểm tra trạng thái cancel.
- Liên quan: `backend/scanner/views.py` — `ScanRunViewSet.cancel()`; `backend/scanner/tasks.py` — `run_scan()`; `backend/scanner/orchestrator.py`.
- Workaround: không dùng cancel trong khi worker đang chạy; chờ task kết thúc hoặc restart worker trong môi trường local.
- Status: Confirmed.
- Cần test lại: cancel giữa mỗi step, cancel khi external HTTP đang chờ, status cuối cùng.

## Đổi interval schedule không cập nhật ngay next_run_at

- Triệu chứng: khi schedule đã có `next_run_at`, PATCH `interval_minutes` không tính lại lần chạy kế tiếp. Chu kỳ mới chỉ có hiệu lực sau lần dispatch kế tiếp.
- Nguyên nhân: `update_step_schedule()` chỉ tạo `next_run_at` khi trường này đang null.
- Liên quan: `backend/scanner/views.py` — `update_step_schedule()`.
- Status: Confirmed.

## Các exclusion bật trong config nhưng không được áp dụng

- Triệu chứng: UI/default config cho phép exclude `bridged`, `lst`, `tokenized_stock`, `index`, nhưng Universe Scan chỉ xử lý stablecoin, wrapped và leveraged.
- Liên quan: `backend/rules/v8_1/defaults.json`; `backend/scanner/services.py` — `excluded_token()`.
- Tác động: universe có thể chứa token thuộc nhóm người dùng đã bật loại trừ.
- Status: Confirmed.

## Số cảnh báo/lỗi trên màn hình Settings là hard-code

- Triệu chứng: sidebar settings luôn hiển thị Cảnh báo `2`, Lỗi `0`, không dựa trên validation response.
- Liên quan: `frontend/src/App.tsx` — `Settings()`.
- Status: Confirmed.

# Investigating

Không có bug đang điều tra được ghi nhận trong source hoặc tài liệu hiện tại.

# Fixed Bugs

## Dashboard actions/link giả và trạng thái scan không rõ ràng

- Sửa: nút `Tạm dừng` bị vô hiệu hóa kèm tooltip vì backend chưa có pause/resume; các checkbox không có request semantics đã được bỏ khỏi modal; `Xem kết quả` chỉ cuộn đến khu vực kết quả, không gọi API tạo Scan Run; chi tiết coin được vô hiệu hóa kèm tooltip khi route chưa sẵn sàng.
- Sửa: `COMPLETED_WITH_WARNINGS` hiển thị là `Hoàn tất có cảnh báo`; progress hiển thị số cảnh báo/lỗi và notification được gộp theo nội dung.
- Sửa bổ sung: bước `FAILED` được tính là đã kết thúc; milestone cảnh báo dùng màu cam; latest run failed không che kết quả thành công gần nhất; HTTP 429 được rút gọn ở UI nhưng raw error vẫn giữ nguyên trong `ScanRun.error_message`/notification.
- Xác minh (2026-08-06): kiểm tra DOM/dashboard local xác nhận các control giả bị vô hiệu hóa hoặc không còn hiển thị; số `ScanRun` trước/sau khi bấm `Xem kết quả` giữ nguyên.
- Status: Fixed and browser-verified.

## Frontend Vite type declaration missing

- Triệu chứng: `npm run typecheck` và `npm run build` fail với `TS2339: Property 'env' does not exist on type 'ImportMeta'` tại `frontend/src/api.ts`.
- Sửa: thêm `frontend/src/vite-env.d.ts` tham chiếu `vite/client`.
- Xác minh (2026-08-06): `npm run typecheck` và `npm run build` trong container frontend pass.
- Status: Fixed and build-verified.

## Milestone bỏ qua bước hoàn tất có cảnh báo

- Triệu chứng: progress bar hiển thị 6/6, nhưng chỉ milestone có trạng thái chính xác `COMPLETED` được tô hoàn tất; các bước `COMPLETED_WITH_WARNINGS` trông như bị bỏ qua.
- Bằng chứng: run ngày 2026-08-06 hoàn tất tuần tự sáu bước, trong đó bước 2–6 là `COMPLETED_WITH_WARNINGS`; `frontend/src/App.tsx` chỉ kiểm tra `status === 'COMPLETED'`.
- Sửa: milestone nay coi cả `COMPLETED` và `COMPLETED_WITH_WARNINGS` là hoàn tất.
- Status: Fixed; source-verified.

## Worker không consume queue mặc định của Celery

- Triệu chứng: `POST /api/scan-runs/start/` tạo `ScanRun` ở `QUEUED`, nhưng cả sáu step giữ `WAITING`; các lần bấm tiếp theo nhận HTTP 409.
- Bằng chứng: worker chỉ consume `default,fast,crawl`, trong khi Redis có 281 task ở queue mặc định `celery`; `celery inspect active_queues` không có `celery`.
- Sửa: worker trong `docker-compose.yml` hiện consume `celery,default,fast,crawl`.
- Xác minh runtime (2026-08-06): worker nhận `scanner.tasks.run_scan`; run đã kẹt chuyển `COMPLETED`, `progress=100`, và sáu step hoàn tất/có cảnh báo theo baseline.
- Status: Fixed and runtime-verified.

# Fixed — Pipeline Status Integrity

- Full scan and partial B4-only lifecycle semantics are now separated: full scope runs B1-B6; B4-only is `PARTIAL_COMPLETED` at workflow progress 67% with B5/B6 `SKIPPED` and an explicit notification.
- Runtime verification: full run `7186df51-9442-4427-acfd-913ad35bb1ce`; B4-only behavior was covered by regression tests.
- Status: Fixed and runtime/test-verified.

## Fixed — Research provider fallback message length

- Symptom: multiple DefiLlama failures could exceed `ScanStepRun.message.max_length=300` and raise PostgreSQL `DataError`.
- Fix: compact step summary messages; preserve full provider error detail in `payload.provider_status`.
- Runtime verification: forced provider failure run `e6d8fa5e-6b99-49dc-acd9-ac575b59fc15` produced B3 `COMPLETED_WITH_WARNINGS`, `PREFILTER_ONLY_FALLBACK`, five unavailable sources, shortlist 15, message length 224, and full run `COMPLETED_WITH_WARNINGS` with `BUY_SETUP=0`.
- Status: Fixed and forced-failure/runtime/test-verified (2026-08-08).

# Known Risks / Fragile Areas

## Market Regime evidence completeness

- Previous step 2 output hard-coded `5/9` and did not expose per-group missing evidence.
- Current implementation uses dynamic 9-group completeness and explicit UNKNOWN/STALE/CONFLICT statuses. BTC dominance/TOTAL3 history and macro risk remain UNKNOWN until an approved source is configured.
- Status: Fixed for transparency; source coverage remains an operational limitation.

## Symbol-only asset mapping

- CoinGecko → Binance map hiện chỉ dựa `symbol.upper()`/base asset.
- Có nguy cơ ticker trùng hoặc map sai project/chain/contract.
- Status: Known risk, chưa có báo cáo lỗi cụ thể.

## Global schedule duplicate check

- Dispatcher kiểm tra một run cùng `step_key` trên toàn hệ thống, không giới hạn theo profile.
- Một profile có thể chặn schedule cùng step của profile khác.
- Status: Suspected design issue; cần test đa profile trước khi gọi là bug production.

## Public API availability

- CoinGecko/Binance rate limit hoặc schema change làm toàn step/run fail.
- PublicMarketClient now has bounded retry/backoff for network, 429 and 5xx responses; provider schema/history gaps remain explicit rather than synthesized.
- Bằng chứng runtime (2026-08-06): hai run gần nhất fail tại Universe Scan vì CoinGecko trả `429 Too Many Requests` cho `/api/v3/coins/markets`.
- Status: Known operational risk; chưa sửa trong phạm vi dashboard.

## REST API không yêu cầu authentication

- `REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES` đang là `AllowAny`.
- Phù hợp local baseline nhưng không an toàn nếu expose production.
- Status: Known security risk, không phải bug local đã báo cáo.

## Fixed — Seed đồng bộ profile default với ruleset hiện tại

- Triệu chứng trước đây: `seed_v81` chỉ `get_or_create`; thay đổi `defaults.json` sau khi profile đã tồn tại không tự đồng bộ config/checksum.
- Sửa: `seed_v81` so sánh config/checksum, cập nhật profile default và tăng version khi ruleset trong repository thay đổi.
- Bảo toàn lịch sử: `ScanRun.profile_snapshot` cũ không bị sửa.
- Status: Source-patched; cần Codex/Docker runtime test sau restart.

## Fixed — Research Shortlist hiển thị Quality giả từ proxy MC/volume/FDV

- Triệu chứng: Dashboard có thể hiển thị Quality Range như `66–82` và xếp BONK/FET/PENGU/... theo `quality_score_high`, mặc dù Product Metrics, Unlock, Token Value Capture và Holder/Treasury đều đang thiếu.
- Nguyên nhân: `provisional_quality()` dùng chỉ Market Cap + total volume + FDV/MC để tạo một range mang tên Quality; `step_research_shortlist()` sau đó sort theo upper bound của range này. Khi nhiều coin cùng upper bound, volume quyết định thứ hạng.
- Sai lệch V8.1: Evidence E0/critical missing không được biến thành numeric Quality; không có Product/Usage evidence thì không được công bố Quality cao như thể đã chấm đủ checklist.
- Sửa: Universe dùng `research_prefilter()` chỉ để ưu tiên nghiên cứu; Quality giữ `NOT_SCORED`. Step 3 sort theo prefilter priority, không theo Quality proxy. UI hiển thị rõ `Research Shortlist — Prefilter, chưa phải Quality ranking`.
- Status: Fixed; Docker/runtime verified 2026-08-08. Quality remains NOT_SCORED and Research Evidence Priority is not Quality ranking.

## Fixed — Dashboard chỉ hiển thị 8/15 Research Shortlist

- Triệu chứng: Step 3 báo chọn 15 coin nhưng bảng Dashboard chỉ hiện 8.
- Nguyên nhân: `frontend/src/App.tsx` hard-code `.slice(0, 8)`.
- Sửa: bỏ giới hạn 8; bảng hiển thị toàn bộ candidate thuộc Research Shortlist/Execution Verification theo rank.
- Status: Fixed; frontend typecheck/build and runtime payload verified 2026-08-08.
