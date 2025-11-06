using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using ABX.Core;

namespace AutoBetHub.Services
{
    public sealed class LogService : ILogService, IDisposable
    {
        private readonly string _logDir;
        private readonly string _file;
        private readonly object _lock = new();

        // Constructor nhận 1 tham số: thư mục log
        public LogService(string logDir)
        {
            _logDir = string.IsNullOrWhiteSpace(logDir)
                ? Path.Combine(AppContext.BaseDirectory, "logs")
                : logDir;

            Directory.CreateDirectory(_logDir);
            _file = Path.Combine(_logDir, $"hub_{DateTime.UtcNow:yyyyMMdd}.log");
        }

        // Optional: cho phép khởi tạo không tham số
        public LogService() : this(Path.Combine(AppContext.BaseDirectory, "logs")) { }

        private void Write(string level, string message)
        {
            var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{level}] {message}";
            lock (_lock)
            {
                File.AppendAllText(_file, line + Environment.NewLine, Encoding.UTF8);
            }
            Debug.WriteLine(line);
        }

        public void Info(string message) => Write("INFO", message);
        public void Warn(string message) => Write("WARN", message);
        public void Error(string message) => Write("ERROR", message);

        public void Error(Exception ex) => Write("ERROR", ex.ToString());

        // Overload để dùng chỗ: log.Error($"Load plugin failed: {dll}", ex);
        public void Error(string message, Exception ex)
            => Write("ERROR", $"{message} :: {ex}");

        public void Dispose() { /* hiện chưa cần giải phóng gì thêm */ }
    }
}
