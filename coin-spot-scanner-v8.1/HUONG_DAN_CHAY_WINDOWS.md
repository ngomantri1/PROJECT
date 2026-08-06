# HƯỚNG DẪN CHẠY COIN SPOT SCANNER V8.1 TRÊN WINDOWS

## Phương án dễ nhất: Docker Desktop

### Bước 1 — Cài Docker Desktop

1. Cài Docker Desktop cho Windows.
2. Khởi động Docker Desktop.
3. Chờ đến khi Docker Engine báo đang chạy.
4. Không chạy các lệnh `docker compose` trước khi Docker Engine sẵn sàng.

### Bước 2 — Giải nén project

Nên dùng đường dẫn ngắn, không dấu, ví dụ:

```text
D:\COIN_SPOT_SCANNER_V8_1
```

### Bước 3 — Tạo `.env`

Mở thư mục project, nhấp vào thanh địa chỉ của File Explorer, gõ `powershell` rồi Enter.

Chạy:

```powershell
Copy-Item .env.example .env
```

### Bước 4 — Khởi động

Cách 1 — nhấp đúp:

```text
scripts\start-windows.bat
```

Cách 2 — PowerShell:

```powershell
docker compose up -d --build
```

Lần đầu Docker cần tải image và package nên có thể lâu hơn các lần sau.

### Bước 5 — Mở giao diện

```text
http://localhost:5173
```

API kiểm tra:

```text
http://localhost:8000/api/health/
```

### Bước 6 — Chạy quét

1. Mở trang **Tổng quan**.
2. Bấm **Bắt đầu quét toàn bộ**.
3. Xem tiến trình sáu bước.
4. Bước Universe có thể mất thời gian do CoinGecko giới hạn tốc độ.
5. Khi thiếu unlock, hệ thống sẽ giữ `UNKNOWN` và không tạo BUY_SETUP.

## Tạo tài khoản Django Admin

```powershell
docker compose exec backend python manage.py createsuperuser
```

Sau đó mở:

```text
http://localhost:8000/admin
```

## Xem log khi có lỗi

```powershell
docker compose logs -f backend celery frontend
```

Hoặc nhấp đúp:

```text
scripts\logs-windows.bat
```

## Khởi động lại

```powershell
docker compose restart
```

## Dừng phần mềm nhưng giữ dữ liệu

```powershell
docker compose down
```

## Xóa toàn bộ dữ liệu local để làm lại

Cảnh báo: lệnh này xóa database và Redis local.

```powershell
docker compose down -v
```

## Khi cổng bị chiếm

Nếu cổng 5173 hoặc 8000 đang được phần mềm khác sử dụng, sửa trong `docker-compose.yml`:

```yaml
ports:
  - "5174:5173"
```

hoặc:

```yaml
ports:
  - "8001:8000"
```

Sau đó mở theo cổng mới.

## Kiểm tra project

```powershell
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test
docker compose exec frontend npm run build
```

## Lưu ý quan trọng

- Đây là phần mềm nghiên cứu Spot, không tự đặt lệnh.
- CoinGecko/Binance có thể rate-limit tạm thời.
- Không có dữ liệu không đồng nghĩa coin xấu, nhưng không được gọi BUY_SETUP.
- Bản 0.1.0 chưa có đầy đủ crawler unlock đa nguồn.
