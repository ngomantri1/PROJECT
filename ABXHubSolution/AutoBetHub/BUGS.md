# Bugs

## Current Bugs
- `dotnet build` không tự compile `web/hub.jsx` sang `web/hub.app.js`.
  - Sửa menu trong `hub.jsx` không đảm bảo app runtime đổi theo.
  - Đã quan sát drift thực tế giữa title trong `hub.jsx` và `hub.app.js`.
- Runtime có thể dùng `web` trong `%LocalAppData%\AutoBetHub` thay vì `web` cạnh exe/repo.
  - Sửa file trong repo chưa chắc app đang chạy dùng bản đó.
  - Dễ gây hiểu nhầm là “đã sửa menu nhưng app không đổi”.
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

## Fixed Or Mitigated In Code
- Lỗi giữ lock file ZIP khi update đã được xử lý bằng dispose stream trước khi giải nén.
- Flow đóng app khi plugin còn active đã có `_pendingClose` để tránh shutdown sớm.
- WebView2 runtime có fallback:
  - fixed runtime
  - Evergreen
  - reset `userDataDir` khi init lỗi
- Plugin loader đã thêm log chẩn đoán lệch `ABX.Core` identity.
- App đã có single-instance + named pipe forwarding cho shortcut slug.
- White screen do home UI phụ thuộc CDN/Babel runtime đã được giảm đáng kể:
  - `hub.html` hiện load vendor local
  - runtime JS ở `hub.app.js`
- Host đã có `homeDiagnostics` để log lỗi front-end sớm vào `hub_*.log`.

## Unfixed
- Chưa có target chính thức để tự build `hub.app.js` khi `hub.jsx` đổi.
- Chưa có sync tự động repo `web` -> `%LocalAppData%\AutoBetHub\web` sau mỗi lần sửa local.
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
- Home UI hiện có 3 lớp dễ drift:
  - `hub.jsx` source
  - `hub.app.js` generated
  - `%LocalAppData%\AutoBetHub\web` runtime mirror
- Một số logic mới được vá thêm trên code cũ, chưa hợp nhất toàn bộ.
- Plugin source không nằm trong repo host hiện tại, làm boundary khó rõ và khó đồng bộ catalog.

## Temporary Workarounds
- Tạm coi plugin là self-managed window nếu path embed chưa hoàn thiện.
- Khi debug update, chỉ giữ 1 nguồn trigger:
  - hoặc host startup auto-check
  - hoặc web auto-check
- Khi thêm plugin mới:
  - cập nhật DLL
  - cập nhật `hub.jsx` slug/title/card
  - regenerate `hub.app.js`
  - nếu app đang dùng local mirror, sync sang `%LocalAppData%\AutoBetHub\web`
  - test shortcut `--slug`
- Khi debug “sửa menu không ăn”, luôn kiểm tra:
  - timestamp `hub.jsx`
  - timestamp `hub.app.js`
  - file trong `%LocalAppData%\AutoBetHub\web`

## Fragile Areas
- `MainWindow.xaml.cs`
- `web/hub.html`
- `web/hub.jsx`
- `web/hub.app.js`
- plugin load path từ `Plugins/` -> local mirror
- local runtime mirror `%LocalAppData%\AutoBetHub\web`
- update apply từ folder `AutoBetHub.<version>`
- attach/detach shared `WebView2`
- shortcut mode và `_suppressAttachForNextPlugin`
