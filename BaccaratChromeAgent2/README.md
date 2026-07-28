# Baccarat Chrome Agent

Nền tảng mới chạy với Google Chrome thật. Chrome Extension chỉ quan sát trang và hiển thị Canvas; Engine C# giữ logic nghiệp vụ qua Native Messaging.

## Giai đoạn hiện tại

- Đã có `Protocol`, `Engine`, `NativeHost` và Extension Manifest V3.
- Extension chỉ đọc snapshot DOM tối thiểu và vẽ Canvas trạng thái.
- Không có chiến lược, không có click, không chặn/sửa network.

## Chạy development

1. Build Native Host:

   ```powershell
   dotnet build .\BaccaratChromeAgent.sln
   ```

2. Mở `chrome://extensions`, bật Developer mode, chọn **Load unpacked** và trỏ tới `src\BaccaratChromeAgent.Extension`.
3. Publish Native Host trước khi đăng ký manifest cho Chrome. Cập nhật `path` và Extension ID trong `installer\com.abx.baccarat_chrome_agent.json.template`.

Native Messaging trên Windows yêu cầu đăng ký manifest trong Registry. Giai đoạn tiếp theo sẽ thêm installer; không đăng ký manifest mẫu trực tiếp vì Extension ID development có thể thay đổi.

## Quy tắc kiến trúc

- Không đưa chiến lược, quản lý vốn hoặc license vào Extension.
- Không lưu cookie/credential trang game trong Engine.
- Chỉ Engine được phép tạo `ActionIntent`; Extension chỉ là bridge/executor ở giai đoạn sau.
- Mọi action phải có request/result thực tế trước khi Engine ghi pending/history.
