using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;

using ABX.Core;                 // IGamePlugin, IConfigService, ILogService, IWebViewService
using ABX.Hub.Hosting;          // PluginLoader
using ABX.Hub.Services;         // ConfigService, LogService, HostContext

namespace ABX.Hub
{
    public partial class MainWindow : Window
    {
        private string _baseDir = "";
        private string _webDir = "";
        private string _pluginsDir = "";

        private readonly ConfigService _cfg;
        private readonly LogService _log;
        private HostContext _hostcx = default!;

        private List<IGamePlugin> _plugins = new();
        private IGamePlugin? _active;

        private bool _navEventsHooked;
        private bool _activating;
        private string? _activatingSlug;

        public MainWindow()
        {
            InitializeComponent();

            _cfg = new ConfigService(Path.Combine(AppContext.BaseDirectory, "AppConfig.json"));
            _log = new LogService(Path.Combine(AppContext.BaseDirectory, "logs"));

            Loaded += async (_, __) =>
            {
                try
                {
                    _baseDir = AppContext.BaseDirectory;
                    _webDir = ResolveWebRoot();
                    _pluginsDir = Path.Combine(_baseDir, "Plugins");

                    _log.Info($"[Hub] BaseDir: {AppContext.BaseDirectory}");
                    _log.Info($"[Hub] PluginsDir: {_pluginsDir}");

                    if (!Directory.Exists(_pluginsDir))
                        _log.Warn("[Hub] Plugins folder not found!");
                    else
                        foreach (var f in Directory.GetFiles(_pluginsDir, "*.dll"))
                            _log.Info($"[Hub] Plugin candidate: {Path.GetFileName(f)}");

                    // Chuẩn bị WebView2 cho home
                    await web.EnsureCoreWebView2Async();
                    try
                    {
                        var ver = CoreWebView2Environment.GetAvailableBrowserVersionString(null);
                        _log.Info($"[Home] WebView2 ready. Version(Evergreen)={ver ?? "-"}");
                    }
                    catch (Exception ex)
                    {
                        _log.Warn("[Home] Probe WebView2 version failed: " + ex.Message);
                    }

                    HookWebMessages();
                    HookHomeNavEvents();

                    // Adapter IWebViewService cho plugin (shared WebView2)
                    var webAdapter = new WebViewAdapter(web, _log);

                    _hostcx = new HostContext(
                        (IConfigService)_cfg,
                        (ILogService)_log,
                        (IWebViewService)webAdapter
                    );

                    _log.Info($"[Hub] Host IGamePlugin asm: {typeof(IGamePlugin).Assembly.FullName}");
                    _log.Info($"[Hub] Host IGamePlugin loc: {typeof(IGamePlugin).Assembly.Location}");

                    _plugins = PluginLoader.LoadAll(_pluginsDir, _log);
                    if (_plugins.Count == 0)
                        _log.Warn("[Hub] No plugins registered.");
                    else
                        foreach (var p in _plugins)
                            _log.Info($"[Hub] Plugin registered: {p.Name} / {p.Slug}");

                    // Mở hub lần đầu
                    ShowHub();
                    NavigateFile("hub.html");
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, ex.ToString(), "Init error");
                }
            };
        }

        // ========== WebView2 <-> hub.html ==========
        private sealed record WebMsg(string cmd, string? slug, string? file);

        private void HookWebMessages()
        {
            web.CoreWebView2.WebMessageReceived += async (_, e) =>
            {
                _log.Info("[Hub] WebMessageReceived: " + e.WebMessageAsJson);
                try
                {
                    var msg = JsonSerializer.Deserialize<WebMsg>(e.WebMessageAsJson);
                    if (msg == null) return;

                    switch (msg.cmd)
                    {
                        case "enterGame":
                            if (_activating) { _log.Info("[Hub] enterGame ignored (activating)"); return; }
                            if (!string.IsNullOrWhiteSpace(msg.slug) &&
                                _active != null &&
                                string.Equals(_active.Slug, msg.slug, StringComparison.OrdinalIgnoreCase))
                            {
                                _log.Info("[Hub] enterGame ignored (already active).");
                                return;
                            }
                            _log.Info($"[Hub] enterGame slug={msg.slug}");
                            await ActivatePluginAsync(msg.slug);
                            break;

                        case "goHome":
                            _log.Info("[Hub] goHome received.");
                            GoHome();
                            NavigateFile("hub.html");
                            break;

                        case "navigateLocal":
                            if (!string.IsNullOrWhiteSpace(msg.file))
                                NavigateFile(msg.file!);
                            break;
                    }
                }
                catch (Exception ex)
                {
                    _log.Error("WebMessageReceived error", ex);
                }
            };
        }

