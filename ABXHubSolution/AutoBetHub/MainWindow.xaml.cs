using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf; // cần để dùng WebView2
using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Headers;
using ABX.Core;
using AutoBetHub.Hosting;
using AutoBetHub.Services;
using System.IO.Compression;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.IO.Pipes;
using System.Threading;


namespace AutoBetHub
{
    public partial class MainWindow : Window
    {
        private string _baseDir = "";
        private string _webDir = "";
        private string _pluginsDir = "";

        private readonly ConfigService _cfg;
        private readonly LogService _log;

        // runtime unified: mọi thứ dồn về đây
        private readonly string _localRoot;
        private readonly string _thirdPartyDir;
        private readonly string _localPluginsDir;
        // HttpClient dùng chung cho việc check update
        private static readonly HttpClient _httpClient = new();

        private HostContext _hostcx = default!;

        private List<IGamePlugin> _plugins = new();
        private IGamePlugin? _active;

        private bool _navEventsHooked;
        private bool _homeDiagnosticsHooked;
        private bool _activating;
        private string? _activatingSlug;
        private readonly string? _startupSlug;
        private readonly bool _shortcutMode;
        private bool _suppressAttachForNextPlugin;
        private CancellationTokenSource? _slugPipeCts;

        // cờ mới: user đã bấm đóng trong khi vẫn còn plugin
        private bool _pendingClose;
        const string LicenseOwner = "ngomantri1";    // <- đổi theo repo của bạn
        const string LicenseRepo = "version";  // <- đổi theo repo của bạn
        const string LicenseBranch = "main";          // <- nhánh
        public MainWindow() : this(null) { }

        public MainWindow(string? startupSlug)
        {
            _startupSlug = string.IsNullOrWhiteSpace(startupSlug) ? null : startupSlug;
            _shortcutMode = !string.IsNullOrWhiteSpace(_startupSlug);
            InitializeComponent();
            if (_shortcutMode)
            {
                ShowInTaskbar = false;
                ShowActivated = false;
                WindowStyle = WindowStyle.None;
                WindowState = WindowState.Minimized;
                Opacity = 0;
            }

            // =========================
            // 1) luôn có thư mục runtime local
            //    %LocalAppData%\AutoBetHub
            // =========================
            _localRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AutoBetHub");
            Directory.CreateDirectory(_localRoot);

            // Thư mục môi trường tách riêng: %LocalAppData%\AutoBetHub\ThirdParty
            _thirdPartyDir = Path.Combine(_localRoot, "ThirdParty");
            Directory.CreateDirectory(_thirdPartyDir);

            var localLogs = Path.Combine(_localRoot, "logs");
            Directory.CreateDirectory(localLogs);

            _localPluginsDir = Path.Combine(_localRoot, "Plugins");
            Directory.CreateDirectory(_localPluginsDir);

            // =========================
            // 2) config + log đều để dưới local
            // =========================
            _cfg = new ConfigService(Path.Combine(_localRoot, "AppConfig.json"));
            _log = new LogService(localLogs);
            StartSlugPipeServer();

            Loaded += async (_, __) =>
            {
                try
                {
                    _baseDir = AppContext.BaseDirectory;
                    _webDir = ResolveWebRoot();

                    // ==== So sánh version exe / version đã cài (AppVersion.txt) ====
                    Version exeVersion = GetCurrentVersion();
                    Version? installedVersion = null;
                    try
                    {
                        var verPath = Path.Combine(_localRoot, "AppVersion.txt");
                        if (File.Exists(verPath))
                        {
                            var raw = File.ReadAllText(verPath).Trim();
                            if (!string.IsNullOrEmpty(raw) && Version.TryParse(raw, out var v))
                                installedVersion = v;
                        }
                    }
                    catch (Exception exVer)
                    {
                        _log.Warn("[Update] Read AppVersion.txt failed: " + exVer.Message);
                    }

                    if (installedVersion != null && exeVersion > installedVersion)
                    {
                        SaveInstalledVersion(exeVersion);
                    }

                    // Không có AppVersion.txt => luôn cho phép copy từ exe
                    // Có AppVersion.txt => chỉ cho copy khi exeVersion > installedVersion
                    bool allowCopyFromExe = installedVersion == null || exeVersion > installedVersion;
                    if (!allowCopyFromExe)
                    {
                        _log.Info($"[Hub] Skip copying plugins/web from exe because installed version {installedVersion} >= exe {exeVersion}.");
                    }

                    if (allowCopyFromExe)
                    {
                        // 0) nếu exe có nhúng plugin thì bung hết ra local
                        ExtractEmbeddedPluginsToLocal();

                        // 1) nếu cạnh exe (debug/publish folder) có thư mục Plugins
                        //    VÀ trong đó thực sự có .dll thì copy sang local để chạy
                        var basePlugins = Path.Combine(_baseDir, "Plugins");
                        var baseHasDll =
                            Directory.Exists(basePlugins) &&
                            Directory.EnumerateFiles(basePlugins, "*.dll", SearchOption.AllDirectories).Any();

                        if (baseHasDll)
                        {
                            CopyPluginsToLocal(basePlugins, _localPluginsDir);
                        }
                        else
                        {
                            // 1b) Fallback: nếu chạy từ bin\Debug\net8.0-windows mà chưa có Plugins ở đó
                            var devPlugins = Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "Plugins"));
                            if (Directory.Exists(devPlugins))
                            {
                                _log.Info("[Hub] Runtime Plugins empty/missing, fallback to source Plugins: " + devPlugins);
                                CopyPluginsToLocal(devPlugins, _localPluginsDir);
                            }
                            else
                            {
                                _log.Warn("[Hub] No Plugins folder found (neither runtime nor dev).");
                            }
                        }

                        // 2) web: copy hub.html + assets từ runtime hoặc source về LocalAppData\web
                        var baseWeb = Path.Combine(_baseDir, "web");
                        var devWeb = Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "web"));
                        string? srcWeb = null;

                        if (File.Exists(Path.Combine(baseWeb, "hub.html")))
                            srcWeb = baseWeb;
                        else if (!string.IsNullOrWhiteSpace(_webDir) && File.Exists(Path.Combine(_webDir, "hub.html")))
                            srcWeb = _webDir;
                        else if (File.Exists(Path.Combine(devWeb, "hub.html")))
                            srcWeb = devWeb;

                        if (!string.IsNullOrWhiteSpace(srcWeb))
                        {
                            var dstWeb = Path.Combine(_localRoot, "web");
                            Directory.CreateDirectory(dstWeb);
                            CopyDirectoryOverwrite(srcWeb, dstWeb);
                            _log.Info("[Hub] Copied web to LocalAppData: " + dstWeb);
                        }
                        else
                        {
                            _log.Warn("[Hub] No web folder found (hub.html missing).");
                        }
                    }

                    // 2) từ đây trở đi: hub luôn load plugin tại local
                    _pluginsDir = _localPluginsDir;

                    // 2b) Áp dụng gói update đã tải (nếu có) từ các thư mục AutoBetHub.<ver>
                    ApplyPendingUpdatesFromVersionFolders();

