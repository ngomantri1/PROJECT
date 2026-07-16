using System.IO;

namespace CryptoScanner.Desktop.Services;

public static class AppPaths
{
 public static string RootDirectory { get; } = Path.Combine(
  Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
  "CryptoScanner.Desktop");

 public static string DataDirectory { get; } = Path.Combine(RootDirectory, "data");

 public static string UnlockCachePath { get; } = Path.Combine(DataDirectory, "unlock-cache.json");

 public static string UnlockCacheReadmePath { get; } = Path.Combine(DataDirectory, "README_unlock_cache.txt");
}
