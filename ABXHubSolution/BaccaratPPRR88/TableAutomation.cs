using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace BaccaratPPRR88
{
    internal sealed class TableAutomationManager
    {
        private readonly Action<string> _log;
        private readonly Func<string, Task<string>> _execJs;
        private readonly Func<int, int, bool> _physicalClick;
        private readonly TableSettingsStore _settingsStore;
        private readonly ConcurrentDictionary<string, TableState> _states = new(StringComparer.OrdinalIgnoreCase);

        public TableAutomationManager(Action<string> log, Func<string, Task<string>> execJs, Func<int, int, bool> physicalClick, string settingsPath)
        {
            _log = log ?? throw new ArgumentNullException(nameof(log));
            _execJs = execJs ?? throw new ArgumentNullException(nameof(execJs));
            _physicalClick = physicalClick ?? throw new ArgumentNullException(nameof(physicalClick));
            _settingsStore = new TableSettingsStore(settingsPath, _log);
        }

        public void HandleUpdate(JsonElement root)
        {
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("tables", out var tablesEl) || tablesEl.ValueKind != JsonValueKind.Array)
                return;
            var count = tablesEl.GetArrayLength();
            _log($"[table_update] received {count} table(s)");
            foreach (var tableEl in tablesEl.EnumerateArray())
            {
                var entry = TableUpdateEntry.FromJson(tableEl);
                if (entry == null)
                    continue;
                var state = _states.GetOrAdd(entry.TableKey, key =>
                {
                    var setting = _settingsStore.GetOrCreateSetting(key, entry.TableId, entry.TableName);
                    return new TableState(key, setting);
                });
                state.Update(entry);
                if (state.Setting.ApplyEntry(entry))
                    _settingsStore.MarkDirty();
            }
            _ = _settingsStore.SaveIfDirtyAsync();
        }

        public void StartAutomation(string tableKey)
        {
            if (string.IsNullOrWhiteSpace(tableKey)) return;
            if (_states.TryGetValue(tableKey, out var state))
            {
                if (state.IsRunning)
                {
                    _log($"[table_auto] already running {tableKey}");
                    return;
                }
                state.Cancellation = new CancellationTokenSource();
                state.Loop = Task.Run(() => new TableAutomationTask(state, _execJs, _physicalClick, _log).RunAsync(state.Cancellation.Token));
                _log($"[table_auto] start {tableKey}");
            }
        }

        public void StopAutomation(string tableKey)
        {
            if (string.IsNullOrWhiteSpace(tableKey)) return;
            if (_states.TryGetValue(tableKey, out var state))
            {
                state.Cancellation?.Cancel();
                _log($"[table_auto] stop {tableKey}");
            }
        }

        public void StopAll()
        {
            foreach (var state in _states.Values)
            {
                state.Cancellation?.Cancel();
            }
            _log("[table_auto] stop all");
        }
    }

    internal sealed class TableState
    {
        public string Key { get; }
        public TableSetting Setting { get; }
        public TableAutomationTask Task { get; set; }
        public CancellationTokenSource? Cancellation { get; set; }
        public Task? Loop { get; set; }

        public bool IsRunning => Loop != null && !Loop.IsCompleted;

        public TableState(string key, TableSetting setting)
        {
            Key = key ?? throw new ArgumentNullException(nameof(key));
            Setting = setting ?? throw new ArgumentNullException(nameof(setting));
        }

        public void Update(TableUpdateEntry entry)
        {
            if (!string.IsNullOrWhiteSpace(entry.TableName) && Setting.TableName != entry.TableName)
                Setting.TableName = entry.TableName;
        }
    }

    internal sealed class TableAutomationTask
    {
        private readonly TableState _state;
        private readonly Func<string, Task<string>> _execJs;
        private readonly Func<int, int, bool> _clicker;
        private readonly Action<string> _log;

        public TableAutomationTask(TableState state, Func<string, Task<string>> execJs, Func<int, int, bool> clicker, Action<string> log)
        {
            _state = state ?? throw new ArgumentNullException(nameof(state));
            _execJs = execJs ?? throw new ArgumentNullException(nameof(execJs));
            _clicker = clicker ?? throw new ArgumentNullException(nameof(clicker));
            _log = log ?? throw new ArgumentNullException(nameof(log));
        }

        public async Task RunAsync(CancellationToken token)
        {
            _log($"[table_auto:{_state.Key}] loop started");
            try
            {
                while (!token.IsCancellationRequested)
                {
                    var entry = _state.Setting.LastSnapshot;
                    var resultInfo = entry == null ? "" : $"counts P={entry.Counts.Player ?? 0} B={entry.Counts.Banker ?? 0}";
                    _log($"[table_auto:{_state.Key}] heartbeat {resultInfo}");
                    await Task.Delay(Math.Max(200, _state.Setting.IntervalMs), token);
                }
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                _log($"[table_auto:{_state.Key}] error: {ex.Message}");
            }
            _log($"[table_auto:{_state.Key}] loop stopped");
        }
    }

    internal sealed class TableSetting
    {
        public string TableKey { get; set; } = "";
        public string TableId { get; set; } = "";
        public string TableName { get; set; } = "";
        public TableRect EndRegion { get; set; } = new();
        public TableRect ConfirmRegion { get; set; } = new();
        public TableRect PlayerRegion { get; set; } = new();
        public TableRect BankerRegion { get; set; } = new();
        public TableUpdateEntry? LastSnapshot { get; set; }
        public int IntervalMs { get; set; } = 1000;

        public bool ApplyEntry(TableUpdateEntry entry)
        {
            var changed = false;
            if (!string.IsNullOrWhiteSpace(entry.TableId) && entry.TableId != TableId)
            {
                TableId = entry.TableId;
                changed = true;
            }
            if (!string.IsNullOrWhiteSpace(entry.TableName) && entry.TableName != TableName)
            {
                TableName = entry.TableName;
                changed = true;
            }
            if (entry.Rect.HasSize)
            {
                EndRegion = entry.Rect;
                changed = true;
            }
            if (entry.PlayerSpot.HasSize)
            {
                PlayerRegion = entry.PlayerSpot;
                changed = true;
            }
            if (entry.BankerSpot.HasSize)
            {
                BankerRegion = entry.BankerSpot;
                changed = true;
            }
            LastSnapshot = entry;
            return changed;
        }
    }

    internal sealed class TableSettingsStore
    {
        private readonly string _path;
        private readonly Action<string> _log;
        private readonly Dictionary<string, TableSetting> _map = new(StringComparer.OrdinalIgnoreCase);
        private bool _dirty;

        public TableSettingsStore(string path, Action<string> log)
        {
            _path = path ?? throw new ArgumentNullException(nameof(path));
            _log = log ?? throw new ArgumentNullException(nameof(log));
            Load();
        }

        public TableSetting GetOrCreateSetting(string key, string id, string name)
        {
            if (string.IsNullOrWhiteSpace(key))
                key = Guid.NewGuid().ToString("N");

            if (!_map.TryGetValue(key, out var setting))
            {
                setting = new TableSetting
                {
                    TableKey = key,
                    TableId = id,
                    TableName = name
                };
                _map[key] = setting;
                _dirty = true;
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(name) && setting.TableName != name)
                {
                    setting.TableName = name;
                    _dirty = true;
                }
            }
            return setting;
        }

        public void MarkDirty() => _dirty = true;

        public async Task SaveIfDirtyAsync()
        {
            if (!_dirty) return;
            try
            {
                var dir = Path.GetDirectoryName(_path);
                if (!string.IsNullOrEmpty(dir))
                    Directory.CreateDirectory(dir);
                var options = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(_map.Values, options);
                var tmp = _path + ".tmp";
                await File.WriteAllTextAsync(tmp, json, Encoding.UTF8);
                File.Move(tmp, _path, true);
                _dirty = false;
                _log($"[table_auto] saved {_map.Count} settings");
            }
            catch (Exception ex)
            {
                _log("[table_auto] save failed: " + ex.Message);
            }
        }

        private void Load()
        {
            try
            {
                if (!File.Exists(_path)) return;
                var json = File.ReadAllText(_path, Encoding.UTF8);
                var settings = JsonSerializer.Deserialize<List<TableSetting>>(json);
                if (settings == null) return;
                foreach (var setting in settings)
                    if (!string.IsNullOrWhiteSpace(setting.TableKey))
                        _map[setting.TableKey] = setting;
            }
            catch (Exception ex)
            {
                _log("[table_auto] load failed: " + ex.Message);
            }
        }
    }

    internal sealed class TableUpdateEntry
    {
        public string TableKey { get; init; } = "";
        public string TableId { get; init; } = "";
        public string TableName { get; init; } = "";
        public TableRect Rect { get; init; } = new();
        public TableRect PlayerSpot { get; init; } = new();
        public TableRect BankerSpot { get; init; } = new();
        public TableCounts Counts { get; init; } = new();
        public TableBets Bets { get; init; } = new();
        public string Status { get; init; } = "";
        public string ResultChain { get; init; } = "";

        public static TableUpdateEntry? FromJson(JsonElement element)
        {
            if (element.ValueKind != JsonValueKind.Object) return null;
            var id = GetString(element, "id");
            var name = GetString(element, "name");
            var computedKey = !string.IsNullOrWhiteSpace(id) ? id.Trim() : $"name:{(name ?? Guid.NewGuid().ToString("N"))}";
            var entry = new TableUpdateEntry
            {
                TableKey = computedKey,
                TableId = id ?? "",
                TableName = name ?? "",
                Rect = TableRect.From(element.GetPropertyOrDefault("rect")),
                PlayerSpot = TableRect.From(element.GetPropertyOrDefault("playerSpot")),
                BankerSpot = TableRect.From(element.GetPropertyOrDefault("bankerSpot")),
                Counts = TableCounts.From(element.GetPropertyOrDefault("counts")),
                Bets = TableBets.From(element.GetPropertyOrDefault("bets")),
                Status = GetString(element, "status") ?? "",
                ResultChain = GetString(element, "resultChain") ?? ""
            };
            return entry;
        }

        private static string? GetString(JsonElement parent, string property)
        {
            if (parent.ValueKind != JsonValueKind.Object) return null;
            if (!parent.TryGetProperty(property, out var value)) return null;
            return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
        }
    }

    internal sealed class TableCounts
    {
        public long? Player { get; set; }
        public long? Banker { get; set; }
        public long? Tie { get; set; }

        public static TableCounts From(JsonElement element)
        {
            var counts = new TableCounts();
            if (element.ValueKind != JsonValueKind.Object) return counts;
            counts.Player = GetLong(element, "player");
            counts.Banker = GetLong(element, "banker");
            counts.Tie = GetLong(element, "tie");
            return counts;
        }

        private static long? GetLong(JsonElement parent, string property)
        {
            if (!parent.TryGetProperty(property, out var value)) return null;
            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var iv)) return iv;
            if (value.ValueKind == JsonValueKind.String && long.TryParse(value.GetString(), out var sv)) return sv;
            return null;
        }
    }

    internal sealed class TableBets
    {
        public double? Player { get; set; }
        public double? Banker { get; set; }
        public double? Tie { get; set; }

        public static TableBets From(JsonElement element)
        {
            var bets = new TableBets();
            if (element.ValueKind != JsonValueKind.Object) return bets;
            bets.Player = GetDouble(element, "player");
            bets.Banker = GetDouble(element, "banker");
            bets.Tie = GetDouble(element, "tie");
            return bets;
        }

        private static double? GetDouble(JsonElement parent, string property)
        {
            if (!parent.TryGetProperty(property, out var value)) return null;
            if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var dv)) return dv;
            if (value.ValueKind == JsonValueKind.String && double.TryParse(value.GetString(), out var sv)) return sv;
            return null;
        }
    }

    internal sealed class TableRect
    {
        public double X { get; init; }
        public double Y { get; init; }
        public double Width { get; init; }
        public double Height { get; init; }

        public bool HasSize => Width > 0 && Height > 0;

        public static TableRect From(JsonElement element)
        {
            if (element.ValueKind != JsonValueKind.Object)
                return new TableRect();
            return new TableRect
            {
                X = GetDouble(element, "x"),
                Y = GetDouble(element, "y"),
                Width = GetDouble(element, "width", "w"),
                Height = GetDouble(element, "height", "h")
            };
        }

        private static double GetDouble(JsonElement parent, string property, string fallbackProperty = "")
        {
            if (parent.TryGetProperty(property, out var value))
            {
                if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var dv)) return dv;
                if (value.ValueKind == JsonValueKind.String && double.TryParse(value.GetString(), out var sv)) return sv;
            }
            if (!string.IsNullOrEmpty(fallbackProperty) && parent.TryGetProperty(fallbackProperty, out var fallback))
            {
                if (fallback.ValueKind == JsonValueKind.Number && fallback.TryGetDouble(out var dv)) return dv;
                if (fallback.ValueKind == JsonValueKind.String && double.TryParse(fallback.GetString(), out var sv)) return sv;
            }
            return 0;
        }
    }

    internal static class JsonElementExtensions
    {
        public static JsonElement GetPropertyOrDefault(this JsonElement element, string name)
        {
            if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value))
                return value;
            return default;
        }
    }
}
