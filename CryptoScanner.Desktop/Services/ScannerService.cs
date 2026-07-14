using System.IO;
using System.Text.Json;
using CryptoScanner.Desktop.Models;
namespace CryptoScanner.Desktop.Services;
public sealed class ScannerService
{
 readonly CoinGeckoClient _cg=new(); readonly BinanceClient _bn=new(); readonly TechnicalAnalysisService _ta=new(); readonly ScannerSettings _settings=LoadSettings();
 public async Task<(List<ScanResult> Results,int Scanned,string BtcRegime)> ScanAsync(IProgress<(double,string)> progress,CancellationToken ct)
 {
  AppLogger.Info("Scan started");
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
  var results=new List<ScanResult>(); int i=0;
  foreach(var coin in tradable)
  {
   ct.ThrowIfCancellationRequested(); i++; var pair=coin.Symbol.ToUpperInvariant()+"USDT";
   progress.Report((15+80d*i/Math.Max(1,tradable.Count),$"Phân tích {pair} ({i}/{tradable.Count})..."));
   try
   {
    var h4=await _bn.GetClosesAsync(pair,"4h",_settings.CandleLimit,ct); var d1=await _bn.GetClosesAsync(pair,"1d",_settings.CandleLimit,ct);
    var r4=_ta.Rsi(h4); var r1=_ta.Rsi(d1); var setup=_ta.DetectSetup(h4,d1,r4);
    var e20H4=h4.Count>=20?_ta.Ema(h4,20):(decimal?)null; var e50H4=h4.Count>=50?_ta.Ema(h4,50):(decimal?)null; var e200D1=d1.Count>=200?_ta.Ema(d1,200):(decimal?)null;
    var macdH4=_ta.MacdTrend(h4); var rsBtc30d=_ta.RelativeStrength30d(d1,btcCloses);
    var fdvMc=coin.Fdv.HasValue&&coin.MarketCap>0?coin.Fdv.Value/coin.MarketCap:1m;
    var circ=coin.TotalSupply.HasValue&&coin.TotalSupply>0&&coin.CirculatingSupply.HasValue?coin.CirculatingSupply.Value/coin.TotalSupply.Value:0m;
    int score=0; score+=coin.MarketCap<=600_000_000?10:8; score+=coin.TotalVolume>=_settings.MinStrongVolumeUsd?10:7; score+=fdvMc<=2.5m?10:7; score+=circ>=0.6m?10:7;
    score+=tickers[pair].QuoteVolume>=_settings.MinBinanceQuoteVolumeUsd?15:8; score+=setup=="TREND_BREAKOUT"?25:setup=="EARLY_REVERSAL"?20:10; score+=r4 is >=40 and <=65?10:5; score+=10;
    var preliminaryScore=Math.Min(score,100);
    var passRules=new List<string>{"COINGECKO_MARKET_DATA","BINANCE_SPOT_PAIR"};
    var failRules=new List<string>();
    var unknownRules=new List<string>{"UNLOCK_UNKNOWN","GITHUB_UNKNOWN","TVL_UNKNOWN","NEWS_UNKNOWN","HOLDER_CONCENTRATION_UNKNOWN","LEGAL_RISK_UNKNOWN"};
    var riskFlags=new List<string>();
    if(tickers[pair].QuoteVolume<_settings.RejectBinanceQuoteVolumeUsd) failRules.Add("BINANCE_VOLUME_TOO_LOW");
    else if(tickers[pair].QuoteVolume<_settings.MinBinanceQuoteVolumeUsd) riskFlags.Add("LOW_LIQUIDITY");
    else passRules.Add("BINANCE_VOLUME_PASS");
    if(setup=="INSUFFICIENT") unknownRules.Add("TECHNICAL_DATA_INSUFFICIENT");
    if(regime=="BEAR") riskFlags.Add("BTC_BEAR_REGIME");
    if(setup=="EARLY_REVERSAL" && r1>70) riskFlags.Add("EARLY_REVERSAL_D1_RSI_OVERBOUGHT");
    if(r1>=75||r4>=80) riskFlags.Add("EXTREME_OVERBOUGHT");
    if(e20H4.HasValue&&e50H4.HasValue&&e200D1.HasValue) passRules.Add("EMA_CALCULATED"); else unknownRules.Add("EMA_INSUFFICIENT");
    if(macdH4!="INSUFFICIENT") passRules.Add("MACD_CALCULATED"); else unknownRules.Add("MACD_INSUFFICIENT");
    if(rsBtc30d.HasValue) passRules.Add("RELATIVE_STRENGTH_CALCULATED"); else unknownRules.Add("RELATIVE_STRENGTH_UNKNOWN");
    var qualityScore=45;
    if(coin.Fdv.HasValue) qualityScore+=5; else unknownRules.Add("FDV_UNKNOWN");
    if(coin.TotalSupply.HasValue&&coin.CirculatingSupply.HasValue) qualityScore+=5; else unknownRules.Add("SUPPLY_UNKNOWN");
    qualityScore=Math.Min(qualityScore,55);
    var status=Decide(preliminaryScore,setup,regime,failRules,unknownRules,riskFlags);
    var decisionCode=DecisionCode(status,failRules,unknownRules,riskFlags);
    results.Add(new(){Id=coin.Id,Symbol=coin.Symbol.ToUpperInvariant(),Name=coin.Name,Price=coin.Price,MarketCap=coin.MarketCap,TotalVolume=coin.TotalVolume,
     Category=CategoryFor(coin),BinanceQuoteVolume=tickers[pair].QuoteVolume,FdvMcRatio=fdvMc,CirculatingRatio=circ,Rsi4H=r4,Rsi1D=r1,UnlockStatus="UNKNOWN",
     Ema20H4=e20H4,Ema50H4=e50H4,Ema200D1=e200D1,MacdH4=macdH4,RelativeStrengthBtc30d=rsBtc30d,Setup=setup,Score=preliminaryScore,Status=status,Decision=status,DecisionCode=decisionCode,DecisionReason=DecisionReason(decisionCode,regime),
     DataQuality=qualityScore/100d,MarketTechnicalScore=preliminaryScore,PreliminaryScore=preliminaryScore,FinalScore=null,DataQualityScore=qualityScore,RiskFlags=riskFlags,PassRules=passRules,FailRules=failRules,UnknownRules=unknownRules,GeneratedAt=DateTimeOffset.Now});
    AppLogger.Info($"Coin analyzed: {pair}; preliminaryScore={preliminaryScore}; status={status}; setup={setup}; dataQuality={qualityScore}");
   } catch(Exception ex) when (ex is not OperationCanceledException)
   {
    AppLogger.Error($"Coin skipped: {pair}; id={coin.Id}; name={coin.Name}", ex);
   }
   await Task.Delay(_settings.PerCoinDelayMs,ct);
  }
  results=results.OrderByDescending(x=>x.Score).ThenByDescending(x=>x.BinanceQuoteVolume).ToList(); for(int r=0;r<results.Count;r++)results[r].Rank=r+1;
  AppLogger.Info($"Scan completed; results={results.Count}; btcRegime={regime}");
  progress.Report((100,"Hoàn tất.")); return (results,markets.Count,regime);
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
  if(failRules.Count>0) return failRules[0];
  if(unknownRules.Contains("TECHNICAL_DATA_INSUFFICIENT")) return "NEEDS_MORE_TECHNICAL_DATA";
  if(riskFlags.Contains("EXTREME_OVERBOUGHT")) return "WAIT_PULLBACK";
  if(riskFlags.Contains("BTC_BEAR_REGIME")||unknownRules.Contains("UNLOCK_UNKNOWN")) return "WAIT_UNLOCK_AND_MARKET_CONFIRMATION";
  return status=="BUY_READY"?"READY_AFTER_FULL_CONFIRMATION":"PRELIMINARY_WATCH";
 }

 static string DecisionReason(string code,string btcRegime)=>code switch
 {
  "BINANCE_VOLUME_TOO_LOW"=>"Binance spot volume is below the reject threshold.",
  "NEEDS_MORE_TECHNICAL_DATA"=>"Technical candle history is insufficient for a reliable setup.",
  "WAIT_PULLBACK"=>"RSI is extremely overbought; wait for pullback or confirmation.",
  "WAIT_UNLOCK_AND_MARKET_CONFIRMATION"=>$"Preliminary setup exists, but unlock data is unavailable and BTC regime is {btcRegime}.",
  _=>"Preliminary market and technical data only; final decision requires unlock, risk and fundamental checks."
 };

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
   _=>"UNKNOWN"
  };
 }

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
