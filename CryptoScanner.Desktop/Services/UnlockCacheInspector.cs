using System.IO;
using System.Text.Json;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public sealed class UnlockCacheInspector
{
 public const long MaxImportFileBytes = 5 * 1024 * 1024;
 readonly int _defaultMaxCacheAgeHours;
 readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

 public UnlockCacheInspector(int defaultMaxCacheAgeHours)
 {
  _defaultMaxCacheAgeHours = defaultMaxCacheAgeHours;
 }

 public async Task<UnlockCacheInspectionResult> InspectFileAsync(string path, bool strictImport, CancellationToken ct = default)
 {
  if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return Fail("FILE_NOT_FOUND", "File not found.", path);

  FileInfo info;
  try
  {
   info = new FileInfo(path);
  }
  catch (Exception ex)
  {
   return Fail("READ_FAILED", ex.Message, path);
  }

  if (info.Length == 0) return Fail("EMPTY_FILE", "File is empty.", path);
  if (strictImport && info.Length > MaxImportFileBytes) return Fail("FILE_TOO_LARGE", "File is larger than 5 MB.", path);

  try
  {
   await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
   return await InspectStreamAsync(stream, path, strictImport, ct);
  }
  catch (JsonException ex)
  {
   return Fail("INVALID_JSON", $"Invalid JSON at line {ex.LineNumber}.", path);
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   return Fail("READ_FAILED", ex.Message, path);
  }
 }

 public async Task<UnlockCacheInspectionResult> InspectStreamAsync(Stream stream, string path, bool strictImport, CancellationToken ct = default)
 {
  UnlockCacheDocument? document;
  try
  {
   document = await JsonSerializer.DeserializeAsync<UnlockCacheDocument>(stream, _jsonOptions, ct);
  }
  catch (JsonException ex)
  {
   return Fail("INVALID_JSON", $"Invalid JSON at line {ex.LineNumber}.", path);
  }

  if (document is null) return Fail("INVALID_JSON", "JSON document is empty or invalid.", path);

  var summary = new UnlockCacheSummary
  {
   Path = path,
   SchemaVersion = document.SchemaVersion,
   UpdatedAt = document.UpdatedAt,
   ItemsTotal = document.Items.Count
  };

  if (document.SchemaVersion != "1.0") return Fail("UNSUPPORTED_SCHEMA", $"Unsupported schema version: {document.SchemaVersion}", path, summary, document);
  if (strictImport && !document.UpdatedAt.HasValue) return Fail("INVALID_UPDATED_AT", "updated_at is required and must be a valid DateTimeOffset.", path, summary, document);

  summary.IsExpired = IsExpired(document);
  if (summary.IsExpired) summary.Warning = "Unlock cache is expired.";
  var validItems = new List<UnlockInfo>();
  foreach (var item in document.Items)
  {
   var error = ValidateItem(item, strictImport);
   if (error is null)
   {
    validItems.Add(item);
    summary.ItemsValid++;
   }
   else
   {
    summary.ItemsInvalid++;
    if (strictImport) return Fail(error.Value.Code, error.Value.Message, path, summary, document);
   }
  }

  summary.DuplicateCoinIds = validItems.Where(x => !string.IsNullOrWhiteSpace(x.CoinId))
   .GroupBy(x => x.CoinId.Trim(), StringComparer.OrdinalIgnoreCase)
   .Count(x => x.Count() > 1);
  summary.DuplicateSymbols = validItems.Where(x => !string.IsNullOrWhiteSpace(x.Symbol))
   .GroupBy(x => NormalizeSymbol(x.Symbol), StringComparer.OrdinalIgnoreCase)
   .Count(x => x.Count() > 1);

  if (strictImport)
  {
   if (validItems.Count == 0) return Fail("NO_VALID_ITEMS", "No valid unlock items found.", path, summary, document);
   if (summary.DuplicateCoinIds > 0) return Fail("DUPLICATE_COIN_ID", "Duplicate coin_id found.", path, summary, document);
   if (summary.DuplicateSymbols > 0) return Fail("DUPLICATE_SYMBOL", "Duplicate symbol found.", path, summary, document);
  }

  summary.Loaded = true;
  return new UnlockCacheInspectionResult
  {
   Success = true,
   StatusCode = summary.IsExpired ? "LOCAL_CACHE_EXPIRED" : "LOCAL_CACHE",
   Message = summary.IsExpired ? "Unlock cache is valid but expired." : "Unlock cache is valid.",
   Document = document,
   Summary = summary,
   ValidItems = validItems
  };
 }

 static (string Code, string Message)? ValidateItem(UnlockInfo item, bool strictImport)
 {
  if (string.IsNullOrWhiteSpace(item.CoinId) && string.IsNullOrWhiteSpace(item.Symbol)) return ("NO_VALID_ITEMS", "Each item must have coin_id or symbol.");
  if (strictImport && !item.Unlock30dPct.HasValue) return ("INVALID_PERCENTAGE", "unlock_30d_pct is required.");
  if (strictImport && !item.Unlock90dPct.HasValue) return ("INVALID_PERCENTAGE", "unlock_90d_pct is required.");
  if (!ValidPct(item.Unlock30dPct) || !ValidPct(item.Unlock90dPct)) return ("INVALID_PERCENTAGE", "Unlock percentages must be between 0 and 100.");
  if (strictImport && item.Unlock30dPct.HasValue && item.Unlock90dPct.HasValue && item.Unlock90dPct.Value < item.Unlock30dPct.Value)
  {
   return ("INVALID_PERCENTAGE", "unlock_90d_pct must be greater than or equal to unlock_30d_pct.");
  }

  if (item.NextUnlockAt.HasValue && item.NextUnlockAt.Value < DateTimeOffset.Now.AddDays(-1)) return ("INVALID_ITEM", "next_unlock_at is too old.");
  return null;
 }

 bool IsExpired(UnlockCacheDocument document)
 {
  var now = DateTimeOffset.Now;
  if (document.ExpiresAt.HasValue) return document.ExpiresAt.Value <= now;
  var maxAge = document.MaxCacheAgeHours.GetValueOrDefault(_defaultMaxCacheAgeHours);
  return document.UpdatedAt.HasValue && document.UpdatedAt.Value.AddHours(maxAge) <= now;
 }

 static bool ValidPct(decimal? value) => !value.HasValue || value.Value is >= 0m and <= 100m;

 public static string NormalizeSymbol(string symbol) => new(symbol.Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());

 static UnlockCacheInspectionResult Fail(string code, string message, string path, UnlockCacheSummary? summary = null, UnlockCacheDocument? document = null)
 {
  summary ??= new UnlockCacheSummary { Path = path };
  summary.Warning = message;
  return new UnlockCacheInspectionResult
  {
   Success = false,
   StatusCode = code,
   Message = message,
   Document = document,
   Summary = summary
  };
 }
}
