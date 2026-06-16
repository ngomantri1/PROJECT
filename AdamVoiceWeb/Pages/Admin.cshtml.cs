using System.Security.Claims;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AdamVoiceWeb.Pages;

public class AdminModel : PageModel
{
    private readonly AppDbContext _db;

    public AdminModel(AppDbContext db)
    {
        _db = db;
    }

    public List<AppUser> Users { get; set; } = new();
    public List<PurchaseOrder> PendingOrders { get; set; } = new();
    public List<PurchaseOrder> RecentOrders { get; set; } = new();
    public List<VoiceOption> Voices { get; set; } = new();
    public List<VoiceOption> PendingCustomVoices { get; set; } = new();
    public List<VoiceJob> RecentJobs { get; set; } = new();
    public List<PointPackage> Packages { get; set; } = new();
    public int TotalUsers { get; set; }
    public int TodayJobs { get; set; }
    public int PendingCount { get; set; }
    public int TodayRevenue { get; set; }
    public int MonthRevenue { get; set; }
    public int TodayCharacters { get; set; }
    public int MonthCharacters { get; set; }

    [TempData] public string? Message { get; set; }

    public void OnGet()
    {
        Load();
    }

    public IActionResult OnPostApproveOrder(int orderId, string adminNote)
    {
        var adminId = CurrentUserId();
        var order = _db.PurchaseOrders.First(x => x.Id == orderId);
        if (order.Status == "Pending")
        {
            var user = _db.Users.First(x => x.Id == order.UserId);
            var before = user.PointBalance;
            user.PointBalance += order.Points;
            order.Status = "Paid";
            order.AdminNote = string.IsNullOrWhiteSpace(adminNote) ? "Admin da duyet" : adminNote;
            order.ApprovedAt = DateTime.Now;
            order.ApprovedByUserId = adminId;

            _db.PointTransactions.Add(new PointTransaction
            {
                UserId = order.UserId,
                Type = "PurchaseApproved",
                PointAmount = order.Points,
                BalanceBefore = before,
                BalanceAfter = user.PointBalance,
                PackageId = order.PackageId,
                PurchaseOrderId = order.Id,
                OrderCode = order.OrderCode,
                Status = "Completed",
                Note = $"Duyet don {order.OrderCode} - {order.PackageName}",
                CreatedByUserId = adminId
            });

            _db.SaveChanges();
        }

        Message = "\u0110\u00e3 duy\u1ec7t \u0111\u01a1n v\u00e0 c\u1ed9ng \u0111i\u1ec3m cho kh\u00e1ch.";
        return RedirectToPage();
    }

    public IActionResult OnPostRejectOrder(int orderId, string adminNote)
    {
        var order = _db.PurchaseOrders.First(x => x.Id == orderId);
        if (order.Status == "Pending")
        {
            order.Status = "Cancelled";
            order.AdminNote = string.IsNullOrWhiteSpace(adminNote) ? "Admin huy don" : adminNote;
            order.ApprovedAt = DateTime.Now;
            order.ApprovedByUserId = CurrentUserId();
            _db.SaveChanges();
        }

        Message = "\u0110\u00e3 h\u1ee7y \u0111\u01a1n.";
        return RedirectToPage();
    }

    public IActionResult OnPostAddPoint(int userId, int points, string note)
    {
        var adminId = CurrentUserId();
        var user = _db.Users.First(x => x.Id == userId);
        var before = user.PointBalance;
        user.PointBalance += points;

        _db.PointTransactions.Add(new PointTransaction
        {
            UserId = userId,
            Type = "AdminAdjust",
            PointAmount = points,
            BalanceBefore = before,
            BalanceAfter = user.PointBalance,
            Note = string.IsNullOrWhiteSpace(note) ? "Admin dieu chinh diem" : note,
            CreatedByUserId = adminId
        });

        _db.SaveChanges();
        Message = "\u0110\u00e3 c\u1eadp nh\u1eadt \u0111i\u1ec3m.";
        return RedirectToPage();
    }

    public IActionResult OnPostToggleLock(int userId)
    {
        var user = _db.Users.First(x => x.Id == userId);
        if (user.Role != "Admin")
        {
            user.IsLocked = !user.IsLocked;
            _db.SaveChanges();
        }

        Message = "\u0110\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i t\u00e0i kho\u1ea3n.";
        return RedirectToPage();
    }

    public IActionResult OnPostUpdateVoice(int voiceId, string name, string description, string apiVoiceId, decimal rate, string avatarEmoji, bool isActive)
    {
        var voice = _db.Voices.First(x => x.Id == voiceId);
        voice.Name = name;
        voice.Description = description;
        voice.ApiVoiceId = apiVoiceId;
        voice.PointRate = rate <= 0 ? 1 : rate;
        voice.AvatarEmoji = string.IsNullOrWhiteSpace(avatarEmoji) ? "V" : avatarEmoji;
        voice.IsActive = isActive;
        if (string.IsNullOrWhiteSpace(voice.Status))
        {
            voice.Status = "Approved";
        }

        _db.SaveChanges();
        Message = "\u0110\u00e3 c\u1eadp nh\u1eadt gi\u1ecdng.";
        return RedirectToPage();
    }

