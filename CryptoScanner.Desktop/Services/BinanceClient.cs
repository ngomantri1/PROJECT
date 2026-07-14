using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using CryptoScanner.Desktop.Models;
namespace CryptoScanner.Desktop.Services;
public sealed class BinanceClient
{
 readonly HttpClient _http=new(){BaseAddress=new Uri("https://api.binance.com/api/v3/")};
 public async Task<Dictionary<string,BinanceTicker>> GetTickersAsync(CancellationToken ct)
 {
  var sw=Stopwatch.StartNew();
  AppLogger.Info("Binance ticker request started: ticker/24hr");
  try
  {
   var list=await _http.GetFromJsonAsync<List<BinanceTicker>>("ticker/24hr",ct)??[];
   var tickers=list.Where(x=>x.Symbol.EndsWith("USDT",StringComparison.OrdinalIgnoreCase)).ToDictionary(x=>x.Symbol,StringComparer.OrdinalIgnoreCase);
   AppLogger.Info($"Binance ticker request completed: raw={list.Count}; usdt={tickers.Count}; elapsedMs={sw.ElapsedMilliseconds}");
   return tickers;
  }
  catch(OperationCanceledException)
  {
   AppLogger.Warn($"Binance ticker request canceled; elapsedMs={sw.ElapsedMilliseconds}");
   throw;
  }
  catch(Exception ex)
  {
   AppLogger.Error($"Binance ticker request failed; elapsedMs={sw.ElapsedMilliseconds}",ex);
   throw;
  }
 }
 public async Task<List<decimal>> GetClosesAsync(string symbol,string interval,int limit,CancellationToken ct)
 {
  var sw=Stopwatch.StartNew();
  var url=$"klines?symbol={symbol}&interval={interval}&limit={limit}";
  AppLogger.Info($"Binance klines request started: {url}");
  try
  {
   using var s=await _http.GetStreamAsync(url,ct);
   using var doc=await JsonDocument.ParseAsync(s,cancellationToken:ct); var result=new List<decimal>();
   foreach(var row in doc.RootElement.EnumerateArray()) if(decimal.TryParse(row[4].GetString(),System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out var close)) result.Add(close);
   AppLogger.Info($"Binance klines request completed: symbol={symbol}; interval={interval}; closes={result.Count}; elapsedMs={sw.ElapsedMilliseconds}");
   return result;
  }
  catch(OperationCanceledException)
  {
   AppLogger.Warn($"Binance klines request canceled: symbol={symbol}; interval={interval}; elapsedMs={sw.ElapsedMilliseconds}");
   throw;
  }
  catch(Exception ex)
  {
   AppLogger.Error($"Binance klines request failed: symbol={symbol}; interval={interval}; elapsedMs={sw.ElapsedMilliseconds}",ex);
   throw;
  }
 }
}
