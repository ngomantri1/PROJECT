using System.Security.Claims;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class MyVoicesModel : PageModel
{
    private readonly AppDbContext _db;

    public MyVoicesModel(AppDbContext db)
    {
        _db = db;
    }

    public List<VoiceOption> MyVoices { get; set; } = new();

    [TempData] public string? Message { get; set; }
    [TempData] public string? Error { get; set; }

    public void OnGet()
    {
        Load();
    }

    public IActionResult OnPostAddByVoiceId(string name, string description, string apiVoiceId)
    {
        var userId = CurrentUserId();
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(apiVoiceId))
        {
            Error = "Vui l\u00f2ng nh\u1eadp t\u00ean gi\u1ecdng v\u00e0 Voice ID.";
            return RedirectToPage();
        }

        _db.Voices.Add(new VoiceOption
        {
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? "Gi\u1ecdng ri\u00eang c\u1ee7a b\u1ea1n" : description.Trim(),
            ApiVoiceId = apiVoiceId.Trim(),
            PointRate = 2m,
            AvatarEmoji = "\uD83C\uDFA4",
            IsActive = true,
            OwnerUserId = userId,
            IsSystemVoice = false,
            Status = "Approved",
            UserNote = "Kh\u00e1ch t\u1ef1 th\u00eam b\u1eb1ng Voice ID",
            AdminNote = "\u0110\u00e3 t\u1ef1 k\u00edch ho\u1ea1t b\u1eb1ng Voice ID",
            CreatedAt = DateTime.Now
        });
        _db.SaveChanges();

        Message = "\u0110\u00e3 th\u00eam gi\u1ecdng ri\u00eang. Gi\u1ecdng n\u00e0y s\u1ebd xu\u1ea5t hi\u1ec7n trong trang T\u1ea1o gi\u1ecdng n\u00f3i.";
        return RedirectToPage();
    }

    public IActionResult OnPostCreateRequest(string name, string userNote)
    {
        var userId = CurrentUserId();
        if (string.IsNullOrWhiteSpace(name))
        {
            Error = "Vui l\u00f2ng nh\u1eadp t\u00ean gi\u1ecdng mu\u1ed1n t\u1ea1o.";
            return RedirectToPage();
        }

        _db.Voices.Add(new VoiceOption
        {
            Name = name.Trim(),
            Description = "Y\u00eau c\u1ea7u t\u1ea1o gi\u1ecdng ri\u00eang",
            ApiVoiceId = "",
            PointRate = 2m,
            AvatarEmoji = "\uD83C\uDFA4",
            IsActive = false,
            OwnerUserId = userId,
            IsSystemVoice = false,
            Status = "Pending",
            UserNote = userNote?.Trim() ?? "",
            AdminNote = "Ch\u1edd admin t\u1ea1o/clone gi\u1ecdng v\u00e0 \u0111i\u1ec1n Voice ID",
            CreatedAt = DateTime.Now
        });
        _db.SaveChanges();

        Message = "\u0110\u00e3 g\u1eedi y\u00eau c\u1ea7u t\u1ea1o gi\u1ecdng. Khi admin duy\u1ec7t, gi\u1ecdng s\u1ebd hi\u1ec7n \u1edf trang T\u1ea1o gi\u1ecdng n\u00f3i.";
        return RedirectToPage();
    }

    public IActionResult OnPostDelete(int voiceId)
    {
        var userId = CurrentUserId();
        var voice = _db.Voices.FirstOrDefault(x => x.Id == voiceId && x.OwnerUserId == userId);
        if (voice != null)
        {
            voice.IsActive = false;
            _db.SaveChanges();
        }

        Message = "\u0110\u00e3 \u1ea9n gi\u1ecdng kh\u1ecfi t\u00e0i kho\u1ea3n.";
        return RedirectToPage();
    }

    public string StatusText(string status) => status switch
    {
        "Approved" => "\u0110\u00e3 duy\u1ec7t",
        "Pending" => "Ch\u1edd duy\u1ec7t",
        "Rejected" => "T\u1eeb ch\u1ed1i",
        _ => status
    };

    private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private void Load()
    {
        var userId = CurrentUserId();
        MyVoices = _db.Voices
            .Where(x => x.OwnerUserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
    }
}
