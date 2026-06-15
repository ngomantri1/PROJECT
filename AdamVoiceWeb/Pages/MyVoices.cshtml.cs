using System.Security.Claims;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class MyVoicesModel : PageModel
{
    private readonly DataStore _store;
    public MyVoicesModel(DataStore store) => _store = store;
    public List<VoiceOption> MyVoices { get; set; } = new();
    [TempData] public string? Message { get; set; }
    [TempData] public string? Error { get; set; }

    public void OnGet() => Load();

    public IActionResult OnPostAddByVoiceId(string name, string description, string apiVoiceId)
    {
        var userId = CurrentUserId();
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(apiVoiceId))
        {
            Error = "Vui lòng nhập tên giọng và Voice ID.";
            return RedirectToPage();
        }

        _store.Update(db =>
        {
            db.Voices.Add(new VoiceOption
            {
                Id = db.NextVoiceId++,
                Name = name.Trim(),
                Description = string.IsNullOrWhiteSpace(description) ? "Giọng riêng của bạn" : description.Trim(),
                ApiVoiceId = apiVoiceId.Trim(),
                PointRate = 2m,
                AvatarEmoji = "🎤",
                IsActive = true,
                OwnerUserId = userId,
                IsSystemVoice = false,
                Status = "Approved",
                UserNote = "Khách tự thêm bằng Voice ID",
                AdminNote = "Đã tự kích hoạt bằng Voice ID",
                CreatedAt = DateTime.Now
            });
            return 0;
        });
        Message = "Đã thêm giọng riêng. Giọng này sẽ xuất hiện trong trang Tạo giọng nói.";
        return RedirectToPage();
    }

    public IActionResult OnPostCreateRequest(string name, string userNote)
    {
        var userId = CurrentUserId();
        if (string.IsNullOrWhiteSpace(name))
        {
            Error = "Vui lòng nhập tên giọng muốn tạo.";
            return RedirectToPage();
        }

        _store.Update(db =>
        {
            db.Voices.Add(new VoiceOption
            {
                Id = db.NextVoiceId++,
                Name = name.Trim(),
                Description = "Yêu cầu tạo giọng riêng",
                ApiVoiceId = "",
                PointRate = 2m,
                AvatarEmoji = "🎤",
                IsActive = false,
                OwnerUserId = userId,
                IsSystemVoice = false,
                Status = "Pending",
                UserNote = userNote?.Trim() ?? "",
                AdminNote = "Chờ admin tạo/clone giọng và điền Voice ID",
                CreatedAt = DateTime.Now
            });
            return 0;
        });
        Message = "Đã gửi yêu cầu tạo giọng. Khi admin duyệt, giọng sẽ hiện ở trang Tạo giọng nói.";
        return RedirectToPage();
    }

    public IActionResult OnPostDelete(int voiceId)
    {
        var userId = CurrentUserId();
        _store.Update(db =>
        {
            var v = db.Voices.FirstOrDefault(x => x.Id == voiceId && x.OwnerUserId == userId);
            if (v != null) v.IsActive = false;
            return 0;
        });
        Message = "Đã ẩn giọng khỏi tài khoản.";
        return RedirectToPage();
    }

    public string StatusText(string status) => status switch
    {
        "Approved" => "Đã duyệt",
        "Pending" => "Chờ duyệt",
        "Rejected" => "Từ chối",
        _ => status
    };

    private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private void Load()
    {
        var userId = CurrentUserId();
        var db = _store.Read();
        MyVoices = db.Voices
            .Where(x => x.OwnerUserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
    }
}
