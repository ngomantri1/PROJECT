using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Microsoft.Win32;

namespace BaccaratSexyCasino2;

internal sealed record ChromeLaunchResult(bool Started, string ErrorCode, string Message, string? ChromePath = null)
{
    public static ChromeLaunchResult Failure(string errorCode, string message) => new(false, errorCode, message);
    public static ChromeLaunchResult Success(string chromePath) => new(true, string.Empty, string.Empty, chromePath);
}

/// <summary>
/// Opens the customer's installed Google Chrome in a selected existing profile.
/// The extension is installed manually in that profile and is never loaded or
/// distributed by the desktop application.
/// </summary>
internal static class ChromeLocalExtensionLauncher
{
    public static ChromeLaunchResult Launch(string url, string? profileDirectory)
    {
        if (!Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var target) ||
            (target.Scheme != Uri.UriSchemeHttp && target.Scheme != Uri.UriSchemeHttps))
        {
            return ChromeLaunchResult.Failure("chrome-url-invalid", "The URL must start with http:// or https://.");
        }

        var chromePath = FindChromeExecutable();
        if (chromePath is null)
            return ChromeLaunchResult.Failure(
                "chrome-not-found",
                "Khong tim thay Google Chrome tren may nay.");

        try
        {
            var profile = string.IsNullOrWhiteSpace(profileDirectory)
                ? "Default"
                : profileDirectory.Trim();

            var startInfo = new ProcessStartInfo
            {
                FileName = chromePath,
                UseShellExecute = false,
                Arguments = string.Join(" ", new[]
                {
                    Quote("--profile-directory=" + profile),
                    Quote(target.AbsoluteUri)
                })
            };

            Process.Start(startInfo);
            return ChromeLaunchResult.Success(chromePath);
        }
        catch (Exception ex)
        {
            return ChromeLaunchResult.Failure("chrome-launch-failed", "Khong the mo Google Chrome: " + ex.Message);
        }
    }

    private static string? FindChromeExecutable()
    {
        var appPathCandidates = new[]
        {
            ReadAppPath(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"),
            ReadAppPath(Registry.LocalMachine, @"Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe")
        };
        var standardCandidates = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
        };
        return appPathCandidates.Concat(standardCandidates).FirstOrDefault(IsChromeFile);
    }

    private static string? ReadAppPath(RegistryKey hive, string keyPath)
    {
        try
        {
            using var key = hive.OpenSubKey(keyPath);
            return key?.GetValue(null) as string;
        }
        catch { return null; }
    }

    private static bool IsChromeFile(string? path) => !string.IsNullOrWhiteSpace(path) && File.Exists(path);

    private static string Quote(string value) => "\"" + value.Replace("\"", "\\\"") + "\"";
}
