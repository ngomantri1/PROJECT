using System;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using ABX.Core; // để nhận IGameHostContext từ Hub

namespace XocDiaLiveHit.Views
{
    public partial class XocDiaLiveHitPanel : UserControl
    {
        private readonly IGameHostContext _host;
        private XocDiaLiveHit.MainWindow? _innerWindow;   // window thật của game
        private UIElement? _innerRoot;                    // root UI đã tách ra để nhúng

        public XocDiaLiveHitPanel(IGameHostContext host)
        {
            InitializeComponent();
            _host = host;

            Loaded += OnLoaded;
            Unloaded += OnUnloaded;
        }

        private void OnLoaded(object? sender, RoutedEventArgs e)
        {
            if (_innerWindow != null) return;

            // 1) Tạo instance của MainWindow (window gốc của game)
            _innerWindow = new XocDiaLiveHit.MainWindow();

            // (tuỳ chọn) nếu bạn muốn truyền môi trường Hub vào game:
            // - Nếu về sau bạn thêm property công khai trong MainWindow, ví dụ:
            //   public ABX.Core.IGameHostContext? Host { get; set; }
            //   thì bạn có thể truyền vào như sau (không bắt buộc):
            // try { _innerWindow.GetType().GetProperty("Host")?.SetValue(_innerWindow, _host); } catch {}

            // 2) Lấy UI gốc (Content) của window và nhúng vào RootHost
            _innerRoot = _innerWindow.Content as UIElement;
            _innerWindow.Content = null;           // tháo khỏi Window để tránh 2 chủ sở hữu
            RootHost.Children.Clear();
            if (_innerRoot != null)
            {
                RootHost.Children.Add(_innerRoot);
            }

            // 3) Gọi thủ công các hook nếu trong MainWindow có logic cần chạy sau khi Loaded
            //    Nếu bạn có các method public như EnsureWebReadyAsync/Start... có thể gọi bằng reflection:
            //    (không bắt buộc; chỉ dùng khi cần “kích hoạt” nghiệp vụ ngay)
            TryCallMethod(_innerWindow, "Window_Loaded");     // nếu bạn có handler tên này (void, không tham số)
            TryCallMethod(_innerWindow, "MainWindow_Loaded"); // hoặc tên khác (tuỳ bạn dùng trong code)
        }

        private void OnUnloaded(object? sender, RoutedEventArgs e)
        {
            try
            {
                // Nếu trong MainWindow có hàm Stop/Dispose/Close… hãy gọi bằng reflection cho an toàn
                TryCallMethod(_innerWindow, "Stop");
                TryCallMethod(_innerWindow, "Dispose");
                TryCallMethod(_innerWindow, "Close");
            }
            catch { /* nuốt lỗi để không ảnh hưởng Hub */ }
            finally
            {
                RootHost.Children.Clear();
                _innerRoot = null;
                _innerWindow = null;
            }
        }

        private static void TryCallMethod(object? obj, string methodName)
        {
            if (obj == null) return;
            try
            {
                var m = obj.GetType().GetMethod(methodName,
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    binder: null, types: Type.EmptyTypes, modifiers: null);
                m?.Invoke(obj, null);
            }
            catch
            {
                // im lặng: method không tồn tại hoặc lỗi bên trong — không làm hỏng plugin
            }
        }
    }
}
