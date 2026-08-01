# Đóng gói Baccarat Chrome Agent

`BaccaratChromeAgent-Setup.exe` cài Desktop, Native Host, Chrome for Testing và extension runtime versioned; nó cũng tự tạo Registry Native Messaging ở phạm vi người dùng hiện tại (HKCU).

## Điều kiện trước khi phát hành

1. Pack và phát hành extension với khóa ký riêng, giữ khóa đó ngoài source code.
2. Upload extension lên Chrome Web Store dạng **Unlisted**.
3. Lấy Extension ID cố định và URL Unlisted từ Chrome Web Store.
4. Cài Inno Setup 6 ở máy build.

Không đưa file `.pem` ký extension vào source code, installer hoặc gói gửi khách hàng.

## Build installer

```powershell
cd D:\PROJECT\BaccaratChromeAgent2
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\installer\build-installer.ps1 `
  -InnoSetupCompiler "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

File cài tạo ở `D:\PROJECT\BaccaratChromeAgent\artifacts\installer`.

Runtime hiện tại dùng extension ID ổn định từ `manifest.key`; Desktop khởi chạy Chrome với thư mục `extension\v<version>`. Khi thay đổi Service Worker, phải tăng `manifest.json` version để Chrome đăng ký runtime mới.
