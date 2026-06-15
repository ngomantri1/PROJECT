using System.Security.Claims;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
namespace AdamVoiceWeb.Pages;
public class RegisterModel : PageModel
{
    private readonly DataStore _store; public RegisterModel(DataStore store)=>_store=store;
    [BindProperty] public string Username { get; set; }="";
    [BindProperty] public string FullName { get; set; }="";
    [BindProperty] public string Phone { get; set; }="";
    [BindProperty] public string ZaloOrTelegram { get; set; }="";
    [BindProperty] public string Password { get; set; }="";
    public string Error { get; set; }="";
    public async Task<IActionResult> OnPostAsync()
    {
        Username = Username.Trim();
        if(Username.Length<3||Password.Length<6){Error="Tên đăng nhập từ 3 ký tự, mật khẩu từ 6 ký tự.";return Page();}
        if(!Username.All(c=>char.IsLetterOrDigit(c)||c=='_'||c=='-')){Error="Tên đăng nhập chỉ nên gồm chữ, số, dấu gạch ngang hoặc gạch dưới.";return Page();}
        AppUser? created=_store.Update(db=>{
            if(db.Users.Any(x=>x.Username.Equals(Username,StringComparison.OrdinalIgnoreCase))) return null;
            var u=new AppUser{Id=db.NextUserId++,Username=Username,FullName=FullName.Trim(),Phone=Phone.Trim(),ZaloOrTelegram=ZaloOrTelegram.Trim(),Role="Member",PointBalance=5000,PasswordHash=DataStore.HashPassword(Password)};
            db.Users.Add(u);
            db.PointTransactions.Add(new PointTransaction{Id=db.NextTransactionId++,UserId=u.Id,Type="AddPoint",PointAmount=5000,BalanceBefore=0,BalanceAfter=5000,Note="Tặng điểm đăng ký"});
            return u;
        });
        if(created==null){Error="Tên đăng nhập đã tồn tại.";return Page();}
        var claims=new[]{new Claim(ClaimTypes.NameIdentifier,created.Id.ToString()),new Claim(ClaimTypes.Name,created.Username),new Claim(ClaimTypes.Role,created.Role)};
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,new ClaimsPrincipal(new ClaimsIdentity(claims,CookieAuthenticationDefaults.AuthenticationScheme)));
        return RedirectToPage("/Index");
    }
}
