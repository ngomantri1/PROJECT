namespace ElevatorERP.Domain;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public bool IsDemo { get; set; }
}

public sealed class Department : Entity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
}

public sealed class AppUser : Entity
{
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public sealed class Role : Entity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string DataScope { get; set; } = "OWN";
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public sealed class Permission : Entity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Module { get; set; } = "";
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public sealed class UserRole
{
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public Guid RoleId { get; set; }
    public Role Role { get; set; } = null!;
}

public sealed class RolePermission
{
    public Guid RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public Guid PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;
}

public sealed class Customer : Entity
{
    public string Code { get; set; } = "";
    public string CustomerType { get; set; } = "PERSONAL";
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Area { get; set; }
    public string? ElevatorType { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? LocationAccuracyMeters { get; set; }
    public string? LocationLabel { get; set; }
    public string Source { get; set; } = "Khác";
    public string Status { get; set; } = "NEW";
    public string? Notes { get; set; }
    public Guid OwnerUserId { get; set; }
    public AppUser OwnerUser { get; set; } = null!;
}

public sealed class CareActivity : Entity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid AssigneeUserId { get; set; }
    public AppUser AssigneeUser { get; set; } = null!;
    public string CareType { get; set; } = "CALL";
    public DateTimeOffset ScheduledAt { get; set; }
    public string Content { get; set; } = "";
    public string? Result { get; set; }
    public string Status { get; set; } = "UPCOMING";
    public DateTimeOffset? NextCareAt { get; set; }
}

public sealed class CatalogCategory : Entity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Module { get; set; } = "";
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsSystem { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public ICollection<CatalogOption> Options { get; set; } = new List<CatalogOption>();
}

public sealed class CatalogOption : Entity
{
    public Guid CategoryId { get; set; }
    public CatalogCategory Category { get; set; } = null!;
    public string Code { get; set; } = "";
    public string Label { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class AuditLog : Entity
{
    public Guid? UserId { get; set; }
    public string Username { get; set; } = "SYSTEM";
    public string Action { get; set; } = "";
    public string Module { get; set; } = "";
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}

public sealed class StoredFile : Entity
{
    public string OriginalName { get; set; } = "";
    public string StorageName { get; set; } = "";
    public string RelativePath { get; set; } = "";
    public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public string Module { get; set; } = "GENERAL";
    public string? RecordId { get; set; }
    public Guid UploadedByUserId { get; set; }
}
