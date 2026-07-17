using System.Security.Claims;
using ElevatorERP.Domain;
using ElevatorERP.Infrastructure;
using ElevatorERP.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<PermissionService>();

var dataProtectionKeysPath = builder.Configuration["DataProtectionKeysPath"]
    ?? Path.Combine(builder.Environment.ContentRootPath, ".data-protection-keys");
Directory.CreateDirectory(dataProtectionKeysPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
    .SetApplicationName("ElevatorERP");

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Backend is only reachable inside the Docker network; Nginx is the trusted proxy.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "elevator_erp_auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var allowedOrigins = (builder.Configuration["CorsAllowedOrigins"] ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Length > 0)
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    }
}));

var app = builder.Build();

app.UseForwardedHeaders();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.UseSwagger(options => options.RouteTemplate = "api/swagger/{documentName}/swagger.json");
app.UseSwaggerUI(options =>
{
    options.RoutePrefix = "api/swagger";
    options.SwaggerEndpoint("/api/swagger/v1/swagger.json", "ElevatorERP API v1");
});

using (var scope = app.Services.CreateScope())
{
    await DemoSeeder.SeedAsync(
        scope.ServiceProvider.GetRequiredService<AppDbContext>(),
        app.Configuration);
}

app.MapGet("/api/health", async (AppDbContext db, CancellationToken cancellationToken) =>
{
    var databaseOk = await db.Database.CanConnectAsync(cancellationToken);
    return databaseOk
        ? Results.Ok(new { status = "ok", database = "ok", utc = DateTimeOffset.UtcNow })
        : Results.Json(new { status = "unhealthy", database = "unavailable", utc = DateTimeOffset.UtcNow }, statusCode: StatusCodes.Status503ServiceUnavailable);
});

app.MapPost("/api/auth/login", async (LoginRequest request, AppDbContext db, HttpContext http) =>
{
    var user = await db.Users
        .Include(x => x.Department)
        .Include(x => x.UserRoles)
        .ThenInclude(x => x.Role)
        .FirstOrDefaultAsync(x => x.Username == request.Username && x.IsActive);

    if (user is null || !PasswordService.Verify(request.Password, user.PasswordHash))
        return Results.Unauthorized();

    var claims = new List<Claim>
    {
        new(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new(ClaimTypes.Name, user.Username),
        new("display_name", user.DisplayName)
    };

    await http.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)),
        new AuthenticationProperties
        {
            IsPersistent = request.RememberMe,
            ExpiresUtc = DateTimeOffset.UtcNow.AddHours(request.RememberMe ? 168 : 12)
        });

    db.AuditLogs.Add(new AuditLog
    {
        UserId = user.Id,
        Username = user.Username,
        Action = "LOGIN",
        Module = "Identity",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        user.Id,
        user.Username,
        user.DisplayName,
        department = user.Department?.Name,
        roles = user.UserRoles.Select(x => x.Role.Name)
    });
});

app.MapPost("/api/auth/logout", async (HttpContext http) =>
{
    await http.SignOutAsync();
    return Results.Ok();
}).RequireAuthorization();

app.MapGet("/api/auth/me", async (AppDbContext db, CurrentUser current, PermissionService permissionService) =>
{
    if (current.Id is null) return Results.Unauthorized();

    var user = await db.Users
        .Include(x => x.Department)
        .Include(x => x.UserRoles)
        .ThenInclude(x => x.Role)
        .FirstAsync(x => x.Id == current.Id);

    return Results.Ok(new
    {
        user.Id,
        user.Username,
        user.DisplayName,
        user.Email,
        department = user.Department?.Name,
        roles = user.UserRoles.Select(x => x.Role.Name),
        permissions = await permissionService.GetPermissionsAsync()
    });
}).RequireAuthorization();

