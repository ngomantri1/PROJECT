namespace CryptoScanner.Desktop.Models;

public sealed class UnlockImportResult
{
 public bool Success { get; init; }
 public string StatusCode { get; init; } = "";
 public string Message { get; init; } = "";
 public string? SchemaVersion { get; init; }
 public DateTimeOffset? UpdatedAt { get; init; }
 public int ItemsTotal { get; init; }
 public int ItemsValid { get; init; }
 public int ItemsInvalid { get; init; }
 public bool IsExpired { get; init; }
 public bool ExistingCachePreserved { get; init; }
 public string? TargetPath { get; init; }
}
