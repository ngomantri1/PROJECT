# BUGS.md

# Open Bugs

## Cancel không dừng Celery task đang chạy

- Triệu chứng: `POST /scan-runs/{id}/cancel/` đổi DB status thành `CANCELLED`, nhưng task vẫn tiếp tục chạy và có thể ghi lại status/result khi hoàn tất hoặc fail.
- Nguyên nhân: không lưu/revoke Celery task id; `ScanOrchestrator.execute()` và loop không kiểm tra trạng thái cancel.
- Liên quan: `backend/scanner/views.py` — `ScanRunViewSet.cancel()`; `backend/scanner/tasks.py` — `run_scan()`; `backend/scanner/orchestrator.py`.
- Workaround: không dùng cancel trong khi worker đang chạy; chờ task kết thúc hoặc restart worker trong môi trường local.
- Status: Confirmed.
- Cần test lại: cancel giữa mỗi step, cancel khi external HTTP đang chờ, status cuối cùng.

## Nút “Tạm dừng” không có hành vi

- Triệu chứng: dashboard hiển thị nút `Tạm dừng` nhưng không có `onClick`, API pause/resume cũng chưa có.
- Liên quan: `frontend/src/App.tsx` — `Dashboard()`; model có `STATUS_PAUSED` nhưng backend không expose action.
- Status: Confirmed.

## “Xem kết quả” ở bước 6 khởi chạy một Scan Run mới

- Triệu chứng: StepCard bước 6 hiển thị `Xem kết quả` nhưng dùng cùng callback `onRun`, gọi `start([INVESTMENT_RESULTS])`.
- Backend mở rộng prerequisite đến sequence 6, vì vậy action này chạy lại toàn bộ sáu bước thay vì chỉ mở kết quả.
- Liên quan: `frontend/src/App.tsx` — `StepCard()`, `Dashboard()`; `backend/scanner/tasks.py` — `create_scan_run()`.
- Status: Confirmed.

## Các checkbox trong modal chạy tổng không ảnh hưởng request

- Triệu chứng: người dùng có thể bật/tắt “Quét ngay dữ liệu mới nhất”, “Tự động tiếp tục”, “Thông báo”, “Chỉ hiện BUY_SETUP”, nhưng tất cả là uncontrolled `defaultChecked` và `onStart()` không đọc giá trị.
- Liên quan: `frontend/src/App.tsx` — `StartModal()`; `frontend/src/api.ts` — `startScan()`.
- Status: Confirmed.

## Đổi interval schedule không cập nhật ngay next_run_at

- Triệu chứng: khi schedule đã có `next_run_at`, PATCH `interval_minutes` không tính lại lần chạy kế tiếp. Chu kỳ mới chỉ có hiệu lực sau lần dispatch kế tiếp.
- Nguyên nhân: `update_step_schedule()` chỉ tạo `next_run_at` khi trường này đang null.
- Liên quan: `backend/scanner/views.py` — `update_step_schedule()`.
- Status: Confirmed.

## Link “Xem” candidate không điều hướng

- Triệu chứng: bảng hiển thị anchor `Xem` nhưng không có href hoặc click handler; route chi tiết cũng đang `ComingSoon`.
- Liên quan: `frontend/src/App.tsx` — `CandidateTable()`, `Shell()`.
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

Không tìm thấy lịch sử bug đã fix có đủ bằng chứng để ghi vào tài liệu này.

# Known Risks / Fragile Areas

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
- Không có fallback/retry trong `PublicMarketClient._get()`.
- Status: Known operational risk.

## REST API không yêu cầu authentication

- `REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES` đang là `AllowAny`.
- Phù hợp local baseline nhưng không an toàn nếu expose production.
- Status: Known security risk, không phải bug local đã báo cáo.

## Seed không cập nhật profile default đã tồn tại

- `seed_v81` dùng `get_or_create`; thay đổi `defaults.json` sau khi profile đã tồn tại không tự đồng bộ config/checksum.
- Status: Known migration/versioning risk; cần quyết định policy trước khi sửa.
