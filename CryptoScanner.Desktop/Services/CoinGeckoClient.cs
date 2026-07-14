using System.Diagnostics;
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
}
