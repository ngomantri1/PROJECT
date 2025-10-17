using System.Windows.Controls;
using ABX.Core;

namespace XocDiaLiveHit
{
    public class XocDiaLiveHitPlugin : IGamePlugin
    {
        public string Name => "Xóc Đĩa Live";
        public string Slug => "xoc-dia-live";

        public UserControl CreateView(IGameHostContext host)
            => new XocDiaLiveHit.Views.XocDiaLiveHitPanel();
    }
}
