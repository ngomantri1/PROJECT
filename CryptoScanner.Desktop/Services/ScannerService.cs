using System.IO;
using System.Text.Json;
using CryptoScanner.Desktop.Models;
namespace CryptoScanner.Desktop.Services;
public sealed class ScannerService
{
 readonly CoinGeckoClient _cg=new(); readonly BinanceClient _bn=new(); readonly TechnicalAnalysisService _ta=new(); readonly ScannerSettings _settings=LoadSettings();
 public async Task<(List<ScanResult> Results,int Scanned,string BtcRegime,ScanPipelineMetrics Metrics,UnlockCacheSummary UnlockCache)> ScanAsync(IProgress<(double,string)> progress,CancellationToken ct)
 {
  AppLogger.Info("Scan started");
  var unlockProvider=new CachedUnlockProvider(_settings.UnlockRules.MaxCacheAgeHours);
  progress.Report((3,"Đang lấy dữ liệu CoinGecko...")); var markets=await _cg.GetMarketsAsync(ct);
  AppLogger.Info($"CoinGecko markets loaded: {markets.Count}");
  var excluded=markets.Where(IsExcluded).ToList();
  if(excluded.Count>0) AppLogger.Info($"Excluded before hard filter: {excluded.Count}");
  var filtered=markets.Where(x=>!IsExcluded(x)).Where(x=>x.MarketCap>=_settings.MinMarketCapUsd&&x.MarketCap<=_settings.MaxMarketCapUsd&&x.TotalVolume>=_settings.MinTotalVolumeUsd)
   .Where(x=>x.Fdv is null||x.MarketCap==0||x.Fdv.Value/x.MarketCap<=_settings.MaxFdvMarketCapRatio)
   .Where(x=>x.TotalSupply is null||x.TotalSupply==0||x.CirculatingSupply is null||x.CirculatingSupply/x.TotalSupply>=_settings.MinCirculatingRatio).ToList();
  AppLogger.Info($"Hard filter passed: {filtered.Count}");
  progress.Report((15,$"Qua bộ lọc cứng: {filtered.Count} coin. Đang kiểm tra Binance..."));
  var tickers=await _bn.GetTickersAsync(ct);
  var maxCandidates=GetMaxTechnicalCandidates();
  var binanceMatched=filtered.Count(x=>tickers.ContainsKey(x.Symbol.ToUpperInvariant()+"USDT"));
  var selectedCandidates=filtered
   .Where(x=>tickers.ContainsKey(x.Symbol.ToUpperInvariant()+"USDT"))
   .Select(x=>new{Coin=x,Pair=x.Symbol.ToUpperInvariant()+"USDT",PreTechnicalScore=PreTechnicalScore(x,tickers[x.Symbol.ToUpperInvariant()+"USDT"].QuoteVolume)})
   .OrderByDescending(x=>x.PreTechnicalScore)
   .ThenByDescending(x=>x.Coin.TotalVolume)
   .ThenByDescending(x=>tickers[x.Pair].QuoteVolume)
   .Take(maxCandidates)
   .ToList();
  var tradable=selectedCandidates.Select(x=>x.Coin).ToList();
  AppLogger.Info($"Binance tickers loaded: {tickers.Count}; profile={_settings.ActiveScanProfile}; maxCandidates={maxCandidates}; technical candidates: {tradable.Count}");
  AppLogger.Info("Selected technical candidates by pre-rank: "+string.Join(", ",selectedCandidates.Select(x=>$"{x.Pair}:{x.PreTechnicalScore}")));
  var regime="UNKNOWN"; var btcCloses=new List<decimal>();
  try{btcCloses=await _bn.GetClosesAsync("BTCUSDT","1d",220,ct); if(btcCloses.Count>200){var e50=_ta.Ema(btcCloses,50);var e200=_ta.Ema(btcCloses,200);regime=btcCloses[^1]>e50&&e50>e200?"BULL":btcCloses[^1]<e200?"BEAR":"SIDEWAY";}}catch(Exception ex) when (ex is not OperationCanceledException){AppLogger.Error("BTC regime failed",ex);}
  var results=new List<ScanResult>(); int i=0; int skippedCandidates=0;
  foreach(var coin in tradable)
  {
   ct.ThrowIfCancellationRequested(); i++; var pair=coin.Symbol.ToUpperInvariant()+"USDT";
   progress.Report((15+80d*i/Math.Max(1,tradable.Count),$"Phân tích {pair} ({i}/{tradable.Count})..."));
   try
   {
    var h4=await _bn.GetClosesAsync(pair,"4h",_settings.CandleLimit,ct); var d1=await _bn.GetClosesAsync(pair,"1d",_settings.CandleLimit,ct);
    var r4=_ta.Rsi(h4); var r1=_ta.Rsi(d1); var setup=_ta.DetectSetup(h4,d1,r4);
    var e20H4=h4.Count>=20?_ta.Ema(h4,20):(decimal?)null; var e50H4=h4.Count>=50?_ta.Ema(h4,50):(decimal?)null; var e200D1=d1.Count>=200?_ta.Ema(d1,200):(decimal?)null;
    var macdH4=_ta.MacdTrend(h4); var relativePerformanceVsBtc30dPct=_ta.RelativePerformanceVsBtc30dPct(d1,btcCloses);
    var fdvMc=coin.Fdv.HasValue&&coin.MarketCap>0?coin.Fdv.Value/coin.MarketCap:1m;
    var circ=coin.TotalSupply.HasValue&&coin.TotalSupply>0&&coin.CirculatingSupply.HasValue?coin.CirculatingSupply.Value/coin.TotalSupply.Value:0m;
    var volumeMc=coin.MarketCap>0?coin.TotalVolume/coin.MarketCap:0m;
    int score=0; score+=coin.MarketCap<=600_000_000?12:9; score+=coin.TotalVolume>=_settings.MinStrongVolumeUsd?12:8; score+=tickers[pair].QuoteVolume>=_settings.MinBinanceQuoteVolumeUsd?14:tickers[pair].QuoteVolume>=_settings.RejectBinanceQuoteVolumeUsd?8:0;
    score+=fdvMc<=2.5m?10:6; score+=circ>=0.6m?10:6; score+=e20H4.HasValue&&e50H4.HasValue&&e20H4>e50H4?10:4; score+=e200D1.HasValue&&d1[^1]>e200D1?10:4;
    score+=macdH4=="BULLISH"?8:macdH4=="NEUTRAL"?4:0; score+=relativePerformanceVsBtc30dPct is > 10m?10:relativePerformanceVsBtc30dPct is > 0m?6:relativePerformanceVsBtc30dPct is < -15m?0:3;
    score+=setup=="BREAKOUT_CANDIDATE"?14:setup=="EARLY_REVERSAL"?9:4;
    var preliminaryScore=Math.Min(score,100);
    var passRules=new List<string>{"COINGECKO_MARKET_DATA","BINANCE_SPOT_PAIR"};
    var failRules=new List<string>();
    var unknownRules=new List<string>{"UNLOCK_UNKNOWN","GITHUB_UNKNOWN","TVL_UNKNOWN","NEWS_UNKNOWN","HOLDER_CONCENTRATION_UNKNOWN","LEGAL_RISK_UNKNOWN"};
    var riskFlags=new List<string>();
    var unlockProviderResult=await unlockProvider.GetAsync(coin.Id,coin.Symbol,ct);
    var unlockRule=UnlockRuleEvaluator.Evaluate(unlockProviderResult,_settings.UnlockRules);
    if(unlockRule.HasValidData)
    {
     unknownRules.Remove("UNLOCK_UNKNOWN");
     passRules.AddRange(unlockRule.PassRules);
     failRules.AddRange(unlockRule.FailRules);
     riskFlags.AddRange(unlockRule.RiskFlags);
    }
    else
    {
     riskFlags.AddRange(unlockRule.RiskFlags);
     foreach(var rule in unlockRule.UnknownRules.Where(x=>!unknownRules.Contains(x))) unknownRules.Add(rule);
    }
    if(IsNonStandardSymbol(coin.Symbol)){riskFlags.Add("NON_STANDARD_SYMBOL"); failRules.Add("NON_STANDARD_SYMBOL_REVIEW_REQUIRED");}
    if(tickers[pair].QuoteVolume<_settings.RejectBinanceQuoteVolumeUsd) failRules.Add("BINANCE_VOLUME_TOO_LOW");
    else if(tickers[pair].QuoteVolume<_settings.MinBinanceQuoteVolumeUsd) riskFlags.Add("LOW_LIQUIDITY");
    else passRules.Add("BINANCE_VOLUME_PASS");
    if(setup=="INSUFFICIENT") unknownRules.Add("TECHNICAL_DATA_INSUFFICIENT");
    if(regime=="BEAR") riskFlags.Add("BTC_BEAR_REGIME");
    if(setup=="EARLY_REVERSAL" && r1>70) riskFlags.Add("EARLY_REVERSAL_D1_RSI_OVERBOUGHT");
    if(r1>=75||r4>=80) riskFlags.Add("EXTREME_OVERBOUGHT");
    if(volumeMc>=0.30m) riskFlags.Add("HIGH_VOLUME_TO_MARKET_CAP");
    if(e20H4.HasValue&&e50H4.HasValue&&e200D1.HasValue) passRules.Add("EMA_CALCULATED"); else unknownRules.Add("EMA_INSUFFICIENT");
    if(macdH4!="INSUFFICIENT") passRules.Add("MACD_CALCULATED"); else unknownRules.Add("MACD_INSUFFICIENT");
    if(relativePerformanceVsBtc30dPct.HasValue) passRules.Add("RELATIVE_STRENGTH_CALCULATED"); else unknownRules.Add("RELATIVE_STRENGTH_UNKNOWN");
    var sourceCoverageScore=Math.Min(100,55+unlockRule.SourceCoverageBonus);
    var fieldCompletenessScore=55;
    if(CategoryFor(coin)!="UNKNOWN") fieldCompletenessScore+=5; else unknownRules.Add("CATEGORY_UNKNOWN");
    if(coin.Fdv.HasValue) fieldCompletenessScore+=5; else unknownRules.Add("FDV_UNKNOWN");
    if(coin.TotalSupply.HasValue&&coin.CirculatingSupply.HasValue) fieldCompletenessScore+=5; else unknownRules.Add("SUPPLY_UNKNOWN");
    if(e20H4.HasValue&&e50H4.HasValue&&e200D1.HasValue) fieldCompletenessScore+=5;
    if(macdH4!="INSUFFICIENT") fieldCompletenessScore+=5;
    if(relativePerformanceVsBtc30dPct.HasValue) fieldCompletenessScore+=5;
    if(setup!="INSUFFICIENT") fieldCompletenessScore+=5;
    fieldCompletenessScore=Math.Min(fieldCompletenessScore,85);
    if(relativePerformanceVsBtc30dPct is <=0m) preliminaryScore=Math.Min(preliminaryScore,97);
    if(riskFlags.Count>0) preliminaryScore=Math.Min(preliminaryScore,95);
    var status=Decide(preliminaryScore,setup,regime,failRules,unknownRules,riskFlags);
    var decisionCode=DecisionCode(status,failRules,unknownRules,riskFlags);
    ApplyUnlockDecision(unlockRule,failRules,ref status,ref decisionCode);
    var entryReadinessScore=EntryReadinessScore(preliminaryScore,status,riskFlags,unknownRules,failRules);
    results.Add(new(){Id=coin.Id,Symbol=coin.Symbol.ToUpperInvariant(),Name=coin.Name,
     Category=CategoryFor(coin),Price=RoundPrice(coin.Price),MarketCap=Math.Round(coin.MarketCap,0),TotalVolume=Math.Round(coin.TotalVolume,0),BinanceQuoteVolume=Math.Round(tickers[pair].QuoteVolume,0),VolumeMarketCapRatio=Math.Round(volumeMc,4),
     FdvMcRatio=Math.Round(fdvMc,4),CirculatingRatio=Math.Round(circ,4),Rsi4H=Math.Round(r4,2),Rsi1D=Math.Round(r1,2),UnlockStatus=unlockRule.UnlockStatus,Unlock30dPct=unlockRule.Unlock30dPct,Unlock90dPct=unlockRule.Unlock90dPct,
     Ema20H4=RoundNullablePrice(e20H4),Ema50H4=RoundNullablePrice(e50H4),Ema200D1=RoundNullablePrice(e200D1),MacdH4=macdH4,RelativePerformanceVsBtc30dPct=relativePerformanceVsBtc30dPct.HasValue?Math.Round(relativePerformanceVsBtc30dPct.Value,2):null,
     BreakoutLevel=null,DistanceToBreakoutPct=null,VolumeRatio20=null,BreakoutConfirmed=false,RetestConfirmed=false,Setup=setup,Score=preliminaryScore,Status=status,Decision=status,DecisionCode=decisionCode,DecisionReason=DecisionReason(decisionCode,regime),
     DataQuality=sourceCoverageScore/100d,MarketTechnicalScore=preliminaryScore,EntryReadinessScore=entryReadinessScore,PreliminaryScore=preliminaryScore,FinalScore=null,SourceCoverageScore=sourceCoverageScore,FieldCompletenessScore=fieldCompletenessScore,DataQualityScore=Math.Min(sourceCoverageScore,fieldCompletenessScore),RiskFlags=riskFlags,PassRules=passRules,FailRules=failRules,UnknownRules=unknownRules,GeneratedAt=DateTimeOffset.Now});
    AppLogger.Info($"Coin analyzed: {pair}; preliminaryScore={preliminaryScore}; status={status}; setup={setup}; unlock={unlockRule.UnlockStatus}; sourceCoverage={sourceCoverageScore}; fieldCompleteness={fieldCompletenessScore}");
   } catch(Exception ex) when (ex is not OperationCanceledException)
   {
    skippedCandidates++;
    AppLogger.Error($"Coin skipped: {pair}; id={coin.Id}; name={coin.Name}", ex);
   }
   await Task.Delay(_settings.PerCoinDelayMs,ct);
  }
  results=results.OrderByDescending(x=>x.Score).ThenByDescending(x=>x.BinanceQuoteVolume).ToList(); for(int r=0;r<results.Count;r++)results[r].Rank=r+1;
  var metrics=new ScanPipelineMetrics
  {
   CoinsScanned=markets.Count,
   ExcludedBeforeHardFilter=excluded.Count,
   HardFilterPassed=filtered.Count,
   BinanceTickersLoaded=tickers.Count,
   BinancePairMatched=binanceMatched,
   MaxTechnicalCandidates=maxCandidates,
   TechnicalCandidates=tradable.Count,
   SuccessfulCandidates=results.Count,
   SkippedCandidates=skippedCandidates
  };
  AppLogger.Info($"Unlock cache summary: loaded={unlockProvider.Summary.Loaded}; valid={unlockProvider.Summary.ItemsValid}; invalid={unlockProvider.Summary.ItemsInvalid}; matches={unlockProvider.Summary.CandidateMatches}; missing={unlockProvider.Summary.CandidateMissing}; expired={unlockProvider.Summary.IsExpired}");
  AppLogger.Info($"Scan completed; results={results.Count}; btcRegime={regime}");
  progress.Report((100,"Hoàn tất.")); return (results,markets.Count,regime,metrics,unlockProvider.Summary);
 }

