using System.Security.Claims;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
namespace AdamVoiceWeb.Pages;
public class AdminModel:PageModel
{
    private readonly DataStore _store;
    public AdminModel(DataStore store)=>_store=store;
    public List<AppUser> Users{get;set;}=new();
    public List<PurchaseOrder> PendingOrders{get;set;}=new();
    public List<PurchaseOrder> RecentOrders{get;set;}=new();
    public List<VoiceOption> Voices{get;set;}=new();
    public List<VoiceOption> PendingCustomVoices{get;set;}=new();
    public List<VoiceJob> RecentJobs{get;set;}=new();
    public List<PointPackage> Packages{get;set;}=new();
    public int TotalUsers{get;set;} public int TodayJobs{get;set;} public int PendingCount{get;set;} public int TodayRevenue{get;set;} public int MonthRevenue{get;set;} public int TodayCharacters{get;set;} public int MonthCharacters{get;set;}
    [TempData] public string? Message{get;set;}
    public void OnGet(){Load();}
    public IActionResult OnPostApproveOrder(int orderId,string adminNote)
    {
        var adminId=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        _store.Update(db=>{
            var o=db.PurchaseOrders.First(x=>x.Id==orderId);
            if(o.Status=="Pending"){
                var u=db.Users.First(x=>x.Id==o.UserId);
                var before=u.PointBalance;
                u.PointBalance+=o.Points;
                o.Status="Paid"; o.AdminNote=adminNote??"Admin đã duyệt"; o.ApprovedAt=DateTime.Now; o.ApprovedByUserId=adminId;
                db.PointTransactions.Add(new PointTransaction{Id=db.NextTransactionId++,UserId=o.UserId,Type="PurchaseApproved",PointAmount=o.Points,BalanceBefore=before,BalanceAfter=u.PointBalance,PackageId=o.PackageId,PurchaseOrderId=o.Id,OrderCode=o.OrderCode,Status="Completed",Note=$"Duyệt đơn {o.OrderCode} - {o.PackageName}",CreatedByUserId=adminId});
            }
            return 0;
        });
        Message="Đã duyệt đơn và cộng điểm cho khách.";return RedirectToPage();
    }
    public IActionResult OnPostRejectOrder(int orderId,string adminNote)
    {
        var adminId=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        _store.Update(db=>{var o=db.PurchaseOrders.First(x=>x.Id==orderId); if(o.Status=="Pending"){o.Status="Cancelled";o.AdminNote=adminNote??"Admin hủy đơn";o.ApprovedAt=DateTime.Now;o.ApprovedByUserId=adminId;} return 0;});
        Message="Đã hủy đơn.";return RedirectToPage();
    }
    public IActionResult OnPostAddPoint(int userId,int points,string note)
    {
        var adminId=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        _store.Update(db=>{var u=db.Users.First(x=>x.Id==userId);var before=u.PointBalance;u.PointBalance+=points;db.PointTransactions.Add(new PointTransaction{Id=db.NextTransactionId++,UserId=userId,Type="AdminAdjust",PointAmount=points,BalanceBefore=before,BalanceAfter=u.PointBalance,Note=note??"Admin cộng/trừ điểm",CreatedByUserId=adminId});return 0;});
        Message="Đã cập nhật điểm.";return RedirectToPage();
    }
    public IActionResult OnPostToggleLock(int userId)
    {
        _store.Update(db=>{var u=db.Users.First(x=>x.Id==userId); if(u.Role!="Admin") u.IsLocked=!u.IsLocked; return 0;});
        Message="Đã cập nhật trạng thái tài khoản.";return RedirectToPage();
    }
    public IActionResult OnPostUpdateVoice(int voiceId,string name,string description,string apiVoiceId,decimal rate,string avatarEmoji,bool isActive)
    {
        _store.Update(db=>{var v=db.Voices.First(x=>x.Id==voiceId);v.Name=name;v.Description=description;v.ApiVoiceId=apiVoiceId;v.PointRate=rate<=0?1:rate;v.AvatarEmoji=string.IsNullOrWhiteSpace(avatarEmoji)?"🎙️":avatarEmoji;v.IsActive=isActive; if(string.IsNullOrWhiteSpace(v.Status)) v.Status="Approved"; return 0;});
        Message="Đã cập nhật giọng.";return RedirectToPage();
    }
    public IActionResult OnPostApproveCustomVoice(int voiceId,string apiVoiceId,decimal rate,string adminNote)
    {
        _store.Update(db=>{var v=db.Voices.First(x=>x.Id==voiceId);v.ApiVoiceId=apiVoiceId?.Trim()??"";v.PointRate=rate<=0?2:rate;v.Status="Approved";v.IsActive=true;v.AdminNote=string.IsNullOrWhiteSpace(adminNote)?"Admin đã duyệt giọng riêng":adminNote;v.IsSystemVoice=false;return 0;});
        Message="Đã duyệt giọng riêng cho khách.";return RedirectToPage();
    }
    public IActionResult OnPostRejectCustomVoice(int voiceId,string adminNote)
    {
        _store.Update(db=>{var v=db.Voices.First(x=>x.Id==voiceId);v.Status="Rejected";v.IsActive=false;v.AdminNote=string.IsNullOrWhiteSpace(adminNote)?"Admin từ chối yêu cầu":adminNote;return 0;});
        Message="Đã từ chối yêu cầu giọng riêng.";return RedirectToPage();
    }
    public IActionResult OnPostUpdatePackage(int packageId,string name,string planCode,string billingPeriod,int priceVnd,int points,int monthlyEquivalentVnd,int annualDiscountPercent,int sortOrder,string description,bool isPopular,bool isActive)
    {
        _store.Update(db=>{var p=db.Packages.First(x=>x.Id==packageId);p.Name=name;p.PlanCode=planCode??name;p.BillingPeriod=billingPeriod=="Yearly"?"Yearly":"Monthly";p.PriceVnd=priceVnd;p.Points=points;p.MonthlyEquivalentVnd=monthlyEquivalentVnd<=0?(p.BillingPeriod=="Yearly"?(int)Math.Ceiling(priceVnd/12m):priceVnd):monthlyEquivalentVnd;p.AnnualDiscountPercent=annualDiscountPercent;p.SortOrder=sortOrder;p.Description=description??"";p.IsPopular=isPopular;p.IsActive=isActive;return 0;});
        Message="Đã cập nhật gói credits.";return RedirectToPage();
    }
    public string UserName(int id)=>Users.FirstOrDefault(x=>x.Id==id)?.Username??id.ToString();
    private void Load()
    {
        var db=_store.Read();var today=DateTime.Today;var month=new DateTime(DateTime.Today.Year,DateTime.Today.Month,1);
        Users=db.Users.OrderBy(x=>x.Username).ToList();
        PendingOrders=db.PurchaseOrders.Where(x=>x.Status=="Pending").OrderByDescending(x=>x.CreatedAt).ToList();
        RecentOrders=db.PurchaseOrders.OrderByDescending(x=>x.CreatedAt).Take(30).ToList();
        Voices=db.Voices.ToList(); PendingCustomVoices=db.Voices.Where(x=>x.OwnerUserId.HasValue && x.Status=="Pending").OrderByDescending(x=>x.CreatedAt).ToList(); Packages=db.Packages.OrderBy(x=>x.BillingPeriod).ThenBy(x=>x.SortOrder).ToList(); RecentJobs=db.VoiceJobs.OrderByDescending(x=>x.CreatedAt).Take(20).ToList();
        TotalUsers=Users.Count; PendingCount=PendingOrders.Count; TodayJobs=db.VoiceJobs.Count(x=>x.CreatedAt>=today); TodayCharacters=db.VoiceJobs.Where(x=>x.CreatedAt>=today&&x.Status=="Completed").Sum(x=>x.CharacterCount); MonthCharacters=db.VoiceJobs.Where(x=>x.CreatedAt>=month&&x.Status=="Completed").Sum(x=>x.CharacterCount); TodayRevenue=db.PurchaseOrders.Where(x=>x.Status=="Paid"&&x.ApprovedAt>=today).Sum(x=>x.PriceVnd); MonthRevenue=db.PurchaseOrders.Where(x=>x.Status=="Paid"&&x.ApprovedAt>=month).Sum(x=>x.PriceVnd);
    }
}
