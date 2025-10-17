using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using ABX.Core;

namespace ABX.Hub.Services
{
    public sealed class ConfigService : IConfigService
    {
        private readonly string _file;
        private readonly Dictionary<string, string> _kv = new(StringComparer.OrdinalIgnoreCase);

        public ConfigService(string file)
        {
            _file = file;
            try
            {
                if (File.Exists(_file))
                {
                    var json = File.ReadAllText(_file);
                    var data = JsonSerializer.Deserialize<Dictionary<string, string>>(json)
                               ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var kv in data) _kv[kv.Key] = kv.Value;
                }
            }
            catch { /* ignore, dùng defaults */ }
        }

        public string Get(string key, string? defaultValue = null)
            => _kv.TryGetValue(key, out var v) ? v : (defaultValue ?? string.Empty);

        public void Set(string key, string value) => _kv[key] = value;

        public void Save()
        {
            var json = JsonSerializer.Serialize(_kv, new JsonSerializerOptions { WriteIndented = true });
            Directory.CreateDirectory(Path.GetDirectoryName(_file) ?? ".");
            File.WriteAllText(_file, json);
        }
    }
}
