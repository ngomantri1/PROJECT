using ABX.Core;

namespace ABX.Hub.Services
{
    public class HostContext : IGameHostContext
    {
        public IWebViewService Web { get; }
        public IConfigService Cfg { get; }      // <-- đổi tên về Cfg
        public ILogService Log { get; }

        public HostContext(IWebViewService web, IConfigService cfg, ILogService log)
        {
            Web = web;
            Cfg = cfg;                          // <-- gán vào Cfg
            Log = log;
        }

        // (tuỳ chọn) nếu trong code cũ bạn có dùng host.Config,
        // có thể giữ alias để tránh phải sửa nhiều chỗ:
        public IConfigService Config => Cfg;
    }
}
