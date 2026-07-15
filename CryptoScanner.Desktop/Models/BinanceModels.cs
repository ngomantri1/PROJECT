using System.Text.Json.Serialization;
namespace CryptoScanner.Desktop.Models;
public sealed class BinanceTicker
{
 [JsonPropertyName("symbol")] public string Symbol {get;set;}="";
 [JsonPropertyName("quoteVolume")] public string QuoteVolumeText {get;set;}="0";
 [JsonIgnore]
 public decimal QuoteVolume => decimal.TryParse(QuoteVolumeText,System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out var v)?v:0;
}

public sealed class BinanceKlineClose
{
 public string Symbol { get; set; } = "";
 public DateTimeOffset OpenTime { get; set; }
 public DateTimeOffset CloseTime { get; set; }
 public decimal Close { get; set; }
}
