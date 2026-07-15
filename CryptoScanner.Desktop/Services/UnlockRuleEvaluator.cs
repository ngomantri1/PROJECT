using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public static class UnlockRuleEvaluator
{
 public static UnlockRuleResult Evaluate(UnlockProviderResult providerResult, UnlockRuleSettings settings)
 {
  if (providerResult.Status == "CACHE_EXPIRED" && providerResult.Data is not null)
  {
   return new UnlockRuleResult
   {
    SourceCoverageBonus = settings.ExpiredCoverageScore,
    RiskFlags = ["UNLOCK_CACHE_EXPIRED"],
    UnknownRules = ["UNLOCK_UNKNOWN"]
   };
  }

  if (providerResult.Status != "FOUND" || providerResult.Data is null)
  {
   var unknownRules = new List<string> { "UNLOCK_UNKNOWN" };
   var missingRiskFlags = new List<string>();
   if (providerResult.Status == "INVALID_ITEM") missingRiskFlags.Add("UNLOCK_CACHE_INVALID");
   return new UnlockRuleResult { UnknownRules = unknownRules, RiskFlags = missingRiskFlags };
  }

  var data = providerResult.Data;
  var failRules = new List<string>();
  var passRules = new List<string> { "UNLOCK_DATA_AVAILABLE" };
  var riskFlags = new List<string>();

  if (data.Unlock30dPct.HasValue)
  {
   if (data.Unlock30dPct.Value >= settings.Fail30dPct) failRules.Add("UNLOCK_30D_TOO_HIGH");
   else if (data.Unlock30dPct.Value >= settings.Warn30dPct) riskFlags.Add("UNLOCK_PRESSURE_WARNING");
   else passRules.Add("UNLOCK_30D_PASS");
  }

  if (data.Unlock90dPct.HasValue)
  {
   if (data.Unlock90dPct.Value >= settings.Fail90dPct) failRules.Add("UNLOCK_90D_TOO_HIGH");
   else if (data.Unlock90dPct.Value >= settings.Warn90dPct) riskFlags.Add("UNLOCK_PRESSURE_WARNING");
   else passRules.Add("UNLOCK_90D_PASS");
  }

  var status = failRules.Count > 0 ? "FAIL" : riskFlags.Contains("UNLOCK_PRESSURE_WARNING") ? "WARN" : "PASS";
  return new UnlockRuleResult
  {
   UnlockStatus = status,
   Unlock30dPct = data.Unlock30dPct,
   Unlock90dPct = data.Unlock90dPct,
   SourceCoverageBonus = settings.ValidCoverageScore,
   HasValidData = true,
   IsFail = failRules.Count > 0,
   PassRules = passRules.Distinct().ToList(),
   FailRules = failRules.Distinct().ToList(),
   RiskFlags = riskFlags.Distinct().ToList()
  };
 }
}
