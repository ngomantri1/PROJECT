using System.Security.Claims;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class TransactionsModel : PageModel
{
    private readonly AppDbContext _db;

    public TransactionsModel(AppDbContext db)
    {
        _db = db;
    }

    public List<PointTransaction> Transactions { get; set; } = new();

    public void OnGet()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        Transactions = _db.PointTransactions
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
    }

    public string TypeName(string type) => type switch
    {
        "AddPoint" => "T\u1eb7ng \u0111i\u1ec3m",
        "UsePoint" => "T\u1ea1o gi\u1ecdng",
        "RefundPoint" => "Ho\u00e0n \u0111i\u1ec3m",
        "PurchaseApproved" => "Mua g\u00f3i",
        "AdminAdjust" => "Admin \u0111i\u1ec1u ch\u1ec9nh",
        _ => type
    };
}