 int GetMaxTechnicalCandidates()
 {
  if(_settings.ScanProfiles.TryGetValue(_settings.ActiveScanProfile,out var profile)&&profile.MaxTechnicalCandidates>0) return profile.MaxTechnicalCandidates;
  return _settings.MaxTechnicalCandidates;
 }

 int PreTechnicalScore(CoinMarket coin,decimal binanceQuoteVolume)
 {
  var fdvMc=coin.Fdv.HasValue&&coin.MarketCap>0?coin.Fdv.Value/coin.MarketCap:3m;
  var circ=coin.TotalSupply.HasValue&&coin.TotalSupply>0&&coin.CirculatingSupply.HasValue?coin.CirculatingSupply.Value/coin.TotalSupply.Value:0m;
  var volumeMc=coin.MarketCap>0?coin.TotalVolume/coin.MarketCap:0m;
  var score=0;
  score+=coin.MarketCap<=600_000_000m?18:14;
  score+=coin.TotalVolume>=_settings.MinStrongVolumeUsd?18:12;
  score+=binanceQuoteVolume>=_settings.MinBinanceQuoteVolumeUsd?18:binanceQuoteVolume>=_settings.RejectBinanceQuoteVolumeUsd?10:0;
  score+=fdvMc<=2m?16:fdvMc<=_settings.MaxFdvMarketCapRatio?10:0;
  score+=circ>=0.60m?14:circ>=_settings.MinCirculatingRatio?8:0;
  score+=volumeMc>=0.08m?16:volumeMc>=0.04m?10:4;
  return Math.Min(score,100);
 }

