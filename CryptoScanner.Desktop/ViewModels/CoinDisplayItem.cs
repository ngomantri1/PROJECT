using CryptoScanner.Desktop.Helpers;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.ViewModels;

public sealed class CoinDisplayItem
{
 public CoinDisplayItem(ScanResult source){Source=source;}

 public ScanResult Source { get; }
 public int Rank=>Source.Rank;
 public string Symbol=>Source.Symbol;
 public string Name=>Source.Name;
 public string CoinLine=>Source.Symbol;
 public string CoinSubLine=>Source.Name;
 public int MarketTechnicalScore=>Source.MarketTechnicalScore;
 public int EntryReadinessScore=>Source.EntryReadinessScore;
 public string Status=>Source.Status;
 public string PriceDisplay=>NumberFormatter.Price(Source.Price);
 public string MarketCapDisplay=>NumberFormatter.Compact(Source.MarketCap);
 public string TotalVolumeDisplay=>NumberFormatter.Compact(Source.TotalVolume);
 public string BinanceVolumeDisplay=>NumberFormatter.Compact(Source.BinanceQuoteVolume);
 public string Setup=>Source.Setup;
 public string ReasonDisplay=>Source.DecisionCode switch
 {
  "WAIT_UNLOCK_AND_MARKET_CONFIRMATION"=>"Wait unlock",
  "WAIT_PULLBACK"=>"Wait pullback",
  "BINANCE_VOLUME_TOO_LOW"=>"Low liquidity",
  "NON_STANDARD_SYMBOL_REVIEW_REQUIRED"=>"Manual review",
  "SCORE_BELOW_WATCHLIST_THRESHOLD"=>"Score low",
  "NEEDS_MORE_TECHNICAL_DATA"=>"Needs data",
  _=>Source.DecisionCode.Replace('_',' ')
 };

 public string Category=>Source.Category;
 public string VolumeMarketCapDisplay=>NumberFormatter.RatioAsPercent(Source.VolumeMarketCapRatio);
 public string FdvMcDisplay=>Source.FdvMcRatio.ToString("0.##");
 public string CirculatingDisplay=>NumberFormatter.RatioAsPercent(Source.CirculatingRatio);
 public string Rsi4HDisplay=>NumberFormatter.Number(Source.Rsi4H);
 public string Rsi1DDisplay=>NumberFormatter.Number(Source.Rsi1D);
 public string Ema20H4Display=>NumberFormatter.OptionalPrice(Source.Ema20H4);
 public string Ema50H4Display=>NumberFormatter.OptionalPrice(Source.Ema50H4);
 public string Ema200D1Display=>NumberFormatter.OptionalPrice(Source.Ema200D1);
 public string MacdH4=>Source.MacdH4;
 public string RelativePerformanceDisplay=>NumberFormatter.OptionalPercent(Source.RelativePerformanceVsBtc30dPct);
 public string DecisionCode=>Source.DecisionCode;
 public string DecisionReason=>Source.DecisionReason;
 public int SourceCoverageScore=>Source.SourceCoverageScore;
 public int FieldCompletenessScore=>Source.FieldCompletenessScore;
 public int DataQualityScore=>Source.DataQualityScore;
 public IEnumerable<string> RiskFlags=>Source.RiskFlags.Count>0?Source.RiskFlags:["None"];
 public IEnumerable<string> PassRules=>Source.PassRules.Count>0?Source.PassRules:["None"];
 public IEnumerable<string> FailRules=>Source.FailRules.Count>0?Source.FailRules:["None"];
 public IEnumerable<string> UnknownRules=>Source.UnknownRules.Count>0?Source.UnknownRules:["None"];
}