        private void HookHomeNavEvents()
        {
            if (_navEventsHooked || web.CoreWebView2 == null) return;
            _navEventsHooked = true;

            web.CoreWebView2.NavigationStarting += (_, e) =>
                _log.Info($"[Home] Starting: {e.Uri}");
            web.CoreWebView2.NavigationCompleted += (_, e) =>
                _log.Info($"[Home] Completed: ok={e.IsSuccess} err={e.WebErrorStatus}");
        }

        // ========== Plugin lifecycle ==========
        private async Task ActivatePluginAsync(string? slug)
        {
            if (string.IsNullOrWhiteSpace(slug)) return;
            if (_activating) { _log.Info("[Hub] Activate ignored: already activating."); return; }

            _activating = true;
            _activatingSlug = slug;
            _log.Info($"[Hub] Activate start: slug='{slug}'");

            try
            {
                DeactivatePlugin();

                var p = _plugins.FirstOrDefault(x =>
                    string.Equals(x.Slug, slug, StringComparison.OrdinalIgnoreCase));
                if (p == null)
                {
                    _log.Warn($"Plugin not found for slug: {slug}");
                    MessageBox.Show(this, $"Không tìm thấy plugin cho “{slug}”.", "Missing plugin");
                    return;
                }

                _active = p;
                _log.Info($"[Hub] Creating view for plugin: {p.Name} ({p.Slug})");

                var view = p.CreateView(_hostcx);
                ShowPlugin(view); // bật header & vùng plugin

                // Gắn WebView2 chia sẻ vào view của plugin theo hướng "defer attach":
                // - Thử ngay 1 lần (nếu cây visual đã sẵn sàng)
                // - Nếu chưa thấy host, đợi Loaded/Dispatcher rồi thử lại
                DeferredAttachSharedWebView(view);
                await Task.CompletedTask;
            }
            catch (Exception ex)
            {
                _log.Error("Activate plugin failed", ex);
                MessageBox.Show(this, ex.ToString(), "Plugin start error");
                _active = null;
                ShowHub();
            }
            finally
            {
                _activating = false;
                _activatingSlug = null;
            }
        }

        private void DeferredAttachSharedWebView(FrameworkElement view)
        {
            void ClearToBlank()
            {
                // Xoá nội dung cũ = trang trắng nền trắng để tránh nháy hub
                var blankHtml =
                    "<!doctype html><meta charset='utf-8'>" +
                    "<style>html,body{height:100%;margin:0;background:#ffffff}</style><body></body>";
                _hostcx.Web.NavigateToString(blankHtml, "https://app.local/");
                _log.Info("[Hub] Cleared WebView2 content with blank page (white).");
            }

            bool attachedNow = WebViewAdapter.TryAttachToAnyNamedHost(
                _hostcx.Web, view, _log,
                "AutoWebViewHost_Full", "AutoWebViewHost", "WebHost", "WebViewHost");

            if (attachedNow)
            {
                _log.Info("[Hub] Shared WebView2 attached to plugin view (immediate).");
                ClearToBlank();
                return;
            }

            _log.Info("[Hub] Defer attach: wait for view.Loaded/dispatcher; plugin may also self-attach.");

            // Thử lại khi Loaded
            RoutedEventHandler? onLoaded = null;
            onLoaded = (_, __) =>
            {
                view.Loaded -= onLoaded;
                var ok = WebViewAdapter.TryAttachToAnyNamedHost(
                    _hostcx.Web, view, _log,
                    "AutoWebViewHost_Full", "AutoWebViewHost", "WebHost", "WebViewHost");
                if (ok)
                {
                    _log.Info("[Hub] Shared WebView2 attached to plugin view (on Loaded).");
                    ClearToBlank();
                }
                else
                {
                    _log.Info("[Hub] Attach still not found after Loaded; plugin is expected to attach itself.");
                }
            };
            view.Loaded += onLoaded;

            // Và một lượt Dispatcher để đảm bảo template đã inflate
            view.Dispatcher.BeginInvoke(new Action(() =>
            {
                var ok2 = WebViewAdapter.TryAttachToAnyNamedHost(
                    _hostcx.Web, view, _log,
                    "AutoWebViewHost_Full", "AutoWebViewHost", "WebHost", "WebViewHost");
                if (ok2)
                {
                    _log.Info("[Hub] Shared WebView2 attached to plugin view (dispatcher pass).");
                    ClearToBlank();
                }
            }), System.Windows.Threading.DispatcherPriority.Loaded);
        }

