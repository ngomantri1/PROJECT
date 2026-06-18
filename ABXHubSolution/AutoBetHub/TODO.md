# TODO

## Current Focus
- Ổn định host runtime gồm:
  - plugin activation
  - local mirror bootstrap
  - update/restart/apply pending
  - shortcut launch

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
- Đồng bộ source of truth giữa:
  - `Plugins/*.dll`
  - `hub.html` `GAMES[]`

## Refactor
- Đưa constants update repo/branding ra config thay vì hardcode.
- Gom logic WebView2 bootstrap (`Wv2Bootstrapper`, `ZipUtil`, `EnsureFixedWebView2Runtime`) để tránh chồng chéo.
- Tách bridge packet model khỏi `MainWindow.xaml.cs`.
- Tách helper filesystem/copy/update ra module riêng để test dễ hơn.

## High Priority
- Thêm guard chống chạy song song `CheckForUpdateAsync`.
- Kiểm tra/fix path plugin render vào `HostContainer` nếu mục tiêu là in-window plugin.
- Review shortcut mode với plugin cần `IWebViewService`.
- Loại bỏ drift giữa game catalog hardcode và plugin inventory thực tế.
- Giảm phụ thuộc CDN của `hub.html` nếu cần chạy ổn định/offline.

## Need Retest
- Launch bình thường không slug.
- Launch bằng shortcut `--slug`.
- App đang chạy rồi mở shortcut lần 2.
- `goHome` sau khi plugin đang active.
- Close app khi plugin còn mở.
- Update flow:
  - manifest OK
  - manifest lỗi
  - download lỗi
  - restart thành công/thất bại
- Missing plugin slug.
- Máy không có fixed runtime và phải fallback Evergreen.
- Môi trường không có internet nhưng vẫn mở được `hub.html`.
