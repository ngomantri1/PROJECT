using System.Security.Claims;
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
    private readonly IConfiguration _config;

    public IndexModel(AppDbContext db, TextPreprocessService textService, ElevenLabsService tts, IConfiguration config)
    {
        _db = db;
        _textService = textService;
        _tts = tts;
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
            return new JsonResult(new { ok = false, message = "Gi\u1ecdng n\u00f3i kh\u00f4ng h\u1ee3p l\u1ec7." });
        }

        try
        {
            const string previewText = "Xin chao, day la giong doc thu de anh kiem tra truoc khi tao audio.";
            var audioUrl = await _tts.GenerateSpeechAsync(previewText, voice, 0.5m, 0.8m, 0.35m, 1.0m);
            return new JsonResult(new { ok = true, audioUrl });
        }
        catch (Exception ex)
        {
            return new JsonResult(new { ok = false, message = "Nghe thu giong loi: " + ex.Message });
        }
    }

    private async Task<GenerateVoiceOutcome> GenerateVoiceCoreAsync()
    {
        var userId = CurrentUserId();
        var maxChars = _config.GetValue<int?>("BusinessRules:MaxCharactersPerJob") ?? 8000;
        var maxJobs = _config.GetValue<int?>("BusinessRules:MaxJobsPer10Minutes") ?? 10;
        var originalText = Text ?? "";
        var normalized = AutoNormalize ? _textService.Normalize(originalText) : originalText.Trim();
        var originalCount = _textService.CountCharacters(originalText);
        var charCount = _textService.CountCharacters(normalized);

        if (charCount <= 0)
        {
            return new GenerateVoiceOutcome(false, "Anh ch\u01b0a nh\u1eadp n\u1ed9i dung.");
        }

        if (charCount > maxChars)
        {
            return new GenerateVoiceOutcome(false, $"M\u1ed7i l\u1ea7n t\u1ea1o gi\u1edbi h\u1ea1n {maxChars:N0} k\u00fd t\u1ef1 \u0111\u1ec3 b\u1ea3o v\u1ec7 h\u1ec7 th\u1ed1ng.");
        }

        var user = _db.Users.First(x => x.Id == userId);
        if (user.IsLocked)
        {
            return new GenerateVoiceOutcome(false, "T\u00e0i kho\u1ea3n \u0111\u00e3 b\u1ecb kh\u00f3a. Vui l\u00f2ng li\u00ean h\u1ec7 admin.");
        }

        var recentCount = _db.VoiceJobs.Count(x => x.UserId == userId && x.CreatedAt > DateTime.Now.AddMinutes(-10));
        if (recentCount >= maxJobs)
        {
            return new GenerateVoiceOutcome(false, $"Anh t\u1ea1o h\u01a1i nhanh. Vui l\u00f2ng ch\u1edd th\u00eam \u00edt ph\u00fat r\u1ed3i th\u1eed l\u1ea1i. Gi\u1edbi h\u1ea1n {maxJobs} l\u1ea7n/10 ph\u00fat.");
        }

        var voice = _db.Voices.FirstOrDefault(x =>
            x.Id == VoiceId &&
            x.IsActive &&
            x.Status == "Approved" &&
            (!x.OwnerUserId.HasValue || x.OwnerUserId == 0 || x.OwnerUserId == userId));

        if (voice == null)
        {
            return new GenerateVoiceOutcome(false, "Gi\u1ecdng n\u00f3i kh\u00f4ng h\u1ee3p l\u1ec7.");
        }

        var cost = (int)Math.Ceiling(charCount * voice.PointRate);
        if (user.PointBalance < cost)
        {
            return new GenerateVoiceOutcome(false, $"Kh\u00f4ng \u0111\u1ee7 \u0111i\u1ec3m. C\u1ea7n {cost:N0} \u0111i\u1ec3m, hi\u1ec7n c\u00f3 {user.PointBalance:N0} \u0111i\u1ec3m.", true);
        }

        try
        {
            var debitUser = _db.Users.First(x => x.Id == userId);
            if (debitUser.PointBalance < cost)
            {
                return new GenerateVoiceOutcome(false, $"Kh\u00f4ng \u0111\u1ee7 \u0111i\u1ec3m. C\u1ea7n {cost:N0} \u0111i\u1ec3m, hi\u1ec7n c\u00f3 {debitUser.PointBalance:N0} \u0111i\u1ec3m.", true);
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

            var audioUrl = await _tts.GenerateSpeechAsync(normalized, voice, Stability, Similarity, Style, Speed);

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

            return new GenerateVoiceOutcome(true, $"T\u1ea1o gi\u1ecdng th\u00e0nh c\u00f4ng. \u0110\u00e3 tr\u1eeb {cost:N0} \u0111i\u1ec3m. Nghe l\u1ea1i/t\u1ea3i l\u1ea1i trong l\u1ecbch s\u1eed kh\u00f4ng tr\u1eeb \u0111i\u1ec3m.");
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

            return new GenerateVoiceOutcome(false, "T\u1ea1o gi\u1ecdng l\u1ed7i, h\u1ec7 th\u1ed1ng \u0111\u00e3 ho\u00e0n \u0111i\u1ec3m: " + ex.Message);
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
        public string Message { get; set; } = "";
        public string? RedirectUrl { get; set; }
        public int CurrentBalance { get; set; }
        public int LowPointWarning { get; set; }
        public List<RecentJobDto> RecentJobs { get; set; } = new();
    }

    private sealed class RecentJobDto
    {
        public string TextPreview { get; set; } = "";
        public string VoiceName { get; set; } = "";
        public int CharacterCount { get; set; }
        public string AudioUrl { get; set; } = "";
        public string CreatedAtText { get; set; } = "";
    }
}
