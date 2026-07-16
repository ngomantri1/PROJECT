using System.IO;
using System.Text.Json;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public sealed class AppHealthService
{
 public async Task<AppHealthSummary> LoadAsync(CancellationToken ct = default)
 {
  return new AppHealthSummary
  {
   Scanner = await LoadScannerHealthAsync(ct),
   Backtest = await LoadBacktestHealthAsync(ct),
   History = await LoadHistoryHealthAsync(ct)
  };
 }

 public async Task<ScannerHealthSummary> LoadScannerHealthAsync(CancellationToken ct = default)
 {
  var files = SafeEnumerate(ExportService.ExportDirectory, "scanner_log_*.json");
  if (files.Count == 0) return ScannerHealthSummary.NoData();

  var parsed = new List<(ScannerHealthSummary Summary, DateTimeOffset SortTime)>();
  var errors = new List<string>();
  foreach (var file in files)
  {
   ct.ThrowIfCancellationRequested();
   try
   {
    using var doc = await OpenJsonAsync(file.FullName, ct);
    var root = doc.RootElement;
    var generatedAt = ReadDate(root, "generated_at") ?? file.LastWriteTimeUtc;
    parsed.Add((ParseScanner(root), generatedAt));
   }
   catch (Exception ex) when (ex is not OperationCanceledException)
   {
    errors.Add($"{file.Name}: {ex.Message}");
   }
  }

  if (parsed.Count == 0) return errors.Count == 0 ? ScannerHealthSummary.NoData() : ScannerHealthSummary.ReadError(errors[0]);

  return parsed.OrderByDescending(x => x.SortTime).First().Summary;
 }

 public async Task<BacktestHealthSummary> LoadBacktestHealthAsync(CancellationToken ct = default)
 {
  var files = SafeEnumerate(BacktestService.BacktestDirectory, "backtest_results_*.json");
  if (files.Count == 0) return BacktestHealthSummary.NoData();

  var parsed = new List<(BacktestHealthSummary Summary, DateTimeOffset SortTime)>();
  var errors = new List<string>();
  foreach (var file in files)
  {
   ct.ThrowIfCancellationRequested();
   try
   {
    using var doc = await OpenJsonAsync(file.FullName, ct);
    var root = doc.RootElement;
    var generatedAt = ReadDate(root, "generated_at") ?? file.LastWriteTimeUtc;
    parsed.Add((ParseBacktest(root), generatedAt));
   }
   catch (Exception ex) when (ex is not OperationCanceledException)
   {
    errors.Add($"{file.Name}: {ex.Message}");
   }
  }

  if (parsed.Count == 0) return errors.Count == 0 ? BacktestHealthSummary.NoData() : BacktestHealthSummary.ReadError(errors[0]);
  return parsed.OrderByDescending(x => x.SortTime).First().Summary;
 }

 public async Task<HistoryHealthSummary> LoadHistoryHealthAsync(CancellationToken ct = default)
 {
  var path = Path.Combine(HistoryService.HistoryDirectory, "history_index.json");
  if (!File.Exists(path)) return HistoryHealthSummary.NoData();

  try
  {
   using var doc = await OpenJsonAsync(path, ct);
   var root = doc.RootElement;
   if (!TryGet(root, "entries", out var entries) && !TryGet(root, "Entries", out entries)) return HistoryHealthSummary.NoData("History index has no entries.");
   if (entries.ValueKind != JsonValueKind.Array) return HistoryHealthSummary.ReadError("History entries is not an array.");

   var validEntries = new List<(string ScanId, DateTimeOffset GeneratedAt)>();
   foreach (var item in entries.EnumerateArray())
   {
    var scanId = ReadString(item, "scan_id") ?? ReadString(item, "ScanId");
    var generatedAt = ReadDate(item, "generated_at") ?? ReadDate(item, "GeneratedAt");
    if (!string.IsNullOrWhiteSpace(scanId) && generatedAt.HasValue) validEntries.Add((scanId, generatedAt.Value));
   }

   if (validEntries.Count == 0) return HistoryHealthSummary.NoData();
   var latest = validEntries.OrderByDescending(x => x.GeneratedAt).First();
   return new HistoryHealthSummary
   {
    Status = HealthReadStatus.OK,
    EntryCount = validEntries.Count,
    LatestSnapshotAt = latest.GeneratedAt,
    LatestScanId = latest.ScanId,
    RetentionDays = ReadInt(root, "retention_days") ?? ReadInt(root, "RetentionDays")
   };
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   AppLogger.Warn("Health history read failed: " + ex.Message);
   return HistoryHealthSummary.ReadError(ex.Message);
  }
 }

 static ScannerHealthSummary ParseScanner(JsonElement root)
 {
  var unlockSummary = GetObject(root, "unlock_cache_summary");
  var history = GetObject(root, "history");
  var scanSummary = GetObject(root, "scan_summary");
  var timing = GetObject(root, "scan_timing");

  var unlockLoaded = ReadBool(unlockSummary, "loaded");
  var unlockExpired = ReadBool(unlockSummary, "is_expired");
  var unlockWarning = ReadString(unlockSummary, "warning") ?? "";
  var unlockSource = "NO_DATA";
  if (unlockLoaded == true && unlockExpired != true) unlockSource = "LOCAL_CACHE";
  else if (unlockLoaded == true && unlockExpired == true) unlockSource = "LOCAL_CACHE_EXPIRED";
  else if (unlockLoaded == false && unlockWarning.Contains("not found", StringComparison.OrdinalIgnoreCase)) unlockSource = "CACHE_MISSING";
  else if (unlockLoaded == false) unlockSource = "CACHE_ERROR";

  return new ScannerHealthSummary
  {
   Status = HealthReadStatus.OK,
   ScanId = ReadString(root, "scan_id") ?? "",
   ScanStatus = ReadString(root, "scan_status") ?? "",
   GeneratedAt = ReadDate(root, "generated_at"),
   BtcRegime = ReadString(scanSummary, "btc_regime") ?? "--",
   Candidates = ReadInt(scanSummary, "candidates"),
   Priority = ReadInt(scanSummary, "watchlist_priority"),
   Watch = ReadInt(scanSummary, "watchlist"),
   Reject = ReadInt(scanSummary, "rejected"),
   ElapsedSeconds = ReadDouble(timing, "elapsed_seconds"),
   UnlockSource = unlockSource,
   UnlockMatches = ReadInt(unlockSummary, "candidate_matches"),
   UnlockMissing = ReadInt(unlockSummary, "candidate_missing"),
   HistorySaved = ReadBool(history, "history_saved")
  };
 }

 static BacktestHealthSummary ParseBacktest(JsonElement root)
 {
  var excluded = GetObject(root, "excluded_counts");
  var completed = CountHorizons(root, "COMPLETED");
  var directPending = CountHorizons(root, "PENDING");
  var directMissing = CountHorizons(root, "PRICE_MISSING");
  var directUnsupported = CountHorizons(root, "UNSUPPORTED_SYMBOL");
  var pending = ReadInt(excluded, "pending");
  var missing = ReadInt(excluded, "missing_price");
  var unsupported = ReadInt(excluded, "unsupported_symbol");

  if (pending.HasValue && directPending >= 0 && pending.Value != directPending) AppLogger.Warn($"Backtest health pending mismatch: excluded={pending}; direct={directPending}");
  if (missing.HasValue && directMissing >= 0 && missing.Value != directMissing) AppLogger.Warn($"Backtest health missing mismatch: excluded={missing}; direct={directMissing}");
  if (unsupported.HasValue && directUnsupported >= 0 && unsupported.Value != directUnsupported) AppLogger.Warn($"Backtest health unsupported mismatch: excluded={unsupported}; direct={directUnsupported}");

  return new BacktestHealthSummary
  {
   Status = HealthReadStatus.OK,
   BacktestId = ReadString(root, "backtest_id") ?? "",
   GeneratedAt = ReadDate(root, "generated_at"),
   SnapshotsProcessed = ReadInt(root, "snapshots_processed"),
   SnapshotsSkipped = ReadInt(root, "snapshots_skipped"),
   CompletedHorizons = completed,
   PendingHorizons = pending,
   MissingPriceHorizons = missing,
   UnsupportedSymbolHorizons = unsupported
  };
 }

 static int CountHorizons(JsonElement root, string status)
 {
  if (!TryGet(root, "snapshot_results", out var snapshots) || snapshots.ValueKind != JsonValueKind.Array) return 0;
  var count = 0;
  foreach (var snapshot in snapshots.EnumerateArray())
  {
   if (!TryGet(snapshot, "candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array) continue;
   foreach (var candidate in candidates.EnumerateArray())
   {
    if (!TryGet(candidate, "horizons", out var horizons) || horizons.ValueKind != JsonValueKind.Object) continue;
    foreach (var horizon in horizons.EnumerateObject())
    {
     var horizonStatus = ReadString(horizon.Value, "status");
     if (string.Equals(horizonStatus, status, StringComparison.OrdinalIgnoreCase)) count++;
    }
   }
  }

  return count;
 }

 static List<FileInfo> SafeEnumerate(string directory, string pattern)
 {
  try
  {
   if (!Directory.Exists(directory)) return [];
   return new DirectoryInfo(directory).EnumerateFiles(pattern, SearchOption.TopDirectoryOnly)
    .OrderByDescending(x => x.LastWriteTimeUtc)
    .ToList();
  }
  catch (Exception ex)
  {
   AppLogger.Warn("Health file enumeration failed: " + directory + "; " + ex.Message);
   return [];
  }
 }

 static async Task<JsonDocument> OpenJsonAsync(string path, CancellationToken ct)
 {
  await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 81920, true);
  return await JsonDocument.ParseAsync(stream, cancellationToken: ct);
 }

 static JsonElement GetObject(JsonElement root, string name)
 {
  return TryGet(root, name, out var value) && value.ValueKind == JsonValueKind.Object ? value : default;
 }

 static bool TryGet(JsonElement root, string name, out JsonElement value)
 {
  if (root.ValueKind == JsonValueKind.Object)
  {
   foreach (var property in root.EnumerateObject())
   {
    if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
    {
     value = property.Value;
     return true;
    }
   }
  }

  value = default;
  return false;
 }

 static string? ReadString(JsonElement root, string name)
 {
  return TryGet(root, name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
 }

 static int? ReadInt(JsonElement root, string name)
 {
  return TryGet(root, name, out var value) && value.TryGetInt32(out var result) ? result : null;
 }

 static double? ReadDouble(JsonElement root, string name)
 {
  return TryGet(root, name, out var value) && value.TryGetDouble(out var result) ? result : null;
 }

 static bool? ReadBool(JsonElement root, string name)
 {
  return TryGet(root, name, out var value) && (value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.False) ? value.GetBoolean() : null;
 }

 static DateTimeOffset? ReadDate(JsonElement root, string name)
 {
  return TryGet(root, name, out var value) && value.TryGetDateTimeOffset(out var result) ? result : null;
 }
}
