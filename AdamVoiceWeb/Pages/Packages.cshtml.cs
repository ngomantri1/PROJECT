using System.Security.Claims;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
namespace AdamVoiceWeb.Pages;
public class PackagesModel:PageModel
{
    private readonly DataStore _store; private readonly IConfiguration _config;
    public PackagesModel(DataStore store, IConfiguration config){_store=store;_config=config;}
    public List<PointPackage> Packages{get;set;}=new();
    public List<PurchaseOrder> MyOrders{get;set;}=new();
    public string Period{get;set;}="Monthly";
    public int YearDiscount{get;set;}=10;
    public string BankName=>_config["Payment:BankName"]??"MB Bank";
    public string AccountName=>_config["Payment:AccountName"]??"TEN CUA ANH";
    public string AccountNumber=>_config["Payment:AccountNumber"]??"0123456789";
    public string SupportPhone=>_config["Payment:SupportPhone"]??"";
    [TempData] public string? Message{get;set;}
    public void OnGet(string? period){Load(period);}
    public IActionResult OnPostCreateOrder(int packageId)
    {
        var userId=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        string? code=null;
        _store.Update(db=>{
            var p=db.Packages.First(x=>x.Id==packageId && x.IsActive);
            var user=db.Users.First(x=>x.Id==userId);
            code=$"{(_config["Payment:OrderPrefix"]??"ADAMVOICE")}{DateTime.Now:yyMMdd}{db.NextPurchaseOrderId:D4}";
            var periodText=p.BillingPeriod=="Yearly"?"Năm":"Tháng";
            var order=new PurchaseOrder{Id=db.NextPurchaseOrderId++,OrderCode=code,UserId=userId,PackageId=p.Id,PackageName=$"{p.Name} - {periodText}",PriceVnd=p.PriceVnd,Points=p.Points,TransferContent=$"{code} {user.Username}",Status="Pending"};
            db.PurchaseOrders.Add(order);
            return 0;
        });
        Message=$"Đã tạo đơn {code}. Anh chuyển khoản đúng nội dung để admin duyệt nhanh.";
        return RedirectToPage(new { period = Request.Query["period"].ToString() });
    }
    public IActionResult OnPostConfirmPaid(int orderId, string userNote)
    {
        var userId=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        _store.Update(db=>{var o=db.PurchaseOrders.First(x=>x.Id==orderId && x.UserId==userId); if(o.Status=="Pending"){o.UserNote=userNote??"Đã chuyển khoản"; o.ConfirmedAt=DateTime.Now;} return 0;});
        Message="Đã ghi nhận thông báo chuyển khoản. Admin kiểm tra xong sẽ cộng credits.";
        return RedirectToPage();
    }
    public IActionResult OnPostCancel(int orderId)
    {
        var userId=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        _store.Update(db=>{var o=db.PurchaseOrders.First(x=>x.Id==orderId && x.UserId==userId); if(o.Status=="Pending") o.Status="Cancelled"; return 0;});
        Message="Đã hủy đơn mua credits.";
        return RedirectToPage();
    }
    public string FormatCredits(int points)
    {
        if(points>=1000000) return (points/1000000m).ToString(points%1000000==0?"0":"0.#")+"M";
        if(points>=1000) return (points/1000m).ToString(points%1000==0?"0":"0.#")+"K";
        return points.ToString("N0");
    }
    private void Load(string? period=null)
    {
        var userId=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!); var db=_store.Read();
        Period=(period??Request.Query["period"].ToString()).Equals("yearly",StringComparison.OrdinalIgnoreCase)?"Yearly":"Monthly";
        Packages=db.Packages.Where(x=>x.IsActive && x.BillingPeriod==Period).OrderBy(x=>x.SortOrder).ThenBy(x=>x.PriceVnd).ToList();
        YearDiscount=db.Packages.Where(x=>x.BillingPeriod=="Yearly" && x.AnnualDiscountPercent>0).Select(x=>x.AnnualDiscountPercent).DefaultIfEmpty(10).Max();
        MyOrders=db.PurchaseOrders.Where(x=>x.UserId==userId).OrderByDescending(x=>x.CreatedAt).Take(10).ToList();
    }
}
