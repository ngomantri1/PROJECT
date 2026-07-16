using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

var options = CliOptions.Parse(args);
if (options is null)
{
 PrintUsage();
 return 2;
}

try
{
 var rows = await LoadRowsAsync(options.InputPath);
 var report = ValidateRows(rows);
 if (report.Errors.Count > 0)
 {
  Console.Error.WriteLine("Unlock cache conversion failed.");
  foreach (var error in report.Errors) Console.Error.WriteLine("- " + error);
  return 1;
 }

 var document = new UnlockCacheDocument
 {
  UpdatedAt = options.UpdatedAt ?? DateTimeOffset.Now,
  MaxCacheAgeHours = options.MaxCacheAgeHours,
  Items = rows.Select(ToUnlockItem).ToList()
 };

 Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(options.OutputPath)) ?? ".");
 var jsonOptions = new JsonSerializerOptions
 {
  WriteIndented = true,
  DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
 };
 await File.WriteAllTextAsync(options.OutputPath, JsonSerializer.Serialize(document, jsonOptions), new UTF8Encoding(false));

 Console.WriteLine("Unlock cache conversion completed.");
 Console.WriteLine($"Input: {options.InputPath}");
 Console.WriteLine($"Output: {options.OutputPath}");
 Console.WriteLine($"Items: {document.Items.Count}");
 Console.WriteLine($"Updated at: {document.UpdatedAt:O}");
 Console.WriteLine($"Max cache age hours: {document.MaxCacheAgeHours}");
 return 0;
}
catch (Exception ex)
{
 Console.Error.WriteLine("Unlock cache conversion failed.");
 Console.Error.WriteLine(ex.Message);
 return 1;
}

static void PrintUsage()
{
 Console.WriteLine("UnlockCacheConverter");
 Console.WriteLine();
 Console.WriteLine("Usage:");
 Console.WriteLine("  dotnet run --project Tools/UnlockCacheConverter -- --input input.csv --output unlock-cache.json");
 Console.WriteLine("  dotnet run --project Tools/UnlockCacheConverter -- --input input.json --output unlock-cache.json --updated-at 2026-07-16T04:30:00+07:00");
 Console.WriteLine();
 Console.WriteLine("Supported input fields:");
 Console.WriteLine("  coin_id,symbol,unlock_30d_pct,unlock_90d_pct,next_unlock_at,percentage_basis,source,source_url,verified_at,confidence");
}

static async Task<List<InputRow>> LoadRowsAsync(string inputPath)
{
 if (!File.Exists(inputPath)) throw new FileNotFoundException("Input file not found.", inputPath);
 var extension = Path.GetExtension(inputPath).ToLowerInvariant();
 return extension switch
 {
  ".csv" => await LoadCsvAsync(inputPath),
  ".json" => await LoadJsonAsync(inputPath),
  _ => throw new InvalidOperationException("Unsupported input file type. Use .csv or .json.")
 };
}

static async Task<List<InputRow>> LoadJsonAsync(string inputPath)
{
 await using var stream = File.OpenRead(inputPath);
 using var doc = await JsonDocument.ParseAsync(stream);
 var root = doc.RootElement;
 if (root.ValueKind == JsonValueKind.Object && TryGet(root, "items", out var items)) root = items;
 if (root.ValueKind != JsonValueKind.Array) throw new InvalidOperationException("JSON input must be an array or an object with items array.");

 var rows = new List<InputRow>();
 foreach (var item in root.EnumerateArray())
 {
  rows.Add(new InputRow
  {
   CoinId = ReadString(item, "coin_id"),
   Symbol = ReadString(item, "symbol"),
   Unlock30dPct = ReadDecimal(item, "unlock_30d_pct"),
   Unlock90dPct = ReadDecimal(item, "unlock_90d_pct"),
   NextUnlockAt = ReadDate(item, "next_unlock_at"),
   PercentageBasis = ReadString(item, "percentage_basis"),
   Source = ReadString(item, "source"),
   SourceUrl = ReadString(item, "source_url"),
   VerifiedAt = ReadDate(item, "verified_at"),
   Confidence = ReadString(item, "confidence")
  });
 }

 return rows;
}

