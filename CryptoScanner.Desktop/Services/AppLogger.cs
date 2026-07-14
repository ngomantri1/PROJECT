using System.IO;
using System.Text;

namespace CryptoScanner.Desktop.Services;

public static class AppLogger
{
 static readonly object Gate = new();

 public static string LogDirectory { get; } = Path.Combine(
  Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
  "CryptoScanner.Desktop",
  "logs");

 public static string CurrentLogPath => Path.Combine(LogDirectory, $"{DateTime.Today:yyyyMMdd}.log");

 public static void Info(string message) => Write("INFO", message);

 public static void Warn(string message) => Write("WARN", message);

 public static void Error(string message, Exception? exception = null)
 {
  var text = exception is null ? message : message + Environment.NewLine + exception;
  Write("ERROR", text);
 }

 static void Write(string level, string message)
 {
  try
  {
   Directory.CreateDirectory(LogDirectory);
   var line = $"[{DateTime.Now:HH:mm:ss}] [{level}] {message}{Environment.NewLine}";
   lock (Gate)
   {
    File.AppendAllText(CurrentLogPath, line, Encoding.UTF8);
   }
  }
  catch
  {
   // Logging must never crash the scanner.
  }
 }
}
