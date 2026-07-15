using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public interface IHistoryService
{
 Task<HistorySaveResult> SaveAsync(string snapshotPath, string scannerLogPath, HistoryIndexEntry entry, CancellationToken ct);
 Task<HistorySaveResult> UpdateLogAsync(string relativeLogPath, string scannerLogPath, CancellationToken ct);
 Task ApplyRetentionAsync(TimeSpan retention, CancellationToken ct);
}

public sealed class HistoryService : IHistoryService
{
 static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true, PropertyNameCaseInsensitive = true };

 public static string HistoryDirectory { get; } = Path.Combine(
  Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
  "CryptoScanner.Desktop",
  "history");

 static string IndexPath => Path.Combine(HistoryDirectory, "history_index.json");

 public async Task<HistorySaveResult> SaveAsync(string snapshotPath, string scannerLogPath, HistoryIndexEntry entry, CancellationToken ct)
 {
  try
  {
   Directory.CreateDirectory(HistoryDirectory);
   var dayFolderName = entry.GeneratedAt.ToString("yyyy-MM-dd");
   var dayDirectory = Path.Combine(HistoryDirectory, dayFolderName);
   Directory.CreateDirectory(dayDirectory);

   var snapshotName = Path.GetFileName(snapshotPath);
   var logName = Path.GetFileName(scannerLogPath);
   var snapshotTarget = Path.Combine(dayDirectory, snapshotName);
   var logTarget = Path.Combine(dayDirectory, logName);

   await CopyAtomicAsync(snapshotPath, snapshotTarget, ct);
   await CopyAtomicAsync(scannerLogPath, logTarget, ct);

   entry.SnapshotPath = ToRelativePath(snapshotTarget);
   entry.LogPath = ToRelativePath(logTarget);

   var index = await LoadIndexAsync(ct);
   index.Entries.RemoveAll(x => x.ScanId == entry.ScanId);
   index.Entries.Add(entry);
   index.Entries = index.Entries.OrderByDescending(x => x.GeneratedAt).ToList();
   index.UpdatedAt = DateTimeOffset.Now;
   await WriteIndexAtomicAsync(index, ct);
   await ApplyRetentionAsync(TimeSpan.FromDays(180), ct);

   return new HistorySaveResult
   {
    Success = true,
    SnapshotRelativePath = entry.SnapshotPath,
    LogRelativePath = entry.LogPath
   };
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   return new HistorySaveResult { Success = false, Warning = ex.Message };
  }
 }

 public async Task ApplyRetentionAsync(TimeSpan retention, CancellationToken ct)
 {
  Directory.CreateDirectory(HistoryDirectory);
  var cutoff = DateTimeOffset.Now - retention;
  var index = await LoadIndexAsync(ct);
  var kept = new List<HistoryIndexEntry>();

  foreach (var entry in index.Entries)
  {
   ct.ThrowIfCancellationRequested();
   if (entry.GeneratedAt < cutoff)
   {
    DeleteIfExists(Path.Combine(HistoryDirectory, entry.SnapshotPath));
    DeleteIfExists(Path.Combine(HistoryDirectory, entry.LogPath));
    continue;
   }

   if (File.Exists(Path.Combine(HistoryDirectory, entry.SnapshotPath)) && File.Exists(Path.Combine(HistoryDirectory, entry.LogPath)))
   {
    kept.Add(entry);
   }
  }

  index.Entries = kept.OrderByDescending(x => x.GeneratedAt).ToList();
  index.UpdatedAt = DateTimeOffset.Now;
  await WriteIndexAtomicAsync(index, ct);
  DeleteEmptyDayFolders();
 }

 public async Task<HistorySaveResult> UpdateLogAsync(string relativeLogPath, string scannerLogPath, CancellationToken ct)
 {
  try
  {
   var targetPath = Path.Combine(HistoryDirectory, relativeLogPath);
   if (!File.Exists(targetPath)) return new HistorySaveResult { Success = false, Warning = "History log target does not exist." };

   await CopyAtomicAsync(scannerLogPath, targetPath, ct);
   return new HistorySaveResult { Success = true, LogRelativePath = relativeLogPath };
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   return new HistorySaveResult { Success = false, Warning = ex.Message };
  }
 }

 public static string ConfigFingerprint(ScannerSettings settings)
 {
  var text = JsonSerializer.Serialize(new
  {
   settings.ActiveScanProfile,
   settings.MinTotalVolumeUsd,
   settings.MinBinanceQuoteVolumeUsd,
   settings.RejectBinanceQuoteVolumeUsd,
   settings.MinMarketCapUsd,
   settings.MaxMarketCapUsd,
   settings.MaxFdvMarketCapRatio,
   settings.MinCirculatingRatio,
   settings.MinStrongVolumeUsd,
   max_technical_candidates = GetMaxTechnicalCandidates(settings)
  });
  var hash = SHA256.HashData(Encoding.UTF8.GetBytes(text));
  return Convert.ToHexString(hash)[..12];
 }

 static int GetMaxTechnicalCandidates(ScannerSettings settings)
 {
  if (settings.ScanProfiles.TryGetValue(settings.ActiveScanProfile, out var profile) && profile.MaxTechnicalCandidates > 0)
  {
   return profile.MaxTechnicalCandidates;
  }

  return settings.MaxTechnicalCandidates;
 }

 static async Task CopyAtomicAsync(string sourcePath, string targetPath, CancellationToken ct)
 {
  var tempPath = targetPath + ".tmp";
  await using (var source = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.Read))
  await using (var target = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, FileOptions.WriteThrough))
  {
   await source.CopyToAsync(target, ct);
   await target.FlushAsync(ct);
  }

  File.Move(tempPath, targetPath, true);
 }

 static async Task<HistoryIndexDocument> LoadIndexAsync(CancellationToken ct)
 {
  if (!File.Exists(IndexPath)) return new HistoryIndexDocument { UpdatedAt = DateTimeOffset.Now };

  try
  {
   await using var stream = new FileStream(IndexPath, FileMode.Open, FileAccess.Read, FileShare.Read);
   return await JsonSerializer.DeserializeAsync<HistoryIndexDocument>(stream, JsonOptions, ct) ?? new HistoryIndexDocument { UpdatedAt = DateTimeOffset.Now };
  }
  catch (JsonException)
  {
   var corruptPath = Path.Combine(HistoryDirectory, $"history_index.corrupt_{DateTime.Now:yyyyMMddHHmmss}.json");
   File.Move(IndexPath, corruptPath, true);
   AppLogger.Warn("History index was corrupt and has been moved to: " + corruptPath);
   return await RebuildIndexFromHistoryFilesAsync(ct);
  }
 }

 static async Task<HistoryIndexDocument> RebuildIndexFromHistoryFilesAsync(CancellationToken ct)
 {
  var index = new HistoryIndexDocument { UpdatedAt = DateTimeOffset.Now };
  if (!Directory.Exists(HistoryDirectory)) return index;

  foreach (var logPath in Directory.GetFiles(HistoryDirectory, "scanner_log_*.json", SearchOption.AllDirectories))
  {
   ct.ThrowIfCancellationRequested();
   var entry = await TryCreateEntryFromHistoryFilesAsync(logPath, ct);
   if (entry is not null) index.Entries.Add(entry);
  }

  index.Entries = index.Entries
   .GroupBy(x => x.ScanId)
   .Select(x => x.OrderByDescending(y => y.GeneratedAt).First())
   .OrderByDescending(x => x.GeneratedAt)
   .ToList();
  AppLogger.Warn($"History index rebuilt from files. Entries={index.Entries.Count}");
  return index;
 }

 static async Task<HistoryIndexEntry?> TryCreateEntryFromHistoryFilesAsync(string logPath, CancellationToken ct)
 {
  var snapshotPath = GetSnapshotPathFromLogPath(logPath);
  if (!File.Exists(snapshotPath)) return null;

  try
  {
   using var logDoc = await OpenJsonAsync(logPath, ct);
   using var snapshotDoc = await OpenJsonAsync(snapshotPath, ct);
   var logRoot = logDoc.RootElement;
   var snapshotRoot = snapshotDoc.RootElement;
   var generatedAt = ReadDateTimeOffset(logRoot, "generated_at") ?? ReadDateTimeOffset(snapshotRoot, "generated_at");
   if (generatedAt is null) return null;

   var candidates = ReadCandidates(snapshotRoot);
   var priority = candidates.Where(x => x.Status == "WATCHLIST_PRIORITY").OrderBy(x => x.Rank).ToList();
   var watch = candidates.Where(x => x.Status == "WATCHLIST").OrderBy(x => x.Rank).Take(20).ToList();

   return new HistoryIndexEntry
   {
    ScanId = ReadString(logRoot, "scan_id") ?? Path.GetFileNameWithoutExtension(logPath),
    SchemaVersion = ReadString(snapshotRoot, "schema_version") ?? "2.1",
    ScannerVersion = ReadString(snapshotRoot, "scanner_version") ?? "1.1.0",
    ScanProfile = ReadString(snapshotRoot, "scanner_config", "active_scan_profile") ?? "",
    GeneratedAt = generatedAt.Value,
    BtcRegime = ReadString(snapshotRoot, "btc_regime") ?? ReadString(logRoot, "scan_summary", "btc_regime") ?? "",
    CoinsScanned = ReadInt(snapshotRoot, "filter_summary", "coins_scanned") ?? ReadInt(logRoot, "scan_summary", "coins_scanned") ?? 0,
    Candidates = ReadInt(snapshotRoot, "filter_summary", "candidates") ?? candidates.Count,
    PriorityCount = ReadInt(snapshotRoot, "filter_summary", "watchlist_priority") ?? priority.Count,
    WatchCount = ReadInt(snapshotRoot, "filter_summary", "watchlist") ?? watch.Count,
    RejectCount = ReadInt(snapshotRoot, "filter_summary", "rejected") ?? candidates.Count(x => x.Status == "REJECT"),
    ElapsedSeconds = ReadDouble(logRoot, "scan_timing", "elapsed_seconds"),
    SnapshotPath = ToRelativePath(snapshotPath),
    LogPath = ToRelativePath(logPath),
    PrioritySymbols = priority.Select(x => x.Symbol).ToList(),
    WatchSymbols = watch.Select(x => x.Symbol).ToList(),
    ConfigFingerprint = "REBUILT"
   };
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   AppLogger.Warn("Failed to rebuild history entry from log: " + logPath + "; " + ex.Message);
   return null;
  }
 }

 static string GetSnapshotPathFromLogPath(string logPath)
 {
  var name = Path.GetFileName(logPath);
  return Path.Combine(Path.GetDirectoryName(logPath) ?? HistoryDirectory, name.Replace("scanner_log_", "market_snapshot_"));
 }

 static async Task<JsonDocument> OpenJsonAsync(string path, CancellationToken ct)
 {
  await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
  return await JsonDocument.ParseAsync(stream, cancellationToken: ct);
 }

 static List<(int Rank, string Symbol, string Status)> ReadCandidates(JsonElement root)
 {
  if (!root.TryGetProperty("candidates", out var candidatesElement) || candidatesElement.ValueKind != JsonValueKind.Array) return [];

  var candidates = new List<(int Rank, string Symbol, string Status)>();
  foreach (var item in candidatesElement.EnumerateArray())
  {
   candidates.Add((
    ReadInt(item, "Rank") ?? ReadInt(item, "rank") ?? 0,
    ReadString(item, "Symbol") ?? ReadString(item, "symbol") ?? "",
    ReadString(item, "Status") ?? ReadString(item, "status") ?? ""));
  }

  return candidates;
 }

 static string? ReadString(JsonElement root, string name)
 {
  return root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
 }

 static string? ReadString(JsonElement root, string parent, string name)
 {
  return root.TryGetProperty(parent, out var parentValue) ? ReadString(parentValue, name) : null;
 }

 static int? ReadInt(JsonElement root, string name)
 {
  return root.TryGetProperty(name, out var value) && value.TryGetInt32(out var result) ? result : null;
 }

 static int? ReadInt(JsonElement root, string parent, string name)
 {
  return root.TryGetProperty(parent, out var parentValue) ? ReadInt(parentValue, name) : null;
 }

 static double? ReadDouble(JsonElement root, string parent, string name)
 {
  if (!root.TryGetProperty(parent, out var parentValue)) return null;
  return parentValue.TryGetProperty(name, out var value) && value.TryGetDouble(out var result) ? result : null;
 }

 static DateTimeOffset? ReadDateTimeOffset(JsonElement root, string name)
 {
  return root.TryGetProperty(name, out var value) && value.TryGetDateTimeOffset(out var result) ? result : null;
 }

 static async Task WriteIndexAtomicAsync(HistoryIndexDocument index, CancellationToken ct)
 {
  Directory.CreateDirectory(HistoryDirectory);
  var tempPath = IndexPath + ".tmp";
  await using (var stream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, FileOptions.WriteThrough))
  {
   await JsonSerializer.SerializeAsync(stream, index, JsonOptions, ct);
   await stream.FlushAsync(ct);
  }

  File.Move(tempPath, IndexPath, true);
 }

 static string ToRelativePath(string path) => Path.GetRelativePath(HistoryDirectory, path).Replace('\\', '/');

 static void DeleteIfExists(string path)
 {
  try
  {
   if (File.Exists(path)) File.Delete(path);
  }
  catch (Exception ex)
  {
   AppLogger.Warn("Failed to delete history file: " + path + "; " + ex.Message);
  }
 }

 static void DeleteEmptyDayFolders()
 {
  foreach (var directory in Directory.GetDirectories(HistoryDirectory))
  {
   try
   {
    if (!Directory.EnumerateFileSystemEntries(directory).Any()) Directory.Delete(directory);
   }
   catch (Exception ex)
   {
    AppLogger.Warn("Failed to delete empty history directory: " + directory + "; " + ex.Message);
   }
  }
 }
}
