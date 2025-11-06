using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using ABX.Core;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace AutoBetHub
{
    public sealed class WebViewService : IWebViewService, IDisposable
    {
        private readonly WebView2 _wv;
        private readonly ILogService _log;
        private CoreWebView2Environment? _env;
        private string? _userDataDir;

        // Khớp interface hiện tại (ABX.Core)
        public object? Core => _wv.CoreWebView2;
        public bool CoreReady => _wv.CoreWebView2 != null;

        public WebViewService(WebView2 shared, ILogService log)
        {
            _wv = shared;
            _log = log;
            InitAsync();   // khởi tạo môi trường ngay
        }

        // === Khởi tạo môi trường WebView2 (fixed runtime hoặc Evergreen) ===
        private async void InitAsync()
        {
            // 1) Tìm/bung fixed runtime (Debug: bin/ThirdParty; Release: resource nhúng)
            var (fixedExeDir, userDataDir) = ZipUtil.EnsureFixedWebView2Extracted(_log);
            _userDataDir = userDataDir;

            _log.Info($"[WebView2] Probe start. fixedExeDir='{fixedExeDir}', userDataDir='{userDataDir}'");

            // 2) Đo phiên bản có sẵn
            string? verFixed = null, verEver = null;
            try { verFixed = CoreWebView2Environment.GetAvailableBrowserVersionString(string.IsNullOrWhiteSpace(fixedExeDir) ? null : fixedExeDir); }
            catch (Exception ex) { _log.Warn("[WebView2] Probe verFixed failed: " + ex.Message); }

            try { verEver = CoreWebView2Environment.GetAvailableBrowserVersionString(null); }
            catch (Exception ex) { _log.Warn("[WebView2] Probe verEver failed: " + ex.Message); }

            _log.Info($"[WebView2] Probe result -> fixed='{verFixed ?? "-"}', evergreen='{verEver ?? "-"}'");

            // 3) Quyết định môi trường ưu tiên
            string? chosenExeDir = null;     // null = Evergreen
            if (!string.IsNullOrEmpty(verFixed))
            {
                chosenExeDir = fixedExeDir;
                _log.Info($"[WebView2] Will use FIXED runtime v{verFixed} at: {fixedExeDir}");
            }
            else if (!string.IsNullOrEmpty(verEver))
            {
                chosenExeDir = null; // Evergreen
                _log.Info($"[WebView2] Will use EVERGREEN runtime v{verEver}");
            }
            else
            {
                // Không có cả fixed lẫn Evergreen
                _log.Error("[WebView2] Không tìm thấy runtime (Fixed hoặc Evergreen).");
                MessageBox.Show(
                    "Thiếu WebView2 Runtime.\n\n" +
                    "Cách 1 (khuyên dùng khi Debug):\n" +
                    "  - Đặt 'ThirdParty\\WebView2Fixed_win-x64.zip' trong project AutoBetHub (đúng tên file)\n" +
                    "  - Chạy lại để ZIP tự bung vào bin/ThirdParty.\n\n" +
                    "Cách 2: Cài WebView2 Runtime (Evergreen) vào Windows.",
                    "AutoBetHub", MessageBoxButton.OK, MessageBoxImage.Warning);

                // (tuỳ chọn) nếu bạn để sẵn installer thì gọi luôn:
                ZipUtil.TryRunEvergreenInstallerIfPresent(_log);
                return;
            }

            // 4) Thử khởi tạo; nếu fail thì fallback/reset và thử lại 1 lần
            bool ok = await TryInitAsync(chosenExeDir, userDataDir);
            if (!ok && chosenExeDir != null && !string.IsNullOrEmpty(verEver))
            {
                // đang dùng fixed → fallback sang Evergreen
                _log.Info("[WebView2] Fallback: retry with EVERGREEN.");
                ok = await TryInitAsync(null, userDataDir);
            }
            if (!ok)
            {
                // reset userDataDir rồi thử lại 1 lần cuối cùng với lựa chọn ban đầu
                _log.Warn("[WebView2] Retry after reset userDataDir.");
                ZipUtil.ResetUserDataDir(userDataDir, _log);
                ok = await TryInitAsync(chosenExeDir, userDataDir);
            }
            if (!ok)
            {
                _log.Error("[WebView2] Init failed after all attempts.");
                MessageBox.Show("Không khởi tạo được WebView2 (đã thử mọi phương án).", "AutoBetHub",
                                MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            // 5) Tinh chỉnh setting & log sự kiện
            var cwv = _wv.CoreWebView2!;
            cwv.Settings.AreDevToolsEnabled = Debugger.IsAttached;
            cwv.Settings.IsStatusBarEnabled = false;
            cwv.Settings.AreDefaultContextMenusEnabled = true;
            cwv.Settings.AreDefaultScriptDialogsEnabled = true;

            cwv.NewWindowRequested += (s, e) => { e.Handled = true; try { cwv.Navigate(e.Uri); } catch { } };
            cwv.NavigationStarting += (_, e) => _log.Info($"[Web] Starting: {e.Uri}");
            cwv.NavigationCompleted += (_, e) => _log.Info($"[Web] Completed: Success={e.IsSuccess} Err={e.WebErrorStatus}");

            // màu nền đen để đỡ “flash trắng”
            try
            {
                var prop = _wv.GetType().GetProperty("DefaultBackgroundColor");
                if (prop != null) prop.SetValue(_wv, Colors.Black);
            }
            catch { }
        }

        private async System.Threading.Tasks.Task<bool> TryInitAsync(string? exeDir, string userDataDir)
        {
            try
            {
                _log.Info($"[WebView2] CreateEnv: exeDir={(exeDir ?? "Evergreen")} | userDataDir={userDataDir}");
                _env = await CoreWebView2Environment.CreateAsync(exeDir, userDataDir);
                if (_wv.CoreWebView2 == null)
                    await _wv.EnsureCoreWebView2Async(_env);

                // Lấy version theo môi trường đã chọn (fixed hoặc evergreen) — KHÔNG dùng CoreWebView2.BrowserVersionString
                string ver = "(unknown)";
                try
                {
                    // nếu exeDir != null => đang dùng fixed runtime
                    var v1 = CoreWebView2Environment.GetAvailableBrowserVersionString(exeDir);
                    // nếu null => thử evergreen
                    var v2 = CoreWebView2Environment.GetAvailableBrowserVersionString(null);
                    ver = v1 ?? v2 ?? "(unknown)";
                }
                catch { /* ignore */ }

                _log.Info($"[WebView2] EnsureCoreWebView2Async OK. BrowserVersion={ver}");
                return true;
            }
            catch (Exception ex)
            {
                _log.Warn("[WebView2] TryInit failed: " + ex);
                return false;
            }
        }


        // === Mount vào ổ cắm trong UserControl của plugin ===
        public void AttachTo(FrameworkElement viewRoot)
        {
            var host = FindHost(viewRoot);
            Detach(); // tháo khỏi parent cũ nếu có

            _wv.HorizontalAlignment = HorizontalAlignment.Stretch;
            _wv.VerticalAlignment = VerticalAlignment.Stretch;
            _wv.Visibility = Visibility.Visible;

            if (host is Border b) b.Child = _wv;
            else if (host is Panel p) p.Children.Add(_wv);
            else throw new InvalidOperationException("Không tìm thấy host để gắn WebView2.");

            var s = host.RenderSize;
            _log.Info($"[AutoMount] Host={host.GetType().Name} Size={s.Width:0}x{s.Height:0} -> Mounted WebView2");

            // (tuỳ chọn) probe: nếu plugin không điều hướng, bơm trang test sau 1.2s
            var timer = new System.Timers.Timer(1200) { AutoReset = false };
            timer.Elapsed += (_, __) =>
            {
                try
                {
                    if (_wv.CoreWebView2 != null && string.IsNullOrEmpty(_wv.Source?.AbsoluteUri))
                    {
                        _log.Warn("[Probe] No navigation from plugin -> inject test page.");
                        _wv.Dispatcher.Invoke(() =>
                            _wv.NavigateToString("<html><body style='margin:0;background:#0f0'>probe</body></html>")
                        );
                    }
                }
                catch { }
            };
            timer.Start();
        }

        public void Detach()
        {
            if (_wv.Parent is Border oldB) { oldB.Child = null; _log.Info("[AutoMount] Detached from Border."); }
            else if (_wv.Parent is Panel oldP) { oldP.Children.Remove(_wv); _log.Info("[AutoMount] Detached from Panel."); }
        }

        // === Điều hướng / nội dung ===
        public void Navigate(string url) => _wv.CoreWebView2?.Navigate(url);

        public void NavigateToString(string html, string? baseUrl = null)
        {
            if (!string.IsNullOrWhiteSpace(baseUrl))
            {
                // Inject <base> để các đường dẫn tương đối hoạt động nếu cần
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
            _wv.NavigateToString(html);
        }

        public void ExecuteScript(string js)
        {
            if (_wv.CoreWebView2 != null)
                _ = _wv.CoreWebView2.ExecuteScriptAsync(js);
        }

        public void MapFolder(string hostName, string folderFullPath)
        {
            if (!Directory.Exists(folderFullPath)) throw new DirectoryNotFoundException(folderFullPath);
            _wv.CoreWebView2?.SetVirtualHostNameToFolderMapping(
                hostName, folderFullPath, CoreWebView2HostResourceAccessKind.DenyCors);
        }

        // === Helpers ===
        private static FrameworkElement FindHost(FrameworkElement root)
        {
            var full = FindChild<Border>(root, "AutoWebViewHost_Full");
            if (full != null) return full;

            var anyBorder = FindChild<Border>(root);
            if (anyBorder != null) return anyBorder;

            var anyPanel = FindChild<Panel>(root);
            if (anyPanel != null) return anyPanel;

            return root;
        }

        private static T? FindChild<T>(DependencyObject root, string? name = null) where T : FrameworkElement
        {
            if (root == null) return null;
            int count = System.Windows.Media.VisualTreeHelper.GetChildrenCount(root);
            for (int i = 0; i < count; i++)
            {
                var child = System.Windows.Media.VisualTreeHelper.GetChild(root, i);
                if (child is T c && (name == null || c.Name == name)) return c;
                var found = FindChild<T>(child, name);
                if (found != null) return found;
            }
            return null;
        }

        public void Dispose()
        {
            try { _wv?.Dispose(); } catch { /* ignore */ }
        }
    }
}
