using System.Security.Claims;
using System.Text.RegularExpressions;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;
    private readonly TextPreprocessService _textService;
    private readonly ElevenLabsService _tts;
    private readonly AiEnhanceService _enhance;
    private readonly IConfiguration _config;

    public IndexModel(
        AppDbContext db,
        TextPreprocessService textService,
        ElevenLabsService tts,
        AiEnhanceService enhance,
        IConfiguration config)
    {
        _db = db;
        _textService = textService;
        _tts = tts;
        _enhance = enhance;
        _config = config;
    }

    public List<VoiceOption> Voices { get; set; } = new();
    public List<PointPackage> Packages { get; set; } = new();
    public List<VoiceJob> RecentJobs { get; set; } = new();
    public int CurrentBalance { get; set; }
    public int LowPointWarning { get; set; }

    [BindProperty] public string Text { get; set; } = "Hello cac ban, day la noi dung mau de tao giong noi.";
    [BindProperty] public int VoiceId { get; set; } = 1;
    [BindProperty] public bool AutoNormalize { get; set; } = true;
    [BindProperty] public bool EnableEnhance { get; set; }
    [BindProperty] public decimal Speed { get; set; } = 1.0m;
    [BindProperty] public decimal Stability { get; set; } = 0.5m;
    [BindProperty] public decimal Similarity { get; set; } = 0.8m;
    [BindProperty] public decimal Style { get; set; } = 0.4m;

    [TempData] public string? Success { get; set; }
    [TempData] public string? Error { get; set; }

    public void OnGet()
    {
        Load();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        var outcome = await GenerateVoiceCoreAsync();
        if (outcome.Ok)
        {
            Success = outcome.Message;
        }
        else
        {
            Error = outcome.Message;
        }

        return outcome.RedirectToPackages ? RedirectToPage("/Packages") : RedirectToPage();
    }

    public async Task<IActionResult> OnPostGenerateAsync()
    {
        var outcome = await GenerateVoiceCoreAsync();
        Load();

        return new JsonResult(new GenerateVoiceAjaxResponse
        {
            Ok = outcome.Ok,
            Message = outcome.Message,
            RedirectUrl = outcome.RedirectToPackages ? "/Packages" : null,
            CurrentBalance = CurrentBalance,
            LowPointWarning = LowPointWarning,
            RecentJobs = RecentJobs.Select(x => new RecentJobDto
            {
                TextPreview = x.Text.Length > 30 ? x.Text[..30] + "..." : x.Text,
                VoiceName = x.VoiceName,
                CharacterCount = x.CharacterCount,
                AudioUrl = x.AudioUrl,
                CreatedAtText = x.CreatedAt.ToString("dd/MM HH:mm")
            }).ToList()
        });
    }

    public async Task<IActionResult> OnGetPreviewVoiceAsync(int voiceId)
    {
        var userId = CurrentUserId();
        var voice = _db.Voices.FirstOrDefault(x =>
            x.Id == voiceId &&
            x.IsActive &&
            x.Status == "Approved" &&
            (!x.OwnerUserId.HasValue || x.OwnerUserId == 0 || x.OwnerUserId == userId));

        if (voice == null)
        {
            return new JsonResult(new { ok = false, message = "Giọng nói không hợp lệ." });
        }

        try
        {
            const string previewText = "Xin chào, đây là giọng đọc thử để bạn kiểm tra trước khi tạo audio.";
            var audioUrl = await _tts.GenerateSpeechAsync(previewText, voice, 0.5m, 0.8m, 0.35m, 1.0m);
            return new JsonResult(new { ok = true, audioUrl });
        }
        catch (Exception ex)
        {
            return new JsonResult(new { ok = false, message = "Nghe thử giọng lỗi: " + ex.Message });
        }
    }

    public async Task<IActionResult> OnPostEnhanceText()
    {
        var enhanced = await _enhance.EnhanceAsync(Text ?? string.Empty, AutoNormalize, HttpContext.RequestAborted);

        return new JsonResult(new
        {
            ok = enhanced.Ok,
            text = enhanced.Text,
            message = enhanced.Message,
            usedAi = enhanced.UsedAi
        });
    }

    private async Task<GenerateVoiceOutcome> GenerateVoiceCoreAsync()
    {
        var userId = CurrentUserId();
        var maxChars = _config.GetValue<int?>("BusinessRules:MaxCharactersPerJob") ?? 8000;
        var maxEnhanceChars = 5000;
        var maxJobs = _config.GetValue<int?>("BusinessRules:MaxJobsPer10Minutes") ?? 10;
        var originalText = Text ?? string.Empty;
        var normalized = AutoNormalize ? _textService.Normalize(originalText) : originalText.Trim();
        var originalCount = _textService.CountCharacters(originalText);
        var charCount = _textService.CountCharacters(normalized);

        if (charCount <= 0)
        {
            return new GenerateVoiceOutcome(false, "Bạn chưa nhập nội dung.");
        }

        if (charCount > maxChars)
        {
            return new GenerateVoiceOutcome(false, $"Mỗi lần tạo giới hạn {maxChars:N0} ký tự để bảo vệ hệ thống.");
        }

        var hasVisibleTags = Regex.IsMatch(normalized, @"\[[^\]]+\]");
        var synthesisText = normalized;
        if (EnableEnhance)
        {
            if (hasVisibleTags)
            {
                synthesisText = normalized;
            }
            else
            {
                var enhanced = await _enhance.EnhanceAsync(normalized, false, HttpContext.RequestAborted);
                synthesisText = enhanced.Text;
            }
        }

        var synthesisModelId = EnableEnhance ? (_config["ElevenLabs:EnhanceModelId"] ?? "eleven_v3") : null;
        var synthesisCharCount = _textService.CountCharacters(synthesisText);

        if (EnableEnhance && synthesisCharCount > maxEnhanceChars)
        {
            return new GenerateVoiceOutcome(false, $"Enhance hiện hỗ trợ tối đa {maxEnhanceChars:N0} ký tự vì đang dùng model Eleven v3.");
        }

        var user = _db.Users.First(x => x.Id == userId);
        if (user.IsLocked)
        {
            return new GenerateVoiceOutcome(false, "Tài khoản đã bị khóa. Vui lòng liên hệ admin.");
        }

        var recentCount = _db.VoiceJobs.Count(x => x.UserId == userId && x.CreatedAt > DateTime.Now.AddMinutes(-10));
        if (recentCount >= maxJobs)
        {
            return new GenerateVoiceOutcome(false, $"Bạn tạo hơi nhanh. Vui lòng chờ thêm ít phút rồi thử lại. Giới hạn {maxJobs} lần/10 phút.");
        }

        var voice = _db.Voices.FirstOrDefault(x =>
            x.Id == VoiceId &&
            x.IsActive &&
            x.Status == "Approved" &&
            (!x.OwnerUserId.HasValue || x.OwnerUserId == 0 || x.OwnerUserId == userId));

        if (voice == null)
        {
            return new GenerateVoiceOutcome(false, "Giọng nói không hợp lệ.");
        }

        var cost = (int)Math.Ceiling(charCount * voice.PointRate);
        if (user.PointBalance < cost)
        {
            return new GenerateVoiceOutcome(false, $"Không đủ điểm. Cần {cost:N0} điểm, hiện có {user.PointBalance:N0} điểm.", true);
        }

        try
        {
            var debitUser = _db.Users.First(x => x.Id == userId);
            if (debitUser.PointBalance < cost)
            {
                return new GenerateVoiceOutcome(false, $"Không đủ điểm. Cần {cost:N0} điểm, hiện có {debitUser.PointBalance:N0} điểm.", true);
            }

            var balanceBefore = debitUser.PointBalance;
            debitUser.PointBalance -= cost;
            var balanceAfter = debitUser.PointBalance;

            _db.PointTransactions.Add(new PointTransaction
            {
                UserId = userId,
                Type = "UsePoint",
                PointAmount = -cost,
                BalanceBefore = balanceBefore,
                BalanceAfter = balanceAfter,
                Note = $"Tao giong {voice.Name}, {charCount:N0} ky tu",
                Status = "Completed"
            });
            _db.SaveChanges();

            var audioUrl = await _tts.GenerateSpeechAsync(synthesisText, voice, Stability, Similarity, Style, Speed, synthesisModelId);

            _db.VoiceJobs.Add(new VoiceJob
            {
                UserId = userId,
                VoiceId = voice.Id,
                VoiceName = voice.Name,
                Text = normalized,
                OriginalCharacterCount = originalCount,
                CharacterCount = charCount,
                PointRate = voice.PointRate,
                PointCost = cost,
                BalanceBefore = balanceBefore,
                BalanceAfter = balanceAfter,
                AudioUrl = audioUrl,
                Status = "Completed"
            });
            _db.SaveChanges();

            return new GenerateVoiceOutcome(true, $"Tạo giọng thành công. Đã trừ {cost:N0} điểm. Nghe lại/tải lại trong lịch sử không trừ điểm.");
        }
        catch (Exception ex)
        {
            var refundUser = _db.Users.First(x => x.Id == userId);
            var before = refundUser.PointBalance;
            refundUser.PointBalance += cost;

            _db.PointTransactions.Add(new PointTransaction
            {
                UserId = userId,
                Type = "RefundPoint",
                PointAmount = cost,
                BalanceBefore = before,
                BalanceAfter = refundUser.PointBalance,
                Note = "Hoan diem do tao giong loi: " + ex.Message,
                Status = "Completed"
            });

            _db.VoiceJobs.Add(new VoiceJob
            {
                UserId = userId,
                VoiceId = voice.Id,
                VoiceName = voice.Name,
                Text = normalized,
                OriginalCharacterCount = originalCount,
                CharacterCount = charCount,
                PointRate = voice.PointRate,
                PointCost = cost,
                Status = "Refunded",
                ErrorMessage = ex.Message
            });
            _db.SaveChanges();

            return new GenerateVoiceOutcome(false, "Tạo giọng lỗi, hệ thống đã hoàn điểm: " + ex.Message);
        }
    }

    private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private void Load()
    {
        var userId = CurrentUserId();
        Voices = _db.Voices
            .Where(x => x.IsActive && x.Status == "Approved" && (!x.OwnerUserId.HasValue || x.OwnerUserId == 0 || x.OwnerUserId == userId))
            .OrderBy(x => x.OwnerUserId.HasValue)
            .ThenBy(x => x.Name)
            .ToList();

        Packages = _db.Packages
            .Where(x => x.IsActive && x.BillingPeriod == "Monthly")
            .OrderBy(x => x.SortOrder)
            .Take(3)
            .ToList();

        RecentJobs = _db.VoiceJobs
            .Where(x => x.UserId == userId && x.Status == "Completed")
            .OrderByDescending(x => x.CreatedAt)
            .Take(5)
            .ToList();

        CurrentBalance = _db.Users.First(x => x.Id == userId).PointBalance;
        LowPointWarning = _config.GetValue<int?>("BusinessRules:LowPointWarning") ?? 3000;
        if (VoiceId == 0 && Voices.Any())
        {
            VoiceId = Voices[0].Id;
        }
    }

    private sealed record GenerateVoiceOutcome(bool Ok, string Message, bool RedirectToPackages = false);

    private sealed class GenerateVoiceAjaxResponse
    {
        public bool Ok { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? RedirectUrl { get; set; }
        public int CurrentBalance { get; set; }
        public int LowPointWarning { get; set; }
        public List<RecentJobDto> RecentJobs { get; set; } = new();
    }

    private sealed class RecentJobDto
    {
        public string TextPreview { get; set; } = string.Empty;
        public string VoiceName { get; set; } = string.Empty;
        public int CharacterCount { get; set; }
        public string AudioUrl { get; set; } = string.Empty;
        public string CreatedAtText { get; set; } = string.Empty;
    }
}
