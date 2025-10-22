using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using ABX.Core;

namespace ABX.Hub
{
    public static class ZipUtil
    {
        /// <summary>
        /// Tìm/bung WebView2 Fixed Runtime.
        /// Trả về:
        ///   - browserExeDir: thư mục chứa msedgewebview2.exe (chuỗi rỗng nếu không có fixed)
        ///   - userDataDir  : thư mục dữ liệu người dùng (luôn tồn tại)
        /// </summary>
        public static (string browserExeDir, string userDataDir) EnsureFixedWebView2Extracted(ILogService log)
        {
            var exeDir = AppContext.BaseDirectory;
            var out3p = Path.Combine(exeDir, "ThirdParty");
            var fixedOutDir = Path.Combine(out3p, "WebView2Fixed_win-x64");        // Debug sẽ bung vào đây
            var fixedZipOut = Path.Combine(out3p, "WebView2Fixed_win-x64.zip");    // Debug copy sẵn ra output

            var localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var cacheRoot = Path.Combine(localApp, "ABX.WebView2");
            var userDataDir = Path.Combine(cacheRoot, "userdata");
            Directory.CreateDirectory(out3p);
            Directory.CreateDirectory(cacheRoot);
            Directory.CreateDirectory(userDataDir);

            log.Info($"[ZipUtil] exeDir={exeDir}");
            log.Info($"[ZipUtil] out3p={out3p}");
            log.Info($"[ZipUtil] fixedOutDir={fixedOutDir}");
            log.Info($"[ZipUtil] fixedZipOut exists={File.Exists(fixedZipOut)}");

            // 1) ĐÃ CÓ fixed runtime ở bin\ThirdParty\WebView2Fixed_win-x64 ? (Debug)
            var found = FindFixedRuntime(fixedOutDir);
            if (!string.IsNullOrEmpty(found))
            {
                log.Info("[WebView2] Using fixed runtime from bin/ThirdParty (Debug).");
                return (found, userDataDir);
            }

            // 2) Có ZIP ở bin/ThirdParty → bung ra fixedOutDir
            if (File.Exists(fixedZipOut))
            {
                try
                {
                    if (Directory.Exists(fixedOutDir))
                    {
                        log.Info("[ZipUtil] Clear old fixedOutDir before extract.");
                        Directory.Delete(fixedOutDir, true);
                    }
                }
                catch (Exception ex) { log.Warn("[ZipUtil] Clear old dir failed: " + ex.Message); }

                Directory.CreateDirectory(fixedOutDir);
                try
                {
                    log.Info("[ZipUtil] Extracting output ZIP -> fixedOutDir...");
                    ZipFile.ExtractToDirectory(fixedZipOut, fixedOutDir);
                    found = FindFixedRuntime(fixedOutDir);
                    log.Info($"[ZipUtil] After extract, found={(!string.IsNullOrEmpty(found)).ToString().ToLower()}");
                    if (!string.IsNullOrEmpty(found))
                    {
                        log.Info("[WebView2] Extracted fixed runtime from output ZIP.");
                        return (found, userDataDir);
                    }
                }
                catch (Exception ex)
                {
                    log.Warn("[WebView2] Extract output ZIP failed: " + ex.Message);
                }
            }

            // 3) Release: cố gắng lấy ZIP nhúng trong exe (EmbeddedResource)
            var embeddedResName = "ThirdParty.WebView2Fixed_win-x64.zip"; // trùng với LogicalName trong .csproj
            var embedRoot = Path.Combine(cacheRoot, "fixed", "v1");
            var embedZipPath = Path.Combine(embedRoot, "fixed.zip");
            var embedExtractDir = Path.Combine(embedRoot, "rt");
            Directory.CreateDirectory(embedRoot);

            try
            {
                var asm = Assembly.GetExecutingAssembly();
                using var stream = asm.GetManifestResourceStream(embeddedResName);
                log.Info($"[ZipUtil] Embedded resource present={(stream != null)} name={embeddedResName}");
                if (stream != null)
                {
                    // Ghi ra file rồi bung
                    Directory.CreateDirectory(embedExtractDir);
                    if (File.Exists(embedZipPath)) File.Delete(embedZipPath);
                    using (var fs = File.Create(embedZipPath)) stream.CopyTo(fs);

                    if (Directory.Exists(embedExtractDir)) Directory.Delete(embedExtractDir, true);
                    Directory.CreateDirectory(embedExtractDir);
                    ZipFile.ExtractToDirectory(embedZipPath, embedExtractDir);

                    found = FindFixedRuntime(embedExtractDir);
                    if (!string.IsNullOrEmpty(found))
                    {
                        log.Info("[WebView2] Extracted fixed runtime from embedded resource.");
                        return (found, userDataDir);
                    }
                }
            }
            catch (Exception ex)
            {
                log.Warn("[WebView2] Extract embedded ZIP failed: " + ex.Message);
            }

            // 4) Không có fixed → rơi về Evergreen (browserExeDir = "")
            log.Warn("[WebView2] Fixed runtime not found. Falling back to Evergreen (system runtime).");
            return ("", userDataDir);
        }

        /// <summary>
        /// Tìm msedgewebview2.exe trong thư mục root (có thể nằm trực tiếp hoặc trong thư mục con theo version).
        /// Trả về thư mục chứa exe nếu thấy; null nếu không.
        /// </summary>
        private static string? FindFixedRuntime(string root)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root)) return null;
                var exe = Directory.EnumerateFiles(root, "msedgewebview2.exe", SearchOption.AllDirectories)
                                   .FirstOrDefault();
                if (!string.IsNullOrEmpty(exe))
                    return Path.GetDirectoryName(exe)!;
            }
            catch { }
            return null;
        }

        /// <summary>Reset sạch thư mục userDataDir để tránh profile hỏng.</summary>
        public static void ResetUserDataDir(string userDataDir, ILogService log)
        {
            try
            {
                if (Directory.Exists(userDataDir))
                {
                    log.Info("[ZipUtil] Reset userDataDir...");
                    Directory.Delete(userDataDir, true);
                }
            }
            catch (Exception ex) { log.Warn("[ZipUtil] Reset userDataDir failed: " + ex.Message); }
            Directory.CreateDirectory(userDataDir);
        }

        /// <summary>
        /// (Tuỳ chọn) Thử chạy installer Evergreen nếu bạn để sẵn file trong ThirdParty.
        /// </summary>
        public static void TryRunEvergreenInstallerIfPresent(ILogService log)
        {
            try
            {
                var setup = Path.Combine(AppContext.BaseDirectory, "ThirdParty", "MicrosoftEdgeWebView2Setup.exe");
                if (File.Exists(setup))
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = setup,
                        UseShellExecute = true
                    });
                    log.Info("[WebView2] Launch Evergreen installer.");
                }
            }
            catch (Exception ex)
            {
                log.Warn("[WebView2] Launch installer failed: " + ex.Message);
            }
        }
    }
}
