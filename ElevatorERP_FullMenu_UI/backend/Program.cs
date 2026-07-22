using System.Security.Claims;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
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

app.MapGet("/api/customers/{id:guid}/overview", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();

    var customer = await db.Customers
        .Include(x => x.OwnerUser)
        .FirstOrDefaultAsync(x => x.Id == id);
    if (customer is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng." });

    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && customer.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    var profiles = await db.ConsultationProfiles
        .Where(x => x.CustomerId == id)
        .Select(x => new { x.Id, x.TechnicalSpecsJson })
        .ToListAsync();
    var quotationIds = await db.Quotations
        .Where(x => x.CustomerId == id)
        .Select(x => x.Id)
        .ToListAsync();
    var elevatorRows = await db.CustomerElevators
        .Where(x => x.CustomerId == id)
        .Select(x => new { x.Id, x.Status })
        .ToListAsync();

    var profileIds = profiles.Select(x => x.Id.ToString()).ToHashSet();
    var quotationIdSet = quotationIds.Select(x => x.ToString()).ToHashSet();
    var elevatorIds = elevatorRows.Select(x => x.Id.ToString()).ToHashSet();
    var activity = await db.AuditLogs
        .Where(x =>
            (x.EntityType == nameof(Customer) && x.EntityId == id.ToString()) ||
            (x.EntityType == nameof(ConsultationProfile) && x.EntityId != null && profileIds.Contains(x.EntityId)) ||
            (x.EntityType == nameof(Quotation) && x.EntityId != null && quotationIdSet.Contains(x.EntityId)) ||
            (x.EntityType == nameof(CustomerElevator) && x.EntityId != null && elevatorIds.Contains(x.EntityId)))
        .OrderByDescending(x => x.CreatedAt)
        .Take(10)
        .Select(x => new { x.Id, x.CreatedAt, x.Username, x.Action, x.Module, x.EntityType, x.EntityId, x.Details })
        .ToListAsync();

    return Results.Ok(new
    {
        customer = new
        {
            customer.Id,
            customer.Code,
            customer.Name,
            customer.Phone,
            customer.Email,
            customer.Address,
            customer.Source,
            customer.Status,
            owner = customer.OwnerUser.DisplayName
        },
        summary = new
        {
            consultationProfileCount = profiles.Count,
            requirementCount = profiles.Sum(x => TechnicalSpecFilter.CountSpecifications(x.TechnicalSpecsJson)),
            quotationCount = quotationIds.Count,
            customerElevatorCount = elevatorRows.Count,
            implementationCount = elevatorRows.Count(x => x.Status is "PENDING_IMPLEMENTATION" or "IMPLEMENTING"),
            warrantyCount = elevatorRows.Count(x => x.Status == "WARRANTY"),
            maintenanceCount = elevatorRows.Count(x => x.Status == "MAINTENANCE")
        },
        recentActivity = activity
    });
}).RequirePermission("customer.view");

app.MapGet("/api/customers/{id:guid}/elevators", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();

    var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == id);
    if (customer is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng." });

    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && customer.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    var rows = await db.CustomerElevators
        .Where(x => x.CustomerId == id)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.ElevatorType,
            x.InstallationAddress,
            x.Area,
            x.Status,
            x.ContractReference,
            x.SignedAt,
            x.HandedOverAt,
            x.WarrantyExpiresAt,
            consultationProfileCode = x.ConsultationProfile != null ? x.ConsultationProfile.Code : null,
            quotationCode = x.SourceQuotation != null ? x.SourceQuotation.Code : null
        })
        .ToListAsync();

    return Results.Ok(rows);
}).RequirePermission("customer.view");

app.MapGet("/api/customers/{id:guid}/customer-360", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();

    var customer = await db.Customers
        .Include(x => x.OwnerUser)
        .FirstOrDefaultAsync(x => x.Id == id);
    if (customer is null) return Results.NotFound(new { message = "Customer was not found." });

    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && customer.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    var profileRows = await db.ConsultationProfiles
        .Where(x => x.CustomerId == id)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.ProfileType,
            x.Status,
            x.Source,
            x.CreatedAt,
            x.UpdatedAt,
            x.TechnicalSpecsJson,
            quotationCount = x.Quotations.Count,
            customerElevatorCount = x.CustomerElevators.Count
        })
        .ToListAsync();
    var profiles = profileRows.Select(x => new
    {
        x.Id,
        x.Code,
        x.ProfileType,
        x.Status,
        x.Source,
        x.CreatedAt,
        x.UpdatedAt,
        technicalConfigurationCount = TechnicalSpecFilter.CountSpecifications(x.TechnicalSpecsJson),
        x.quotationCount,
        x.customerElevatorCount
    }).ToList();

    var consultationElevators = profileRows.SelectMany(profile =>
        TechnicalSpecDocument.ReadArray(profile.TechnicalSpecsJson)
            .Select((specification, index) => new
            {
                id = $"{profile.Id}:{TechnicalSpecDocument.ReadString(specification, "id") ?? index.ToString()}",
                configurationId = TechnicalSpecDocument.ReadString(specification, "id") ?? index.ToString(),
                consultationProfileId = profile.Id,
                consultationProfileCode = profile.Code,
                consultationProfileStatus = profile.Status,
                name = TechnicalSpecDocument.ReadString(specification, "name") ?? $"Thang máy {index + 1}",
                elevatorType = TechnicalSpecDocument.ReadString(specification, "elevatorType"),
                floors = TechnicalSpecDocument.ReadDouble(specification, "floors"),
                capacityKg = TechnicalSpecDocument.ReadDouble(specification, "capacityKg"),
                installationAddress = TechnicalSpecDocument.ReadString(specification, "installationAddress"),
                area = TechnicalSpecDocument.BuildArea(specification)
            }))
        .ToList();

    var quotations = await db.Quotations
        .Where(x => x.CustomerId == id)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.Title,
            x.Status,
            x.TotalAmount,
            x.ConsultationProfileId,
            consultationProfileCode = x.ConsultationProfile != null ? x.ConsultationProfile.Code : null,
            x.CreatedAt
        })
        .ToListAsync();

    var elevators = await db.CustomerElevators
        .Where(x => x.CustomerId == id)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.ElevatorType,
            x.Status,
            x.InstallationAddress,
            x.ContractReference,
            x.SignedAt,
            x.HandedOverAt,
            x.WarrantyExpiresAt,
            consultationProfileCode = x.ConsultationProfile != null ? x.ConsultationProfile.Code : null,
            sourceQuotationId = x.SourceQuotationId,
            sourceQuotationCode = x.SourceQuotation != null ? x.SourceQuotation.Code : null,
            sourceQuotationTotalAmount = x.SourceQuotation != null ? (decimal?)x.SourceQuotation.TotalAmount : null
        })
        .ToListAsync();

    var profileIdSet = profiles.Select(x => x.Id.ToString()).ToHashSet();
    var quotationIdSet = quotations.Select(x => x.Id.ToString()).ToHashSet();
    var elevatorIdSet = elevators.Select(x => x.Id.ToString()).ToHashSet();
    var history = await db.AuditLogs
        .Where(x =>
            (x.EntityType == nameof(Customer) && x.EntityId == id.ToString()) ||
            (x.EntityType == nameof(ConsultationProfile) && x.EntityId != null && profileIdSet.Contains(x.EntityId)) ||
            (x.EntityType == nameof(Quotation) && x.EntityId != null && quotationIdSet.Contains(x.EntityId)) ||
            (x.EntityType == nameof(CustomerElevator) && x.EntityId != null && elevatorIdSet.Contains(x.EntityId)))
        .OrderByDescending(x => x.CreatedAt)
        .Take(30)
        .Select(x => new { x.Id, x.CreatedAt, x.Username, x.Action, x.Module, x.EntityType, x.EntityId, x.Details })
        .ToListAsync();

    return Results.Ok(new
    {
        customer = new
        {
            customer.Id,
            customer.Code,
            customer.Name,
            customer.Phone,
            customer.Email,
            customer.Address,
            customer.CustomerType,
            customer.Source,
            customer.Status,
            owner = customer.OwnerUser.DisplayName
        },
        summary = new
        {
            consultationProfileCount = profiles.Count,
            technicalConfigurationCount = profiles.Sum(x => x.technicalConfigurationCount),
            quotationCount = quotations.Count,
            customerElevatorCount = elevators.Count,
            activeElevatorCount = elevators.Count(x => x.Status is "PENDING_IMPLEMENTATION" or "IMPLEMENTING" or "WARRANTY" or "MAINTENANCE")
        },
        consultationProfiles = profiles,
        consultationElevators,
        quotations,
        elevators,
        history
    });
}).RequirePermission("customer.view");

