# COIN SPOT SCANNER V8.1 — Tóm tắt tư vấn Bước 2: Market Regime

## 1. Mục đích tài liệu

Tài liệu này là context gửi cho ChatGPT/kiến trúc sư để tư vấn kế hoạch hoàn thiện Bước 2 — Market Regime. Nội dung mô tả source hiện tại, hành vi đã xác minh, dữ liệu đầu vào, cảnh báo đang hiển thị và các quyết định cần tư vấn. Không xem đây là bằng chứng rằng nguồn dữ liệu bên ngoài đã đầy đủ.

## 2. Mục tiêu nghiệp vụ

Bước 2 đánh giá trạng thái thị trường trước khi shortlist, execution verification và scoring. Kết quả phải trung thực về độ đầy đủ của evidence; `UNKNOWN` không được coi là `PASS`; thiếu dữ liệu critical không được tạo `BUY_SETUP`. Bước này không đặt lệnh và không được tự bịa BTC Dominance, TOTAL3, macro risk, entry, stop, RR hoặc unlock.

## 3. Luồng pipeline hiện tại

1. **Universe Scan** lấy danh sách CoinGecko và lọc Binance Spot/USDT, market cap, thanh khoản và exclusion rules.
2. **Market Regime** lấy BTC/ETH D1 và 4H, ETH/BTC D1 và 4H, CoinGecko global snapshot; sau đó lấy D1 batch cho các coin trong `RESEARCH_POOL` để tính Breadth MA20 và Alt Volume 7D.
3. Các bước sau chỉ chạy khi được gọi trong full scan. Khi bấm riêng Bước 2, Research Shortlist/Execution/Scoring/Investment Results có thể vẫn trống hoặc bị bỏ qua.
4. Payload được lưu trong `ScanStepRun.payload` và `ScanRun.results["market_regime"]`.

## 4. Contract payload hiện tại

Payload có `schema_version: market_regime.v1` và các phần chính:

- `regime`: `THUẬN LỢI`, `TRUNG TÍNH` hoặc `XẤU`.
- `status`: `FINAL` hoặc `PROVISIONAL`.
- `confidence`: `HIGH`, `MEDIUM` hoặc `LOW`.
- `universe`: basis, count, eligible_count và hash của pool.
- `completeness`: pass_count/total_count, percentage, missing, stale, conflict, core_missing.
- `groups`: 9 evidence groups.
- `hard_rules`: lý do ảnh hưởng kết luận regime.
- `provider_stats`: số symbol, lỗi và thống kê request/retry.

Mỗi evidence group có `label`, `value`, `signal`, `status`, `source`, `observed_at`, `fetched_at`, `freshness_seconds`, `error`, `notes`.

## 5. Chín nhóm evidence

| Nhóm | Nguồn/logic hiện tại | Trạng thái thực tế |
|---|---|---|
| BTC D1 | Binance klines, nến đã đóng, MA20/MA50 và slope | Có thể PASS nếu đủ dữ liệu và còn fresh |
| BTC 4H | Binance klines, nến đã đóng, MA20/MA50 và slope | Có thể PASS nếu đủ dữ liệu và còn fresh |
| ETH D1/4H | Binance klines, đánh giá hai timeframe và phát hiện conflict | Có thể PASS/UNKNOWN/CONFLICT |
| BTC Dominance | CoinGecko `/global` snapshot | Chưa có lịch sử nên UNKNOWN |
| ETH/BTC | Binance `ETHBTC` D1/4H | Có thể PASS nếu đủ dữ liệu |
| TOTAL3 proxy | Tính snapshot `total_market_cap × (1 - BTC.D - ETH.D)` | Chưa có historical trend nên UNKNOWN |
| Breadth MA20 | Tỷ lệ coin trong cùng research pool có close > MA20; coverage tối thiểu 60% | Có thể PASS nếu đủ pool và nến |
| Alt Volume 7D | Volume nến đóng gần nhất so với trung bình 7 nến trước; coverage tối thiểu 60% | Có thể PASS nếu đủ pool và nến |
| Macro/event risk | Chưa có provider/manual override được cấu hình | UNKNOWN |

## 6. Cách đọc ảnh runtime đã cung cấp

Ảnh runtime cho thấy:

- Bước 1 hoàn tất.
- Bước 2 hoàn tất có cảnh báo.
- `6/9 PASS`, `PROVISIONAL`, confidence `MEDIUM`.
- Ba nhóm còn thiếu/chưa xác minh: **BTC Dominance**, **TOTAL3 proxy**, **Macro/event risk**.
- Đây là cảnh báo độ đầy đủ evidence, không phải exception làm step thất bại.
- `Universe 500` ở sidebar là số lượng cấu hình muốn quét; `Universe 57 · hợp lệ 57` trong Market Regime là số coin thực tế còn lại sau filter và có trong pool của run.
- Research Shortlist trống là bình thường khi chỉ chạy riêng Bước 2; chưa chạy Bước 3.

## 7. Các khó khăn đã xác minh

