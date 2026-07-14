namespace CryptoScanner.Desktop.Services;
public sealed class TechnicalAnalysisService
{
 public double Rsi(IReadOnlyList<decimal> closes,int period=14)
 {
  if(closes.Count<=period) return 0; decimal gains=0,losses=0;
  for(int i=closes.Count-period;i<closes.Count;i++){var d=closes[i]-closes[i-1]; if(d>=0)gains+=d; else losses-=d;}
  if(losses==0) return 100; var rs=gains/losses; return (double)(100-(100/(1+rs)));
 }
 public decimal Ema(IReadOnlyList<decimal> values,int period)
 {
  if(values.Count==0) return 0; var k=2m/(period+1); decimal ema=values[0]; foreach(var v in values.Skip(1)) ema=(v*k)+(ema*(1-k)); return ema;
 }
 public string MacdTrend(IReadOnlyList<decimal> closes)
 {
  if(closes.Count<35) return "INSUFFICIENT";
  var ema12=Ema(closes,12); var ema26=Ema(closes,26); var macd=ema12-ema26;
  var previous=closes.Take(closes.Count-1).ToList();
  var prevMacd=Ema(previous,12)-Ema(previous,26);
  if(macd>0&&macd>=prevMacd) return "BULLISH";
  if(macd<0&&macd<=prevMacd) return "BEARISH";
  return "NEUTRAL";
 }
 public decimal? RelativePerformanceVsBtc30dPct(IReadOnlyList<decimal> closes,IReadOnlyList<decimal> benchmarkCloses)
 {
  if(closes.Count<31||benchmarkCloses.Count<31||closes[^31]==0||benchmarkCloses[^31]==0) return null;
  var assetReturn=(closes[^1]-closes[^31])/closes[^31];
  var benchmarkReturn=(benchmarkCloses[^1]-benchmarkCloses[^31])/benchmarkCloses[^31];
  return (assetReturn-benchmarkReturn)*100m;
 }
 public string DetectSetup(IReadOnlyList<decimal> h4,IReadOnlyList<decimal> d1,double rsi4)
 {
  if(h4.Count<60||d1.Count<210) return "INSUFFICIENT";
  var e20=Ema(h4.TakeLast(100).ToList(),20); var e50=Ema(h4.TakeLast(100).ToList(),50); var e200=Ema(d1,200); var macd=MacdTrend(h4); var lastH4=h4[^1]; var lastD1=d1[^1];
  if(lastH4>e20 && e20>e50 && lastD1>e200 && macd=="BULLISH" && rsi4>=45 && rsi4<=65) return "BREAKOUT_CANDIDATE";
  if(rsi4<40 && h4[^1]>h4[^5] && macd!="BEARISH" && lastD1>e200*0.90m) return "EARLY_REVERSAL";
  return "WATCH";
 }
}
