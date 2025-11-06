using System;
using System.IO;
using System.Linq;
using System.Reflection;
using ABX.Core;
using AutoBetHub.Hosting;

namespace AutoBetHub
{
    internal sealed class PluginHandle
    {
        public PluginLoadContext Alc { get; init; } = null!;
        public Assembly Assembly { get; init; } = null!;
        public IGamePlugin Plugin { get; init; } = null!;
    }

    internal sealed class PluginManager
    {
        private readonly ILogService _log;

        public PluginManager(ILogService log) { _log = log; }

        public PluginHandle LoadFrom(string pluginPath)
        {
            if (!File.Exists(pluginPath)) throw new FileNotFoundException(pluginPath);
            var alc = new PluginLoadContext(pluginPath);
            var asm = alc.LoadFromAssemblyPath(pluginPath);

            var pluginType = asm.GetTypes().FirstOrDefault(t =>
                typeof(IGamePlugin).IsAssignableFrom(t) && !t.IsAbstract && t.GetConstructor(Type.EmptyTypes) != null);

            if (pluginType == null) throw new InvalidOperationException("No IGamePlugin implementation found in " + pluginPath);

            var plugin = (IGamePlugin)Activator.CreateInstance(pluginType)!;

            _log.Info($"[Plugin] Loaded '{plugin.Name}' ({plugin.Slug}) from {Path.GetFileName(pluginPath)}");
            return new PluginHandle { Alc = alc, Assembly = asm, Plugin = plugin };
        }

        public void Unload(PluginHandle handle)
        {
            try
            {
                handle.Alc.Unload();
                GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
                _log.Info("[Plugin] Unloaded plugin ALC.");
            }
            catch (Exception ex)
            {
                _log.Warn("[Plugin] Unload error: " + ex);
            }
        }
    }
}