                    // Ưu tiên web ở LocalAppData nếu đã được update, nếu không dùng web cạnh exe
                    try
                    {
                        var localWeb = Path.Combine(_localRoot, "web");
                        var hubFile = Path.Combine(localWeb, "hub.html");
                        if (File.Exists(hubFile))
                        {
                            _webDir = localWeb;
                            _log.Info("[Hub] Override WebDir from LocalAppData: " + _webDir);
                        }
                    }
                    catch (Exception ex)
                    {
                        _log.Warn("[Hub] Probe local web dir failed: " + ex.Message);
                    }

                    _log.Info($"[Hub] BaseDir: {_baseDir}");
                    _log.Info($"[Hub] WebDir: {_webDir}");
                    _log.Info($"[Hub] LocalPluginsDir: {_pluginsDir}");


                    // đảm bảo runtime fixed được bung ra local (nếu có nhúng trong exe)
                    var shortcutMode = _shortcutMode;

                    if (!shortcutMode)
                    {
                        EnsureFixedWebView2Runtime();

                        var webview2Data = Path.Combine(_localRoot, "WebView2");
                        Directory.CreateDirectory(webview2Data);

                        string? browserFolder = null;

                        var fixedRuntimeLocal = Path.Combine(_thirdPartyDir, "WebView2Fixed_win-x64");
                        var fixedRuntimeBase = Path.Combine(_baseDir, "ThirdParty", "WebView2Fixed_win-x64");

                        if (Directory.Exists(fixedRuntimeLocal))
                        {
                            browserFolder = fixedRuntimeLocal;
                            _log.Info("[Home] Using fixed WebView2 runtime at (localRoot) " + fixedRuntimeLocal);
                        }
                        else if (Directory.Exists(fixedRuntimeBase))
                        {
                            browserFolder = fixedRuntimeBase;
                            _log.Info("[Home] Using fixed WebView2 runtime at (BaseDir) " + fixedRuntimeBase);
                        }
                        else
                        {
                            _log.Info("[Home] Using Evergreen WebView2 runtime (no fixed runtime folder found).");
                        }

                        var env = await CoreWebView2Environment.CreateAsync(
                            browserExecutableFolder: browserFolder,
                            userDataFolder: webview2Data,
                            options: null);

                        await web.EnsureCoreWebView2Async(env);
                        await HookHomeDiagnosticsAsync();

                        try
                        {
                            var ver = CoreWebView2Environment.GetAvailableBrowserVersionString(browserFolder);
                            _log.Info($"[Home] WebView2 ready. Version={ver ?? "-"}");
                        }
                        catch (Exception ex)
                        {
                            _log.Warn("[Home] Probe WebView2 version failed: " + ex.Message);
                        }

                        HookWebMessages();
                        HookHomeNavEvents();

                        var webAdapter = new WebViewAdapter(web, _log);
                        _hostcx = new HostContext(_cfg, _log, webAdapter, OnPluginWindowClosed);
                    }
                    else
                    {
                        _hostcx = new HostContext(_cfg, _log, new NullWebViewService(), OnPluginWindowClosed);
                    }

                    if (Directory.Exists(_pluginsDir))
                        _plugins = PluginLoader.LoadAll(_pluginsDir, _log);
                    else
                        _log.Warn("[Hub] Plugins folder (local) not found!");

                    if (_plugins.Count == 0)
                        _log.Warn("[Hub] No plugins registered.");
                    else
                        foreach (var p in _plugins)
                            _log.Info($"[Hub] Plugin registered: {p.Name} / {p.Slug}");

                    if (shortcutMode)
                    {
                        _log.Info($"[Hub] Startup slug detected: '{_startupSlug}'");
                        await ActivatePluginAsync(_startupSlug);
                        if (_active != null)
                            PrepareForShortcutLaunch();
                        return;
                    }

