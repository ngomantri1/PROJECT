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
        private bool _loaded, _closed;

        public XocDiaLiveHitPanel()
        {
            InitializeComponent();

            _mw = new MainWindow();              // không Show()
            if (_mw.Content is UIElement ui)
            {
                _mw.Content = null;               // rút UI khỏi Window
                RootHost.Children.Clear();
                RootHost.Children.Add(ui);        // nhúng vào panel
            }

            Loaded += OnLoaded;
            Unloaded += OnUnloaded;
        }

        public XocDiaLiveHitPanel(IGameHostContext host) : this()
        {
            // nếu cần: DataContext = host;
        }

        private void OnLoaded(object? s, RoutedEventArgs e)
        {
            if (_loaded) return; _loaded = true;
            InvokeIfExists(_mw, "Window_Loaded", _mw, e);
        }

        private void OnUnloaded(object? s, RoutedEventArgs e) => Dispose();

        public void Dispose()
        {
            if (_closed) return; _closed = true;
            InvokeIfExists(_mw, "Window_Closing", _mw, new CancelEventArgs());
        }

        private static void InvokeIfExists(object target, string name, params object?[] args)
        {
            var mi = target.GetType().GetMethod(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            mi?.Invoke(target, args);
        }
    }
}
