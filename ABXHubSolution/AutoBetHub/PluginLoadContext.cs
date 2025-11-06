using System.IO;
using System.Reflection;
using System.Runtime.Loader;

namespace AutoBetHub
{
    internal sealed class PluginLoadContext : AssemblyLoadContext
    {
        private readonly string _pluginDir;

        public PluginLoadContext(string pluginMainPath) : base(isCollectible: true)
        {
            _pluginDir = Path.GetDirectoryName(pluginMainPath)!;
            Resolving += OnResolving;
        }

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            string candidate = Path.Combine(_pluginDir, assemblyName.Name + ".dll");
            if (File.Exists(candidate)) return LoadFromAssemblyPath(candidate);
            return null;
        }

        private Assembly? OnResolving(AssemblyLoadContext context, AssemblyName name)
        {
            string candidate = Path.Combine(_pluginDir, name.Name + ".dll");
            if (File.Exists(candidate)) return LoadFromAssemblyPath(candidate);
            return null;
        }
    }
}
