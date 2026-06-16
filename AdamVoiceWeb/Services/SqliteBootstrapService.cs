using System.Text.Json;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AdamVoiceWeb.Services;

public sealed class SqliteBootstrapService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;

    public SqliteBootstrapService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var paths = scope.ServiceProvider.GetRequiredService<AppDataPaths>();

        Directory.CreateDirectory(paths.DataRootPath);
        Directory.CreateDirectory(paths.AudioRootPath);

        await db.Database.EnsureCreatedAsync(cancellationToken);
        await EnsureCurrentSchemaAsync(paths.DbPath, cancellationToken);
        if (await db.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var legacyDb = await LoadLegacyDbAsync(paths.LegacyDbJsonPath, cancellationToken) ?? CreateSeedDb();
        ImportLegacyDb(db, legacyDb);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static async Task EnsureCurrentSchemaAsync(string dbPath, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection($"Data Source={dbPath}");
        await connection.OpenAsync(cancellationToken);

        await EnsureColumnAsync(connection, "Users", "AuthProvider", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await EnsureColumnAsync(connection, "Users", "ExternalId", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await EnsureIndexAsync(connection, "IX_Users_AuthProvider_ExternalId", "CREATE INDEX IF NOT EXISTS \"IX_Users_AuthProvider_ExternalId\" ON \"Users\" (\"AuthProvider\", \"ExternalId\")", cancellationToken);
    }

    private static async Task<AppDb?> LoadLegacyDbAsync(string legacyDbPath, CancellationToken cancellationToken)
    {
        if (!File.Exists(legacyDbPath))
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(legacyDbPath, cancellationToken);
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        var db = JsonSerializer.Deserialize<AppDb>(json);
        if (db == null)
        {
            return null;
        }

        NormalizeLegacyDb(db);
        return db;
    }

    private static void ImportLegacyDb(AppDbContext context, AppDb legacyDb)
    {
        context.Users.AddRange(legacyDb.Users);
        context.Voices.AddRange(legacyDb.Voices);
        context.Packages.AddRange(legacyDb.Packages);
        context.VoiceJobs.AddRange(legacyDb.VoiceJobs);
        context.PointTransactions.AddRange(legacyDb.PointTransactions);
        context.PurchaseOrders.AddRange(legacyDb.PurchaseOrders);
    }

    private static AppDb CreateSeedDb()
    {
        var db = new AppDb();

        db.Users.Add(new AppUser
        {
            Id = db.NextUserId++,
            Username = "admin",
            FullName = "Admin",
            Role = "Admin",
            PointBalance = 999999,
            PasswordHash = DataStore.HashPassword("admin123")
        });

        db.Users.Add(new AppUser
        {
            Id = db.NextUserId++,
            Username = "demo",
            FullName = "Demo user",
            Phone = "0988123456",
            ZaloOrTelegram = "@demo",
            Role = "Member",
            PointBalance = 12500,
            PasswordHash = DataStore.HashPassword("123456")
        });

        db.Voices.Add(new VoiceOption { Id = db.NextVoiceId++, Name = "Adam", Description = "Male - warm", ApiVoiceId = "pNInz6obpgDQGcFmaJgB", PointRate = 1m, AvatarEmoji = "M" });
        db.Voices.Add(new VoiceOption { Id = db.NextVoiceId++, Name = "Antoni", Description = "Male - emotional", ApiVoiceId = "ErXwobaYiN019PkySvjV", PointRate = 1m, AvatarEmoji = "M" });
        db.Voices.Add(new VoiceOption { Id = db.NextVoiceId++, Name = "Josh", Description = "Male - calm", ApiVoiceId = "TxGEqnHWrfWFTfGW9XjX", PointRate = 1m, AvatarEmoji = "M" });
        db.Voices.Add(new VoiceOption { Id = db.NextVoiceId++, Name = "Rachel", Description = "Female - bright", ApiVoiceId = "21m00Tcm4TlvDq8ikWAM", PointRate = 1m, AvatarEmoji = "F" });

        SeedPackages(db);
        NormalizeLegacyDb(db);
        return db;
    }

    private static void NormalizeLegacyDb(AppDb db)
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

        foreach (var voice in db.Voices)
        {
            if (string.IsNullOrWhiteSpace(voice.Status))
            {
                voice.Status = "Approved";
            }

            if (voice.OwnerUserId == null || voice.OwnerUserId == 0)
            {
                voice.IsSystemVoice = true;
            }

            if (voice.OwnerUserId > 0)
            {
                voice.IsSystemVoice = false;
            }

            if (voice.PointRate <= 0)
            {
                voice.PointRate = 1m;
            }

            if (string.IsNullOrWhiteSpace(voice.AvatarEmoji))
            {
                voice.AvatarEmoji = "V";
            }
        }

        foreach (var package in db.Packages)
        {
            package.Features ??= new();

            if (string.IsNullOrWhiteSpace(package.Description))
            {
                package.Description = "1 character = 1 point for standard voices.";
            }

            if (string.IsNullOrWhiteSpace(package.BillingPeriod))
            {
                package.BillingPeriod = "Monthly";
            }

            if (package.MonthlyEquivalentVnd <= 0)
            {
                package.MonthlyEquivalentVnd = package.BillingPeriod == "Yearly"
                    ? (int)Math.Ceiling(package.PriceVnd / 12m)
                    : package.PriceVnd;
            }
        }

        if (!db.Packages.Any(x => x.PlanCode == "Starter" && x.BillingPeriod == "Monthly"))
        {
            SeedPackages(db);
        }
    }

    private static async Task EnsureColumnAsync(SqliteConnection connection, string tableName, string columnName, string columnDefinition, CancellationToken cancellationToken)
    {
        var existingColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using (var infoCommand = connection.CreateCommand())
        {
            infoCommand.CommandText = $"PRAGMA table_info(\"{tableName}\")";
            await using var reader = await infoCommand.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                existingColumns.Add(reader.GetString(1));
            }
        }

        if (existingColumns.Contains(columnName))
        {
            return;
        }

        await using var alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE \"{tableName}\" ADD COLUMN \"{columnName}\" {columnDefinition}";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task EnsureIndexAsync(SqliteConnection connection, string indexName, string createSql, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = createSql;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void SeedPackages(AppDb db)
    {
        AddPackage(db, "Starter", "Starter", "Monthly", 60000, 120000, false, "Entry monthly plan.", 1);
        AddPackage(db, "Pro", "Pro", "Monthly", 200000, 500000, true, "Best fit for regular content work.", 2);
        AddPackage(db, "Business", "Business", "Monthly", 350000, 1000000, false, "Higher monthly point volume.", 3);
        AddPackage(db, "Starter", "Starter", "Yearly", 648000, 1400000, false, "Entry annual plan.", 1, 10);
        AddPackage(db, "Pro", "Pro", "Yearly", 2200000, 6000000, true, "Best fit for annual regular work.", 2, 10);
        AddPackage(db, "Business", "Business", "Yearly", 3800000, 12000000, false, "Higher annual point volume.", 3, 10);
    }

    private static void AddPackage(AppDb db, string name, string planCode, string billingPeriod, int priceVnd, int points, bool isPopular, string description, int sortOrder, int annualDiscountPercent = 0)
    {
        if (db.Packages.Any(x => x.PlanCode == planCode && x.BillingPeriod == billingPeriod))
        {
            return;
        }

        db.Packages.Add(new PointPackage
        {
            Id = db.NextPackageId++,
            Name = name,
            PlanCode = planCode,
            BillingPeriod = billingPeriod,
            PriceVnd = priceVnd,
            Points = points,
            MonthlyEquivalentVnd = billingPeriod == "Yearly" ? (int)Math.Ceiling(priceVnd / 12m) : priceVnd,
            AnnualDiscountPercent = annualDiscountPercent,
            IsPopular = isPopular,
            IsActive = true,
            Description = description,
            SortOrder = sortOrder,
            Features = new List<string>
            {
                "Charge only when creating a new file",
                "Replay and download without extra charge",
                "Automatic refund when generation fails",
                "Works with all enabled voices"
            }
        });
    }
}