    public IActionResult OnPostApproveCustomVoice(int voiceId, string apiVoiceId, decimal rate, string adminNote)
    {
        var voice = _db.Voices.First(x => x.Id == voiceId);
        voice.ApiVoiceId = apiVoiceId?.Trim() ?? "";
        voice.PointRate = rate <= 0 ? 2 : rate;
        voice.Status = "Approved";
        voice.IsActive = true;
        voice.AdminNote = string.IsNullOrWhiteSpace(adminNote) ? "Admin da duyet giong rieng" : adminNote;
        voice.IsSystemVoice = false;
        _db.SaveChanges();

        Message = "\u0110\u00e3 duy\u1ec7t gi\u1ecdng ri\u00eang cho kh\u00e1ch.";
        return RedirectToPage();
    }

    public IActionResult OnPostRejectCustomVoice(int voiceId, string adminNote)
    {
        var voice = _db.Voices.First(x => x.Id == voiceId);
        voice.Status = "Rejected";
        voice.IsActive = false;
        voice.AdminNote = string.IsNullOrWhiteSpace(adminNote) ? "Admin tu choi yeu cau" : adminNote;
        _db.SaveChanges();

        Message = "\u0110\u00e3 t\u1eeb ch\u1ed1i y\u00eau c\u1ea7u gi\u1ecdng ri\u00eang.";
        return RedirectToPage();
    }

    public IActionResult OnPostUpdatePackage(int packageId, string name, string planCode, string billingPeriod, int priceVnd, int points, int monthlyEquivalentVnd, int annualDiscountPercent, int sortOrder, string description, bool isPopular, bool isActive)
    {
        var package = _db.Packages.First(x => x.Id == packageId);
        package.Name = name;
        package.PlanCode = planCode ?? name;
        package.BillingPeriod = billingPeriod == "Yearly" ? "Yearly" : "Monthly";
        package.PriceVnd = priceVnd;
        package.Points = points;
        package.MonthlyEquivalentVnd = monthlyEquivalentVnd <= 0
            ? (package.BillingPeriod == "Yearly" ? (int)Math.Ceiling(priceVnd / 12m) : priceVnd)
            : monthlyEquivalentVnd;
        package.AnnualDiscountPercent = annualDiscountPercent;
        package.SortOrder = sortOrder;
        package.Description = description ?? "";
        package.IsPopular = isPopular;
        package.IsActive = isActive;
        _db.SaveChanges();

        Message = "\u0110\u00e3 c\u1eadp nh\u1eadt g\u00f3i credits.";
        return RedirectToPage();
    }

    public string UserName(int id) => Users.FirstOrDefault(x => x.Id == id)?.Username ?? id.ToString();

    private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private void Load()
    {
        var today = DateTime.Today;
        var month = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);

        Users = _db.Users.OrderBy(x => x.Username).ToList();
        PendingOrders = _db.PurchaseOrders.Where(x => x.Status == "Pending").OrderByDescending(x => x.CreatedAt).ToList();
        RecentOrders = _db.PurchaseOrders.OrderByDescending(x => x.CreatedAt).Take(30).ToList();
        Voices = _db.Voices.ToList();
        PendingCustomVoices = _db.Voices.Where(x => x.OwnerUserId.HasValue && x.Status == "Pending").OrderByDescending(x => x.CreatedAt).ToList();
        Packages = _db.Packages.OrderBy(x => x.BillingPeriod).ThenBy(x => x.SortOrder).ToList();
        RecentJobs = _db.VoiceJobs.OrderByDescending(x => x.CreatedAt).Take(20).ToList();

        TotalUsers = Users.Count;
        PendingCount = PendingOrders.Count;
        TodayJobs = _db.VoiceJobs.Count(x => x.CreatedAt >= today);
        TodayCharacters = _db.VoiceJobs.Where(x => x.CreatedAt >= today && x.Status == "Completed").Sum(x => x.CharacterCount);
        MonthCharacters = _db.VoiceJobs.Where(x => x.CreatedAt >= month && x.Status == "Completed").Sum(x => x.CharacterCount);
        TodayRevenue = _db.PurchaseOrders.Where(x => x.Status == "Paid" && x.ApprovedAt >= today).Sum(x => x.PriceVnd);
        MonthRevenue = _db.PurchaseOrders.Where(x => x.Status == "Paid" && x.ApprovedAt >= month).Sum(x => x.PriceVnd);
    }
}
