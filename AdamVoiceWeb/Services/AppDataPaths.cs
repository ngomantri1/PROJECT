namespace AdamVoiceWeb.Services;

public sealed class AppDataPaths
{
    public AppDataPaths(IWebHostEnvironment env, IConfiguration config)
    {
        var configuredRoot = config["Storage:DataRootPath"];
        var baseRoot = string.IsNullOrWhiteSpace(configuredRoot)
            ? Path.Combine(env.ContentRootPath, "App_RuntimeData")
            : ResolvePath(env.ContentRootPath, configuredRoot);

        DataRootPath = baseRoot;
        DbPath = Path.Combine(DataRootPath, "app.db");
        AudioRootPath = Path.Combine(DataRootPath, "audio");
        LegacyDbJsonPath = Path.Combine(env.ContentRootPath, "App_Data", "db.json");

        Directory.CreateDirectory(DataRootPath);
        Directory.CreateDirectory(AudioRootPath);
    }

    public string DataRootPath { get; }
    public string DbPath { get; }
    public string AudioRootPath { get; }
    public string LegacyDbJsonPath { get; }

    private static string ResolvePath(string contentRootPath, string configuredPath)
    {
        var resolvedPath = Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(contentRootPath, configuredPath);

        return Path.GetFullPath(resolvedPath);
    }
}
