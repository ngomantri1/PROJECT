# PROJECT_CONTEXT

## Tổng quan
- Project: **AdamVoiceWeb**
- Loại sản phẩm: web SaaS tạo giọng nói AI tiếng Việt cho khách hàng phổ thông.
- Mục tiêu chính:
  - khách đăng ký tài khoản;
  - mua credits bằng chuyển khoản thủ công;
  - admin duyệt đơn và cộng điểm;
  - khách dùng điểm để tạo file audio MP3.
- Trạng thái hiện tại:
  - nghiệp vụ trừ/hoàn điểm đã hoạt động;
  - UI trang tạo giọng đã được tối ưu mạnh cho desktop và mobile;
  - tạo giọng hiện là flow async, không reload toàn trang.

## Công nghệ sử dụng
- ASP.NET Core Razor Pages / C#
- Cookie Authentication
- JSON local datastore: `App_Data/db.json`
- Frontend:
  - Razor `.cshtml`
  - CSS thuần: `wwwroot/css/app.css`
  - JS thuần: `wwwroot/js/app.js`
- TTS provider: ElevenLabs qua `Services/ElevenLabsService.cs`
- Mock/demo audio khi chưa cấu hình API key

## Flow hoạt động chính

### Đăng ký / đăng nhập
- `Register.cshtml.cs`: tạo user mới, hash password, seed điểm test theo logic hiện có.
- `Login.cshtml.cs`: xác thực username/password, kiểm tra khóa tài khoản, tạo cookie claims.
- Role đang dùng:
  - `Admin`
  - `Member`

### Tạo giọng nói
1. User nhập nội dung tại `/Index`.
2. JS đếm ký tự theo thời gian thực.
3. User chọn giọng đọc qua popup chọn giọng hoặc dùng giọng đã lưu từ lần trước.
4. User chỉnh preset giọng:
   - `Bình thường`
   - `Hài hước`
   - `Quảng cáo`
   - `Truyền cảm`
   - `Tin tức`
   - `TikTok Trend`
5. Khi bấm tạo:
   - mở modal xác nhận nội bộ, không dùng `window.confirm()`;
   - sau khi đồng ý, JS submit async qua handler `Generate`;
   - UI chuyển focus ngay sang `Lịch sử gần đây`;
   - chèn item pending `Đang tạo...` ngay lập tức.
6. Server:
   - validate text;
   - validate voice;
   - validate quyền user;
   - validate limit ký tự, limit spam, số dư điểm;
   - normalize text nếu bật `AutoNormalize`;
   - trừ điểm và ghi transaction `UsePoint`;
   - gọi ElevenLabs.
7. Thành công:
   - lưu `VoiceJob` trạng thái `Completed`;
   - cập nhật `RecentHistory` trả về dạng JSON;
   - hiển thị thông báo thành công dạng nổi, tự ẩn sau 2 giây;
   - không reload cả trang.
8. Lỗi:
   - hoàn điểm;
   - tạo transaction `RefundPoint`;
   - lưu `VoiceJob` trạng thái `Refunded`;
   - trả lỗi về UI.

### Mua gói / credits
1. User vào `/Packages`, chọn chu kỳ tháng hoặc năm.
2. Chọn gói Starter / Pro / Business.
3. Tạo `PurchaseOrder` trạng thái `Pending`.
4. Hệ thống sinh `OrderCode` và `TransferContent`.
5. User chuyển khoản thủ công và xác nhận đã chuyển khoản.
6. Admin duyệt order tại `/Admin`.
7. Khi duyệt:
   - order chuyển `Paid`;
   - cộng điểm;
   - tạo transaction `PurchaseApproved`.

### Giọng của bạn
- `/MyVoices` cho user quản lý giọng riêng.
- Có 2 kiểu:
  - user tự thêm `Voice ID` đã có;
  - user gửi request voice riêng để admin duyệt.
- Admin duyệt bằng cách điền `ApiVoiceId`, `PointRate`, note.
- Voice riêng chỉ hiển thị với `OwnerUserId` tương ứng.

## Coding rules
- Không bỏ validate server-side dù frontend đã chặn.
- Mọi thay đổi điểm phải đi qua transaction có:
  - `BalanceBefore`
  - `BalanceAfter`
  - `PointAmount`
  - `Type`
- Chỉ đọc/ghi DB qua `DataStore.Read()` hoặc `DataStore.Update()`.
- Không ghi trực tiếp `App_Data/db.json` từ PageModel.
- Không đưa ElevenLabs API key ra client.
- Không tạo audio nếu chưa trừ điểm thành công.
- Nếu tạo audio lỗi sau khi trừ điểm, bắt buộc hoàn điểm.
- Không cho user thấy voice riêng của user khác.
- Không phá local persistence đang dùng cho UX:
  - draft text;
  - selected voice;
  - selected preset;
  - recent voices.