        private void DeactivatePlugin()
        {
            if (_active == null) return;

            try
            {
                var t = _active.GetType();
                var miStop = t.GetMethod("Stop");
                var ret = miStop?.Invoke(_active, null);

                if (miStop == null && _active is IDisposable d)
                    d.Dispose();

                if (ret is Task task)
                    task.GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                _log.Error("Stop plugin error", ex);
            }
            finally
            {
                _active = null;
            }
        }

        private void GoHome(bool navigateHome = false)
        {
            _log.Info("[Hub] GoHome start.");
            DeactivatePlugin();

            // Đưa WebView2 về bến đỗ Home
            try
            {
                var homeHost = this.FindName("HomeWebHost") as FrameworkElement;
                if (homeHost != null)
                {
                    WebViewAdapter.TryAttachToAnyNamedHost(_hostcx.Web, homeHost, _log, "HomeWebHost");
                    _log.Info("[Hub] WebView2 parked to HomeWebHost.");
                }
                else
                {
                    _log.Info("[Hub] No HomeWebHost found (optional).");
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Hub] Park WebView2 to home failed: " + ex.Message);
            }

            HostContent.Content = null;
            _log.Info("[Hub] Cleared HostContent.");

            ShowHub();

            if (!navigateHome)
                _log.Info("[Hub] GoHome partial (no hub navigation).");
        }

        private void BtnHome_Click(object sender, RoutedEventArgs e)
        {
            _log.Info("[Hub] BtnHome_Click");
            GoHome();
            NavigateFile("hub.html");
        }

        // ========== Hiển thị ==========
        private void ShowHub()
        {
            // Ẩn vùng plugin, ẩn chip header, hiện WebView ở Home
            HdrChip.Visibility = Visibility.Collapsed;
            web.Visibility = Visibility.Visible;
            HostContent.Content = null;
            HostContainer.Visibility = Visibility.Collapsed;
            LogLayout("[After ShowHub]", HostContainer);
        }

        private void ShowPlugin(UserControl view)
        {
            // 1) Ẩn WebView đang đỗ ở Home để tránh overlay trong lúc chuyển
            web.Visibility = Visibility.Collapsed;

            HostContent.Content = view;
            HostContainer.Visibility = Visibility.Visible;

            // Header chip hiển thị ở nền sáng (nếu bạn đang bật tính năng này)
            HdrChip.Visibility = Visibility.Visible;
        }

        // ========== Helpers ==========
        private void NavigateFile(string fileName)
        {
            var fullPath = Path.Combine(_webDir, fileName);
            if (!File.Exists(fullPath))
            {
                MessageBox.Show(this, $"Không tìm thấy {fileName}\n{fullPath}", "404 – File missing");
                return;
            }

            var uri = new Uri(fullPath).AbsoluteUri;
            _log.Info($"[Home] Navigate file: {uri}");

            try
            {
                if (web.CoreWebView2 == null)
                {
                    web.EnsureCoreWebView2Async().GetAwaiter().GetResult();
                    HookHomeNavEvents();
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Home] EnsureCoreWebView2Async on navigate failed: " + ex.Message);
            }

            web.CoreWebView2.Navigate(uri);
        }

        private static string ResolveWebRoot()
        {
            var probe = AppContext.BaseDirectory;

            for (int i = 0; i < 10; i++)
            {
                var candidate = Path.Combine(probe, "web");
                var hub = Path.Combine(candidate, "hub.html");
                if (File.Exists(hub))
                    return candidate;

                var parent = Directory.GetParent(probe);
                if (parent == null) break;
                probe = parent.FullName;
            }

            var fallback = Path.Combine(AppContext.BaseDirectory, "web");
            return Directory.Exists(fallback) ? fallback : AppContext.BaseDirectory;
        }

