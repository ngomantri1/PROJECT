using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace BaccaratSexyCasino
{
    public partial class App : Application
    {
        public App()
        {
            DispatcherUnhandledException += OnDispatcherUnhandledException;
            AppDomain.CurrentDomain.UnhandledException += OnAppDomainUnhandledException;
            TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;
        }

        private static string GetFatalLogPath()
        {
            var dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BaccaratSexyCasino",
                "logs");
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, $"{DateTime.Today:yyyyMMdd}.fatal.log");
        }

        private static void WriteFatal(string source, string message)
        {
            try
            {
                var line = $"[{DateTime.Now:HH:mm:ss}] [{source}] {message}{Environment.NewLine}";
                File.AppendAllText(GetFatalLogPath(), line, Encoding.UTF8);
            }
            catch { }
        }

        private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
        {
            WriteFatal("DispatcherUnhandledException", e.Exception.ToString());
        }

        private void OnAppDomainUnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            WriteFatal("AppDomainUnhandledException", e.ExceptionObject?.ToString() ?? "(null)");
        }

        private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
        {
            WriteFatal("UnobservedTaskException", e.Exception.ToString());
        }
    }
}
