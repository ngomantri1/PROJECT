using System;
using System.Diagnostics;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;

namespace XocDiaLiveHit.Views
{
    public partial class XocDiaLiveHitPanel : UserControl
    {
        // Host (ABX.Core.IGameHostContext) được Hub truyền vào ctor này.
        private readonly object? _host;

        // Dịch vụ WebView của Hub (kiểu thực tế: ABX.Hub.Services.WebViewService)
        private object? _webSvc;

        private bool _attachedOnce;

        public XocDiaLiveHitPanel()
        {
            InitializeComponent();
            Loaded += OnLoaded_AttachAndRender;
            Unloaded += OnUnloaded_Detach;
        }

        // Hub sẽ dùng ctor này
        public XocDiaLiveHitPanel(object host) : this()
        {
            _host = host;
        }

        // ============= lifecycle =============

        private void OnLoaded_AttachAndRender(object? sender, RoutedEventArgs e)
        {
            if (_attachedOnce) return;
            _attachedOnce = true;

            try
            {
                // 1) Lấy IWebViewService từ host bằng reflection
                _webSvc ??= TryGetWebService(_host);

                if (_webSvc == null)
                {
                    Debug.WriteLine("[XocDia] Không lấy được IWebViewService từ host.");
                    return;
                }

                // 2) Gắn WebView2 (từ Hub) vào visual tree của plugin
                var attach = _webSvc.GetType().GetMethod(
                    "AttachTo",
                    BindingFlags.Public | BindingFlags.Instance,
                    binder: null,
                    types: new[] { typeof(FrameworkElement) },
                    modifiers: null
                );

                if (attach == null)
                {
                    Debug.WriteLine("[XocDia] IWebViewService.AttachTo(...) không có – kiểm tra lại Hub.");
                    return;
                }

                attach.Invoke(_webSvc, new object[] { this });

                Debug.WriteLine("[XocDia] Host WebView attached.");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[XocDia] Attach error: {ex}");
            }
        }

        private void OnUnloaded_Detach(object? sender, RoutedEventArgs e)
        {
            try
            {
                // Không dispose WebView2 (thuộc Hub). Chỉ dọn placeholder của plugin nếu cần.
                if (FindName("AutoWebViewHost_Full") is Border host &&
                    host.Child != null)
                {
                    host.Child = null; // tránh giữ reference khi panel bị tháo ra
                }
            }
            catch { /* ignore */ }
        }

        // ============= helpers =============

        /// <summary>
        /// Lấy IWebViewService từ host:
        /// - Ưu tiên property tên quen thuộc: Web, WebView, WV, Wv2, WvService
        /// - Hoặc bất kỳ property có type/iface tên "IWebViewService"
        /// </summary>
        private static object? TryGetWebService(object? host)
        {
            if (host == null) return null;
            var ht = host.GetType();

            // 1) Tên property phổ biến
            foreach (var name in new[] { "Web", "WebView", "WV", "Wv2", "WvService" })
            {
                var p = ht.GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
                var v = p?.GetValue(host);
                if (LooksLikeWebSvc(v)) return v!;
            }

            // 2) Bất kỳ property có type hoặc interface tên "IWebViewService"
            foreach (var p in ht.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                var t = p.PropertyType;
                if (t.Name == "IWebViewService") return p.GetValue(host);

                foreach (var it in t.GetInterfaces())
                    if (it.Name == "IWebViewService")
                        return p.GetValue(host);
            }

            return null;
        }

        /// <summary>
        /// Nhận diện "IWebViewService" bằng signature các method phổ biến.
        /// </summary>
        private static bool LooksLikeWebSvc(object? x)
        {
            if (x == null) return false;
            var t = x.GetType();

            // AttachTo(FrameworkElement) là đủ để nhận diện
            if (t.GetMethod("AttachTo", new[] { typeof(FrameworkElement) }) != null)
                return true;

            // Bộ đôi CoreReady + NavigateToString(string)
            if (t.GetProperty("CoreReady") != null &&
                t.GetMethod("NavigateToString", new[] { typeof(string) }) != null)
                return true;

            return false;
        }
    }
}
