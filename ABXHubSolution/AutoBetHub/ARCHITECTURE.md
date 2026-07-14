# Architecture

## Project Structure
- `App.xaml`, `App.xaml.cs`
  - app entry, single-instance, slug forwarding.
- `MainWindow.xaml`, `MainWindow.xaml.cs`
  - shell UI + runtime orchestrator.
- `web/`
  - home shell (`hub.html`), source JSX (`hub.jsx`), generated runtime (`hub.app.js`), vendor scripts, card assets.
- `Hosting/`
  - plugin discovery/loading path đang dùng thực tế.
- `Services/`
  - config, log, host primitives.
- `Plugins/`
  - binary plugins.
- `ThirdParty/`
  - fixed WebView2 runtime ZIP.
- `..\ABX.Core`
  - interface contract host/plugin.

## Main Modules
- `App`
  - enforce 1 instance
  - parse `--slug`
  - boot `MainWindow`
- `MainWindow`
  - local runtime bootstrap
  - plugin lifecycle
  - update flow
  - WebView2 bridge
  - frontend diagnostics bridge
  - shortcut flow
- `Hosting.PluginLoader`
  - scan DLL
  - instantiate `IGamePlugin`
  - log ABX.Core mismatch
- `HostContext`
  - expose `Cfg`, `Log`, `Web`, `OnPluginWindowClosed`
- `WebViewAdapter`
  - adapter từ `WebView2` sang `ABX.Core.IWebViewService`
- `ConfigService`, `LogService`
  - local config + log
- `ZipUtil`, `Wv2Bootstrapper`
  - fixed WebView2 extract/fallback

## Module Dependencies
- `AutoBetHub` -> `ABX.Core`
- `MainWindow` -> `Hosting.PluginLoader`
- `MainWindow` -> `ConfigService`, `LogService`, `HostContext`, `WebViewAdapter`
- `MainWindow` -> `WebView2`
- `web/hub.html` -> `window.chrome.webview`
- Plugin DLL -> `ABX.Core`

## File Responsibilities
- `App.xaml.cs`
  - `Mutex`, named pipe client, startup slug.
- `MainWindow.xaml`
  - home WebView host + plugin host placeholder.
- `MainWindow.xaml.cs`
  - source of truth cho runtime behavior.
- `Hosting/PluginLoader.cs`
  - loader production hiện tại.
- `Hosting/PluginLoadContext.cs`
  - ALC an toàn hơn cho plugin dependency sharing.
- `PluginManager.cs`, `PluginLoadContext.cs`
  - code legacy/alternate path, hiện không thấy dùng ở runtime chính.
- `Services/HostContext.cs`
  - duplicate implementation của `HostContext`, hiện không phải path đang dùng.
- `web/hub.html`
  - shell chỉ load vendor + `hub.app.js`.
- `web/hub.jsx`
  - source thật của menu/home UI.
- `web/hub.app.js`
  - JS generated từ `hub.jsx`; file app runtime thực sự load.
- `web/vendor/*`
  - runtime local cho React/Tailwind; giảm phụ thuộc CDN.

## Data Flow
### Startup
1. `App` parse slug.
2. `MainWindow` tạo local folders.
3. Copy/extract `Plugins`, `web`, fixed WebView2.
4. Apply pending version folder.
5. Nếu có `web` local trong `%LocalAppData%\AutoBetHub\web`, host override sang đó.
6. Init `WebView2`.
7. Hook `homeDiagnostics`.
8. Load plugin DLL.
9. Navigate `hub.html` hoặc activate plugin ngay nếu có slug.

### Plugin Activation
1. User action từ web gửi `enterGame`.
2. `HookWebMessages()` nhận `slug`.
3. `ActivatePluginAsync()` tìm `IGamePlugin` theo slug.
4. `CreateView(host)` được gọi.
5. Nếu không ở shortcut mode và không suppress attach:
  - host cố attach shared `WebView2` vào named host của plugin view.
6. `_active` được set.

### Update
1. Host đọc manifest GitHub raw.
2. So sánh `installed/current` với remote version.
3. Download ZIP về temp.
4. Extract vào `%LocalAppData%\AutoBetHub\AutoBetHub.<version>`.
5. Restart app.
6. Startup sau đó copy `Plugins/` + `web/` từ folder versioned vào runtime local chính.

### Shortcut
1. Shortcut mở app với `--slug`.
2. Nếu app đã chạy, slug được forward qua named pipe.
3. Host set `_suppressAttachForNextPlugin = true`.
4. Plugin launch theo flow shortcut; hub có thể bị ẩn.

## WebView / Packet Flow
- Outbound từ web:
  - `sendHost({ cmd, slug, file, title })`
  - `window.chrome.webview.postMessage`
  - `MainWindow.HookWebMessages`
- Outbound diagnostics:
  - injected script trong host post `homeDiagnostics`
  - log `DOMContentLoaded`, `window.onerror`, `unhandledrejection`, `console.warn/error`
- Inbound về web:
  - host tạo payload update
  - `CoreWebView2.PostWebMessageAsJson`
  - React listener `window.chrome.webview.addEventListener("message", ...)`
- Packet type hiện thấy rõ:
  - web -> host: command packet
  - host -> web: `updateStatus`
  - web/diagnostics -> host: `homeDiagnostics`

## UI Update Flow
- Home UI:
  - source edit ở `hub.jsx`
  - runtime thực tế ở `hub.app.js`
  - React state + `localStorage` + `sessionStorage`
  - không bind trực tiếp sang WPF ngoài message bridge.
- WPF UI:
  - `HomeWebHost` chứa shared `WebView2`
  - `HostContainer` tồn tại trong XAML nhưng path render plugin vào đây hiện chưa hoàn chỉnh trong source host
- Close flow:
  - plugin active -> hide window, mark pending close
  - plugin báo closed -> shutdown
- Build caveat:
  - `dotnet build` hiện chưa có target tự compile `hub.jsx` -> `hub.app.js`
  - vì vậy UI/menu có thể lệch giữa source và runtime JS

## OCR / Canvas Flow
- Không thấy source OCR/canvas trong host repo này.
- Host chỉ cung cấp:
  - `WebView2`
  - folder mapping
  - plugin contract
- Nếu OCR/canvas tồn tại, nhiều khả năng nó nằm trong plugin DLL và không audit được từ source hiện tại.

## Notes For AI Coding
- `MainWindow.xaml.cs` quá lớn; sửa logic mới nên ưu tiên tạo service mới rồi gọi từ đây.
- Có code duplicate/legacy:
  - `HostContext` root vs `Services/HostContext.cs`
  - `Hosting/PluginLoadContext.cs` vs root `PluginLoadContext.cs`
- `hub.html` hiện chỉ là shell, không phải nơi sửa menu chính.
- Khi debug menu/home:
  - kiểm tra cả `hub.jsx`
  - `hub.app.js`
  - `%LocalAppData%\AutoBetHub\web`
