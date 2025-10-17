// ABX.Hub/Hosting/PluginLoader.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using ABX.Core;               // IGamePlugin
using ABX.Hub.Services;       // LogService

namespace ABX.Hub.Hosting
{
    public static class PluginLoader
    {
        public static List<IGamePlugin> LoadAll(string pluginsDir, LogService log)
        {
            var list = new List<IGamePlugin>();

            if (!Directory.Exists(pluginsDir))
            {
                log.Warn($"[PluginLoader] Folder not found: {pluginsDir}");
                return list;
            }

            log.Info($"[PluginLoader] Probe dir: {pluginsDir}");
            log.Info($"[PluginLoader] Host IGamePlugin from: {typeof(IGamePlugin).Assembly.Location}");

            foreach (var dll in Directory.GetFiles(pluginsDir, "*.dll"))
            {
                try
                {
                    var full = Path.GetFullPath(dll);
                    log.Info($"[PluginLoader] Loading: {Path.GetFileName(full)}");

                    // ✅ Nạp vào Default ALC để chia sẻ type identity với host
                    var asm = AssemblyLoadContext.Default.LoadFromAssemblyPath(full);
                    log.Info($"[PluginLoader] Loaded assembly: {asm.FullName}");

                    foreach (var t in asm.GetTypes())
                    {
                        // Log để soi lý do không match
                        var ifaces = string.Join(", ", t.GetInterfaces().Select(i => i.FullName));
                        log.Info($"[PluginLoader]   type: {t.FullName} | ifaces: [{ifaces}]");

                        if (!t.IsClass || t.IsAbstract || !t.IsPublic) continue;

                        // Cách 1: so sánh đúng kiểu (chuẩn)
                        bool ok = typeof(IGamePlugin).IsAssignableFrom(t);

                        // Cách 2 (fallback): so sánh theo tên interface để “sống sót” nếu vẫn lệch context
                        if (!ok)
                            ok = t.GetInterfaces().Any(i => i.FullName == "ABX.Core.IGamePlugin");

                        if (!ok) continue;

                        var pluginObj = Activator.CreateInstance(t);
                        if (pluginObj is IGamePlugin p)         // vào nhánh “đẹp”
                        {
                            log.Info($"[PluginLoader]   -> activated (strong): {p.Name} ({p.Slug})");
                            list.Add(p);
                        }
                        else                                    // vào nhánh fallback theo tên
                        {
                            // Nếu bạn vẫn muốn chạy khi lệch context cực đoan:
                            // có thể tạo adapter tại đây. Hiện tại mình chỉ log cho rõ.
                            log.Warn($"[PluginLoader]   -> {t.FullName} implements by name but not castable to host IGamePlugin (ALC mismatch).");
                        }
                    }
                }
                catch (ReflectionTypeLoadException rtlex)
                {
                    var msgs = string.Join(" | ", rtlex.LoaderExceptions.Select(x => x.Message));
                    log.Error($"[PluginLoader] ReflectionTypeLoadException while scanning {dll}: {msgs}", rtlex);
                }
                catch (Exception ex)
                {
                    log.Error($"[PluginLoader] Load failed: {dll}", ex);
                }
            }

            log.Info($"[PluginLoader] Total plugins: {list.Count}");
            return list;
        }
    }
}
