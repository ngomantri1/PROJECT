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
- Market Regime cơ bản từ BTC/ETH kline + CoinGecko Global.
- Research Shortlist sơ bộ.
- Execution Verification lấy orderbook/kline Binance cho shortlist đầu.
- Scoring & Validation tuân thủ Integrity: thiếu unlock/product evidence thì không sinh BUY_SETUP.
- Trang Cài đặt Checklist cơ bản.
- API, database và lịch sử Scan Run.

## Giới hạn trung thực của bản 0.1.0

- Unlock crawler đa nguồn mới có interface và trạng thái `UNKNOWN`; chưa tự động crawl toàn bộ nguồn.
- Product/usage adapters mới ở mức nền tảng.
- Quality Score hiện là `RANGE/PROVISIONAL` khi thiếu bằng chứng nền tảng.
- Entry Score là `NOT_SCORED` khi thiếu unlock hoặc dữ liệu critical.
- Không có chức năng tự đặt lệnh.

Đây là hành vi đúng V8.1: phần mềm không bịa dữ liệu để tạo BUY_SETUP.

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
