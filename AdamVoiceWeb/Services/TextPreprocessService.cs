using System.Text.RegularExpressions;

namespace AdamVoiceWeb.Services;

public class TextPreprocessService
{
    private static readonly string[] LaughKeywords = ["cười", "ha ha", "haha", "hí hửng", "khúc khích", "vui lắm"];
    private static readonly string[] SighKeywords = ["thở dài", "buồn", "ngậm ngùi", "não nề", "mệt quá", "bất lực"];
    private static readonly string[] AnnoyedKeywords = ["bực", "cáu", "tức", "khó chịu", "gắt", "bực mình"];
    private static readonly string[] WhisperKeywords = ["thì thầm", "nói nhỏ", "khẽ nói", "rụt rè", "nhỏ nhẹ"];

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

    public string EnhanceExpressiveness(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        var enhancedLines = new List<string>();
        foreach (var rawLine in input.Replace("\r\n", "\n").Split('\n'))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrWhiteSpace(line))
            {
                enhancedLines.Add(string.Empty);
                continue;
            }

            if (Regex.IsMatch(line, @"\[[^\]]+\]"))
            {
                enhancedLines.Add(line);
                continue;
            }

            var sentences = Regex.Split(line, @"(?<=[\.\!\?…])\s+");
            var taggedCount = 0;
            for (int i = 0; i < sentences.Length; i++)
            {
                var sentence = sentences[i].Trim();
                if (string.IsNullOrWhiteSpace(sentence) || Regex.IsMatch(sentence, @"\[[^\]]+\]"))
                {
                    sentences[i] = sentence;
                    continue;
                }

                var tag = PickAudioTag(sentence, taggedCount);
                if (!string.IsNullOrWhiteSpace(tag))
                {
                    sentences[i] = $"{tag} {sentence}";
                    taggedCount++;
                }
                else
                {
                    sentences[i] = sentence;
                }
            }

            enhancedLines.Add(string.Join(" ", sentences.Where(static x => !string.IsNullOrWhiteSpace(x))));
        }

        return string.Join("\n", enhancedLines).Trim();
    }

    public int CountCharacters(string input)
    {
        return string.IsNullOrWhiteSpace(input) ? 0 : input.Trim().Length;
    }

    private static string PickAudioTag(string sentence, int taggedCount)
    {
        if (taggedCount >= 3)
        {
            return string.Empty;
        }

        var text = sentence.ToLowerInvariant();

        if (LaughKeywords.Any(text.Contains)) return "[chuckles]";
        if (SighKeywords.Any(text.Contains)) return "[sighs]";
        if (AnnoyedKeywords.Any(text.Contains)) return "[annoyed]";
        if (WhisperKeywords.Any(text.Contains)) return "[whispering]";
        if (sentence.Contains('!')) return taggedCount == 0 ? "[excited]" : "[happy]";
        if (sentence.Contains('?')) return "[thoughtful]";

        return string.Empty;
    }

    private string MoneyToVietnamese(string value)
    {
        var digits = Regex.Replace(value, @"[^0-9]", "");
        if (!int.TryParse(digits, out var amount)) return value;
        if (amount % 1000 == 0) return $"{amount / 1000} nghìn đồng";
        return $"{amount:N0} đồng".Replace(",", ".");
    }
}
