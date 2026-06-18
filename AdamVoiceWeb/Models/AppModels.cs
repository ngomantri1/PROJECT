namespace AdamVoiceWeb.Models;

public class AppDb
{
    public List<AppUser> Users { get; set; } = new();
    public List<VoiceOption> Voices { get; set; } = new();
    public List<PointPackage> Packages { get; set; } = new();
    public List<VoiceJob> VoiceJobs { get; set; } = new();
    public List<PointTransaction> PointTransactions { get; set; } = new();
    public List<PurchaseOrder> PurchaseOrders { get; set; } = new();
    public int NextUserId { get; set; } = 1;
    public int NextVoiceId { get; set; } = 1;
    public int NextPackageId { get; set; } = 1;
    public int NextJobId { get; set; } = 1;
    public int NextTransactionId { get; set; } = 1;
    public int NextPurchaseOrderId { get; set; } = 1;
}

public class AppUser
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string AuthProvider { get; set; } = "";
    public string ExternalId { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string ZaloOrTelegram { get; set; } = "";
    public string Role { get; set; } = "Member";
    public int PointBalance { get; set; }
    public bool IsLocked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? LastLoginAt { get; set; }
}

public class VoiceOption
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string ApiVoiceId { get; set; } = "";
    public decimal PointRate { get; set; } = 1m;
    public string AvatarEmoji { get; set; } = "🎙️";
    public bool IsActive { get; set; } = true;
    public int? OwnerUserId { get; set; }
    public bool IsSystemVoice { get; set; } = true;
    public string Status { get; set; } = "Approved"; // Approved, Pending, Rejected
    public string UserNote { get; set; } = "";
    public string AdminNote { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public class PointPackage
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string PlanCode { get; set; } = ""; // Starter, Pro, Business
    public string BillingPeriod { get; set; } = "Monthly"; // Monthly, Yearly
    public int PriceVnd { get; set; }
    public int Points { get; set; }
    public int MonthlyEquivalentVnd { get; set; }
    public int AnnualDiscountPercent { get; set; }
    public bool IsPopular { get; set; }
    public bool IsActive { get; set; } = true;
    public string Description { get; set; } = "";
    public List<string> Features { get; set; } = new();
    public int SortOrder { get; set; }
}

public class PurchaseOrder
{
    public int Id { get; set; }
    public string OrderCode { get; set; } = "";
    public int UserId { get; set; }
    public int PackageId { get; set; }
    public string PackageName { get; set; } = "";
    public int PriceVnd { get; set; }
    public int Points { get; set; }
    public string TransferContent { get; set; } = "";
    public string Status { get; set; } = "Pending"; // Pending, Reported, Paid, Cancelled
    public string UserNote { get; set; } = "";
    public string AdminNote { get; set; } = "";
    public int? ApprovedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
}

public class VoiceJob
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int VoiceId { get; set; }
    public string VoiceName { get; set; } = "";
    public string Text { get; set; } = "";
    public int CharacterCount { get; set; }
    public int OriginalCharacterCount { get; set; }
    public decimal PointRate { get; set; } = 1m;
    public int PointCost { get; set; }
    public int BalanceBefore { get; set; }
    public int BalanceAfter { get; set; }
    public string AudioUrl { get; set; } = "";
    public string Status { get; set; } = "Completed"; // Processing, Completed, Failed, Refunded
    public string ErrorMessage { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public class PointTransaction
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Type { get; set; } = ""; // AddPoint, UsePoint, RefundPoint, PurchaseApproved, AdminAdjust
    public int PointAmount { get; set; }
    public int BalanceBefore { get; set; }
    public int BalanceAfter { get; set; }
    public int? PackageId { get; set; }
    public int? PurchaseOrderId { get; set; }
    public string OrderCode { get; set; } = "";
    public string Status { get; set; } = "Completed"; // Completed, Pending, Cancelled
    public string Note { get; set; } = "";
    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
