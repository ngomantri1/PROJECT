# Báo cáo kiểm tra source

Ngày kiểm tra: 16/07/2026.

## Source gốc đã được mở trực tiếp

Archive gốc có 50 mục và cấu trúc chính:

- `backend/ElevatorERP.Api.csproj`
- `backend/Program.cs`
- `frontend/package.json`
- `docker-compose.yml`
- `deploy/nginx/default.conf`
- tài liệu trong `docs/`

Source gốc không có file `.sln` và không có `package-lock.json`.

## Kết quả frontend

Đã thực hiện thực tế trên bản đã chỉnh:

```text
npm ci                 PASS
npm run lint           PASS, 0 warning/error
npm run build          PASS
```

Các route build thành công:

- `/`
- `/login`
- `/customers`
- `/care`
- `/admin/users`

Dependency đã được khóa bằng `package-lock.json`; Dockerfile dùng `npm ci`.

## Kết quả backend

Môi trường kiểm tra hiện tại không có .NET SDK và không có kết nối tải .NET SDK/NuGet trực tiếp, vì vậy **chưa thể tuyên bố backend build sạch bằng `dotnet build` trong môi trường này**.

Đã thực hiện:

- mở và đọc toàn bộ file C#;
- kiểm tra tham chiếu project và Dockerfile;
- bổ sung `ElevatorERP.sln` cho Rider;
- sửa cấu hình forwarded headers và lưu Data Protection keys;
- thêm kiểm tra phạm vi khi hoàn thành lịch chăm sóc;
- hạn chế path traversal khi upload file;
- bổ sung audit log cơ bản;
- ngăn seed tài khoản demo khi `ENABLE_DEMO_SEED=false`.

Bước bắt buộc trên máy có .NET 8 SDK:

```powershell
dotnet restore .\ElevatorERP.sln
dotnet build .\ElevatorERP.sln -c Release --no-restore
```

## Kết quả Docker Compose

Môi trường kiểm tra không có Docker daemon nên chưa chạy được `docker compose build/up` thực tế.

Đã kiểm tra:

- YAML parse hợp lệ.
- Có đúng 5 service: PostgreSQL, Redis, backend, frontend, Nginx.
- Dockerfile backend/frontend tồn tại đúng build context.
- Cấu hình Nginx tồn tại đúng đường dẫn.
- PostgreSQL và Redis có healthcheck.
- Backend chờ PostgreSQL và Redis healthy.
- Dữ liệu chuyển sang bind mount để dễ backup ngoài VPS.
- Upload và Data Protection keys có đường dẫn lưu bền vững.

Bước bắt buộc trên máy có Docker Desktop:

```powershell
Copy-Item .env.example .env
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

## Lỗi/gap tìm thấy trong source gốc

1. Không có `.sln`, gây bất tiện khi mở toàn bộ backend trong Rider.
2. Không có lock file frontend; `npm install` có thể lấy phiên bản mới khác nhau.
3. Nút menu mobile không có hành động; sidebar bị ẩn nhưng nội dung vẫn lệch trái 244 px.
4. Bảng chưa chuyển thành card trên mobile.
5. `COOKIE_KEY` được khai báo nhưng backend không sử dụng; cookie đăng nhập có thể mất hiệu lực sau khi container restart do Data Protection key không lưu bền vững.
6. CORS ban đầu cho phép mọi origin đi kèm credentials.
7. Upload cho phép dùng chuỗi `module` để tạo đường dẫn mà chưa chuẩn hóa an toàn.
8. Dữ liệu demo vẫn được tạo một phần ngay cả khi `ENABLE_DEMO_SEED=false`.
9. Redis, SignalR, worker/Hangfire và Modular Monolith chưa được triển khai thực tế.
10. EF Core migration chưa có; đang dùng `EnsureCreated`.
11. Chỉ có audit log đăng nhập trong source gốc; audit nghiệp vụ chưa đầy đủ.
12. Menu/permission có placeholder dự án dù chưa có API/trang dự án.

## Kết luận

Frontend bản chỉnh đã lint và build sạch. Backend và Docker Compose vẫn cần một lần xác nhận cuối trên máy có .NET 8 SDK + Docker daemon trước khi được đánh dấu “build sạch toàn hệ thống”. Không nên triển khai production từ V0–V2 hiện tại.