app.MapGet("/api/dashboard", async (AppDbContext db) =>
{
    var now = DateTimeOffset.UtcNow;
    var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);

    return Results.Ok(new
    {
        totalCustomers = await db.Customers.CountAsync(),
        newCustomers = await db.Customers.CountAsync(x => x.CreatedAt >= monthStart),
        totalCare = await db.CareActivities.CountAsync(),
        overdueCare = await db.CareActivities.CountAsync(x => x.Status == "OVERDUE"),
        upcomingCare = await db.CareActivities.CountAsync(x => x.Status == "UPCOMING"),
        completedCare = await db.CareActivities.CountAsync(x => x.Status == "DONE"),
        sourceStats = await db.Customers
            .GroupBy(x => x.Source)
            .Select(group => new { name = group.Key, value = group.Count() })
            .ToListAsync()
    });
}).RequirePermission("dashboard.view");

app.MapGet("/api/customers", async (
    string? search,
    string? status,
    AppDbContext db,
    CurrentUser current) =>
{
    var query = db.Customers.Include(x => x.OwnerUser).AsQueryable();
    var isManager = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));

    if (!isManager && current.Id is not null)
        query = query.Where(x => x.OwnerUserId == current.Id);

    if (!string.IsNullOrWhiteSpace(search))
    {
        var normalizedSearch = search.Trim().ToLower();
        query = query.Where(x => x.Name.ToLower().Contains(normalizedSearch) || x.Phone.Contains(search.Trim()));
    }

    if (!string.IsNullOrWhiteSpace(status))
        query = query.Where(x => x.Status == status);

    return Results.Ok(await query
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.Phone,
            x.Email,
            x.Address,
            x.Area,
            x.Source,
            x.Status,
            owner = x.OwnerUser.DisplayName,
            x.CreatedAt
        })
        .ToListAsync());
}).RequirePermission("customer.view");

app.MapPost("/api/customers", async (
    CustomerRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
        return Results.BadRequest(new { message = "Tên khách hàng và số điện thoại là bắt buộc." });

    var count = await db.Customers.IgnoreQueryFilters().CountAsync() + 1;
    var customer = new Customer
    {
        Code = $"KH-{count:000000}",
        CustomerType = request.CustomerType,
        Name = request.Name.Trim(),
        Phone = request.Phone.Trim(),
        Email = request.Email?.Trim(),
        Address = request.Address?.Trim(),
        Area = request.Area?.Trim(),
        Source = request.Source,
        Status = request.Status,
        Notes = request.Notes?.Trim(),
        OwnerUserId = current.Id.Value
    };

    db.Customers.Add(customer);
    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "CREATE",
        Module = "Customers",
        EntityType = nameof(Customer),
        EntityId = customer.Id.ToString(),
        Details = customer.Code,
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Created($"/api/customers/{customer.Id}", new { customer.Id, customer.Code });
}).RequirePermission("customer.create");

app.MapGet("/api/care-activities", async (
    DateTimeOffset? from,
    DateTimeOffset? to,
    string? status,
    AppDbContext db,
    CurrentUser current) =>
{
    var query = db.CareActivities
        .Include(x => x.Customer)
        .Include(x => x.AssigneeUser)
        .AsQueryable();

    var isManager = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));

    if (!isManager && current.Id is not null)
        query = query.Where(x => x.AssigneeUserId == current.Id);

    if (from.HasValue) query = query.Where(x => x.ScheduledAt >= from);
    if (to.HasValue) query = query.Where(x => x.ScheduledAt <= to);
    if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);

    return Results.Ok(await query
        .OrderBy(x => x.ScheduledAt)
        .Select(x => new
        {
            x.Id,
            x.CustomerId,
            customer = x.Customer.Name,
            phone = x.Customer.Phone,
            assignee = x.AssigneeUser.DisplayName,
            x.CareType,
            x.ScheduledAt,
            x.Content,
            x.Result,
            x.Status,
            x.NextCareAt
        })
        .ToListAsync());
}).RequirePermission("care.view");

