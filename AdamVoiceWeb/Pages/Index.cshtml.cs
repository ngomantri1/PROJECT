using System.Security.Claims;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class IndexModel : PageModel
{
    private readonly DataStore _store;
    private readonly TextPreprocessService _textService;
    private readonly ElevenLabsService _tts;
    private readonly IConfiguration _config;

    public IndexModel(DataStore store, TextPreprocessService textService, ElevenLabsService tts, IConfiguration config)
    {
        _store = store;
        _textService = textService;
        _tts = tts;
        _config = config;
    }

    public List<VoiceOption> Voices { get; set; } = new();
    public List<PointPackage> Packages { get; set; } = new();
    public List<VoiceJob> RecentJobs { get; set; } = new();
    public int CurrentBalance { get; set; }
    public int LowPointWarning { get; set; }

    [BindProperty] public string Text { get; set; } = "Hello các con vợ, lại là em Yến đây! Nếu bạn đang tìm một món ăn vừa ngon miệng, vừa nóng hổi, vừa đậm đà hương vị quê nhà thì bánh canh em Yến chính là lựa chọn hoàn hảo!";
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
        if (outcome.Ok) Success = outcome.Message;
        else Error = outcome.Message;
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

    private async Task<GenerateVoiceOutcome> GenerateVoiceCoreAsync()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var maxChars = _config.GetValue<int?>("BusinessRules:MaxCharactersPerJob") ?? 8000;
        var maxJobs = _config.GetValue<int?>("BusinessRules:MaxJobsPer10Minutes") ?? 10;
        var originalText = Text ?? "";
        var normalized = AutoNormalize ? _textService.Normalize(originalText) : originalText.Trim();
        var originalCount = _textService.CountCharacters(originalText);
        var charCount = _textService.CountCharacters(normalized);

        if (charCount <= 0)
            return new GenerateVoiceOutcome(false, "Anh chưa nhập nội dung.");

        if (charCount > maxChars)
            return new GenerateVoiceOutcome(false, $"Mỗi lần tạo giới hạn {maxChars:N0} ký tự để bảo vệ hệ thống.");

        var db = _store.Read();
        var user = db.Users.First(x => x.Id == userId);
        if (user.IsLocked)
            return new GenerateVoiceOutcome(false, "Tài khoản đã bị khóa. Vui lòng liên hệ admin.");

        var recentCount = db.VoiceJobs.Count(x => x.UserId == userId && x.CreatedAt > DateTime.Now.AddMinutes(-10));
        if (recentCount >= maxJobs)
            return new GenerateVoiceOutcome(false, $"Anh tạo hơi nhanh. Vui lòng chờ thêm ít phút rồi thử lại. Giới hạn {maxJobs} lần/10 phút.");

        var voice = db.Voices.FirstOrDefault(x => x.Id == VoiceId && x.IsActive && x.Status == "Approved" && (!x.OwnerUserId.HasValue || x.OwnerUserId == 0 || x.OwnerUserId == userId));
        if (voice == null)
            return new GenerateVoiceOutcome(false, "Giọng nói không hợp lệ.");

        var cost = (int)Math.Ceiling(charCount * voice.PointRate);
        if (user.PointBalance < cost)
            return new GenerateVoiceOutcome(false, $"Không đủ điểm. Cần {cost:N0} điểm, hiện có {user.PointBalance:N0} điểm.", true);

        try
        {
            int balanceBefore = 0, balanceAfter = 0;
            _store.Update(d =>
            {
                var u = d.Users.First(x => x.Id == userId);
                balanceBefore = u.PointBalance;
                u.PointBalance -= cost;
                balanceAfter = u.PointBalance;
                d.PointTransactions.Add(new PointTransaction
                {
                    Id = d.NextTransactionId++,
                    UserId = userId,
                    Type = "UsePoint",
                    PointAmount = -cost,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = balanceAfter,
                    Note = $"Tạo giọng {voice.Name}, {charCount:N0} ký tự",
                    Status = "Completed"
                });
                return 0;
            });

            var audioUrl = await _tts.GenerateSpeechAsync(normalized, voice, Stability, Similarity, Style, Speed);

            _store.Update(d =>
            {
                d.VoiceJobs.Add(new VoiceJob
                {
                    Id = d.NextJobId++,
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
                return 0;
            });

            return new GenerateVoiceOutcome(true, $"Tạo giọng thành công. Đã trừ {cost:N0} điểm. Nghe lại/tải lại trong lịch sử không trừ điểm.");
        }
        catch (Exception ex)
        {
            _store.Update(d =>
            {
                var u = d.Users.First(x => x.Id == userId);
                var before = u.PointBalance;
                u.PointBalance += cost;
                d.PointTransactions.Add(new PointTransaction
                {
                    Id = d.NextTransactionId++,
                    UserId = userId,
                    Type = "RefundPoint",
                    PointAmount = cost,
                    BalanceBefore = before,
                    BalanceAfter = u.PointBalance,
                    Note = "Hoàn điểm do tạo giọng lỗi: " + ex.Message,
                    Status = "Completed"
                });
                d.VoiceJobs.Add(new VoiceJob
                {
                    Id = d.NextJobId++,
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
                return 0;
            });

            return new GenerateVoiceOutcome(false, "Tạo giọng lỗi, hệ thống đã hoàn điểm: " + ex.Message);
        }
    }

    private void Load()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var db = _store.Read();
        Voices = db.Voices.Where(x => x.IsActive && x.Status == "Approved" && (!x.OwnerUserId.HasValue || x.OwnerUserId == 0 || x.OwnerUserId == userId)).OrderBy(x => x.OwnerUserId.HasValue).ThenBy(x => x.Name).ToList();
        Packages = db.Packages.Where(x => x.IsActive && x.BillingPeriod == "Monthly").OrderBy(x => x.SortOrder).Take(3).ToList();
        RecentJobs = db.VoiceJobs.Where(x => x.UserId == userId && x.Status == "Completed").OrderByDescending(x => x.CreatedAt).Take(5).ToList();
        CurrentBalance = db.Users.First(x => x.Id == userId).PointBalance;
        LowPointWarning = _config.GetValue<int?>("BusinessRules:LowPointWarning") ?? 3000;
        if (VoiceId == 0 && Voices.Any()) VoiceId = Voices[0].Id;
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
