using System.Security.Claims;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class PackagesModel : PageModel
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public PackagesModel(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public List<PointPackage> Packages { get; set; } = new();
    public List<PurchaseOrder> MyOrders { get; set; } = new();
    public string Period { get; set; } = "Monthly";
    public int YearDiscount { get; set; } = 10;
    public string BankName => _config["Payment:BankName"] ?? "MB Bank";
    public string AccountName => _config["Payment:AccountName"] ?? "TEN CUA ANH";
    public string AccountNumber => _config["Payment:AccountNumber"] ?? "0123456789";
    public string SupportPhone => _config["Payment:SupportPhone"] ?? "";

    [TempData] public string? Message { get; set; }

    public void OnGet(string? period)
    {
        Load(period);
    }

    public IActionResult OnPostCreateOrder(int packageId)
    {
        var userId = CurrentUserId();
        var package = _db.Packages.First(x => x.Id == packageId && x.IsActive);
        var user = _db.Users.First(x => x.Id == userId);
        var now = DateTime.Now;
        var periodText = package.BillingPeriod == "Yearly" ? "N\u0103m" : "Th\u00e1ng";

        var order = new PurchaseOrder
        {
            UserId = userId,
            PackageId = package.Id,
            PackageName = $"{package.Name} - {periodText}",
            PriceVnd = package.PriceVnd,
            Points = package.Points,
            Status = "Pending",
            CreatedAt = now
        };

        _db.PurchaseOrders.Add(order);
        _db.SaveChanges();

        var code = $"{(_config["Payment:OrderPrefix"] ?? "ADAMVOICE")}{now:yyMMdd}{order.Id:D4}";
        order.OrderCode = code;
        order.TransferContent = $"{code} {user.Username}";
        _db.SaveChanges();

        Message = $"\u0110\u00e3 t\u1ea1o \u0111\u01a1n {code}. Anh chuy\u1ec3n kho\u1ea3n \u0111\u00fang n\u1ed9i dung \u0111\u1ec3 admin duy\u1ec7t nhanh.";
        return RedirectToPage(new { period = Request.Query["period"].ToString() });
    }

    public IActionResult OnPostConfirmPaid(int orderId, string userNote)
    {
        var order = _db.PurchaseOrders.First(x => x.Id == orderId && x.UserId == CurrentUserId());
        if (order.Status == "Pending")
        {
            order.UserNote = userNote ?? "\u0110\u00e3 chuy\u1ec3n kho\u1ea3n";
            order.ConfirmedAt = DateTime.Now;
            _db.SaveChanges();
        }

        Message = "\u0110\u00e3 ghi nh\u1eadn th\u00f4ng b\u00e1o chuy\u1ec3n kho\u1ea3n. Admin ki\u1ec3m tra xong s\u1ebd c\u1ed9ng credits.";
        return RedirectToPage();
    }

    public IActionResult OnPostCancel(int orderId)
    {
        var order = _db.PurchaseOrders.First(x => x.Id == orderId && x.UserId == CurrentUserId());
        if (order.Status == "Pending")
        {
            order.Status = "Cancelled";
            _db.SaveChanges();
        }

        Message = "\u0110\u00e3 h\u1ee7y \u0111\u01a1n mua credits.";
        return RedirectToPage();
    }

    public string FormatCredits(int points)
    {
        if (points >= 1000000)
        {
            return (points / 1000000m).ToString(points % 1000000 == 0 ? "0" : "0.#") + "M";
        }

        if (points >= 1000)
        {
            return (points / 1000m).ToString(points % 1000 == 0 ? "0" : "0.#") + "K";
        }

        return points.ToString("N0");
    }

    private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private void Load(string? period = null)
    {
        var userId = CurrentUserId();
        Period = (period ?? Request.Query["period"].ToString()).Equals("yearly", StringComparison.OrdinalIgnoreCase)
            ? "Yearly"
            : "Monthly";

        Packages = _db.Packages
            .Where(x => x.IsActive && x.BillingPeriod == Period)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.PriceVnd)
            .ToList();

        YearDiscount = _db.Packages
            .Where(x => x.BillingPeriod == "Yearly" && x.AnnualDiscountPercent > 0)
            .Max(x => (int?)x.AnnualDiscountPercent) ?? 10;

        MyOrders = _db.PurchaseOrders
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();
    }
}