app.MapPost("/api/care-activities", async (
    CareRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (!await db.Customers.AnyAsync(x => x.Id == request.CustomerId))
        return Results.BadRequest(new { message = "Khách hàng không tồn tại hoặc không còn hiệu lực." });

    var assigneeUserId = request.AssigneeUserId ?? current.Id.Value;
    if (!await db.Users.AnyAsync(x => x.Id == assigneeUserId && x.IsActive))
        return Results.BadRequest(new { message = "Người phụ trách không hợp lệ." });

    var activity = new CareActivity
    {
        CustomerId = request.CustomerId,
        AssigneeUserId = assigneeUserId,
        CareType = request.CareType,
        ScheduledAt = request.ScheduledAt,
        Content = request.Content.Trim(),
        Status = "UPCOMING"
    };

    db.CareActivities.Add(activity);
    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "CREATE",
        Module = "Care",
        EntityType = nameof(CareActivity),
        EntityId = activity.Id.ToString(),
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Created($"/api/care-activities/{activity.Id}", new { activity.Id });
}).RequirePermission("care.create");

app.MapPut("/api/care-activities/{id:guid}/complete", async (
    Guid id,
    CompleteCareRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    var activity = await db.CareActivities.FindAsync(id);
    if (activity is null) return Results.NotFound();

    var isManager = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!isManager && activity.AssigneeUserId != current.Id)
        return Results.StatusCode(StatusCodes.Status403Forbidden);

    activity.Status = "DONE";
    activity.Result = request.Result.Trim();
    activity.NextCareAt = request.NextCareAt;
    activity.UpdatedAt = DateTimeOffset.UtcNow;

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "COMPLETE",
        Module = "Care",
        EntityType = nameof(CareActivity),
        EntityId = activity.Id.ToString(),
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Ok();
}).RequirePermission("care.update");

app.MapGet("/api/admin/roles", async (AppDbContext db) =>
    Results.Ok(await db.Roles
        .Include(x => x.RolePermissions)
        .ThenInclude(x => x.Permission)
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.DataScope,
            permissions = x.RolePermissions.Select(rolePermission => rolePermission.Permission.Code)
        })
        .ToListAsync()))
    .RequirePermission("role.manage");

app.MapGet("/api/admin/users", async (AppDbContext db) =>
    Results.Ok(await db.Users
        .Include(x => x.Department)
        .Include(x => x.UserRoles)
        .ThenInclude(x => x.Role)
        .Select(x => new
        {
            x.Id,
            x.Username,
            x.DisplayName,
            x.Email,
            x.IsActive,
            department = x.Department != null ? x.Department.Name : "",
            roles = x.UserRoles.Select(userRole => userRole.Role.Name)
        })
        .ToListAsync()))
    .RequirePermission("user.manage");

app.MapPut("/api/admin/users/{id:guid}/roles", async (
    Guid id,
    AssignRolesRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    var user = await db.Users.Include(x => x.UserRoles).FirstOrDefaultAsync(x => x.Id == id);
    if (user is null) return Results.NotFound();

    var validRoleIds = await db.Roles
        .Where(x => request.RoleIds.Distinct().Contains(x.Id))
        .Select(x => x.Id)
        .ToListAsync();
    if (validRoleIds.Count != request.RoleIds.Distinct().Count())
        return Results.BadRequest(new { message = "Danh sách vai trò có giá trị không hợp lệ." });

    db.UserRoles.RemoveRange(user.UserRoles);
    foreach (var roleId in validRoleIds)
        db.UserRoles.Add(new UserRole { UserId = id, RoleId = roleId });

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "ASSIGN_ROLES",
        Module = "Administration",
        EntityType = nameof(AppUser),
        EntityId = id.ToString(),
        Details = string.Join(',', validRoleIds),
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Ok();
}).RequirePermission("user.manage");

app.MapGet("/api/catalogs/categories", async (AppDbContext db) =>
    Results.Ok(await db.CatalogCategories
        .OrderBy(x => x.SortOrder)
        .ThenBy(x => x.Name)
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.Module,
            x.Description,
            x.SortOrder,
            x.IsSystem,
            x.IsActive,
            optionCount = x.Options.Count(option => option.IsActive)
        })
        .ToListAsync()))
    .RequireAuthorization();

