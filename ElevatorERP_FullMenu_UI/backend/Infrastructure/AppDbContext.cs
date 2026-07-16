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
    public DbSet<CareActivity> CareActivities => Set<CareActivity>();
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
        b.Entity<Customer>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<CareActivity>().HasQueryFilter(x => !x.IsDeleted);
    }
}