### 7.1 BTC Dominance và TOTAL3 chưa đủ dữ liệu lịch sử

CoinGecko global endpoint hiện cung cấp snapshot dominance/market cap. Snapshot đủ để hiển thị giá trị hiện tại nhưng không đủ để kết luận xu hướng tăng/giảm. Code hiện giữ `UNKNOWN` thay vì suy diễn.

### 7.2 Macro/event risk chưa có nguồn được phê duyệt

Chưa có adapter dữ liệu macro hoặc cơ chế manual evidence override trong repository. Không nên kết nối nguồn mới hoặc gắn nhãn rủi ro nếu chưa thống nhất provider, freshness, timezone và cách lưu bằng chứng.

### 7.3 Chi phí gọi API

Một lần chạy Market Regime có các request core và batch D1 cho pool. Batch đã giới hạn concurrency; client có retry bounded cho network/429/5xx. Tuy nhiên vẫn cần kiểm chứng rate-limit thực tế và cache policy trước khi mở rộng pool.

### 7.4 Freshness và nến mở

Kline parser loại nến chưa đóng. Evidence core có freshness dựa trên thời điểm close gần nhất. Các nguồn snapshot không có timestamp quan sát đáng tin cậy nên không được giả lập historical freshness.

### 7.5 Tách chạy riêng và full scan

Chạy riêng Bước 2 phù hợp để test evidence, nhưng không chứng minh toàn bộ pipeline 6 bước. Cần test riêng với pool đã có và test full scan để xác minh state transition, skip semantics và validation gate.

## 8. Integrity Gate không được thay đổi

- `UNKNOWN` không phải `PASS`.
- Không tạo `BUY_SETUP` khi thiếu orderbook, kline 4H, unlock, stop/invalidation hoặc RR.
- Không hạ Hard Rule để biến `PROVISIONAL` thành `FINAL`.
- Không bịa historical BTC.D/TOTAL3 hoặc macro data.
- Không làm thay đổi Quality Score, Entry Score, Opportunity Score hay pipeline sáu bước chỉ để đạt đủ phần trăm.

## 9. Kế hoạch nên xin tư vấn

### P0 — Xác định contract evidence

1. Chốt định nghĩa PASS cho từng nhóm.
2. Chốt freshness limit và timezone.
3. Chốt điều kiện `FINAL`/`PROVISIONAL`/`UNKNOWN`.
4. Chốt policy khi BTC.D/TOTAL3/macro không có nguồn.

### P1 — Hoàn thiện nguồn dữ liệu

1. Chọn provider lịch sử hợp lệ cho BTC Dominance.
2. Chọn cách xây historical TOTAL3/proxy với source và timestamp rõ ràng.
3. Chọn provider macro/event hoặc xác nhận manual override có audit.
4. Thêm schema validation, fixture và provider contract tests.

### P2 — Hiệu năng và vận hành

1. Cache theo symbol/interval/freshness trong cùng ScanRun.
2. Đo rate-limit, retry, timeout và partial failure.
3. Thêm metrics cho coverage, stale, conflict và provider error.
4. Thêm integration test cho run riêng Bước 2 và full scan.

## 10. Câu hỏi cần ChatGPT tư vấn

1. Nên chọn nguồn nào cho BTC Dominance history, TOTAL3 history/proxy và Macro/Event Risk trong phạm vi public API được phép?
2. Ngưỡng freshness và số candle tối thiểu nào hợp lý cho D1/4H?
3. Có nên cho `FINAL/MEDIUM` khi chỉ thiếu macro, trong khi BTC.D/TOTAL3 đã PASS không?
4. Nên cache ở client, ScanRun hay Celery task để giảm 429 nhưng vẫn bảo toàn snapshot?
5. Nên hiển thị `PROVISIONAL` ở dashboard như thế nào để người dùng không hiểu nhầm là lỗi?
6. Test matrix tối thiểu nào cần có trước khi cho phép chạy full scan thường xuyên?

## 11. File source quan trọng trong gói ZIP

- `backend/scanner/market_regime.py`
- `backend/scanner/orchestrator.py`
- `backend/scanner/services.py`
- `backend/scanner/models.py`, `views.py`, `serializers.py`, `tests.py`
- `backend/rules/v8_1/defaults.json`
- `frontend/src/App.tsx`, `types.ts`, `styles.css`, `api.ts`
- `AGENTS.md`, `CURRENT_STATE.md`, `BUSINESS_RULES.md`, `ARCHITECTURE.md`, `BUGS.md`, `TODO.md`, `README.md`
- `docs/specification/` và `docker-compose.yml`

## 12. Ghi chú về phạm vi ZIP

ZIP không bao gồm database, Celery schedule runtime, `.env` chứa cấu hình local, `node_modules`, Python cache, frontend `dist`, ảnh thiết kế lớn, archive cũ và các file build/cache. Mục đích là để ChatGPT đọc source/context mà không bị nhiễu bởi dữ liệu môi trường hoặc file lớn.
