namespace CryptoScanner.Desktop.Models;

public sealed class ScanPipelineMetrics
{
 public int CoinsScanned { get; set; }
 public int ExcludedBeforeHardFilter { get; set; }
 public int HardFilterPassed { get; set; }
 public int BinanceTickersLoaded { get; set; }
 public int BinancePairMatched { get; set; }
 public int MaxTechnicalCandidates { get; set; }
 public int TechnicalCandidates { get; set; }
 public int SuccessfulCandidates { get; set; }
 public int SkippedCandidates { get; set; }
}
