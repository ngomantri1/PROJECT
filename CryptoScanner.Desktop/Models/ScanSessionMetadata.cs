namespace CryptoScanner.Desktop.Models;

public sealed class ScanSessionMetadata
{
 public DateTimeOffset ScanStartedAt { get; set; }
 public DateTimeOffset ScanEndedAt { get; set; }
 public long ElapsedMs { get; set; }
 public double ElapsedSeconds => Math.Round(ElapsedMs / 1000d, 2);
 public ScanPipelineMetrics Pipeline { get; set; } = new();
 public UnlockCacheSummary? UnlockCache { get; set; }
}
