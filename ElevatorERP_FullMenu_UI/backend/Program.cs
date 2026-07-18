using System.Security.Claims;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
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
builder.Services.AddHttpClient("geo", client =>
{
    client.DefaultRequestHeaders.UserAgent.ParseAdd("ElevatorERP/1.0");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});

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
    string? statusGroup,
    string? customerType,
    string? elevatorType,
    string? source,
    string? owner,
    string? area,
    DateTimeOffset? createdFrom,
    DateTimeOffset? createdTo,
    AppDbContext db,
    CurrentUser current) =>
{
    var query = db.Customers.Include(x => x.OwnerUser).AsQueryable();
    var isManager = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));

    if (!isManager && current.Id is not null)
        query = query.Where(x => x.OwnerUserId == current.Id);

    if (!string.IsNullOrWhiteSpace(search))
        search = search.Trim();

    if (!string.IsNullOrWhiteSpace(status))
        query = query.Where(x => x.Status == status);
    else if (!string.IsNullOrWhiteSpace(statusGroup))
    {
        var statuses = statusGroup switch
        {
            "new" => ["NEW"],
            "caring" => new[] { "CONTACTED", "CARING", "WAITING_SURVEY", "SURVEYED", "VISITED_SHOWROOM", "WAITING_RESPONSE", "PAUSED" },
            "quoted" => new[] { "QUOTED", "NEGOTIATING", "CONVERTED", "SIGNED" },
            _ => []
        };
        if (statuses.Length > 0) query = query.Where(x => statuses.Contains(x.Status));
    }

    if (!string.IsNullOrWhiteSpace(source))
        query = query.Where(x => x.Source == source);

    if (!string.IsNullOrWhiteSpace(customerType))
        query = query.Where(x => x.CustomerType == customerType);

    if (!string.IsNullOrWhiteSpace(elevatorType))
        query = query.Where(x => x.ElevatorType == elevatorType);

    if (!string.IsNullOrWhiteSpace(owner))
        query = query.Where(x => x.OwnerUser.DisplayName == owner);

    if (!string.IsNullOrWhiteSpace(area))
    {
        var normalizedArea = area.Trim().ToLower();
        query = query.Where(x => x.Area != null && x.Area.ToLower().Contains(normalizedArea));
    }

    if (createdFrom is not null)
        query = query.Where(x => x.CreatedAt >= createdFrom);

    if (createdTo is not null)
        query = query.Where(x => x.CreatedAt <= createdTo);

    var rows = await query
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.Phone,
            x.Email,
            x.Address,
            x.Area,
            x.ElevatorType,
            x.Latitude,
            x.Longitude,
            x.LocationAccuracyMeters,
            x.LocationLabel,
            x.CustomerType,
            x.Source,
            x.Status,
            x.Notes,
            owner = x.OwnerUser.DisplayName,
            x.CreatedAt
        })
        .ToListAsync();

    if (!string.IsNullOrWhiteSpace(search))
    {
        var normalizedSearch = SearchText.Normalize(search);
        rows = rows
            .Where(x => SearchText.Normalize($"{x.Name} {x.Code} {x.Phone} {x.Email}").Contains(normalizedSearch))
            .ToList();
    }

    return Results.Ok(rows.OrderByDescending(x => CustomerCodeSort.Key(x.Code)).ThenByDescending(x => x.Code));
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
        ElevatorType = request.ElevatorType?.Trim(),
        Name = request.Name.Trim(),
        Phone = request.Phone.Trim(),
        Email = request.Email?.Trim(),
        Address = request.Address?.Trim(),
        Area = request.Area?.Trim(),
        Latitude = request.Latitude,
        Longitude = request.Longitude,
        LocationAccuracyMeters = request.LocationAccuracyMeters,
        LocationLabel = request.LocationLabel?.Trim(),
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

app.MapPut("/api/customers/{id:guid}", async (
    Guid id,
    CustomerRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
        return Results.BadRequest(new { message = "Tên khách hàng và số điện thoại là bắt buộc." });

    var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == id);
    if (customer is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && customer.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    customer.CustomerType = request.CustomerType;
    customer.ElevatorType = request.ElevatorType?.Trim();
    customer.Name = request.Name.Trim();
    customer.Phone = request.Phone.Trim();
    customer.Email = request.Email?.Trim();
    customer.Address = request.Address?.Trim();
    customer.Area = request.Area?.Trim();
    customer.Latitude = request.Latitude;
    customer.Longitude = request.Longitude;
    customer.LocationAccuracyMeters = request.LocationAccuracyMeters;
    customer.LocationLabel = request.LocationLabel?.Trim();
    customer.Source = request.Source;
    customer.Status = request.Status;
    customer.Notes = request.Notes?.Trim();
    customer.UpdatedAt = DateTimeOffset.UtcNow;

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPDATE",
        Module = "Customers",
        EntityType = nameof(Customer),
        EntityId = customer.Id.ToString(),
        Details = customer.Code,
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.NoContent();
}).RequirePermission("customer.update");

