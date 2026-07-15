using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using CryptoScanner.Desktop.Models;
namespace CryptoScanner.Desktop.Services;
public sealed class ExportService
{
 readonly IHistoryService _history=new HistoryService();

 public static string ExportDirectory { get; } = Path.Combine(
  Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
  "CryptoScanner.Desktop",
  "exports");

 public async Task<string> ExportAsync(IEnumerable<ScanResult> results,string btcRegime,int coinsScanned,ScanSessionMetadata? session=null,bool saveHistory=false,CancellationToken ct=default)
 {
  Directory.CreateDirectory(ExportDirectory);
  var items=results.ToList();
  var settings=LoadSettings();
  var generatedAt=DateTimeOffset.Now;
  var scanId=CreateScanId(generatedAt);
  var stamp=generatedAt.ToString("yyyy-MM-dd_HHmmss");
  var suffix=scanId.Split('_')[1];
  var path=Path.Combine(ExportDirectory,$"market_snapshot_{stamp}.json");
  path=Path.Combine(ExportDirectory,$"market_snapshot_{stamp}_{suffix}.json");
  var scannerLogPath=Path.Combine(ExportDirectory,$"scanner_log_{stamp}_{suffix}.json");
  var payload=new
  {
   schema_version="2.1",
   scanner_version="1.1.0",
   generated_at=generatedAt,
   btc_regime=btcRegime,
   data_sources=new
   {
   coingecko="PASS",
   binance="PASS",
    unlock=UnlockDataSourceStatus(session),
    github="NOT_CONFIGURED",
    defillama="NOT_CONFIGURED",
    news="NOT_CONFIGURED"
   },
   scanner_config=new
   {
    min_total_volume_usd=settings.MinTotalVolumeUsd,
    min_binance_quote_volume_usd=settings.MinBinanceQuoteVolumeUsd,
   reject_binance_quote_volume_usd=settings.RejectBinanceQuoteVolumeUsd,
   unlock_rules=new
   {
    warn_30d_pct=settings.UnlockRules.Warn30dPct,
    fail_30d_pct=settings.UnlockRules.Fail30dPct,
    warn_90d_pct=settings.UnlockRules.Warn90dPct,
    fail_90d_pct=settings.UnlockRules.Fail90dPct
   },
   market_cap_min_usd=settings.MinMarketCapUsd,
    market_cap_max_usd=settings.MaxMarketCapUsd,
    max_fdv_market_cap_ratio=settings.MaxFdvMarketCapRatio,
    min_circulating_ratio=settings.MinCirculatingRatio,
   active_scan_profile=settings.ActiveScanProfile,
   max_technical_candidates=GetMaxTechnicalCandidates(settings),
   data_quality_formula="MIN_SOURCE_AND_COMPLETENESS"
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
  var jsonOptions=new JsonSerializerOptions{WriteIndented=true};
  await File.WriteAllTextAsync(path,JsonSerializer.Serialize(payload,jsonOptions),ct);
  var historyState=BuildHistoryState(saveHistory,false,null,false,null);
  await WriteJsonAsync(scannerLogPath,BuildScannerLog(items,settings,btcRegime,coinsScanned,generatedAt,path,scannerLogPath,session,scanId,historyState),jsonOptions,ct);
  AppLogger.Info("Exported market snapshot: "+path);
  AppLogger.Info("Exported scanner log: "+scannerLogPath);
  if(saveHistory)
  {
   var historyResult=await _history.SaveAsync(path,scannerLogPath,BuildHistoryEntry(items,settings,btcRegime,coinsScanned,generatedAt,session,scanId),ct);
   historyState=BuildHistoryState(true,historyResult.Success,historyResult.LogRelativePath,historyResult.Success,historyResult.Warning);
   await WriteJsonAsync(scannerLogPath,BuildScannerLog(items,settings,btcRegime,coinsScanned,generatedAt,path,scannerLogPath,session,scanId,historyState),jsonOptions,ct);
   if(historyResult.Success&&historyResult.LogRelativePath is not null)
   {
    var updateResult=await _history.UpdateLogAsync(historyResult.LogRelativePath,scannerLogPath,ct);
    if(!updateResult.Success) AppLogger.Warn($"History log update failed: scanId={scanId}; warning={updateResult.Warning}");
   }
   if(historyResult.Success) AppLogger.Info($"Saved history entry: scanId={scanId}; snapshot={historyResult.SnapshotRelativePath}; log={historyResult.LogRelativePath}");
   else AppLogger.Warn($"History save failed: scanId={scanId}; warning={historyResult.Warning}");
  }
  return path;
 }

 static object BuildScannerLog(
  List<ScanResult> items,
  ScannerSettings settings,
  string btcRegime,
  int coinsScanned,
  DateTimeOffset generatedAt,
  string snapshotPath,
  string scannerLogPath,
  ScanSessionMetadata? session,
  string scanId,
  object historyState)
 {
  var priorityItems=items.Where(x=>x.Status=="WATCHLIST_PRIORITY").OrderBy(x=>x.Rank).ToList();
  return new
  {
   schema_version="1.0",
   scan_id=scanId,
   scan_status="COMPLETED",
   generated_at=generatedAt,
   purpose="Technical debug log for one scanner export. Does not replace market_snapshot.json.",
   files=new
   {
    market_snapshot=snapshotPath,
    scanner_log=scannerLogPath,
    daily_text_log=AppLogger.CurrentLogPath
   },
   runtime=new
   {
    machine=Environment.MachineName,
    app_base_directory=AppContext.BaseDirectory,
    export_directory=ExportDirectory,
    log_directory=AppLogger.LogDirectory
   },
   environment=new
   {
    app_version="1.1.0",
    dotnet=Environment.Version.ToString(),
    os=Environment.OSVersion.VersionString,
    is_64_bit_process=Environment.Is64BitProcess,
    current_directory=Environment.CurrentDirectory
   },
   history=historyState,
   unlock_cache_summary=BuildUnlockCacheSummary(session?.UnlockCache),
   scan_timing=session is null?null:new
   {
    scan_start=session.ScanStartedAt,
    scan_end=session.ScanEndedAt,
    elapsed_ms=session.ElapsedMs,
    elapsed_seconds=session.ElapsedSeconds
   },
   pipeline_counts=BuildPipelineCounts(items,coinsScanned,session),
   scan_summary=new
   {
    btc_regime=btcRegime,
    coins_scanned=coinsScanned,
    candidates=items.Count,
    buy_ready=items.Count(x=>x.Status=="BUY_READY"),
    watchlist_priority=items.Count(x=>x.Status=="WATCHLIST_PRIORITY"),
    watchlist=items.Count(x=>x.Status=="WATCHLIST"),
    needs_data=items.Count(x=>x.Status=="NEEDS_DATA"),
    rejected=items.Count(x=>x.Status=="REJECT")
   },
   priority_symbols=priorityItems.Select(x=>x.Symbol).ToList(),
   priority_candidates=priorityItems.Select(x=>new
   {
    x.Rank,
    x.Symbol,
    x.Name,
    x.DecisionCode,
    x.MarketTechnicalScore,
    x.EntryReadinessScore,
    x.DataQualityScore,
    x.Setup,
    x.RiskFlags
   }).ToList(),
   scanner_config=new
   {
    active_scan_profile=settings.ActiveScanProfile,
    max_technical_candidates=GetMaxTechnicalCandidates(settings),
    min_total_volume_usd=settings.MinTotalVolumeUsd,
    min_binance_quote_volume_usd=settings.MinBinanceQuoteVolumeUsd,
    reject_binance_quote_volume_usd=settings.RejectBinanceQuoteVolumeUsd,
    unlock_rules=new
    {
     warn_30d_pct=settings.UnlockRules.Warn30dPct,
     fail_30d_pct=settings.UnlockRules.Fail30dPct,
     warn_90d_pct=settings.UnlockRules.Warn90dPct,
     fail_90d_pct=settings.UnlockRules.Fail90dPct
    },
    market_cap_min_usd=settings.MinMarketCapUsd,
    market_cap_max_usd=settings.MaxMarketCapUsd,
    max_fdv_market_cap_ratio=settings.MaxFdvMarketCapRatio,
    min_circulating_ratio=settings.MinCirculatingRatio
   },
   decision_summary=CountBy(items,x=>x.DecisionCode),
   status_summary=CountBy(items,x=>x.Status),
   setup_summary=CountBy(items,x=>x.Setup),
   risk_flag_summary=CountMany(items,x=>x.RiskFlags),
   fail_rule_summary=CountMany(items,x=>x.FailRules),
   unknown_rule_summary=CountMany(items,x=>x.UnknownRules),
   data_quality_summary=new
   {
    min=items.Count==0?0:items.Min(x=>x.DataQualityScore),
    max=items.Count==0?0:items.Max(x=>x.DataQualityScore),
    average=items.Count==0?0:Math.Round(items.Average(x=>x.DataQualityScore),2),
    source_coverage_min=items.Count==0?0:items.Min(x=>x.SourceCoverageScore),
    source_coverage_max=items.Count==0?0:items.Max(x=>x.SourceCoverageScore),
    field_completeness_min=items.Count==0?0:items.Min(x=>x.FieldCompletenessScore),
    field_completeness_max=items.Count==0?0:items.Max(x=>x.FieldCompletenessScore)
   },
   warnings=BuildWarnings(items,btcRegime),
   candidates=items.Select(x=>new
   {
    x.Rank,
    x.Symbol,
    x.Name,
    x.Status,
    x.DecisionCode,
    x.DecisionReason,
    x.MarketTechnicalScore,
    x.EntryReadinessScore,
    x.DataQualityScore,
    x.Setup,
    x.BinanceQuoteVolume,
    x.RiskFlags,
    x.FailRules,
    x.UnknownRules
   })
  };
 }

 static object BuildHistoryState(bool enabled,bool saved,string? logPath,bool indexUpdated,string? warning)
 {
  return new
  {
   history_enabled=enabled,
   history_saved=saved,
   history_path=logPath,
   history_index_updated=indexUpdated,
   warning
  };
 }

 static object? BuildUnlockCacheSummary(UnlockCacheSummary? summary)
 {
  if(summary is null) return null;
  return new
  {
   path=summary.Path,
   loaded=summary.Loaded,
   schema_version=summary.SchemaVersion,
   updated_at=summary.UpdatedAt,
   is_expired=summary.IsExpired,
   items_total=summary.ItemsTotal,
   items_valid=summary.ItemsValid,
   items_invalid=summary.ItemsInvalid,
   candidate_matches=summary.CandidateMatches,
   candidate_missing=summary.CandidateMissing,
   duplicate_coin_ids=summary.DuplicateCoinIds,
   duplicate_symbols=summary.DuplicateSymbols,
   warning=summary.Warning
  };
 }

 static HistoryIndexEntry BuildHistoryEntry(List<ScanResult> items,ScannerSettings settings,string btcRegime,int coinsScanned,DateTimeOffset generatedAt,ScanSessionMetadata? session,string scanId)
 {
  return new HistoryIndexEntry
  {
   ScanId=scanId,
   SchemaVersion="2.1",
   ScannerVersion="1.1.0",
   ScanProfile=settings.ActiveScanProfile,
   GeneratedAt=generatedAt,
   BtcRegime=btcRegime,
   CoinsScanned=coinsScanned,
   Candidates=items.Count,
   PriorityCount=items.Count(x=>x.Status=="WATCHLIST_PRIORITY"),
   WatchCount=items.Count(x=>x.Status=="WATCHLIST"),
   RejectCount=items.Count(x=>x.Status=="REJECT"),
   ElapsedSeconds=session?.ElapsedSeconds,
   PrioritySymbols=items.Where(x=>x.Status=="WATCHLIST_PRIORITY").OrderBy(x=>x.Rank).Select(x=>x.Symbol).ToList(),
   WatchSymbols=items.Where(x=>x.Status=="WATCHLIST").OrderBy(x=>x.Rank).Take(20).Select(x=>x.Symbol).ToList(),
   ConfigFingerprint=HistoryService.ConfigFingerprint(settings)
  };
 }

 static string CreateScanId(DateTimeOffset generatedAt)=>generatedAt.ToString("yyyyMMddTHHmmss")+"_"+RandomNumberGenerator.GetHexString(4);

 static string UnlockDataSourceStatus(ScanSessionMetadata? session)
 {
  if(session?.UnlockCache is null) return "NOT_CONFIGURED";
  if(!session.UnlockCache.Loaded) return "CACHE_MISSING";
  if(session.UnlockCache.IsExpired) return "CACHE_EXPIRED";
  return session.UnlockCache.CandidateMatches>0?"LOCAL_CACHE":"LOCAL_CACHE_NO_MATCHES";
 }

 static async Task WriteJsonAsync(string path,object payload,JsonSerializerOptions options,CancellationToken ct)
 {
  var tempPath=path+".tmp";
  await File.WriteAllTextAsync(tempPath,JsonSerializer.Serialize(payload,options),ct);
  File.Move(tempPath,path,true);
 }

 static object BuildPipelineCounts(List<ScanResult> items,int coinsScanned,ScanSessionMetadata? session)
 {
  var pipeline=session?.Pipeline;
  return new
  {
   coins_scanned=pipeline?.CoinsScanned ?? coinsScanned,
   excluded_before_hard_filter=pipeline?.ExcludedBeforeHardFilter,
   hard_filter_passed=pipeline?.HardFilterPassed,
   binance_tickers_loaded=pipeline?.BinanceTickersLoaded,
   binance_pair_matched=pipeline?.BinancePairMatched,
   max_technical_candidates=pipeline?.MaxTechnicalCandidates,
   technical_candidates=pipeline?.TechnicalCandidates ?? items.Count,
   successful_candidates=pipeline?.SuccessfulCandidates ?? items.Count,
   skipped_candidates=pipeline?.SkippedCandidates,
   final_candidates=items.Count
  };
 }

 static List<object> BuildWarnings(List<ScanResult> items,string btcRegime)
 {
  var warnings=new List<object>();
  if(btcRegime=="BEAR"&&items.Any(x=>x.Status=="BUY_READY")) warnings.Add(new{code="BUY_READY_IN_BEAR_REGIME",count=items.Count(x=>x.Status=="BUY_READY")});
  var unknownUnlockBuyReady=items.Count(x=>x.Status=="BUY_READY"&&x.UnlockStatus=="UNKNOWN");
  if(unknownUnlockBuyReady>0) warnings.Add(new{code="BUY_READY_WITH_UNKNOWN_UNLOCK",count=unknownUnlockBuyReady});
  var nonStandardNotRejected=items.Count(x=>x.RiskFlags.Contains("NON_STANDARD_SYMBOL")&&x.Status!="REJECT");
  if(nonStandardNotRejected>0) warnings.Add(new{code="NON_STANDARD_SYMBOL_NOT_REJECTED",count=nonStandardNotRejected});
  return warnings;
 }

 static IReadOnlyList<object> CountBy(List<ScanResult> items,Func<ScanResult,string> selector)
 {
  return items.GroupBy(selector).OrderByDescending(x=>x.Count()).ThenBy(x=>x.Key).Select(x=>(object)new{key=x.Key,count=x.Count()}).ToList();
 }

 static IReadOnlyList<object> CountMany(List<ScanResult> items,Func<ScanResult,IEnumerable<string>> selector)
 {
  return items.SelectMany(selector).GroupBy(x=>x).OrderByDescending(x=>x.Count()).ThenBy(x=>x.Key).Select(x=>(object)new{key=x.Key,count=x.Count()}).ToList();
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
