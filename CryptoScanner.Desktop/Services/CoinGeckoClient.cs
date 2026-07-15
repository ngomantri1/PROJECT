using System.Diagnostics;
using System.Text.Json;
using System.Net.Http;
using System.Net.Http.Json;
using CryptoScanner.Desktop.Models;
namespace CryptoScanner.Desktop.Services;
public sealed class CoinGeckoClient
{
 readonly HttpClient _http = new(){ BaseAddress=new Uri("https://api.coingecko.com/api/v3/") };
 public CoinGeckoClient(){_http.DefaultRequestHeaders.UserAgent.ParseAdd("CryptoScannerDesktop/1.0");}
 public async Task<List<CoinMarket>> GetMarketsAsync(CancellationToken ct)
 {
  var sw=Stopwatch.StartNew();
  AppLogger.Info("CoinGecko markets request started");
  var all=new List<CoinMarket>();
  try
  {
   for(int page=1;page<=5;page++)
   {
    var url=$"coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page={page}&sparkline=false";
    AppLogger.Info($"CoinGecko page {page} request: {url}");
    var batch=await _http.GetFromJsonAsync<List<CoinMarket>>(url,ct)??[];
    all.AddRange(batch);
    AppLogger.Info($"CoinGecko page {page} loaded: count={batch.Count}; total={all.Count}");
    if(batch.Count<250) break;
    await Task.Delay(350,ct);
   }
   AppLogger.Info($"CoinGecko markets request completed: total={all.Count}; elapsedMs={sw.ElapsedMilliseconds}");
   return all;
  }
  catch(OperationCanceledException)
  {
   AppLogger.Warn($"CoinGecko markets request canceled; total={all.Count}; elapsedMs={sw.ElapsedMilliseconds}");
   throw;
  }
  catch(Exception ex)
  {
   AppLogger.Error($"CoinGecko markets request failed; total={all.Count}; elapsedMs={sw.ElapsedMilliseconds}",ex);
   throw;
  }
 }

 public async Task<List<(DateTimeOffset Time, decimal Price)>> GetMarketChartRangePricesAsync(string coinId,DateTimeOffset from,DateTimeOffset to,CancellationToken ct)
 {
  var sw=Stopwatch.StartNew();
  var url=$"coins/{Uri.EscapeDataString(coinId)}/market_chart/range?vs_currency=usd&from={from.ToUnixTimeSeconds()}&to={to.ToUnixTimeSeconds()}";
  AppLogger.Info($"CoinGecko range price request started: coinId={coinId}");
  try
  {
   using var stream=await _http.GetStreamAsync(url,ct);
   using var doc=await JsonDocument.ParseAsync(stream,cancellationToken:ct);
   var result=new List<(DateTimeOffset Time, decimal Price)>();
   if(doc.RootElement.TryGetProperty("prices",out var prices)&&prices.ValueKind==JsonValueKind.Array)
   {
    foreach(var item in prices.EnumerateArray())
    {
     if(item.ValueKind!=JsonValueKind.Array||item.GetArrayLength()<2) continue;
     var time=DateTimeOffset.FromUnixTimeMilliseconds(item[0].GetInt64());
     if(item[1].TryGetDecimal(out var price)) result.Add((time,price));
    }
   }
   AppLogger.Info($"CoinGecko range price request completed: coinId={coinId}; points={result.Count}; elapsedMs={sw.ElapsedMilliseconds}");
   return result;
  }
  catch(OperationCanceledException)
  {
   AppLogger.Warn($"CoinGecko range price request canceled: coinId={coinId}; elapsedMs={sw.ElapsedMilliseconds}");
   throw;
  }
  catch(Exception ex)
  {
   AppLogger.Warn($"CoinGecko range price request failed: coinId={coinId}; elapsedMs={sw.ElapsedMilliseconds}; {ex.Message}");
   return [];
  }
 }
}
