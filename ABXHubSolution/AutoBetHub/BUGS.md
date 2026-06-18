# Bugs

## Current Bugs
- Duplicate update check có thể xảy ra.
  - Host gọi `CheckForUpdateAsync(true)` lúc startup.
  - `web/hub.html` cũng auto gửi `checkUpdate` khi load.
  - Hiện không có guard `in-progress`, nên có rủi ro double request, double progress, thậm chí double update flow.
- Plugin host path trong `MainWindow` chưa hoàn chỉnh.
  - XAML có `HostContainer` và `HostContent`.
  - Source hiện tại không thấy `HostContent.Content = view` hay `HostContainer.Visibility = Visible`.
  - Nếu plugin không tự mở window riêng, path embed sẽ không hiển thị gì.
- Catalog game ở `web/hub.html` là hardcode.
  - Plugin runtime lại được scan từ `Plugins/*.dll`.
  - Hai nguồn này có thể lệch nhau, gây slug tồn tại trong DLL nhưng không có trên UI hoặc ngược lại.
- Shortcut mode có thể không tương thích với plugin cần shared WebView.
  - Shortcut mode cấp `NullWebViewService`.
  - Plugin nào phụ thuộc `host.Web` thật sẽ fail hoặc chạy thiếu chức năng.
- Code duplicate/legacy dễ gây sửa nhầm.
  - `HostContext` có 2 bản.
  - `PluginLoadContext` có 2 bản.
  - `PluginManager` không thấy dùng ở runtime chính nhưng vẫn còn trong repo.
- `hub.html` phụ thuộc CDN.
  - Nếu máy chặn internet/CDN, home UI có thể không render đầy đủ dù app vẫn mở được WebView2.

## Fixed Or Mitigated In Code
- Lỗi giữ lock file ZIP khi update đã được xử lý bằng dispose stream trước khi giải nén.
- Flow đóng app khi plugin còn active đã có `_pendingClose` để tránh shutdown sớm.
- WebView2 runtime có fallback:
  - fixed runtime
  - Evergreen
  - reset `userDataDir` khi init lỗi
- Plugin loader đã thêm log chẩn đoán lệch `ABX.Core` identity.
- App đã có single-instance + named pipe forwarding cho shortcut slug.

## Unfixed
- Chưa có guard cho concurrent update check/download.
- Chưa rõ chủ đích cuối cùng của plugin render path trong `MainWindow`.
- Chưa có manifest/source-of-truth thống nhất giữa UI catalog và plugin binaries.
- Chưa dọn code legacy/duplicate.
- Chưa có chứng cứ từ source host về flow OCR/WebSocket trong plugin DLL.

## Root Causes
- `MainWindow.xaml.cs` đang ôm quá nhiều vai trò và state.
- Runtime có 2 mô hình song song:
  - home UI trong shared WebView
  - plugin có thể embed hoặc tự quản window
- Một số logic mới được vá thêm trên code cũ, chưa hợp nhất toàn bộ.
- Plugin source không nằm trong repo host hiện tại, làm boundary khó rõ và khó đồng bộ catalog.

## Temporary Workarounds
- Tạm coi plugin là self-managed window nếu path embed chưa hoàn thiện.
- Khi debug update, chỉ giữ 1 nguồn trigger:
  - hoặc host startup auto-check
  - hoặc web auto-check
- Khi thêm plugin mới:
  - cập nhật DLL
  - cập nhật `hub.html` slug/title/card
  - test shortcut `--slug`
- Nếu cần chạy ổn định offline, bundle local React/Tailwind/Babel thay vì CDN.

## Fragile Areas
- `MainWindow.xaml.cs`
- `web/hub.html`
- plugin load path từ `Plugins/` -> local mirror
- update apply từ folder `AutoBetHub.<version>`
- attach/detach shared `WebView2`
- shortcut mode và `_suppressAttachForNextPlugin`
