using System.Windows.Controls;
using ABX.Core;

namespace TaiXiuLiveHit
{
    public class TaiXiuLiveHitPlugin : IGamePlugin
    {
        public string Name => "Tài Xỉu Live";
        public string Slug => "tai-xiu-live";

        public UserControl CreateView(IGameHostContext host)
            => new TaiXiuLiveHit.Views.TaiXiuLiveHitPanel();
    }
}
