using System;
using System.Diagnostics;
using ABX.Core;

namespace AutoBetHub
{
    // đây là host context mà Hub truyền xuống cho plugin
    internal sealed class HostContext : IGameHostContext
    {
        private readonly Action<string>? _onPluginClosed;

        // thêm tham số onPluginClosed
        public HostContext(
            IConfigService cfg,
            ILogService log,
            IWebViewService web,
            Action<string>? onPluginClosed = null)
        {
            Cfg = cfg;
            Log = log;
            Web = web;
            _onPluginClosed = onPluginClosed;
        }

        public IConfigService Cfg { get; }
        public ILogService Log { get; }
        public IWebViewService Web { get; }

        // implement hàm mới của interface
        public void OnPluginWindowClosed(string slug)
        {
            _onPluginClosed?.Invoke(slug);
        }
    }

    // 2 class đơn giản của bạn mình để nguyên
    internal sealed class SimpleLog : ILogService
    {
        public void Info(string message) => Debug.WriteLine("[INFO] " + message);
        public void Warn(string message) => Debug.WriteLine("[WARN] " + message);
        public void Error(string message) => Debug.WriteLine("[ERR ] " + message);
    }

    internal sealed class SimpleCfg : IConfigService
    {
        public string Get(string key, string? defaultValue = null) => defaultValue ?? "";
        public void Set(string key, string value) { }
        public void Save() { }
    }
}