app.MapGet("/api/customers/{id:guid}/history", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();
    var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == id);
    if (customer is null) return Results.NotFound(new { message = "Customer was not found." });

    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && customer.OwnerUserId != current.Id.Value) return Results.Forbid();

    var profileIds = await db.ConsultationProfiles.Where(x => x.CustomerId == id).Select(x => x.Id.ToString()).ToListAsync();
    var quotationIds = await db.Quotations.Where(x => x.CustomerId == id).Select(x => x.Id.ToString()).ToListAsync();
    var elevatorIds = await db.CustomerElevators.Where(x => x.CustomerId == id).Select(x => x.Id.ToString()).ToListAsync();
    return Results.Ok(await db.AuditLogs
        .Where(x =>
            (x.EntityType == nameof(Customer) && x.EntityId == id.ToString()) ||
            (x.EntityType == nameof(ConsultationProfile) && x.EntityId != null && profileIds.Contains(x.EntityId)) ||
            (x.EntityType == nameof(Quotation) && x.EntityId != null && quotationIds.Contains(x.EntityId)) ||
            (x.EntityType == nameof(CustomerElevator) && x.EntityId != null && elevatorIds.Contains(x.EntityId)))
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new { x.Id, x.CreatedAt, x.Username, x.Action, x.Module, x.EntityType, x.EntityId, x.Details })
        .ToListAsync());
}).RequirePermission("customer.view");

app.MapGet("/api/customers/{id:guid}/care-activities", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();

    var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == id);
    if (customer is null) return Results.NotFound(new { message = "Customer was not found." });

    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && customer.OwnerUserId != current.Id.Value) return Results.Forbid();

    return Results.Ok(await db.CareActivities
        .Where(x => x.CustomerId == id)
        .Include(x => x.AssigneeUser)
        .OrderByDescending(x => x.ScheduledAt)
        .Select(x => new
        {
            x.Id,
            x.CareType,
            x.ScheduledAt,
            x.Content,
            x.Result,
            x.Status,
            x.NextCareAt,
            assignee = x.AssigneeUser.DisplayName
        })
        .ToListAsync());
}).RequirePermission("care.view");

