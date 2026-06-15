using System.Security.Claims;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
namespace AdamVoiceWeb.Pages;
public class AccountModel:PageModel
{
    private readonly DataStore _store; public AccountModel(DataStore store)=>_store=store;
    public AppUser UserInfo{get;set;}=new();
    [BindProperty] public string FullName {get;set;}="";
    [BindProperty] public string Phone {get;set;}="";
    [BindProperty] public string ZaloOrTelegram {get;set;}="";
    [BindProperty] public string OldPassword {get;set;}="";
    [BindProperty] public string NewPassword {get;set;}="";
    [TempData] public string? Message{get;set;}
    [TempData] public string? Error{get;set;}
    public void OnGet(){Load();}
    public IActionResult OnPostUpdateProfile()
    {
        var id=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        _store.Update(db=>{var u=db.Users.First(x=>x.Id==id);u.FullName=FullName?.Trim()??"";u.Phone=Phone?.Trim()??"";u.ZaloOrTelegram=ZaloOrTelegram?.Trim()??"";return 0;});
        Message="Đã cập nhật thông tin tài khoản.";return RedirectToPage();
    }
    public IActionResult OnPostChangePassword()
    {
        var id=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if(string.IsNullOrWhiteSpace(NewPassword)||NewPassword.Length<6){Error="Mật khẩu mới cần từ 6 ký tự.";return RedirectToPage();}
        var ok=_store.Update(db=>{var u=db.Users.First(x=>x.Id==id);if(!DataStore.VerifyPassword(OldPassword,u.PasswordHash))return false;u.PasswordHash=DataStore.HashPassword(NewPassword);return true;});
        if(!ok){Error="Mật khẩu cũ không đúng.";}else{Message="Đã đổi mật khẩu.";} return RedirectToPage();
    }
    private void Load(){var id=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!); UserInfo=_store.Read().Users.First(x=>x.Id==id); FullName=UserInfo.FullName; Phone=UserInfo.Phone; ZaloOrTelegram=UserInfo.ZaloOrTelegram;}
}
