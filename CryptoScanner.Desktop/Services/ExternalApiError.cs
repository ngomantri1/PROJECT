using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;

namespace CryptoScanner.Desktop.Services;

public static class ExternalApiError
{
 public static bool IsTransient(Exception ex) => GetHttpStatusCode(ex) is { } status
   ? status == HttpStatusCode.TooManyRequests || (int)status >= 500
   : Contains<IOException>(ex) || Contains<SocketException>(ex) || Contains<HttpRequestException>(ex) || Contains<TaskCanceledException>(ex);

 public static string ToUserMessage(Exception ex)
 {
  var status = GetHttpStatusCode(ex);
  if (status == HttpStatusCode.TooManyRequests)
  {
   return "CoinGecko đang giới hạn tần suất truy cập. Vui lòng chờ vài phút rồi quét lại.";
  }

  if (status is not null && (int)status >= 500)
  {
   return "CoinGecko đang lỗi tạm thời. Vui lòng thử quét lại sau.";
  }

  if (Contains<IOException>(ex) || Contains<SocketException>(ex) || Contains<HttpRequestException>(ex))
  {
   return "Kết nối tới nguồn dữ liệu thị trường bị gián đoạn. Vui lòng kiểm tra mạng hoặc thử lại sau.";
  }

  if (Contains<TaskCanceledException>(ex))
  {
   return "Nguồn dữ liệu thị trường phản hồi quá lâu. Vui lòng thử quét lại sau.";
  }

  return "Quét thị trường thất bại. Xem log để biết chi tiết.";
 }

 public static HttpStatusCode? GetHttpStatusCode(Exception ex)
 {
  for (var current = ex; current is not null; current = current.InnerException)
  {
   if (current is HttpRequestException httpEx && httpEx.StatusCode is not null) return httpEx.StatusCode;
  }

  return null;
 }

 static bool Contains<T>(Exception ex) where T : Exception
 {
  for (var current = ex; current is not null; current = current.InnerException)
  {
   if (current is T) return true;
  }

  return false;
 }
}
