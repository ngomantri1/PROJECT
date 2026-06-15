using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AdamVoiceWeb.Models;

namespace AdamVoiceWeb.Services;

public class ElevenLabsService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public ElevenLabsService(HttpClient http, IConfiguration config, IWebHostEnvironment env)
    {
        _http = http;
        _config = config;
        _env = env;
    }

    public async Task<string> GenerateSpeechAsync(string text, VoiceOption voice, decimal stability, decimal similarity, decimal style, decimal speed)
    {
        var audioDir = Path.Combine(_env.WebRootPath, "audio");
        Directory.CreateDirectory(audioDir);

        var apiKey = _config["ElevenLabs:ApiKey"] ?? string.Empty;
        var useMock = _config.GetValue<bool>("ElevenLabs:UseMockWhenApiKeyEmpty");
        var safeName = $"voice_{DateTime.Now:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}";

        if (string.IsNullOrWhiteSpace(apiKey) && useMock)
        {
            var wavPath = Path.Combine(audioDir, safeName + ".wav");
            await CreateDemoWavAsync(wavPath);
            return "/audio/" + Path.GetFileName(wavPath);
        }

        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Chưa cấu hình ElevenLabs ApiKey trong appsettings.json");

        if (string.IsNullOrWhiteSpace(voice.ApiVoiceId))
            throw new InvalidOperationException("Giọng này chưa có ApiVoiceId.");

        var modelId = _config["ElevenLabs:DefaultModelId"] ?? "eleven_multilingual_v2";
        var url = $"https://api.elevenlabs.io/v1/text-to-speech/{voice.ApiVoiceId}";

        var payload = new
        {
            text,
            model_id = modelId,
            voice_settings = new
            {
                stability = stability,
                similarity_boost = similarity,
                style = style,
                use_speaker_boost = true,
                speed = speed
            }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("xi-api-key", apiKey);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("audio/mpeg"));
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        using var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            var error = await res.Content.ReadAsStringAsync();
            throw new Exception($"ElevenLabs lỗi {(int)res.StatusCode}: {error}");
        }

        var mp3Path = Path.Combine(audioDir, safeName + ".mp3");
        var bytes = await res.Content.ReadAsByteArrayAsync();
        await File.WriteAllBytesAsync(mp3Path, bytes);
        return "/audio/" + Path.GetFileName(mp3Path);
    }

    private async Task CreateDemoWavAsync(string path)
    {
        await Task.Run(() =>
        {
            const int sampleRate = 44100;
            const short bitsPerSample = 16;
            const short channels = 1;
            const int seconds = 2;
            var samples = sampleRate * seconds;
            var dataSize = samples * channels * bitsPerSample / 8;

            using var fs = File.Create(path);
            using var bw = new BinaryWriter(fs);
            bw.Write(Encoding.ASCII.GetBytes("RIFF"));
            bw.Write(36 + dataSize);
            bw.Write(Encoding.ASCII.GetBytes("WAVE"));
            bw.Write(Encoding.ASCII.GetBytes("fmt "));
            bw.Write(16);
            bw.Write((short)1);
            bw.Write(channels);
            bw.Write(sampleRate);
            bw.Write(sampleRate * channels * bitsPerSample / 8);
            bw.Write((short)(channels * bitsPerSample / 8));
            bw.Write(bitsPerSample);
            bw.Write(Encoding.ASCII.GetBytes("data"));
            bw.Write(dataSize);

            for (int i = 0; i < samples; i++)
            {
                var t = (double)i / sampleRate;
                var freq = 440 + 120 * Math.Sin(2 * Math.PI * 2 * t);
                short sample = (short)(Math.Sin(2 * Math.PI * freq * t) * short.MaxValue * 0.15);
                bw.Write(sample);
            }
        });
    }
}
