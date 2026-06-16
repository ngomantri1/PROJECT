using System.Security.Claims;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class AccountModel : PageModel
{
    private readonly AppDbContext _db;

    public AccountModel(AppDbContext db)
    {
        _db = db;
    }

    public AppUser UserInfo { get; set; } = new();
    public bool CanChangePassword => UserInfo.AuthProvider != "Google";

    [BindProperty] public string FullName { get; set; } = "";
    [BindProperty] public string Phone { get; set; } = "";
    [BindProperty] public string ZaloOrTelegram { get; set; } = "";
    [BindProperty] public string OldPassword { get; set; } = "";
    [BindProperty] public string NewPassword { get; set; } = "";

    [TempData] public string? Message { get; set; }
    [TempData] public string? Error { get; set; }

    public void OnGet()
    {
        Load();
    }

    public IActionResult OnPostUpdateProfile()
    {
        var userId = CurrentUserId();
        var user = _db.Users.First(x => x.Id == userId);
        user.FullName = FullName?.Trim() ?? "";
        user.Phone = Phone?.Trim() ?? "";
        user.ZaloOrTelegram = ZaloOrTelegram?.Trim() ?? "";
        _db.SaveChanges();

        Message = "Đã cập nhật thông tin tài khoản.";
        return RedirectToPage();
    }

    public IActionResult OnPostChangePassword()
    {
        if (string.IsNullOrWhiteSpace(NewPassword) || NewPassword.Length < 6)
        {
            Error = "Mật khẩu mới cần từ 6 ký tự.";
            return RedirectToPage();
        }

        var user = _db.Users.First(x => x.Id == CurrentUserId());
        if (user.AuthProvider == "Google")
        {
            Error = "Tài khoản này đang đăng nhập bằng Google, không dùng mật khẩu nội bộ.";
            return RedirectToPage();
        }

        if (!DataStore.VerifyPassword(OldPassword, user.PasswordHash))
        {
            Error = "Mật khẩu cũ không đúng.";
            return RedirectToPage();
        }

        user.PasswordHash = DataStore.HashPassword(NewPassword);
        _db.SaveChanges();

        Message = "Đã đổi mật khẩu.";
        return RedirectToPage();
    }

    private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private void Load()
    {
        UserInfo = _db.Users.First(x => x.Id == CurrentUserId());
        FullName = UserInfo.FullName;
        Phone = UserInfo.Phone;
        ZaloOrTelegram = UserInfo.ZaloOrTelegram;
    }
}
