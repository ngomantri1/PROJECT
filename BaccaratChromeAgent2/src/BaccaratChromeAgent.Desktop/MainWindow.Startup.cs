// BaccaratSexyCasino2/MainWindow.Startup.cs
using System.Threading.Tasks;

namespace BaccaratSexyCasino2
{
    public partial class MainWindow
    {
        /// <summary>
        /// Điểm khởi động tương thích trong giai đoạn 1.
        /// Chỉ nạp cấu hình; WebView2 và điều hướng cũ đã bị vô hiệu hóa.
        /// Giai đoạn 2 sẽ nối phương thức này với ChromeGameBridge.
        /// </summary>
        public Task RunStartupAsync(object? host = null)
        {
            LoadConfig();
            return Task.CompletedTask;
        }
    }
}
