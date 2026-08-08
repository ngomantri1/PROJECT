# COIN SPOT SCANNER V8.1 — EXECUTION INTEGRITY

Bản nền tảng chạy được của hệ thống quét coin theo bộ `COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY`.

## Trạng thái hiện tại

Bản `0.1.0` đã có:

- React + TypeScript + Ant Design.
- Django REST Framework.
- PostgreSQL, Redis, Celery và Celery Beat.
- Dashboard sáu bước theo giao diện đã duyệt.
- Nút **Bắt đầu quét toàn bộ**.
- Chạy riêng từng bước.
- Lịch tự động và chính sách `Khi quét tổng` ba trạng thái.
- Cấu hình V8.1 mặc định.
- Universe Scan lấy dữ liệu thật từ CoinGecko và Binance public API.
- Market Regime v1 từ BTC/ETH/ETHBTC kline, CoinGecko Global snapshot và batch Breadth/Alt Volume; evidence thiếu được hiển thị UNKNOWN/PROVISIONAL.
- Research Shortlist dạng **RESEARCH_EVIDENCE_PRIORITY**: dùng market/tokenomics prefilter + Binance 24H quote volume + DefiLlama public protocol/chain/fees/DEX evidence khi map được; vẫn chưa phải Quality ranking V8.1.
- Execution Verification lấy orderbook/kline Binance cho shortlist đầu.
- Scoring & Validation tuân thủ Integrity: thiếu unlock/product evidence thì không sinh BUY_SETUP.
- Trang Cài đặt Checklist cơ bản.
- API, database và lịch sử Scan Run.

## Giới hạn trung thực của bản 0.1.0

- Unlock public-web crawler có parser HTML/embedded JSON, discovery link từ trang CoinGecko, cache và Celery task; mặc định tắt, bật bằng `UNLOCK_WEB_CRAWL_ENABLED=true`. URL whitelist trong candidate details được ưu tiên; nếu thiếu, hệ thống chỉ dùng link công khai có từ khóa tokenomics/vesting/unlock.
- Product/usage research evidence đã có adapter DefiLlama public ở mức E2 cho protocol/chain được map rõ; Token Value Capture, full Product rubric và các ngành ngoài coverage vẫn chưa đủ để chấm Quality.
- Quality Score giữ `NOT_SCORED` khi thiếu các evidence critical; hệ thống không còn tạo range 66–82 từ MC/volume/FDV rồi trình bày như Quality.
- Entry Score là `NOT_SCORED` khi thiếu unlock hoặc dữ liệu critical.
- Không có chức năng tự đặt lệnh.

Đây là hành vi đúng V8.1: phần mềm không bịa dữ liệu để tạo BUY_SETUP.

## Pipeline lifecycle và provider fallback đã xác minh

- Full scan chạy đủ B1-B6; warning dùng `COMPLETED_WITH_WARNINGS` và workflow progress 100%.
- Chạy riêng Bước 4 chạy prerequisite B1-B3, giữ B5/B6 `SKIPPED`, status `PARTIAL_COMPLETED`, workflow progress 67% và processing progress 100%.
- Research Shortlist dùng Research Evidence Priority, không phải Quality ranking. Khi DefiLlama unavailable, hệ thống dùng `PREFILTER_ONLY_FALLBACK`, giữ evidence thiếu là `UNKNOWN` và vẫn tạo shortlist nếu pool đủ.
- `ScanStepRun.message` là summary ngắn tối đa 300 ký tự; provider error detail nằm trong payload để audit.
- Quality giữ `NOT_SCORED`, Entry/Opportunity giữ `NOT_SCORED` khi evidence thiếu; không tạo BUY_SETUP giả và giữ 100% USDT khi gate chưa đạt.
- Đã xác minh Docker/runtime ngày 2026-08-08 với 49 Django tests PASS, frontend typecheck/build PASS, normal full run PASS và forced-provider-failure PASS; fallback giữ shortlist 15, Quality `NOT_SCORED` và không tạo `BUY_SETUP`.

## Chạy nhanh trên Windows bằng Docker

### 1. Cài Docker Desktop

Mở Docker Desktop và chờ đến khi Docker Engine báo đang chạy.

### 2. Giải nén project

Ví dụ:

```text
D:\COIN_SPOT_SCANNER_V8_1
```

### 3. Tạo file `.env`

Mở PowerShell tại thư mục project:

```powershell
Copy-Item .env.example .env
```

### 4. Khởi động

```powershell
docker compose up -d --build
```

Hoặc nhấp đúp:

```text
scripts\start-windows.bat
```

### 5. Mở phần mềm

- Giao diện: http://localhost:5173
- API: http://localhost:8000/api
- Django Admin: http://localhost:8000/admin

### 6. Tạo tài khoản quản trị

```powershell
docker compose exec backend python manage.py createsuperuser
```

## Các lệnh thường dùng

```powershell
# Xem trạng thái
docker compose ps

# Xem log
docker compose logs -f backend celery frontend

# Dừng
docker compose down

# Dừng và xóa toàn bộ dữ liệu local
docker compose down -v
```

## Khi CoinGecko hoặc Binance tạm lỗi

Hệ thống sẽ ghi bước là `FAILED` hoặc `COMPLETED_WITH_WARNINGS`, không tạo dữ liệu giả. Bấm **Chạy lại từ đầu** sau ít phút.

## Cấu trúc

- `frontend/`: React UI.
- `backend/`: Django API, Celery và rule engine.
- `backend/rules/v8_1/defaults.json`: cấu hình V8.1 mặc định.
- `docs/`: hướng dẫn và trạng thái triển khai.
- `scripts/`: lệnh Windows/Linux.

## Kiểm tra mã nguồn

```powershell
docker compose exec backend python manage.py test
docker compose exec frontend npm run build
```