app.MapGet("/api/catalogs/categories/{code}/options", async (
    string code,
    bool? activeOnly,
    AppDbContext db) =>
{
    var category = await db.CatalogCategories
        .Include(x => x.Options)
        .FirstOrDefaultAsync(x => x.Code == code);
    if (category is null) return Results.NotFound();

    var options = category.Options
        .Where(x => activeOnly != true || x.IsActive)
        .OrderBy(x => x.SortOrder)
        .ThenBy(x => x.Label)
        .Select(x => new
        {
            x.Id,
            categoryCode = category.Code,
            x.Code,
            x.Label,
            x.Description,
            x.Color,
            x.SortOrder,
            x.IsSystem,
            x.IsActive
        });

    return Results.Ok(options);
}).RequireAuthorization();

app.MapPost("/api/catalogs/categories/{code}/options", async (
    string code,
    CatalogOptionRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    var category = await db.CatalogCategories.FirstOrDefaultAsync(x => x.Code == code);
    if (category is null) return Results.NotFound();

    var normalizedCode = request.Code.Trim().ToUpperInvariant();
    if (string.IsNullOrWhiteSpace(normalizedCode) || string.IsNullOrWhiteSpace(request.Label))
        return Results.BadRequest(new { message = "Mã và tên hiển thị là bắt buộc." });

    if (await db.CatalogOptions.AnyAsync(x => x.CategoryId == category.Id && x.Code == normalizedCode))
        return Results.BadRequest(new { message = "Mã tùy chọn đã tồn tại trong danh mục này." });

    var sortOrder = request.SortOrder > 0
        ? request.SortOrder
        : await db.CatalogOptions.Where(x => x.CategoryId == category.Id)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync() + 10 ?? 10;

    var option = new CatalogOption
    {
        CategoryId = category.Id,
        Code = normalizedCode,
        Label = request.Label.Trim(),
        Description = request.Description?.Trim(),
        Color = string.IsNullOrWhiteSpace(request.Color) ? "default" : request.Color.Trim(),
        SortOrder = sortOrder,
        IsSystem = false,
        IsActive = true
    };

    db.CatalogOptions.Add(option);
    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "CREATE_CATALOG_OPTION",
        Module = "Administration",
        EntityType = nameof(CatalogOption),
        EntityId = option.Id.ToString(),
        Details = $"{category.Code}:{option.Code}",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Created($"/api/catalogs/categories/{category.Code}/options/{option.Id}", new { option.Id });
}).RequirePermission("role.manage");

app.MapPut("/api/catalogs/options/{id:guid}", async (
    Guid id,
    CatalogOptionRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    var option = await db.CatalogOptions.Include(x => x.Category).FirstOrDefaultAsync(x => x.Id == id);
    if (option is null) return Results.NotFound();

    var normalizedCode = request.Code.Trim().ToUpperInvariant();
    if (string.IsNullOrWhiteSpace(normalizedCode) || string.IsNullOrWhiteSpace(request.Label))
        return Results.BadRequest(new { message = "Mã và tên hiển thị là bắt buộc." });

    if (await db.CatalogOptions.AnyAsync(x => x.Id != id && x.CategoryId == option.CategoryId && x.Code == normalizedCode))
        return Results.BadRequest(new { message = "Mã tùy chọn đã tồn tại trong danh mục này." });

    option.Code = normalizedCode;
    option.Label = request.Label.Trim();
    option.Description = request.Description?.Trim();
    option.Color = string.IsNullOrWhiteSpace(request.Color) ? "default" : request.Color.Trim();
    option.UpdatedAt = DateTimeOffset.UtcNow;

    var siblings = await db.CatalogOptions
        .Where(x => x.CategoryId == option.CategoryId && x.Id != option.Id)
        .OrderBy(x => x.SortOrder)
        .ThenBy(x => x.Label)
        .ToListAsync();
    var targetIndex = Math.Clamp(request.SortOrder <= 0 ? siblings.Count : request.SortOrder - 1, 0, siblings.Count);
    siblings.Insert(targetIndex, option);
    for (var index = 0; index < siblings.Count; index++)
    {
        siblings[index].SortOrder = (index + 1) * 10;
    }

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPDATE_CATALOG_OPTION",
        Module = "Administration",
        EntityType = nameof(CatalogOption),
        EntityId = option.Id.ToString(),
        Details = $"{option.Category.Code}:{option.Code}",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Ok();
}).RequirePermission("role.manage");

