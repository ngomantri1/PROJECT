using Microsoft.Win32;
using System;
using System.Linq;
using System.Text.Json;

namespace BaccaratSexyCasino2;

internal sealed record ChromePolicyInspection(bool IsBlocked, string Code, string Message)
{
    public static ChromePolicyInspection Clear() => new(false, string.Empty, string.Empty);
    public static ChromePolicyInspection Blocked(string code, string message) => new(true, code, message);
}

/// <summary>
/// Checks the local Chrome enterprise policy registry before using --load-extension.
/// It only declares a block when a policy explicitly blocks command-line loading
/// or this extension ID; unrelated managed policies are not treated as failures.
/// </summary>
internal static class ChromePolicyInspector
{
    public static ChromePolicyInspection Inspect(string extensionId)
    {
        foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                try
                {
                    using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                    using var chrome = baseKey.OpenSubKey(@"SOFTWARE\Policies\Google\Chrome");
                    if (chrome is null) continue;

                    if (IsEnabled(chrome.GetValue("DisableLoadExtensionCommandLineSwitch")))
                    {
                        return ChromePolicyInspection.Blocked(
                            "chrome-policy-command-line-extension-blocked",
                            "Chrome policy DisableLoadExtensionCommandLineSwitch blocks local command-line extensions. Contact the computer administrator.");
                    }

                    using var blockList = chrome.OpenSubKey("ExtensionInstallBlocklist");
                    if (ContainsExtensionId(blockList, extensionId))
                    {
                        return ChromePolicyInspection.Blocked(
                            "chrome-policy-extension-blocked",
                            "Chrome policy ExtensionInstallBlocklist blocks this extension ID. Contact the computer administrator.");
                    }

                    using var settings = chrome.OpenSubKey("ExtensionSettings");
                    var setting = settings?.GetValue(extensionId) as string ?? settings?.GetValue("*") as string;
                    if (IsBlockedExtensionSetting(setting))
                    {
                        return ChromePolicyInspection.Blocked(
                            "chrome-policy-extension-settings-blocked",
                            "Chrome policy ExtensionSettings blocks this extension. Contact the computer administrator.");
                    }
                }
                catch
                {
                    // Policy diagnostics must not stop a personal machine because
                    // a registry view is inaccessible.
                }
            }
        }

        return ChromePolicyInspection.Clear();
    }

    private static bool ContainsExtensionId(RegistryKey? key, string extensionId)
    {
        if (key is null) return false;
        return key.GetValueNames()
            .Select(name => key.GetValue(name)?.ToString())
            .Any(value => string.Equals(value, "*", StringComparison.Ordinal) ||
                          string.Equals(value, extensionId, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsBlockedExtensionSetting(string? setting)
    {
        if (string.IsNullOrWhiteSpace(setting)) return false;
        try
        {
            using var document = JsonDocument.Parse(setting);
            return document.RootElement.TryGetProperty("installation_mode", out var mode) &&
                   string.Equals(mode.GetString(), "blocked", StringComparison.OrdinalIgnoreCase);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool IsEnabled(object? value) => value switch
    {
        int number => number != 0,
        long number => number != 0,
        string text when int.TryParse(text, out var number) => number != 0,
        string text when bool.TryParse(text, out var enabled) => enabled,
        _ => false
    };
}
