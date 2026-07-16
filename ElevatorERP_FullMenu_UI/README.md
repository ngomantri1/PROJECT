# ElevatorERP – ERP nội bộ Thang máy Miền Trung

Bản project phát triển nội bộ có thể chạy bằng Docker Compose. Backend hiện có API thật cho nền tảng, phân quyền, đăng ký khách hàng và lịch chăm sóc; toàn bộ menu ERP đã có màn hình để kiểm thử giao diện và luồng thao tác trên máy lập trình:

- V0: Next.js, ASP.NET Core, PostgreSQL, Redis, Docker Compose, Nginx.
- V1: đăng nhập, người dùng, nhiều vai trò trên một tài khoản, quyền, menu động, audit log cơ bản.
- V2: đăng ký khách hàng, lịch chăm sóc khách hàng, dashboard và dữ liệu demo.

## Công nghệ

- Frontend: Next.js + TypeScript + Ant Design
- Backend: ASP.NET Core 8 Minimal API + EF Core
- Database: PostgreSQL
- Cache: Redis (đã khai báo hạ tầng, chưa bắt buộc cho các màn hình V0–V2)
- Triển khai: Docker Compose + Nginx trên Ubuntu Linux
- File: lưu tại volume `/app/uploads`

## Chạy bằng Docker

1. Sao chép file môi trường:

```bash
cp .env.example .env
```

2. Khởi động:

```bash
docker compose up -d --build
```

3. Truy cập:

- Web: http://localhost
- API/Swagger: http://localhost/api/swagger
- Health check: http://localhost/api/health

## Tài khoản demo

Mật khẩu mặc định lấy từ `DEMO_DEFAULT_PASSWORD` trong `.env`.

| Tên đăng nhập | Vai trò |
|---|---|
| admin.demo | Quản trị hệ thống + Giám đốc |
| sales.demo | Nhân viên kinh doanh |
| salesmanager.demo | Trưởng phòng kinh doanh |
| technical.demo | Kỹ thuật viên |
| accountant.demo | Kế toán viên |

## Dữ liệu giả lập

Khi `ENABLE_DEMO_SEED=true`, backend tự tạo:

- phòng ban, vai trò, quyền;
- tài khoản demo;
- 20 khách hàng;
- 45 lịch chăm sóc ở nhiều trạng thái;
- dữ liệu dashboard.

Để dùng production thật, đặt:

```env
ENABLE_DEMO_SEED=false
```

và đổi toàn bộ secret/mật khẩu trong `.env`.

## Lưu ý quan trọng

- Các màn hình đăng nhập, dashboard, người dùng, đăng ký khách hàng và lịch chăm sóc dùng API/backend hiện có.
- Các màn hình nghiệp vụ còn lại mở được đầy đủ để kiểm thử bố cục và thao tác; dữ liệu trên các màn hình này được lưu cục bộ bằng `localStorage` của trình duyệt trên máy lập trình.
- Không có cơ chế Live/Demo/Planned trong menu. Tất cả mục đều hiển thị như chức năng của ERP.
- Trước khi triển khai production, từng phân hệ vẫn phải được nối API, migration, permission và kiểm thử nghiệp vụ thật.

## Giao diện Pro UI

Bản này sử dụng đồng thời:

- `antd` cho component nền tảng;
- `@ant-design/icons` cho toàn bộ icon;
- `@ant-design/pro-components` cho `ProLayout`, `PageContainer`, `StatisticCard`, `ProCard`, `ProTable` và `DrawerForm`.

Sidebar dùng menu nhóm có thể đóng/mở, tương phản cao trên nền navy. Toàn bộ chức năng trong cấu trúc ERP đều mở được, không còn badge phiên bản hoặc trạng thái khóa.

Chi tiết thiết kế xem tại `docs/UI_DESIGN.md`.
