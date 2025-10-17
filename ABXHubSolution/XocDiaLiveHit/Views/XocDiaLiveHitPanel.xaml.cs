using System;
using System.ComponentModel;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using ABX.Core;

namespace XocDiaLiveHit.Views
{
    public partial class XocDiaLiveHitPanel : UserControl, IDisposable
    {
        private readonly MainWindow _mw;
        private bool _loaded, _disposed;

        public XocDiaLiveHitPanel()
        {
            InitializeComponent();

            _mw = new MainWindow();           // giữ nguyên nghiệp vụ; không Show()
            if (_mw.Content is UIElement ui)
            {
                _mw.Content = null;            // rút UI khỏi Window
                RootHost.Children.Clear();
                RootHost.Children.Add(ui);     // nhúng vào panel
            }

            Loaded += (_, e) =>
            {
                if (_loaded) return; _loaded = true;
                InvokeIfExists(_mw, "Window_Loaded", _mw, e);
            };

            Unloaded += (_, __) => Dispose();
        }

        public XocDiaLiveHitPanel(IGameHostContext host) : this()
        {
            // nếu cần: DataContext = host;
        }

        public void Dispose()
        {
            if (_disposed) return; _disposed = true;
            InvokeIfExists(_mw, "Window_Closing", _mw, new CancelEventArgs());
        }

        private static void InvokeIfExists(object target, string name, params object?[] args)
        {
            var mi = target.GetType().GetMethod(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            mi?.Invoke(target, args);
        }
    }
}