app.MapGet("/api/customers", async (
    string? search,
    string? status,
    string? statusGroup,
    string? customerType,
    string? elevatorType,
    string? source,
    string? owner,
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
            x.ElevatorType,
            x.Latitude,
            x.Longitude,
            x.LocationAccuracyMeters,
            x.LocationLabel,
            x.CustomerType,
            x.Source,
            x.Status,
            x.Notes,
            x.TechnicalSpecsJson,
            x.AttachmentLinksJson,
            consultationProfileCount = db.ConsultationProfiles.Count(profile => profile.CustomerId == x.Id),
            quotationCount = db.Quotations.Count(quotation => quotation.CustomerId == x.Id),
            careActivityCount = db.CareActivities.Count(activity => activity.CustomerId == x.Id),
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

    var phone = request.Phone.Trim();
    if (await db.Customers.AnyAsync(x => x.Phone == phone))
        return Results.BadRequest(new { message = "Số điện thoại đã tồn tại trong hệ thống. Vui lòng mở khách hàng đã có hoặc tạo hồ sơ tư vấn từ khách hàng này." });

    var count = await db.Customers.IgnoreQueryFilters().CountAsync() + 1;
    var customer = new Customer
    {
        Code = $"KH-{count:000000}",
        CustomerType = request.CustomerType,
        ElevatorType = request.ElevatorType?.Trim(),
        Name = request.Name.Trim(),
        Phone = phone,
        Email = request.Email?.Trim(),
        Address = request.Address?.Trim(),
        Latitude = request.Latitude,
        Longitude = request.Longitude,
        LocationAccuracyMeters = request.LocationAccuracyMeters,
        LocationLabel = request.LocationLabel?.Trim(),
        Source = request.Source,
        Status = request.Status,
        Notes = request.Notes?.Trim(),
        TechnicalSpecsJson = request.TechnicalSpecsJson?.Trim(),
        AttachmentLinksJson = request.AttachmentLinksJson?.Trim(),
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

    var phone = request.Phone.Trim();
    if (await db.Customers.AnyAsync(x => x.Id != id && x.Phone == phone))
        return Results.BadRequest(new { message = "Số điện thoại đã tồn tại trong hệ thống." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && customer.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    customer.CustomerType = request.CustomerType;
    customer.ElevatorType = request.ElevatorType?.Trim();
    customer.Name = request.Name.Trim();
    customer.Phone = phone;
    customer.Email = request.Email?.Trim();
    customer.Address = request.Address?.Trim();
    customer.Latitude = request.Latitude;
    customer.Longitude = request.Longitude;
    customer.LocationAccuracyMeters = request.LocationAccuracyMeters;
    customer.LocationLabel = request.LocationLabel?.Trim();
    customer.Source = request.Source;
    customer.Status = request.Status;
    customer.Notes = request.Notes?.Trim();
    customer.TechnicalSpecsJson = request.TechnicalSpecsJson?.Trim();
    customer.AttachmentLinksJson = request.AttachmentLinksJson?.Trim();
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

app.MapDelete("/api/customers/{id:guid}", async (
    Guid id,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();

    var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == id);
    if (customer is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng." });

    var canDeleteAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canDeleteAll && customer.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    var consultationProfileCount = await db.ConsultationProfiles.CountAsync(x => x.CustomerId == id);
    var quotationCount = await db.Quotations.CountAsync(x => x.CustomerId == id);
    var careActivityCount = await db.CareActivities.CountAsync(x => x.CustomerId == id);
    var customerElevatorCount = await db.CustomerElevators.CountAsync(x => x.CustomerId == id);
    if (consultationProfileCount > 0 || quotationCount > 0 || careActivityCount > 0 || customerElevatorCount > 0)
    {
        return Results.Conflict(new
        {
            message = "Không thể xóa khách hàng đã phát sinh hồ sơ tư vấn, lịch chăm sóc hoặc báo giá. Hãy giữ khách hàng để bảo toàn lịch sử nghiệp vụ."
        });
    }

    customer.IsDeleted = true;
    customer.UpdatedAt = DateTimeOffset.UtcNow;
    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "DELETE",
        Module = "Customers",
        EntityType = nameof(Customer),
        EntityId = customer.Id.ToString(),
        Details = customer.Code,
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.NoContent();
}).RequirePermission("customer.delete");

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

app.MapGet("/api/consultation-profiles", async (
    string? search,
    string? status,
    string? statusGroup,
    string? customerType,
    string? elevatorType,
    string? elevatorTypes,
    string? technicalConfiguration,
    string? source,
    string? owner,
    DateTimeOffset? createdFrom,
    DateTimeOffset? createdTo,
    AppDbContext db,
    CurrentUser current) =>
{
    var query = db.ConsultationProfiles
        .Include(x => x.Customer)
        .Include(x => x.OwnerUser)
        .AsQueryable();
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
        query = query.Where(x => x.Customer.CustomerType == customerType);

    if (!string.IsNullOrWhiteSpace(elevatorType))
        query = query.Where(x => x.ElevatorType == elevatorType);

    if (!string.IsNullOrWhiteSpace(owner))
        query = query.Where(x => x.OwnerUser.DisplayName == owner);

    if (createdFrom is not null)
        query = query.Where(x => x.CreatedAt >= createdFrom);

    if (createdTo is not null)
        query = query.Where(x => x.CreatedAt <= createdTo);

    var rows = await query
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.CustomerId,
            customerCode = x.Customer.Code,
            x.Customer.Name,
            x.Customer.Phone,
            x.Customer.Email,
            Address = x.Customer.Address,
            x.ElevatorType,
            x.Latitude,
            x.Longitude,
            x.LocationAccuracyMeters,
            x.LocationLabel,
            x.Customer.CustomerType,
            x.ProfileType,
            x.Source,
            x.Status,
            x.Notes,
            x.TechnicalSpecsJson,
            x.AttachmentLinksJson,
            x.IsKpiEligible,
            x.KpiCountedAt,
            owner = x.OwnerUser.DisplayName,
            x.CreatedAt
        })
        .ToListAsync();

    var selectedElevatorTypes = (elevatorTypes ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);
    if (selectedElevatorTypes.Count > 0)
    {
        rows = rows
            .Where(x => TechnicalSpecFilter.ReadElevatorTypes(x.TechnicalSpecsJson)
                .Overlaps(selectedElevatorTypes))
            .ToList();
    }

    if (technicalConfiguration is "CONFIGURED" or "UNCONFIGURED")
    {
        var requiresConfiguration = technicalConfiguration == "CONFIGURED";
        rows = rows
            .Where(x => TechnicalSpecFilter.HasAnySpecification(x.TechnicalSpecsJson) == requiresConfiguration)
            .ToList();
    }

    if (!string.IsNullOrWhiteSpace(search))
    {
        var normalizedSearch = SearchText.Normalize(search);
        rows = rows
            .Where(x => SearchText.Normalize($"{x.Code} {x.customerCode} {x.Name} {x.Phone} {x.Email}").Contains(normalizedSearch))
            .ToList();
    }

    return Results.Ok(rows.OrderByDescending(x => CustomerCodeSort.Key(x.Code)).ThenByDescending(x => x.Code));
}).RequirePermission("customer.view");

app.MapPost("/api/consultation-profiles", async (
    ConsultationProfileRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
        return Results.BadRequest(new { message = "Tên khách hàng và số điện thoại là bắt buộc." });

    var phone = request.Phone.Trim();
    var email = request.Email?.Trim();
    var customer = request.CustomerId is not null
        ? await db.Customers.FirstOrDefaultAsync(x => x.Id == request.CustomerId)
        : null;
    if (request.CustomerId is not null && customer is null)
        return Results.NotFound(new { message = "Không tìm thấy khách hàng đã chọn." });
    if (request.CustomerId is null && await db.Customers.AnyAsync(x => x.Phone == phone))
        return Results.BadRequest(new { message = "Số điện thoại đã tồn tại trong hệ thống. Vui lòng chọn khách hàng đã có để tạo hồ sơ tư vấn mới." });

    var isNewCustomer = customer is null;
    if (customer is null)
    {
        var customerCount = await db.Customers.IgnoreQueryFilters().CountAsync() + 1;
        customer = new Customer
        {
            Code = $"KH-{customerCount:000000}",
            CustomerType = request.CustomerType,
            Name = request.Name.Trim(),
            Phone = phone,
            Email = email,
            Address = request.Address?.Trim(),
            ElevatorType = request.ElevatorType?.Trim(),
            Source = request.Source,
            Status = request.Status,
            Notes = request.Notes?.Trim(),
            OwnerUserId = current.Id.Value
        };
        db.Customers.Add(customer);
    }
    else
    {
        if (await db.Customers.AnyAsync(x => x.Id != customer.Id && x.Phone == phone))
            return Results.BadRequest(new { message = "Số điện thoại đã tồn tại trong hệ thống." });

        customer.CustomerType = request.CustomerType;
        customer.Name = request.Name.Trim();
        customer.Phone = phone;
        customer.Email = email;
        customer.Address = request.Address?.Trim();
        customer.UpdatedAt = DateTimeOffset.UtcNow;
    }

    var profileCount = await db.ConsultationProfiles.IgnoreQueryFilters().CountAsync() + 1;
    var now = DateTimeOffset.UtcNow;
    var profile = new ConsultationProfile
    {
        Code = $"HSTV-{profileCount:000000}",
        Customer = customer,
        ProfileType = isNewCustomer ? "NEW_CUSTOMER" : "EXISTING_CUSTOMER_NEW_NEED",
        Source = request.Source,
        Status = string.IsNullOrWhiteSpace(request.Status) ? "NEW" : request.Status.Trim(),
        OwnerUserId = current.Id.Value,
        ProjectAddress = null,
        ElevatorType = request.ElevatorType?.Trim(),
        Latitude = null,
        Longitude = null,
        LocationAccuracyMeters = null,
        LocationLabel = null,
        Notes = request.Notes?.Trim(),
        TechnicalSpecsJson = request.TechnicalSpecsJson?.Trim(),
        AttachmentLinksJson = request.AttachmentLinksJson?.Trim(),
        IsKpiEligible = request.IsKpiEligible ?? true,
        KpiCountedAt = request.IsKpiEligible == false ? null : now
    };

    db.ConsultationProfiles.Add(profile);
    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "CREATE",
        Module = "ConsultationProfiles",
        EntityType = nameof(ConsultationProfile),
        EntityId = profile.Id.ToString(),
        Details = profile.Code,
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Created($"/api/consultation-profiles/{profile.Id}", new { profile.Id, profile.Code, profile.CustomerId });
}).RequirePermission("customer.create");

app.MapPut("/api/consultation-profiles/{id:guid}", async (
    Guid id,
    ConsultationProfileRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
        return Results.BadRequest(new { message = "Tên khách hàng và số điện thoại là bắt buộc." });

    var profile = await db.ConsultationProfiles
        .Include(x => x.Customer)
        .FirstOrDefaultAsync(x => x.Id == id);
    if (profile is null) return Results.NotFound(new { message = "Không tìm thấy hồ sơ tư vấn." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && profile.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    profile.Customer.CustomerType = request.CustomerType;
    profile.Customer.Name = request.Name.Trim();
    profile.Customer.Phone = request.Phone.Trim();
    profile.Customer.Email = request.Email?.Trim();
    profile.Customer.Address = request.Address?.Trim();
    profile.Customer.UpdatedAt = DateTimeOffset.UtcNow;

    profile.Source = request.Source;
    profile.Status = request.Status;
    profile.ProjectAddress = null;
    profile.ElevatorType = request.ElevatorType?.Trim();
    profile.Latitude = null;
    profile.Longitude = null;
    profile.LocationAccuracyMeters = null;
    profile.LocationLabel = null;
    profile.Notes = request.Notes?.Trim();
    profile.TechnicalSpecsJson = request.TechnicalSpecsJson?.Trim();
    profile.AttachmentLinksJson = request.AttachmentLinksJson?.Trim();
    profile.IsKpiEligible = request.IsKpiEligible ?? profile.IsKpiEligible;
    profile.KpiCountedAt = profile.IsKpiEligible ? profile.KpiCountedAt ?? profile.CreatedAt : null;
    profile.UpdatedAt = DateTimeOffset.UtcNow;

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPDATE",
        Module = "ConsultationProfiles",
        EntityType = nameof(ConsultationProfile),
        EntityId = profile.Id.ToString(),
        Details = profile.Code,
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.NoContent();
}).RequirePermission("customer.update");

app.MapPut("/api/consultation-profiles/{id:guid}/status", async (
    Guid id,
    CustomerStatusRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Status))
        return Results.BadRequest(new { message = "Trạng thái là bắt buộc." });

    var profile = await db.ConsultationProfiles.FirstOrDefaultAsync(x => x.Id == id);
    if (profile is null) return Results.NotFound(new { message = "Không tìm thấy hồ sơ tư vấn." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && profile.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    var nextStatus = request.Status.Trim();
    if (profile.Status == nextStatus) return Results.NoContent();

    var previousStatus = profile.Status;
    profile.Status = nextStatus;
    profile.UpdatedAt = DateTimeOffset.UtcNow;

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPDATE_STATUS",
        Module = "ConsultationProfiles",
        EntityType = nameof(ConsultationProfile),
        EntityId = profile.Id.ToString(),
        Details = $"{profile.Code}: {previousStatus} -> {nextStatus}",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.NoContent();
}).RequirePermission("customer.update");

app.MapPut("/api/consultation-profiles/{id:guid}/technical-configurations/{configurationId}", async (
    Guid id,
    string configurationId,
    TechnicalConfigurationUpdateRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (request.Configuration.ValueKind != JsonValueKind.Object)
        return Results.BadRequest(new { message = "Dữ liệu cấu hình kỹ thuật không hợp lệ." });

    var profile = await db.ConsultationProfiles.FirstOrDefaultAsync(x => x.Id == id);
    if (profile is null) return Results.NotFound(new { message = "Không tìm thấy hồ sơ tư vấn." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && profile.OwnerUserId != current.Id.Value) return Results.Forbid();

    var configurations = TechnicalSpecDocument.ReadArray(profile.TechnicalSpecsJson);
    var index = configurations.FindIndex(configuration => TechnicalSpecDocument.ReadString(configuration, "id") == configurationId);
    if (index < 0 && int.TryParse(configurationId, out var legacyIndex) && legacyIndex >= 0 && legacyIndex < configurations.Count)
        index = legacyIndex;
    if (index < 0) return Results.NotFound(new { message = "Không tìm thấy cấu hình kỹ thuật thang máy." });

    var updated = JsonNode.Parse(request.Configuration.GetRawText()) as JsonObject;
    if (updated is null) return Results.BadRequest(new { message = "Dữ liệu cấu hình kỹ thuật không hợp lệ." });
    updated["id"] = configurationId;

    configurations[index] = updated;
    profile.TechnicalSpecsJson = TechnicalSpecDocument.Serialize(configurations);
    profile.UpdatedAt = DateTimeOffset.UtcNow;

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPDATE_TECHNICAL_CONFIGURATION",
        Module = "ConsultationProfiles",
        EntityType = nameof(ConsultationProfile),
        EntityId = profile.Id.ToString(),
        Details = $"{profile.Code} · {TechnicalSpecDocument.ReadString(updated, "name") ?? configurationId}",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Ok(new { configuration = updated });
}).RequirePermission("customer.update");

app.MapGet("/api/consultation-profiles/{id:guid}", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();

    var profile = await db.ConsultationProfiles
        .Include(x => x.Customer)
        .Include(x => x.OwnerUser)
        .FirstOrDefaultAsync(x => x.Id == id);
    if (profile is null) return Results.NotFound(new { message = "Consultation profile was not found." });

    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && profile.OwnerUserId != current.Id.Value) return Results.Forbid();

    var quotations = await db.Quotations
        .Where(x => x.ConsultationProfileId == id)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new { x.Id, x.Code, x.Title, x.Status, x.TotalAmount, x.ValidUntil, x.CreatedAt })
        .ToListAsync();
    var elevators = await db.CustomerElevators
        .Where(x => x.ConsultationProfileId == id)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new { x.Id, x.Code, x.Name, x.ElevatorType, x.Status, x.ContractReference, x.CreatedAt })
        .ToListAsync();
    var configurationCount = TechnicalSpecFilter.CountSpecifications(profile.TechnicalSpecsJson);

    return Results.Ok(new
    {
        profile = new
        {
            profile.Id,
            profile.Code,
            profile.CustomerId,
            profile.ProfileType,
            profile.Source,
            profile.Status,
            profile.ProjectAddress,
            profile.Area,
            profile.ElevatorType,
            profile.Latitude,
            profile.Longitude,
            profile.LocationAccuracyMeters,
            profile.LocationLabel,
            profile.Notes,
            profile.TechnicalSpecsJson,
            profile.AttachmentLinksJson,
            profile.IsKpiEligible,
            profile.KpiCountedAt,
            profile.KpiExcludedReason,
            profile.CreatedAt,
            profile.UpdatedAt,
            owner = profile.OwnerUser.DisplayName
        },
        customer = new
        {
            profile.Customer.Id,
            profile.Customer.Code,
            profile.Customer.CustomerType,
            profile.Customer.Name,
            profile.Customer.Phone,
            profile.Customer.Email,
            profile.Customer.Address
        },
        summary = new { technicalConfigurationCount = configurationCount, quotationCount = quotations.Count, customerElevatorCount = elevators.Count },
        quotations,
        customerElevators = elevators
    });
}).RequirePermission("customer.view");

app.MapGet("/api/consultation-profiles/{id:guid}/history", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();
    var profile = await db.ConsultationProfiles.FirstOrDefaultAsync(x => x.Id == id);
    if (profile is null) return Results.NotFound(new { message = "Consultation profile was not found." });

    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && profile.OwnerUserId != current.Id.Value) return Results.Forbid();

    var quotationIds = await db.Quotations.Where(x => x.ConsultationProfileId == id).Select(x => x.Id.ToString()).ToListAsync();
    var elevatorIds = await db.CustomerElevators.Where(x => x.ConsultationProfileId == id).Select(x => x.Id.ToString()).ToListAsync();
    return Results.Ok(await db.AuditLogs
        .Where(x =>
            (x.EntityType == nameof(ConsultationProfile) && x.EntityId == id.ToString()) ||
            (x.EntityType == nameof(Quotation) && x.EntityId != null && quotationIds.Contains(x.EntityId)) ||
            (x.EntityType == nameof(CustomerElevator) && x.EntityId != null && elevatorIds.Contains(x.EntityId)))
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new { x.Id, x.CreatedAt, x.Username, x.Action, x.Module, x.EntityType, x.EntityId, x.Details })
        .ToListAsync());
}).RequirePermission("customer.view");

