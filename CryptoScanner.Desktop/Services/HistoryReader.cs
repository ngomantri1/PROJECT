using System.IO;
using System.Text.Json;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public interface IHistoryReader
{
 Task<HistoryReadResult> ReadAsync(CancellationToken ct);
}

public sealed class HistoryReader : IHistoryReader
{
 static readonly HashSet<string> SupportedSchemas = ["2.1"];

 public async Task<HistoryReadResult> ReadAsync(CancellationToken ct)
 {
  var result = new HistoryReadResult();
  var indexPath = Path.Combine(HistoryService.HistoryDirectory, "history_index.json");
  if (!File.Exists(indexPath))
  {
   result.Warnings.Add("HISTORY_INDEX_NOT_FOUND");
   return result;
  }

  HistoryIndexDocument? index;
  try
  {
   await using var stream = new FileStream(indexPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
   index = await JsonSerializer.DeserializeAsync<HistoryIndexDocument>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   result.Warnings.Add("HISTORY_INDEX_PARSE_FAILED: " + ex.Message);
   return result;
  }

  if (index is null)
  {
   result.Warnings.Add("HISTORY_INDEX_EMPTY");
   return result;
  }

  foreach (var entry in index.Entries.OrderBy(x => x.GeneratedAt))
  {
   ct.ThrowIfCancellationRequested();
   var snapshot = await TryReadSnapshotAsync(entry, result.Warnings, ct);
   if (snapshot is not null) result.Snapshots.Add(snapshot);
  }

  return result;
 }

 static async Task<BacktestHistorySnapshot?> TryReadSnapshotAsync(HistoryIndexEntry entry, List<string> warnings, CancellationToken ct)
 {
  if (string.IsNullOrWhiteSpace(entry.ScanId))
  {
   warnings.Add("INVALID_HISTORY_ENTRY: missing scan_id");
   return null;
  }

  if (!SupportedSchemas.Contains(entry.SchemaVersion))
  {
   warnings.Add($"UNSUPPORTED_SCHEMA: scan_id={entry.ScanId}; schema={entry.SchemaVersion}");
   return null;
  }

  var snapshotPath = Path.Combine(HistoryService.HistoryDirectory, entry.SnapshotPath);
  if (!File.Exists(snapshotPath))
  {
   warnings.Add($"SNAPSHOT_NOT_FOUND: scan_id={entry.ScanId}; path={entry.SnapshotPath}");
   return null;
  }

  try
  {
   await using var stream = new FileStream(snapshotPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
   using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
   var root = doc.RootElement;
   var generatedAt = ReadDateTimeOffset(root, "generated_at") ?? entry.GeneratedAt;
   var schema = ReadString(root, "schema_version") ?? entry.SchemaVersion;
   if (!SupportedSchemas.Contains(schema))
   {
    warnings.Add($"UNSUPPORTED_SNAPSHOT_SCHEMA: scan_id={entry.ScanId}; schema={schema}");
    return null;
   }

   var candidates = ReadCandidates(root);
   if (entry.Candidates > 0 && candidates.Count != entry.Candidates)
   {
    warnings.Add($"CANDIDATE_COUNT_MISMATCH: scan_id={entry.ScanId}; index={entry.Candidates}; snapshot={candidates.Count}");
   }

   return new BacktestHistorySnapshot
   {
    IndexEntry = entry,
    SnapshotFullPath = snapshotPath,
    GeneratedAt = generatedAt,
    BtcRegime = ReadString(root, "btc_regime") ?? entry.BtcRegime,
    SchemaVersion = schema,
    ScannerVersion = ReadString(root, "scanner_version") ?? entry.ScannerVersion,
    ScanProfile = ReadString(root, "scanner_config", "active_scan_profile") ?? entry.ScanProfile,
    Candidates = candidates
   };
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   warnings.Add($"SNAPSHOT_PARSE_FAILED: scan_id={entry.ScanId}; {ex.Message}");
   return null;
  }
 }

 static List<BacktestCandidate> ReadCandidates(JsonElement root)
 {
  if (!root.TryGetProperty("candidates", out var candidatesElement) || candidatesElement.ValueKind != JsonValueKind.Array) return [];

  var candidates = new List<BacktestCandidate>();
  foreach (var item in candidatesElement.EnumerateArray())
  {
   var candidate = new BacktestCandidate
   {
    Rank = ReadInt(item, "Rank") ?? ReadInt(item, "rank") ?? 0,
    CoinId = ReadString(item, "Id") ?? ReadString(item, "id") ?? "",
    Symbol = ReadString(item, "Symbol") ?? ReadString(item, "symbol") ?? "",
    Name = ReadString(item, "Name") ?? ReadString(item, "name") ?? "",
    Status = ReadString(item, "Status") ?? ReadString(item, "status") ?? "",
    DecisionCode = ReadString(item, "DecisionCode") ?? ReadString(item, "decision_code") ?? "",
    Setup = ReadString(item, "Setup") ?? ReadString(item, "setup") ?? "",
    EntryPrice = ReadDecimal(item, "Price") ?? ReadDecimal(item, "price") ?? 0,
    MarketTechnicalScore = ReadInt(item, "MarketTechnicalScore") ?? ReadInt(item, "market_technical_score") ?? 0,
    EntryReadinessScore = ReadInt(item, "EntryReadinessScore") ?? ReadInt(item, "entry_readiness_score") ?? 0
   };
   candidates.Add(candidate);
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

 static decimal? ReadDecimal(JsonElement root, string name)
 {
  return root.TryGetProperty(name, out var value) && value.TryGetDecimal(out var result) ? result : null;
 }

 static DateTimeOffset? ReadDateTimeOffset(JsonElement root, string name)
 {
  return root.TryGetProperty(name, out var value) && value.TryGetDateTimeOffset(out var result) ? result : null;
 }
}
