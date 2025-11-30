// XocDiaSoiLiveKH241Plugin.cs
using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ABX.Core;
using XocDiaSoiLiveKH241.Views;

namespace XocDiaSoiLiveKH241
{
    public sealed class XocDiaSoiLiveKH241Plugin : IGamePlugin
    {
        private MainWindow? _window;
        private IGameHostContext? _host;   // giữ lại để báo ngược về Hub

        public string Name => "Xóc Đĩa Sới Live KH24";
        public string Slug => "xoc-dia-soi-live-kh24";

        public UserControl CreateView(IGameHostContext host)
        {
            // lưu lại để còn gọi OnPluginWindowClosed(...)
            _host = host;

            // 1) merge + tạo fallback ở mức App
            PackRes.EnsureGlobalResourcesLoaded(); // để có converter, key, v.v.

            // 2) in log đường dẫn dll + file thật
            LogResourceProbe(host);

            // 3) đè vào App trước
            InjectImagesTo(host, Application.Current?.Resources);

            TryLog(host, "[XocDia] CreateView ENTER (window-mode)");

            try
            {
                if (_window == null)
                {
                    _window = new MainWindow();
                    // cửa sổ plugin có icon riêng trên taskbar
                    _window.ShowInTaskbar = true;
                    // đè lại ngay trên window để át 4 dòng XAML kia
                    InjectImagesTo(host, _window.Resources);

                    _window.Closed += (s, e) =>
                    {
                        TryLog(host, "[XocDia] plugin window closed, reset.");

                        // dọn dẹp nội bộ cửa sổ (gọi code bạn đã viết trong MainWindow)
                        try { _window.ShutdownFromHost(); } catch { }

                        // BÁO NGƯỢC LÊN HUB: "plugin này đã đóng cửa sổ"
                        try { _host?.OnPluginWindowClosed(this.Slug); } catch { }

                        _window = null;
                    };

                    _window.Show();
                    TryLog(host, "[XocDia] plugin window shown from CreateView().");

                    // chạy đúng nghiệp vụ cũ trong MainWindow
                    _ = _window.RunStartupAsync(host);
                }
                else
                {
                    // nếu window đã tạo rồi thì vẫn đè lại 1 lần nữa cho chắc
                    InjectImagesTo(host, _window.Resources);

                    if (_window.WindowState == WindowState.Minimized)
                        _window.WindowState = WindowState.Normal;

                    _window.Activate();
                    _ = _window.RunStartupAsync(host);
                }

                // Hub vẫn cần 1 control để gắn
                return new PluginStubView();
            }
            catch (Exception ex)
            {
                TryLog(host, "[XocDia] CreateView ERROR: " + ex);
                return BuildErrorStub("Xóc Đĩa Live: lỗi khởi tạo giao diện.\n" + ex.Message);
            }
            finally
            {
                TryLog(host, "[XocDia] CreateView LEAVE");
            }
        }

        // Hub gọi Stop() khi chuyển plugin hoặc khi home bảo tắt
        public void Stop()
        {
            try
            {
                if (_window != null)
                {
                    // gọi đúng cổng dọn dẹp của window (bên bạn đã viết trong MainWindow.xaml.cs)
                    _window.ShutdownFromHost();
                    _window.Close();
                }
            }
            catch
            {
                // tránh văng lỗi lên hub
            }
            finally
            {
                _window = null;
            }
        }

        /// <summary>
        /// Đè 4 hình vào 1 ResourceDictionary cụ thể (App hoặc Window).
        /// </summary>
        private static void InjectImagesTo(IGameHostContext host, ResourceDictionary? dict)
        {
            if (dict == null) return;

            // phải là 3 dấu phẩy
            const string prefix = "pack://application:,,,/XocDiaSoiLiveKH241;component/";

            void SetImg(string key, string rel)
            {
                var fullUri = prefix + rel;
                try
                {
                    var bmp = new BitmapImage();
                    bmp.BeginInit();
                    bmp.UriSource = new Uri(fullUri, UriKind.Absolute);
                    bmp.CacheOption = BitmapCacheOption.OnLoad;
                    bmp.EndInit();
                    bmp.Freeze();

                    dict[key] = bmp;
                    TryLog(host, $"[XocDia] InjectImagesTo: set {key} = {fullUri}");
                }
                catch (Exception ex)
                {
                    TryLog(host, $"[XocDia] InjectImagesTo: FAILED {key} -> {ex.Message}");
                }
            }

            SetImg("ImgCHAN", "Assets/side/CHAN.png");
            SetImg("ImgLE", "Assets/side/LE.png");
            SetImg("ImgTHANG", "Assets/kq/THANG.png");
            SetImg("ImgTHUA", "Assets/kq/THUA.png");

            // giữ lại để các converter trong MainWindow dùng chung
            try
            {
                if (dict["ImgCHAN"] is ImageSource chan) XocDiaSoiLiveKH241.MainWindow.SharedIcons.SideChan = chan;
                if (dict["ImgLE"] is ImageSource le) XocDiaSoiLiveKH241.MainWindow.SharedIcons.SideLe = le;
                if (dict["ImgCHAN"] is ImageSource chan2) XocDiaSoiLiveKH241.MainWindow.SharedIcons.ResultChan = chan2;
                if (dict["ImgLE"] is ImageSource le2) XocDiaSoiLiveKH241.MainWindow.SharedIcons.ResultLe = le2;
                if (dict["ImgTHANG"] is ImageSource win) XocDiaSoiLiveKH241.MainWindow.SharedIcons.Win = win;
                if (dict["ImgTHUA"] is ImageSource loss) XocDiaSoiLiveKH241.MainWindow.SharedIcons.Loss = loss;
            }
            catch { }
        }

        private static void LogResourceProbe(IGameHostContext host)
        {
            try
            {
                var asm = typeof(XocDiaSoiLiveKH241Plugin).Assembly;
                var asmPath = asm.Location;
                var asmDir = Path.GetDirectoryName(asmPath) ?? "";

                TryLog(host, "[XocDia] Plugin asm path: " + asmPath);

                var probe1 = Path.Combine(asmDir, "Assets", "side", "CHAN.png");
                var probe2 = Path.Combine(asmDir, "assets", "side", "CHAN.png");

                TryLog(host, "[XocDia] Probe file (Assets): " + probe1 + " exists=" + File.Exists(probe1));
                TryLog(host, "[XocDia] Probe file (assets): " + probe2 + " exists=" + File.Exists(probe2));

                TryLog(host, "[XocDia] Expecting URI: /XocDiaSoiLiveKH241;component/Assets/side/CHAN.png");
            }
            catch (Exception ex)
            {
                TryLog(host, "[XocDia] LogResourceProbe failed: " + ex.Message);
            }
        }

        private static void TryLog(IGameHostContext host, string message)
        {
            try { host?.Log?.Info(message); } catch { }
        }

        private static UserControl BuildErrorStub(string message)
        {
            return new UserControl
            {
                Content = new Border
                {
                    Background = Brushes.Black,
                    Padding = new Thickness(16),
                    Child = new TextBlock
                    {
                        Text = message,
                        Foreground = Brushes.OrangeRed,
                        FontSize = 16,
                        TextWrapping = TextWrapping.Wrap
                    }
                }
            };
        }
    }
}
