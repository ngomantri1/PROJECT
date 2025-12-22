using System;
using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Windows;

namespace AutoBetHub
{
    public partial class App : Application
    {
        private static Mutex? _singleInstanceMutex;
        internal const string SlugPipeName = "AutoBetHub_SlugPipe";

        protected override void OnStartup(StartupEventArgs e)
        {
            var startupSlug = ExtractStartupSlug(e.Args);

            bool createdNew;
            _singleInstanceMutex = new Mutex(true, "AutoBetHub_SingleInstance", out createdNew);

            if (!createdNew)
            {
                TrySendSlugToExistingInstance(startupSlug);
                Shutdown();
                return;
            }

            try { Wv2Bootstrapper.EnsureFixedEnv(AppDomain.CurrentDomain.BaseDirectory); } catch { }

            base.OnStartup(e);
            var win = new MainWindow(startupSlug);
            MainWindow = win;
            win.Show();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            if (_singleInstanceMutex != null)
            {
                _singleInstanceMutex.ReleaseMutex();
                _singleInstanceMutex.Dispose();
                _singleInstanceMutex = null;
            }

            base.OnExit(e);
        }

        private static bool TrySendSlugToExistingInstance(string? slug)
        {
            if (string.IsNullOrWhiteSpace(slug)) return false;

            try
            {
                using var client = new NamedPipeClientStream(".", SlugPipeName, PipeDirection.Out);
                client.Connect(400);
                using var writer = new StreamWriter(client, Encoding.UTF8) { AutoFlush = true };
                writer.WriteLine(slug);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static string? ExtractStartupSlug(string[] args)
        {
            if (args == null || args.Length == 0) return null;

            for (int i = 0; i < args.Length; i++)
            {
                var a = args[i]?.Trim();
                if (string.IsNullOrWhiteSpace(a)) continue;

                if (a.StartsWith("--slug=", StringComparison.OrdinalIgnoreCase))
                    return a.Substring("--slug=".Length).Trim().Trim('"');

                if (string.Equals(a, "--slug", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                    return args[i + 1].Trim().Trim('"');
            }

            return null;
        }
    }
}
