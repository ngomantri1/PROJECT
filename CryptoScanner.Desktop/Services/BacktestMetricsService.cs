using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public sealed class BacktestMetricsService
{
 public BacktestMetricSummary BuildSummary(IEnumerable<CompletedBacktestRow> completedRows, BacktestExcludedCounts excludedCounts)
 {
  var rows = completedRows.ToList();
  var summary = new BacktestMetricSummary
  {
   MetricsSchemaVersion = "1.0",
   BucketVersion = "1.0",
   MetricDefinitions = new
   {
    sample_size = "Count of horizon rows with status COMPLETED only.",
    win_rate = "return_pct > 0",
    btc_outperform_rate = "relative_return_vs_btc_pct > 0",
    sample_quality = "LOW < 5, MEDIUM 5-19, HIGH >= 20"
   },
   BucketDefinitions = new
   {
    market_technical_score = new[] { "0-59", "60-69", "70-79", "80-89", "90-100" },
    entry_readiness_score = new[] { "0-19", "20-39", "40-59", "60-79", "80-100" }
   },
   ExcludedCounts = excludedCounts
  };

  AddGroups(summary.Groups, "STATUS", rows, x => new Dictionary<string, string> { ["status"] = x.Status });
  AddGroups(summary.Groups, "STATUS_DECISION_CODE", rows, x => new Dictionary<string, string> { ["status"] = x.Status, ["decision_code"] = x.DecisionCode });
  AddGroups(summary.Groups, "SETUP", rows, x => new Dictionary<string, string> { ["setup"] = x.Setup });
  AddGroups(summary.Groups, "MARKET_TECHNICAL_SCORE_BUCKET", rows, x => new Dictionary<string, string> { ["market_technical_score_bucket"] = MarketTechnicalBucket(x.MarketTechnicalScore) });
  AddGroups(summary.Groups, "ENTRY_READINESS_SCORE_BUCKET", rows, x => new Dictionary<string, string> { ["entry_readiness_score_bucket"] = EntryReadinessBucket(x.EntryReadinessScore) });
  AddGroups(summary.Groups, "BTC_REGIME", rows, x => new Dictionary<string, string> { ["btc_regime"] = x.BtcRegime });
  AddGroups(summary.Groups, "SCAN_PROFILE", rows, x => new Dictionary<string, string> { ["scan_profile"] = x.ScanProfile });
  AddGroups(summary.Groups, "SCANNER_VERSION", rows, x => new Dictionary<string, string> { ["scanner_version"] = x.ScannerVersion });

  return summary;
 }

 static void AddGroups(List<BacktestMetricGroup> target, string groupType, List<CompletedBacktestRow> rows, Func<CompletedBacktestRow, Dictionary<string, string>> dimensionsSelector)
 {
  foreach (var group in rows
   .Select(x => new { Row = x, Dimensions = dimensionsSelector(x) })
   .GroupBy(x => new { x.Row.HorizonDays, Key = DimensionKey(x.Dimensions) })
   .OrderBy(x => x.Key.HorizonDays)
   .ThenBy(x => x.Key.Key))
  {
   var groupRows = group.Select(x => x.Row).ToList();
   target.Add(new BacktestMetricGroup
   {
    GroupType = groupType,
    HorizonDays = group.Key.HorizonDays,
    Dimensions = group.First().Dimensions,
    SampleQuality = SampleQuality(groupRows.Count),
    Metrics = BuildMetricSet(groupRows)
   });
  }
 }

 static BacktestMetricSet BuildMetricSet(List<CompletedBacktestRow> rows)
 {
  if (rows.Count == 0) return new BacktestMetricSet();

  var returns = rows.Select(x => x.ReturnPct).OrderBy(x => x).ToList();
  var relative = rows.Where(x => x.RelativeReturnVsBtcPct.HasValue).Select(x => x.RelativeReturnVsBtcPct!.Value).OrderBy(x => x).ToList();

  return new BacktestMetricSet
  {
   SampleSize = rows.Count,
   AverageReturnPct = RoundPct(returns.Average()),
   MedianReturnPct = Median(returns),
   MinReturnPct = returns.First(),
   MaxReturnPct = returns.Last(),
   WinRatePct = RoundPct(rows.Count(x => x.ReturnPct > 0) / (decimal)rows.Count * 100),
   BtcOutperformRatePct = relative.Count == 0 ? null : RoundPct(relative.Count(x => x > 0) / (decimal)relative.Count * 100),
   AverageRelativeReturnVsBtcPct = relative.Count == 0 ? null : RoundPct(relative.Average()),
   MedianRelativeReturnVsBtcPct = relative.Count == 0 ? null : Median(relative)
  };
 }

 public static string MarketTechnicalBucket(int score) => score switch
 {
  < 60 => "0-59",
  < 70 => "60-69",
  < 80 => "70-79",
  < 90 => "80-89",
  _ => "90-100"
 };

 public static string EntryReadinessBucket(int score) => score switch
 {
  < 20 => "0-19",
  < 40 => "20-39",
  < 60 => "40-59",
  < 80 => "60-79",
  _ => "80-100"
 };

 static string SampleQuality(int sampleSize) => sampleSize switch
 {
  < 5 => "LOW",
  < 20 => "MEDIUM",
  _ => "HIGH"
 };

 static string DimensionKey(Dictionary<string, string> dimensions)
 {
  return string.Join("|", dimensions.OrderBy(x => x.Key).Select(x => x.Key + "=" + x.Value));
 }

 static decimal Median(List<decimal> values)
 {
  if (values.Count == 0) return 0;
  var middle = values.Count / 2;
  return values.Count % 2 == 1 ? values[middle] : RoundPct((values[middle - 1] + values[middle]) / 2);
 }

 static decimal RoundPct(decimal value) => Math.Round(value, 2);
}
