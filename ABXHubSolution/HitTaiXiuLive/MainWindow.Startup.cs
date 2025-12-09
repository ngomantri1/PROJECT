// HitTaiXiuLive/MainWindow.Startup.cs
using System.IO;
using System.Threading.Tasks;
using ABX.Core;

namespace HitTaiXiuLive
{
    public partial class MainWindow
    {
        /// <summary>
        /// Chạy đúng nghiệp vụ: load config -> init WebView -> navigate -> autofill -> apply background.
        /// Dùng được cả khi chạy độc lập và khi được Hub gọi.
        /// </summary>
        public async Task RunStartupAsync(IGameHostContext? host)
        {
            // 1) đọc config lên UI
            LoadConfig();

            // 2) đảm bảo WebView2 sẵn
            await EnsureWebReadyAsync();

            // 3) lấy URL từ textbox hoặc từ _cfg
            string url = (TxtUrl?.Text ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(url) && _cfg != null)
                url = _cfg.Url ?? string.Empty;

            // 4) điều hướng
            if (!string.IsNullOrWhiteSpace(url))
                await NavigateIfNeededAsync(url);

            // 5) tự điền user/pass
            await AutoFillLoginAsync();

            // 6) nền
            await ApplyBackgroundForStateAsync();

            // 7) nếu Hub có Web thì map thư mục web cạnh DLL
            if (host?.Web != null)
            {
                try
                {
                    var asmDir = Path.GetDirectoryName(typeof(MainWindow).Assembly.Location)!;
                    var webDir = Path.Combine(asmDir, "web");
                    if (Directory.Exists(webDir))
                        host.Web.MapFolder("tai-xiu-live-hit.local", webDir);
                }
                catch
                {
                    // bỏ qua
                }
            }
        }
    }
}
