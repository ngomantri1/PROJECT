using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AdamVoiceWeb.Models;

namespace AdamVoiceWeb.Services;

public class DataStore
{
    private readonly string _dbPath;
    private readonly object _lock = new();
    private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

    public DataStore(IWebHostEnvironment env)
    {
        var appData = Path.Combine(env.ContentRootPath, "App_Data");
        Directory.CreateDirectory(appData);
        _dbPath = Path.Combine(appData, "db.json");
        EnsureSeed();
    }

    public AppDb Read()
    {
        lock (_lock)
        {
            EnsureSeedNoLock();
            var json = File.ReadAllText(_dbPath);
            var db = JsonSerializer.Deserialize<AppDb>(json) ?? new AppDb();
            NormalizeDb(db);
            return db;
        }
    }

    public void Write(AppDb db)
    {
        lock (_lock)
        {
            NormalizeDb(db);
            var json = JsonSerializer.Serialize(db, _jsonOptions);
            File.WriteAllText(_dbPath, json);
        }
    }

    public T Update<T>(Func<AppDb, T> action)
    {
        lock (_lock)
        {
            var db = ReadNoLock();
            var result = action(db);
            NormalizeDb(db);
            var json = JsonSerializer.Serialize(db, _jsonOptions);
            File.WriteAllText(_dbPath, json);
            return result;
        }
    }

    private AppDb ReadNoLock()
    {
        EnsureSeedNoLock();
        var json = File.ReadAllText(_dbPath);
        var db = JsonSerializer.Deserialize<AppDb>(json) ?? new AppDb();
        NormalizeDb(db);
        return db;
    }

    private void EnsureSeed()
    {
        lock (_lock) EnsureSeedNoLock();
    }

    private void EnsureSeedNoLock()
    {
        if (File.Exists(_dbPath)) return;

        var db = new AppDb();
        db.Users.Add(new AppUser
        {
            Id = db.NextUserId++,
            Username = "admin",
            FullName = "Quản trị viên",
            Role = "Admin",
            PointBalance = 999999,
            PasswordHash = HashPassword("admin123")
        });
        db.Users.Add(new AppUser
        {
            Id = db.NextUserId++,
            Username = "demo",
            FullName = "Người dùng demo",
            Phone = "0988123456",
            ZaloOrTelegram = "@demo",
            Role = "Member",
            PointBalance = 12500,
            PasswordHash = HashPassword("123456")
        });

        db.Voices.Add(new VoiceOption { Id = db.NextVoiceId++, Name = "Adam", Description = "Nam - Trầm ấm", ApiVoiceId = "pNInz6obpgDQGcFmaJgB", PointRate = 1m, AvatarEmoji = "👨🏻" });
        db.Voices.Add(new VoiceOption { Id = db.NextVoiceId++, Name = "Antoni", Description = "Nam - Truyền cảm", ApiVoiceId = "ErXwobaYiN019PkySvjV", PointRate = 1m, AvatarEmoji = "👨" });
        db.Voices.Add(new VoiceOption { Id = db.NextVoiceId++, Name = "Josh", Description = "Nam - Ấm áp", ApiVoiceId = "TxGEqnHWrfWFTfGW9XjX", PointRate = 1m, AvatarEmoji = "🧔🏻" });
        db.Voices.Add(new VoiceOption { Id = db.NextVoiceId++, Name = "Rachel", Description = "Nữ - Ngọt ngào", ApiVoiceId = "21m00Tcm4TlvDq8ikWAM", PointRate = 1m, AvatarEmoji = "👩🏻" });

        SeedSaasPackages(db);

        NormalizeDb(db);
        File.WriteAllText(_dbPath, JsonSerializer.Serialize(db, _jsonOptions));
    }

