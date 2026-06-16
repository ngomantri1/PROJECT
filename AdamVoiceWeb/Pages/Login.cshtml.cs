using System.Security.Claims;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace AdamVoiceWeb.Pages;

public class LoginModel : PageModel
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public LoginModel(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    [TempData] public string? Error { get; set; }

    public bool IsGoogleConfigured =>
        !string.IsNullOrWhiteSpace(_configuration["Authentication:Google:ClientId"]) &&
        !string.IsNullOrWhiteSpace(_configuration["Authentication:Google:ClientSecret"]);

    public IActionResult OnGet(string? error = null)
    {
        if (!string.IsNullOrWhiteSpace(error))
        {
            Error = error;
        }

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(currentUserId, out _))
        {
            return RedirectToPage("/Index");
        }

        return Page();
    }

    public IActionResult OnPostGoogle(string? returnUrl = null)
    {
        if (!IsGoogleConfigured)
        {
            Error = "Chưa cấu hình Google đăng nhập.";
            return RedirectToPage(new { error = Error });
        }

        var redirectUrl = Url.Page("/Login", "GoogleCallback", new { returnUrl }) ?? "/Login?handler=GoogleCallback";
        var properties = new AuthenticationProperties
        {
            RedirectUri = redirectUrl
        };

        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    public async Task<IActionResult> OnGetGoogleCallbackAsync(string? returnUrl = null)
    {
        var externalId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        var displayName = User.FindFirstValue(ClaimTypes.Name) ?? email ?? string.Empty;

        if (string.IsNullOrWhiteSpace(externalId) || string.IsNullOrWhiteSpace(email))
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToPage(new { error = "Không lấy được thông tin tài khoản Google." });
        }

        email = email.Trim();
        displayName = displayName.Trim();

        var user = _db.Users.FirstOrDefault(x => x.AuthProvider == "Google" && x.ExternalId == externalId);
        if (user == null)
        {
            user = _db.Users.FirstOrDefault(x => EF.Functions.Collate(x.Username, "NOCASE") == email);
        }

        if (user == null)
        {
            user = new AppUser
            {
                Username = email,
                PasswordHash = string.Empty,
                AuthProvider = "Google",
                ExternalId = externalId,
                FullName = displayName,
                Role = IsAdminEmail(email) ? "Admin" : "Member",
                PointBalance = 5000
            };

            _db.Users.Add(user);
            _db.SaveChanges();

            _db.PointTransactions.Add(new PointTransaction
            {
                UserId = user.Id,
                Type = "AddPoint",
                PointAmount = 5000,
                BalanceBefore = 0,
                BalanceAfter = 5000,
                Note = "Tặng điểm đăng ký bằng Google"
            });
            _db.SaveChanges();
        }
        else
        {
            if (string.IsNullOrWhiteSpace(user.AuthProvider))
            {
                user.AuthProvider = "Google";
            }

            if (string.IsNullOrWhiteSpace(user.ExternalId))
            {
                user.ExternalId = externalId;
            }

            if (string.IsNullOrWhiteSpace(user.Username))
            {
                user.Username = email;
            }

            if (string.IsNullOrWhiteSpace(user.FullName))
            {
                user.FullName = displayName;
            }

            if (IsAdminEmail(email))
            {
                user.Role = "Admin";
            }
        }

        if (user.IsLocked)
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToPage(new { error = "Tài khoản đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ." });
        }

        user.LastLoginAt = DateTime.Now;
        _db.SaveChanges();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));

        if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            return LocalRedirect(returnUrl);
        }

        return RedirectToPage("/Index");
    }

    private bool IsAdminEmail(string email)
    {
        var configured = _configuration["Authentication:Google:AdminEmails"] ?? string.Empty;
        var emails = configured
            .Split(new[] { ',', ';', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return emails.Any(x => string.Equals(x, email, StringComparison.OrdinalIgnoreCase));
    }
}
