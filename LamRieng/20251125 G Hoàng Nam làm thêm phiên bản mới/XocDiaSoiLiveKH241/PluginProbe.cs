using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.Loader;

namespace XocDiaSoiLiveKH241
{
    internal static class PluginProbe
    {
        [ModuleInitializer]
        internal static void Init()
        {
            try
            {
                var baseDir = AppContext.BaseDirectory;
                var logDir = Path.Combine(baseDir, "Plugins");
                Directory.CreateDirectory(logDir);
                var log = Path.Combine(logDir, "XocDiaSoiLiveKH241.probe.log");

                void write(string s) => File.AppendAllText(log, $"[{DateTime.Now:HH:mm:ss.fff}] {s}{Environment.NewLine}");

                var asm = typeof(PluginProbe).Assembly;
                write($"Probe init from: {asm.Location}");
                write($"Assembly Name: {asm.GetName()}");

                // List ABX.Core assemblies currently loaded
                var loaded = AppDomain.CurrentDomain.GetAssemblies()
                    .Where(a => a.GetName().Name?.Equals("ABX.Core", StringComparison.OrdinalIgnoreCase) == true)
                    .Select(a => $"{a.Location} | {a.GetName()} | ALC={System.Runtime.Loader.AssemblyLoadContext.GetLoadContext(a)?.Name}")
                    .ToList();

                if (loaded.Count == 0)
                {
                    write("ABX.Core NOT loaded yet.");
                }
                else
                {
                    foreach (var l in loaded) write("ABX.Core loaded: " + l);
                }

                var abxCore = AppDomain.CurrentDomain.GetAssemblies()
                    .FirstOrDefault(a => a.GetName().Name == "ABX.Core");

                if (abxCore != null)
                {
                    var iface = abxCore.GetType("ABX.Core.IGamePlugin", throwOnError: false);
                    write("IGamePlugin (from host) resolved? " + (iface != null));
                }
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(Path.Combine(AppContext.BaseDirectory, "Plugins", "XocDiaSoiLiveKH241.probe.log"),
                        "[ERR] " + ex + Environment.NewLine);
                }
                catch { }
            }
        }
    }
}
