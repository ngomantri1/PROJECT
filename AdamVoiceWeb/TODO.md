# TODO

## Task đang làm
- Duy trì bản MVP/SaaS Razor Pages cho dịch vụ tạo giọng có mua credits thủ công.
- Giao diện đã có logo/theme mới, mobile-first, pricing theo Starter/Pro/Business tháng/năm.

## Ưu tiên cao
- Đổi mật khẩu admin mặc định khi chạy thật.
- Thay `DataStore` JSON bằng SQL Server/PostgreSQL nếu có khách thật nhiều.
- Thêm backup tự động cho `App_Data/db.json` và `wwwroot/audio`.
- Tách config production/API key khỏi source code.
- Thêm logging file cho lỗi ElevenLabs, lỗi refund, lỗi order approval.
- Tăng bảo mật password: chuyển từ SHA256 demo sang ASP.NET Core Identity hoặc PBKDF2/BCrypt.
- Kiểm tra atomic flow trừ điểm/gọi API nếu nâng cấp đa server.

## Task chưa hoàn thành
- Chưa có thanh toán tự động; hiện chỉ chuyển khoản thủ công + admin duyệt.
- Chưa có email/SMS/Zalo notification khi admin duyệt đơn.
- Chưa có background queue cho job tạo giọng dài/chậm.
- Chưa có cleanup audio theo `BusinessRules:AudioRetentionDays`.
- Chưa có CAPTCHA/chống bot khi đăng ký.
- Chưa có reset/quên mật khẩu.
- Chưa có phân trang/tìm kiếm nâng cao cho admin, lịch sử, giao dịch.
- Chưa có export Excel/CSV doanh thu/giao dịch.
- Chưa có audit log riêng cho admin action ngoài `PointTransaction`.
- Chưa có điều khoản sử dụng/chính sách riêng dạng trang đầy đủ.

## Task cần refactor
- Tách logic tạo giọng trong `IndexModel.OnPostAsync()` thành service riêng, ví dụ `VoiceJobService`.
- Tách logic mua gói/admin duyệt thành `BillingService`.
- Tách password hashing thành `PasswordService`.
- Tách repository/storage interface để dễ đổi JSON → SQL.
- Chuẩn hóa status/type bằng enum hoặc constants thay vì string literal.
- Tách CSS lớn `app.css` thành nhóm: layout, components, pages, responsive.
- Tách admin page thành nhiều page nhỏ nếu UI tiếp tục phình to.

## Task cần test lại
- Tạo giọng mock khi không có API key.
- Tạo giọng thật khi có API key và Voice ID hợp lệ.
- Tạo giọng lỗi và kiểm tra hoàn điểm.
- User không đủ điểm → redirect sang `/Packages`.
- User bị khóa không tạo được giọng.
- Giới hạn `MaxCharactersPerJob`.
- Giới hạn `MaxJobsPer10Minutes`.
- Order pending → confirm paid → admin approve → cộng điểm đúng.
- Admin reject order không cộng điểm.
- Admin cộng/trừ điểm thủ công ghi đúng ledger.
- User tự thêm custom Voice ID và thấy voice ở `/Index`.
- User gửi request custom voice pending, admin approve/reject.
- User A không thấy voice riêng của User B.
- Mobile layout: sidebar, bottom nav, sticky create button.
- Pricing monthly/yearly và order đúng package.

## Nâng cấp nên làm sau MVP
- Dùng Cloudflare R2/S3 cho audio.
- Thêm job queue + SignalR để báo progress tạo audio.
- Thêm webhook thanh toán tự động sau khi ổn định chuyển khoản thủ công.
- Thêm quản lý đại lý/affiliate.
- Thêm preset text marketing và thư viện mẫu nội dung.
- Thêm API nội bộ nếu muốn mở cho khách tích hợp.
