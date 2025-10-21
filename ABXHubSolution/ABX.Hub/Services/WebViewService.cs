// ABX.Hub/Services/WebViewService.cs
using System;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using ABX.Core;

namespace ABX.Hub.Services
{
    /// <summary>
    /// Dịch vụ WebView2 cho Hub:
    /// - Chia sẻ CoreWebView2Environment từ WebView header (WvHeader)
    /// - Tự gắn WebView plugin vào Border x:Name="AutoWebViewHost_Full" trong view của plugin
    /// - Cung cấp các API điều hướng, map thư mục, gửi message...
    /// </summary>
    public sealed class WebViewService : IWebViewService
    {
        private readonly WebView2 _root;          // WebView header (hub.html)
        private WebView2? _plugin;                // WebView dành cho plugin
        private CoreWebView2Environment? Env => _root.CoreWebView2?.Environment;

        public WebViewService(WebView2 headerWebView)
        {
            _root = headerWebView ?? throw new ArgumentNullException(nameof(headerWebView));
            if (_root.CoreWebView2 == null)
                throw new InvalidOperationException("Header WebView2 chưa EnsureCoreWebView2Async.");
        }

        // ===== IWebViewService =====
        public bool CoreReady => _root.CoreWebView2 != null;

        public void Navigate(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return;
            var target = _plugin ?? _root;
            target.Source = new Uri(url, UriKind.RelativeOrAbsolute);
        }

        public void NavigateToString(string html)
        {
            var core = _plugin?.CoreWebView2 ?? _root.CoreWebView2;
            core?.NavigateToString(html ?? string.Empty);
        }

        public void MapFolder(string hostName, string folder)
        {
            if (string.IsNullOrWhiteSpace(hostName) || string.IsNullOrWhiteSpace(folder)) return;
            var access = CoreWebView2HostResourceAccessKind.Allow;

            _root.CoreWebView2?.SetVirtualHostNameToFolderMapping(hostName, folder, access);
            _plugin?.CoreWebView2?.SetVirtualHostNameToFolderMapping(hostName, folder, access);
        }

        public void PostMessage(string json)
        {
            var core = _plugin?.CoreWebView2 ?? _root.CoreWebView2;
            core?.PostWebMessageAsString(json ?? "");
        }

        // ===== Auto-mount vào view plugin =====
        public void AttachTo(FrameworkElement root)
        {
            if (root == null) return;

            // Nếu chưa loaded, đợi loaded rồi làm lại
            if (!root.IsLoaded)
            {
                RoutedEventHandler? onLoaded = null;
                onLoaded = (s, e) =>
                {
                    root.Loaded -= onLoaded!;
                    AttachTo(root);
                };
                root.Loaded += onLoaded!;
                Debug.WriteLine("[AutoMount] Defer until view.Loaded");
                return;
            }

            // Tìm Border x:Name="AutoWebViewHost_Full"
            var host = root.FindName("AutoWebViewHost_Full") as Border
                       ?? FindDescendantByName<Border>(root, "AutoWebViewHost_Full", log: true);

            if (host == null)
            {
                Debug.WriteLine("[AutoMount] Không thấy 'AutoWebViewHost_Full'.");
                return;
            }

            EnsurePluginWebView();

            // Tháo khỏi parent cũ nếu có
            if (_plugin!.Parent is Border b) b.Child = null;
            else if (_plugin.Parent is Panel p) p.Children.Remove(_plugin);
            else if (_plugin.Parent is ContentControl cc) cc.Content = null;

            host.Child = _plugin;
            Debug.WriteLine("[AutoMount] Mounted WebView2 into 'AutoWebViewHost_Full'.");
        }

        public void DetachFromPlugin(bool dispose)
        {
            if (_plugin == null) return;

            try { _plugin.Source = new Uri("about:blank"); } catch { }
            if (_plugin.Parent is Border b) b.Child = null;
            else if (_plugin.Parent is Panel p) p.Children.Remove(_plugin);
            else if (_plugin.Parent is ContentControl cc) cc.Content = null;

            if (dispose)
            {
                try { _plugin.Dispose(); } catch { }
                _plugin = null;
            }
        }

        // ===== Helpers =====
        private void EnsurePluginWebView()
        {
            if (_plugin != null) return;
            if (Env == null) throw new InvalidOperationException("Không lấy được Environment từ header.");

            _plugin = new WebView2();
            _plugin.EnsureCoreWebView2Async(Env).GetAwaiter().GetResult();

            var st = _plugin.CoreWebView2.Settings;
            st.IsScriptEnabled = true;
            st.IsWebMessageEnabled = true;
            st.AreDevToolsEnabled = Debugger.IsAttached;
            st.AreDefaultContextMenusEnabled = false;
            st.IsStatusBarEnabled = false;

#if DEBUG
            // _plugin.CoreWebView2.OpenDevToolsWindow();
#endif
        }

        private static T? FindDescendantByName<T>(DependencyObject root, string name, bool log = false) where T : FrameworkElement
        {
            int count = VisualTreeHelper.GetChildrenCount(root);
            for (int i = 0; i < count; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child is FrameworkElement fe)
                {
                    if (log) Debug.WriteLine($"[AutoMount] Visit: {fe.GetType().Name} Name='{fe.Name}'");
                    if (fe is T t && fe.Name == name) return t;

                    var deeper = FindDescendantByName<T>(fe, name, log);
                    if (deeper != null) return deeper;
                }
            }
            return null;
        }
    }
}
