# PROJECT_CONTEXT

## Tổng quan
- Project: **AdamVoiceWeb** - web SaaS tạo giọng nói/Text-to-Speech cho khách hàng.
- Mục tiêu kinh doanh: khách mua credits/điểm bằng chuyển khoản thủ công, admin duyệt và cộng điểm; khách dùng điểm để tạo file audio.
- Nghiệp vụ cốt lõi:
  - Chỉ trừ điểm khi tạo audio mới.
  - Nghe lại/tải lại file đã tạo không trừ điểm.
  - Nếu tạo audio lỗi, hệ thống hoàn điểm tự động.
  - Khách có thể dùng giọng hệ thống hoặc giọng riêng đã được duyệt.

## Công nghệ sử dụng
- .NET 8
- ASP.NET Core Razor Pages
- Cookie Authentication
- JSON file database: `App_Data/db.json`
- Frontend: Razor `.cshtml`, CSS thuần `wwwroot/css/app.css`, JS thuần `wwwroot/js/app.js`
- TTS provider: ElevenLabs API qua `ElevenLabsService`
- Mock audio WAV khi chưa cấu hình API key

## Flow hoạt động chính
### Đăng ký/đăng nhập
- `Register.cshtml.cs`: tạo user mới, hash password, tặng điểm test.
- `Login.cshtml.cs`: xác thực username/password, kiểm tra khóa tài khoản, tạo cookie claims.
- Role hiện có: `Admin`, `Member`.

### Tạo giọng nói
1. User nhập text tại `/Index`.
2. JS đếm ký tự và ước tính điểm theo `VoiceOption.PointRate`.
3. Khi submit, `IndexModel.OnPostAsync()` xử lý server-side.
4. Server normalize text nếu bật `AutoNormalize`.
5. Kiểm tra:
   - text không rỗng;
   - không vượt `BusinessRules:MaxCharactersPerJob`;
   - user không bị khóa;
   - không vượt `BusinessRules:MaxJobsPer10Minutes`;
   - voice hợp lệ và thuộc quyền user nếu là voice riêng;
   - đủ điểm.
6. Trừ điểm và tạo `PointTransaction` loại `UsePoint`.
7. Gọi `ElevenLabsService.GenerateSpeechAsync()`.
8. Thành công: lưu `VoiceJob` status `Completed`, audio vào `wwwroot/audio`.
9. Lỗi: hoàn điểm, tạo transaction `RefundPoint`, lưu job `Refunded`.

### Mua gói/credits
1. User vào `/Packages`, chọn `Monthly` hoặc `Yearly`.
2. User chọn Starter/Pro/Business.
3. `OnPostCreateOrder()` tạo `PurchaseOrder` status `Pending`.
4. Hệ thống sinh `OrderCode` và `TransferContent`.
5. User chuyển khoản thủ công, bấm xác nhận đã chuyển khoản.
6. Admin vào `/Admin`, duyệt đơn.
7. Khi duyệt: order chuyển `Paid`, cộng điểm, tạo `PointTransaction` loại `PurchaseApproved`.

### Giọng của bạn
- `/MyVoices` cho khách quản lý voice riêng.
- Khách có thể:
  - thêm voice bằng Voice ID có sẵn;
  - gửi yêu cầu clone/tạo voice riêng.
- Admin duyệt trong `/Admin` bằng cách điền `ApiVoiceId`, rate và note.
- Voice riêng chỉ hiển thị cho `OwnerUserId` tương ứng.

## Coding rules
- Không bỏ qua kiểm tra server-side dù frontend đã validate.
- Mọi thay đổi điểm phải đi qua transaction có `BalanceBefore`, `BalanceAfter`, `PointAmount`, `Type`.
- Mọi thao tác đọc/ghi database phải dùng `DataStore.Read()` hoặc `DataStore.Update()`.
- Không ghi trực tiếp `App_Data/db.json` từ page model.
- Không để API key ở frontend, JS, HTML hoặc view.
- Không tạo audio nếu chưa trừ điểm thành công.
- Nếu audio tạo lỗi sau khi trừ điểm, bắt buộc hoàn điểm.
- Không cho user truy cập voice riêng của user khác.
- Không xóa cứng dữ liệu giao dịch điểm; dùng status/ẩn nếu cần.