## Naming rules
- Model dùng PascalCase:
  - `AppUser`
  - `VoiceOption`
  - `PointPackage`
  - `PurchaseOrder`
  - `VoiceJob`
  - `PointTransaction`
- PageModel theo tên page:
  - `IndexModel`
  - `PackagesModel`
  - `AdminModel`
- Status string đang dùng:
  - Order: `Pending`, `Paid`, `Cancelled`
  - VoiceJob: `Processing`, `Completed`, `Failed`, `Refunded`
  - VoiceOption: `Approved`, `Pending`, `Rejected`
  - Transaction: `Completed`, `Pending`, `Cancelled`
- Transaction type:
  - `UsePoint`
  - `RefundPoint`
  - `PurchaseApproved`
  - `AdminAdjust`
  - `AddPoint`

## Rule quan trọng
- **Điểm = tiền**: mọi thay đổi điểm phải audit được.
- **Audio đã tạo = cache**: nghe lại / tải lại không trừ điểm.
- **Voice ownership**:
  - system voice dùng chung;
  - custom voice chỉ chủ sở hữu thấy.
- **Voice ID khác Model ID**:
  - `ApiVoiceId` là ID giọng;
  - `DefaultModelId` là model ElevenLabs;
  - không được map nhầm 2 giá trị này.
- **Mock mode** chỉ phục vụ local/demo.
- **UI async chỉ là trình bày**: server vẫn là nguồn đúng cuối cùng cho điểm, voice, quyền, trạng thái job.

## WebSocket flow
- Hiện tại **không dùng WebSocket / SignalR**.
- Tất cả cập nhật realtime đang là giả lập qua:
  - fetch async;
  - pending item trên UI;
  - re-render danh sách lịch sử từ JSON response.
- Nếu thêm realtime sau này:
  - chỉ dùng để báo trạng thái job;
  - không chuyển nghiệp vụ trừ/hoàn điểm ra khỏi server transaction flow.

## Pending flow

### Purchase pending
- `PurchaseOrder.Status = Pending`: order đã tạo, chờ admin đối soát.
- `ConfirmedAt`: user đã bấm xác nhận chuyển khoản.
- `Paid`: admin duyệt và cộng điểm.
- `Cancelled`: hủy order.

### Custom voice pending
- `VoiceOption.Status = Pending`
- `OwnerUserId != null`
- `IsSystemVoice = false`
- Sau duyệt:
  - `Status = Approved`
  - `IsActive = true`
  - có `ApiVoiceId`

### Voice job pending
- Chưa có queue/background worker thật.
- Pending hiện tại là **pending UI**:
  - JS chèn item `Đang tạo giọng...` vào `RecentHistory`;
  - khi server trả thành công thì thay bằng item thật;
  - khi lỗi thì xóa pending item và hiển thị alert.

## Threading / UI rules
- Razor Pages chạy request/response, không có desktop UI thread.
- `DataStore` dùng `_lock` để tránh ghi JSON đồng thời trong cùng process.
- Không dùng `.Result` hoặc `.Wait()` với `ElevenLabsService`.
- `app.js` chỉ xử lý UX:
  - popup;
  - preset;
  - audio player;
  - localStorage;
  - async partial update.
- Trên mobile:
  - sidebar là drawer;
  - `Giọng nói` và `Lịch sử` là bottom-sheet/popup;
  - popup chọn giọng và popup xác nhận phải hiển thị gọn, không phá vùng nhập.
- Trên desktop:
  - trang tạo giọng ưu tiên 3 vùng nhìn thấy cùng lúc;
  - không để scroll chồng chéo vô nghĩa giữa 3 cột.

## Những điều tuyệt đối không được phá
- Không phá logic:
  - tạo mới thì trừ điểm;
  - nghe lại / tải lại không trừ điểm.
- Không phá auto-refund khi ElevenLabs lỗi.
- Không bỏ `BalanceBefore / BalanceAfter` trong transaction.
- Không bỏ kiểm tra `OwnerUserId` khi lấy custom voice.
- Không đưa API key ra client.
- Không làm mất local draft text.
- Không làm mỗi lần tạo giọng reload cả trang như flow cũ.
- Không để nhiều audio trong lịch sử phát song song.
- Không làm popup mobile che sai hoặc đẩy vỡ layout nhập nội dung.
