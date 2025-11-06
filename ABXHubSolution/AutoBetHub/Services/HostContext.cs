using System;
using ABX.Core;

namespace AutoBetHub.Services
{
    public class HostContext : IGameHostContext
    {
        public IWebViewService Web { get; }
        public IConfigService Cfg { get; }
        public ILogService Log { get; }

        // callback để báo ngược về MainWindow (hoặc nơi tạo HostContext)
        private readonly Action<string>? _onPluginWindowClosed;

        // thêm tham số onPluginWindowClosed, để mặc định = null cho an toàn
        public HostContext(
            IWebViewService web,
            IConfigService cfg,
            ILogService log,
            Action<string>? onPluginWindowClosed = null)
        {
            Web = web;
            Cfg = cfg;
            Log = log;
            _onPluginWindowClosed = onPluginWindowClosed;
        }

        // giữ alias cũ nếu chỗ khác dùng
        public IConfigService Config => Cfg;

        // implement method mới trong IGameHostContext
        public void OnPluginWindowClosed(string slug)
        {
            _onPluginWindowClosed?.Invoke(slug);
        }
    }
}
