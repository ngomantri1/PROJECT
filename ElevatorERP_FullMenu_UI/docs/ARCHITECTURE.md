# ARCHITECTURE

## Kiến trúc mục tiêu

- Modular Monolith.
- Next.js frontend gọi ASP.NET Core Web API.
- PostgreSQL lưu dữ liệu nghiệp vụ.
- Redis dùng cho cache và các nhu cầu realtime/background phù hợp.
- File lưu trên ổ đĩa VPS; metadata lưu PostgreSQL.
- Cookie HttpOnly dùng cho đăng nhập web.
- Quyền được kiểm tra ở cả frontend và backend.
- Một tài khoản có nhiều vai trò; quyền hiệu lực là hợp quyền từ các vai trò.

## Trạng thái source V0–V2 hiện tại

Backend hiện vẫn là **một project Web API duy nhất**, tổ chức theo các thư mục `Domain`, `Infrastructure`, `Security`; chưa tách thành các module độc lập đúng nghĩa Modular Monolith.

Redis đã có container hạ tầng nhưng chưa được backend sử dụng. SignalR, background worker/Hangfire và các module V3–V9 chưa được triển khai.

File được lưu bằng bind mount. Data Protection keys cũng được lưu bền vững để cookie đăng nhập không tự mất hiệu lực chỉ vì backend container restart.
