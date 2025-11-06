namespace ABX.Core
{
    public interface IGameHostContext
    {
        IConfigService Cfg { get; }
        ILogService Log { get; }
        IWebViewService Web { get; }
        void OnPluginWindowClosed(string slug);
    }

    public interface IGamePlugin
    {
        string Name { get; }
        string Slug { get; }            // vd: "xoc-dia-live"
        System.Windows.Controls.UserControl CreateView(IGameHostContext host);
    }
}
