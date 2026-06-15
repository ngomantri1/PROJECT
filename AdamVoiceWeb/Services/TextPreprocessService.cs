using System.Text.RegularExpressions;

namespace AdamVoiceWeb.Services;

public class TextPreprocessService
{
    public string Normalize(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var text = input.Replace("\r\n", "\n").Trim();

        text = Regex.Replace(text, @"(\d+)\s*(kg|kilogram|kí)\b", "$1 ki lô gam", RegexOptions.IgnoreCase);
        text = text.Replace("đ/kg", "đồng một ki lô gam", StringComparison.OrdinalIgnoreCase);
        text = Regex.Replace(text, @"(\d{1,3})(\.\d{3})+\s*đ", m => MoneyToVietnamese(m.Value), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\b(\d+)\s*k\b", "$1 nghìn", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\b(\d{1,2})h\b", "$1 giờ", RegexOptions.IgnoreCase);
        text = text.Replace("ship", "giao hàng", StringComparison.OrdinalIgnoreCase);
        text = text.Replace("feedback", "phản hồi", StringComparison.OrdinalIgnoreCase);
        text = text.Replace("sale", "giảm giá", StringComparison.OrdinalIgnoreCase);
        text = text.Replace("TikTok", "tích tóc", StringComparison.OrdinalIgnoreCase);

        // Gộp space/tab dư trong từng dòng nhưng vẫn giữ bố cục đoạn văn.
        text = Regex.Replace(text, @"[^\S\n]+", " ");

        var compactLines = new List<string>();
        var previousBlank = false;
        foreach (var rawLine in text.Split('\n'))
        {
            var line = rawLine
                .Trim()
                .Replace(" .", ".")
                .Replace(" ,", ",")
                .Replace(" !", "!")
                .Replace(" ?", "?");

            if (string.IsNullOrWhiteSpace(line))
            {
                if (previousBlank) continue;
                compactLines.Add(string.Empty);
                previousBlank = true;
                continue;
            }

            compactLines.Add(line);
            previousBlank = false;
        }

        return string.Join("\n", compactLines).Trim();
    }

    public int CountCharacters(string input)
    {
        return string.IsNullOrWhiteSpace(input) ? 0 : input.Trim().Length;
    }

    private string MoneyToVietnamese(string value)
    {
        var digits = Regex.Replace(value, @"[^0-9]", "");
        if (!int.TryParse(digits, out var amount)) return value;
        if (amount % 1000 == 0) return $"{amount / 1000} nghìn đồng";
        return $"{amount:N0} đồng".Replace(",", ".");
    }
}