app.MapPost("/api/consultation-profiles/{id:guid}/copy-technical-configuration", async (
    Guid id,
    CopyTechnicalConfigurationRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    var target = await db.ConsultationProfiles.FirstOrDefaultAsync(x => x.Id == id);
    var source = await db.ConsultationProfiles.FirstOrDefaultAsync(x => x.Id == request.SourceProfileId);
    if (target is null || source is null) return Results.NotFound(new { message = "Consultation profile was not found." });
    if (target.CustomerId != source.CustomerId)
        return Results.BadRequest(new { message = "Only configurations of the same customer can be copied." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && target.OwnerUserId != current.Id.Value) return Results.Forbid();

    var sourceConfigurations = TechnicalSpecDocument.ReadArray(source.TechnicalSpecsJson);
    if (sourceConfigurations.Count == 0)
        return Results.BadRequest(new { message = "The source profile has no technical configuration to copy." });

    var selected = string.IsNullOrWhiteSpace(request.ConfigurationId)
        ? sourceConfigurations
        : sourceConfigurations.Where(x => TechnicalSpecDocument.ReadString(x, "id") == request.ConfigurationId).ToList();
    if (selected.Count == 0)
        return Results.NotFound(new { message = "Technical configuration was not found." });

    var targetConfigurations = TechnicalSpecDocument.ReadArray(target.TechnicalSpecsJson);
    foreach (var configuration in selected)
        targetConfigurations.Add(TechnicalSpecDocument.CloneForCopy(configuration));

    target.TechnicalSpecsJson = TechnicalSpecDocument.Serialize(targetConfigurations);
    target.UpdatedAt = DateTimeOffset.UtcNow;
    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "COPY_TECHNICAL_CONFIGURATION",
        Module = "ConsultationProfiles",
        EntityType = nameof(ConsultationProfile),
        EntityId = target.Id.ToString(),
        Details = $"{target.Code} <= {source.Code} ({selected.Count})",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Ok(new { copiedCount = selected.Count, technicalSpecsJson = target.TechnicalSpecsJson });
}).RequirePermission("customer.update");

app.MapGet("/api/quotations", async (
    string? search,
    string? status,
    Guid? customerId,
    Guid? consultationProfileId,
    AppDbContext db,
    CurrentUser current) =>
{
    var query = db.Quotations
        .Include(x => x.Customer)
        .Include(x => x.ConsultationProfile)
        .Include(x => x.OwnerUser)
        .AsQueryable();

    var isManager = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));

    if (!isManager && current.Id is not null)
        query = query.Where(x => x.OwnerUserId == current.Id);

    if (!string.IsNullOrWhiteSpace(status))
        query = query.Where(x => x.Status == status.Trim());

    if (customerId is not null)
        query = query.Where(x => x.CustomerId == customerId);

    if (consultationProfileId is not null)
        query = query.Where(x => x.ConsultationProfileId == consultationProfileId);

    var rows = await query
        .Select(x => new
        {
            x.Id,
            x.Code,
            x.Title,
            x.VersionNo,
            x.Status,
            x.ValidUntil,
            x.CustomerId,
            x.ConsultationProfileId,
            consultationProfileCode = x.ConsultationProfile != null ? x.ConsultationProfile.Code : "",
            customerCode = x.Customer.Code,
            customer = x.Customer.Name,
            phone = x.Customer.Phone,
            owner = x.OwnerUser.DisplayName,
            x.ElevatorSpecsJson,
            x.CostLinesJson,
            x.SubtotalAmount,
            x.DiscountAmount,
            x.VatRate,
            x.VatAmount,
            x.TotalAmount,
            x.Notes,
            x.SentAt,
            x.ApprovedAt,
            x.CreatedAt
        })
        .ToListAsync();

    if (!string.IsNullOrWhiteSpace(search))
    {
        var normalizedSearch = SearchText.Normalize(search);
        rows = rows
            .Where(x => SearchText.Normalize($"{x.Code} {x.Title} {x.customerCode} {x.customer} {x.phone} {x.owner}").Contains(normalizedSearch))
            .ToList();
    }

    return Results.Ok(rows.OrderByDescending(x => x.CreatedAt));
}).RequirePermission("customer.view");

