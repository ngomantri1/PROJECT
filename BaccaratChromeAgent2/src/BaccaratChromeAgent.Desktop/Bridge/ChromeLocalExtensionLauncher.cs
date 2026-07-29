using System;
using System.Diagnostics;
using System.IO;
using System.Linq;

namespace BaccaratSexyCasino2;

internal sealed record ChromeLaunchResult(bool Started, string ErrorCode, string Message, string? ChromePath = null)
{
    public static ChromeLaunchResult Failure(string errorCode, string message) => new(false, errorCode, message);
    public static ChromeLaunchResult Success(string chromePath) => new(true, string.Empty, string.Empty, chromePath);
}

/// <summary>
/// Opens the bundled Chrome for Testing runtime with an isolated Tool profile.
/// Google Chrome no longer accepts --load-extension, therefore the user's normal
/// Google Chrome installation is intentionally never selected here.
/// </summary>
internal static class ChromeLocalExtensionLauncher
{
    public static ChromeLaunchResult Launch(string url, ExtensionRuntimeInfo runtime)
    {
        var chromePath = FindToolBrowserExecutable();
        if (chromePath is null)
            return ChromeLaunchResult.Failure(
                "tool-browser-missing",
                "Trinh duyet cua Tool bi thieu. Hay cai lai Baccarat Chrome Agent.");

        try
        {
            var profileDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BaccaratChromeAgent",
                "ChromeProfile");
            Directory.CreateDirectory(profileDirectory);

            // URL is optional.  The browser must still start while the user is
            // editing the URL field or when the saved value is malformed.  A
            // valid http(s) URL is opened directly; otherwise Chrome starts at
            // its normal new-tab page and the user can navigate manually.
            var arguments = new System.Collections.Generic.List<string>
            {
                Quote("--user-data-dir=" + profileDirectory),
                Quote("--load-extension=" + runtime.DirectoryPath),
                "--no-first-run",
                "--no-default-browser-check",
                "--new-window"
            };

            if (Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var target) &&
                (target.Scheme == Uri.UriSchemeHttp || target.Scheme == Uri.UriSchemeHttps))
            {
                arguments.Add(Quote(target.AbsoluteUri));
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = chromePath,
                UseShellExecute = false,
                Arguments = string.Join(" ", arguments)
            };

            Process.Start(startInfo);
            return ChromeLaunchResult.Success(chromePath);
        }
        catch (Exception ex)
        {
            return ChromeLaunchResult.Failure("chrome-launch-failed", "Khong the mo trinh duyet cua Tool: " + ex.Message);
        }
    }

    private static string? FindToolBrowserExecutable()
    {
        // Installed application: {app}\browser\chrome-win64\chrome.exe.
        // Development build: artifacts\publish\browser\chrome-win64\chrome.exe.
        var appDirectory = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.GetFullPath(Path.Combine(appDirectory, "..", "browser", "chrome-win64", "chrome.exe")),
            Path.Combine(appDirectory, "browser", "chrome-win64", "chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BaccaratChromeAgent", "Browser", "chrome-win64", "chrome.exe")
        };
        return candidates.FirstOrDefault(IsChromeFile);
    }

    private static bool IsChromeFile(string? path) => !string.IsNullOrWhiteSpace(path) && File.Exists(path);

    private static string Quote(string value) => "\"" + value.Replace("\"", "\\\"") + "\"";
}
