using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public sealed class BacktestService
{
 readonly IHistoryReader _historyReader = new HistoryReader();
 readonly IHistoricalPriceProvider _priceProvider = new HistoricalPriceProvider();
 readonly BacktestMetricsService _metrics = new();
 static readonly int[] Horizons = [7, 14, 30];
 static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

 public static string BacktestDirectory { get; } = Path.Combine(
  Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
  "CryptoScanner.Desktop",
  "backtests");

 static string BacktestIndexPath => Path.Combine(BacktestDirectory, "backtest_index.json");

 public async Task<string> RunAsync(CancellationToken ct)
 {
  Directory.CreateDirectory(BacktestDirectory);
  var generatedAt = DateTimeOffset.Now;
  var backtestId = generatedAt.ToString("yyyyMMddTHHmmss") + "_" + RandomNumberGenerator.GetHexString(4);
  AppLogger.Info("Backtest started: " + backtestId);

  var history = await _historyReader.ReadAsync(ct);
  var snapshotResults = new List<object>();
  var completedRows = new List<CompletedBacktestRow>();
  var priceMissing = 0;
  var pending = 0;
  var unsupported = 0;

  foreach (var snapshot in history.Snapshots)
  {
   ct.ThrowIfCancellationRequested();
   var candidateResults = new List<object>();
   foreach (var candidate in snapshot.Candidates)
   {
    var horizons = new Dictionary<string, object>();
    foreach (var days in Horizons)
    {
     var targetTime = snapshot.GeneratedAt.AddDays(days);
     if (targetTime > generatedAt)
     {
      pending++;
      horizons[$"{days}d"] = new
      {
       status = "PENDING",
       horizon_days = days,
       target_time = targetTime
      };
      continue;
     }

     var btcPrice = await _priceProvider.GetPriceAsync("bitcoin", "BTC", targetTime, ct);
     var exitPrice = await _priceProvider.GetPriceAsync(candidate.CoinId, candidate.Symbol, targetTime, ct);
     if (exitPrice.Status == "UNSUPPORTED_SYMBOL")
     {
      unsupported++;
      horizons[$"{days}d"] = BuildPriceStatus(exitPrice.Status, days, targetTime, candidate, exitPrice, btcPrice, null, null, null);
      continue;
     }

     if (exitPrice.Status != "COMPLETED" || exitPrice.Point is null || candidate.EntryPrice <= 0)
     {
      priceMissing++;
      horizons[$"{days}d"] = BuildPriceStatus(exitPrice.Status == "COMPLETED" ? "PRICE_MISSING" : exitPrice.Status, days, targetTime, candidate, exitPrice, btcPrice, null, null, null);
      continue;
     }

     var returnPct = RoundPct((exitPrice.Point.Price - candidate.EntryPrice) / candidate.EntryPrice * 100);
     decimal? btcReturnPct = null;
     decimal? relativeReturn = null;
     if (btcPrice.Status == "COMPLETED" && btcPrice.Point is not null)
     {
      var btcEntry = await _priceProvider.GetPriceAsync("bitcoin", "BTC", snapshot.GeneratedAt, ct);
      if (btcEntry.Status == "COMPLETED" && btcEntry.Point is not null && btcEntry.Point.Price > 0)
      {
       btcReturnPct = RoundPct((btcPrice.Point.Price - btcEntry.Point.Price) / btcEntry.Point.Price * 100);
       relativeReturn = RoundPct(returnPct - btcReturnPct.Value);
      }
     }

     horizons[$"{days}d"] = BuildPriceStatus("COMPLETED", days, targetTime, candidate, exitPrice, btcPrice, returnPct, btcReturnPct, relativeReturn);
     completedRows.Add(new CompletedBacktestRow
     {
      HorizonDays = days,
      ReturnPct = returnPct,
      RelativeReturnVsBtcPct = relativeReturn,
      Status = candidate.Status,
      DecisionCode = candidate.DecisionCode,
      Setup = candidate.Setup,
      BtcRegime = snapshot.BtcRegime,
      ScanProfile = snapshot.ScanProfile,
      ScannerVersion = snapshot.ScannerVersion,
      MarketTechnicalScore = candidate.MarketTechnicalScore,
      EntryReadinessScore = candidate.EntryReadinessScore
     });
    }

    candidateResults.Add(new
    {
     rank = candidate.Rank,
     coin_id = candidate.CoinId,
     symbol = candidate.Symbol,
     name = candidate.Name,
     status = candidate.Status,
     decision_code = candidate.DecisionCode,
     setup = candidate.Setup,
     entry_price = candidate.EntryPrice,
     market_technical_score = candidate.MarketTechnicalScore,
     entry_readiness_score = candidate.EntryReadinessScore,
     horizons
    });
   }

   snapshotResults.Add(new
   {
    scan_id = snapshot.IndexEntry.ScanId,
    generated_at = snapshot.GeneratedAt,
    btc_regime = snapshot.BtcRegime,
    scan_profile = snapshot.ScanProfile,
    scanner_version = snapshot.ScannerVersion,
    candidates = candidateResults
   });
  }

  var excludedCounts = new BacktestExcludedCounts
  {
   Pending = pending,
   MissingPrice = priceMissing,
   UnsupportedSymbol = unsupported
  };
  var metricSummary = _metrics.BuildSummary(completedRows, excludedCounts);

  var payload = new
  {
   schema_version = "1.0",
   metrics_schema_version = metricSummary.MetricsSchemaVersion,
   bucket_version = metricSummary.BucketVersion,
   backtest_id = backtestId,
   generated_at = generatedAt,
   history_range = BuildHistoryRange(history),
   horizons = Horizons,
   snapshots_processed = history.Snapshots.Count,
   snapshots_skipped = history.Warnings.Count(x => x.Contains("SNAPSHOT", StringComparison.OrdinalIgnoreCase) || x.Contains("SCHEMA", StringComparison.OrdinalIgnoreCase)),
   history_warnings = history.Warnings,
   price_lookup_summary = new
   {
    pending_horizon_count = pending,
    missing_price_count = priceMissing,
    unsupported_symbol_count = unsupported
   },
   metric_definitions = metricSummary.MetricDefinitions,
   bucket_definitions = metricSummary.BucketDefinitions,
   excluded_counts = metricSummary.ExcludedCounts,
   group_summaries = metricSummary.Groups,
   snapshot_results = snapshotResults
  };

  var path = Path.Combine(BacktestDirectory, $"backtest_results_{generatedAt:yyyy-MM-dd_HHmmss}_{backtestId.Split('_')[1]}.json");
  await WriteJsonAtomicAsync(path, payload, ct);
  await UpdateBacktestIndexAsync(path, backtestId, generatedAt, history.Snapshots.Count, ct);
  AppLogger.Info($"Backtest completed: id={backtestId}; snapshots={history.Snapshots.Count}; output={path}");
  return path;
 }

 static object BuildPriceStatus(string status,int days,DateTimeOffset targetTime,Models.BacktestCandidate candidate,Models.HistoricalPriceResult exitPrice,Models.HistoricalPriceResult btcPrice,decimal? returnPct,decimal? btcReturnPct,decimal? relativeReturn)
 {
  return new
  {
   status,
   horizon_days = days,
   target_time = targetTime,
   coin_id = candidate.CoinId,
   symbol = candidate.Symbol,
   price_lookup_symbol = exitPrice.Point?.LookupSymbol ?? candidate.Symbol + "USDT",
   entry_price = candidate.EntryPrice,
   exit_price = exitPrice.Point?.Price,
   return_pct = returnPct,
   btc_return_pct = btcReturnPct,
   relative_return_vs_btc_pct = relativeReturn,
   price_time = exitPrice.Point?.PriceTime,
   price_source = exitPrice.Point?.Source,
   price_match = exitPrice.Point?.Match,
   btc_price_time = btcPrice.Point?.PriceTime,
   btc_price_source = btcPrice.Point?.Source,
   warning = exitPrice.Warning
  };
 }

 static object BuildHistoryRange(Models.HistoryReadResult history)
 {
  if (history.Snapshots.Count == 0) return new { from = (DateTimeOffset?)null, to = (DateTimeOffset?)null };
  return new
  {
   from = history.Snapshots.Min(x => x.GeneratedAt),
   to = history.Snapshots.Max(x => x.GeneratedAt)
  };
 }

 static decimal RoundPct(decimal value) => Math.Round(value, 2);

 static async Task WriteJsonAtomicAsync(string path,object payload,CancellationToken ct)
 {
  var tempPath = path + ".tmp";
  await File.WriteAllTextAsync(tempPath, JsonSerializer.Serialize(payload, JsonOptions), ct);
  File.Move(tempPath, path, true);
 }

 static async Task UpdateBacktestIndexAsync(string resultPath,string backtestId,DateTimeOffset generatedAt,int snapshotsProcessed,CancellationToken ct)
 {
  object payload = new
  {
   updated_at = DateTimeOffset.Now,
   entries = new[]
   {
    new
    {
     backtest_id = backtestId,
     generated_at = generatedAt,
     result_path = Path.GetRelativePath(BacktestDirectory, resultPath).Replace('\\','/'),
     snapshots_processed = snapshotsProcessed
    }
   }
  };

  if (File.Exists(BacktestIndexPath))
  {
   try
   {
    using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(BacktestIndexPath, ct));
    var entries = doc.RootElement.TryGetProperty("entries", out var existing) && existing.ValueKind == JsonValueKind.Array
     ? existing.EnumerateArray().Select(x => JsonSerializer.Deserialize<object>(x.GetRawText())).Where(x => x is not null).ToList()
     : [];
    entries.Insert(0, new
    {
     backtest_id = backtestId,
     generated_at = generatedAt,
     result_path = Path.GetRelativePath(BacktestDirectory, resultPath).Replace('\\','/'),
     snapshots_processed = snapshotsProcessed
    });
    payload = new { updated_at = DateTimeOffset.Now, entries };
   }
   catch (Exception ex)
   {
    AppLogger.Warn("Backtest index read failed; recreating index. " + ex.Message);
   }
  }

  await WriteJsonAtomicAsync(BacktestIndexPath, payload, ct);
 }
}
