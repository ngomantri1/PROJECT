using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class VoicesModel : PageModel
{
    private readonly AppDbContext _db;

    public VoicesModel(AppDbContext db)
    {
        _db = db;
    }

    public List<VoiceOption> Voices { get; set; } = new();

    public void OnGet()
    {
        Voices = _db.Voices
            .Where(x => x.IsActive && x.IsSystemVoice && x.Status == "Approved")
            .ToList();
    }
}