app.MapPut("/api/catalogs/options/{id:guid}/active", async (
    Guid id,
    CatalogOptionActiveRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    var option = await db.CatalogOptions.Include(x => x.Category).FirstOrDefaultAsync(x => x.Id == id);
    if (option is null) return Results.NotFound();

    option.IsActive = request.IsActive;
    option.UpdatedAt = DateTimeOffset.UtcNow;

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = request.IsActive ? "ACTIVATE_CATALOG_OPTION" : "DEACTIVATE_CATALOG_OPTION",
        Module = "Administration",
        EntityType = nameof(CatalogOption),
        EntityId = option.Id.ToString(),
        Details = $"{option.Category.Code}:{option.Code}",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Ok();
}).RequirePermission("role.manage");

app.MapPost("/api/files/upload", async (
    IFormFile file,
    string module,
    string? recordId,
    IConfiguration configuration,
    CurrentUser current,
    AppDbContext db,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (file.Length == 0 || file.Length > 20 * 1024 * 1024)
        return Results.BadRequest(new { message = "File phải từ 1 byte đến 20 MB." });

    var extensionByContentType = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["application/pdf"] = ".pdf",
        ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = ".docx",
        ["application/msword"] = ".doc"
    };
    if (!extensionByContentType.TryGetValue(file.ContentType, out var extension))
        return Results.BadRequest(new { message = "Định dạng file không được hỗ trợ." });

    var safeModule = new string(module
        .Where(character => char.IsLetterOrDigit(character) || character is '-' or '_')
        .ToArray())
        .ToLowerInvariant();
    if (string.IsNullOrWhiteSpace(safeModule))
        return Results.BadRequest(new { message = "Module lưu file không hợp lệ." });

    var root = Path.GetFullPath(configuration["UploadRoot"] ?? "uploads");
    var folder = Path.Combine(DateTime.UtcNow.Year.ToString(), safeModule);
    var storageName = $"{Guid.NewGuid():N}{extension}";
    var relativePath = Path.Combine(folder, storageName);
    var fullPath = Path.GetFullPath(Path.Combine(root, relativePath));
    if (!fullPath.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        return Results.BadRequest(new { message = "Đường dẫn lưu file không hợp lệ." });

    Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
    await using (var stream = File.Create(fullPath))
        await file.CopyToAsync(stream);

    var storedFile = new StoredFile
    {
        OriginalName = Path.GetFileName(file.FileName),
        StorageName = storageName,
        RelativePath = relativePath,
        ContentType = file.ContentType,
        SizeBytes = file.Length,
        Module = safeModule,
        RecordId = recordId,
        UploadedByUserId = current.Id.Value
    };

    db.StoredFiles.Add(storedFile);
    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPLOAD",
        Module = "Documents",
        EntityType = nameof(StoredFile),
        EntityId = storedFile.Id.ToString(),
        Details = storedFile.OriginalName,
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Ok(new { storedFile.Id, storedFile.OriginalName, storedFile.SizeBytes });
}).DisableAntiforgery().RequirePermission("file.upload");

app.Run();

record LoginRequest(string Username, string Password, bool RememberMe = false);
record CustomerRequest(
    string CustomerType,
    string Name,
    string Phone,
    string? Email,
    string? Address,
    string? Area,
    string Source,
    string Status,
    string? Notes);
record CareRequest(
    Guid CustomerId,
    Guid? AssigneeUserId,
    string CareType,
    DateTimeOffset ScheduledAt,
    string Content);
record CompleteCareRequest(string Result, DateTimeOffset? NextCareAt);
record AssignRolesRequest(Guid[] RoleIds);
record CatalogOptionRequest(string Code, string Label, string? Description, string? Color, int SortOrder);
record CatalogOptionActiveRequest(bool IsActive);