app.MapPut("/api/customers/{id:guid}/status", async (
    Guid id,
    CustomerStatusRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Status))
        return Results.BadRequest(new { message = "Trạng thái là bắt buộc." });

    var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == id);
    if (customer is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && customer.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    var nextStatus = request.Status.Trim();
    if (customer.Status == nextStatus) return Results.NoContent();

    var previousStatus = customer.Status;
    customer.Status = nextStatus;
    customer.UpdatedAt = DateTimeOffset.UtcNow;

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPDATE_STATUS",
        Module = "Customers",
        EntityType = nameof(Customer),
        EntityId = customer.Id.ToString(),
        Details = $"{customer.Code}: {previousStatus} -> {nextStatus}",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.NoContent();
}).RequirePermission("customer.update");

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

app.MapGet("/api/geo/search", async (
    string q,
    string? area,
    IHttpClientFactory httpClientFactory,
    CancellationToken cancellationToken) =>
{
    var query = q.Trim();
    if (query.Length < 2)
        return Results.Ok(Array.Empty<GeoSearchResult>());

    var boundedQuery = query.Length > 120 ? query[..120] : query;
    var searchText = string.IsNullOrWhiteSpace(area)
        ? boundedQuery
        : $"{boundedQuery} {area.Trim()}";

    var client = httpClientFactory.CreateClient("geo");

    var parameters = GeoSearch.BuildQueryString(new Dictionary<string, string>
    {
        ["format"] = "jsonv2",
        ["q"] = searchText,
        ["limit"] = "6",
        ["addressdetails"] = "1",
        ["countrycodes"] = "vn",
        ["accept-language"] = "vi"
    });

    try
    {
        using var response = await client.GetAsync($"https://nominatim.openstreetmap.org/search?{parameters}", cancellationToken);
        if (!response.IsSuccessStatusCode)
            return Results.Json(Array.Empty<GeoSearchResult>());

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var results = document.RootElement
            .EnumerateArray()
            .Select((item, index) => GeoSearch.CreateResult(item, index))
            .Where(result => result is not null)
            .Cast<GeoSearchResult>()
            .ToArray();

        return Results.Ok(results);
    }
    catch
    {
        return Results.Json(Array.Empty<GeoSearchResult>());
    }
}).RequireAuthorization();

app.MapPost("/api/geo/resolve-link", async (
    GeoLinkResolveRequest request,
    IHttpClientFactory httpClientFactory,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Text))
        return Results.BadRequest(new { message = "Vui lòng nhập link Google Maps hoặc tọa độ." });

    var parsed = GeoSearch.ParseSharedLocation(request.Text);
    if (parsed is not null) return Results.Ok(parsed);

    if (!Uri.TryCreate(request.Text.Trim(), UriKind.Absolute, out var uri)
        || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
    {
        return Results.BadRequest(new { message = "Không đọc được tọa độ từ nội dung đã nhập." });
    }

    var client = httpClientFactory.CreateClient("geo");
    try
    {
        using var requestMessage = new HttpRequestMessage(HttpMethod.Get, uri);
        using var response = await client.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var resolvedUrl = response.RequestMessage?.RequestUri?.ToString();
        var resolved = GeoSearch.ParseSharedLocation(resolvedUrl);
        return resolved is null
            ? Results.BadRequest(new { message = "Link này không chứa tọa độ rõ ràng. Hãy mở Google Maps, bấm Chia sẻ tại đúng điểm ghim rồi copy lại link." })
            : Results.Ok(resolved);
    }
    catch
    {
        return Results.BadRequest(new { message = "Không mở được link để đọc tọa độ." });
    }
}).RequireAuthorization();

app.Run();

record LoginRequest(string Username, string Password, bool RememberMe = false);
record CustomerRequest(
    string CustomerType,
    string Name,
    string Phone,
    string? Email,
    string? Address,
    string? Area,
    string? ElevatorType,
    double? Latitude,
    double? Longitude,
    double? LocationAccuracyMeters,
    string? LocationLabel,
    string Source,
    string Status,
    string? Notes);
record CustomerStatusRequest(string Status);
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
record GeoLinkResolveRequest(string Text);
record GeoSearchResult(
    string Id,
    string Title,
    string Subtitle,
    string Type,
    double? Latitude,
    double? Longitude,
    string Label,
    string Provider,
    string? PlaceId);

