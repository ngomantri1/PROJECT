using System.Windows;

namespace XocDiaSoiLiveKH24
{
    public partial class MainWindow
    {
        // cho phép set nội bộ assembly (UserControl của bạn cũng nằm trong assembly này)
        public static bool EmbedMode { get; internal set; }

        /// <summary>
        /// Tạo UI để nhúng vào Hub
        /// </summary>
        public static UIElement CreateEmbeddedContent()
        {
            // bật cờ
            EmbedMode = true;

            // gọi đúng ctor gốc để nó gọi PackRes.EnsureGlobalResourcesLoaded()
            var win = new MainWindow();

            var root = win.Content as UIElement;
            win.Content = null;
            return root!;
        }
    }
}