static async Task<List<InputRow>> LoadCsvAsync(string inputPath)
{
 var lines = await File.ReadAllLinesAsync(inputPath, Encoding.UTF8);
 if (lines.Length == 0) return [];

 var headers = SplitCsvLine(lines[0]).Select(NormalizeHeader).ToList();
 var rows = new List<InputRow>();
 for (var i = 1; i < lines.Length; i++)
 {
  if (string.IsNullOrWhiteSpace(lines[i])) continue;
  var values = SplitCsvLine(lines[i]);
  var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
  for (var j = 0; j < headers.Count && j < values.Count; j++) map[headers[j]] = values[j].Trim();

  rows.Add(new InputRow
  {
   CoinId = Get(map, "coin_id"),
   Symbol = Get(map, "symbol"),
   Unlock30dPct = ParseDecimal(Get(map, "unlock_30d_pct")),
   Unlock90dPct = ParseDecimal(Get(map, "unlock_90d_pct")),
   NextUnlockAt = ParseDate(Get(map, "next_unlock_at")),
   PercentageBasis = Get(map, "percentage_basis"),
   Source = Get(map, "source"),
   SourceUrl = Get(map, "source_url"),
   VerifiedAt = ParseDate(Get(map, "verified_at")),
   Confidence = Get(map, "confidence")
  });
 }

 return rows;
}

static ValidationReport ValidateRows(List<InputRow> rows)
{
 var errors = new List<string>();
 if (rows.Count == 0) errors.Add("No rows found.");

 for (var i = 0; i < rows.Count; i++)
 {
  var row = rows[i];
  var label = $"row {i + 1}";
  if (string.IsNullOrWhiteSpace(row.CoinId) && string.IsNullOrWhiteSpace(row.Symbol)) errors.Add($"{label}: coin_id or symbol is required.");
  if (!row.Unlock30dPct.HasValue) errors.Add($"{label}: unlock_30d_pct is required.");
  if (!row.Unlock90dPct.HasValue) errors.Add($"{label}: unlock_90d_pct is required.");
  if (!ValidPct(row.Unlock30dPct)) errors.Add($"{label}: unlock_30d_pct must be between 0 and 100.");
  if (!ValidPct(row.Unlock90dPct)) errors.Add($"{label}: unlock_90d_pct must be between 0 and 100.");
  if (row.Unlock30dPct.HasValue && row.Unlock90dPct.HasValue && row.Unlock90dPct.Value < row.Unlock30dPct.Value)
  {
   errors.Add($"{label}: unlock_90d_pct must be greater than or equal to unlock_30d_pct.");
  }

  if (!string.IsNullOrWhiteSpace(row.PercentageBasis) &&
      !string.Equals(row.PercentageBasis, "CURRENT_CIRCULATING_SUPPLY", StringComparison.OrdinalIgnoreCase))
  {
   errors.Add($"{label}: percentage_basis must be CURRENT_CIRCULATING_SUPPLY.");
  }
 }

 var duplicateCoinIds = rows.Where(x => !string.IsNullOrWhiteSpace(x.CoinId))
  .GroupBy(x => x.CoinId.Trim(), StringComparer.OrdinalIgnoreCase)
  .Where(x => x.Count() > 1)
  .Select(x => x.Key);
 foreach (var duplicate in duplicateCoinIds) errors.Add("Duplicate coin_id: " + duplicate);

 var duplicateSymbols = rows.Where(x => !string.IsNullOrWhiteSpace(x.Symbol))
  .GroupBy(x => NormalizeSymbol(x.Symbol), StringComparer.OrdinalIgnoreCase)
  .Where(x => x.Count() > 1)
  .Select(x => x.Key);
 foreach (var duplicate in duplicateSymbols) errors.Add("Duplicate symbol: " + duplicate);

 return new ValidationReport(errors);
}

static UnlockInfo ToUnlockItem(InputRow row) => new()
{
 CoinId = row.CoinId.Trim(),
 Symbol = row.Symbol.Trim().ToUpperInvariant(),
 Unlock30dPct = row.Unlock30dPct,
 Unlock90dPct = row.Unlock90dPct,
 NextUnlockAt = row.NextUnlockAt,
 PercentageBasis = string.IsNullOrWhiteSpace(row.PercentageBasis) ? "CURRENT_CIRCULATING_SUPPLY" : row.PercentageBasis.Trim().ToUpperInvariant(),
 Source = string.IsNullOrWhiteSpace(row.Source) ? "MANUAL_REAL_DATA" : row.Source.Trim(),
 SourceUrl = row.SourceUrl.Trim(),
 VerifiedAt = row.VerifiedAt,
 Confidence = string.IsNullOrWhiteSpace(row.Confidence) ? "LOW" : row.Confidence.Trim().ToUpperInvariant()
};

static List<string> SplitCsvLine(string line)
{
 var result = new List<string>();
 var current = new StringBuilder();
 var inQuotes = false;
 for (var i = 0; i < line.Length; i++)
 {
  var ch = line[i];
  if (ch == '"')
  {
   if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
   {
    current.Append('"');
    i++;
   }
   else
   {
    inQuotes = !inQuotes;
   }
  }
  else if (ch == ',' && !inQuotes)
  {
   result.Add(current.ToString());
   current.Clear();
  }
  else
  {
   current.Append(ch);
  }
 }

 result.Add(current.ToString());
 return result;
}

