using System.IO;
using System.Text.Json;
using CryptoScanner.Desktop.Models;
namespace CryptoScanner.Desktop.Services;
public sealed class ExportService
{
 public static string ExportDirectory { get; } = Path.Combine(
  Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
  "CryptoScanner.Desktop",
  "exports");

 public async Task<string> ExportAsync(IEnumerable<ScanResult> results,string btcRegime,int coinsScanned,CancellationToken ct=default)
 {
  Directory.CreateDirectory(ExportDirectory);
  var items=results.ToList();
  var settings=LoadSettings();
  var path=Path.Combine(ExportDirectory,$"market_snapshot_{DateTime.Now:yyyy-MM-dd_HHmm}.json");
  var payload=new
  {
   schema_version="2.1",
   scanner_version="1.1.0",
   generated_at=DateTimeOffset.Now,
   btc_regime=btcRegime,
   data_sources=new
   {
    coingecko="PASS",
    binance="PASS",
    unlock="NOT_CONFIGURED",
    github="NOT_CONFIGURED",
    defillama="NOT_CONFIGURED",
    news="NOT_CONFIGURED"
   },
   scanner_config=new
   {
    min_total_volume_usd=settings.MinTotalVolumeUsd,
    min_binance_quote_volume_usd=settings.MinBinanceQuoteVolumeUsd,
    reject_binance_quote_volume_usd=settings.RejectBinanceQuoteVolumeUsd,
    market_cap_min_usd=settings.MinMarketCapUsd,
    market_cap_max_usd=settings.MaxMarketCapUsd,
    max_fdv_market_cap_ratio=settings.MaxFdvMarketCapRatio,
    min_circulating_ratio=settings.MinCirculatingRatio,
    active_scan_profile=settings.ActiveScanProfile,
    max_technical_candidates=GetMaxTechnicalCandidates(settings)
   },
   filter_summary=new
   {
    coins_scanned=coinsScanned,
    candidates=items.Count,
    buy_ready=items.Count(x=>x.Status=="BUY_READY"),
    watchlist_priority=items.Count(x=>x.Status=="WATCHLIST_PRIORITY"),
    watchlist=items.Count(x=>x.Status=="WATCHLIST"),
    needs_data=items.Count(x=>x.Status=="NEEDS_DATA"),
    rejected=items.Count(x=>x.Status=="REJECT")
   },
   candidates=items
  };
  await File.WriteAllTextAsync(path,JsonSerializer.Serialize(payload,new JsonSerializerOptions{WriteIndented=true}),ct);
  AppLogger.Info("Exported market snapshot: "+path);
  return path;
 }

 static ScannerSettings LoadSettings()
 {
  var paths=new[]
  {
   Path.Combine(AppContext.BaseDirectory,"config","scanner-settings.json"),
   Path.Combine(Environment.CurrentDirectory,"config","scanner-settings.json")
  };
  var path=paths.FirstOrDefault(File.Exists);
  if(path is null) return new ScannerSettings();
  try
  {
   var json=File.ReadAllText(path);
   return JsonSerializer.Deserialize<ScannerSettings>(json,new JsonSerializerOptions{PropertyNameCaseInsensitive=true})??new ScannerSettings();
  }
  catch(Exception ex)
  {
   AppLogger.Error("Export settings load failed; using default settings",ex);
   return new ScannerSettings();
  }
 }

 static int GetMaxTechnicalCandidates(ScannerSettings settings)
 {
  if(settings.ScanProfiles.TryGetValue(settings.ActiveScanProfile,out var profile)&&profile.MaxTechnicalCandidates>0) return profile.MaxTechnicalCandidates;
  return settings.MaxTechnicalCandidates;
 }
}
