namespace CryptoScanner.Desktop.Models;

public sealed class BacktestHistorySnapshot
{
 public HistoryIndexEntry IndexEntry { get; set; } = new();
 public string SnapshotFullPath { get; set; } = "";
 public DateTimeOffset GeneratedAt { get; set; }
 public string BtcRegime { get; set; } = "";
 public string SchemaVersion { get; set; } = "";
 public string ScannerVersion { get; set; } = "";
 public string ScanProfile { get; set; } = "";
 public List<BacktestCandidate> Candidates { get; set; } = [];
}

public sealed class BacktestCandidate
{
 public int Rank { get; set; }
 public string CoinId { get; set; } = "";
 public string Symbol { get; set; } = "";
 public string Name { get; set; } = "";
 public string Status { get; set; } = "";
 public string DecisionCode { get; set; } = "";
 public string Setup { get; set; } = "";
 public decimal EntryPrice { get; set; }
 public int MarketTechnicalScore { get; set; }
 public int EntryReadinessScore { get; set; }
}

public sealed class HistoryReadResult
{
 public List<BacktestHistorySnapshot> Snapshots { get; set; } = [];
 public List<string> Warnings { get; set; } = [];
}

public sealed class HistoricalPricePoint
{
 public decimal Price { get; set; }
 public DateTimeOffset PriceTime { get; set; }
 public string Source { get; set; } = "";
 public string Match { get; set; } = "";
 public string LookupSymbol { get; set; } = "";
}

public sealed class HistoricalPriceResult
{
 public string Status { get; set; } = "";
 public HistoricalPricePoint? Point { get; set; }
 public string? Warning { get; set; }
}

public sealed class CompletedBacktestRow
{
 public int HorizonDays { get; set; }
 public decimal ReturnPct { get; set; }
 public decimal? RelativeReturnVsBtcPct { get; set; }
 public string Status { get; set; } = "";
 public string DecisionCode { get; set; } = "";
 public string Setup { get; set; } = "";
 public string BtcRegime { get; set; } = "";
 public string ScanProfile { get; set; } = "";
 public string ScannerVersion { get; set; } = "";
 public int MarketTechnicalScore { get; set; }
 public int EntryReadinessScore { get; set; }
}

public sealed class BacktestExcludedCounts
{
 public int Pending { get; set; }
 public int MissingPrice { get; set; }
 public int UnsupportedSymbol { get; set; }
}

public sealed class BacktestMetricSet
{
 public int SampleSize { get; set; }
 public decimal? AverageReturnPct { get; set; }
 public decimal? MedianReturnPct { get; set; }
 public decimal? MinReturnPct { get; set; }
 public decimal? MaxReturnPct { get; set; }
 public decimal? WinRatePct { get; set; }
 public decimal? BtcOutperformRatePct { get; set; }
 public decimal? AverageRelativeReturnVsBtcPct { get; set; }
 public decimal? MedianRelativeReturnVsBtcPct { get; set; }
}

public sealed class BacktestMetricGroup
{
 public string GroupType { get; set; } = "";
 public int HorizonDays { get; set; }
 public Dictionary<string, string> Dimensions { get; set; } = [];
 public string SampleQuality { get; set; } = "LOW";
 public BacktestMetricSet Metrics { get; set; } = new();
}

public sealed class BacktestMetricSummary
{
 public string MetricsSchemaVersion { get; set; } = "1.0";
 public string BucketVersion { get; set; } = "1.0";
 public object MetricDefinitions { get; set; } = new();
 public object BucketDefinitions { get; set; } = new();
 public BacktestExcludedCounts ExcludedCounts { get; set; } = new();
 public List<BacktestMetricGroup> Groups { get; set; } = [];
}
