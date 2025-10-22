using System.Windows;

namespace ABX.Core
{
    /// <summary>
    /// Dịch vụ WebView tối thiểu mà host cung cấp cho plugin.
    /// Không phụ thuộc WebView2 để ABX.Core không cần tham chiếu package của WebView2.
    /// </summary>
    public interface IWebViewService
    {
        /// <summary>
        /// Đối tượng core trình duyệt (nếu có). Kiểu để "object?" để tránh phụ thuộc WebView2.
        /// Host có thể trả về CoreWebView2, nhưng plugin chỉ nên dùng các API trung lập của dịch vụ.
        /// </summary>
        object? Core { get; }

        /// <summary>Đã khởi tạo core hay chưa.</summary>
        bool CoreReady { get; }

        /// <summary>Điều hướng tới URL.</summary>
        void Navigate(string url);

        /// <summary>Điều hướng HTML string (SPA / nội dung nội bộ).</summary>
        void NavigateToString(string html, string? baseUrl = null);

        /// <summary>Map một thư mục thật thành virtual host (ví dụ https://app.local/...).</summary>
        void MapFolder(string hostName, string folderFullPath);

        /// <summary>Gắn WebView vào vùng hiển thị của plugin (mặc định tìm Border x:Name="AutoWebViewHost_Full").</summary>
        void AttachTo(FrameworkElement root);
    }
}
