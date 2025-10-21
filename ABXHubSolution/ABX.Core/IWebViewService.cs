using System.Windows;

namespace ABX.Core;

public interface IWebViewService
{
    // ĐÃ CÓ:
    void AttachTo(FrameworkElement root);
    void Navigate(string url);

    // THÊM:
    void NavigateToString(string html);                 // cho trang nội bộ nếu cần
    void MapFolder(string hostName, string folderPath); // Virtual host -> thư mục assets của plugin
}