static class SearchText
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";

        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category != UnicodeCategory.NonSpacingMark)
                builder.Append(character == 'đ' ? 'd' : character);
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}

static class CustomerCodeSort
{
    public static int Key(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return 0;
        var digits = new string(code.Reverse().TakeWhile(char.IsDigit).Reverse().ToArray());
        return int.TryParse(digits, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : 0;
    }
}

static class GeoSearch
{
    public static string BuildQueryString(IReadOnlyDictionary<string, string> parameters)
    {
        return string.Join("&", parameters.Select(parameter =>
            $"{Uri.EscapeDataString(parameter.Key)}={Uri.EscapeDataString(parameter.Value)}"));
    }

    public static GeoSearchResult? CreateResult(JsonElement item, int index)
    {
        var displayName = GetJsonString(item, "display_name");
        var latitudeText = GetJsonString(item, "lat");
        var longitudeText = GetJsonString(item, "lon");
        if (string.IsNullOrWhiteSpace(displayName)
            || !double.TryParse(latitudeText, NumberStyles.Float, CultureInfo.InvariantCulture, out var latitude)
            || !double.TryParse(longitudeText, NumberStyles.Float, CultureInfo.InvariantCulture, out var longitude))
        {
            return null;
        }

        var name = GetJsonString(item, "name");
        var type = GetJsonString(item, "type") ?? GetJsonString(item, "class") ?? "địa điểm";
        var title = string.IsNullOrWhiteSpace(name)
            ? displayName.Split(',', 2)[0].Trim()
            : name.Trim();
        var subtitle = displayName.StartsWith(title, StringComparison.OrdinalIgnoreCase)
            ? displayName[title.Length..].Trim(' ', ',')
            : displayName;

        return new GeoSearchResult(
            GetJsonString(item, "place_id") ?? $"{latitude.ToString(CultureInfo.InvariantCulture)}:{longitude.ToString(CultureInfo.InvariantCulture)}:{index}",
            title,
            subtitle,
            type,
            latitude,
            longitude,
            displayName,
            "nominatim",
            null);
    }

    static string? GetJsonString(JsonElement item, string propertyName)
    {
        return item.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    public static GeoSearchResult? ParseSharedLocation(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var input = Uri.UnescapeDataString(text.Trim());
        var coordinate = TryMatchCoordinate(input, @"@(?<lat>-?\d+(?:\.\d+)?),(?<lng>-?\d+(?:\.\d+)?)")
            ?? TryMatchCoordinate(input, @"[?&](?:query|q|ll|center)=(?<lat>-?\d+(?:\.\d+)?),(?<lng>-?\d+(?:\.\d+)?)")
            ?? TryMatchCoordinate(input, @"(?<![\d.])(?<lat>-?\d{1,2}(?:\.\d+)?)\s*,\s*(?<lng>-?\d{1,3}(?:\.\d+)?)(?![\d.])")
            ?? TryMatchDmsCoordinate(input);

        if (coordinate is null) return null;

        var (latitude, longitude) = coordinate.Value;
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180) return null;

        var label = input.Length > 180 ? input[..180] : input;
        return new GeoSearchResult(
            $"shared:{latitude.ToString(CultureInfo.InvariantCulture)}:{longitude.ToString(CultureInfo.InvariantCulture)}",
            "Vị trí từ link/tọa độ",
            $"{latitude.ToString("F6", CultureInfo.InvariantCulture)}, {longitude.ToString("F6", CultureInfo.InvariantCulture)}",
            "tọa độ",
            latitude,
            longitude,
            label,
            "shared",
            null);
    }

