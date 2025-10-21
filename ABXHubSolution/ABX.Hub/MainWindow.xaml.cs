using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using ABX.Core;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace ABX.Hub
{
    public partial class MainWindow : Window
    {
        // WebView2 cho header (hub.html)
        private CoreWebView2Environment? _env;
        private bool _headerReady;

        // WebView2 dành riêng cho plugin
        private WebView2? _wvPlugin;
        private IWebViewService? _wvSvc;

        // Plugin hiện hành
        private IGamePlugin? _activePlugin;
        private UserControl? _activeView;

        public MainWindow()
        {
            InitializeComponent();
            // Phím tắt ép kích hoạt plugin để debug đường dẫn Hub->Plugin
            this.KeyDown += MainWindow_KeyDown;
        }

        private async void Window_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                await InitHeaderWebViewAsync();
                await LoadHubAsync();

                // Layout ban đầu: hub.html full screen
                EnterHomeLayout();

                Debug.WriteLine("[Hub] Window loaded. Press Ctrl+Alt+X to force-load 'xoc-dia-live' for debugging.");
                DumpPlugins(); // in thử danh sách DLL trong Plugins
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Hub] Window_Loaded error: " + ex);
                MessageBox.Show(ex.Message, "Init Hub failed");
            }
        }

        #region Header WebView2 (hub.html)

        private async Task InitHeaderWebViewAsync()
        {
            if (_headerReady && WvHeader.CoreWebView2 != null) return;

            // Dùng user-data folder cố định để cookie/state không reset
            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ABX.Hub", "WebView2");

            _env ??= await CoreWebView2Environment.CreateAsync(userDataFolder: userData);
            await WvHeader.EnsureCoreWebView2Async(_env);

            var core = WvHeader.CoreWebView2;
            var st = core.Settings;
            st.IsScriptEnabled = true;
            st.IsWebMessageEnabled = true;
            st.AreDevToolsEnabled = Debugger.IsAttached;
            st.AreDefaultContextMenusEnabled = false;
            st.IsStatusBarEnabled = false;

            // Lắng nghe thông điệp từ hub.html
            core.WebMessageReceived -= Core_WebMessageReceived;
            core.WebMessageReceived += Core_WebMessageReceived;

#if DEBUG
            try { core.OpenDevToolsWindow(); } catch { /* ignore */ }
#endif

            // Cho trang biết host đã sẵn sàng
            await core.AddScriptToExecuteOnDocumentCreatedAsync(
                "window._hubReady = true; console.debug('[Hub] WPF host ready');");

            _headerReady = true;
        }

        private async Task LoadHubAsync()
        {
            if (WvHeader.CoreWebView2 == null)
                await InitHeaderWebViewAsync();

            var core = WvHeader.CoreWebView2!;
            var webFolder = Path.Combine(AppContext.BaseDirectory, "web");

            if (Directory.Exists(webFolder))
            {
                // Map virtual host để tránh hạn chế file://
                core.SetVirtualHostNameToFolderMapping(
                    "app.local", webFolder, CoreWebView2HostResourceAccessKind.Allow);

                WvHeader.Source = new Uri("https://app.local/hub.html");
                Debug.WriteLine("[Hub] Load hub.html via https://app.local/hub.html");
            }
            else
            {
                // Fallback: file://
                var htmlPath = Path.Combine(AppContext.BaseDirectory, "web", "hub.html").Replace("\\", "/");
                WvHeader.Source = new Uri($"file:///{htmlPath}");
                Debug.WriteLine("[Hub] Load hub.html via file:///...");
            }
        }

        private void Core_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var json = e.WebMessageAsJson;
                Debug.WriteLine($"[Bridge] recv raw: {json}");

                if (string.IsNullOrWhiteSpace(json)) return;

                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("cmd", out var c)) return;
                var cmd = c.GetString();

                switch (cmd)
                {
                    case "enterGame":
                        {
                            var slug = doc.RootElement.TryGetProperty("slug", out var s) ? s.GetString() : null;
                            Debug.WriteLine($"[Bridge] enterGame -> {slug}");
                            if (!string.IsNullOrWhiteSpace(slug))
                                _ = ActivatePluginAsync(slug!);
                        }
                        break;

                    case "goHome":
                        Debug.WriteLine("[Bridge] goHome");
                        _ = GoHomeAsync();
                        break;

                    default:
                        Debug.WriteLine($"[Bridge] Unknown cmd: {cmd} | {json}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Hub] WebMessage error: " + ex);
            }
        }

        #endregion

        #region Layout switching (Home <-> Plugin)

        /// <summary>
        /// Home layout: hub.html full-screen, ẩn vùng plugin.
        /// </summary>
        private void EnterHomeLayout()
        {
            HeaderRow.Height = new GridLength(1, GridUnitType.Star);   // header full
            WvHeader.ClearValue(FrameworkElement.HeightProperty);       // Stretch theo Row
            ContentRow.Height = new GridLength(0);                      // ẩn plugin
        }

        /// <summary>
        /// Plugin layout: header 64px ở trên, plugin chiếm phần dưới.
        /// </summary>
        private void EnterPluginLayout()
        {
            HeaderRow.Height = GridLength.Auto;
            WvHeader.Height = 64;
            ContentRow.Height = new GridLength(1, GridUnitType.Star);
        }

        #endregion

        #region Plugin activation

        private async Task ActivatePluginAsync(string slug)
        {
            Debug.WriteLine($"[Hub] ActivatePluginAsync('{slug}')");

            try
            {
                Debug.WriteLine("[Hub] [1] GoHome (clearHeader=false)...");
                await GoHomeAsync(clearHeader: false);
            }
            catch (Exception ex)
            {
                LogStageError("1-GoHome", ex);
                throw;
            }

            // ===== [2] Tạo WebView2 cho plugin & mount ẩn để có HWND =====
            try
            {
                Debug.WriteLine("[Hub] [2] Create WebView2 for plugin (hidden mount to get HWND)...");
                _wvPlugin = new WebView2
                {
                    Width = 1,
                    Height = 1,
                    Visibility = Visibility.Collapsed,
                    HorizontalAlignment = HorizontalAlignment.Left,
                    VerticalAlignment = VerticalAlignment.Top
                };

                // Mount ẩn vào PluginHost để WebView2 có HWND trước khi EnsureCoreWebView2Async
                var tmpShell = new Border
                {
                    Width = 1,
                    Height = 1,
                    Visibility = Visibility.Collapsed,
                    Child = _wvPlugin
                };
                PluginHost.Content = tmpShell;

                // Bắt đầu ensure với cùng environment header (_env đã tạo khi init header)
                Debug.WriteLine("[Hub] [2.1] EnsureCoreWebView2Async start...");
                await _wvPlugin.EnsureCoreWebView2Async(_env);
                Debug.WriteLine("[Hub] [2.2] EnsureCoreWebView2Async done.");

                var s = _wvPlugin.CoreWebView2.Settings;
                s.IsScriptEnabled = true;
                s.IsWebMessageEnabled = true;
                s.AreDevToolsEnabled = Debugger.IsAttached;
                s.AreDefaultContextMenusEnabled = false;
                s.IsStatusBarEnabled = false;

                // Hook thêm vài event để soi sự cố sau này
                _wvPlugin.CoreWebView2.ProcessFailed += (sdr, ev) =>
                    Debug.WriteLine($"[WV2][Plugin] ProcessFailed: {ev.ProcessFailedKind}");
                _wvPlugin.NavigationCompleted += (sdr, ev) =>
                    Debug.WriteLine($"[WV2][Plugin] NavigationCompleted IsSuccess={ev.IsSuccess} Error={ev.WebErrorStatus}");

                Debug.WriteLine("[Hub] [2] OK");
            }
            catch (Exception ex)
            {
                LogStageError("2-WebView2", ex);
                MessageBox.Show("Lỗi tạo WebView2 cho plugin:\n" + ex.Message);
                return;
            }

            try
            {
                Debug.WriteLine("[Hub] [3] Create WebViewService...");
                _wvSvc = CreateWebViewService(_wvPlugin);
                Debug.WriteLine("[Hub] [3] OK");
            }
            catch (Exception ex)
            {
                LogStageError("3-WebViewService", ex);
                MessageBox.Show("Lỗi tạo WebViewService:\n" + ex.Message);
                return;
            }

            IGamePlugin? plugin = null;
            try
            {
                Debug.WriteLine("[Hub] [4] Probe & load plugin by slug...");
                DumpPlugins(); // liệt kê file trong Plugins để chắc chắn
                plugin = LoadPluginBySlug(slug);
                if (plugin == null)
                {
                    Debug.WriteLine($"[Hub] [4] Plugin not found: {slug}");
                    MessageBox.Show($"Plugin not found: {slug}", "Hub");
                    return;
                }
                _activePlugin = plugin;
                Debug.WriteLine($"[Hub] [4] OK -> {plugin.Name} ({plugin.Slug})");
            }
            catch (Exception ex)
            {
                LogStageError("4-LoadPluginBySlug", ex);
                MessageBox.Show("Lỗi load plugin:\n" + ex.Message);
                return;
            }

            try
            {
                Debug.WriteLine("[Hub] [5] Create HostContext...");
                var host = GetOrCreateHost(_wvSvc!);
                Debug.WriteLine("[Hub] [5] OK");

                Debug.WriteLine("[Hub] [6] plugin.CreateView(host)...");
                var view = plugin.CreateView(host); // phải trả về UserControl
                _activeView = view;
                Debug.WriteLine("[Hub] [6] OK -> view=" + view.GetType().FullName);

                Debug.WriteLine("[Hub] [7] Put view into PluginHost...");
                PluginHost.Content = view;
                Debug.WriteLine("[Hub] [7] OK");

                Debug.WriteLine("[Hub] [8] Attach WebView2 into view (placeholder='AutoWebViewHost_Full')...");
                _wvSvc!.AttachTo(view);
                // Sau khi đã attach vào view, cho nó hiện ra (nếu bạn có hiển thị UI riêng trong plugin)
                _wvPlugin.Visibility = Visibility.Visible;
                Debug.WriteLine("[Hub] [8] OK");

                EnterPluginLayout();

                Debug.WriteLine($"[Hub] [DONE] Activated plugin: {plugin.Name} ({plugin.Slug})");
            }
            catch (Exception ex)
            {
                LogStageError("5..8-CreateView/Attach/Layout", ex);
                MessageBox.Show("Lỗi dựng view plugin:\n" + ex.Message);
            }
        }


        private static void LogStageError(string stage, Exception ex)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"[Hub][ERR] Stage={stage} :: {ex.GetType().Name} :: {ex.Message}");
            sb.AppendLine(ex.StackTrace);

            if (ex is ReflectionTypeLoadException rtle && rtle.LoaderExceptions != null)
            {
                sb.AppendLine("LoaderExceptions:");
                foreach (var le in rtle.LoaderExceptions)
                {
                    if (le == null) continue;
                    sb.AppendLine($"  - {le.GetType().Name}: {le.Message}");
                }
            }

            Debug.WriteLine(sb.ToString());
            try
            {
                File.AppendAllText(
                    Path.Combine(AppContext.BaseDirectory, "hub.plugin.err.log"),
                    DateTime.Now.ToString("HH:mm:ss ") + sb + Environment.NewLine);
            }
            catch { /* ignore */ }
        }


        private async Task GoHomeAsync(bool clearHeader = false)
        {
            try
            {
                // Dỡ view plugin
                PluginHost.Content = null;

                // Dispose plugin nếu nó có implement IDisposable
                (_activePlugin as IDisposable)?.Dispose();
                _activeView = null;
                _activePlugin = null;

                // Tháo WebView2 plugin (nếu đang gắn)
                if (_wvPlugin != null)
                {
                    try
                    {
                        if (_wvPlugin.Parent is Border b) b.Child = null;
                        else if (_wvPlugin.Parent is ContentControl cc) cc.Content = null;
                    }
                    catch { /* ignore */ }

                    _wvPlugin.Dispose();
                    _wvPlugin = null;
                }

                _wvSvc = null;

                // Trả layout về Home
                EnterHomeLayout();

                // (tuỳ chọn) điều hướng lại hub.html
                if (clearHeader)
                    await LoadHubAsync();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Hub] GoHome error: " + ex);
            }
        }

        private IGamePlugin? LoadPluginBySlug(string slug)
        {
            try
            {
                var dir = Path.Combine(AppContext.BaseDirectory, "Plugins");
                if (!Directory.Exists(dir))
                {
                    Debug.WriteLine($"[Hub] Plugins dir not found: {dir}");
                    return null;
                }

                foreach (var file in Directory.EnumerateFiles(dir, "*.dll"))
                {
                    Assembly asm;
                    try { asm = Assembly.LoadFrom(file); }
                    catch (Exception loadEx)
                    {
                        Debug.WriteLine($"[Hub] LoadFrom failed: {file} -> {loadEx.Message}");
                        continue;
                    }

                    var types = Enumerable.Empty<Type>();
                    try { types = asm.GetTypes(); }
                    catch (ReflectionTypeLoadException rtle)
                    {
                        types = rtle.Types.Where(t => t != null)!;
                        Debug.WriteLine("[Hub] ReflectionTypeLoadException while reading types.");
                    }

                    foreach (var t in types)
                    {
                        if (t == null) continue;
                        if (!typeof(IGamePlugin).IsAssignableFrom(t)) continue;
                        if (t.IsAbstract || t.IsInterface) continue;

                        IGamePlugin? inst = null;
                        try { inst = (IGamePlugin?)Activator.CreateInstance(t); }
                        catch (Exception newEx)
                        {
                            Debug.WriteLine($"[Hub] CreateInstance failed: {t.FullName} -> {newEx.Message}");
                            continue;
                        }

                        if (inst == null) continue;
                        Debug.WriteLine($"[Hub] Probed plugin: {inst.Name} ({inst.Slug}) from {Path.GetFileName(file)}");

                        if (string.Equals(inst.Slug, slug, StringComparison.OrdinalIgnoreCase))
                            return inst;

                        (inst as IDisposable)?.Dispose();
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Hub] LoadPluginBySlug error: " + ex);
            }
            return null;
        }

        private static IWebViewService CreateWebViewService(WebView2 wv)
        {
            // WebViewService của bạn ở ABX.Hub/Services
            return new Services.WebViewService(wv);
        }

        private IGameHostContext GetOrCreateHost(IWebViewService wvSvc)
        {
            // Nếu IGameHostContext của bạn yêu cầu Cfg/Log thật sự, truyền ở đây.
            return new HostContext(
                web: wvSvc,
                cfg: null,
                log: null
            );
        }

        private sealed class HostContext : IGameHostContext
        {
            public HostContext(IWebViewService web, IConfigService? cfg, ILogService? log)
            {
                _web = web; _cfg = cfg; _log = log;
            }

            private readonly IWebViewService _web;
            private readonly IConfigService? _cfg;
            private readonly ILogService? _log;

            public IWebViewService Web => _web;
            public IConfigService Cfg => _cfg!;
            public ILogService Log => _log!;
        }

        #endregion

        #region Debug helpers

        private void MainWindow_KeyDown(object sender, KeyEventArgs e)
        {
            // Ctrl + Alt + X  => ép kích hoạt plugin xoc-dia-live (bỏ qua hub.html)
            if (Keyboard.IsKeyDown(Key.LeftCtrl) || Keyboard.IsKeyDown(Key.RightCtrl))
            {
                if (Keyboard.IsKeyDown(Key.LeftAlt) || Keyboard.IsKeyDown(Key.RightAlt))
                {
                    if (e.Key == Key.X)
                    {
                        Debug.WriteLine("[Hub] Hotkey Ctrl+Alt+X -> Activate 'xoc-dia-live'");
                        _ = ActivatePluginAsync("xoc-dia-live");
                        e.Handled = true;
                    }
                }
            }
        }

        private void DumpPlugins()
        {
            try
            {
                var dir = Path.Combine(AppContext.BaseDirectory, "Plugins");
                if (!Directory.Exists(dir))
                {
                    Debug.WriteLine($"[Hub] Plugins dir not found: {dir}");
                    return;
                }

                var list = Directory.EnumerateFiles(dir, "*.dll").ToArray();
                Debug.WriteLine("[Hub] Plugins dir listing:");
                foreach (var f in list) Debug.WriteLine("  - " + f);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Hub] DumpPlugins error: " + ex);
            }
        }

        #endregion
    }
}
