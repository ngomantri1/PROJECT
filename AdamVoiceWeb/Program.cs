using System.Security.Claims;
using AdamVoiceWeb.Data;
using AdamVoiceWeb.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages(options =>
{
    options.Conventions.AuthorizeFolder("/");
    options.Conventions.AllowAnonymousToPage("/Login");
    options.Conventions.AllowAnonymousToPage("/Register");
});

var authBuilder = builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Login";
        options.LogoutPath = "/Logout";
        options.AccessDeniedPath = "/";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
    });

var googleClientId = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];
if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
{
    authBuilder.AddGoogle(options =>
    {
        options.ClientId = googleClientId;
        options.ClientSecret = googleClientSecret;
        options.Scope.Add("email");
        options.Scope.Add("profile");
    });
}

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireClaim(ClaimTypes.Role, "Admin"));
});

builder.Services.AddSingleton<AppDataPaths>();
builder.Services.AddDbContext<AppDbContext>((serviceProvider, options) =>
{
    var paths = serviceProvider.GetRequiredService<AppDataPaths>();
    options.UseSqlite($"Data Source={paths.DbPath}");
});
builder.Services.AddSingleton<TextPreprocessService>();
builder.Services.AddHttpClient<ElevenLabsService>();
builder.Services.AddHttpClient<AiEnhanceService>();
builder.Services.AddHostedService<SqliteBootstrapService>();

var app = builder.Build();
var appDataPaths = app.Services.GetRequiredService<AppDataPaths>();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}

app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(appDataPaths.AudioRootPath),
    RequestPath = "/audio"
});
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapRazorPages();
app.Run();
