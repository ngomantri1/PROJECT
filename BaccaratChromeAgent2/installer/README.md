# Đóng gói Baccarat Chrome Agent

`BaccaratChromeAgent-Setup.exe` cài Desktop, Native Host và tự tạo Registry Native Messaging ở phạm vi người dùng hiện tại (HKCU). Người dùng không phải sửa Registry hoặc tạo JSON thủ công.

## Điều kiện trước khi phát hành

1. Pack và phát hành extension với khóa ký riêng, giữ khóa đó ngoài source code.
2. Upload extension lên Chrome Web Store dạng **Unlisted**.
3. Lấy Extension ID cố định và URL Unlisted từ Chrome Web Store.
4. Cài Inno Setup 6 ở máy build.

Không đưa file `.pem` ký extension vào source code, installer hoặc gói gửi khách hàng.

## Build installer

```powershell
cd D:\PROJECT\BaccaratChromeAgent\installer
.\build-installer.ps1 `
  -ExtensionId "ID_32_KY_TU_a_den_p" `
  -ExtensionUrl "https://chromewebstore.google.com/detail/..."
```

File cài tạo ở `D:\PROJECT\BaccaratChromeAgent\artifacts\installer`.

Chrome extension vẫn cần được cài một lần cho từng Chrome profile. Installer mở trang Unlisted sau khi cài xong; từ đó Chrome tự quản lý và tự cập nhật extension.
