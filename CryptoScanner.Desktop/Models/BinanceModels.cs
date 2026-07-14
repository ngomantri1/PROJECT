using System.Text.Json.Serialization;
namespace CryptoScanner.Desktop.Models;
public sealed class BinanceTicker
{
 [JsonPropertyName("symbol")] public string Symbol {get;set;}="";
 [JsonPropertyName("quoteVolume")] public string QuoteVolumeText {get;set;}="0";
 [JsonIgnore]
 public decimal QuoteVolume => decimal.TryParse(QuoteVolumeText,System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out var v)?v:0;
}
