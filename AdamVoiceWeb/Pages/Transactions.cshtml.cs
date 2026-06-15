using System.Security.Claims;
using AdamVoiceWeb.Models;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Mvc.RazorPages;
namespace AdamVoiceWeb.Pages;
public class TransactionsModel:PageModel
{
    private readonly DataStore _store; public TransactionsModel(DataStore store)=>_store=store;
    public List<PointTransaction> Transactions{get;set;}=new();
    public void OnGet(){var id=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!); Transactions=_store.Read().PointTransactions.Where(x=>x.UserId==id).OrderByDescending(x=>x.CreatedAt).ToList();}
    public string TypeName(string type)=>type switch{"AddPoint"=>"Tặng điểm","UsePoint"=>"Tạo giọng","RefundPoint"=>"Hoàn điểm","PurchaseApproved"=>"Mua gói","AdminAdjust"=>"Admin điều chỉnh",_=>type};
}