app.MapPost("/api/quotations", async (
    QuotationRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();

    ConsultationProfile? consultationProfile = null;
    Customer? customer = null;
    if (request.ConsultationProfileId is not null && request.ConsultationProfileId != Guid.Empty)
    {
        consultationProfile = await db.ConsultationProfiles
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == request.ConsultationProfileId);
        if (consultationProfile is null) return Results.NotFound(new { message = "Không tìm thấy hồ sơ tư vấn." });
        customer = consultationProfile.Customer;
    }
    else
    {
        if (request.CustomerId == Guid.Empty)
            return Results.BadRequest(new { message = "Hồ sơ tư vấn là bắt buộc." });
        customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == request.CustomerId);
        if (customer is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng." });
        consultationProfile = await db.ConsultationProfiles
            .Where(x => x.CustomerId == customer.Id)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();
    }

    var canAccessAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    var ownerUserId = consultationProfile?.OwnerUserId ?? customer.OwnerUserId;
    if (!canAccessAll && ownerUserId != current.Id.Value)
        return Results.Forbid();

    if (string.IsNullOrWhiteSpace(request.Title))
        return Results.BadRequest(new { message = "Tên báo giá là bắt buộc." });

    var count = await db.Quotations.IgnoreQueryFilters().CountAsync() + 1;
    var code = $"BG-{DateTimeOffset.UtcNow:yyyy}-{count:000000}";
    var subtotal = Math.Max(request.SubtotalAmount, 0);
    var discount = Math.Clamp(request.DiscountAmount, 0, subtotal);
    var vatRate = Math.Clamp(request.VatRate, 0, 20);
    var taxable = subtotal - discount;
    var vatAmount = Math.Round(taxable * vatRate / 100, 0, MidpointRounding.AwayFromZero);
    var total = taxable + vatAmount;

    var quotation = new Quotation
    {
        Code = code,
        CustomerId = customer.Id,
        ConsultationProfileId = consultationProfile?.Id,
        OwnerUserId = current.Id.Value,
        Title = request.Title.Trim(),
        VersionNo = 1,
        Status = string.IsNullOrWhiteSpace(request.Status) ? "DRAFT" : request.Status.Trim(),
        ValidUntil = request.ValidUntil,
        ElevatorSpecsJson = request.ElevatorSpecsJson?.Trim(),
        CostLinesJson = request.CostLinesJson?.Trim(),
        SubtotalAmount = subtotal,
        DiscountAmount = discount,
        VatRate = vatRate,
        VatAmount = vatAmount,
        TotalAmount = total,
        Notes = request.Notes?.Trim()
    };

    db.Quotations.Add(quotation);
    if (consultationProfile is not null && consultationProfile.Status is "NEW" or "CONTACTED" or "CARING" or "WAITING_SURVEY" or "SURVEYED" or "WAITING_RESPONSE")
    {
        consultationProfile.Status = "QUOTED";
        consultationProfile.UpdatedAt = DateTimeOffset.UtcNow;
    }

    if (customer.Status is "NEW" or "CONTACTED" or "CARING" or "WAITING_SURVEY" or "SURVEYED" or "WAITING_RESPONSE")
    {
        customer.Status = "QUOTED";
        customer.UpdatedAt = DateTimeOffset.UtcNow;
    }

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "CREATE",
        Module = "Quotations",
        EntityType = nameof(Quotation),
        EntityId = quotation.Id.ToString(),
        Details = quotation.Code,
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.Created($"/api/quotations/{quotation.Id}", new { quotation.Id, quotation.Code });
}).RequirePermission("customer.update");

