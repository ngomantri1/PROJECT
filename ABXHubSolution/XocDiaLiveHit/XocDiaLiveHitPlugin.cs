using System;
using System.Reflection;
using System.Windows.Controls;
using ABX.Core;

namespace XocDiaLiveHit
{
    public sealed class XocDiaLiveHitPlugin : IGamePlugin
    {
        public string Name => "Xóc Đĩa Live";
        public string Slug => "xoc-dia-live";

        // LƯU Ý: BẮT BUỘC trả về UserControl để khớp IGamePlugin hiện có trong ABX.Core
        public UserControl CreateView(IGameHostContext host)
        {
            var t = typeof(Views.XocDiaLiveHitPanel);

            // Ưu tiên ctor(IGameHostContext)
            var ctorWithHost = t.GetConstructor(new[] { typeof(IGameHostContext) });
            if (ctorWithHost != null)
                return (UserControl)ctorWithHost.Invoke(new object[] { host });

            // Fallback: ctor mặc định
            var ctorDefault = t.GetConstructor(Type.EmptyTypes)
                               ?? throw new InvalidOperationException(
                                   "XocDiaLiveHitPanel cần có ctor mặc định hoặc ctor(IGameHostContext).");
            return (UserControl)ctorDefault.Invoke(null);
        }

        public void Dispose()
        {
            // Dọn tài nguyên nếu plugin có
        }
    }
}
