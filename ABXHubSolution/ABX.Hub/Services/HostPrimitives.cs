using System.Diagnostics;
using ABX.Core;

namespace ABX.Hub
{
    internal sealed class HostContext : IGameHostContext
    {
        public HostContext(IConfigService cfg, ILogService log, IWebViewService web)
        {
            Cfg = cfg; Log = log; Web = web;
        }
        public IConfigService Cfg { get; }
        public ILogService Log { get; }
        public IWebViewService Web { get; }
    }

    internal sealed class SimpleLog : ILogService
    {
        public void Info(string message) => Debug.WriteLine("[INFO] " + message);
        public void Warn(string message) => Debug.WriteLine("[WARN] " + message);
        public void Error(string message) => Debug.WriteLine("[ERR ] " + message);
    }

    internal sealed class SimpleCfg : IConfigService
    {
        public string Get(string key, string? defaultValue = null) => defaultValue ?? "";
        public void Set(string key, string value) { /* store if needed */ }
        public void Save() { /* persist if needed */ }
    }
}
