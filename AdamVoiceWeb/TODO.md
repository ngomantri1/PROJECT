# TODO

## Ưu tiên cao
- Dọn secrets ra khỏi source code:
  - `ElevenLabs:ApiKey`
  - `Authentication:Google:ClientSecret`
  - `OpenAI:ApiKey`
- Dọn nốt legacy auth:
  - chặn hoặc bỏ hẳn flow `Register` / password login cũ nếu sản phẩm đã chốt dùng Google login.
- Cleanup luồng `Enhance` phía client:
  - xóa code preview/tag cũ còn sót trong `wwwroot/js/app.js`;
  - nếu không còn dùng preview thủ công thì bỏ endpoint/JS thừa liên quan `EnhanceText`.
- Thêm logging chi tiết hơn cho:
  - ElevenLabs error;
  - OpenAI enhance error;
  - refund flow;
  - order approval;
  - process exit bất thường khi debug.
- Backup tự động cho:
  - `app.db`
  - thư mục `audio/`
- Thêm cleanup audio theo `BusinessRules:AudioRetentionDays`.

## Task đang mở
- Rà lại hoàn toàn trang `/Index` sau loạt thay đổi gần đây:
  - Google login;
  - SQLite runtime;
  - hidden AI Enhance;
  - toast nổi;
  - button layout desktop/mobile.
- Rà lại trang `/Packages` trên mobile:
  - popup bước 2 chỉ mở đúng khi user bấm `Mua ngay`;
  - không tự bật sai khi chỉ mở trang với đơn cũ;
  - thông báo đơn cũ màu đỏ, tự ẩn sau 3 giây, không xô layout.

## Task chưa hoàn thành
- Chưa có thanh toán tự động; vẫn là chuyển khoản thủ công + admin duyệt.
- Chưa có queue/background worker thật cho job TTS dài.
- Chưa có email/Zalo báo khi đơn được duyệt.
- Chưa có cleanup retention thật cho audio cũ.
- Chưa có export CSV/Excel.
- Chưa có audit log riêng cho thao tác admin ngoài `PointTransaction`.
- Chưa có cơ chế lock/chặn spam nâng cao ngoài limit hiện tại.

## Task cần refactor
- Tách logic tạo giọng trong `IndexModel` thành service riêng, ví dụ `VoiceJobService`.
- Tách logic billing/order/admin approve thành `BillingService`.
- Giảm độ lớn của `wwwroot/js/app.js`.
- Tách `wwwroot/css/app.css` theo:
  - layout
  - components
  - pages
  - responsive
- Chuẩn hóa status/type bằng constants hoặc enum thay vì string rải rác.

## Task cần test lại
- Google login:
  - tài khoản mới tạo đúng;
  - email admin vào đúng role `Admin`;
  - email thường vào đúng role `Member`.
- Flow tạo giọng async:
  - pending item;
  - cập nhật lịch sử;
  - hoàn điểm khi lỗi;
  - không reload cả trang.
- Flow hidden Enhance:
  - bật `Enhance` nhưng textarea không bị chèn tag;
  - request backend vẫn dùng text enrich;
  - fallback hoạt động đúng khi chưa có `OpenAI:ApiKey`.
- Flow mua gói:
  - tạo đơn mới;
  - reuse đơn `Pending`/`Reported`;
  - toast cảnh báo màu đỏ, tự ẩn sau 3 giây;
  - popup bước 2 desktop/mobile;
  - `Pending -> Reported -> Paid`.
- QR local:
  - hiển thị nhanh và ổn định;
  - không phụ thuộc dịch vụ QR bên ngoài.
- Runtime storage:
  - `app.db` và `audio/` chạy đúng khi đổi máy/server;
  - không phụ thuộc đường dẫn ổ đĩa cố định.

## Nâng cấp nên làm sau MVP
- Đưa audio sang object storage như R2/S3 khi cần scale hơn.
- Nếu cần realtime thật thì thêm queue + SignalR.
- Webhook thanh toán tự động.
- API nội bộ cho khách tích hợp.
- Trang admin log/monitor rõ hơn cho TTS, payment, enhance.
