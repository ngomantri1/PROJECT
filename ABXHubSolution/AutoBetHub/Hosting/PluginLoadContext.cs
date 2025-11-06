// AutoBetHub/Hosting/PluginLoadContext.cs
using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;

namespace AutoBetHub.Hosting
{
    /// <summary>
    /// AssemblyLoadContext cho plugin:
    /// - Các DLL của plugin: load từ thư mục plugin.
    /// - ABX.Core, AutoBetHub.* và các BCL: dùng chung Default context để tránh lệch type.
    /// </summary>
    public sealed class PluginLoadContext : AssemblyLoadContext, IDisposable
    {
        private readonly string _pluginDir;

        public PluginLoadContext(string pluginDir)
            : base(isCollectible: true)
        {
            _pluginDir = pluginDir;

            // Khi không tìm được dependency, thử resolve thủ công
            Resolving += (alc, name) =>
            {
                // 1) Luôn trả về assembly ĐANG có trong Default cho các lib của Hub
                var simple = name.Name!;
                if (simple == "ABX.Core" || simple.StartsWith("AutoBetHub", StringComparison.OrdinalIgnoreCase))
                {
                    var shared = AssemblyLoadContext.Default.Assemblies
                        .FirstOrDefault(a => a.GetName().Name == simple);
                    if (shared != null) return shared;
                }

                // 2) Nếu dependency nằm cạnh plugin, load từ pluginDir
                var candidate = Path.Combine(_pluginDir, simple + ".dll");
                if (File.Exists(candidate))
                    return LoadFromAssemblyPath(candidate);

                // 3) Trả null => .NET tiếp tục fallback sang Default (BCL, framework…)
                return null;
            };
        }

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            var simple = assemblyName.Name!;

            // Không được load lại ABX.Core/AutoBetHub.* vào ALC riêng
            if (simple == "ABX.Core" || simple.StartsWith("AutoBetHub", StringComparison.OrdinalIgnoreCase))
            {
                return AssemblyLoadContext.Default.Assemblies
                    .FirstOrDefault(a => a.GetName().Name == simple);
            }

            // Thử tìm ở thư mục plugin
            var path = Path.Combine(_pluginDir, simple + ".dll");
            if (File.Exists(path))
                return LoadFromAssemblyPath(path);

            // Trả null để .NET dùng Default context cho BCL/framework
            return null;
        }

        public void Dispose() => Unload();
    }
}
