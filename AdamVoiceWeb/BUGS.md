# BUGS

## Bug/rủi ro hiện tại

### Secrets đang nằm trong `appsettings.json`
- Mức độ: nghiêm trọng.
- Hiện có key/secret cấu hình trực tiếp trong source.
- Rủi ro:
  - lộ API key;
  - lộ Google OAuth secret;
  - khó tách môi trường dev/prod.

### Client-side Enhance còn code legacy
- Triệu chứng:
  - `wwwroot/js/app.js` vẫn còn dấu vết flow enhance kiểu cũ:
    - gọi `?handler=EnhanceText`;
    - xử lý `enhanceEditor`, `enhanceTextOverlay`, `enhanceOriginal`.
- Hiện định hướng sản phẩm đã đổi:
  - chỉ giữ nút `Enhance`;
  - phần enrich text chạy ngầm phía server.
- Rủi ro:
  - hành vi UI/backend dễ lệch nhau;
  - sau này sửa tiếp dễ phát sinh bug ẩn.

### Debug process đôi lúc thoát bất thường
- Triệu chứng:
  - chạy một thời gian thì process `AdamVoiceWeb.exe` có thể thoát với code `-1`;
  - chưa thu được stack trace rõ nguyên nhân.
- Trạng thái:
  - chưa chốt nguyên nhân gốc;
  - cần tăng logging / bắt unhandled exception tốt hơn.

### `AudioRetentionDays` chưa có cleanup job thật
- Cấu hình đã có nhưng chưa có job dọn file/audio cũ.
- Rủi ro:
  - đầy dung lượng disk theo thời gian.

### SQLite + audio local chưa phù hợp cho multi-instance
- Trạng thái hiện tại phù hợp web nhỏ / 1 server.
- Rủi ro khi scale ngang:
  - mỗi instance có thể có `app.db` và `audio/` riêng;
  - khó đồng bộ file audio;
  - backup/restore phải làm đúng theo node đang chạy.

### AI Enhance phụ thuộc cấu hình OpenAI
- Nếu không có `OpenAI:ApiKey`:
  - app fallback sang enhance rule-based;
  - chất lượng biểu cảm sẽ kém phong phú hơn AI thật.
- Đây không phải bug blocking, nhưng là giới hạn chất lượng hiện tại.

## Bug đã fix

### Chuyển runtime chính từ JSON sang SQLite
- Trước đây app phụ thuộc `App_Data/db.json`.
- Hiện đã chuyển sang:
  - `AppDbContext`
  - `app.db`
  - `SqliteBootstrapService`
- `App_Data/db.json` chỉ còn để import legacy.

### Đường dẫn runtime không còn hardcode ổ đĩa
- Trước đây người dùng cần nghĩ tới kiểu `D:\AdamVoiceData\...`.
- Hiện app lấy path qua `Storage:DataRootPath`.
- Cấu hình hiện tại dùng `"."` nên tự chạy theo thư mục project/deploy.

### Login/Register lỗi LINQ không translate được với SQLite
- Triệu chứng cũ:
  - `string.Equals(..., StringComparison.OrdinalIgnoreCase)` gây lỗi LINQ translate.
- Kết quả:
  - flow login/register cũ đã được sửa để tương thích SQLite.

### Mua gói lỗi LINQ trên SQLite
- Triệu chứng cũ:
  - query phần gói năm / discount từng lỗi không translate được.
- Kết quả:
  - flow `/Packages` đã được sửa để chạy ổn với SQLite.

### QR thanh toán lấy ngoài bị chậm/không ổn định
- Triệu chứng cũ:
  - QR có lúc ra, có lúc không;
  - phụ thuộc dịch vụ ngoài nên chậm.
- Fix:
  - chuyển sang sinh QR local để ổn định và nhanh hơn.

### Đơn mua gói thiếu trạng thái phân biệt sau khi user báo chuyển khoản
- Triệu chứng cũ:
  - user bấm đã chuyển khoản nhưng đơn vẫn khó phân biệt với `Pending`.
- Fix:
  - thêm trạng thái `Reported`;
  - admin ưu tiên duyệt các đơn `Reported`.

### Đã có đơn mở nhưng user không được báo rõ
- Triệu chứng cũ:
  - bấm mua tiếp hoặc báo chuyển khoản lại mà thiếu thông báo rõ ràng.
- Fix:
  - hệ thống reuse đơn `Pending`/`Reported`;
  - hiển thị toast cảnh báo màu đỏ;
  - toast tự ẩn sau 3 giây;
  - toast nổi, không xô layout.

### Runtime file trong root làm `dotnet watch` dễ bị kích
- Triệu chứng cũ:
  - khi lưu `app.db` / `audio/` ngay trong project root, watcher dev có thể bị ảnh hưởng.
- Fix:
  - thêm `Watch="false"` trong `AdamVoiceWeb.csproj` cho:
    - `app.db`
    - `app.db-*`
    - `audio/**/*`
    - `App_RuntimeData/**/*`

## Rủi ro kỹ thuật còn lại

### Refund không nằm trong một transaction vật lý với API call ngoài
- Flow hiện tại:
  - trừ điểm
  - gọi ElevenLabs
  - nếu lỗi thì hoàn điểm
- Nếu process chết đúng giữa đoạn này:
  - có thể cần recovery thủ công.

### Password flow cũ còn tồn tại ở mức code
- Sản phẩm đã chuyển hướng sang Google login là chính.
- Nếu page/endpoint password cũ còn mở:
  - dễ gây hiểu nhầm;
  - tăng diện tích bảo trì;
  - có thể phát sinh bug auth song song 2 flow.

## Workaround tạm thời
- Trước khi update production:
  - backup `app.db`
  - backup thư mục `audio/`
  - backup file config theo môi trường
- Nếu khách báo mất điểm:
  - kiểm tra `PointTransactions`
  - kiểm tra `VoiceJobs`
  - nếu cần, hoàn thủ công bằng `AdminAdjust`
- Nếu `Enhance` cho output chưa đủ phong phú:
  - kiểm tra `OpenAI:ApiKey`
  - kiểm tra `OpenAI:EnhanceModel`
  - nếu chưa có key thì hiểu rằng app đang dùng fallback rule-based

## Vùng code dễ lỗi
- `Pages/Index.cshtml.cs`
  - trừ điểm
  - hoàn điểm
  - hidden enhance
  - async generate JSON flow
- `Pages/Packages.cshtml.cs`
  - tạo/reuse đơn
  - đổi trạng thái `Pending` / `Reported` / `Paid`
- `wwwroot/js/app.js`
  - pending history
  - toast nổi
  - mobile popup
  - enhance legacy cleanup
- `Services/AiEnhanceService.cs`
  - prompt AI
  - validate không đổi nghĩa text gốc
- `Services/ElevenLabsService.cs`
  - payload/model/voice mapping
  - lưu file audio
