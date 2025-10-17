using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;

// Interfaces (ABX.Core)
using ABX.Core;                 // IGamePlugin, IConfigService, ILogService, IWebViewService

// Implementations / hosting (ABX.Hub)
using ABX.Hub.Hosting;          // PluginLoader
using ABX.Hub.Services;         // ConfigService, LogService, HostContext
// NOTE: KHÔNG dùng IWebViewService trong ABX.Hub.Services ở file này

namespace ABX.Hub
{
    public partial class MainWindow : Window
    {
        // ==== Paths ====
        private string _baseDir = "";
        private string _webDir = "";
        private string _pluginsDir = "";

        // ==== Services / runtime ====
        private readonly ConfigService _cfg;   // concrete
        private readonly LogService _log;   // concrete
        private HostContext _hostcx = default!; // concrete

        private List<IGamePlugin> _plugins = new();        // interface từ ABX.Core
        private IGamePlugin? _active;

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

                    // Chuẩn bị WebView2
                    await web.EnsureCoreWebView2Async();
                    HookWebMessages();

                    // Adapter để khớp đúng ABX.Core.IWebViewService
                    var webAdapter = new WebViewAdapter(web);

                    // HostContext nhận các interface ABX.Core ⇒ truyền đúng interface
                    _hostcx = new HostContext(
                        (ABX.Core.IWebViewService)webAdapter,
                        (ABX.Core.IConfigService)_cfg,
                        (ABX.Core.ILogService)_log
                    );

                    // Log chéo để xác nhận assembly type IGamePlugin đang dùng là cùng 1 bản
                    _log.Info($"[Hub] Host IGamePlugin asm: {typeof(IGamePlugin).Assembly.FullName}");
                    _log.Info($"[Hub] Host IGamePlugin loc: {typeof(IGamePlugin).Assembly.Location}");

                    // Nạp plugin
                    _plugins = PluginLoader.LoadAll(_pluginsDir, _log);
                    if (_plugins.Count == 0)
                    {
                        _log.Warn($"[Hub] No plugins registered. Check logs above for interface mismatch.");
                    }
                    else
                    {
                        foreach (var p in _plugins)
                            _log.Info($"[Hub] Plugin registered: {p.Name} / {p.Slug}");
                    }

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
                _log.Info("WebMessageReceived: " + e.WebMessageAsJson);
                try
                {
                    var msg = JsonSerializer.Deserialize<WebMsg>(e.WebMessageAsJson);
                    if (msg == null) return;

                    switch (msg.cmd)
                    {
                        case "enterGame":     // { cmd:"enterGame", slug:"xoc-dia-live" }
                            await ActivatePluginAsync(msg.slug);
                            break;

                        case "goHome":        // { cmd:"goHome" }
                            DeactivatePlugin();
                            ShowHub();
                            NavigateFile("hub.html");
                            break;

                        case "navigateLocal": // { cmd:"navigateLocal", file:"something.html" }
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

        // ========== Plugin lifecycle ==========
        private async Task ActivatePluginAsync(string? slug)
        {
            if (string.IsNullOrWhiteSpace(slug)) return;

            DeactivatePlugin();

            var p = _plugins.FirstOrDefault(x =>
                string.Equals(x.Slug, slug, StringComparison.OrdinalIgnoreCase));

            if (p == null)
            {
                _log.Warn($"Plugin not found for slug: {slug}");
                MessageBox.Show(this, $"Không tìm thấy plugin cho “{slug}” trong thư mục Plugins.", "Missing plugin");
                return;
            }

            try
            {
                _active = p;

                // tạo view và hiển thị
                var view = p.CreateView(_hostcx);
                ShowPlugin(view);

                // nếu sau này plugin có async init thì có thể await ở đây
                await Task.CompletedTask;
            }
            catch (Exception ex)
            {
                _log.Error($"Start plugin {p.Name} failed", ex);
                MessageBox.Show(this, ex.ToString(), "Plugin start error");
                _active = null;
                ShowHub();
            }
        }

        private void DeactivatePlugin()
        {
            if (_active == null) return;

            try
            {
                // thử gọi Stop() nếu có
                var t = _active.GetType();
                var miStop = t.GetMethod("Stop");
                var ret = miStop?.Invoke(_active, null);

                // nếu plugin dùng Dispose thay cho Stop
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

        // ========== Hiển thị ==========
        // Hiện hub.html – ẩn vùng plugin
        private void ShowHub()
        {
            web.Visibility = Visibility.Visible;
            HostContent.Content = null;
            HostContainer.Visibility = Visibility.Collapsed;
        }

        // Hiện vùng plugin – ẩn hub.html
        private void ShowPlugin(UserControl view)
        {
            HostContent.Content = view;
            HostContainer.Visibility = Visibility.Visible;
            web.Visibility = Visibility.Collapsed;
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

            // Tránh lỗi “Value does not fall within the expected range”
            var uri = new Uri(fullPath).AbsoluteUri;
            web.CoreWebView2.Navigate(uri);
        }

        /// <summary>
        /// Tìm đường dẫn thư mục /web của project khi chạy debug/publish.
        /// Ưu tiên {projectRoot}\web (có chứa hub.html). Nếu không tìm thấy,
        /// fallback về {AppContext.BaseDirectory}\web.
        /// </summary>
        private static string ResolveWebRoot()
        {
            // Bắt đầu từ thư mục thực thi (bin\Debug\net8.0-windows hoặc nơi publish)
            var probe = AppContext.BaseDirectory;

            // Leo tối đa 10 cấp thư mục để tìm {dir}\web\hub.html
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

            // Phương án dự phòng: baseDir\web (nếu có) – dùng cho lúc publish copy web vào output
            var fallback = Path.Combine(AppContext.BaseDirectory, "web");
            return Directory.Exists(fallback) ? fallback : AppContext.BaseDirectory;
        }
    }

    // ================= Adapter: khớp đúng ABX.Core.IWebViewService =================
    /// <summary>
    /// Adapter nội bộ để chắc chắn khớp interface ở ABX.Core.
    /// </summary>
    public sealed class WebViewAdapter : ABX.Core.IWebViewService
    {
        private readonly CoreWebView2 _core;

        public WebViewAdapter(Microsoft.Web.WebView2.Wpf.WebView2 view)
            => _core = view.CoreWebView2;

        public void Navigate(string urlOrFile)
        {
            if (Uri.TryCreate(urlOrFile, UriKind.Absolute, out var abs))
                _core.Navigate(abs.AbsoluteUri);
            else
                _core.Navigate(new Uri(Path.GetFullPath(urlOrFile)).AbsoluteUri);
        }

        public Task EvalAsync(string js) => _core.ExecuteScriptAsync(js);

        public void PostMessage(string message) => _core.PostWebMessageAsString(message);
    }
}