 bool IsExcluded(CoinMarket coin)
 {
  var symbol=coin.Symbol.ToUpperInvariant();
  var id=coin.Id.ToLowerInvariant();
  if(_settings.StablecoinSymbols.Contains(symbol,StringComparer.OrdinalIgnoreCase)||_settings.StablecoinIds.Contains(id,StringComparer.OrdinalIgnoreCase)) return true;
  if(_settings.WrappedSymbols.Contains(symbol,StringComparer.OrdinalIgnoreCase)) return true;
  if(_settings.MemeSymbols.Contains(symbol,StringComparer.OrdinalIgnoreCase)) return true;
  if(_settings.HighRiskSymbols.Contains(symbol,StringComparer.OrdinalIgnoreCase)||_settings.HighRiskIds.Contains(id,StringComparer.OrdinalIgnoreCase)) return true;
  return coin.Price is >=0.98m and <=1.02m && coin.Name.Contains("USD",StringComparison.OrdinalIgnoreCase);
 }

 static string Decide(int preliminaryScore,string setup,string btcRegime,List<string> failRules,List<string> unknownRules,List<string> riskFlags)
 {
  if(failRules.Count>0) return "REJECT";
  if(setup=="INSUFFICIENT"||unknownRules.Contains("TECHNICAL_DATA_INSUFFICIENT")) return "NEEDS_DATA";
  if(riskFlags.Contains("EXTREME_OVERBOUGHT")) return preliminaryScore>=80?"WATCHLIST":"REJECT";
  if(preliminaryScore>=85&&setup!="WATCH"&&btcRegime!="BEAR"&&!unknownRules.Contains("UNLOCK_UNKNOWN")) return "BUY_READY";
  if(preliminaryScore>=80&&setup!="WATCH") return "WATCHLIST_PRIORITY";
  if(preliminaryScore>=75) return "WATCHLIST";
  return "REJECT";
 }

