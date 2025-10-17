using ABX.Core;
using System.Windows.Controls;

namespace XocDiaLiveHit
{
    public class XocDiaLiveHitPlugin : IGamePlugin
    {
        public string Name => "Xóc Đĩa Live";
        public string Slug => "xoc-dia-live";

        public UserControl CreateView(IGameHostContext host)
            => new Views.XocDiaLiveHitPanel(host);
    }
}
