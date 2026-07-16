# Hướng dẫn JetBrains Rider

## 1. Cài công cụ

Trên Windows cần có:

- JetBrains Rider.
- Docker Desktop đang chạy và dùng Linux containers.
- .NET 8 SDK.
- Node.js LTS.
- Git.

Để chạy toàn hệ thống bằng Docker Compose, Rider không bắt buộc phải chạy backend/frontend trực tiếp trên Windows; tuy nhiên .NET 8 SDK và Node.js vẫn hữu ích để kiểm tra build riêng.

## 2. Mở đúng project

Trong Rider:

1. Chọn **Open**.
2. Chọn thư mục gốc `ElevatorERP_V0-V2_Checked`, không chỉ chọn riêng thư mục `backend`.
3. Nếu Rider hỏi mở solution, chọn `ElevatorERP.sln`.
4. Chờ Rider index source và restore NuGet.

## 3. Chạy demo bằng Terminal Rider

Mở tab **Terminal** ở cuối Rider và chạy:

```powershell
Copy-Item .env.example .env
.\scripts\start-demo.ps1
```

Script sẽ:

- tạo `.env` nếu chưa có;
- kiểm tra `docker compose config`;
- build image backend/frontend;
- chạy PostgreSQL, Redis, backend, frontend và Nginx;
- in trạng thái container.

## 4. Kiểm tra container

```powershell
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Các container mong đợi:

- `postgres`
- `redis`
- `backend`
- `frontend`
- `nginx`

## 5. Kiểm thử nhanh

1. Mở `http://localhost/api/health` và kiểm tra `status = ok`.
2. Mở `http://localhost/api/swagger`.
3. Mở `http://localhost`.
4. Đăng nhập `admin.demo / Demo@123456` nếu chưa đổi `.env`.
5. Kiểm tra:
   - Dashboard.
   - Đăng ký khách hàng.
   - Lịch chăm sóc khách hàng.
   - Người dùng và vai trò.
6. Thu nhỏ trình duyệt hoặc mở bằng điện thoại cùng mạng để kiểm tra Drawer mobile và card mobile.

## 6. Build riêng trong Rider

Backend:

```powershell
dotnet restore .\ElevatorERP.sln
dotnet build .\ElevatorERP.sln -c Release --no-restore
```

Frontend:

```powershell
Set-Location frontend
npm ci
npm run lint
npm run build
Set-Location ..
```

## 7. Dừng hệ thống

```powershell
.\scripts\stop-demo.ps1
```

Lệnh này không xóa dữ liệu trong `.data`.