app.MapPut("/api/quotations/{id:guid}/status", async (
    Guid id,
    QuotationStatusRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Status))
        return Results.BadRequest(new { message = "Trạng thái là bắt buộc." });

    var quotation = await db.Quotations
        .Include(x => x.ConsultationProfile)
        .FirstOrDefaultAsync(x => x.Id == id);
    if (quotation is null) return Results.NotFound(new { message = "Không tìm thấy báo giá." });

    var canAccessAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canAccessAll && quotation.OwnerUserId != current.Id.Value)
        return Results.Forbid();

    var previousStatus = quotation.Status;
    quotation.Status = request.Status.Trim();
    quotation.UpdatedAt = DateTimeOffset.UtcNow;
    quotation.SentAt = quotation.Status == "SENT" && quotation.SentAt is null ? DateTimeOffset.UtcNow : quotation.SentAt;
    quotation.ApprovedAt = quotation.Status == "APPROVED" && quotation.ApprovedAt is null ? DateTimeOffset.UtcNow : quotation.ApprovedAt;
    if (quotation.ConsultationProfile is not null)
    {
        quotation.ConsultationProfile.Status = quotation.Status switch
        {
            "SENT" => "QUOTED",
            "ACCEPTED" => "NEGOTIATING",
            "REJECTED" => "LOST",
            _ => quotation.ConsultationProfile.Status
        };
        quotation.ConsultationProfile.UpdatedAt = DateTimeOffset.UtcNow;
    }

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPDATE_STATUS",
        Module = "Quotations",
        EntityType = nameof(Quotation),
        EntityId = quotation.Id.ToString(),
        Details = $"{quotation.Code}: {previousStatus} -> {quotation.Status}",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();

    return Results.NoContent();
}).RequirePermission("customer.update");

