// AutoBetHub/Hosting/PluginLoader.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using ABX.Core;
using AutoBetHub.Services;

namespace AutoBetHub.Hosting
{
    public static class PluginLoader
    {
        public static List<IGamePlugin> LoadAll(string pluginsDir, LogService log)
        {
            var list = new List<IGamePlugin>();

            log.Info($"[PluginLoader] Host IGamePlugin asm: {typeof(IGamePlugin).Assembly.FullName}");
            try
            {
                var hostCoreLoc = typeof(IGamePlugin).Assembly.Location;
                if (!string.IsNullOrEmpty(hostCoreLoc))
                    log.Info($"[PluginLoader] Host IGamePlugin loc: {hostCoreLoc}");
            }
            catch { /* ignored */ }

            if (!Directory.Exists(pluginsDir))
            {
                log.Warn($"[PluginLoader] Folder not found: {pluginsDir}");
                return list;
            }

            log.Info($"[PluginLoader] Probe dir: {pluginsDir}");
            foreach (var dll in Directory.GetFiles(pluginsDir, "*.dll"))
            {
                try
                {
                    log.Info($"[PluginLoader] === Probing: {Path.GetFileName(dll)} ===");
                    var asm = Assembly.LoadFrom(dll);
                    log.Info($"[PluginLoader] Assembly: {asm.FullName}");
                    try { log.Info($"[PluginLoader] Location: {asm.Location}"); } catch { }

                    var refCore = asm.GetReferencedAssemblies()
                                     .FirstOrDefault(n => n.Name == typeof(IGamePlugin).Assembly.GetName().Name);
                    if (refCore != null)
                        log.Info($"[PluginLoader] References ABX.Core: {refCore.FullName}");
                    else
                        log.Warn($"[PluginLoader] Does NOT reference ABX.Core!");

                    Type? candidate = null;

                    Type[] types;
                    try { types = asm.GetTypes(); }
                    catch (ReflectionTypeLoadException rtle)
                    {
                        log.Error($"[PluginLoader] ReflectionTypeLoadException for {dll}.", rtle);
                        foreach (var le in rtle.LoaderExceptions) log.Error("  LoaderException: " + le?.Message, le);
                        continue;
                    }

                    foreach (var t in types)
                    {
                        var ifaceNames = string.Join(", ", t.GetInterfaces().Select(i => i.FullName));
                        log.Info($"[PluginLoader]   type: {t.FullName} | ifaces: [{ifaceNames}]");
                        if (!t.IsClass || t.IsAbstract || !t.IsPublic) continue;

                        // ✅ Chuẩn nhất: đúng identity của IGamePlugin
                        if (typeof(IGamePlugin).IsAssignableFrom(t))
                        {
                            candidate = t;
                            break;
                        }

                        // 🔎 Fallback theo tên interface để phát hiện "mismatch" (khác assembly identity)
                        if (t.GetInterfaces().Any(i => i.FullName == typeof(IGamePlugin).FullName))
                        {
                            log.Warn($"[PluginLoader]   '{t.FullName}' implements IGamePlugin BY NAME but not by IDENTITY. ABX.Core mismatch suspected.");
                            candidate = t;
                            break;
                        }
                    }

                    if (candidate != null)
                    {
                        var obj = Activator.CreateInstance(candidate);
                        if (obj is IGamePlugin p)
                        {
                            log.Info($"[PluginLoader] Activated plugin: {p.Name} ({p.Slug})");
                            list.Add(p);
                        }
                        else
                        {
                            log.Error($"[PluginLoader] Instantiated {candidate.FullName} but cast to IGamePlugin FAILED. " +
                                      $"Host ABX.Core: {typeof(IGamePlugin).Assembly.FullName}; Plugin ref: {refCore?.FullName ?? "<none>"}");
                        }
                    }
                    else
                    {
                        log.Warn($"[PluginLoader] No IGamePlugin found in {Path.GetFileName(dll)}");
                    }
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
