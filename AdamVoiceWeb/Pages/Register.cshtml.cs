using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class RegisterModel : PageModel
{
    public IActionResult OnGet()
    {
        return RedirectToPage("/Login");
    }

    public IActionResult OnPost()
    {
        return RedirectToPage("/Login");
    }
}
