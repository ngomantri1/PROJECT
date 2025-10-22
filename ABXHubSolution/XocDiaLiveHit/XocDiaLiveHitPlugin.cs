using System.Windows.Controls;
using ABX.Core;
using XocDiaLiveHit.Views;

namespace XocDiaLiveHit
{
    public sealed class XocDiaLiveHitPlugin : IGamePlugin
    {
        public string Name => "Xóc Đĩa Live";
        public string Slug => "xoc-dia-live";
        public UserControl CreateView(IGameHostContext host) => new XocDiaLiveHitPanel(host);
    }
}
