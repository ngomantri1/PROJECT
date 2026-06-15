# AdamVoiceWeb Pro - bản khách hàng dùng thật

Đây là bản web ASP.NET Core Razor Pages chạy local trước, thiết kế mobile-first cho dịch vụ tạo giọng Adam/Text-to-Speech.

## Chức năng chính

- Đăng ký / đăng nhập / đổi mật khẩu.
- Tạo giọng nói, chọn giọng Adam/Antoni/Josh/Rachel.
- Tính điểm theo ký tự và hệ số giọng.
- Popup xác nhận trước khi tạo giọng để tránh bấm nhầm.
- Chỉ trừ điểm khi tạo file mới.
- Nghe lại và tải lại trong lịch sử không trừ điểm.
- Tự hoàn điểm nếu API tạo giọng lỗi.
- Chống spam cơ bản: giới hạn số ký tự/lần và số lần tạo trong 10 phút.
- Mua gói theo luồng chuyển khoản thủ công.
- Tự sinh mã đơn và nội dung chuyển khoản.
- Khách bấm “Tôi đã chuyển khoản”.
- Admin duyệt đơn để cộng điểm.
- Lịch sử giao dịch điểm có số dư trước/sau.
- Admin dashboard: user, doanh thu, đơn chờ duyệt, ký tự đã tạo.
- Admin khóa/mở user, cộng/trừ điểm thủ công.
- Admin cấu hình Voice ID và hệ số điểm.
- Trang hướng dẫn, liên hệ hỗ trợ, quy định điểm.

## Cách chạy local

Cài .NET 8 SDK, sau đó giải nén project và chạy:

```bash
dotnet restore
dotnet run --urls http://localhost:5000
```

Hoặc bấm file:

```text
run-local.bat
```

Mở trình duyệt:

```text
http://localhost:5000
```

## Tài khoản demo

User:

```text
demo / 123456
```

Admin:

```text
admin / admin123
```

## Chạy demo không cần API key

Mặc định nếu `ElevenLabs:ApiKey` để trống thì hệ thống dùng mock audio để anh test giao diện và luồng điểm.

## Cấu hình ElevenLabs API

Mở `appsettings.json`:

```json
"ElevenLabs": {
  "ApiKey": "",
  "DefaultModelId": "eleven_multilingual_v2",
  "UseMockWhenApiKeyEmpty": true
}
```

Điền API key vào `ApiKey`, sau đó chạy lại project.

## Cấu hình thông tin chuyển khoản

Mở `appsettings.json`:

```json
"Payment": {
  "BankName": "MB Bank",
  "AccountName": "TEN CUA ANH",
  "AccountNumber": "0123456789",
  "SupportPhone": "0988 123 456",
  "SupportZalo": "0988 123 456",
  "SupportTelegram": "@minoauto",
  "OrderPrefix": "ADAMVOICE"
}
```

Sửa thành thông tin thật của anh.

## Cấu hình giới hạn hệ thống

```json
"BusinessRules": {
  "MaxCharactersPerJob": 5000,
  "MaxJobsPer10Minutes": 10,
  "LowPointWarning": 3000,
  "AudioRetentionDays": 90
}
```

## Quy trình mua điểm thủ công

1. Khách vào Mua gói.
2. Chọn gói và tạo đơn.
3. Hệ thống sinh mã đơn và nội dung chuyển khoản.
4. Khách chuyển khoản và bấm “Tôi đã chuyển khoản”.
5. Admin vào Admin → Đơn mua gói chờ duyệt.
6. Admin kiểm tra sao kê rồi bấm Duyệt.
7. Hệ thống cộng điểm và ghi giao dịch điểm.

## Lưu ý khi triển khai thật

- Đổi mật khẩu admin mặc định.
- Không đưa API key lên frontend.
- Backup thư mục `App_Data` vì điểm = tiền.
- Backup thư mục `wwwroot/audio` nếu muốn giữ file khách đã tạo.
- Khi publish lên VPS, dùng lệnh:

```bash
dotnet publish -c Release -o publish
```

Sau đó copy thư mục `publish` lên VPS.


## Mục Giọng nói của bạn

Bản này đã thêm trang `/MyVoices` để khách quản lý giọng riêng.

- Khách có thể thêm nhanh bằng Voice ID ElevenLabs nếu đã có sẵn giọng clone/voice riêng.
- Khách có thể gửi yêu cầu tạo giọng riêng. Yêu cầu sẽ nằm trong Admin, chờ admin tạo/clone bên ElevenLabs rồi điền Voice ID và duyệt.
- Giọng riêng chỉ hiển thị cho đúng tài khoản chủ sở hữu.
- Mặc định giọng riêng dùng hệ số x2 điểm, admin có thể sửa trong trang Admin.
- Chỉ nên tạo hoặc sử dụng giọng riêng khi có quyền hợp lệ với giọng đó.
