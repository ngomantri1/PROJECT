using System.IO;
using System.Text.Json;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public sealed class CachedUnlockProvider
{
 readonly int _defaultMaxCacheAgeHours;
 readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };
 bool _loaded;
 bool _loadAttempted;
 bool _cacheExpired;
 string _loadStatus = "CACHE_MISSING";
 string _cachePath = "";
 UnlockCacheDocument? _document;
 Dictionary<string, UnlockInfo> _byCoinId = new(StringComparer.OrdinalIgnoreCase);
 Dictionary<string, UnlockInfo> _byAlias = new(StringComparer.OrdinalIgnoreCase);
 Dictionary<string, List<UnlockInfo>> _bySymbol = new(StringComparer.OrdinalIgnoreCase);

 public UnlockCacheSummary Summary { get; } = new();

 public CachedUnlockProvider(int defaultMaxCacheAgeHours)
 {
  _defaultMaxCacheAgeHours = defaultMaxCacheAgeHours;
 }

 public async Task<UnlockProviderResult> GetAsync(string coinId, string symbol, CancellationToken ct)
 {
  await EnsureLoadedAsync(ct);
  if (!_loaded)
  {
   Summary.CandidateMissing++;
   return new UnlockProviderResult
   {
    Status = _loadStatus,
    Warning = Summary.Warning,
    SourcePath = _cachePath,
    IsExpired = _cacheExpired
   };
  }

  if (!string.IsNullOrWhiteSpace(coinId))
  {
   if (_byCoinId.TryGetValue(coinId.Trim(), out var byId) || _byAlias.TryGetValue(coinId.Trim(), out byId))
   {
    return Found(byId);
   }
  }

  var normalizedSymbol = NormalizeSymbol(symbol);
  if (normalizedSymbol.Length == 0 || IsNonStandardSymbol(normalizedSymbol))
  {
   Summary.CandidateMissing++;
   return new UnlockProviderResult
   {
    Status = "NOT_FOUND",
    Warning = "Symbol is empty or non-standard; symbol fallback skipped.",
    SourcePath = _cachePath,
    IsExpired = _cacheExpired
   };
  }

  if (_bySymbol.TryGetValue(normalizedSymbol, out var matches))
  {
   if (matches.Count == 1)
   {
    return Found(matches[0]);
   }

   Summary.CandidateMissing++;
   return new UnlockProviderResult
   {
    Status = "NOT_FOUND",
    Warning = "Symbol fallback skipped because multiple cache items share the symbol.",
    SourcePath = _cachePath,
    IsExpired = _cacheExpired
   };
  }

  Summary.CandidateMissing++;
  return new UnlockProviderResult { Status = "NOT_FOUND", SourcePath = _cachePath, IsExpired = _cacheExpired };
 }

 async Task EnsureLoadedAsync(CancellationToken ct)
 {
  if (_loadAttempted) return;
  _loadAttempted = true;
  _cachePath = ResolveCachePath();
  Summary.Path = _cachePath;
  if (string.IsNullOrWhiteSpace(_cachePath) || !File.Exists(_cachePath))
  {
   Summary.Warning = "unlock-cache.json not found.";
   _loadStatus = "CACHE_MISSING";
   AppLogger.Info("Unlock cache not found; scanner continues with UNLOCK_UNKNOWN.");
   return;
  }

  try
  {
   await using var stream = File.OpenRead(_cachePath);
   _document = await JsonSerializer.DeserializeAsync<UnlockCacheDocument>(stream, _jsonOptions, ct);
   if (_document is null)
   {
   Summary.Warning = "unlock-cache.json is empty or invalid.";
    _loadStatus = "INVALID_ITEM";
    AppLogger.Warn("Unlock cache invalid: empty document");
    return;
   }

   Summary.SchemaVersion = _document.SchemaVersion;
   Summary.UpdatedAt = _document.UpdatedAt;
   Summary.ItemsTotal = _document.Items.Count;
   if (_document.SchemaVersion != "1.0")
   {
   Summary.Warning = $"Unsupported unlock cache schema: {_document.SchemaVersion}";
    _loadStatus = "INVALID_ITEM";
    AppLogger.Warn(Summary.Warning);
    return;
   }

   _cacheExpired = IsExpired(_document);
   Summary.IsExpired = _cacheExpired;
   BuildIndexes(_document.Items);
   Summary.Loaded = true;
   _loaded = true;
   AppLogger.Info($"Unlock cache loaded: path={_cachePath}; valid={Summary.ItemsValid}; invalid={Summary.ItemsInvalid}; expired={Summary.IsExpired}");
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   Summary.Warning = ex.Message;
   _loadStatus = "INVALID_ITEM";
   AppLogger.Warn("Unlock cache load failed: " + ex.Message);
  }
 }

 void BuildIndexes(List<UnlockInfo> items)
 {
  var validItems = new List<UnlockInfo>();
  foreach (var item in items)
  {
   if (IsValid(item))
   {
    validItems.Add(item);
    Summary.ItemsValid++;
   }
   else
   {
    Summary.ItemsInvalid++;
   }
  }

  var duplicateCoinIds = validItems.Where(x => !string.IsNullOrWhiteSpace(x.CoinId))
   .GroupBy(x => x.CoinId.Trim(), StringComparer.OrdinalIgnoreCase)
   .Where(x => x.Count() > 1)
   .Select(x => x.Key)
   .ToHashSet(StringComparer.OrdinalIgnoreCase);
  Summary.DuplicateCoinIds = duplicateCoinIds.Count;
  Summary.DuplicateSymbols = validItems.Where(x => !string.IsNullOrWhiteSpace(x.Symbol))
   .GroupBy(x => NormalizeSymbol(x.Symbol), StringComparer.OrdinalIgnoreCase)
   .Count(x => x.Count() > 1);

  var matchableItems = validItems.Where(x => string.IsNullOrWhiteSpace(x.CoinId) || !duplicateCoinIds.Contains(x.CoinId.Trim())).ToList();

  _byCoinId = matchableItems.Where(x => !string.IsNullOrWhiteSpace(x.CoinId))
   .GroupBy(x => x.CoinId.Trim(), StringComparer.OrdinalIgnoreCase)
   .Where(x => x.Count() == 1)
   .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

  _byAlias = matchableItems.SelectMany(x => x.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => new { Alias = a.Trim(), Item = x }))
   .GroupBy(x => x.Alias, StringComparer.OrdinalIgnoreCase)
   .Where(x => x.Count() == 1)
   .ToDictionary(x => x.Key, x => x.First().Item, StringComparer.OrdinalIgnoreCase);

  _bySymbol = matchableItems.Where(x => !string.IsNullOrWhiteSpace(x.Symbol))
   .GroupBy(x => NormalizeSymbol(x.Symbol), StringComparer.OrdinalIgnoreCase)
   .ToDictionary(x => x.Key, x => x.ToList(), StringComparer.OrdinalIgnoreCase);
 }

 UnlockProviderResult Found(UnlockInfo data)
 {
  Summary.CandidateMatches++;
  return new UnlockProviderResult
  {
   Status = _cacheExpired ? "CACHE_EXPIRED" : "FOUND",
   Data = data,
   SourcePath = _cachePath,
   IsExpired = _cacheExpired
  };
 }

 bool IsExpired(UnlockCacheDocument document)
 {
  var now = DateTimeOffset.Now;
  if (document.ExpiresAt.HasValue) return document.ExpiresAt.Value <= now;
  var maxAge = document.MaxCacheAgeHours.GetValueOrDefault(_defaultMaxCacheAgeHours);
  return document.UpdatedAt.HasValue && document.UpdatedAt.Value.AddHours(maxAge) <= now;
 }

 static bool IsValid(UnlockInfo item)
 {
  if (string.IsNullOrWhiteSpace(item.CoinId) && string.IsNullOrWhiteSpace(item.Symbol)) return false;
  if (!ValidPct(item.Unlock30dPct) || !ValidPct(item.Unlock90dPct)) return false;
  if (item.NextUnlockAt.HasValue && item.NextUnlockAt.Value < DateTimeOffset.Now.AddDays(-1)) return false;
  return true;
 }

 static bool ValidPct(decimal? value) => !value.HasValue || value.Value is >= 0m and <= 100m;

 static string NormalizeSymbol(string symbol) => new(symbol.Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());

 static bool IsNonStandardSymbol(string symbol) => symbol.Any(c => !char.IsAsciiLetterOrDigit(c));

 static string ResolveCachePath()
 {
  var local = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CryptoScanner.Desktop", "data", "unlock-cache.json");
  if (File.Exists(local)) return local;
  var paths = new[]
  {
   local,
   Path.Combine(AppContext.BaseDirectory, "config", "unlock-cache.json"),
   Path.Combine(Environment.CurrentDirectory, "config", "unlock-cache.json")
  };
  return paths.FirstOrDefault(File.Exists) ?? local;
 }
}
