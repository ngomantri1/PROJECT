using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;

namespace ABX.Hub
{
    internal static class Wv2Bootstrapper
    {
        // Trùng với LogicalName nếu bạn NHÚNG ZIP vào exe (có thể bỏ qua nếu chỉ dùng ZIP ngoài)
        private const string ZipLogicalName = "ThirdParty.WebView2Fixed_win-x64.zip";

        public static void EnsureFixedEnv(string baseDir)
        {
            var thirdPartyDir = Path.Combine(baseDir, "ThirdParty");
            var fixedDir = Path.Combine(thirdPartyDir, "WebView2Fixed_win-x64");
            var exePath = Path.Combine(fixedDir, "msedgewebview2.exe");

            Directory.CreateDirectory(thirdPartyDir);

            // 1) Ưu tiên ZIP đặt sẵn trong bin (Debug)
            var outZip = Path.Combine(thirdPartyDir, "WebView2Fixed_win-x64.zip");
            if (!File.Exists(exePath) && File.Exists(outZip))
            {
                Console.WriteLine($"[WV2] Extract from: {outZip}");
                SafeExtract(outZip, fixedDir);
            }

            // 2) Nếu vẫn chưa có → thử lấy từ Embedded Resource (Release)
            if (!File.Exists(exePath))
            {
                var asm = Assembly.GetExecutingAssembly(); // KHÔNG dùng 'using' vì Assembly không IDisposable
                using var resStream = asm.GetManifestResourceStream(ZipLogicalName);
                if (resStream != null)
                {
                    Console.WriteLine($"[WV2] Extract from embedded: {ZipLogicalName}");
                    SafeExtract(resStream, fixedDir);
                }
            }

            // 3) Đặt ENV cho process
            if (File.Exists(exePath))
            {
                var userData = Path.Combine(thirdPartyDir, "wv2_userdata");
                Directory.CreateDirectory(userData);

                Environment.SetEnvironmentVariable(
                    "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER",
                    fixedDir,
                    EnvironmentVariableTarget.Process);

                Environment.SetEnvironmentVariable(
                    "WEBVIEW2_USER_DATA_FOLDER",
                    userData,
                    EnvironmentVariableTarget.Process);

                Console.WriteLine($"[WV2] READY → {exePath}");
            }
            else
            {
                Console.WriteLine("[WV2] WebView2 runtime MISSING. Screen may be black.");
            }
        }

        private static void SafeExtract(string zipFile, string destDir)
        {
            try
            {
                if (Directory.Exists(destDir)) Directory.Delete(destDir, true);
                ZipFile.ExtractToDirectory(zipFile, destDir);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WV2] Extract error (file): {ex.Message}");
            }
        }

        private static void SafeExtract(Stream zipStream, string destDir)
        {
            try
            {
                if (Directory.Exists(destDir)) Directory.Delete(destDir, true);
                using var ms = new MemoryStream();
                zipStream.CopyTo(ms);
                ms.Position = 0;
                using var za = new ZipArchive(ms, ZipArchiveMode.Read, leaveOpen: false);
                Directory.CreateDirectory(destDir);
                za.ExtractToDirectory(destDir);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WV2] Extract error (embedded): {ex.Message}");
            }
        }
    }
}