    static (double Latitude, double Longitude)? TryMatchCoordinate(string input, string pattern)
    {
        var match = Regex.Match(input, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (!match.Success) return null;

        return double.TryParse(match.Groups["lat"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var latitude)
            && double.TryParse(match.Groups["lng"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var longitude)
            ? (latitude, longitude)
            : null;
    }

    static (double Latitude, double Longitude)? TryMatchDmsCoordinate(string input)
    {
        var match = Regex.Match(
            input,
            @"(?<latDeg>\d{1,2})[°\s]+(?<latMin>\d{1,2})['′\s]+(?<latSec>\d{1,2}(?:\.\d+)?)[""″]?\s*(?<latHem>[NS])\s+(?<lngDeg>\d{1,3})[°\s]+(?<lngMin>\d{1,2})['′\s]+(?<lngSec>\d{1,2}(?:\.\d+)?)[""″]?\s*(?<lngHem>[EW])",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (!match.Success) return null;

        static double Convert(string degrees, string minutes, string seconds, string hemisphere)
        {
            var value = double.Parse(degrees, CultureInfo.InvariantCulture)
                + double.Parse(minutes, CultureInfo.InvariantCulture) / 60
                + double.Parse(seconds, CultureInfo.InvariantCulture) / 3600;
            return hemisphere.Equals("S", StringComparison.OrdinalIgnoreCase)
                || hemisphere.Equals("W", StringComparison.OrdinalIgnoreCase)
                ? -value
                : value;
        }

        return (
            Convert(match.Groups["latDeg"].Value, match.Groups["latMin"].Value, match.Groups["latSec"].Value, match.Groups["latHem"].Value),
            Convert(match.Groups["lngDeg"].Value, match.Groups["lngMin"].Value, match.Groups["lngSec"].Value, match.Groups["lngHem"].Value)
        );
    }

    public static async Task<GeoSearchResult[]> SearchGooglePlacesAsync(
        HttpClient client,
        string query,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var parameters = BuildQueryString(new Dictionary<string, string>
        {
            ["input"] = query,
            ["language"] = "vi",
            ["components"] = "country:vn",
            ["key"] = apiKey
        });

        try
        {
            using var response = await client.GetAsync($"https://maps.googleapis.com/maps/api/place/autocomplete/json?{parameters}", cancellationToken);
            if (!response.IsSuccessStatusCode) return [];

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (!document.RootElement.TryGetProperty("predictions", out var predictions)
                || predictions.ValueKind != JsonValueKind.Array)
                return [];

            return predictions
                .EnumerateArray()
                .Take(6)
                .Select(CreateGoogleSuggestion)
                .Where(result => result is not null)
                .Cast<GeoSearchResult>()
                .ToArray();
        }
        catch
        {
            return [];
        }
    }

    public static async Task<GeoSearchResult?> ResolveGooglePlaceAsync(
        HttpClient client,
        string placeId,
        string apiKey,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(placeId)) return null;
        var parameters = BuildQueryString(new Dictionary<string, string>
        {
            ["place_id"] = placeId,
            ["fields"] = "place_id,name,formatted_address,geometry,types",
            ["language"] = "vi",
            ["key"] = apiKey
        });

        try
        {
            using var response = await client.GetAsync($"https://maps.googleapis.com/maps/api/place/details/json?{parameters}", cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (!document.RootElement.TryGetProperty("result", out var result)
                || !result.TryGetProperty("geometry", out var geometry)
                || !geometry.TryGetProperty("location", out var location)
                || !location.TryGetProperty("lat", out var latitudeProperty)
                || !location.TryGetProperty("lng", out var longitudeProperty))
                return null;

            var latitude = latitudeProperty.GetDouble();
            var longitude = longitudeProperty.GetDouble();
            var label = GetJsonString(result, "formatted_address") ?? GetJsonString(result, "name") ?? placeId;
            var title = GetJsonString(result, "name") ?? label.Split(',', 2)[0].Trim();
            var subtitle = label.StartsWith(title, StringComparison.OrdinalIgnoreCase)
                ? label[title.Length..].Trim(' ', ',')
                : label;
            var type = result.TryGetProperty("types", out var types) && types.ValueKind == JsonValueKind.Array
                ? types.EnumerateArray().Select(typeItem => typeItem.GetString()).FirstOrDefault(typeItem => !string.IsNullOrWhiteSpace(typeItem)) ?? "place"
                : "place";

            return new GeoSearchResult(placeId, title, subtitle, type, latitude, longitude, label, "google", placeId);
        }
        catch
        {
            return null;
        }
    }

    static GeoSearchResult? CreateGoogleSuggestion(JsonElement prediction)
    {
        var placeId = GetJsonString(prediction, "place_id");
        var description = GetJsonString(prediction, "description");
        if (string.IsNullOrWhiteSpace(placeId) || string.IsNullOrWhiteSpace(description))
            return null;

        var title = description.Split(',', 2)[0].Trim();
        var subtitle = description.StartsWith(title, StringComparison.OrdinalIgnoreCase)
            ? description[title.Length..].Trim(' ', ',')
            : description;
        var type = prediction.TryGetProperty("types", out var types) && types.ValueKind == JsonValueKind.Array
            ? types.EnumerateArray().Select(typeItem => typeItem.GetString()).FirstOrDefault(typeItem => !string.IsNullOrWhiteSpace(typeItem)) ?? "place"
            : "place";

        return new GeoSearchResult(placeId, title, subtitle, type, null, null, description, "google", placeId);
    }
}