 static string DecisionCode(string status,List<string> failRules,List<string> unknownRules,List<string> riskFlags)
 {
  if(failRules.Contains("NON_STANDARD_SYMBOL_REVIEW_REQUIRED")) return "NON_STANDARD_SYMBOL_REVIEW_REQUIRED";
  if(failRules.Contains("BINANCE_VOLUME_TOO_LOW")) return "BINANCE_VOLUME_TOO_LOW";
  if(failRules.Contains("UNLOCK_30D_TOO_HIGH")||failRules.Contains("UNLOCK_90D_TOO_HIGH")) return "UNLOCK_FAIL";
  if(failRules.Count>0) return failRules[0];
  if(unknownRules.Contains("TECHNICAL_DATA_INSUFFICIENT")) return "NEEDS_MORE_TECHNICAL_DATA";
  if(riskFlags.Contains("EXTREME_OVERBOUGHT")) return "WAIT_PULLBACK";
  if(status=="REJECT") return "SCORE_BELOW_WATCHLIST_THRESHOLD";
  if(riskFlags.Contains("BTC_BEAR_REGIME")||unknownRules.Contains("UNLOCK_UNKNOWN")) return "WAIT_UNLOCK_AND_MARKET_CONFIRMATION";
  return status=="BUY_READY"?"READY_AFTER_FULL_CONFIRMATION":"PRELIMINARY_WATCH";
 }