    private static void NormalizeDb(AppDb db)
    {
        db.Users ??= new();
        db.Voices ??= new();
        db.Packages ??= new();
        db.VoiceJobs ??= new();
        db.PointTransactions ??= new();
        db.PurchaseOrders ??= new();
        db.NextUserId = Math.Max(db.NextUserId, db.Users.Any() ? db.Users.Max(x => x.Id) + 1 : 1);
        db.NextVoiceId = Math.Max(db.NextVoiceId, db.Voices.Any() ? db.Voices.Max(x => x.Id) + 1 : 1);
        db.NextPackageId = Math.Max(db.NextPackageId, db.Packages.Any() ? db.Packages.Max(x => x.Id) + 1 : 1);
        db.NextJobId = Math.Max(db.NextJobId, db.VoiceJobs.Any() ? db.VoiceJobs.Max(x => x.Id) + 1 : 1);
        db.NextTransactionId = Math.Max(db.NextTransactionId, db.PointTransactions.Any() ? db.PointTransactions.Max(x => x.Id) + 1 : 1);
        db.NextPurchaseOrderId = Math.Max(db.NextPurchaseOrderId, db.PurchaseOrders.Any() ? db.PurchaseOrders.Max(x => x.Id) + 1 : 1);
        foreach (var v in db.Voices)
        {
            if (string.IsNullOrWhiteSpace(v.Status)) v.Status = "Approved";
            if (v.OwnerUserId == null || v.OwnerUserId == 0) v.IsSystemVoice = true;
            if (v.OwnerUserId > 0) v.IsSystemVoice = false;
            if (v.PointRate <= 0) v.PointRate = 1m;
            if (string.IsNullOrWhiteSpace(v.AvatarEmoji)) v.AvatarEmoji = "🎙️";
        }

        foreach (var p in db.Packages)
        {
            p.Features ??= new();
            if (string.IsNullOrWhiteSpace(p.Description)) p.Description = "1 ký tự = 1 điểm với giọng thường.";
            if (string.IsNullOrWhiteSpace(p.BillingPeriod)) p.BillingPeriod = "Monthly";
            if (p.MonthlyEquivalentVnd <= 0) p.MonthlyEquivalentVnd = p.BillingPeriod == "Yearly" ? (int)Math.Ceiling(p.PriceVnd / 12m) : p.PriceVnd;
        }

        // Nếu mở database cũ từ bản trước, tự thêm bộ gói Starter/Pro/Business tháng/năm.
        if (!db.Packages.Any(x => x.PlanCode == "Starter" && x.BillingPeriod == "Monthly"))
        {
            foreach (var old in db.Packages.Where(x => string.IsNullOrWhiteSpace(x.PlanCode) && (x.Name.Contains("Gói Cơ Bản") || x.Name.Contains("Gói Phổ Biến") || x.Name.Contains("Gói Tiết Kiệm"))))
            {
                old.IsActive = false;
            }
            SeedSaasPackages(db);
        }
    }

    private static void SeedSaasPackages(AppDb db)
    {
        void Add(string name, string planCode, string period, int price, int points, bool popular, string desc, int sort, int annualDiscount = 0)
        {
            if (db.Packages.Any(x => x.PlanCode == planCode && x.BillingPeriod == period)) return;
            db.Packages.Add(new PointPackage
            {
                Id = db.NextPackageId++,
                Name = name,
                PlanCode = planCode,
                BillingPeriod = period,
                PriceVnd = price,
                Points = points,
                MonthlyEquivalentVnd = period == "Yearly" ? (int)Math.Ceiling(price / 12m) : price,
                AnnualDiscountPercent = annualDiscount,
                IsPopular = popular,
                IsActive = true,
                Description = desc,
                SortOrder = sort,
                Features = new List<string>
                {
                    "Chỉ trừ điểm khi tạo file mới",
                    "Nghe lại và tải lại miễn phí",
                    "Tự hoàn điểm nếu tạo lỗi",
                    "Dùng được mọi giọng đang bật"
                }
            });
        }

        Add("Starter", "Starter", "Monthly", 60000, 120000, false, "Phù hợp khách dùng thử hoặc tạo nội dung ngắn.", 1);
        Add("Pro", "Pro", "Monthly", 200000, 500000, true, "Phù hợp khách dùng thường xuyên, shop bán hàng và làm video.", 2);
        Add("Business", "Business", "Monthly", 350000, 1000000, false, "Phù hợp team/đại lý cần nhiều điểm và tạo nội dung lớn.", 3);
        Add("Starter", "Starter", "Yearly", 648000, 1400000, false, "Trả năm tiết kiệm hơn, phù hợp dùng ổn định lâu dài.", 1, 10);
        Add("Pro", "Pro", "Yearly", 2200000, 6000000, true, "Gói năm phổ biến nhất cho khách làm nội dung đều đặn.", 2, 10);
        Add("Business", "Business", "Yearly", 3800000, 12000000, false, "Gói năm dành cho team/đại lý, lượng credit lớn nhất.", 3, 10);
    }

    public static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password + "|AdamVoiceDemoSalt"));
        return Convert.ToHexString(bytes);
    }

    public static bool VerifyPassword(string password, string hash) => HashPassword(password) == hash;
}
