# TODO

## Current Focus
- Ổn định host runtime gồm:
  - plugin activation
  - local mirror bootstrap
  - update/restart/apply pending
  - shortcut launch
  - frontend build/runtime sync cho `hub.jsx` / `hub.app.js`

## Unfinished
- Quyết định dứt điểm mô hình plugin UI:
  - embed vào `HostContainer`
  - hoặc plugin tự mở window riêng
- Bỏ duplicate class/path legacy:
  - `HostContext`
  - `PluginLoadContext`
  - `PluginManager`
- Tách `MainWindow.xaml.cs` thành service nhỏ hơn:
  - update
  - plugin lifecycle
  - shortcut/single-instance
  - local runtime sync
- Hoàn thiện build pipeline cho home UI:
  - `hub.jsx` -> `hub.app.js`
  - sync sang `%LocalAppData%\AutoBetHub\web`
- Đồng bộ source of truth giữa:
  - `Plugins/*.dll`
  - `hub.jsx` `GAMES[]`

## Refactor
- Đưa constants update repo/branding ra config thay vì hardcode.
- Gom logic WebView2 bootstrap (`Wv2Bootstrapper`, `ZipUtil`, `EnsureFixedWebView2Runtime`) để tránh chồng chéo.
- Tách bridge packet model khỏi `MainWindow.xaml.cs`.
- Tách helper filesystem/copy/update ra module riêng để test dễ hơn.
- Tách hoặc script hóa bước compile `hub.jsx` để tránh sửa tay nhiều file.

## High Priority
- Thêm guard chống chạy song song `CheckForUpdateAsync`.
- Thêm target/script chính thức để `dotnet build` tự regenerate `web/hub.app.js`.
- Kiểm tra/fix path plugin render vào `HostContainer` nếu mục tiêu là in-window plugin.
- Review shortcut mode với plugin cần `IWebViewService`.
- Loại bỏ drift giữa game catalog hardcode và plugin inventory thực tế.
- Loại bỏ drift giữa:
  - `hub.jsx`
  - `hub.app.js`
  - `%LocalAppData%\AutoBetHub\web`

## Need Retest
- Launch bình thường không slug.
- Launch bằng shortcut `--slug`.
- App đang chạy rồi mở shortcut lần 2.
- `goHome` sau khi plugin đang active.
- Close app khi plugin còn mở.
- Sửa 1 menu trong `hub.jsx` rồi xác nhận `hub.app.js` và local mirror đều đổi theo.
- Xác nhận `homeDiagnostics` ghi log khi front-end có lỗi.
- Update flow:
  - manifest OK
  - manifest lỗi
  - download lỗi
  - restart thành công/thất bại
- Missing plugin slug.
- Máy không có fixed runtime và phải fallback Evergreen.
- Môi trường không có internet nhưng vẫn mở được `hub.html`.
