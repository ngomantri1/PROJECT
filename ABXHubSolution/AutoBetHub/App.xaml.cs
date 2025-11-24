using System;
using System.Windows;
using System.Threading; // thêm

namespace AutoBetHub
{
    public partial class App : Application
    {
        // THÊM FIELD NÀY
        private static Mutex? _singleInstanceMutex;

        protected override void OnStartup(StartupEventArgs e)
        {
            // THÊM ĐOẠN CHẶN NHIỀU INSTANCE Ở ĐẦU HÀM
            bool createdNew;
            _singleInstanceMutex = new Mutex(true, "AutoBetHub_SingleInstance", out createdNew);

            if (!createdNew)
            {
                // Đã có instance khác đang chạy → thoát, không mở thêm cửa sổ Home
                Shutdown();
                return;
            }

            // GIỮ NGUYÊN PHẦN CODE CŨ BÊN DƯỚI
            // Đặt fixed runtime & user-data trước khi tạo MainWindow
            try { Wv2Bootstrapper.EnsureFixedEnv(AppDomain.CurrentDomain.BaseDirectory); } catch { }

            base.OnStartup(e);
            var win = new MainWindow();
            MainWindow = win;
            win.Show();
        }

        // THÊM HÀM NÀY
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
    }
}


