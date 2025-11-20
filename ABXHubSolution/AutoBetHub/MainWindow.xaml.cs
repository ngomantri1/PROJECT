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
using System.Diagnostics;
using System.Net.Http;
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
        private readonly string _thirdPartyDir;
        private readonly string _localPluginsDir;
        // HttpClient dùng chung cho việc check update
        private static readonly HttpClient _httpClient = new();

        private HostContext _hostcx = default!;

        private List<IGamePlugin> _plugins = new();
        private IGamePlugin? _active;

        private bool _navEventsHooked;
        private bool _activating;
        private string? _activatingSlug;

        // cờ mới: user đã bấm đóng trong khi vẫn còn plugin
        private bool _pendingClose;
        const string LicenseOwner = "ngomantri1";    // <- đổi theo repo của bạn
        const string LicenseRepo = "version";  // <- đổi theo repo của bạn
        const string LicenseBranch = "main";          // <- nhánh
        const string UrlUpateFile = "https://drive.google.com/drive/folders/1cpK3SieshYEpkMWWDpUpQgSH8HBm9CM_";

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

            // Thư mục môi trường tách riêng: %LocalAppData%\AutoBetHub\ThirdParty
            _thirdPartyDir = Path.Combine(_localRoot, "ThirdParty");
            Directory.CreateDirectory(_thirdPartyDir);

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
                        Directory.EnumerateFiles(basePlugins, "*.dll", SearchOption.AllDirectories).Any();

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

                    // Ưu tiên dùng runtime fixed nếu đã được bung ở %LocalAppData%\AutoBetHub\ThirdParty\WebView2Fixed_win-x64
                    string? browserFolder = null;
                    var fixedRuntime = Path.Combine(_thirdPartyDir, "WebView2Fixed_win-x64");
                    if (Directory.Exists(fixedRuntime))
                    {
                        browserFolder = fixedRuntime;
                        _log.Info("[Home] Using fixed WebView2 runtime at " + fixedRuntime);
                    }
                    else
                    {
                        _log.Info("[Home] Using Evergreen WebView2 runtime (no ThirdParty\\WebView2Fixed_win-x64 found).");
                    }

                    // tạo environment để nó KHÔNG tạo thư mục cạnh exe nữa
                    var env = await CoreWebView2Environment.CreateAsync(
                        browserExecutableFolder: browserFolder,
                        userDataFolder: webview2Data,
                        options: null);

                    await web.EnsureCoreWebView2Async(env);

                    try
                    {
                        var ver = CoreWebView2Environment.GetAvailableBrowserVersionString(browserFolder);
                        _log.Info($"[Home] WebView2 ready. Version={ver ?? "-"}");
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
                    // kiểm tra bản mới 1 lần khi khởi động (auto = true)
                    _ = CheckForUpdateAsync(true);
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, ex.ToString(), "Init error");
                }
            };
        }

        public void OnPluginWindowClosed(string slug)
        {
            // plugin gọi ngược về đây từ _window.Closed trong XocDiaLiveHitPlugin.cs
            if (_active != null &&
                string.Equals(_active.Slug, slug, StringComparison.OrdinalIgnoreCase))
            {
                DeactivatePlugin();
            }

            // nếu trước đó user đã bấm đóng hub mà mình phải ẩn đi
            // thì ngay khi plugin đóng xong, tắt hẳn app
            if (_pendingClose)
            {
                _log.Info("[Hub] Plugin closed after pending close -> shutdown.");
                Application.Current.Shutdown();
            }
        }

        // ========== WebView2 <-> hub.html ==========

        // message gửi từ hub.html: { cmd, slug?, file? }
        private sealed record WebMsg(string cmd, string? slug, string? file);

        private sealed record UpdateManifest(string appVersion, string? downloadUrl, string? notes);

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

                        case "checkUpdate":
                            _log.Info("[Hub] checkUpdate from web UI.");
                            // fire-and-forget, không chờ trong handler
                            _ = CheckForUpdateAsync(false);
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

        private static Version GetCurrentVersion()
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();

                // Ưu tiên lấy từ AssemblyInformationalVersion (mapping với <Version> trong csproj)
                var infoAttr = asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
                if (infoAttr != null)
                {
                    var raw = infoAttr.InformationalVersion ?? "";
                    // cắt phần "+gitsha" nếu dùng kiểu 1.2.3+abcd
                    var main = raw.Split('+')[0];
                    if (Version.TryParse(main, out var vInfo))
                        return vInfo;
                }

                // Fallback: AssemblyVersion
                var ver = asm.GetName().Version;
                return ver ?? new Version(1, 0, 0, 0);
            }
            catch
            {
                return new Version(1, 0, 0, 0);
            }
        }


        /// <summary>
        /// Kiểm tra bản cập nhật trên GitHub.
        /// auto = true: chỉ thông báo khi có bản mới hoặc lỗi lớn.
        /// auto = false: bấm nút "Cập nhật" -> luôn báo kết quả cho người dùng.
        /// </summary>
        private async Task CheckForUpdateAsync(bool auto)
        {
            // TODO: Ông chủ sửa lại link này cho đúng repo của mình
            const string ManifestUrl = $"https://raw.githubusercontent.com/{LicenseOwner}/{LicenseRepo}/{LicenseBranch}/autobethub-manifest.json";

            try
            {
                _log.Info("[Update] Checking manifest at: " + ManifestUrl);

                using var resp = await _httpClient.GetAsync(ManifestUrl);
                if (!resp.IsSuccessStatusCode)
                {
                    _log.Warn($"[Update] Manifest HTTP {(int)resp.StatusCode}");
                    if (!auto)
                        MessageBox.Show(
                            "Không kiểm tra được bản cập nhật (HTTP " + (int)resp.StatusCode + ").",
                            "Cập nhật",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    return;
                }

                var json = await resp.Content.ReadAsStringAsync();
                var manifest = JsonSerializer.Deserialize<UpdateManifest>(json);
                if (manifest == null || string.IsNullOrWhiteSpace(manifest.appVersion))
                {
                    _log.Warn("[Update] Manifest invalid or missing appVersion.");
                    if (!auto)
                        MessageBox.Show(
                            "Dữ liệu cập nhật không hợp lệ.",
                            "Cập nhật",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    return;
                }

                var current = GetCurrentVersion();
                var remote = new Version(manifest.appVersion);

                _log.Info($"[Update] Local={current}, Remote={remote}");

                if (remote <= current)
                {
                    if (!auto)
                        MessageBox.Show(
                            $"Bạn đang dùng phiên bản mới nhất ({current}).",
                            "Cập nhật",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    return;
                }

                var notes = string.IsNullOrWhiteSpace(manifest.notes) ? "(Không có ghi chú)" : manifest.notes;
                var msg =
                    $"Đã có phiên bản mới {remote} (hiện tại {current}).\n\n" +
                    $"Ghi chú:\n{notes}\n\n" +
                    $"Mở trang tải bản mới trên trình duyệt?";

                var result = MessageBox.Show(
                    msg,
                    "Cập nhật AutoBetHub",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Information);

                if (result != MessageBoxResult.Yes)
                    return;

                var url = manifest.downloadUrl;
                if (string.IsNullOrWhiteSpace(url))
                {
                    // fallback: mở trang Releases
                    url = UrlUpateFile;
                }

                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    });
                }
                catch (Exception exOpen)
                {
                    _log.Error("[Update] Open browser failed", exOpen);
                    MessageBox.Show(
                        "Không mở được trình duyệt:\n" + exOpen.Message,
                        "Cập nhật",
                        MessageBoxButton.OK,
                        MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                _log.Error("[Update] CheckForUpdateAsync failed", ex);
                if (!auto)
                    MessageBox.Show(
                        "Có lỗi khi kiểm tra bản cập nhật:\n" + ex.Message,
                        "Cập nhật",
                        MessageBoxButton.OK,
                        MessageBoxImage.Error);
            }
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
                // trước khi mở plugin mới, tắt cái cũ
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
            // nếu vẫn còn plugin đang chạy (cửa sổ plugin tự show), thì chỉ ẩn hub
            if (_active != null)
            {
                e.Cancel = true;
                _pendingClose = true; // đánh dấu: user muốn đóng thật
                this.Hide();
                _log.Info("[Hub] Main window hidden (plugin still active) – pending close.");
                return;
            }

            _log.Info("[Hub] Main window closing, no active plugin -> shutdown app.");
            base.OnClosing(e);
            Application.Current.Shutdown();
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
