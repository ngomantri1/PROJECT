using System.IO;
using System.Text.Json;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public interface IHistoricalPriceProvider
{
 Task<HistoricalPriceResult> GetPriceAsync(string coinId,string symbol,DateTimeOffset targetTime,CancellationToken ct);
}

public sealed class HistoricalPriceProvider : IHistoricalPriceProvider
{
 readonly BinanceClient _binance = new();
 readonly CoinGeckoClient _coinGecko = new();

 static string CacheDirectory => Path.Combine(
  Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
  "CryptoScanner.Desktop",
  "backtests",
  "price-cache");

 public async Task<HistoricalPriceResult> GetPriceAsync(string coinId,string symbol,DateTimeOffset targetTime,CancellationToken ct)
 {
  if (!IsSupportedSymbol(symbol))
  {
   return new HistoricalPriceResult { Status = "UNSUPPORTED_SYMBOL", Warning = "Symbol contains unsupported characters." };
  }

  var cacheKey = BuildCacheKey(coinId, symbol, targetTime);
  var cached = await TryReadCacheAsync(cacheKey, ct);
  if (cached is not null) return cached;

  var binance = await TryGetBinancePriceAsync(symbol, targetTime, ct);
  if (binance.Status == "COMPLETED")
  {
   await WriteCacheAsync(cacheKey, binance, ct);
   return binance;
  }

  var coingecko = await TryGetCoinGeckoPriceAsync(coinId, symbol, targetTime, ct);
  var result = coingecko.Status == "COMPLETED" ? coingecko : binance;
  await WriteCacheAsync(cacheKey, result, ct);
  return result;
 }

 async Task<HistoricalPriceResult> TryGetBinancePriceAsync(string symbol,DateTimeOffset targetTime,CancellationToken ct)
 {
  var lookupSymbol = symbol.ToUpperInvariant() + "USDT";
  var rows = await _binance.GetKlineClosesAsync(lookupSymbol, "1d", targetTime.AddDays(-3), targetTime.AddDays(3), ct);
  var nearest = rows
   .OrderBy(x => Math.Abs((x.CloseTime - targetTime).TotalSeconds))
   .FirstOrDefault();
  if (nearest is null)
  {
   return new HistoricalPriceResult { Status = "PRICE_MISSING", Warning = "Binance kline not found." };
  }

  return new HistoricalPriceResult
  {
   Status = "COMPLETED",
   Point = new HistoricalPricePoint
   {
    Price = nearest.Close,
    PriceTime = nearest.CloseTime,
    Source = "BINANCE_KLINE",
    Match = "NEAREST_D1_CLOSE",
    LookupSymbol = lookupSymbol
   }
  };
 }

 async Task<HistoricalPriceResult> TryGetCoinGeckoPriceAsync(string coinId,string symbol,DateTimeOffset targetTime,CancellationToken ct)
 {
  if (string.IsNullOrWhiteSpace(coinId))
  {
   return new HistoricalPriceResult { Status = "PRICE_MISSING", Warning = "CoinGecko id is missing." };
  }

  var prices = await _coinGecko.GetMarketChartRangePricesAsync(coinId, targetTime.AddDays(-3), targetTime.AddDays(3), ct);
  var nearest = prices
   .OrderBy(x => Math.Abs((x.Time - targetTime).TotalSeconds))
   .FirstOrDefault();
  if (nearest == default)
  {
   return new HistoricalPriceResult { Status = "PRICE_MISSING", Warning = "CoinGecko range price not found." };
  }

  return new HistoricalPriceResult
  {
   Status = "COMPLETED",
   Point = new HistoricalPricePoint
   {
    Price = nearest.Price,
    PriceTime = nearest.Time,
    Source = "COINGECKO_RANGE",
    Match = "NEAREST_PRICE_POINT",
    LookupSymbol = string.IsNullOrWhiteSpace(coinId) ? symbol : coinId
   }
  };
 }

 static bool IsSupportedSymbol(string symbol)
 {
  return !string.IsNullOrWhiteSpace(symbol) && symbol.All(c => c is >= 'A' and <= 'Z' or >= '0' and <= '9');
 }

 static string BuildCacheKey(string coinId,string symbol,DateTimeOffset targetTime)
 {
  var id = string.IsNullOrWhiteSpace(coinId) ? "noid" : Sanitize(coinId);
  return $"{id}_{Sanitize(symbol)}_{targetTime:yyyyMMdd}.json";
 }

 static string Sanitize(string text)
 {
  return new string(text.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
 }

 static async Task<HistoricalPriceResult?> TryReadCacheAsync(string cacheKey,CancellationToken ct)
 {
  var path = Path.Combine(CacheDirectory, cacheKey);
  if (!File.Exists(path)) return null;

  try
  {
   await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
   return await JsonSerializer.DeserializeAsync<HistoricalPriceResult>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   AppLogger.Warn("Backtest price cache read failed: " + path + "; " + ex.Message);
   return null;
  }
 }

 static async Task WriteCacheAsync(string cacheKey,HistoricalPriceResult result,CancellationToken ct)
 {
  try
  {
   Directory.CreateDirectory(CacheDirectory);
   var path = Path.Combine(CacheDirectory, cacheKey);
   var tempPath = path + ".tmp";
   await File.WriteAllTextAsync(tempPath, JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }), ct);
   File.Move(tempPath, path, true);
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   AppLogger.Warn("Backtest price cache write failed: " + cacheKey + "; " + ex.Message);
  }
 }
}
