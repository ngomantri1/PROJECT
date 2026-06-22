using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace AdamVoiceWeb.Services;

public sealed class AiEnhanceService
{
    private static readonly Regex AudioTagRegex = new(@"\[[^\]]+\]", RegexOptions.Compiled);
    private static readonly Regex WordRegex = new(@"[\p{L}\p{N}]+", RegexOptions.Compiled);

    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly TextPreprocessService _textService;

    public AiEnhanceService(HttpClient http, IConfiguration config, TextPreprocessService textService)
    {
        _http = http;
        _config = config;
        _textService = textService;
    }

    public async Task<EnhanceResult> EnhanceAsync(string input, bool autoNormalize, CancellationToken cancellationToken = default)
    {
        var normalized = autoNormalize ? _textService.Normalize(input) : input.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return new EnhanceResult(false, string.Empty, "Bạn hãy nhập nội dung trước khi bật Enhance.", false);
        }

        if (ContainsAudioTags(normalized))
        {
            return new EnhanceResult(true, normalized, "Nội dung đã có tag biểu cảm sẵn.", false);
        }

        var apiKey = _config["OpenAI:ApiKey"] ?? string.Empty;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            var fallback = _textService.EnhanceExpressiveness(normalized);
            return new EnhanceResult(true, fallback, "Chưa cấu hình AI Enhance, hệ thống đang dùng bản biểu cảm cơ bản.", false);
        }

        try
        {
            var enhanced = await EnhanceWithOpenAiAsync(normalized, apiKey, cancellationToken);
            if (string.IsNullOrWhiteSpace(enhanced))
            {
                var fallback = _textService.EnhanceExpressiveness(normalized);
                return new EnhanceResult(true, fallback, "AI Enhance chưa trả nội dung hợp lệ, hệ thống dùng bản biểu cảm cơ bản.", false);
            }

            var cleaned = CleanupOutput(enhanced);
            if (!PreservesOriginalWords(normalized, cleaned))
            {
                var fallback = _textService.EnhanceExpressiveness(normalized);
                return new EnhanceResult(true, fallback, "AI Enhance đã đổi nội dung gốc nên hệ thống chuyển sang bản biểu cảm an toàn.", false);
            }

            return new EnhanceResult(true, cleaned, "Đã chèn biểu cảm bằng AI.", true);
        }
        catch
        {
            var fallback = _textService.EnhanceExpressiveness(normalized);
            return new EnhanceResult(true, fallback, "AI Enhance tạm không phản hồi, hệ thống dùng bản biểu cảm cơ bản.", false);
        }
    }

    private async Task<string?> EnhanceWithOpenAiAsync(string text, string apiKey, CancellationToken cancellationToken)
    {
        var model = _config["OpenAI:EnhanceModel"] ?? "gpt-5-mini";
        var baseUrl = (_config["OpenAI:BaseUrl"] ?? "https://api.openai.com/v1/").TrimEnd('/') + "/";

        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(baseUrl), "responses"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var payload = new
        {
            model,
            input = new object[]
            {
                new
                {
                    role = "system",
                    content = new object[]
                    {
                        new
                        {
                            type = "input_text",
                            text = BuildEnhancePrompt()
                        }
                    }
                },
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new
                        {
                            type = "input_text",
                            text
                        }
                    }
                }
            }
        };

        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await _http.SendAsync(request, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(raw);
        return ExtractResponseText(doc.RootElement);
    }

    private static string BuildEnhancePrompt()
    {
        return """
Enhance Vietnamese dialogue for Eleven v3.

Hard rules:
- Keep every original word in the same order.
- Do not rewrite, paraphrase, add, or remove words.
- You may only add audio tags in square brackets, stronger punctuation, ellipses, and occasional capitalization for emphasis.
- Use only voice or breathing style tags, not music, stage directions, or environment sounds.
- Place tags naturally before or after the clause they affect.
- Make the result richer and more varied than a simple keyword-based enhancer, but do not over-tag every sentence.
- Return only the enhanced text.

Useful tags:
[happy], [sad], [excited], [angry], [annoyed], [appalled], [thoughtful], [surprised], [curious], [sarcastic], [whispers], [laughing], [chuckles], [sighs], [clears throat], [short pause], [long pause], [exhales sharply], [inhales deeply], [mischievously], [softly], [warmly], [gently], [nervously].
""";
    }

    private static string CleanupOutput(string text)
    {
        var cleaned = text.Replace("\r\n", "\n").Trim();
        if (cleaned.StartsWith("```", StringComparison.Ordinal))
        {
            cleaned = Regex.Replace(cleaned, @"^```[a-zA-Z]*\s*", string.Empty);
            cleaned = Regex.Replace(cleaned, @"\s*```$", string.Empty);
        }

        return cleaned.Trim();
    }

    private static string? ExtractResponseText(JsonElement root)
    {
        if (root.TryGetProperty("output_text", out var outputText) && outputText.ValueKind == JsonValueKind.String)
        {
            return outputText.GetString();
        }

        if (!root.TryGetProperty("output", out var output) || output.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var builder = new StringBuilder();
        foreach (var item in output.EnumerateArray())
        {
            if (!item.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var part in content.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var textNode) && textNode.ValueKind == JsonValueKind.String)
                {
                    builder.Append(textNode.GetString());
                }
            }
        }

        var result = builder.ToString().Trim();
        return string.IsNullOrWhiteSpace(result) ? null : result;
    }

    private static bool ContainsAudioTags(string text)
    {
        return AudioTagRegex.IsMatch(text);
    }

    private static bool PreservesOriginalWords(string original, string enhanced)
    {
        return BuildWordSignature(original) == BuildWordSignature(AudioTagRegex.Replace(enhanced, " "));
    }

    private static string BuildWordSignature(string input)
    {
        var words = WordRegex.Matches(input.ToLowerInvariant()).Select(static m => m.Value);
        return string.Join(" ", words);
    }
}

public sealed record EnhanceResult(bool Ok, string Text, string Message, bool UsedAi);