 static void ApplyUnlockDecision(UnlockRuleResult unlockRule,List<string> failRules,ref string status,ref string decisionCode)
 {
  if(!unlockRule.IsFail) return;
  if(failRules.Contains("NON_STANDARD_SYMBOL_REVIEW_REQUIRED")||failRules.Contains("BINANCE_VOLUME_TOO_LOW")) return;
  status="REJECT";
  decisionCode="UNLOCK_FAIL";
 }

 static string DecisionReason(string code,string btcRegime)=>code switch
 {
  "UNLOCK_FAIL"=>"Unlock pressure is above the configured fail threshold.",
  "BINANCE_VOLUME_TOO_LOW"=>"Binance spot volume is below the reject threshold.",
  "NON_STANDARD_SYMBOL_REVIEW_REQUIRED"=>"Symbol is non-standard and requires manual review before inclusion.",
  "NEEDS_MORE_TECHNICAL_DATA"=>"Technical candle history is insufficient for a reliable setup.",
  "WAIT_PULLBACK"=>"RSI is extremely overbought; wait for pullback or confirmation.",
  "SCORE_BELOW_WATCHLIST_THRESHOLD"=>"Preliminary score is below the watchlist threshold.",
  "WAIT_UNLOCK_AND_MARKET_CONFIRMATION"=>$"Preliminary setup exists, but unlock data is unavailable and BTC regime is {btcRegime}.",
  _=>"Preliminary market and technical data only; final decision requires unlock, risk and fundamental checks."
 };

