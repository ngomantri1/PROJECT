using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf; // cần để dùng WebView2

using ABX.Core;
using AutoBetHub.Hosting;
using AutoBetHub.Services;

namespace AutoBetHub
{
    public partial class MainWindow : Window
    {
        private string _baseDir = "";
        private string _webDir = "";
        private string _pluginsDir = "";

        private readonly ConfigService _cfg;
        private readonly LogService _log;

        // runtime unified: mọi thứ dồn về đây
        private readonly string _localRoot;
        private readonly string _localPluginsDir;

        private HostContext _hostcx = default!;

        private List<IGamePlugin> _plugins = new();
        private IGamePlugin? _active;

        private bool _navEventsHooked;
        private bool _activating;
        private string? _activatingSlug;

        public MainWindow()
        {
            InitializeComponent();

            // =========================
            // 1) luôn có thư mục runtime local
            //    %LocalAppData%\AutoBetHub
            // =========================
            _localRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AutoBetHub");
            Directory.CreateDirectory(_localRoot);

            var localLogs = Path.Combine(_localRoot, "logs");
            Directory.CreateDirectory(localLogs);

            _localPluginsDir = Path.Combine(_localRoot, "Plugins");
            Directory.CreateDirectory(_localPluginsDir);

            // =========================
            // 2) config + log đều để dưới local
            // =========================
            _cfg = new ConfigService(Path.Combine(_localRoot, "AppConfig.json"));
            _log = new LogService(localLogs);

            Loaded += async (_, __) =>
            {
                try
                {
                    _baseDir = AppContext.BaseDirectory;
                    _webDir = ResolveWebRoot();

                    // 0) nếu exe có nhúng plugin thì bung hết ra local
                    ExtractEmbeddedPluginsToLocal();

                    // 1) nếu cạnh exe (debug/publish folder) có thư mục Plugins
                    //    VÀ trong đó thực sự có .dll thì copy sang local để chạy
                    var basePlugins = Path.Combine(_baseDir, "Plugins");
                    var baseHasDll =
                        Directory.Exists(basePlugins) &&
                        Directory.EnumerateFiles(basePlugins, "*.dll", SearchOption.AllDirectories).Any(); // <-- sửa ở đây

                    if (baseHasDll)
                    {
                        CopyPluginsToLocal(basePlugins, _localPluginsDir);
                    }
                    else
                    {
                        // 1b) Fallback: nếu chạy từ bin\Debug\net8.0-windows mà chưa có Plugins ở đó
                        // thì đi lên lại thư mục project: ...\AutoBetHub\Plugins
                        var devPlugins = Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "Plugins"));
                        if (Directory.Exists(devPlugins))
                        {
                            _log.Info("[Hub] Runtime Plugins empty/missing, fallback to source Plugins: " + devPlugins);
                            CopyPluginsToLocal(devPlugins, _localPluginsDir);
                        }
                        else
                        {
                            _log.Warn("[Hub] No Plugins folder found (neither runtime nor dev).");
                        }
                    }

                    // 2) từ đây trở đi: hub luôn load plugin tại local
                    _pluginsDir = _localPluginsDir;

                    _log.Info($"[Hub] BaseDir: {_baseDir}");
                    _log.Info($"[Hub] WebDir: {_webDir}");
                    _log.Info($"[Hub] LocalPluginsDir: {_pluginsDir}");

                    // chuẩn bị WebView2 ở home
                    var webview2Data = Path.Combine(_localRoot, "WebView2");
                    Directory.CreateDirectory(webview2Data);

                    // tạo environment để nó KHÔNG tạo thư mục cạnh exe nữa
                    var env = await CoreWebView2Environment.CreateAsync(
                        browserExecutableFolder: null,
                        userDataFolder: webview2Data,
                        options: null);

                    await web.EnsureCoreWebView2Async(env);

                    try
                    {
                        var ver = CoreWebView2Environment.GetAvailableBrowserVersionString(null);
                        _log.Info($"[Home] WebView2 ready. Version(Evergreen)={ver ?? "-"}");
                    }
                    catch (Exception ex)
                    {
                        _log.Warn("[Home] Probe WebView2 version failed: " + ex.Message);
                    }
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

                    // tạo host context cho plugin
                    var webAdapter = new WebViewAdapter(web, _log);
                    _hostcx = new HostContext(_cfg, _log, webAdapter, OnPluginWindowClosed);

                    // load plugin từ thư mục LOCAL
                    if (Directory.Exists(_pluginsDir))
                        _plugins = PluginLoader.LoadAll(_pluginsDir, _log);
                    else
                        _log.Warn("[Hub] Plugins folder (local) not found!");

                    if (_plugins.Count == 0)
                        _log.Warn("[Hub] No plugins registered.");
                    else
                        foreach (var p in _plugins)
                            _log.Info($"[Hub] Plugin registered: {p.Name} / {p.Slug}");

                    ShowHub();
                    NavigateFile("hub.html");
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, ex.ToString(), "Init error");
                }
            };
        }

        public void OnPluginWindowClosed(string slug)
        {
            if (_active != null &&
                string.Equals(_active.Slug, slug, StringComparison.OrdinalIgnoreCase))
            {
                DeactivatePlugin(); // dùng lại hàm bạn đã có
            }
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
            if (_activating)
            {
                _log.Info("[Hub] Activate ignored: already activating.");
                return;
            }

            _activating = true;
            _activatingSlug = slug;
            _log.Info($"[Hub] Activate start: slug='{slug}'");

            try
            {
                // anh muốn giữ home nên không ShowPlugin
                DeactivatePlugin();

                var p = _plugins.FirstOrDefault(x =>
                    string.Equals(x.Slug, slug, StringComparison.OrdinalIgnoreCase));
                if (p == null)
                {
                    _log.Warn($"Plugin not found for slug: {slug}");
                    MessageBox.Show(this, $"Không tìm thấy plugin cho “{slug}”.", "Missing plugin");
                    return;
                }

                _log.Info($"[Hub] Creating view for plugin: {p.Name} ({p.Slug})");
                var view = p.CreateView(_hostcx);

                if (view == null)
                {
                    _log.Warn("[Hub] Plugin view is null → back to home.");
                    ShowHub();
                    return;
                }

                // vẫn thử attach WebView nếu plugin có host
                await Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.Loaded);
                try
                {
                    var attached = WebViewAdapter.TryAttachToAnyNamedHost(
                        _hostcx.Web, view, _log,
                        "AutoWebViewHost_Full", "AutoWebViewHost", "WebHost", "WebViewHost");

                    _log.Info(attached
                        ? "[Hub] Shared WebView2 attached to plugin view."
                        : "[Hub] Plugin view has no WebView host; skip attach.");
                }
                catch (Exception ex)
                {
                    _log.Warn("[Hub] Attach WebView2 failed: " + ex.Message);
                }

                _active = p;
            }
            catch (Exception ex)
            {
                _log.Error("Activate plugin failed", ex);
                _active = null;
                ShowHub();
                MessageBox.Show(this, ex.ToString(), "Plugin start error");
            }
            finally
            {
                _activating = false;
                _activatingSlug = null;
            }
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

            try
            {
                var homeHost = this.FindName("HomeWebHost") as FrameworkElement;
                if (homeHost != null)
                {
                    WebViewAdapter.TryAttachToAnyNamedHost(_hostcx.Web, homeHost, _log, "HomeWebHost");
                    _log.Info("[Hub] WebView2 parked to HomeWebHost.");
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Hub] Park WebView2 to home failed: " + ex.Message);
            }

            HostContent.Content = null;
            ShowHub();
        }

        private void BtnHome_Click(object sender, RoutedEventArgs e)
        {
            _log.Info("[Hub] BtnHome_Click");
            GoHome();
            NavigateFile("hub.html");
        }

        private void ShowHub()
        {
            HdrChip.Visibility = Visibility.Collapsed;
            web.Visibility = Visibility.Visible;
            HostContent.Content = null;
            HostContainer.Visibility = Visibility.Collapsed;
            LogLayout("[After ShowHub]", HostContainer);
        }

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
                          $"psize={(parent != null ? $"{parent.ActualWidth:0}x{parent.ActualHeight:0}" : "-")} ");
            }
            catch { }
        }

        // =========================================================
        //  unified runtime helpers
        // =========================================================
        private void ExtractEmbeddedPluginsToLocal()
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                var resNames = asm.GetManifestResourceNames()
                                  .Where(n => n.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)
                                           && (n.Contains(".Plugins.") || n.Contains("Plugins/")))
                                  .ToList();

                if (resNames.Count == 0)
                {
                    _log.Info("[Hub] No embedded plugins found.");
                    return;
                }

                foreach (var res in resNames)
                {
                    using var s = asm.GetManifestResourceStream(res);
                    if (s == null) continue;

                    string shortName;
                    if (res.Contains("Plugins/"))
                    {
                        shortName = res.Substring(res.IndexOf("Plugins/", StringComparison.Ordinal) + "Plugins/".Length);
                    }
                    else
                    {
                        shortName = res.Substring(res.IndexOf(".Plugins.", StringComparison.Ordinal) + ".Plugins.".Length);
                    }

                    var target = Path.Combine(_localPluginsDir, shortName);
                    using var fs = File.Create(target);
                    s.CopyTo(fs);
                    _log.Info($"[Hub] Extracted embedded plugin: {shortName} -> {target}");
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Hub] ExtractEmbeddedPluginsToLocal failed: " + ex.Message);
            }
        }

        private void CopyPluginsToLocal(string sourceDir, string destDir)
        {
            try
            {
                foreach (var file in Directory.GetFiles(sourceDir, "*.dll", SearchOption.AllDirectories))
                {
                    var name = Path.GetFileName(file);
                    var target = Path.Combine(destDir, name);
                    File.Copy(file, target, overwrite: true);
                    _log.Info($"[Hub] Copied plugin from base to local: {name}");
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Hub] CopyPluginsToLocal failed: " + ex.Message);
            }
        }
        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            base.OnClosing(e);
            e.Cancel = true;    // chặn đóng app
            this.Hide();        // chỉ ẩn hub
            _log.Info("[Hub] Main window hidden instead of closed.");
        }

    }

    // ================== WebViewAdapter ==================
    public sealed class WebViewAdapter : ABX.Core.IWebViewService
    {
        private readonly WebView2 _view;
        private readonly ABX.Core.ILogService _log;

        public WebViewAdapter(WebView2 view, ABX.Core.ILogService log)
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
                html = $"<head><base href=\"{baseUrl}\"></head>{html}";
            }
            _view.NavigateToString(html);
        }

        public void MapFolder(string hostName, string folderFullPath)
        {
            if (!Directory.Exists(folderFullPath))
                throw new DirectoryNotFoundException(folderFullPath);

            _view.CoreWebView2?.SetVirtualHostNameToFolderMapping(
                hostName,
                folderFullPath,
                CoreWebView2HostResourceAccessKind.DenyCors);
        }

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

            // detach khỏi chỗ cũ
            if (self._view.Parent is Border oldB)
                oldB.Child = null;
            else if (self._view.Parent is Panel oldP)
                oldP.Children.Remove(self._view);

            self._view.HorizontalAlignment = HorizontalAlignment.Stretch;
            self._view.VerticalAlignment = VerticalAlignment.Stretch;
            self._view.Visibility = Visibility.Visible;

            if (host is Border b)
            {
                b.Child = self._view;
                log.Info("[WvAdapter] Attached to Border (named host)");
            }
            else if (host is Panel p)
            {
                p.Children.Add(self._view);
                log.Info("[WvAdapter] Attached to Panel (named host)");
            }
            else
            {
                log.Warn("[WvAdapter] Named host is not a Panel/Border. Skip attach.");
                return false;
            }

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
