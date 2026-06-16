# TODO

## Task đang làm
- Ổn định UX của trang `/Index` sau đợt redesign lớn:
  - async generate;
  - popup chọn giọng;
  - popup xác nhận tạo giọng;
  - lịch sử gần đây;
  - mobile bottom-sheet/popup;
  - toast nổi 2 giây.

## Ưu tiên cao
- Đổi mật khẩu admin mặc định khi chạy thật.
- Tách config production/API key khỏi source code.
- Thêm logging chi tiết cho:
  - ElevenLabs error
  - refund flow
  - order approval
  - async generate handler
- Chuẩn hóa lại build flow để không còn dùng `dotnet build -o` ở solution level.
- Backup tự động cho:
  - `App_Data/db.json`
  - `wwwroot/audio`
- Xem xét chuyển `DataStore` JSON sang SQL Server/PostgreSQL trước khi scale thật.

## Task chưa hoàn thành
- Chưa có thanh toán tự động; vẫn là chuyển khoản thủ công + admin duyệt.
- Chưa có queue/background job thật cho tạo giọng dài/chậm.
- Chưa có cleanup audio theo `BusinessRules:AudioRetentionDays`.
- Chưa có quên mật khẩu / reset mật khẩu.
- Chưa có CAPTCHA/chống bot khi đăng ký.
- Chưa có phân trang/lọc mạnh cho:
  - admin
  - history
  - transactions
- Chưa có export CSV/Excel.
- Chưa có audit log riêng cho admin ngoài `PointTransaction`.
- Chưa có thông báo email/Zalo khi order được duyệt.

## Task cần refactor
- Tách logic tạo giọng trong `IndexModel` thành service riêng, ví dụ `VoiceJobService`.
- Tách logic billing/order/admin approve thành `BillingService`.
- Tách phần localStorage/UI state trong `app.js` thành nhóm hàm nhỏ hơn.
- Tách `app.css` thành:
  - layout
  - components
  - pages
  - responsive
- Chuẩn hóa status/type bằng constants hoặc enum thay vì string rải rác.
- Giảm coupling giữa `_Layout.cshtml` và JS point-balance update.

## Task ưu tiên test lại
- Flow async tạo giọng:
  - mở confirm modal;
  - tạo pending item;
  - focus sang lịch sử ngay lúc pending;
  - render lại item completed.
- Success toast:
  - nổi đè lên layout;
  - tự ẩn sau 2 giây;
  - không làm xê dịch composer.
- Voice picker:
  - search;
  - filter `Tất cả / Giọng của bạn / Gần đây`;
  - preview voice;
  - giữ selected voice cho lần sau.
- Preset:
  - giữ preset cho lần sau;
  - text active phải trắng;
  - mobile hiển thị nhiều dòng, không kéo ngang.
- Draft text:
  - lưu localStorage;
  - mở lại trang vẫn còn;
  - nút xóa hoạt động đúng.
- History player:
  - không phát song song;
  - icon play/pause đổi đúng;
  - seek bar hoạt động trên desktop và mobile;
  - `RecentHistory` có nút tải xuống.
- Mobile popup:
  - popup `Giọng nói`
  - popup `Lịch sử`
  - popup `Chọn giọng`
  - popup xác nhận tạo giọng
- Sidebar point display:
  - điểm hiển thị dưới logo;
  - topbar không còn card điểm.

## Task cần test nghiệp vụ lại
- Tạo giọng mock khi không có API key.
- Tạo giọng thật với `DefaultModelId` hợp lệ và `ApiVoiceId` hợp lệ.
- Trường hợp `model_not_found` / `voice not found` phải hoàn điểm đúng.
- User không đủ điểm.
- User bị khóa.
- `MaxCharactersPerJob`.
- `MaxJobsPer10Minutes`.
- Order pending → confirm → admin approve → cộng điểm đúng.
- Admin reject order không cộng điểm.
- User A không thấy custom voice của user B.

## Nâng cấp nên làm sau MVP
- Dùng object storage như S3/R2 cho audio.
- Thêm queue + SignalR nếu cần realtime thật.
- Webhook thanh toán tự động.
- Affiliate / giới thiệu bạn bè thật sự.
- Library preset nội dung marketing / bán hàng / TikTok.
- API nội bộ cho khách tích hợp.
