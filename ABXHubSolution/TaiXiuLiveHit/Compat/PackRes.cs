using System;
using System.IO;
using System.Windows;
using System.Windows.Media.Imaging;

namespace TaiXiuLiveHit
{
    /// <summary>
    /// Nhiệm vụ:
    /// 1) Merge resource từ file XAML (Assets/Images.xaml) để XAML dùng StaticResource không lỗi.
    /// 2) Nếu merge thất bại thì tự tạo BitmapImage từ pack URI để vẫn chạy được.
    /// 3) Đăng ký luôn mấy converter mà MainWindow.xaml đang xài.
    /// 
    /// Gọi: PackRes.EnsureGlobalResourcesLoaded();
    /// -> gọi thật sớm trong ctor MainWindow, trước InitializeComponent().
    /// </summary>
    internal static class PackRes
    {
        private static bool _loaded;

        public static void EnsureGlobalResourcesLoaded()
        {
            if (_loaded) return;
            _loaded = true;

            var app = Application.Current;
            if (app == null)
            {
                // rất hiếm mới vào đây, nhưng cứ để an toàn
                return;
            }

            // 1. cố gắng merge dictionary gốc
            TryMerge(app.Resources, "pack://application:,,,/TaiXiuLiveHit;component/Assets/Images.xaml");

            // 2. fallback: tự tạo ảnh để dù Images.xaml không load được vẫn không vỡ XAML
            EnsureImage(app.Resources, "ImgXIU", "pack://application:,,,/TaiXiuLiveHit;component/Assets/side/XIU.png");
            EnsureImage(app.Resources, "ImgTAI", "pack://application:,,,/TaiXiuLiveHit;component/Assets/side/TAI.png");
            EnsureImage(app.Resources, "ImgTHANG", "pack://application:,,,/TaiXiuLiveHit;component/Assets/kq/THANG.png");
            EnsureImage(app.Resources, "ImgTHUA", "pack://application:,,,/TaiXiuLiveHit;component/Assets/kq/THUA.png");

            // 3. đăng ký converter (XAML của bạn đang dùng StaticResource mấy cái này)
            if (!app.Resources.Contains("SideToIconConverter"))
                app.Resources.Add("SideToIconConverter", new SideToIconConverter());

            if (!app.Resources.Contains("KetQuaToIconConverter"))
                app.Resources.Add("KetQuaToIconConverter", new KetQuaToIconConverter());

            if (!app.Resources.Contains("WinLossToIconConverter"))
                app.Resources.Add("WinLossToIconConverter", new WinLossToIconConverter());

            if (!app.Resources.Contains("ProgressWidthConverter"))
                app.Resources.Add("ProgressWidthConverter", new ProgressWidthConverter());
        }

        private static void TryMerge(ResourceDictionary target, string uri)
        {
            try
            {
                var rd = new ResourceDictionary
                {
                    Source = new Uri(uri, UriKind.Absolute)
                };
                target.MergedDictionaries.Add(rd);
            }
            catch (IOException)
            {
                // không có file / không build thành Resource -> thôi, để fallback tạo ảnh
            }
            catch
            {
                // bỏ qua luôn để không chặn UI
            }
        }

        private static void EnsureImage(ResourceDictionary res, string key, string packUri)
        {
            if (res.Contains(key))
                return;

            try
            {
                var bi = new BitmapImage();
                bi.BeginInit();
                bi.UriSource = new Uri(packUri, UriKind.Absolute);
                bi.CacheOption = BitmapCacheOption.OnLoad;
                bi.EndInit();
                bi.Freeze();
                res.Add(key, bi);
            }
            catch
            {
                // đừng vứt exception ra ngoài, để plugin vẫn mount được
            }
        }
    }
}
