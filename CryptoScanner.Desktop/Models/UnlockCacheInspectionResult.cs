namespace CryptoScanner.Desktop.Models;

public sealed class UnlockCacheInspectionResult
{
 public bool Success { get; init; }
 public string StatusCode { get; init; } = "";
 public string Message { get; init; } = "";
 public UnlockCacheDocument? Document { get; init; }
 public UnlockCacheSummary Summary { get; init; } = new();
 public List<UnlockInfo> ValidItems { get; init; } = [];
}
