using System;
using System.IO;
using System.Windows;
using System.Windows.Media.Imaging;

namespace XocDiaLiveHit
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
            TryMerge(app.Resources, "pack://application:,,,/XocDiaLiveHit;component/Assets/Images.xaml");

            // 2. fallback: tự tạo ảnh để dù Images.xaml không load được vẫn không vỡ XAML
            EnsureImage(app.Resources, "ImgLE", "Assets/side/LE.png");
            EnsureImage(app.Resources, "ImgCHAN", "Assets/side/CHAN.png");
            EnsureImage(app.Resources, "ImgTHANG", "Assets/kq/THANG.png");
            EnsureImage(app.Resources, "ImgTHUA", "Assets/kq/THUA.png");
            EnsureImage(app.Resources, "ImgBALL0", "Assets/Seq/ball0.png");
            EnsureImage(app.Resources, "ImgBALL1", "Assets/Seq/ball1.png");
            EnsureImage(app.Resources, "ImgBALL2", "Assets/Seq/ball2.png");
            EnsureImage(app.Resources, "ImgBALL3", "Assets/Seq/ball3.png");
            EnsureImage(app.Resources, "ImgBALL4", "Assets/Seq/ball4.png");
            EnsureImage(app.Resources, "ImgTU_TRANG", "Assets/side/TU_TRANG.png");
            EnsureImage(app.Resources, "ImgTU_DO", "Assets/side/TU_DO.png");
            EnsureImage(app.Resources, "ImgSAP_DOI", "Assets/side/SAP_DOI.png");
            EnsureImage(app.Resources, "ImgTRANG3_DO1", "Assets/side/1DO_3TRANG.png");
            EnsureImage(app.Resources, "ImgDO3_TRANG1", "Assets/side/1TRANG_3DO.png");
            EnsureImage(app.Resources, "ImgBALL0", "pack://application:,,,/XocDiaLiveHit;component/Assets/Seq/ball0.png");
            EnsureImage(app.Resources, "ImgBALL1", "pack://application:,,,/XocDiaLiveHit;component/Assets/Seq/ball1.png");
            EnsureImage(app.Resources, "ImgBALL2", "pack://application:,,,/XocDiaLiveHit;component/Assets/Seq/ball2.png");
            EnsureImage(app.Resources, "ImgBALL3", "pack://application:,,,/XocDiaLiveHit;component/Assets/Seq/ball3.png");
            EnsureImage(app.Resources, "ImgBALL4", "pack://application:,,,/XocDiaLiveHit;component/Assets/Seq/ball4.png");

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

        private static void EnsureImage(ResourceDictionary res, string key, string relPath)
        {
            if (res.Contains(key))
                return;

            try
            {
                var img = FallbackIcons.LoadPackImage(relPath);
                if (img != null)
                    res.Add(key, img);
            }
            catch
            {
                // đừng vứt exception ra ngoài, để plugin vẫn mount được
            }
        }
    }
}
