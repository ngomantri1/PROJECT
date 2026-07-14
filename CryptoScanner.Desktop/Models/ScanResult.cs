using System.Text.Json.Serialization;

namespace CryptoScanner.Desktop.Models;
public sealed class ScanResult
{
 public int Rank {get;set;} public string Id {get;set;}=""; public string Symbol {get;set;}=""; public string Name {get;set;}="";
 public string Category {get;set;}="UNKNOWN"; public bool IsStablecoin {get;set;} public bool IsMeme {get;set;} public bool IsWrapped {get;set;}
 public decimal Price {get;set;} public decimal MarketCap {get;set;} public decimal TotalVolume {get;set;} public decimal BinanceQuoteVolume {get;set;}
 public decimal VolumeMarketCapRatio {get;set;} public decimal FdvMcRatio {get;set;} public decimal CirculatingRatio {get;set;} public double Rsi4H {get;set;} public double Rsi1D {get;set;}
 public string UnlockStatus {get;set;}="UNKNOWN"; public decimal? Unlock30dPct {get;set;} public decimal? Unlock90dPct {get;set;}
 public string MonitoringTag {get;set;}="UNKNOWN"; public string DelistRisk {get;set;}="UNKNOWN"; public string LegalRisk {get;set;}="UNKNOWN";
 public decimal? Ema20H4 {get;set;} public decimal? Ema50H4 {get;set;} public decimal? Ema200D1 {get;set;} public string MacdH4 {get;set;}="UNKNOWN"; public decimal? RelativePerformanceVsBtc30dPct {get;set;}
 public decimal? BreakoutLevel {get;set;} public decimal? DistanceToBreakoutPct {get;set;} public decimal? VolumeRatio20 {get;set;} public bool BreakoutConfirmed {get;set;} public bool RetestConfirmed {get;set;}
 public string Setup {get;set;}="NONE"; public string Status {get;set;}="WATCHLIST"; public string Decision {get;set;}="WATCHLIST";
 public string DecisionCode {get;set;}="UNKNOWN"; public string DecisionReason {get;set;}="";
 public List<string> RiskFlags {get;set;}=[]; public List<string> PassRules {get;set;}=[]; public List<string> FailRules {get;set;}=[]; public List<string> UnknownRules {get;set;}=[];
 public int MarketTechnicalScore {get;set;} public int EntryReadinessScore {get;set;} public int PreliminaryScore {get;set;} public int? FinalScore {get;set;} public int SourceCoverageScore {get;set;} public int FieldCompletenessScore {get;set;} public int DataQualityScore {get;set;}
 [JsonIgnore] public int Score {get;set;}
 [JsonIgnore] public double DataQuality {get;set;}
 public DateTimeOffset GeneratedAt {get;set;}
}
