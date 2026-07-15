namespace CryptoScanner.Desktop.Models;

public sealed class HistorySaveResult
{
 public bool Success { get; set; }
 public string? Warning { get; set; }
 public string? SnapshotRelativePath { get; set; }
 public string? LogRelativePath { get; set; }
}
