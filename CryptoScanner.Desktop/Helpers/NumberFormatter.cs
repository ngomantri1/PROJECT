using System.Globalization;

namespace CryptoScanner.Desktop.Helpers;

public static class NumberFormatter
{
 static readonly CultureInfo Culture = CultureInfo.InvariantCulture;

 public static string Compact(decimal value)
 {
  var abs=Math.Abs(value);
  if(abs>=1_000_000_000m) return (value/1_000_000_000m).ToString("0.##",Culture)+"B";
  if(abs>=1_000_000m) return (value/1_000_000m).ToString("0.#",Culture)+"M";
  if(abs>=1_000m) return (value/1_000m).ToString("0.#",Culture)+"K";
  return value.ToString("0.##",Culture);
 }

 public static string Price(decimal value)
 {
  if(value>=1m) return value.ToString("0.####",Culture);
  if(value>=0.01m) return value.ToString("0.######",Culture);
  return value.ToString("0.##########",Culture);
 }

 public static string Percent(decimal value)=>value.ToString("+0.##;-0.##;0",Culture)+"%";

 public static string RatioAsPercent(decimal value)=>(value*100m).ToString("0.##",Culture)+"%";

 public static string Number(double value)=>value.ToString("0.##",Culture);

 public static string OptionalPrice(decimal? value)=>value.HasValue?Price(value.Value):"--";

 public static string OptionalPercent(decimal? value)=>value.HasValue?Percent(value.Value):"--";
}
