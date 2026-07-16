# PERMISSIONS

Mô hình dữ liệu hiện có:

`User ↔ UserRole ↔ Role ↔ RolePermission ↔ Permission`

Nguyên tắc:

- Một tài khoản có thể có nhiều vai trò.
- Quyền hiệu lực là hợp quyền từ các vai trò.
- Phiên bản đầu chỉ dùng quyền cho phép; chưa dùng `DENY`.
- Frontend lọc menu theo permission.
- Backend dùng `RequirePermission(...)` và trả `403` khi thiếu quyền.

## Trạng thái hiện tại

Source V0–V2 mới thực thi phạm vi dữ liệu đơn giản:

- `ALL` và `DEPARTMENT` được coi là phạm vi quản lý khi xem khách hàng/lịch chăm sóc.
- Các vai trò khác chỉ xem dữ liệu do mình phụ trách.

Các phạm vi mục tiêu `ASSIGNED`, `TEAM`, `BRANCH`, quyền theo dự án, trường nhạy cảm, trạng thái workflow và hạn mức duyệt **chưa được triển khai đầy đủ**.
