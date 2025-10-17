namespace ABX.Core;

public interface IWebViewService
{
    void Navigate(string url);
    void PostMessage(string json);
}
