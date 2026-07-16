using System.Security.Claims;
using System.Security.Cryptography;
using ElevatorERP.Domain;
using ElevatorERP.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace ElevatorERP.Security;

public static class PasswordService
{
    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string encoded)
    {
        var parts = encoded.Split('.');
        if (parts.Length != 2) return false;
        var salt = Convert.FromBase64String(parts[0]);
        var expected = Convert.FromBase64String(parts[1]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}

public sealed class CurrentUser(IHttpContextAccessor accessor)
{
    public Guid? Id => Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public string Username => accessor.HttpContext?.User.Identity?.Name ?? "anonymous";
}

public sealed class PermissionService(AppDbContext db, CurrentUser current)
{
    public async Task<HashSet<string>> GetPermissionsAsync(CancellationToken ct = default)
    {
        if (current.Id is null) return [];
        var result = await db.UserRoles
            .Where(x => x.UserId == current.Id)
            .SelectMany(x => x.Role.RolePermissions)
            .Select(x => x.Permission.Code)
            .Distinct()
            .ToListAsync(ct);
        return result.ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public async Task<bool> HasAsync(string permission, CancellationToken ct = default)
        => (await GetPermissionsAsync(ct)).Contains(permission);
}

public static class PermissionEndpointExtensions
{
    public static RouteHandlerBuilder RequirePermission(this RouteHandlerBuilder builder, string permission)
        => builder.AddEndpointFilter(async (context, next) =>
        {
            var service = context.HttpContext.RequestServices.GetRequiredService<PermissionService>();
            if (!await service.HasAsync(permission, context.HttpContext.RequestAborted))
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            return await next(context);
        }).RequireAuthorization();
}
