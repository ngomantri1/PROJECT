namespace CryptoScanner.Desktop.Models;

public sealed class HistoryIndexEntry
{
 public string ScanId { get; set; } = "";
 public string SchemaVersion { get; set; } = "";
 public string ScannerVersion { get; set; } = "";
 public string ScanProfile { get; set; } = "";
 public DateTimeOffset GeneratedAt { get; set; }
 public string BtcRegime { get; set; } = "";
 public int CoinsScanned { get; set; }
 public int Candidates { get; set; }
 public int PriorityCount { get; set; }
 public int WatchCount { get; set; }
 public int RejectCount { get; set; }
 public double? ElapsedSeconds { get; set; }
 public string SnapshotPath { get; set; } = "";
 public string LogPath { get; set; } = "";
 public List<string> PrioritySymbols { get; set; } = [];
 public List<string> WatchSymbols { get; set; } = [];
 public string ConfigFingerprint { get; set; } = "";
}