 static int EntryReadinessScore(int marketTechnicalScore,string status,List<string> riskFlags,List<string> unknownRules,List<string> failRules)
 {
  if(failRules.Count>0) return Math.Min(20,marketTechnicalScore);
  var score=marketTechnicalScore;
  if(status=="REJECT") score=Math.Min(score,35);
  if(status=="NEEDS_DATA") score=Math.Min(score,40);
  if(riskFlags.Contains("EXTREME_OVERBOUGHT")) score-=45;
  if(riskFlags.Contains("BTC_BEAR_REGIME")) score-=25;
  if(riskFlags.Contains("LOW_LIQUIDITY")) score-=10;
  if(riskFlags.Contains("HIGH_VOLUME_TO_MARKET_CAP")) score-=8;
  if(unknownRules.Contains("UNLOCK_UNKNOWN")) score-=15;
  return Math.Clamp(score,0,100);
 }

 static string CategoryFor(CoinMarket coin)
 {
  var symbol=coin.Symbol.ToUpperInvariant();
  return symbol switch
  {
   "INJ"=>"DeFi / Layer 1",
   "TIA"=>"Modular Blockchain",
   "ARB" or "OP" or "STRK"=>"Layer 2",
   "FET" or "VIRTUAL"=>"AI",
   "ENA"=>"DeFi / Synthetic Dollar",
   "RENDER"=>"DePIN / AI",
  "PYTH"=>"Oracle",
  "CRV"=>"DeFi",
   "APT" or "SUI" or "SEI"=>"Layer 1",
   "ETHFI"=>"Liquid Restaking",
   "XEC"=>"Payments / Layer 1",
   "CHZ"=>"Sports / Fan Tokens",
   "SUN"=>"DeFi",
   "JASMY"=>"IoT / Data",
   "BAT"=>"Advertising / Utility",
   "POL"=>"Layer 2",
   "DASH"=>"Payments",
   "GALA"=>"Gaming",
   "PENDLE"=>"DeFi / Yield",
   "CAKE"=>"DeFi / DEX",
   "ATOM"=>"Layer 1 / Interoperability",
  "LDO"=>"Liquid Staking",
  "GRT"=>"Data / Indexing",
  "RUNE"=>"DeFi / Cross-chain",
  "EGLD"=>"Layer 1",
  "JST"=>"DeFi",
  "JTO"=>"Liquid Staking / Solana",
  "EIGEN"=>"Restaking",
  "SYRUP"=>"RWA / DeFi Lending",
  "CVX"=>"DeFi",
  "SNX"=>"DeFi / Derivatives",
  _=>"UNKNOWN"
 };
}

 static bool IsNonStandardSymbol(string symbol)=>symbol.Any(c=>!char.IsAsciiLetterOrDigit(c));

 static decimal RoundPrice(decimal value)
 {
  if(value>=1m) return Math.Round(value,4);
  if(value>=0.01m) return Math.Round(value,6);
  return Math.Round(value,10);
 }

 static decimal? RoundNullablePrice(decimal? value)=>value.HasValue?RoundPrice(value.Value):null;

 static ScannerSettings LoadSettings()
 {
  var paths=new[]
  {
   Path.Combine(AppContext.BaseDirectory,"config","scanner-settings.json"),
   Path.Combine(Environment.CurrentDirectory,"config","scanner-settings.json")
  };
  var path=paths.FirstOrDefault(File.Exists);
  if(path is null)
  {
   AppLogger.Warn("scanner-settings.json not found; using default settings");
   return new ScannerSettings();
  }
  try
  {
   var json=File.ReadAllText(path);
   var settings=JsonSerializer.Deserialize<ScannerSettings>(json,new JsonSerializerOptions{PropertyNameCaseInsensitive=true})??new ScannerSettings();
   AppLogger.Info("Loaded scanner settings: "+path);
   return settings;
  }
  catch(Exception ex)
  {
   AppLogger.Error("Failed to load scanner settings; using default settings",ex);
   return new ScannerSettings();
  }
 }
}