static string NormalizeHeader(string value) => value.Trim().Trim('"').ToLowerInvariant();
static string Get(Dictionary<string, string> map, string key) => map.TryGetValue(key, out var value) ? value : "";
static bool ValidPct(decimal? value) => value.HasValue && value.Value is >= 0m and <= 100m;
static string NormalizeSymbol(string symbol) => new(symbol.Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());

static decimal? ParseDecimal(string value)
{
 if (string.IsNullOrWhiteSpace(value)) return null;
 return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
}

static DateTimeOffset? ParseDate(string value)
{
 if (string.IsNullOrWhiteSpace(value)) return null;
 return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed) ? parsed : null;
}

static string ReadString(JsonElement item, string name) => TryGet(item, name, out var value) && value.ValueKind != JsonValueKind.Null ? value.ToString() : "";
static decimal? ReadDecimal(JsonElement item, string name) => TryGet(item, name, out var value) && value.TryGetDecimal(out var parsed) ? parsed : null;
static DateTimeOffset? ReadDate(JsonElement item, string name) => TryGet(item, name, out var value) && value.ValueKind != JsonValueKind.Null && DateTimeOffset.TryParse(value.ToString(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed) ? parsed : null;

static bool TryGet(JsonElement item, string name, out JsonElement value)
{
 if (item.ValueKind == JsonValueKind.Object)
 {
  foreach (var property in item.EnumerateObject())
  {
   if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
   {
    value = property.Value;
    return true;
   }
  }
 }

 value = default;
 return false;
}

sealed record CliOptions(string InputPath, string OutputPath, DateTimeOffset? UpdatedAt, int MaxCacheAgeHours)
{
 public static CliOptions? Parse(string[] args)
 {
  var input = "";
  var output = "";
  DateTimeOffset? updatedAt = null;
  var maxAgeHours = 72;

  for (var i = 0; i < args.Length; i++)
  {
   var arg = args[i];
   if (arg == "--input" && i + 1 < args.Length) input = args[++i];
   else if (arg == "--output" && i + 1 < args.Length) output = args[++i];
   else if (arg == "--updated-at" && i + 1 < args.Length) updatedAt = ParseDateArg(args[++i]);
   else if (arg == "--max-age-hours" && i + 1 < args.Length && int.TryParse(args[++i], out var parsed)) maxAgeHours = parsed;
   else if (string.IsNullOrWhiteSpace(input)) input = arg;
   else if (string.IsNullOrWhiteSpace(output)) output = arg;
  }

  if (string.IsNullOrWhiteSpace(input) || string.IsNullOrWhiteSpace(output)) return null;
  return new CliOptions(input, output, updatedAt, maxAgeHours);
 }

 static DateTimeOffset? ParseDateArg(string value)
 {
  if (string.IsNullOrWhiteSpace(value)) return null;
  return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed) ? parsed : null;
 }
}

sealed record ValidationReport(List<string> Errors);

sealed class InputRow
{
 public string CoinId { get; set; } = "";
 public string Symbol { get; set; } = "";
 public decimal? Unlock30dPct { get; set; }
 public decimal? Unlock90dPct { get; set; }
 public DateTimeOffset? NextUnlockAt { get; set; }
 public string PercentageBasis { get; set; } = "";
 public string Source { get; set; } = "";
 public string SourceUrl { get; set; } = "";
 public DateTimeOffset? VerifiedAt { get; set; }
 public string Confidence { get; set; } = "";
}

sealed class UnlockCacheDocument
{
 [JsonPropertyName("schema_version")] public string SchemaVersion { get; set; } = "1.0";
 [JsonPropertyName("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
 [JsonPropertyName("max_cache_age_hours")] public int MaxCacheAgeHours { get; set; }
 [JsonPropertyName("items")] public List<UnlockInfo> Items { get; set; } = [];
}

sealed class UnlockInfo
{
 [JsonPropertyName("coin_id")] public string CoinId { get; set; } = "";
 [JsonPropertyName("symbol")] public string Symbol { get; set; } = "";
 [JsonPropertyName("unlock_30d_pct")] public decimal? Unlock30dPct { get; set; }
 [JsonPropertyName("unlock_90d_pct")] public decimal? Unlock90dPct { get; set; }
 [JsonPropertyName("next_unlock_at")] public DateTimeOffset? NextUnlockAt { get; set; }
 [JsonPropertyName("percentage_basis")] public string PercentageBasis { get; set; } = "CURRENT_CIRCULATING_SUPPLY";
 [JsonPropertyName("source")] public string Source { get; set; } = "MANUAL_REAL_DATA";
 [JsonPropertyName("source_url")] public string SourceUrl { get; set; } = "";
 [JsonPropertyName("verified_at")] public DateTimeOffset? VerifiedAt { get; set; }
 [JsonPropertyName("confidence")] public string Confidence { get; set; } = "LOW";
}
