using AdamVoiceWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace AdamVoiceWeb.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<VoiceOption> Voices => Set<VoiceOption>();
    public DbSet<PointPackage> Packages => Set<PointPackage>();
    public DbSet<VoiceJob> VoiceJobs => Set<VoiceJob>();
    public DbSet<PointTransaction> PointTransactions => Set<PointTransaction>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>()
            .HasIndex(x => x.Username)
            .IsUnique();

        modelBuilder.Entity<AppUser>()
            .HasIndex(x => new { x.AuthProvider, x.ExternalId });

        modelBuilder.Entity<PurchaseOrder>()
            .HasIndex(x => x.OrderCode)
            .IsUnique();

        modelBuilder.Entity<VoiceOption>()
            .Property(x => x.PointRate)
            .HasConversion<double>();

        modelBuilder.Entity<VoiceJob>()
            .Property(x => x.PointRate)
            .HasConversion<double>();
    }
}
