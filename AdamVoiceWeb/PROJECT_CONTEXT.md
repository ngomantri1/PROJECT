# PROJECT_CONTEXT

## Tổng quan
- Project: **AdamVoiceWeb**
- Loại sản phẩm: web SaaS tạo giọng nói AI tiếng Việt.
- Mục tiêu chính:
  - người dùng đăng nhập bằng Google;
  - mua credits bằng chuyển khoản thủ công;
  - admin duyệt đơn và cộng điểm;
  - người dùng dùng điểm để tạo file audio MP3.

## Trạng thái hiện tại
- Nguồn dữ liệu chính đã chuyển sang **SQLite**, không còn lấy `App_Data/db.json` làm datastore runtime chính.
- Audio đang lưu local theo `Storage:DataRootPath`; cấu hình hiện tại là `"."` nên runtime đang dùng:
  - `app.db` ở thư mục gốc project;
  - `audio/` ở thư mục gốc project.
- `App_Data/db.json` chỉ còn vai trò **legacy import** khi bootstrap DB trống.
- Đăng nhập Google đã hoạt động; admin được xác định theo danh sách email cấu hình.
- Trang mua gói đã có:
  - tạo/reuse đơn đang mở;
  - popup bước 2;
  - QR chuyển khoản sinh local;
  - trạng thái `Pending` và `Reported`.
- Trang tạo giọng đang là flow async, không reload toàn trang.
- `Enhance` hiện là tùy chọn **ẩn phía server**:
  - người dùng chỉ bật/tắt bằng nút `Enhance`;
  - nội dung hiển thị trong ô nhập không cần chèn tag biểu cảm;
  - server có thể AI-enhance trước khi gửi sang ElevenLabs.

## Công nghệ sử dụng
- ASP.NET Core Razor Pages / C#
- EF Core + SQLite
- Cookie Authentication + Google OAuth
- Frontend:
  - Razor `.cshtml`
  - CSS thuần: `wwwroot/css/app.css`
  - JS thuần: `wwwroot/js/app.js`
- TTS provider: ElevenLabs qua `Services/ElevenLabsService.cs`
- AI Enhance: `Services/AiEnhanceService.cs`
  - ưu tiên OpenAI Responses API nếu có `OpenAI:ApiKey`;
  - fallback về rule-based enhance nếu chưa cấu hình key.

## Flow hoạt động chính

### Đăng nhập
1. Người dùng vào `/Login`.
2. Bấm đăng nhập bằng Google.
3. ASP.NET Core OAuth nhận callback `/signin-google`.
4. Hệ thống tìm hoặc tạo user theo `AuthProvider = Google` và `ExternalId`.
5. Nếu email nằm trong `Authentication:Google:AdminEmails` thì gán role `Admin`, ngược lại là `Member`.

Ghi chú:
- `Register` / password login cũ hiện không còn là flow chính của sản phẩm.
- Tài liệu và code mới phải ưu tiên Google login là mặc định.

### Tạo giọng nói
1. Người dùng nhập nội dung tại `/Index`.
2. JS đếm ký tự theo thời gian thực.
3. Người dùng chọn giọng và chỉnh các tham số:
  - tốc độ đọc;
  - độ ổn định;
  - độ giống giọng;
  - phong cách.
4. Có 2 tùy chọn xử lý text:
  - `Tự tối ưu văn bản tiếng Việt trước khi tạo giọng`;
  - `Enhance`.
5. Khi bấm tạo:
  - submit async qua handler `Generate`;
  - UI chèn item pending vào lịch sử gần đây;
  - không reload toàn trang.
6. Server:
  - validate text, voice, quyền user, limit spam, số dư điểm;
  - normalize text nếu bật `AutoNormalize`;
  - nếu bật `Enhance` thì server có thể gọi `AiEnhanceService`;
  - gọi ElevenLabs để sinh audio;
  - trừ điểm theo `CharacterCount` của nội dung gốc đã normalize, không lấy số ký tự sau enhance để tính tiền.
7. Thành công:
  - lưu `VoiceJob` trạng thái `Completed`;
  - cập nhật lịch sử;
  - trả toast nổi cho UI.
8. Lỗi:
  - hoàn điểm;
  - tạo `PointTransaction` loại `RefundPoint`;
  - lưu `VoiceJob` trạng thái `Refunded`.

