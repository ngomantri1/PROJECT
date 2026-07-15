using System.Text.Json.Serialization;

namespace CryptoScanner.Desktop.Models;

public sealed class UnlockInfo
{
 [JsonPropertyName("coin_id")] public string CoinId { get; set; } = "";
 [JsonPropertyName("aliases")] public List<string> Aliases { get; set; } = [];
 [JsonPropertyName("symbol")] public string Symbol { get; set; } = "";
 [JsonPropertyName("unlock_30d_pct")] public decimal? Unlock30dPct { get; set; }
 [JsonPropertyName("unlock_90d_pct")] public decimal? Unlock90dPct { get; set; }
 [JsonPropertyName("next_unlock_at")] public DateTimeOffset? NextUnlockAt { get; set; }
 [JsonPropertyName("percentage_basis")] public string PercentageBasis { get; set; } = "UNKNOWN";
 [JsonPropertyName("source")] public string Source { get; set; } = "MANUAL";
 [JsonPropertyName("source_url")] public string SourceUrl { get; set; } = "";
 [JsonPropertyName("verified_at")] public DateTimeOffset? VerifiedAt { get; set; }
 [JsonPropertyName("confidence")] public string Confidence { get; set; } = "MEDIUM";
}

public sealed class UnlockCacheDocument
{
 [JsonPropertyName("schema_version")] public string SchemaVersion { get; set; } = "1.0";
 [JsonPropertyName("updated_at")] public DateTimeOffset? UpdatedAt { get; set; }
 [JsonPropertyName("expires_at")] public DateTimeOffset? ExpiresAt { get; set; }
 [JsonPropertyName("max_cache_age_hours")] public int? MaxCacheAgeHours { get; set; }
 [JsonPropertyName("items")] public List<UnlockInfo> Items { get; set; } = [];
}

public sealed class UnlockProviderResult
{
 public string Status { get; init; } = "NOT_FOUND";
 public UnlockInfo? Data { get; init; }
 public string? Warning { get; init; }
 public string? SourcePath { get; init; }
 public bool IsExpired { get; init; }
}

public sealed class UnlockCacheSummary
{
 public string Path { get; set; } = "";
 public bool Loaded { get; set; }
 public string SchemaVersion { get; set; } = "";
 public DateTimeOffset? UpdatedAt { get; set; }
 public bool IsExpired { get; set; }
 public int ItemsTotal { get; set; }
 public int ItemsValid { get; set; }
 public int ItemsInvalid { get; set; }
 public int CandidateMatches { get; set; }
 public int CandidateMissing { get; set; }
 public int DuplicateCoinIds { get; set; }
 public int DuplicateSymbols { get; set; }
 public string? Warning { get; set; }
}

public sealed class UnlockRuleSettings
{
 public decimal Warn30dPct { get; set; } = 3m;
 public decimal Fail30dPct { get; set; } = 8m;
 public decimal Warn90dPct { get; set; } = 8m;
 public decimal Fail90dPct { get; set; } = 20m;
 public int ValidCoverageScore { get; set; } = 15;
 public int ExpiredCoverageScore { get; set; } = 5;
 public int MaxCacheAgeHours { get; set; } = 72;
}

public sealed class UnlockRuleResult
{
 public string UnlockStatus { get; init; } = "UNKNOWN";
 public decimal? Unlock30dPct { get; init; }
 public decimal? Unlock90dPct { get; init; }
 public int SourceCoverageBonus { get; init; }
 public bool HasValidData { get; init; }
 public bool IsFail { get; init; }
 public List<string> PassRules { get; init; } = [];
 public List<string> FailRules { get; init; } = [];
 public List<string> RiskFlags { get; init; } = [];
 public List<string> UnknownRules { get; init; } = [];
}
