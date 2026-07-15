namespace CryptoScanner.Desktop.Models;

public sealed class ScannerSettings
{
 public decimal MinMarketCapUsd { get; set; } = 100_000_000m;
 public decimal MaxMarketCapUsd { get; set; } = 900_000_000m;
 public decimal MinTotalVolumeUsd { get; set; } = 10_000_000m;
 public decimal MaxFdvMarketCapRatio { get; set; } = 3m;
 public decimal MinCirculatingRatio { get; set; } = 0.40m;
 public int MaxTechnicalCandidates { get; set; } = 45;
 public string ActiveScanProfile { get; set; } = "fast";
 public Dictionary<string, ScanProfileSettings> ScanProfiles { get; set; } = new()
 {
  ["fast"] = new ScanProfileSettings { MaxTechnicalCandidates = 45 },
  ["deep"] = new ScanProfileSettings { MaxTechnicalCandidates = 100 }
 };
 public decimal MinStrongVolumeUsd { get; set; } = 20_000_000m;
 public decimal MinBinanceQuoteVolumeUsd { get; set; } = 5_000_000m;
 public decimal RejectBinanceQuoteVolumeUsd { get; set; } = 2_000_000m;
 public UnlockRuleSettings UnlockRules { get; set; } = new();
 public int BuyReadyScore { get; set; } = 85;
 public int WatchlistScore { get; set; } = 75;
 public int CandleLimit { get; set; } = 220;
 public int PerCoinDelayMs { get; set; } = 80;
 public string[] StablecoinSymbols { get; set; } = ["USDT","USDC","FDUSD","TUSD","DAI","USDE","USDD","FRAX","PYUSD","USDP","GUSD","LUSD","SUSD","EURC","EURS"];
 public string[] StablecoinIds { get; set; } = ["tether","usd-coin","first-digital-usd","true-usd","dai","ethena-usde","usdd","frax","paypal-usd","pax-dollar","gemini-dollar","liquity-usd","nusd","stasis-eurs"];
 public string[] MemeSymbols { get; set; } = ["DOGE","SHIB","PEPE","BONK","WIF","FLOKI","PENGU","PUMP","MEME","MOG","TURBO","BOME"];
 public string[] WrappedSymbols { get; set; } = ["WBTC","WETH","WBNB","WSTETH","STETH","RETH","CBETH","WEETH","EZETH","RSETH"];
 public string[] HighRiskSymbols { get; set; } = ["LUNC","BTT"];
 public string[] HighRiskIds { get; set; } = ["terra-luna-classic","bittorrent"];
}

public sealed class ScanProfileSettings
{
 public int MaxTechnicalCandidates { get; set; } = 45;
}