## Naming rules
- Models dùng PascalCase: `AppUser`, `VoiceOption`, `PointPackage`, `PurchaseOrder`, `VoiceJob`, `PointTransaction`.
- PageModel theo tên page: `IndexModel`, `PackagesModel`, `AdminModel`.
- Status string hiện dùng đúng chữ:
  - Order: `Pending`, `Paid`, `Cancelled`
  - VoiceJob: `Processing`, `Completed`, `Failed`, `Refunded`
  - VoiceOption: `Approved`, `Pending`, `Rejected`
  - Transaction: `Completed`, `Pending`, `Cancelled`
- Transaction type hiện dùng:
  - `UsePoint`, `RefundPoint`, `PurchaseApproved`, `AdminAdjust`, `AddPoint`

## Rule quan trọng
- **Điểm = tiền**: mọi thay đổi điểm phải audit được.
- **Audio đã tạo = cache**: nghe lại/tải lại không gọi API và không trừ điểm.
- **Voice ownership**: system voice dùng chung; custom voice chỉ chủ sở hữu thấy.
- **Admin không được bị khóa bằng UI hiện tại**.
- **Mock mode** chỉ để test local khi không có API key.
- **DataStore là JSON file**: phù hợp MVP, cần backup khi chạy thật.

## WebSocket flow
- Hiện tại **không có WebSocket/SignalR**.
- UI dùng request/response Razor Pages và redirect sau POST.
- Nếu thêm realtime sau này, không thay đổi nghiệp vụ trừ/hoàn điểm trong `IndexModel` nếu chưa có transaction-safe queue.

## Pending flow
### Purchase pending
- `PurchaseOrder.Status = Pending`: đơn đã tạo, chờ admin kiểm tra chuyển khoản.
- `ConfirmedAt`: user đã bấm “Tôi đã chuyển khoản”.
- `Paid`: admin đã duyệt và cộng điểm.
- `Cancelled`: user/admin hủy.

### Custom voice pending
- `VoiceOption.Status = Pending`, `OwnerUserId != null`, `IsSystemVoice = false`.
- Admin duyệt bằng `OnPostApproveCustomVoice`.
- Sau duyệt: `Status = Approved`, `IsActive = true`, có `ApiVoiceId`.

### Voice job pending
- Hiện chưa có queue/background job thật.
- Tạo audio xử lý đồng bộ trong request `IndexModel.OnPostAsync()`.
- `Processing` có trong model nhưng chưa dùng như flow độc lập.

## Threading/UI rules
- Razor Pages chạy request/response; không có UI thread như desktop.
- `DataStore` dùng `_lock` để tránh ghi JSON đồng thời trong cùng process.
- Không gọi `DataStore.Read()` rồi tự sửa object mà không `Write/Update`.
- `ElevenLabsService` async; không block bằng `.Result` hoặc `.Wait()`.
- JS chỉ hỗ trợ UX: đếm ký tự, preset, confirm, copy text, mobile sidebar.
- Server mới là nguồn सत्य cho điểm, quyền voice, giới hạn spam.

## Những điều tuyệt đối không được phá
- Không phá logic: tạo mới trừ điểm, nghe lại không trừ điểm.
- Không phá auto-refund khi ElevenLabs lỗi.
- Không bỏ `BalanceBefore/BalanceAfter` trong transaction.
- Không bỏ kiểm tra `OwnerUserId` khi lấy voice.
- Không đưa ElevenLabs API key ra client.
- Không xóa `App_Data/db.json` khi update/publish nếu đang có dữ liệu thật.
- Không ghi đè `wwwroot/audio` nếu cần giữ file khách.
- Không đổi status/type string tùy tiện vì nhiều view/page phụ thuộc.
