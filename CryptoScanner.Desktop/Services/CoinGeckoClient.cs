using System.Diagnostics;
using System.Text.Json;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using CryptoScanner.Desktop.Models;
namespace CryptoScanner.Desktop.Services;
public sealed class CoinGeckoClient
{
 const int MaxAttempts = 3;
 static readonly TimeSpan[] RetryDelays = [TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(5)];
 readonly HttpClient _http = new(){ BaseAddress=new Uri("https://api.coingecko.com/api/v3/"), Timeout=TimeSpan.FromSeconds(30) };
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
    var batch=await GetJsonWithRetryAsync<List<CoinMarket>>(url,$"CoinGecko page {page}",ct)??[];
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

 async Task<T?> GetJsonWithRetryAsync<T>(string url,string operation,CancellationToken ct)
 {
  for(var attempt=1;attempt<=MaxAttempts;attempt++)
  {
   try
   {
    using var response=await _http.GetAsync(url,ct);
    if(!response.IsSuccessStatusCode)
    {
     throw new HttpRequestException(
      $"CoinGecko request failed: {(int)response.StatusCode} {response.ReasonPhrase}",
      null,
      response.StatusCode);
    }

    return await response.Content.ReadFromJsonAsync<T>(cancellationToken:ct);
   }
   catch(OperationCanceledException) when (ct.IsCancellationRequested)
   {
    throw;
   }
   catch(TaskCanceledException ex) when (attempt<MaxAttempts && !ct.IsCancellationRequested)
   {
    var delay=RetryDelays[Math.Min(attempt-1,RetryDelays.Length-1)];
    AppLogger.Warn($"{operation} timeout; attempt={attempt}/{MaxAttempts}; retryInMs={(int)delay.TotalMilliseconds}; {ex.Message}");
    await Task.Delay(delay,ct);
   }
   catch(Exception ex) when (attempt<MaxAttempts && ExternalApiError.IsTransient(ex))
   {
    var delay=GetRetryDelay(ex,attempt);
    AppLogger.Warn($"{operation} transient failure; attempt={attempt}/{MaxAttempts}; retryInMs={(int)delay.TotalMilliseconds}; {ex.Message}");
    await Task.Delay(delay,ct);
   }
  }

  using var finalResponse=await _http.GetAsync(url,ct);
  finalResponse.EnsureSuccessStatusCode();
  return await finalResponse.Content.ReadFromJsonAsync<T>(cancellationToken:ct);
 }

 static TimeSpan GetRetryDelay(Exception ex,int attempt)
 {
  var status=ExternalApiError.GetHttpStatusCode(ex);
  if(status==HttpStatusCode.TooManyRequests) return attempt==1 ? TimeSpan.FromSeconds(5) : TimeSpan.FromSeconds(10);
  return RetryDelays[Math.Min(attempt-1,RetryDelays.Length-1)];
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