app.MapPost("/api/quotations/{id:guid}/confirm-contract", async (
    Guid id,
    ConfirmQuotationContractRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.ContractReference))
        return Results.BadRequest(new { message = "Contract reference is required." });

    var quotation = await db.Quotations
        .Include(x => x.Customer)
        .Include(x => x.ConsultationProfile)
        .FirstOrDefaultAsync(x => x.Id == id);
    if (quotation is null) return Results.NotFound(new { message = "Quotation was not found." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && quotation.OwnerUserId != current.Id.Value) return Results.Forbid();
    if (quotation.Status is not ("ACCEPTED" or "APPROVED" or "SIGNED"))
        return Results.Conflict(new { message = "Quotation must be accepted or approved before confirming a contract." });
    if (await db.CustomerElevators.AnyAsync(x => x.SourceQuotationId == quotation.Id))
        return Results.Conflict(new { message = "This quotation has already been converted to customer elevator assets." });

    var sourceSpecs = TechnicalSpecDocument.ReadArray(quotation.ElevatorSpecsJson);
    if (sourceSpecs.Count == 0 && quotation.ConsultationProfile is not null)
        sourceSpecs = TechnicalSpecDocument.ReadArray(quotation.ConsultationProfile.TechnicalSpecsJson);
    if (sourceSpecs.Count == 0)
        return Results.BadRequest(new { message = "A technical configuration is required before a contract can create elevator assets." });

    var signedAt = request.SignedAt ?? DateTimeOffset.UtcNow;
    var assetCount = await db.CustomerElevators.IgnoreQueryFilters().CountAsync();
    var createdAssets = new List<CustomerElevator>();
    foreach (var specification in sourceSpecs)
    {
        assetCount++;
        var technicalSpecJson = specification.ToJsonString();
        var asset = new CustomerElevator
        {
            Code = $"TM-{DateTimeOffset.UtcNow:yyyy}-{assetCount:000000}",
            CustomerId = quotation.CustomerId,
            ConsultationProfileId = quotation.ConsultationProfileId,
            SourceQuotationId = quotation.Id,
            ContractReference = request.ContractReference.Trim(),
            Name = TechnicalSpecDocument.ReadString(specification, "name") ?? $"Thang may {assetCount}",
            ElevatorType = TechnicalSpecDocument.ReadString(specification, "elevatorType") ?? string.Empty,
            TechnicalSpecsJson = technicalSpecJson,
            InstallationAddress = TechnicalSpecDocument.ReadString(specification, "installationAddress"),
            Area = TechnicalSpecDocument.BuildArea(specification),
            Latitude = TechnicalSpecDocument.ReadDouble(specification, "latitude"),
            Longitude = TechnicalSpecDocument.ReadDouble(specification, "longitude"),
            LocationLabel = TechnicalSpecDocument.ReadString(specification, "locationLabel"),
            Status = "PENDING_IMPLEMENTATION",
            SignedAt = signedAt,
            WarrantyExpiresAt = request.WarrantyExpiresAt
        };
        createdAssets.Add(asset);
        db.CustomerElevators.Add(asset);
    }

    quotation.Status = "SIGNED";
    quotation.ApprovedAt ??= signedAt;
    quotation.UpdatedAt = DateTimeOffset.UtcNow;
    if (quotation.ConsultationProfile is not null)
    {
        quotation.ConsultationProfile.Status = "SIGNED";
        quotation.ConsultationProfile.UpdatedAt = DateTimeOffset.UtcNow;
    }
    quotation.Customer.Status = "SIGNED";
    quotation.Customer.UpdatedAt = DateTimeOffset.UtcNow;

    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "CONFIRM_CONTRACT",
        Module = "Quotations",
        EntityType = nameof(Quotation),
        EntityId = quotation.Id.ToString(),
        Details = $"{quotation.Code} -> {request.ContractReference.Trim()} ({createdAssets.Count} elevator assets)",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    foreach (var asset in createdAssets)
    {
        db.AuditLogs.Add(new AuditLog
        {
            UserId = current.Id,
            Username = current.Username,
            Action = "CREATE_FROM_CONTRACT",
            Module = "CustomerElevators",
            EntityType = nameof(CustomerElevator),
            EntityId = asset.Id.ToString(),
            Details = $"{asset.Code} from {quotation.Code}",
            IpAddress = http.Connection.RemoteIpAddress?.ToString()
        });
    }
    await db.SaveChangesAsync();

    return Results.Created($"/api/customer-elevators/{createdAssets[0].Id}", new
    {
        quotationId = quotation.Id,
        quotationCode = quotation.Code,
        contractReference = request.ContractReference.Trim(),
        customerElevators = createdAssets.Select(x => new { x.Id, x.Code, x.Name, x.Status })
    });
}).RequirePermission("customer.update");

app.MapGet("/api/customer-elevators/{id:guid}", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();
    var elevator = await db.CustomerElevators
        .Include(x => x.Customer)
        .Include(x => x.ConsultationProfile)
        .Include(x => x.SourceQuotation)
        .FirstOrDefaultAsync(x => x.Id == id);
    if (elevator is null) return Results.NotFound(new { message = "Customer elevator was not found." });

    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && elevator.Customer.OwnerUserId != current.Id.Value) return Results.Forbid();

    return Results.Ok(new
    {
        elevator.Id,
        elevator.Code,
        elevator.Name,
        elevator.ElevatorType,
        elevator.TechnicalSpecsJson,
        elevator.InstallationAddress,
        elevator.Area,
        elevator.Latitude,
        elevator.Longitude,
        elevator.LocationLabel,
        elevator.Status,
        elevator.ContractReference,
        elevator.SignedAt,
        elevator.HandedOverAt,
        elevator.WarrantyExpiresAt,
        elevator.CreatedAt,
        elevator.UpdatedAt,
        customer = new { elevator.Customer.Id, elevator.Customer.Code, elevator.Customer.Name, elevator.Customer.Phone },
        consultationProfile = elevator.ConsultationProfile is null ? null : new { elevator.ConsultationProfile.Id, elevator.ConsultationProfile.Code },
        quotation = elevator.SourceQuotation is null ? null : new { elevator.SourceQuotation.Id, elevator.SourceQuotation.Code }
    });
}).RequirePermission("customer.view");

