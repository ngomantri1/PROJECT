using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace BaccaratSexyCasino2;

internal sealed record ExtensionRuntimeInfo(
    string DirectoryPath,
    string ExtensionId,
    string Version,
    string RuntimeSha256,
    string NativeHostName);

internal sealed record ExtensionRuntimeVerification(
    bool IsValid,
    ExtensionRuntimeInfo? Runtime,
    string ErrorCode,
    string Message)
{
    public static ExtensionRuntimeVerification Failure(string errorCode, string message) =>
        new(false, null, errorCode, message);

    public static ExtensionRuntimeVerification Success(ExtensionRuntimeInfo runtime) =>
        new(true, runtime, string.Empty, string.Empty);
}

/// <summary>
/// Validates exactly the local extension runtime produced by the A2 packaging script.
/// Private signing material is never read from, or copied to, a customer machine.
/// </summary>
internal static class ExtensionRuntimeVerifier
{
    private const string MetadataFile = "extension-runtime.json";
    private const string HashListFile = "runtime-files.sha256";

    public static ExtensionRuntimeVerification Verify()
    {
        var runtimeDirectory = FindRuntimeDirectory();
        if (runtimeDirectory is null)
        {
            return ExtensionRuntimeVerification.Failure(
                "runtime-not-found",
                "Runtime extension is missing. Reinstall the Tool or run the extension packaging step.");
        }

        try
        {
            return VerifyDirectory(runtimeDirectory);
        }
        catch (Exception ex)
        {
            return ExtensionRuntimeVerification.Failure(
                "runtime-verification-error",
                "Cannot verify the local extension runtime: " + ex.Message);
        }
    }

    private static ExtensionRuntimeVerification VerifyDirectory(string runtimeDirectory)
    {
        var metadataPath = Path.Combine(runtimeDirectory, MetadataFile);
        var hashListPath = Path.Combine(runtimeDirectory, HashListFile);
        var manifestPath = Path.Combine(runtimeDirectory, "manifest.json");
        if (!File.Exists(metadataPath) || !File.Exists(hashListPath) || !File.Exists(manifestPath))
        {
            return ExtensionRuntimeVerification.Failure(
                "runtime-metadata-missing",
                "Runtime extension is incomplete (manifest or checksum metadata is missing).");
        }

        RuntimeMetadata? metadata;
        try
        {
            metadata = JsonSerializer.Deserialize<RuntimeMetadata>(File.ReadAllText(metadataPath),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException ex)
        {
            return ExtensionRuntimeVerification.Failure("runtime-metadata-invalid", "Runtime metadata is invalid: " + ex.Message);
        }

        if (metadata is null || string.IsNullOrWhiteSpace(metadata.ExtensionId) ||
            string.IsNullOrWhiteSpace(metadata.RuntimeSha256))
        {
            return ExtensionRuntimeVerification.Failure("runtime-metadata-invalid", "Runtime metadata has required fields missing.");
        }

        var hashLines = File.ReadAllLines(hashListPath)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Select(line => line.Trim())
            .ToArray();
        if (hashLines.Length == 0)
        {
            return ExtensionRuntimeVerification.Failure("runtime-hashlist-empty", "Runtime checksum list is empty.");
        }

        var actualLines = new List<string>(hashLines.Length);
        foreach (var line in hashLines)
        {
            var separator = line.LastIndexOf(':');
            if (separator <= 0 || separator == line.Length - 1)
                return ExtensionRuntimeVerification.Failure("runtime-hashlist-invalid", "Runtime checksum list has an invalid entry.");

            var relativePath = line[..separator].Replace('/', Path.DirectorySeparatorChar);
            if (Path.IsPathRooted(relativePath) || relativePath.Contains("..", StringComparison.Ordinal) ||
                relativePath.EndsWith(".pem", StringComparison.OrdinalIgnoreCase) ||
                relativePath.EndsWith(".pfx", StringComparison.OrdinalIgnoreCase) ||
                relativePath.EndsWith(".key", StringComparison.OrdinalIgnoreCase))
            {
                return ExtensionRuntimeVerification.Failure("runtime-hashlist-invalid", "Runtime checksum list contains a prohibited path.");
            }

            var filePath = Path.Combine(runtimeDirectory, relativePath);
            if (!File.Exists(filePath))
                return ExtensionRuntimeVerification.Failure("runtime-file-missing", "Runtime file is missing: " + relativePath);

            var fileHash = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(filePath))).ToLowerInvariant();
            var expectedHash = line[(separator + 1)..].ToLowerInvariant();
            if (!string.Equals(fileHash, expectedHash, StringComparison.Ordinal))
                return ExtensionRuntimeVerification.Failure("runtime-file-hash-mismatch", "Runtime checksum does not match: " + relativePath);

            actualLines.Add(relativePath.Replace(Path.DirectorySeparatorChar, '/') + ":" + fileHash);
        }

