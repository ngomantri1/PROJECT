using System.Text.Json.Serialization;
namespace CryptoScanner.Desktop.Models;
public sealed class CoinMarket
{
 [JsonPropertyName("id")] public string Id {get;set;}="";
 [JsonPropertyName("symbol")] public string Symbol {get;set;}="";
 [JsonPropertyName("name")] public string Name {get;set;}="";
 [JsonPropertyName("current_price")] public decimal Price {get;set;}
 [JsonPropertyName("market_cap")] public decimal MarketCap {get;set;}
 [JsonPropertyName("fully_diluted_valuation")] public decimal? Fdv {get;set;}
 [JsonPropertyName("total_volume")] public decimal TotalVolume {get;set;}
 [JsonPropertyName("circulating_supply")] public decimal? CirculatingSupply {get;set;}
 [JsonPropertyName("total_supply")] public decimal? TotalSupply {get;set;}
}