app.MapPut("/api/customer-elevators/{id:guid}/status", async (
    Guid id,
    CustomerElevatorStatusRequest request,
    AppDbContext db,
    CurrentUser current,
    HttpContext http) =>
{
    if (current.Id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Status)) return Results.BadRequest(new { message = "Status is required." });
    var elevator = await db.CustomerElevators.Include(x => x.Customer).FirstOrDefaultAsync(x => x.Id == id);
    if (elevator is null) return Results.NotFound(new { message = "Customer elevator was not found." });

    var canUpdateAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canUpdateAll && elevator.Customer.OwnerUserId != current.Id.Value) return Results.Forbid();

    var previousStatus = elevator.Status;
    elevator.Status = request.Status.Trim();
    elevator.HandedOverAt = request.HandedOverAt ?? elevator.HandedOverAt;
    elevator.WarrantyExpiresAt = request.WarrantyExpiresAt ?? elevator.WarrantyExpiresAt;
    elevator.UpdatedAt = DateTimeOffset.UtcNow;
    db.AuditLogs.Add(new AuditLog
    {
        UserId = current.Id,
        Username = current.Username,
        Action = "UPDATE_STATUS",
        Module = "CustomerElevators",
        EntityType = nameof(CustomerElevator),
        EntityId = elevator.Id.ToString(),
        Details = $"{elevator.Code}: {previousStatus} -> {elevator.Status}",
        IpAddress = http.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequirePermission("customer.update");

app.MapGet("/api/customer-elevators/{id:guid}/history", async (
    Guid id,
    AppDbContext db,
    CurrentUser current) =>
{
    if (current.Id is null) return Results.Unauthorized();
    var elevator = await db.CustomerElevators.Include(x => x.Customer).FirstOrDefaultAsync(x => x.Id == id);
    if (elevator is null) return Results.NotFound(new { message = "Customer elevator was not found." });
    var canViewAll = await db.UserRoles.AnyAsync(x =>
        x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
    if (!canViewAll && elevator.Customer.OwnerUserId != current.Id.Value) return Results.Forbid();

    return Results.Ok(await db.AuditLogs
        .Where(x => x.EntityType == nameof(CustomerElevator) && x.EntityId == id.ToString())
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new { x.Id, x.CreatedAt, x.Username, x.Action, x.Module, x.Details })
        .ToListAsync());
}).RequirePermission("customer.view");

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
        ["application/msword"] = ".doc",
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = ".xlsx",
        ["application/vnd.ms-excel"] = ".xls"
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

app.MapGet("/api/files/{id:guid}", async (
    Guid id,
    IConfiguration configuration,
    CurrentUser current,
    AppDbContext db) =>
{
    if (current.Id is null) return Results.Unauthorized();

    var storedFile = await db.StoredFiles.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (storedFile is null) return Results.NotFound(new { message = "Không tìm thấy file." });

    if (storedFile.Module.Equals("customers", StringComparison.OrdinalIgnoreCase)
        && Guid.TryParse(storedFile.RecordId, out var customerId))
    {
        var customer = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == customerId && !x.IsDeleted);
        if (customer is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng." });

        var canViewAll = await db.UserRoles.AnyAsync(x =>
            x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
        if (!canViewAll && customer.OwnerUserId != current.Id.Value)
            return Results.Forbid();
    }
    else if (storedFile.Module.Equals("consultation-profiles", StringComparison.OrdinalIgnoreCase)
        && Guid.TryParse(storedFile.RecordId, out var consultationProfileId))
    {
        var profile = await db.ConsultationProfiles.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == consultationProfileId && !x.IsDeleted);
        if (profile is null) return Results.NotFound(new { message = "Không tìm thấy hồ sơ tư vấn." });

        var canViewAll = await db.UserRoles.AnyAsync(x =>
            x.UserId == current.Id && (x.Role.DataScope == "ALL" || x.Role.DataScope == "DEPARTMENT"));
        if (!canViewAll && profile.OwnerUserId != current.Id.Value)
            return Results.Forbid();
    }

    var root = Path.GetFullPath(configuration["UploadRoot"] ?? "uploads");
    var fullPath = Path.GetFullPath(Path.Combine(root, storedFile.RelativePath));
    if (!fullPath.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !File.Exists(fullPath))
        return Results.NotFound(new { message = "File không còn tồn tại trên máy chủ." });

    return Results.File(fullPath, storedFile.ContentType, storedFile.OriginalName);
}).RequireAuthorization();

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
    string? ElevatorType,
    double? Latitude,
    double? Longitude,
    double? LocationAccuracyMeters,
    string? LocationLabel,
    string Source,
    string Status,
    string? Notes,
    string? TechnicalSpecsJson,
    string? AttachmentLinksJson);
record CustomerStatusRequest(string Status);
record ConsultationProfileRequest(
    Guid? CustomerId,
    string CustomerType,
    string Name,
    string Phone,
    string? Email,
    string? Address,
    string? ElevatorType,
    double? Latitude,
    double? Longitude,
    double? LocationAccuracyMeters,
    string? LocationLabel,
    string Source,
    string Status,
    string? Notes,
    string? TechnicalSpecsJson,
    string? AttachmentLinksJson,
    bool? IsKpiEligible);
record QuotationRequest(
    Guid CustomerId,
    Guid? ConsultationProfileId,
    string Title,
    DateTimeOffset? ValidUntil,
    string Status,
    string? ElevatorSpecsJson,
    string? CostLinesJson,
    decimal SubtotalAmount,
    decimal DiscountAmount,
    decimal VatRate,
    decimal? VatAmount,
    decimal? TotalAmount,
    string? Notes);
record CopyTechnicalConfigurationRequest(Guid SourceProfileId, string? ConfigurationId);
record TechnicalConfigurationUpdateRequest(JsonElement Configuration);
record ConfirmQuotationContractRequest(string ContractReference, DateTimeOffset? SignedAt, DateTimeOffset? WarrantyExpiresAt);
record CustomerElevatorStatusRequest(string Status, DateTimeOffset? HandedOverAt, DateTimeOffset? WarrantyExpiresAt);

static class TechnicalSpecFilter
{
    public static HashSet<string> ReadElevatorTypes(string? technicalSpecsJson)
    {
        var elevatorTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(technicalSpecsJson)) return elevatorTypes;

        try
        {
            using var document = JsonDocument.Parse(technicalSpecsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Array) return elevatorTypes;

            foreach (var specification in document.RootElement.EnumerateArray())
            {
                if (specification.ValueKind != JsonValueKind.Object
                    || !specification.TryGetProperty("elevatorType", out var elevatorType)
                    || elevatorType.ValueKind != JsonValueKind.String)
                    continue;

                var value = elevatorType.GetString();
                if (!string.IsNullOrWhiteSpace(value)) elevatorTypes.Add(value);
            }
        }
        catch (JsonException)
        {
            // Existing legacy data can contain an invalid or non-array JSON value.
        }

        return elevatorTypes;
    }

    public static bool HasAnySpecification(string? technicalSpecsJson)
    {
        if (string.IsNullOrWhiteSpace(technicalSpecsJson)) return false;

        try
        {
            using var document = JsonDocument.Parse(technicalSpecsJson);
            return document.RootElement.ValueKind == JsonValueKind.Array
                && document.RootElement.GetArrayLength() > 0;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static int CountSpecifications(string? technicalSpecsJson)
    {
        if (string.IsNullOrWhiteSpace(technicalSpecsJson)) return 0;

        try
        {
            using var document = JsonDocument.Parse(technicalSpecsJson);
            return document.RootElement.ValueKind == JsonValueKind.Array
                ? document.RootElement.GetArrayLength()
                : 0;
        }
        catch (JsonException)
        {
            return 0;
        }
    }
}

static class TechnicalSpecDocument
{
    public static List<JsonObject> ReadArray(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return [];
        try
        {
            if (JsonNode.Parse(value) is not JsonArray array) return [];
            return array.OfType<JsonObject>().ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static JsonObject CloneForCopy(JsonObject source)
    {
        var copy = source.DeepClone().AsObject();
        copy["id"] = Guid.NewGuid().ToString("N");
        var name = ReadString(copy, "name");
        if (!string.IsNullOrWhiteSpace(name)) copy["name"] = $"{name} - Ban sao";
        return copy;
    }

    public static string Serialize(IEnumerable<JsonObject> configurations)
    {
        var array = new JsonArray();
        foreach (var configuration in configurations) array.Add(configuration);
        return array.ToJsonString();
    }

    public static string? ReadString(JsonObject source, string propertyName)
    {
        if (source[propertyName] is not JsonValue value) return null;
        return value.TryGetValue<string>(out var result) ? result?.Trim() : null;
    }

    public static double? ReadDouble(JsonObject source, string propertyName)
    {
        if (source[propertyName] is not JsonValue value) return null;
        if (value.TryGetValue<double>(out var number)) return number;
        if (value.TryGetValue<string>(out var text)
            && double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out number)) return number;
        return null;
    }

    public static string? BuildArea(JsonObject source)
    {
        var ward = ReadString(source, "installationWard");
        var province = ReadString(source, "installationProvince");
        return string.Join(", ", new[] { ward, province }.Where(x => !string.IsNullOrWhiteSpace(x)));
    }
}
record QuotationStatusRequest(string Status);
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