        private void LogLayout(string tag, FrameworkElement fe)
        {
            try
            {
                var parent = VisualTreeHelper.GetParent(fe) as FrameworkElement;
                _log.Info($"{tag}: {fe.GetType().Name} size={fe.ActualWidth:0}x{fe.ActualHeight:0} " +
                          $"vis={fe.Visibility} parent={(parent?.GetType().Name ?? "null")} " +
                          $"psize={(parent != null ? $"{parent.ActualWidth:0}x{parent.ActualHeight:0}" : "-")}");
            }
            catch { }
        }
    }

    // ================= Adapter: khớp đúng ABX.Core.IWebViewService =================
    public sealed class WebViewAdapter : ABX.Core.IWebViewService
    {
        private readonly Microsoft.Web.WebView2.Wpf.WebView2 _view;
        private readonly ABX.Core.ILogService _log;

        public WebViewAdapter(Microsoft.Web.WebView2.Wpf.WebView2 view, ABX.Core.ILogService log)
        {
            _view = view;
            _log = log;
        }

        public object? Core => _view.CoreWebView2;
        public bool CoreReady => _view.CoreWebView2 != null;

        public void Navigate(string url) => _view.CoreWebView2?.Navigate(url);

        public void NavigateToString(string html, string? baseUrl = null)
        {
            if (!string.IsNullOrWhiteSpace(baseUrl))
            {
                int idx = html.IndexOf("<head", StringComparison.OrdinalIgnoreCase);
                if (idx >= 0)
                {
                    int closeIdx = html.IndexOf('>', idx);
                    if (closeIdx >= 0)
                        html = html.Insert(closeIdx + 1, $"<base href=\"{baseUrl}\">");
                    else
                        html = $"<head><base href=\"{baseUrl}\"></head>{html}";
                }
                else
                {
                    html = $"<head><base href=\"{baseUrl}\"></head>{html}";
                }
            }
            _view.NavigateToString(html);
        }

        public void MapFolder(string hostName, string folderFullPath)
        {
            if (!Directory.Exists(folderFullPath)) throw new DirectoryNotFoundException(folderFullPath);
            _view.CoreWebView2?.SetVirtualHostNameToFolderMapping(
                hostName, folderFullPath, CoreWebView2HostResourceAccessKind.DenyCors);
        }

        // ——— Helpers to attach ———
        public void AttachTo(FrameworkElement root)
        {
            TryAttachToAnyNamedHost(this, root, _log, "AutoWebViewHost_Full", "AutoWebViewHost", "WebHost", "WebViewHost");
        }

        public static bool TryAttachToAnyNamedHost(ABX.Core.IWebViewService svc, FrameworkElement rootOrHost, ABX.Core.ILogService log, params string[] names)
        {
            if (names == null || names.Length == 0)
                names = new[] { "AutoWebViewHost_Full" };

            foreach (var n in names)
            {
                if (TryAttachToNamedHost(svc, rootOrHost, n, log))
                    return true;
            }
            log.Warn("[WvAdapter] No named host matched.");
            return false;
        }

        public static bool TryAttachToNamedHost(ABX.Core.IWebViewService svc, FrameworkElement rootOrHost, string hostName, ABX.Core.ILogService log)
        {
            if (svc is not WebViewAdapter self) return false;

            FrameworkElement host;

            if (rootOrHost is FrameworkElement fe && fe.Name == hostName)
                host = fe;
            else
                host = FindChild<FrameworkElement>(rootOrHost, hostName);

            if (host == null)
            {
                log.Warn($"[WvAdapter] Host '{hostName}' NOT FOUND. Skip attaching to avoid overlay.");
                return false;
            }

            if (self._view.Parent is Border oldB) { oldB.Child = null; log.Info("[WvAdapter] Detach from Border"); }
            else if (self._view.Parent is Panel oldP) { oldP.Children.Remove(self._view); log.Info("[WvAdapter] Detach from Panel"); }

            self._view.HorizontalAlignment = HorizontalAlignment.Stretch;
            self._view.VerticalAlignment = VerticalAlignment.Stretch;
            self._view.Visibility = Visibility.Visible;

            if (host is Border b) { b.Child = self._view; log.Info("[WvAdapter] Attached to Border (named host)"); }
            else if (host is Panel p) { p.Children.Add(self._view); log.Info("[WvAdapter] Attached to Panel (named host)"); }
            else
            {
                log.Warn("[WvAdapter] Named host is not a Panel/Border. Skip attach.");
                return false;
            }

            log.Info($"[WvAdapter] Host size={host.ActualWidth:0}x{host.ActualHeight:0} name={host.Name}");
            return true;
        }

        private static T? FindChild<T>(DependencyObject root, string name) where T : FrameworkElement
        {
            if (root == null) return null;
            int n = VisualTreeHelper.GetChildrenCount(root);
            for (int i = 0; i < n; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child is T c && c.Name == name) return c;
                var found = FindChild<T>(child, name);
                if (found != null) return found;
            }
            return null;
        }
    }
}
