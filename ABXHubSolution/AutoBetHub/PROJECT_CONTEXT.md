# Project Context

## Overview
- `AutoBetHub` là desktop hub WPF (`net8.0-windows`) để chạy các plugin game automation.
- App có 2 mặt:
  - `hub.html` là home UI chạy trong `WebView2`.
  - Plugin DLL là logic game, được host nạp qua `ABX.Core` contract.
- Host chịu trách nhiệm:
  - single-instance + nhận `--slug`
  - bootstrap WebView2 runtime
  - mirror `Plugins/` và `web/` sang `%LocalAppData%\AutoBetHub`
  - check/download/apply update
  - bridge message giữa web UI và host/plugin

## Stack
- WPF + C#
- .NET 8 Windows Desktop
- Microsoft WebView2
- React 18 UMD + Babel Standalone + Tailwind CDN trong `web/hub.html`
- Plugin contract: `..\ABX.Core`
- Runtime plugin: DLL trong `Plugins\`

## Main Flow
1. `App.xaml.cs` khóa single-instance bằng `Mutex`.
2. Nếu app đã chạy, instance mới gửi `slug` qua named pipe `AutoBetHub_SlugPipe` rồi thoát.
3. `MainWindow` tạo runtime local ở `%LocalAppData%\AutoBetHub`.
4. Host copy/extract `Plugins/`, `web/`, `ThirdParty/WebView2Fixed` sang local mirror nếu cần.
5. Host apply các folder update pending dạng `AutoBetHub.<version>`.
6. Host init `WebView2`, hook `WebMessageReceived`, tạo `HostContext`.
7. Host scan plugin DLL và activate theo `slug` khi:
  - user click từ `hub.html`
  - shortcut launch `--slug`
  - named pipe nhận slug từ instance khác
8. Khi về home, shared `WebView2` được park lại `HomeWebHost`.

## Coding Rules
- Tôn trọng `ABX.Core` là contract duy nhất giữa host và plugin.
- Không truyền `Exception` object qua boundary Hub/Plugin; chỉ log string.
- Mọi UI mutation WPF phải về `Dispatcher`.
- Không load plugin trực tiếp từ source/runtime folder làm source of truth; runtime thực tế là local mirror trong `%LocalAppData%\AutoBetHub`.
- Không phá flow attach/detach shared `WebView2`.
- Khi thêm command từ web UI, phải cập nhật đồng thời:
  - `sendHost(...)` trong `web/hub.html`
  - `WebMsg`
  - `HookWebMessages()` switch handler
- Giữ async I/O cho update/download; tránh block UI thread.

## Naming Rules
- Plugin slug: lowercase, kebab-case, phải khớp giữa:
  - `IGamePlugin.Slug`
  - `web/hub.html` `GAMES[].slug`
  - shortcut arg `--slug`
- Named WebView host trong plugin UI phải dùng một trong các tên:
  - `AutoWebViewHost_Full`
  - `AutoWebViewHost`
  - `WebHost`
  - `WebViewHost`
- Folder update pending: `AutoBetHub.<version>`.
- Message command từ web: `enterGame`, `goHome`, `checkUpdate`, `navigateLocal`, `createShortcut`.

## Important Rules
- `MainWindow.xaml.cs` là orchestrator chính; mọi thay đổi lớn nên tách service thay vì nhồi thêm state.
- `Plugins/` trong repo không phải runtime cuối cùng; host luôn ưu tiên local mirror sau bootstrap.
- `hub.html` hiện là catalog hardcode, không tự sync từ plugin scan.
- Shortcut mode dùng `NullWebViewService`; không được giả định plugin nào cũng có shared `WebView2`.

## WebSocket Flow
- Host source hiện tại không có WebSocket client/server native.
- Real-time bridge đang dùng là:
  - `window.chrome.webview.postMessage(...)` từ `hub.html`
  - `CoreWebView2.WebMessageReceived` ở WPF
  - `PostWebMessageAsJson(...)` từ host về web UI
- Nếu plugin DLL có WebSocket tới game server thì logic đó nằm trong binary plugin, không thấy trong source repo này.

## Pending Flow
- Có 2 pending flow quan trọng:
  - `pending update`: ZIP update được giải nén vào `%LocalAppData%\AutoBetHub\AutoBetHub.<version>`, rồi apply ở lần startup kế tiếp.
  - `pending close`: nếu user đóng app khi plugin còn active, hub chỉ `Hide()`, set `_pendingClose = true`, và shutdown thật sau khi plugin báo đóng.
- Activation cũng có state chống re-entry:
  - `_activating`
  - `_activatingSlug`
  - `_suppressAttachForNextPlugin`

## Threading / UI Rules
- Named pipe loop chạy background `Task.Run`, nhưng mọi activate plugin phải `Dispatcher.InvokeAsync`.
- Download update là async; UI progress về web qua `PostWebMessageAsJson`.
- Shared `WebView2` chỉ nên có 1 owner tại một thời điểm:
  - home host
  - plugin host
- `GoHome()` phải detach logic plugin trước, rồi mới park `WebView2` về `HomeWebHost`.
- Không được sửa flow single-instance mà bỏ mất slug forwarding.

## Do Not Break
- Single-instance + named pipe `AutoBetHub_SlugPipe`.
- Runtime local mirror `%LocalAppData%\AutoBetHub`.
- `ABX.Core` assembly identity dùng chung giữa host và plugin.
- Shared `WebView2` attach/detach contract.
- Update staging qua folder versioned, không ghi đè trực tiếp file đang chạy.
- Sự ổn định của slug và command names.
- Fallback WebView2 runtime:
  - fixed runtime nếu có
  - Evergreen nếu không có
