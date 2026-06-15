using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class LoginModel : PageModel
{
    private readonly DataStore _store;
    public LoginModel(DataStore store) { _store = store; }
    [BindProperty, Required] public string Username { get; set; } = "";
    [BindProperty, Required] public string Password { get; set; } = "";
    public string Error { get; set; } = "";

    public async Task<IActionResult> OnPostAsync()
    {
        var db = _store.Read();
        var user = db.Users.FirstOrDefault(x => x.Username.Equals(Username.Trim(), StringComparison.OrdinalIgnoreCase));
        if (user == null || !DataStore.VerifyPassword(Password, user.PasswordHash))
        {
            Error = "Sai tài khoản hoặc mật khẩu.";
            return Page();
        }
        if (user.IsLocked)
        {
            Error = "Tài khoản đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ.";
            return Page();
        }
        _store.Update(d => { var u = d.Users.First(x => x.Id == user.Id); u.LastLoginAt = DateTime.Now; return 0; });
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
        return RedirectToPage("/Index");
    }
}
