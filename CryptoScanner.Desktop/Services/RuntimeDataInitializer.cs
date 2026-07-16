using System.IO;
using System.Text;

namespace CryptoScanner.Desktop.Services;

public static class RuntimeDataInitializer
{
 const string UnlockCacheReadme = """
 CryptoScanner.Desktop - Unlock Cache

 Đặt file unlock thật tại:
 %LOCALAPPDATA%\CryptoScanner.Desktop\data\unlock-cache.json

 File mẫu trong thư mục config chỉ dùng để kiểm tra định dạng.
 Ứng dụng không tự tải, không tự cập nhật và không tự tạo dữ liệu unlock.

 Trạng thái có thể hiển thị:
 CACHE_MISSING       Không tìm thấy file
 CACHE_ERROR         File không đọc được hoặc JSON không hợp lệ
 LOCAL_CACHE         File hợp lệ và đang được sử dụng
 LOCAL_CACHE_EXPIRED File hợp lệ nhưng đã hết hạn

 Sau khi thay đổi file, hãy chạy lại scanner để kết quả mới được áp dụng vào snapshot và DecisionCode.
 """;

 public static async Task EnsureAsync(CancellationToken ct = default)
 {
  Directory.CreateDirectory(AppPaths.DataDirectory);
  if (File.Exists(AppPaths.UnlockCacheReadmePath)) return;

  await File.WriteAllTextAsync(AppPaths.UnlockCacheReadmePath, UnlockCacheReadme, Encoding.UTF8, ct);
 }
}
