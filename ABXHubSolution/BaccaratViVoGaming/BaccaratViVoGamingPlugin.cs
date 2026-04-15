// BaccaratViVoGamingPlugin.cs
using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ABX.Core;
using BaccaratViVoGaming.Views;

namespace BaccaratViVoGaming
{
    public sealed class BaccaratViVoGamingPlugin : IGamePlugin
    {
        private MainWindow? _window;
        private IGameHostContext? _host;   // giữ lại để báo ngược về Hub

        public string Name => "Baccarat Sexy Casino Live";
        public string Slug => "baccarat-sexy-casino";

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

            TryLog(host, "[BaccaratViVoGaming] CreateView ENTER (window-mode)");

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
                        TryLog(host, "[BaccaratViVoGaming] plugin window closed, reset.");

                        // dọn dẹp nội bộ cửa sổ (gọi code bạn đã viết trong MainWindow)
                        try { _window.ShutdownFromHost(); } catch { }

                        // BÁO NGƯỢC LÊN HUB: "plugin này đã đóng cửa sổ"
                        try { _host?.OnPluginWindowClosed(this.Slug); } catch { }

                        _window = null;
                    };

                    _window.Show();
                    TryLog(host, "[BaccaratViVoGaming] plugin window shown from CreateView().");

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
                TryLog(host, "[BaccaratViVoGaming] CreateView ERROR: " + ex);
                return BuildErrorStub("Xóc Đĩa Live: lỗi khởi tạo giao diện.\n" + ex.Message);
            }
            finally
            {
                TryLog(host, "[BaccaratViVoGaming] CreateView LEAVE");
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

            void SetImg(string key, string rel)
            {
                var img = FallbackIcons.LoadPackImage(rel);
                if (img != null)
                {
                    dict[key] = img;
                    TryLog(host, $"[BaccaratViVoGaming] InjectImagesTo: set {key} from {rel}");
                }
                else
                {
                    TryLog(host, $"[BaccaratViVoGaming] InjectImagesTo: FAILED {key} (not found)");
                }
            }

            SetImg("ImgBANKER", "Assets/side/BANKER.png");
            SetImg("ImgPLAYER", "Assets/side/PLAYER.png");
            SetImg("ImgTIE", "Assets/side/TIE.png");
            SetImg("ImgTHANG", "Assets/kq/THANG.png");
            SetImg("ImgTHUA", "Assets/kq/THUA.png");
            SetImg("ImgHOA", "Assets/kq/HOA.png");
            SetImg("ImgBALL0", "Assets/side/TU_TRANG.png");
            SetImg("ImgBALL1", "Assets/side/1TRANG_3DO.png");
            SetImg("ImgBALL2", "Assets/side/SAP_DOI.png");
            SetImg("ImgBALL3", "Assets/side/1DO_3TRANG.png");
            SetImg("ImgBALL4", "Assets/side/TU_DO.png");
            SetImg("ImgTU_TRANG", "Assets/side/TU_TRANG.png");
            SetImg("ImgTU_DO", "Assets/side/TU_DO.png");
            SetImg("ImgSAP_DOI", "Assets/side/SAP_DOI.png");
            SetImg("ImgTRANG3_DO1", "Assets/side/1DO_3TRANG.png");
            SetImg("ImgDO3_TRANG1", "Assets/side/1TRANG_3DO.png");

            // giữ lại để các converter trong MainWindow dùng chung
            try
            {
                if (dict["ImgBANKER"] is ImageSource chan) BaccaratViVoGaming.MainWindow.SharedIcons.SideBanker = chan;
                if (dict["ImgPLAYER"] is ImageSource le) BaccaratViVoGaming.MainWindow.SharedIcons.SidePlayer = le;
                if (dict["ImgBANKER"] is ImageSource chan2) BaccaratViVoGaming.MainWindow.SharedIcons.ResultBanker = chan2;
                if (dict["ImgPLAYER"] is ImageSource le2) BaccaratViVoGaming.MainWindow.SharedIcons.ResultPlayer = le2;
                if (dict["ImgTHANG"] is ImageSource win) BaccaratViVoGaming.MainWindow.SharedIcons.Win = win;
                if (dict["ImgTHUA"] is ImageSource loss) BaccaratViVoGaming.MainWindow.SharedIcons.Loss = loss;
                if (dict["ImgHOA"] is ImageSource draw) BaccaratViVoGaming.MainWindow.SharedIcons.Draw = draw;
                // set thêm các icon mới cho converter
                if (dict["ImgTU_TRANG"] is ImageSource tuw) BaccaratViVoGaming.MainWindow.SharedIcons.TuTrang = tuw;
                if (dict["ImgTU_DO"] is ImageSource tur) BaccaratViVoGaming.MainWindow.SharedIcons.TuDo = tur;
                if (dict["ImgSAP_DOI"] is ImageSource sap) BaccaratViVoGaming.MainWindow.SharedIcons.SapDoi = sap;
                if (dict["ImgTRANG3_DO1"] is ImageSource t31) BaccaratViVoGaming.MainWindow.SharedIcons.Trang3Do1 = t31;
                if (dict["ImgDO3_TRANG1"] is ImageSource d31) BaccaratViVoGaming.MainWindow.SharedIcons.Do3Trang1 = d31;
            }
            catch { }
        }

        private static void LogResourceProbe(IGameHostContext host)
        {
            try
            {
                var asm = typeof(BaccaratViVoGamingPlugin).Assembly;
                var asmPath = asm.Location;
                var asmDir = Path.GetDirectoryName(asmPath) ?? "";

                TryLog(host, "[BaccaratViVoGaming] Plugin asm path: " + asmPath);

                var probe1 = Path.Combine(asmDir, "Assets", "side", "BANKER.png");
                var probe2 = Path.Combine(asmDir, "assets", "side", "BANKER.png");

                TryLog(host, "[BaccaratViVoGaming] Probe file (Assets): " + probe1 + " exists=" + File.Exists(probe1));
                TryLog(host, "[BaccaratViVoGaming] Probe file (assets): " + probe2 + " exists=" + File.Exists(probe2));

                TryLog(host, "[BaccaratViVoGaming] Expecting URI: /BaccaratViVoGaming;component/Assets/side/BANKER.png");
            }
            catch (Exception ex)
            {
                TryLog(host, "[BaccaratViVoGaming] LogResourceProbe failed: " + ex.Message);
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

