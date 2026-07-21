using ElevatorERP.Domain;
using Microsoft.EntityFrameworkCore;

namespace ElevatorERP.Infrastructure;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<ConsultationProfile> ConsultationProfiles => Set<ConsultationProfile>();
    public DbSet<CustomerElevator> CustomerElevators => Set<CustomerElevator>();
    public DbSet<CareActivity> CareActivities => Set<CareActivity>();
    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<CatalogCategory> CatalogCategories => Set<CatalogCategory>();
    public DbSet<CatalogOption> CatalogOptions => Set<CatalogOption>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<UserRole>().HasKey(x => new { x.UserId, x.RoleId });
        b.Entity<RolePermission>().HasKey(x => new { x.RoleId, x.PermissionId });
        b.Entity<AppUser>().HasIndex(x => x.Username).IsUnique();
        b.Entity<Role>().HasIndex(x => x.Code).IsUnique();
        b.Entity<Permission>().HasIndex(x => x.Code).IsUnique();
        b.Entity<Customer>().HasIndex(x => x.Code).IsUnique();
        b.Entity<ConsultationProfile>().HasIndex(x => x.Code).IsUnique();
        b.Entity<Quotation>().HasIndex(x => x.Code).IsUnique();
        b.Entity<CatalogCategory>().HasIndex(x => x.Code).IsUnique();
        b.Entity<CatalogOption>().HasIndex(x => new { x.CategoryId, x.Code }).IsUnique();
        b.Entity<CatalogOption>()
            .HasOne(x => x.Category)
            .WithMany(x => x.Options)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<ConsultationProfile>()
            .HasOne(x => x.Customer)
            .WithMany(x => x.ConsultationProfiles)
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<ConsultationProfile>()
            .HasOne(x => x.OwnerUser)
            .WithMany()
            .HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Quotation>()
            .HasOne(x => x.ConsultationProfile)
            .WithMany(x => x.Quotations)
            .HasForeignKey(x => x.ConsultationProfileId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<CustomerElevator>().HasIndex(x => x.Code).IsUnique();
        b.Entity<CustomerElevator>()
            .HasOne(x => x.Customer)
            .WithMany(x => x.CustomerElevators)
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<CustomerElevator>()
            .HasOne(x => x.ConsultationProfile)
            .WithMany(x => x.CustomerElevators)
            .HasForeignKey(x => x.ConsultationProfileId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<CustomerElevator>()
            .HasOne(x => x.SourceQuotation)
            .WithMany(x => x.CustomerElevators)
            .HasForeignKey(x => x.SourceQuotationId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Customer>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<ConsultationProfile>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<CareActivity>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<Quotation>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<CustomerElevator>().HasQueryFilter(x => !x.IsDeleted);
    }
}