        var aggregateText = string.Join("\n", actualLines.OrderBy(line => line, StringComparer.Ordinal));
        var aggregateHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(aggregateText))).ToLowerInvariant();
        if (!string.Equals(aggregateHash, metadata.RuntimeSha256, StringComparison.OrdinalIgnoreCase))
        {
            return ExtensionRuntimeVerification.Failure("runtime-hash-mismatch", "Runtime checksum does not match the published metadata.");
        }

        using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
        if (!manifest.RootElement.TryGetProperty("key", out var keyElement) ||
            string.IsNullOrWhiteSpace(keyElement.GetString()))
        {
            return ExtensionRuntimeVerification.Failure("runtime-manifest-key-missing", "Extension manifest has no public key.");
        }

        byte[] publicKey;
        try { publicKey = Convert.FromBase64String(keyElement.GetString()!); }
        catch (FormatException) { return ExtensionRuntimeVerification.Failure("runtime-manifest-key-invalid", "Extension manifest public key is invalid."); }

        var extensionId = ToChromeExtensionId(publicKey);
        if (!string.Equals(extensionId, metadata.ExtensionId, StringComparison.Ordinal))
        {
            return ExtensionRuntimeVerification.Failure("runtime-extension-id-mismatch", "Extension ID does not match the packaged runtime.");
        }

        var publicKeyHash = Convert.ToHexString(SHA256.HashData(publicKey)).ToLowerInvariant();
        if (!string.Equals(publicKeyHash, metadata.PublicKeySha256, StringComparison.OrdinalIgnoreCase))
        {
            return ExtensionRuntimeVerification.Failure("runtime-public-key-mismatch", "Extension public key does not match the packaged runtime.");
        }

        return ExtensionRuntimeVerification.Success(new ExtensionRuntimeInfo(
            runtimeDirectory,
            metadata.ExtensionId,
            metadata.ExtensionVersion ?? "-",
            metadata.RuntimeSha256,
            metadata.NativeHostName ?? "com.abx.baccarat_chrome_agent"));
    }

    private static string? FindRuntimeDirectory()
    {
        var installedRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "extension"));
        var installed = ResolveInstalledVersionDirectory(installedRoot);
        if (installed is not null) return installed;

        // Development-only fallback: walk up to the repository root.
        var probe = new DirectoryInfo(AppContext.BaseDirectory);
        for (var depth = 0; probe is not null && depth < 10; depth++, probe = probe.Parent)
        {
            var candidate = Path.Combine(probe.FullName, "artifacts", "publish", "extension");
            if (Directory.Exists(candidate)) return candidate;
        }

        return null;
    }

    // The installer stores a small runtime manifest at {app}\extension and the
    // immutable extension files under v<version>. Development uses the runtime
    // directory directly, so both layouts are accepted here.
    private static string? ResolveInstalledVersionDirectory(string installedRoot)
    {
        if (!Directory.Exists(installedRoot)) return null;
        if (File.Exists(Path.Combine(installedRoot, "manifest.json"))) return installedRoot;

        var pointerPath = Path.Combine(installedRoot, MetadataFile);
        if (!File.Exists(pointerPath)) return null;
        try
        {
            var pointer = JsonSerializer.Deserialize<RuntimeMetadata>(File.ReadAllText(pointerPath),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (string.IsNullOrWhiteSpace(pointer?.ExtensionVersion) ||
                pointer.ExtensionVersion.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
                pointer.ExtensionVersion.Contains("..", StringComparison.Ordinal))
            {
                return null;
            }

            var versionDirectory = Path.Combine(installedRoot, "v" + pointer.ExtensionVersion);
            return Directory.Exists(versionDirectory) ? versionDirectory : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static string ToChromeExtensionId(byte[] publicKey)
    {
        var hash = SHA256.HashData(publicKey);
        var builder = new StringBuilder(32);
        for (var i = 0; i < 16; i++)
        {
            builder.Append((char)('a' + ((hash[i] >> 4) & 0x0f)));
            builder.Append((char)('a' + (hash[i] & 0x0f)));
        }
        return builder.ToString();
    }

    private sealed class RuntimeMetadata
    {
        public string? ExtensionId { get; set; }
        public string? ExtensionVersion { get; set; }
        public string? PublicKeySha256 { get; set; }
        public string? RuntimeSha256 { get; set; }
        public string? NativeHostName { get; set; }
    }
}