### Enhance
- Mục tiêu UX hiện tại:
  - chỉ có nút/toggle `Enhance`;
  - không bắt buộc hiển thị tag biểu cảm vào textarea cho người dùng.
- Mục tiêu nghiệp vụ:
  - khi bật `Enhance`, server enrich text trước khi gửi sang ElevenLabs;
  - đầu ra giọng đọc giàu cảm xúc hơn flow thường;
  - không làm thay đổi nghĩa nội dung gốc.
- `AiEnhanceService` hiện có 2 mode:
  - AI thật qua OpenAI nếu có key;
  - fallback rule-based nếu chưa có key hoặc AI lỗi.

### Mua gói / credits
1. Người dùng vào `/Packages`, chọn chu kỳ tháng hoặc năm.
2. Bấm `Mua ngay` ở gói muốn mua.
3. Hệ thống:
  - nếu đã có đơn mở `Pending` hoặc `Reported` thì reuse đơn đó;
  - hiển thị toast cảnh báo màu đỏ, tự ẩn sau 3 giây;
  - mở popup bước 2 để người dùng tiếp tục theo dõi.
4. Popup bước 2 hiển thị:
  - tóm tắt gói;
  - số tiền;
  - credits;
  - nội dung chuyển khoản;
  - QR chuyển khoản sinh local;
  - thông tin ngân hàng / chủ tài khoản / số tài khoản.
5. Khi người dùng bấm `Tôi đã chuyển khoản`:
  - đơn chuyển từ `Pending` sang `Reported`;
  - ghi `ConfirmedAt`;
  - admin có thể lọc để duyệt nhanh hơn.
6. Admin duyệt:
  - đơn chuyển `Paid`;
  - cộng điểm;
  - tạo transaction `PurchaseApproved`.

## Lưu trữ runtime
- `Storage:DataRootPath = "."`:
  - `app.db`: database SQLite chính;
  - `audio/`: file audio đã tạo.
- Nếu `Storage:DataRootPath` để trống:
  - app fallback sang `App_RuntimeData/`.
- `AppDataPaths` là nơi resolve path runtime.
- Không hardcode đường dẫn ổ đĩa như `D:\...` trong nghiệp vụ.

## Coding rules
- Không bỏ validate server-side dù frontend đã chặn.
- Mọi thay đổi điểm phải đi qua transaction có:
  - `BalanceBefore`
  - `BalanceAfter`
  - `PointAmount`
  - `Type`
- Không truy cập dữ liệu nghiệp vụ bằng ghi file JSON trực tiếp.
- Dùng `AppDbContext` cho dữ liệu chính.
- Chỉ ghi file runtime qua path do `AppDataPaths` cấp.
- Không đưa ElevenLabs API key, Google ClientSecret, OpenAI API key ra client.
- Không tạo audio nếu chưa trừ điểm thành công.
- Nếu tạo audio lỗi sau khi trừ điểm, bắt buộc hoàn điểm.
- Không cho người dùng thấy custom voice của người khác.
- Không phá local persistence đang dùng cho UX:
  - draft text;
  - selected voice;
  - selected preset;
  - recent voices.

## Rule quan trọng
- **Điểm = tiền**: mọi thay đổi điểm phải audit được.
- **Audio đã tạo = cache**: nghe lại / tải lại không trừ điểm.
- **Google login là flow chính**: password flow cũ chỉ được xem là legacy nếu còn tồn tại.
- **Voice ID khác Model ID**:
  - `ApiVoiceId` là ID giọng;
  - `DefaultModelId` là model ElevenLabs.
- **Enhance là xử lý server-side**:
  - UI không phải là nguồn sự thật cho text đã enhance;
  - phần gọi AI và phần gửi ElevenLabs phải được kiểm soát ở backend.

## WebSocket / realtime
- Hiện tại **không dùng WebSocket / SignalR**.
- Realtime đang là giả lập qua:
  - fetch async;
  - pending item;
  - re-render lịch sử từ JSON response.

## Những điều tuyệt đối không được phá
- Không phá logic:
  - tạo mới thì trừ điểm;
  - nghe lại / tải lại không trừ điểm.
- Không phá auto-refund khi ElevenLabs lỗi.
- Không bỏ `BalanceBefore / BalanceAfter`.
- Không hardcode path máy dev vào code nghiệp vụ.
- Không làm mất `app.db` hoặc `audio/` khi đổi môi trường chạy.
