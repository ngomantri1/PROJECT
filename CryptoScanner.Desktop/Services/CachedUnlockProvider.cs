using System.IO;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public sealed class CachedUnlockProvider
{
 readonly int _defaultMaxCacheAgeHours;
 bool _loaded;
 bool _loadAttempted;
 bool _cacheExpired;
 string _loadStatus = "CACHE_MISSING";
 string _cachePath = "";
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
   Summary.Warning = $"unlock-cache.json not found. Expected path: {AppPaths.UnlockCachePath}";
   _loadStatus = "CACHE_MISSING";
   AppLogger.Info($"Unlock cache not found; scanner continues with UNLOCK_UNKNOWN. expectedPath={AppPaths.UnlockCachePath}");
   return;
  }

  try
  {
   var inspection = await new UnlockCacheInspector(_defaultMaxCacheAgeHours).InspectFileAsync(_cachePath, strictImport: false, ct);
   CopySummary(inspection.Summary);
   if (!inspection.Success)
   {
    _loadStatus = "INVALID_ITEM";
    AppLogger.Warn("Unlock cache invalid: " + inspection.Message);
    return;
   }

   _cacheExpired = inspection.Summary.IsExpired;
   BuildIndexes(inspection.ValidItems);
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

 void CopySummary(UnlockCacheSummary source)
 {
  Summary.Path = source.Path;
  Summary.Loaded = source.Loaded;
  Summary.SchemaVersion = source.SchemaVersion;
  Summary.UpdatedAt = source.UpdatedAt;
  Summary.IsExpired = source.IsExpired;
  Summary.ItemsTotal = source.ItemsTotal;
  Summary.ItemsValid = source.ItemsValid;
  Summary.ItemsInvalid = source.ItemsInvalid;
  Summary.DuplicateCoinIds = source.DuplicateCoinIds;
  Summary.DuplicateSymbols = source.DuplicateSymbols;
  Summary.Warning = source.Warning;
 }

 void BuildIndexes(List<UnlockInfo> validItems)
 {
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

 static string NormalizeSymbol(string symbol) => UnlockCacheInspector.NormalizeSymbol(symbol);

 static bool IsNonStandardSymbol(string symbol) => symbol.Any(c => !char.IsAsciiLetterOrDigit(c));

 static string ResolveCachePath()
 {
  return AppPaths.UnlockCachePath;
 }
}
