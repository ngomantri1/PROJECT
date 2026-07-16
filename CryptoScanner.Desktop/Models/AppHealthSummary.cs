namespace CryptoScanner.Desktop.Models;

public enum HealthReadStatus
{
 OK,
 NO_DATA,
 READ_ERROR
}

public sealed class AppHealthSummary
{
 public ScannerHealthSummary Scanner { get; set; } = ScannerHealthSummary.NoData();
 public BacktestHealthSummary Backtest { get; set; } = BacktestHealthSummary.NoData();
 public HistoryHealthSummary History { get; set; } = HistoryHealthSummary.NoData();
}

public sealed class ScannerHealthSummary
{
 public HealthReadStatus Status { get; set; } = HealthReadStatus.NO_DATA;
 public string? Message { get; set; }
 public string ScanId { get; set; } = "";
 public string ScanStatus { get; set; } = "";
 public DateTimeOffset? GeneratedAt { get; set; }
 public string BtcRegime { get; set; } = "--";
 public int? Candidates { get; set; }
 public int? Priority { get; set; }
 public int? Watch { get; set; }
 public int? Reject { get; set; }
 public double? ElapsedSeconds { get; set; }
 public string UnlockSource { get; set; } = "--";
 public int? UnlockMatches { get; set; }
 public int? UnlockMissing { get; set; }
 public bool? HistorySaved { get; set; }

 public string LastScanDisplay => GeneratedAt?.ToString("HH:mm dd/MM") ?? "No scanner data";
 public string CandidateDisplay => Candidates.HasValue ? $"{Candidates} candidates" : "--";
 public string StatusCountDisplay => $"{Priority.GetValueOrDefault()} / {Watch.GetValueOrDefault()} / {Reject.GetValueOrDefault()}";
 public string ElapsedDisplay => ElapsedSeconds.HasValue ? $"{ElapsedSeconds:0.##}s" : "--";
 public string UnlockDisplay => UnlockMatches.HasValue && UnlockMissing.HasValue ? $"{UnlockSource} {UnlockMatches}/{UnlockMatches + UnlockMissing}" : UnlockSource;
 public string HistorySavedDisplay => HistorySaved.HasValue ? (HistorySaved.Value ? "Saved" : "Not saved") : "--";

 public static ScannerHealthSummary NoData(string? message = null) => new()
 {
  Status = HealthReadStatus.NO_DATA,
  Message = message ?? "No scanner data",
  UnlockSource = "NO_DATA"
 };

 public static ScannerHealthSummary ReadError(string message) => new()
 {
  Status = HealthReadStatus.READ_ERROR,
  Message = message,
  UnlockSource = "CACHE_ERROR"
 };
}

public sealed class BacktestHealthSummary
{
 public HealthReadStatus Status { get; set; } = HealthReadStatus.NO_DATA;
 public string? Message { get; set; }
 public string BacktestId { get; set; } = "";
 public DateTimeOffset? GeneratedAt { get; set; }
 public int? SnapshotsProcessed { get; set; }
 public int? SnapshotsSkipped { get; set; }
 public int? CompletedHorizons { get; set; }
 public int? PendingHorizons { get; set; }
 public int? MissingPriceHorizons { get; set; }
 public int? UnsupportedSymbolHorizons { get; set; }

 public string LatestDisplay => GeneratedAt?.ToString("HH:mm dd/MM") ?? "No backtest data";
 public string SnapshotDisplay => SnapshotsProcessed.HasValue ? $"{SnapshotsProcessed}/{SnapshotsSkipped.GetValueOrDefault()} snapshots" : "--";
 public string HorizonDisplay => CompletedHorizons.HasValue || PendingHorizons.HasValue
  ? $"{CompletedHorizons.GetValueOrDefault()} completed | {PendingHorizons.GetValueOrDefault()} pending"
  : "--";
 public string MissingDisplay => $"missing {MissingPriceHorizons.GetValueOrDefault()} | unsupported {UnsupportedSymbolHorizons.GetValueOrDefault()}";

 public static BacktestHealthSummary NoData(string? message = null) => new()
 {
  Status = HealthReadStatus.NO_DATA,
  Message = message ?? "No backtest data"
 };

 public static BacktestHealthSummary ReadError(string message) => new()
 {
  Status = HealthReadStatus.READ_ERROR,
  Message = message
 };
}

public sealed class HistoryHealthSummary
{
 public HealthReadStatus Status { get; set; } = HealthReadStatus.NO_DATA;
 public string? Message { get; set; }
 public int? EntryCount { get; set; }
 public DateTimeOffset? LatestSnapshotAt { get; set; }
 public string LatestScanId { get; set; } = "";
 public int? RetentionDays { get; set; }

 public string EntriesDisplay => EntryCount.HasValue ? $"{EntryCount} entries" : "No history data";
 public string LatestDisplay => LatestSnapshotAt?.ToString("HH:mm dd/MM") ?? "--";
 public string ScanIdDisplay => string.IsNullOrWhiteSpace(LatestScanId) ? "--" : LatestScanId;
 public string RetentionDisplay => RetentionDays.HasValue ? $"{RetentionDays} days" : "--";

 public static HistoryHealthSummary NoData(string? message = null) => new()
 {
  Status = HealthReadStatus.NO_DATA,
  Message = message ?? "No history data"
 };

 public static HistoryHealthSummary ReadError(string message) => new()
 {
  Status = HealthReadStatus.READ_ERROR,
  Message = message
 };
}
