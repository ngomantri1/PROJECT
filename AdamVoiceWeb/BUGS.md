# BUGS

## Bug hiện tại
- Chưa ghi nhận bug runtime chắc chắn sau bản fix gần nhất.
- Môi trường tạo project trước đó không build được trực tiếp bằng `dotnet`; cần developer build/test trên máy thật.
- `BusinessRules:AudioRetentionDays` chưa có tác dụng vì chưa có cleanup job.
- Password hash hiện là SHA256 + salt demo, chưa đạt chuẩn production mạnh.
- JSON database phù hợp MVP nhưng có rủi ro khi traffic cao hoặc chạy nhiều instance.

## Bug đã fix
### Razor malformed form/table trong Admin
- Triệu chứng: Visual Studio báo `RZ1025`, `RZ1026`, `RZ1034` ở `Pages/Admin.cshtml`.
- Nguyên nhân: `<form>` đặt sai trong `<tr>/<td>`, thẻ `tr/td/form` không cân bằng.
- Fix: tách form đúng cấu trúc, không mở form xuyên qua nhiều cell/table row.
- Vùng cần cẩn thận: mọi form trong table ở `Admin.cshtml`.

### Link ZIP UI theme lỗi tải
- Triệu chứng: UI báo lấy trạng thái tải file ZIP không thành công.
- Nguyên nhân: file ZIP chưa được tạo đúng đường dẫn trước khi trả link.
- Fix: tạo lại ZIP `AdamVoiceWeb_UITheme_v2.zip`.
- Workaround: nếu link file lỗi, kiểm tra file tồn tại thực tế trong `/mnt/data` trước khi gửi.

### Logo cũ chưa đồng bộ
- Triệu chứng: sidebar/login vẫn dùng logo giả bằng ký tự `▮▮▮`.
- Fix: thêm `wwwroot/images/*`, favicon, cập nhật `_Layout.cshtml`, `Login.cshtml`, `Register.cshtml`, CSS brand.

## Bug chưa fix / rủi ro kỹ thuật
### Race condition ngoài single process
- Hiện `DataStore` lock chỉ bảo vệ trong cùng process.
- Nếu scale nhiều instance/server, JSON DB có thể bị race/lost update.
- Workaround: chạy 1 instance hoặc chuyển SQL DB trước khi scale.

### Refund không cùng transaction vật lý với API call
- Flow hiện tại: trừ điểm → gọi API → nếu lỗi thì hoàn điểm.
- Nếu process chết giữa lúc trừ điểm và hoàn điểm, có thể cần kiểm tra thủ công ledger/job.
- Workaround: thêm status `Processing` trước khi gọi API và job recovery khi app start; hoặc dùng DB transaction + queue.

### Password hashing demo
- `DataStore.HashPassword()` dùng SHA256 + fixed salt.
- Workaround production: dùng ASP.NET Core Identity hoặc PBKDF2/BCrypt/Argon2.

### Không có phân trang lớn
- Admin/History/Transactions có thể nặng nếu dữ liệu nhiều.
- Workaround: thêm paging/filter, hoặc chuyển SQL query.

### Audio storage local
- File audio nằm trong `wwwroot/audio`.
- Rủi ro: mất file khi deploy ghi đè nhầm hoặc hết dung lượng VPS.
- Workaround: tách thư mục audio ngoài publish hoặc dùng object storage.

### ElevenLabs API thay đổi/giới hạn
- Nếu endpoint/model/voice ID thay đổi hoặc API rate limit, tạo giọng lỗi.
- Workaround: log error response, cho admin sửa Voice ID/model, giữ auto-refund.

## Nguyên nhân bug thường gặp
- Sửa Razor table/form sai nesting.
- Đổi status/type string nhưng quên update view/page model liên quan.
- Ghi đè `App_Data/db.json` khi copy project mới.
- Ghi đè `wwwroot/audio` khi publish.
- Đưa API key vào frontend hoặc commit nhầm config thật.
- Quên kiểm tra `OwnerUserId` khi query custom voice.
- Cộng/trừ điểm trực tiếp nhưng không tạo `PointTransaction`.

## Workaround tạm thời
- Trước khi update code trên server:
  - backup `App_Data/db.json`;
  - backup `wwwroot/audio`;
  - backup `appsettings.json` production.
- Nếu khách báo mất điểm:
  - kiểm tra `PointTransactions` theo user;
  - kiểm tra `VoiceJobs` status `Refunded/Completed`;
  - nếu lỗi API nhưng chưa refund, admin dùng `AdminAdjust` để hoàn.
- Nếu voice không hiện:
  - kiểm tra `VoiceOption.IsActive=true`;
  - `Status=Approved`;
  - system voice: `OwnerUserId` null/0;
  - custom voice: `OwnerUserId` đúng user.

## Vùng code dễ lỗi
- `Pages/Index.cshtml.cs`: trừ điểm, gọi API, hoàn điểm.
- `Pages/Admin.cshtml`: form trong table, nhiều handler POST.
- `Pages/Admin.cshtml.cs`: duyệt order, cộng/trừ điểm, update package/voice.
- `Pages/Packages.cshtml.cs`: tạo order, order code, period monthly/yearly.
- `Pages/MyVoices.cshtml.cs`: quyền sở hữu voice riêng.
- `Services/DataStore.cs`: normalize/seed DB, next id, JSON write.
- `Services/ElevenLabsService.cs`: API payload, lưu file audio.
- `wwwroot/js/app.js`: chỉ UX; không được xem là validation bảo mật.
