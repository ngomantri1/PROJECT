# UI DESIGN – ElevatorERP Full Menu UI

## Mục tiêu

Thiết kế giao diện ERP hiện đại, rõ ràng và có khả năng mở rộng cho khoảng 100 người sử dụng. Trong môi trường lập trình, toàn bộ menu được mở để kiểm thử giao diện và thao tác trước khi nối đầy đủ API nghiệp vụ.

## Công nghệ giao diện

- Ant Design 5
- Ant Design Icons
- Ant Design ProComponents
- Next.js App Router + TypeScript

Ant Design ProComponents được xây trên Ant Design. Project tiếp tục dùng Ant Design làm nền và dùng ProComponents cho các màn hình quản trị.

## Thành phần đã áp dụng

- `ProLayout`: khung sidebar, header và responsive mobile.
- `PageContainer`: tiêu đề, mô tả và thao tác đầu trang.
- `StatisticCard`: KPI dashboard.
- `ProCard`: nhóm nội dung và thống kê.
- `ProTable`: bảng dữ liệu desktop.
- `DrawerForm`: form nhập liệu dạng drawer.
- Ant Design `Drawer`, `Descriptions`, `Tag`, `Progress`: xem chi tiết và trạng thái.
- Mobile tự chuyển bảng thành card.

## Quy tắc menu

- Menu chia theo nghiệp vụ, không chia cứng theo phòng ban.
- Không dùng trạng thái Live/Demo/Planned.
- Không còn mục `disabled` và không còn badge V3–V9.
- Menu nhóm có thể đóng/mở để sidebar gọn hơn.
- Chữ và icon có độ tương phản cao trên nền navy.
- Các chức năng đã có permission backend tiếp tục được lọc theo permission.
- Các màn hình đang chờ API nghiệp vụ được mở cho người dùng đã đăng nhập để kiểm thử trên máy lập trình.
- Backend vẫn phải kiểm tra quyền bắt buộc khi API thật được bổ sung.

## Màn hình dùng API thật hiện có

1. Đăng nhập
2. Dashboard tổng quan
3. Đăng ký khách hàng
4. Lịch chăm sóc
5. Người dùng

## Màn hình phát triển toàn hệ thống

Toàn bộ các nhóm Kinh doanh, Dự án và thang máy, Kỹ thuật, Bảo hành và bảo trì, Kế toán, Nhân sự và Hệ thống đều có màn hình có thể mở và thao tác.

Các màn hình chưa có API riêng dùng một workspace thống nhất với:

- KPI đầu trang;
- tìm kiếm và lọc trạng thái;
- bảng dữ liệu responsive;
- thêm mới bằng DrawerForm;
- xem chi tiết;
- đánh dấu hoàn thành;
- xóa;
- khôi phục dữ liệu mẫu.

Dữ liệu của các workspace này lưu bằng `localStorage` trên máy lập trình, không ghi vào PostgreSQL.

## Phong cách

- Sidebar xanh navy đậm.
- Header trắng, tìm kiếm toàn cục và thao tác nhanh.
- Nền nội dung sáng.
- Card bo góc, khoảng trắng rõ ràng, bóng nhẹ.
- Trạng thái dùng tag màu thống nhất.
- Cột thao tác cố định bên phải.
- Desktop dùng bảng; mobile dùng card.
- Form dài mở bằng drawer.

## Nguyên tắc trước production

Trước khi đưa từng phân hệ lên production phải thay nguồn localStorage bằng API thật, bổ sung migration, permission, audit log và test workflow. Việc mở đầy đủ menu trong bản này phục vụ phát triển giao diện, không thay thế kiểm thử backend nghiệp vụ.
