using System;
using System.Windows;

namespace ABX.Hub
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            // Đặt fixed runtime & user-data trước khi tạo MainWindow
            try { Wv2Bootstrapper.EnsureFixedEnv(AppDomain.CurrentDomain.BaseDirectory); } catch { }

            base.OnStartup(e);
            var win = new MainWindow();
            MainWindow = win;
            win.Show();
        }
    }
}