                    ShowHub();
                    NavigateFile("hub.html");
                    _ = CheckForUpdateAsync(true);
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, ex.ToString(), "Init error");
                }
            };
        }

        public void OnPluginWindowClosed(string slug)
        {
            // plugin gọi ngược về đây từ _window.Closed trong XocDiaLiveHitPlugin.cs
            if (_active != null &&
                string.Equals(_active.Slug, slug, StringComparison.OrdinalIgnoreCase))
            {
                DeactivatePlugin();
            }

            // nếu trước đó user đã bấm đóng hub mà mình phải ẩn đi
            // thì ngay khi plugin đóng xong, tắt hẳn app
            if (_pendingClose)
            {
                _log.Info("[Hub] Plugin closed after pending close -> shutdown.");
                Application.Current.Shutdown();
            }
        }

        // ========== WebView2 <-> hub.html ==========

        // message gửi từ hub.html: { cmd, slug?, file?, title? }
        private sealed record WebMsg(string cmd, string? slug, string? file, string? title, string? level, string? text);

        private sealed record UpdateManifest(string appVersion, string? downloadUrl, string? notes);

        private void SendUpdateStatusToWeb(
    string phase,
    int progress,
    string message,
    Version? current = null,
    Version? remote = null)
        {
            try
            {
                if (web?.CoreWebView2 == null) return;

                var payload = new
                {
                    type = "updateStatus",
                    phase,
                    progress,
                    message,
                    currentVersion = current?.ToString(),
                    remoteVersion = remote?.ToString()
                };

                var json = JsonSerializer.Serialize(payload);
                web.CoreWebView2.PostWebMessageAsJson(json);
            }
            catch (Exception ex)
            {
                _log.Warn("[Update] SendUpdateStatusToWeb failed: " + ex.Message);
            }
        }


        private void HookWebMessages()
        {
            web.CoreWebView2.WebMessageReceived += async (_, e) =>
            {
                _log.Info("[Hub] WebMessageReceived: " + e.WebMessageAsJson);
                try
                {
                    var msg = JsonSerializer.Deserialize<WebMsg>(e.WebMessageAsJson);
                    if (msg == null) return;

                    switch (msg.cmd)
                    {
                        case "enterGame":
                            if (_activating) { _log.Info("[Hub] enterGame ignored (activating)"); return; }
                            _log.Info($"[Hub] enterGame slug={msg.slug}");
                            await ActivatePluginAsync(msg.slug);
                            break;

                        case "goHome":
                            _log.Info("[Hub] goHome received.");
                            GoHome();
                            NavigateFile("hub.html");
                            break;

                        case "checkUpdate":
                            _log.Info("[Hub] checkUpdate from web UI.");
                            // fire-and-forget, không chờ trong handler
                            _ = CheckForUpdateAsync(false);
                            break;

                        case "navigateLocal":
                            if (!string.IsNullOrWhiteSpace(msg.file))
                                NavigateFile(msg.file!);
                            break;

                        case "createShortcut":
                            _log.Info($"[Hub] createShortcut slug={msg.slug} title={msg.title}");
                            CreateDesktopShortcut(msg.slug, msg.title);
                            break;

                        case "homeDiagnostics":
                            var level = (msg.level ?? "info").Trim().ToLowerInvariant();
                            var text = string.IsNullOrWhiteSpace(msg.text) ? "(empty)" : msg.text.Trim();
                            if (level == "error")
                                _log.Error("[HomeDiag] " + text);
                            else if (level == "warn")
                                _log.Warn("[HomeDiag] " + text);
                            else
                                _log.Info("[HomeDiag] " + text);
                            break;
                    }

                }
                catch (Exception ex)
                {
                    _log.Error("WebMessageReceived error", ex);
                }
            };
        }

        private void StartSlugPipeServer()
        {
            if (_slugPipeCts != null) return;
            _slugPipeCts = new CancellationTokenSource();
            _ = Task.Run(() => SlugPipeLoopAsync(_slugPipeCts.Token));
        }

        private void StopSlugPipeServer()
        {
            if (_slugPipeCts == null) return;
            try { _slugPipeCts.Cancel(); } catch { }
            _slugPipeCts = null;
        }

        private async Task SlugPipeLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    using var server = new NamedPipeServerStream(
                        App.SlugPipeName,
                        PipeDirection.In,
                        1,
                        PipeTransmissionMode.Message,
                        PipeOptions.Asynchronous);

                    await server.WaitForConnectionAsync(token);

                    using var reader = new StreamReader(server, Encoding.UTF8);
                    var line = await reader.ReadLineAsync();
                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        var slug = line.Trim();
                        await Dispatcher.InvokeAsync(async () =>
                        {
                            _log.Info($"[Hub] External slug received: '{slug}'");
                            _suppressAttachForNextPlugin = true;
                            await ActivatePluginAsync(slug);
                            if (_active != null)
                                PrepareForShortcutLaunch();
                        });
                    }
                }
                catch (OperationCanceledException)
                {
                    // ignore on shutdown
                }
                catch (Exception ex)
                {
                    _log.Warn("[Hub] Slug pipe error: " + ex.Message);
                    try { await Task.Delay(200, token); } catch (OperationCanceledException) { }
                }
            }
        }

        private void PrepareForShortcutLaunch()
        {
            _pendingClose = true;
            try
            {
                ShowInTaskbar = false;
                Hide();
            }
            catch { }
        }

        private void CreateDesktopShortcut(string? slug, string? title)
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                MessageBox.Show(this, "Thieu slug de tao shortcut.", "Shortcut");
                return;
            }

            var exists = _plugins.Any(p => string.Equals(p.Slug, slug, System.StringComparison.OrdinalIgnoreCase));
            if (!exists)
            {
                MessageBox.Show(this, $"Khong tim thay plugin cho '{slug}'.", "Shortcut");
                return;
            }

            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            if (string.IsNullOrWhiteSpace(desktop) || !Directory.Exists(desktop))
            {
                MessageBox.Show(this, "Khong tim thay Desktop de tao shortcut.", "Shortcut");
                return;
            }

            var primaryName = SanitizeFileName(string.IsNullOrWhiteSpace(title) ? slug : title);
            if (string.IsNullOrWhiteSpace(primaryName))
                primaryName = SanitizeFileName(slug);

            var exePath = ResolveExePath();
            var workDir = Path.GetDirectoryName(exePath);
            var args = $"--slug \"{slug}\"";

            if (TryCreateShortcutWithName(desktop, primaryName, exePath, args, workDir, title, out var err))
                return;

            var asciiName = SanitizeFileName(RemoveDiacritics(primaryName));
            if (!string.IsNullOrWhiteSpace(asciiName) &&
                !string.Equals(asciiName, primaryName, System.StringComparison.OrdinalIgnoreCase))
            {
                if (TryCreateShortcutWithName(desktop, asciiName, exePath, args, workDir, title, out err))
                {
                    MessageBox.Show(this, $"Khong tao duoc shortcut theo ten co dau. Da tao: {asciiName}.lnk", "Shortcut");
                    return;
                }
            }

            var slugName = SanitizeFileName(slug);
            if (!string.IsNullOrWhiteSpace(slugName) &&
                !string.Equals(slugName, primaryName, System.StringComparison.OrdinalIgnoreCase))
            {
                if (TryCreateShortcutWithName(desktop, slugName, exePath, args, workDir, title, out err))
                {
                    MessageBox.Show(this, $"Khong tao duoc shortcut theo title. Da tao: {slugName}.lnk", "Shortcut");
                    return;
                }
            }

            MessageBox.Show(this, "Khong tao duoc shortcut. " + err, "Shortcut");
        }

        private static bool TryCreateShortcutWithName(
            string desktop,
            string name,
            string targetPath,
            string arguments,
            string? workingDir,
            string? description,
            out string? error)
        {
            error = null;
            if (string.IsNullOrWhiteSpace(name))
            {
                error = "Ten shortcut khong hop le.";
                return false;
            }
            var lnkPath = Path.Combine(desktop, name + ".lnk");
            try
            {
                if (File.Exists(lnkPath))
                    File.Delete(lnkPath);
            }
            catch { }

            return TryCreateShortcut(lnkPath, targetPath, arguments, workingDir, description, out error);
        }

        private static string ResolveExePath()
        {
            try
            {
                var exe = Process.GetCurrentProcess().MainModule?.FileName;
                if (!string.IsNullOrWhiteSpace(exe) && File.Exists(exe))
                    return exe;
            }
            catch { }

            var fallback = Path.Combine(AppContext.BaseDirectory, "AutoBetHub.exe");
            return fallback;
        }


        private static string SanitizeFileName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "";
            foreach (var c in Path.GetInvalidFileNameChars())
            {
                name = name.Replace(c, '_');
            }
            name = name.Trim();
            name = name.TrimEnd('.', ' ');
            if (string.IsNullOrWhiteSpace(name)) return "";
            if (IsReservedDeviceName(name)) name += "_";
            const int maxLen = 120;
            if (name.Length > maxLen)
                name = name.Substring(0, maxLen).Trim();
            name = name.TrimEnd('.', ' ');
            return name;
        }

        private static bool IsReservedDeviceName(string name)
        {
            var upper = name.Trim().TrimEnd('.').ToUpperInvariant();
            if (upper == "CON" || upper == "PRN" || upper == "AUX" || upper == "NUL")
                return true;
            if (upper.Length == 4)
            {
                var prefix = upper.Substring(0, 3);
                var tail = upper[3];
                if ((prefix == "COM" || prefix == "LPT") && tail >= '1' && tail <= '9')
                    return true;
            }
            return false;
        }

        private static string RemoveDiacritics(string text)
        {
            var normalized = text.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(normalized.Length);
            foreach (var c in normalized)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            }
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }

        private static bool TryCreateShortcut(
            string lnkPath,
            string targetPath,
            string arguments,
            string? workingDir,
            string? description,
            out string? error)
        {
            error = null;
            if (TryCreateShortcutShellLink(lnkPath, targetPath, arguments, workingDir, description, out var err1))
                return true;

            if (TryCreateShortcutWScript(lnkPath, targetPath, arguments, workingDir, description, out var err2))
                return true;

            error = err2 ?? err1 ?? "Unknown error";
            return false;
        }

        private static bool TryCreateShortcutShellLink(
            string lnkPath,
            string targetPath,
            string arguments,
            string? workingDir,
            string? description,
            out string? error)
        {
            error = null;
            try
            {
                var link = (IShellLinkW)new ShellLink();
                link.SetPath(targetPath);
                link.SetArguments(arguments ?? "");
                if (!string.IsNullOrWhiteSpace(workingDir))
                    link.SetWorkingDirectory(workingDir);
                if (!string.IsNullOrWhiteSpace(description))
                    link.SetDescription(description);
                link.SetIconLocation(targetPath, 0);
                ((IPersistFile)link).Save(lnkPath, true);
                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        private static bool TryCreateShortcutWScript(
            string lnkPath,
            string targetPath,
            string arguments,
            string? workingDir,
            string? description,
            out string? error)
        {
            error = null;
            try
            {
                var shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null)
                {
                    error = "WScript.Shell khong kha dung.";
                    return false;
                }

                dynamic shell = Activator.CreateInstance(shellType)!;
                dynamic shortcut = shell.CreateShortcut(lnkPath);
                shortcut.TargetPath = targetPath;
                shortcut.Arguments = arguments ?? "";
                if (!string.IsNullOrWhiteSpace(workingDir))
                    shortcut.WorkingDirectory = workingDir;
                if (!string.IsNullOrWhiteSpace(description))
                    shortcut.Description = description;
                shortcut.IconLocation = targetPath + ",0";
                shortcut.Save();
                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        [ComImport]
        [Guid("00021401-0000-0000-C000-000000000046")]
        private class ShellLink { }

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("000214F9-0000-0000-C000-000000000046")]
        private interface IShellLinkW
        {
            void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cch, out WIN32_FIND_DATAW pfd, int fFlags);
            void GetIDList(out IntPtr ppidl);
            void SetIDList(IntPtr pidl);
            void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cch);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cch);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
            void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cch);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
            void GetHotkey(out short pwHotkey);
            void SetHotkey(short wHotkey);
            void GetShowCmd(out int piShowCmd);
            void SetShowCmd(int iShowCmd);
            void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cch, out int piIcon);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
            void Resolve(IntPtr hwnd, int fFlags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
        }

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("0000010b-0000-0000-C000-000000000046")]
        private interface IPersistFile
        {
            void GetClassID(out Guid pClassID);
            [PreserveSig] int IsDirty();
            void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
            void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, bool fRemember);
            void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
            void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct WIN32_FIND_DATAW
        {
            public uint dwFileAttributes;
            public System.Runtime.InteropServices.ComTypes.FILETIME ftCreationTime;
            public System.Runtime.InteropServices.ComTypes.FILETIME ftLastAccessTime;
            public System.Runtime.InteropServices.ComTypes.FILETIME ftLastWriteTime;
            public uint nFileSizeHigh;
            public uint nFileSizeLow;
            public uint dwReserved0;
            public uint dwReserved1;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
            public string cFileName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 14)]
            public string cAlternateFileName;
        }

        private static Version GetCurrentVersion()
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();

                // Ưu tiên lấy từ AssemblyInformationalVersion (mapping với <Version> trong csproj)
                var infoAttr = asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
                if (infoAttr != null)
                {
                    var raw = infoAttr.InformationalVersion ?? "";
                    // cắt phần "+gitsha" nếu dùng kiểu 1.2.3+abcd
                    var main = raw.Split('+')[0];
                    if (Version.TryParse(main, out var vInfo))
                        return vInfo;
                }

                // Fallback: AssemblyVersion
                var ver = asm.GetName().Version;
                return ver ?? new Version(1, 0, 0, 0);
            }
            catch
            {
                return new Version(1, 0, 0, 0);
            }
        }

        /// <summary>
        /// Lấy phiên bản AutoBetHub đang được cài (ưu tiên file lưu ở %LocalAppData%\AutoBetHub).
        /// Nếu chưa có file version thì fallback về version của chính exe.
        /// </summary>
        private Version GetInstalledVersion()
        {
            try
            {
                var path = Path.Combine(_localRoot, "AppVersion.txt");
                if (File.Exists(path))
                {
                    var raw = File.ReadAllText(path).Trim();
                    if (!string.IsNullOrEmpty(raw) && Version.TryParse(raw, out var v))
                        return v;
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Update] GetInstalledVersion failed: " + ex.Message);
            }

            return GetCurrentVersion();
        }

        /// <summary>
        /// Ghi lại phiên bản AutoBetHub đã cài thành công gần nhất.
        /// </summary>
        private void SaveInstalledVersion(Version version)
        {
            try
            {
                var path = Path.Combine(_localRoot, "AppVersion.txt");
                File.WriteAllText(path, version.ToString());
            }
            catch (Exception ex)
            {
                _log.Warn("[Update] SaveInstalledVersion failed: " + ex.Message);
            }
        }



        /// <summary>
        /// Kiểm tra bản cập nhật trên GitHub.
        /// auto = true: chỉ thông báo khi có bản mới hoặc lỗi lớn.
        /// auto = false: bấm nút "Cập nhật" -> luôn báo kết quả cho người dùng.
        /// </summary>

        private async Task CheckForUpdateAsync(bool auto)
        {
            const string ManifestUrl =
                $"https://raw.githubusercontent.com/{LicenseOwner}/{LicenseRepo}/{LicenseBranch}/autobethub-manifest.json";

            try
            {
                // raw.githubusercontent.com bị cache CDN ~5 phút, thêm query-string + no-cache để lấy bản mới ngay
                var manifestUrl = $"{ManifestUrl}?_ts={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                _log.Info("[Update] Checking manifest at: " + manifestUrl);

                //if (!auto)
                //    SendUpdateStatusToWeb("checking", 5, "Đang kiểm tra bản cập nhật…");

                using var req = new HttpRequestMessage(HttpMethod.Get, manifestUrl);
                req.Headers.CacheControl = new CacheControlHeaderValue { NoCache = true, NoStore = true };
                using var resp = await _httpClient.SendAsync(req);
                if (!resp.IsSuccessStatusCode)
                {
                    _log.Warn($"[Update] Manifest HTTP {(int)resp.StatusCode}");
                    if (!auto)
                    {
                        SendUpdateStatusToWeb(
                            "error",
                            100,
                            "Không kiểm tra được bản cập nhật (HTTP " + (int)resp.StatusCode + ").");

                        MessageBox.Show(
                            "Không kiểm tra được bản cập nhật (HTTP " + (int)resp.StatusCode + ").",
                            "Cập nhật",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    }
                    return;
                }

                var json = await resp.Content.ReadAsStringAsync();
                var manifest = JsonSerializer.Deserialize<UpdateManifest>(
                    json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (manifest == null || string.IsNullOrWhiteSpace(manifest.appVersion))
                {
                    _log.Warn("[Update] Manifest invalid or missing appVersion.");
                    if (!auto)
                    {
                        SendUpdateStatusToWeb(
                            "error",
                            100,
                            "Dữ liệu cập nhật không hợp lệ.");

                        MessageBox.Show(
                            "Dữ liệu cập nhật không hợp lệ.",
                            "Cập nhật",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    }
                    return;
                }

                var current = GetInstalledVersion();
                var remote = new Version(manifest.appVersion);
                _log.Info($"[Update] Local={current}, Remote={remote}");

                if (remote > current)
                {
                    _log.Info($"[Update] UPDATE_AVAILABLE remote={remote} current={current}");
                }
                else
                {
                    _log.Info($"[Update] UPDATE_LATEST current={current} remote={remote}");
                }

                // Không có bản mới
                if (remote <= current)
                {
                    SendUpdateStatusToWeb(
                        "upToDate",
                        100,
                        $"Bạn đang dùng phiên bản mới nhất ({current}).",
                        current,
                        remote);
                    // popup web sẽ tự tắt sau 3 giây, không cần MessageBox
                    return;
                }

                // Có bản mới
                SendUpdateStatusToWeb(
                    "updateAvailable",
                    15,
                    $"Có bản mới {remote} (hiện tại {current}).",
                    current,
                    remote);

                var notes = string.IsNullOrWhiteSpace(manifest.notes)
                    ? "(Không có ghi chú)"
                    : manifest.notes;

                // Nếu là auto (kiểm tra lúc khởi động) -> tự động cập nhật, không hỏi
                if (auto)
                {
                    _log.Info($"[Update] Auto-startup: new version {remote} available (current {current}). Auto-updating without confirmation.");
                    await DownloadAndApplyUpdateAsync(manifest, current, remote);
                }
                else
                {
                    // Người dùng tự bấm checkUpdate -> vẫn hỏi confirm như cũ
                    var msg =
                        $"Đã có phiên bản mới {remote} (hiện tại {current}).\n\n" +
                        $"Ghi chú:\n{notes}\n\n" +
                        "Bạn có muốn tải và cập nhật tự động không?";

                    var result = MessageBox.Show(
                        msg,
                        "Cập nhật AutoBetHub",
                        MessageBoxButton.YesNo,
                        MessageBoxImage.Information);

                    if (result != MessageBoxResult.Yes)
                    {
                        // Người dùng chọn KHÔNG cập nhật:
                        // -> chỉ log lại, KHÔNG gửi status sang web
                        // để tránh hiển thị popup "Bạn đã hủy cập nhật".
                        _log.Info("[Update] User cancelled update from MessageBox.");
                        return;
                    }

                    await DownloadAndApplyUpdateAsync(manifest, current, remote);
                }
            }
            catch (Exception ex)
            {
                _log.Error("[Update] CheckForUpdateAsync failed", ex);
                if (!auto)
                {
                    SendUpdateStatusToWeb(
                        "error",
                        100,
                        "Có lỗi khi kiểm tra bản cập nhật: " + ex.Message);

                    MessageBox.Show(
                        "Có lỗi khi kiểm tra bản cập nhật:\n" + ex.Message,
                        "Cập nhật",
                        MessageBoxButton.OK,
                        MessageBoxImage.Error);
                }
            }
        }

        /// <summary>
        /// Tải gói cập nhật (ZIP) và giải nén vào %LocalAppData%\AutoBetHub.
        /// </summary>
        private async Task DownloadAndApplyUpdateAsync(UpdateManifest manifest, Version current, Version remote)
        {
            var url = !string.IsNullOrWhiteSpace(manifest.downloadUrl)
                ? manifest.downloadUrl
                : null;

            if (string.IsNullOrWhiteSpace(url))
            {
                SendUpdateStatusToWeb(
                    "error",
                    100,
                    "Không tìm thấy đường dẫn gói cập nhật (downloadUrl).");

                MessageBox.Show(
                    "Không tìm thấy đường dẫn gói cập nhật (downloadUrl) trong manifest.",
                    "Cập nhật",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
                return;
            }

            var tempZip = Path.Combine(
                Path.GetTempPath(),
                $"AutoBetHub_update_{remote}.zip");

            try
            {
                _log.Info("[Update] Downloading package from: " + url);

                SendUpdateStatusToWeb(
                    "downloading",
                    5,
                    "Đang bắt đầu tải gói cập nhật…",
                    current,
                    remote);

                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                using var response = await _httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead);

                response.EnsureSuccessStatusCode();

                var totalBytes = response.Content.Headers.ContentLength;

                // 🔧 QUAN TRỌNG: gói chung vào block để dispose stream TRƯỚC khi giải nén
                await using (var responseStream = await response.Content.ReadAsStreamAsync())
                await using (var fileStream = File.Create(tempZip))
                {
                    var buffer = new byte[81920];
                    long downloaded = 0;
                    var sw = Stopwatch.StartNew();

                    while (true)
                    {
                        var read = await responseStream.ReadAsync(buffer, 0, buffer.Length);
                        if (read <= 0) break;

                        await fileStream.WriteAsync(buffer, 0, read);
                        downloaded += read;

                        if (totalBytes.HasValue && totalBytes.Value > 0)
                        {
                            var progress = (int)Math.Min(95,
                                downloaded * 100.0 / totalBytes.Value);

                            var elapsed = sw.Elapsed.TotalSeconds;
                            var speed = elapsed > 0 ? downloaded / elapsed : 0; // bytes/s
                            double remainingSeconds = 0;
                            if (speed > 0)
                                remainingSeconds = (totalBytes.Value - downloaded) / speed;

                            string eta;
                            if (remainingSeconds >= 60)
                            {
                                var mins = (int)(remainingSeconds / 60);
                                var secs = (int)(remainingSeconds % 60);
                                eta = $"{mins} phút {secs} giây";
                            }
                            else
                            {
                                eta = $"{(int)remainingSeconds} giây";
                            }

                            var downloadedMb = downloaded / (1024.0 * 1024.0);
                            var totalMb = totalBytes.Value / (1024.0 * 1024.0);

                            SendUpdateStatusToWeb(
                                "downloading",
                                progress,
                                $"Đang tải gói cập nhật… ({downloadedMb:0.0}/{totalMb:0.0} MB, còn khoảng {eta})",
                                current,
                                remote);
                        }
                        else
                        {
                            var downloadedMb = downloaded / (1024.0 * 1024.0);
                            SendUpdateStatusToWeb(
                                "downloading",
                                50,
                                $"Đang tải gói cập nhật… ({downloadedMb:0.0} MB)",
                                current,
                                remote);
                        }
                    }
                } // <- ra khỏi block, cả responseStream & fileStream đều đã được dispose

                _log.Info("[Update] Download completed: " + tempZip);

                SendUpdateStatusToWeb(
                    "extracting",
                    97,
                    "Đang giải nén gói cập nhật…",
                    current,
                    remote);
                // Giải nén vào thư mục version riêng, tránh ghi đè các file đang được sử dụng.
                Directory.CreateDirectory(_localRoot);
                var targetRoot = Path.Combine(_localRoot, $"AutoBetHub.{remote}");
                Directory.CreateDirectory(targetRoot);
                ZipFile.ExtractToDirectory(tempZip, targetRoot, overwriteFiles: true);
                // đánh dấu đã tải về version mới (sẽ được áp dụng ở lần khởi động sau)
                SaveInstalledVersion(remote);

                SendUpdateStatusToWeb(
                    "done",
                    100,
                    "Cập nhật thành công! AutoBetHub sẽ tự khởi động lại…",
                    current,
                    remote);

                try
                {
                    // Lấy đường dẫn exe hiện tại
                    var exePath = Environment.ProcessPath;
                    if (string.IsNullOrEmpty(exePath))
                    {
                        exePath = Process.GetCurrentProcess().MainModule?.FileName;
                    }

                    if (!string.IsNullOrEmpty(exePath))
                    {
                        var startInfo = new ProcessStartInfo
                        {
                            FileName = exePath,
                            WorkingDirectory = Path.GetDirectoryName(exePath),
                            UseShellExecute = true
                        };

                        // Khởi động lại tiến trình mới
                        Process.Start(startInfo);
                    }

                    // Thoát ứng dụng hiện tại
                    Application.Current.Shutdown();
                }
                catch (Exception exRestart)
                {
                    _log.Warn("[Update] Auto-restart failed: " + exRestart.Message);

                    // Nếu restart tự động lỗi thì fallback: thông báo để người dùng tự mở lại
                    MessageBox.Show(
                        "Cập nhật thành công, nhưng không tự khởi động lại được.\n" +
                        "Vui lòng đóng và mở lại AutoBetHub.",
                        "Cập nhật",
                        MessageBoxButton.OK,
                        MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                _log.Error("[Update] DownloadAndApplyUpdateAsync failed", ex);

                SendUpdateStatusToWeb(
                    "error",
                    100,
                    "Có lỗi khi tải hoặc giải nén gói cập nhật: " + ex.Message,
                    current,
                    remote);

                MessageBox.Show(
                    "Có lỗi khi tải hoặc giải nén gói cập nhật:\n" + ex.Message,
                    "Cập nhật",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
            finally
            {
                try
                {
                    if (File.Exists(tempZip))
                        File.Delete(tempZip);
                }
                catch
                {
                    // ignore
                }
            }
        }


        private void HookHomeNavEvents()
        {
            if (_navEventsHooked || web.CoreWebView2 == null) return;
            _navEventsHooked = true;

            web.CoreWebView2.NavigationStarting += (_, e) =>
                _log.Info($"[Home] Starting: {e.Uri}");
            web.CoreWebView2.NavigationCompleted += (_, e) =>
                _log.Info($"[Home] Completed: ok={e.IsSuccess} err={e.WebErrorStatus}");
        }

        private async Task HookHomeDiagnosticsAsync()
        {
            if (_homeDiagnosticsHooked || web.CoreWebView2 == null) return;
            _homeDiagnosticsHooked = true;

            await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
(() => {
  const formatPart = (value) => {
    try {
      if (value == null) return 'null';
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.stack || value.message || String(value);
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    } catch {
      return '[unserializable]';
    }
  };

  const postDiag = (level, text) => {
    try {
      window.chrome?.webview?.postMessage({
        cmd: 'homeDiagnostics',
        level,
        text
      });
    } catch {}
  };

  const origWarn = console.warn ? console.warn.bind(console) : null;
  const origError = console.error ? console.error.bind(console) : null;

  console.warn = (...args) => {
    postDiag('warn', args.map(formatPart).join(' '));
    if (origWarn) origWarn(...args);
  };

  console.error = (...args) => {
    postDiag('error', args.map(formatPart).join(' '));
    if (origError) origError(...args);
  };

  window.addEventListener('DOMContentLoaded', () => {
    postDiag('info', 'DOMContentLoaded');
  });

  window.addEventListener('error', function (event) {
  try {
    const source = event && event.filename ? event.filename : 'inline';
    const line = event && typeof event.lineno === 'number' ? event.lineno : 0;
    const col = event && typeof event.colno === 'number' ? event.colno : 0;
    const message = event && event.message ? event.message : 'Unknown script error';
    postDiag('error', '[window.onerror] ' + source + ':' + line + ':' + col + ' ' + message);
  } catch {}
});

window.addEventListener('unhandledrejection', function (event) {
  try {
    const reason = event && event.reason
      ? (event.reason.stack || event.reason.message || String(event.reason))
      : 'Unknown promise rejection';
    postDiag('error', '[unhandledrejection] ' + reason);
  } catch {}
});
})();
");
        }

        // ========== Plugin lifecycle ==========

        private async Task ActivatePluginAsync(string? slug)
        {
            if (string.IsNullOrWhiteSpace(slug)) return;
            if (_activating)
            {
                _log.Info("[Hub] Activate ignored: already activating.");
                return;
            }

            _activating = true;
            _activatingSlug = slug;
            _log.Info($"[Hub] Activate start: slug='{slug}'");

            try
            {
                // trước khi mở plugin mới, tắt cái cũ
                //DeactivatePlugin();

                var p = _plugins.FirstOrDefault(x =>
                    string.Equals(x.Slug, slug, StringComparison.OrdinalIgnoreCase));
                if (p == null)
                {
                    _log.Warn($"Plugin not found for slug: {slug}");
                    MessageBox.Show(this, $"Không tìm thấy plugin cho “{slug}”.", "Missing plugin");
                    return;
                }

                _log.Info($"[Hub] Creating view for plugin: {p.Name} ({p.Slug})");
                var view = p.CreateView(_hostcx);

                if (view == null)
                {
                    _log.Warn("[Hub] Plugin view is null → back to home.");
                    ShowHub();
                    return;
                }

                if (!_shortcutMode && !_suppressAttachForNextPlugin)
                {
                    // van thu attach WebView neu plugin co host
                    await Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.Loaded);
                    try
                    {
                        var attached = WebViewAdapter.TryAttachToAnyNamedHost(
                            _hostcx.Web, view, _log,
                            "AutoWebViewHost_Full", "AutoWebViewHost", "WebHost", "WebViewHost");
                
                        _log.Info(attached
                            ? "[Hub] Shared WebView2 attached to plugin view."
                            : "[Hub] Plugin view has no WebView host; skip attach.");
                    }
                    catch (Exception ex)
                    {
                        _log.Warn("[Hub] Attach WebView2 failed: " + ex.Message);
                    }
                }

                _active = p;
                _suppressAttachForNextPlugin = false;
            }
            catch (Exception ex)
            {
                _log.Error("Activate plugin failed", ex);
                _active = null;
                ShowHub();
                MessageBox.Show(this, ex.ToString(), "Plugin start error");
            }
            finally
            {
                _activating = false;
                _activatingSlug = null;
            }
        }

        private void DeactivatePlugin()
        {
            if (_active == null) return;

            try
            {
                var t = _active.GetType();
                var miStop = t.GetMethod("Stop");
                var ret = miStop?.Invoke(_active, null);

                if (miStop == null && _active is IDisposable d)
                    d.Dispose();

                if (ret is Task task)
                    task.GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                _log.Error("Stop plugin error", ex);
            }
            finally
            {
                _active = null;
            }
        }

        private void GoHome(bool navigateHome = false)
        {
            _log.Info("[Hub] GoHome start.");
            DeactivatePlugin();

            try
            {
                var homeHost = this.FindName("HomeWebHost") as FrameworkElement;
                if (homeHost != null)
                {
                    WebViewAdapter.TryAttachToAnyNamedHost(_hostcx.Web, homeHost, _log, "HomeWebHost");
                    _log.Info("[Hub] WebView2 parked to HomeWebHost.");
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Hub] Park WebView2 to home failed: " + ex.Message);
            }

            HostContent.Content = null;
            ShowHub();
        }

        private void BtnHome_Click(object sender, RoutedEventArgs e)
        {
            _log.Info("[Hub] BtnHome_Click");
            GoHome();
            NavigateFile("hub.html");
        }

        private void ShowHub()
        {
            HdrChip.Visibility = Visibility.Collapsed;
            web.Visibility = Visibility.Visible;
            HostContent.Content = null;
            HostContainer.Visibility = Visibility.Collapsed;
            LogLayout("[After ShowHub]", HostContainer);
        }

        private void NavigateFile(string fileName)
        {
            var fullPath = Path.Combine(_webDir, fileName);
            if (!File.Exists(fullPath))
            {
                MessageBox.Show(this, $"Không tìm thấy {fileName}\n{fullPath}", "404 – File missing");
                return;
            }

            var uri = new Uri(fullPath).AbsoluteUri;
            _log.Info($"[Home] Navigate file: {uri}");

            try
            {
                if (web.CoreWebView2 == null)
                {
                    web.EnsureCoreWebView2Async().GetAwaiter().GetResult();
                    HookHomeDiagnosticsAsync().GetAwaiter().GetResult();
                    HookHomeNavEvents();
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Home] EnsureCoreWebView2Async on navigate failed: " + ex.Message);
            }

            web.CoreWebView2.Navigate(uri);
        }

        private static string ResolveWebRoot()
        {
            var probe = AppContext.BaseDirectory;

            for (int i = 0; i < 10; i++)
            {
                var candidate = Path.Combine(probe, "web");
                var hub = Path.Combine(candidate, "hub.html");
                if (File.Exists(hub))
                    return candidate;

                var parent = Directory.GetParent(probe);
                if (parent == null) break;
                probe = parent.FullName;
            }

            var fallback = Path.Combine(AppContext.BaseDirectory, "web");
            return Directory.Exists(fallback) ? fallback : AppContext.BaseDirectory;
        }

        private void LogLayout(string tag, FrameworkElement fe)
        {
            try
            {
                var parent = VisualTreeHelper.GetParent(fe) as FrameworkElement;
                _log.Info($"{tag}: {fe.GetType().Name} size={fe.ActualWidth:0}x{fe.ActualHeight:0} " +
                          $"vis={fe.Visibility} parent={(parent?.GetType().Name ?? "null")} " +
                          $"psize={(parent != null ? $"{parent.ActualWidth:0}x{parent.ActualHeight:0}" : "-")} ");
            }
            catch { }
        }


        /// <summary>
        /// Tìm các thư mục dạng AutoBetHub.&lt;version&gt; dưới _localRoot,
        /// lấy version mới nhất và copy Plugins + web sang thư mục runtime chính.
        /// Gọi hàm này lúc khởi động, trước khi load plugin.
        /// </summary>
        private void ApplyPendingUpdatesFromVersionFolders()
        {
            try
            {
                if (!Directory.Exists(_localRoot))
                    return;

                var versionDirs = Directory.GetDirectories(_localRoot, "AutoBetHub.*", SearchOption.TopDirectoryOnly);
                if (versionDirs.Length == 0) return;

                Version? bestVersion = null;
                string? bestDir = null;

                foreach (var dir in versionDirs)
                {
                    var name = Path.GetFileName(dir);
                    if (string.IsNullOrEmpty(name)) continue;

                    const string prefix = "AutoBetHub.";
                    if (!name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        continue;

                    var verStr = name.Substring(prefix.Length);
                    if (!Version.TryParse(verStr, out var v)) continue;

                    if (bestVersion == null || v > bestVersion)
                    {
                        bestVersion = v;
                        bestDir = dir;
                    }
                }

                if (bestDir == null || bestVersion == null)
                    return;

                _log.Info($"[Update] Applying pending update from folder: {bestDir}");

                // Plugins
                var srcPlugins = Path.Combine(bestDir, "Plugins");
                if (Directory.Exists(srcPlugins))
                {
                    Directory.CreateDirectory(_localPluginsDir);
                    CopyDirectoryOverwrite(srcPlugins, _localPluginsDir);
                }

                // web
                var srcWeb = Path.Combine(bestDir, "web");
                var dstWeb = Path.Combine(_localRoot, "web");
                if (Directory.Exists(srcWeb))
                {
                    Directory.CreateDirectory(dstWeb);
                    CopyDirectoryOverwrite(srcWeb, dstWeb);
                }

                // lưu lại version đã thực sự áp dụng
                SaveInstalledVersion(bestVersion);

                // XÓA TẤT CẢ các folder AutoBetHub.<ver> sau khi đã copy xong
                foreach (var dir in versionDirs)
                {
                    try
                    {
                        Directory.Delete(dir, true);
                    }
                    catch (Exception exDel)
                    {
                        _log.Warn("[Update] Delete version folder failed: " + exDel.Message);
                    }
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Update] ApplyPendingUpdatesFromVersionFolders failed: " + ex.Message);
            }
        }

        /// <summary>
        /// Copy toàn bộ cây thư mục sourceDir sang destDir, ghi đè file nếu đã tồn tại.
        /// </summary>
        private static void CopyDirectoryOverwrite(string sourceDir, string destDir)
        {
            foreach (var dir in Directory.GetDirectories(sourceDir, "*", SearchOption.AllDirectories))
            {
                var relative = Path.GetRelativePath(sourceDir, dir);
                var targetSub = Path.Combine(destDir, relative);
                Directory.CreateDirectory(targetSub);
            }

            foreach (var file in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
            {
                var relative = Path.GetRelativePath(sourceDir, file);
                var targetFile = Path.Combine(destDir, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(targetFile)!);
                File.Copy(file, targetFile, overwrite: true);
            }
        }

        private void EnsureFixedWebView2Runtime()
        {
            try
            {
                var fixedRuntimeLocal = Path.Combine(_thirdPartyDir, "WebView2Fixed_win-x64");
                var fixedRuntimeBase = Path.Combine(_baseDir, "ThirdParty", "WebView2Fixed_win-x64");
                var zipPath = Path.Combine(_thirdPartyDir, "WebView2Fixed_win-x64.zip");

                // Nếu runtime đã tồn tại (local hoặc cạnh exe) thì KHÔNG bung lại nữa.
                // Chỉ xóa file zip thừa nếu còn.
                if (Directory.Exists(fixedRuntimeLocal) || Directory.Exists(fixedRuntimeBase))
                {
                    try
                    {
                        if (File.Exists(zipPath))
                        {
                            File.Delete(zipPath);
                            _log.Info("[Home] Deleted leftover WebView2Fixed zip (runtime already present).");
                        }
                    }
                    catch (Exception exDel)
                    {
                        _log.Warn("[Home] Delete leftover WebView2Fixed zip failed: " + exDel.Message);
                    }

                    _log.Info("[Home] Fixed WebView2 runtime already present, skip extract.");
                    return;
                }

                // Đến đây nghĩa là CHƯA có runtime -> bung từ resource nhúng
                var asm = Assembly.GetExecutingAssembly();
                const string resName = "AutoBetHub.ThirdParty.WebView2Fixed_win-x64.zip";
                using var s = asm.GetManifestResourceStream(resName);
                if (s == null)
                {
                    _log.Info("[Home] No embedded WebView2 fixed runtime resource found.");
                    return;
                }

                Directory.CreateDirectory(_thirdPartyDir);
                using (var fs = File.Create(zipPath))
                    s.CopyTo(fs);

                _log.Info("[Home] Extracting WebView2 fixed runtime to " + fixedRuntimeLocal);
                ZipFile.ExtractToDirectory(zipPath, fixedRuntimeLocal, overwriteFiles: true);

                try
                {
                    if (File.Exists(zipPath))
                        File.Delete(zipPath);
                }
                catch (Exception exDel)
                {
                    _log.Warn("[Home] Delete WebView2Fixed zip after extract failed: " + exDel.Message);
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Home] EnsureFixedWebView2Runtime failed: " + ex.Message);
            }
        }



        // =========================================================
        //  unified runtime helpers
        // =========================================================
        private void ExtractEmbeddedPluginsToLocal()
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                var resNames = asm.GetManifestResourceNames()
                                  .Where(n => n.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)
                                           && (n.Contains(".Plugins.") || n.Contains("Plugins/")))
                                  .ToList();

                if (resNames.Count == 0)
                {
                    _log.Info("[Hub] No embedded plugins found.");
                    return;
                }

                foreach (var res in resNames)
                {
                    using var s = asm.GetManifestResourceStream(res);
                    if (s == null) continue;

                    string shortName;
                    if (res.Contains("Plugins/"))
                    {
                        shortName = res.Substring(res.IndexOf("Plugins/", StringComparison.Ordinal) + "Plugins/".Length);
                    }
                    else
                    {
                        shortName = res.Substring(res.IndexOf(".Plugins.", StringComparison.Ordinal) + ".Plugins.".Length);
                    }

                    var target = Path.Combine(_localPluginsDir, shortName);
                    using var fs = File.Create(target);
                    s.CopyTo(fs);
                    _log.Info($"[Hub] Extracted embedded plugin: {shortName} -> {target}");
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Hub] ExtractEmbeddedPluginsToLocal failed: " + ex.Message);
            }
        }

        private void CopyPluginsToLocal(string sourceDir, string destDir)
        {
            try
            {
                foreach (var file in Directory.GetFiles(sourceDir, "*.dll", SearchOption.AllDirectories))
                {
                    var name = Path.GetFileName(file);
                    var target = Path.Combine(destDir, name);
                    File.Copy(file, target, overwrite: true);
                    _log.Info($"[Hub] Copied plugin from base to local: {name}");
                }
            }
            catch (Exception ex)
            {
                _log.Warn("[Hub] CopyPluginsToLocal failed: " + ex.Message);
            }
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            // nếu vẫn còn plugin đang chạy (cửa sổ plugin tự show), thì chỉ ẩn hub
            if (_active != null)
            {
                e.Cancel = true;
                _pendingClose = true; // đánh dấu: user muốn đóng thật
                this.Hide();
                _log.Info("[Hub] Main window hidden (plugin still active) – pending close.");
                return;
            }

            StopSlugPipeServer();
            _log.Info("[Hub] Main window closing, no active plugin -> shutdown app.");
            base.OnClosing(e);
            Application.Current.Shutdown();
        }

        private sealed class NullWebViewService : IWebViewService
        {
            public object? Core => null;
            public bool CoreReady => false;
            public void Navigate(string url) { }
            public void NavigateToString(string html, string? baseUrl = null) { }
            public void MapFolder(string hostName, string folderFullPath) { }
            public void AttachTo(FrameworkElement root) { }
        }

    }

    // ================== WebViewAdapter ==================
    public sealed class WebViewAdapter : ABX.Core.IWebViewService
    {
        private readonly WebView2 _view;
        private readonly ABX.Core.ILogService _log;

        public WebViewAdapter(WebView2 view, ABX.Core.ILogService log)
        {
            _view = view;
            _log = log;
        }

        public object? Core => _view.CoreWebView2;
        public bool CoreReady => _view.CoreWebView2 != null;

        public void Navigate(string url) => _view.CoreWebView2?.Navigate(url);

        public void NavigateToString(string html, string? baseUrl = null)
        {
            if (!string.IsNullOrWhiteSpace(baseUrl))
            {
                html = $"<head><base href=\"{baseUrl}\"></head>{html}";
            }
            _view.NavigateToString(html);
        }

        public void MapFolder(string hostName, string folderFullPath)
        {
            if (!Directory.Exists(folderFullPath))
                throw new DirectoryNotFoundException(folderFullPath);

            _view.CoreWebView2?.SetVirtualHostNameToFolderMapping(
                hostName,
                folderFullPath,
                CoreWebView2HostResourceAccessKind.DenyCors);
        }

        public void AttachTo(FrameworkElement root)
        {
            TryAttachToAnyNamedHost(this, root, _log, "AutoWebViewHost_Full", "AutoWebViewHost", "WebHost", "WebViewHost");
        }

        public static bool TryAttachToAnyNamedHost(ABX.Core.IWebViewService svc, FrameworkElement rootOrHost, ABX.Core.ILogService log, params string[] names)
        {
            if (names == null || names.Length == 0)
                names = new[] { "AutoWebViewHost_Full" };

            foreach (var n in names)
            {
                if (TryAttachToNamedHost(svc, rootOrHost, n, log))
                    return true;
            }
            log.Warn("[WvAdapter] No named host matched.");
            return false;
        }

        public static bool TryAttachToNamedHost(ABX.Core.IWebViewService svc, FrameworkElement rootOrHost, string hostName, ABX.Core.ILogService log)
        {
            if (svc is not WebViewAdapter self) return false;

            FrameworkElement host;

            if (rootOrHost is FrameworkElement fe && fe.Name == hostName)
                host = fe;
            else
                host = FindChild<FrameworkElement>(rootOrHost, hostName);

            if (host == null)
            {
                log.Warn($"[WvAdapter] Host '{hostName}' NOT FOUND. Skip attaching to avoid overlay.");
                return false;
            }

            // detach khỏi chỗ cũ
            if (self._view.Parent is Border oldB)
                oldB.Child = null;
            else if (self._view.Parent is Panel oldP)
                oldP.Children.Remove(self._view);

            self._view.HorizontalAlignment = HorizontalAlignment.Stretch;
            self._view.VerticalAlignment = VerticalAlignment.Stretch;
            self._view.Visibility = Visibility.Visible;

            if (host is Border b)
            {
                b.Child = self._view;
                log.Info("[WvAdapter] Attached to Border (named host)");
            }
            else if (host is Panel p)
            {
                p.Children.Add(self._view);
                log.Info("[WvAdapter] Attached to Panel (named host)");
            }
            else
            {
                log.Warn("[WvAdapter] Named host is not a Panel/Border. Skip attach.");
                return false;
            }

            return true;
        }

        private static T? FindChild<T>(DependencyObject root, string name) where T : FrameworkElement
        {
            if (root == null) return null;
            int n = VisualTreeHelper.GetChildrenCount(root);
            for (int i = 0; i < n; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child is T c && c.Name == name) return c;
                var found = FindChild<T>(child, name);
                if (found != null) return found;
            }
            return null;
        }
    }
}
