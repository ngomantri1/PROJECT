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
    public PurchaseOrder? SelectedOrder { get; set; }
    public string Period { get; set; } = "Monthly";
    public int YearDiscount { get; set; } = 10;
    public string BankName => _config["Payment:BankName"] ?? "MB Bank";
    public string BankBin => _config["Payment:BankBin"] ?? "970436";
    public string BankAcqId => ResolveBankAcqId(BankBin);
    public string AccountName => _config["Payment:AccountName"] ?? "TEN CUA ANH";
    public string AccountNumber => _config["Payment:AccountNumber"] ?? "0123456789";
    public string SupportPhone => _config["Payment:SupportPhone"] ?? "";
    public string PeriodQuery => Period == "Yearly" ? "yearly" : "monthly";
    public bool HasSelectedOrder => SelectedOrder != null;
    public string SelectedQrContent => SelectedOrder == null ? string.Empty : GetTransferContent(SelectedOrder);

    [TempData] public string? Message { get; set; }
    [TempData] public string? MessageType { get; set; }

    public void OnGet(string? period, int? orderId)
    {
        Load(period, orderId);
    }

    public IActionResult OnPostCreateOrder(int packageId)
    {
        var userId = CurrentUserId();
        var package = _db.Packages.First(x => x.Id == packageId && x.IsActive);
        var now = DateTime.Now;
        var periodText = package.BillingPeriod == "Yearly" ? "Năm" : "Tháng";
        var activeOrder = FindLatestActiveOrder(userId);

        if (activeOrder?.Status == "Reported")
        {
            Message = $"Bạn đã có đơn {activeOrder.OrderCode} và đã báo chuyển khoản trước đó. Hệ thống mở lại đơn này để bạn theo dõi admin duyệt.";
            MessageType = "err";
            return Redirect(BuildPackagesUrl(activeOrder.Id, ResolvePeriodQuery(activeOrder.PackageName.Contains("Năm", StringComparison.OrdinalIgnoreCase) ? "Yearly" : "Monthly"), "payment-section"));
        }

        if (activeOrder?.Status == "Pending")
        {
            if (activeOrder.PackageId == package.Id)
            {
                Message = $"Bạn đang có đơn {activeOrder.OrderCode} chờ chuyển khoản. Hệ thống mở lại đúng đơn này để bạn thanh toán tiếp.";
                MessageType = "err";
                return Redirect(BuildPackagesUrl(activeOrder.Id, ResolvePeriodQuery(package.BillingPeriod), "payment-section"));
            }

            activeOrder.PackageId = package.Id;
            activeOrder.PackageName = $"{package.Name} - {periodText}";
            activeOrder.PriceVnd = package.PriceVnd;
            activeOrder.Points = package.Points;
            _db.SaveChanges();

            Message = $"Bạn đang có đơn {activeOrder.OrderCode} chưa thanh toán. Hệ thống đã cập nhật đơn này sang gói {activeOrder.PackageName}.";
            MessageType = "err";
            return Redirect(BuildPackagesUrl(activeOrder.Id, ResolvePeriodQuery(package.BillingPeriod), "payment-section"));
        }

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
        order.TransferContent = code;
        _db.SaveChanges();

        Message = $"Đã tạo đơn {code}. Chuyển khoản đúng nội dung để hệ thống duyệt nhanh.";
        MessageType = "ok";
        return Redirect(BuildPackagesUrl(order.Id, ResolvePeriodQuery(package.BillingPeriod), "payment-section"));
    }

    public IActionResult OnPostConfirmPaid(int orderId, string? userNote, string? period)
    {
        var order = _db.PurchaseOrders.First(x => x.Id == orderId && x.UserId == CurrentUserId());

        if (order.Status == "Reported")
        {
            Message = $"Đơn {order.OrderCode} đã được báo chuyển khoản trước đó. Admin sẽ kiểm tra và cộng credits sau khi đối soát.";
            MessageType = "err";
            return Redirect(BuildPackagesUrl(order.Id, ResolvePeriodQuery(order.PackageName.Contains("Năm", StringComparison.OrdinalIgnoreCase) ? "Yearly" : "Monthly"), "payment-section"));
        }

        if (order.Status == "Pending")
        {
            order.Status = "Reported";
            order.UserNote = string.IsNullOrWhiteSpace(userNote) ? "Đã chuyển khoản" : userNote.Trim();
            order.ConfirmedAt = DateTime.Now;
            _db.SaveChanges();
            Message = $"Đã ghi nhận thông báo chuyển khoản cho đơn {order.OrderCode}. Admin kiểm tra xong sẽ cộng credits.";
            MessageType = "ok";
        }
        else
        {
            Message = $"Đơn {order.OrderCode} không còn ở trạng thái chờ thanh toán.";
            MessageType = "err";
        }

        return Redirect(BuildPackagesUrl(order.Id, ResolvePeriodQuery(order.PackageName.Contains("Năm", StringComparison.OrdinalIgnoreCase) ? "Yearly" : "Monthly"), "payment-section"));
    }

    public IActionResult OnPostCancel(int orderId, string? period)
    {
        var order = _db.PurchaseOrders.First(x => x.Id == orderId && x.UserId == CurrentUserId());
        if (order.Status == "Pending")
        {
            order.Status = "Cancelled";
            _db.SaveChanges();
            Message = "Đã hủy đơn mua credits.";
            MessageType = "ok";
            return RedirectToPage(new { period = ResolvePeriodQuery(period) });
        }

        Message = "Đơn đã báo chuyển khoản nên không thể hủy nữa. Nếu cần xử lý, anh vào admin để đối soát.";
        MessageType = "err";
        return Redirect(BuildPackagesUrl(order.Id, ResolvePeriodQuery(period), "payment-section"));
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

    public string BuildPaymentUrl(PurchaseOrder order)
    {
        return BuildPackagesUrl(order.Id, PeriodQuery, "payment-section");
    }

    public string GetTransferContent(PurchaseOrder order)
    {
        return string.IsNullOrWhiteSpace(order.OrderCode) ? order.TransferContent : order.OrderCode;
    }

    public string GetOrderStatusText(string status) => status switch
    {
        "Pending" => "Chờ chuyển khoản",
        "Reported" => "Đã báo chuyển khoản",
        "Paid" => "Đã cộng điểm",
        "Cancelled" => "Đã hủy",
        _ => status
    };

    private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private PurchaseOrder? FindLatestActiveOrder(int userId)
    {
        return _db.PurchaseOrders
            .Where(x => x.UserId == userId && (x.Status == "Pending" || x.Status == "Reported"))
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefault();
    }

    private void Load(string? period = null, int? orderId = null)
    {
        var userId = CurrentUserId();
        Period = ResolvePeriod(period);

        Packages = _db.Packages
            .Where(x => x.IsActive && x.BillingPeriod == Period)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.PriceVnd)
            .ToList();

        YearDiscount = _db.Packages
            .Where(x => x.BillingPeriod == "Yearly" && x.AnnualDiscountPercent > 0)
            .Max(x => (int?)x.AnnualDiscountPercent) ?? 10;

        if (orderId.HasValue)
        {
            SelectedOrder = _db.PurchaseOrders
                .FirstOrDefault(x => x.Id == orderId.Value && x.UserId == userId);
        }

        MyOrders = _db.PurchaseOrders
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(12)
            .ToList();
    }

    private string ResolvePeriod(string? period)
    {
        return ResolvePeriodQuery(period).Equals("yearly", StringComparison.OrdinalIgnoreCase)
            ? "Yearly"
            : "Monthly";
    }

    private string ResolvePeriodQuery(string? period)
    {
        if (!string.IsNullOrWhiteSpace(period))
        {
            return period.Equals("Yearly", StringComparison.OrdinalIgnoreCase) ? "yearly" :
                period.Equals("yearly", StringComparison.OrdinalIgnoreCase) ? "yearly" :
                "monthly";
        }

        var queryPeriod = Request.Query["period"].ToString();
        return queryPeriod.Equals("yearly", StringComparison.OrdinalIgnoreCase) ? "yearly" : "monthly";
    }

    private string BuildPackagesUrl(int orderId, string periodQuery, string? fragment = null)
    {
        var url = Url.Page("/Packages", new { period = periodQuery, orderId }) ?? $"/Packages?period={periodQuery}&orderId={orderId}";
        return string.IsNullOrWhiteSpace(fragment) ? url : $"{url}#{fragment}";
    }

    private string ResolveBankAcqId(string bankBin)
    {
        if (string.IsNullOrWhiteSpace(bankBin))
        {
            return "970436";
        }

        var value = bankBin.Trim();
        if (value.All(char.IsDigit))
        {
            return value;
        }

        return value.ToUpperInvariant() switch
        {
            "VCB" or "VIETCOMBANK" => "970436",
            "MBBANK" or "MB" => "970422",
            "TCB" or "TECHCOMBANK" => "970407",
            "ACB" => "970416",
            _ => "970436"
        };
    }
}
