using System;
using System.Diagnostics;
using System.IO;
using System.Management;

namespace BaccaratSexyCasino2;

/// <summary>
/// Keeps versioned local-extension folders side-by-side. Older versions are only
/// removed when no Chrome process is using the Tool's dedicated profile.
/// </summary>
internal static class ExtensionRuntimeMaintenance
{
    public static string CleanupObsoleteVersions(ExtensionRuntimeInfo activeRuntime)
    {
        try
        {
            var active = new DirectoryInfo(activeRuntime.DirectoryPath);
            var root = active.Parent;
            if (root is null || !root.Name.Equals("extension", StringComparison.OrdinalIgnoreCase) ||
                !active.Name.StartsWith("v", StringComparison.OrdinalIgnoreCase))
            {
                return "not-versioned";
            }

            if (IsToolChromeRunning())
                return "skipped-chrome-running";

            var removed = 0;
            foreach (var directory in root.GetDirectories("v*"))
            {
                if (string.Equals(directory.FullName, active.FullName, StringComparison.OrdinalIgnoreCase))
                    continue;
                directory.Delete(recursive: true);
                removed++;
            }
            return "removed=" + removed;
        }
        catch (Exception ex)
        {
            return "skipped-error=" + ex.GetType().Name;
        }
    }

    private static bool IsToolChromeRunning()
    {
        var profile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BaccaratChromeAgent",
            "ChromeProfile");
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE Name='chrome.exe'");
            using var results = searcher.Get();
            foreach (ManagementObject process in results)
            {
                var commandLine = process["CommandLine"] as string;
                if (!string.IsNullOrWhiteSpace(commandLine) &&
                    commandLine.Contains(profile, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }
        catch
        {
            // Conservative: failure to inspect the process list means do not delete.
            return true;
        }

        return false;
    }
}
