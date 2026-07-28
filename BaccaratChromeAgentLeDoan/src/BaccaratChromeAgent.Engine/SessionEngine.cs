using BaccaratChromeAgent.Protocol;

namespace BaccaratChromeAgent.Engine;

/// <summary>
/// Engine thuần C#: không biết Chrome, DOM, WebView2 hay WPF.
/// Giai đoạn skeleton chỉ nhận snapshot và trả trạng thái hiển thị; không tạo action tự động.
/// </summary>
public sealed class SessionEngine
{
    private readonly Dictionary<string, SessionState> _sessions = new(StringComparer.Ordinal);
    private readonly Action<string>? _log;

    public SessionEngine(Action<string>? log = null) => _log = log;

    public EngineResponse ObserveSnapshot(string sessionId, GameSnapshot snapshot)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId);
        if (!_sessions.TryGetValue(sessionId, out var state))
            _sessions[sessionId] = state = new SessionState { Log = _log };

        var snapshotTableId = snapshot.TableId?.Trim();
        if (!string.IsNullOrWhiteSpace(snapshotTableId) &&
            (string.IsNullOrWhiteSpace(state.ActiveTableId) ||
             IsProvisionalTableId(state.ActiveTableId) ||
             string.Equals(snapshotTableId, state.ActiveTableId, StringComparison.Ordinal)))
        {
            state.ActiveTableId = snapshotTableId;
            if (!string.IsNullOrWhiteSpace(snapshot.TableName))
                state.TableName = snapshot.TableName;
        }

        var roadMatchesActiveTable = snapshot.RoadInfo is { } road &&
                                     !string.IsNullOrWhiteSpace(state.ActiveTableId) &&
                                     string.Equals(road.TableId, state.ActiveTableId, StringComparison.Ordinal);

        var sequenceMatchesActiveTable = !string.IsNullOrWhiteSpace(snapshot.Sequence) &&
                                         (string.Equals(snapshotTableId, state.ActiveTableId, StringComparison.Ordinal) ||
                                          roadMatchesActiveTable);
        if (sequenceMatchesActiveTable)
        {
            state.Sequence = FilterSequence(snapshot.Sequence);
        }
        if (roadMatchesActiveTable && snapshot.RoadInfo is { } matchingRoad)
            ApplyRoadInfo(state, matchingRoad);

        if (!string.IsNullOrWhiteSpace(snapshot.Phase))
            state.Status = snapshot.Phase;

        var diag = snapshot.Diagnostics;
        var key = $"{snapshot.TableId}|{snapshot.Round}|{roadKey(snapshot.RoadInfo)}|{diag?.RoadPacketCount}";
        if (!string.Equals(state.LastSnapshotLogKey, key, StringComparison.Ordinal))
        {
            state.LastSnapshotLogKey = key;
            _log?.Invoke($"[ENGINE][SNAP] session={sessionId} table={snapshot.TableId ?? "-"} round={snapshot.Round?.ToString() ?? "-"} " +
                $"frameGame={(diag?.IsGameFrame == true ? 1 : 0)} roadPackets={diag?.RoadPacketCount ?? 0} road={roadKey(snapshot.RoadInfo)} seqLen={state.Sequence.Length}");
        }

        var display = new DisplayState(
            Connection: "connected",
            Status: state.Status ?? "Đã nhận dữ liệu game",
            Sequence: state.Sequence,
            TableId: state.ActiveTableId,
            TableName: state.TableName,
            Round: snapshot.Round ?? state.LastRound,
            UpdatedAtUtc: DateTimeOffset.UtcNow,
            Progress: snapshot.Progress);

        // Mọi logic chiến lược và ActionIntent sẽ được chuyển vào đây ở giai đoạn sau.
        return new EngineResponse(display);
    }

    public EngineResponse Stop(string sessionId) => new(
        new DisplayState("connected", "Đã dừng", string.Empty, null, null, null, DateTimeOffset.UtcNow));

    private static bool IsProvisionalTableId(string? tableId) =>
        string.IsNullOrWhiteSpace(tableId) || string.Equals(tableId.Trim(), "0", StringComparison.Ordinal);

    private static void ApplyRoadInfo(SessionState state, RoadInfoSnapshot road)
    {
        var roadPacketKey = $"{road.TableId}|{road.Shoe}|{road.Round}|{road.BankerCount}|{road.PlayerCount}|{road.TieCount}";
        // The provider republishes the same completed round from several frames.
        // Process each immutable count snapshot once only.
        if (!state.SeenRoadPackets.Add(roadPacketKey))
            return;
        if (state.SeenRoadPackets.Count > 256)
            state.SeenRoadPackets.Clear();

        var isNewContext = !string.Equals(state.RoadTableId, road.TableId, StringComparison.Ordinal) ||
                           !string.Equals(state.RoadShoe, road.Shoe, StringComparison.Ordinal);
        if (isNewContext)
        {
            state.SeenRoadPackets.Clear();
            state.SeenRoadPackets.Add(roadPacketKey);
            state.RoadTableId = road.TableId;
            state.RoadShoe = road.Shoe;
            state.BankerCount = road.BankerCount;
            state.PlayerCount = road.PlayerCount;
            state.TieCount = road.TieCount;
            state.LastRound = road.Round;
            state.Log?.Invoke($"[ENGINE][ROAD][BASELINE] table={road.TableId ?? "-"} shoe={road.Shoe ?? "-"} round={road.Round?.ToString() ?? "-"} counts={road.BankerCount}/{road.PlayerCount}/{road.TieCount} latest={road.LatestRoadCode?.ToString() ?? "-"}");
            return;
        }

        var isStaleRound = road.Round.HasValue && state.LastRound.HasValue && road.Round.Value < state.LastRound.Value;
        var isStaleCounts = road.BankerCount < state.BankerCount ||
                            road.PlayerCount < state.PlayerCount ||
                            road.TieCount < state.TieCount;
        if (isStaleRound || isStaleCounts)
        {
            state.Log?.Invoke($"[ENGINE][ROAD][STALE] table={road.TableId ?? "-"} round={road.Round?.ToString() ?? "-"} lastRound={state.LastRound?.ToString() ?? "-"} counts={road.BankerCount}/{road.PlayerCount}/{road.TieCount} prev={state.BankerCount}/{state.PlayerCount}/{state.TieCount}");
            return;
        }

        state.BankerCount = road.BankerCount;
        state.PlayerCount = road.PlayerCount;
        state.TieCount = road.TieCount;
        state.LastRound = road.Round;
    }

    private static string FilterSequence(string value) => new(value.Where(c => c is 'B' or 'P' or 'T').ToArray());
    private static string roadKey(RoadInfoSnapshot? road) => road is null ? "-" : $"{road.TableId}/{road.Shoe}/{road.Round}:{road.BankerCount}/{road.PlayerCount}/{road.TieCount}";

    private sealed class SessionState
    {
        public string Sequence { get; set; } = "";
        public string? ActiveTableId { get; set; }
        public string? TableName { get; set; }
        public string? Status { get; set; }
        public string? RoadTableId { get; set; }
        public string? RoadShoe { get; set; }
        public long? LastRound { get; set; }
        public int BankerCount { get; set; }
        public int PlayerCount { get; set; }
        public int TieCount { get; set; }
        public HashSet<string> SeenRoadPackets { get; } = new(StringComparer.Ordinal);
        public string? LastSnapshotLogKey { get; set; }
        public Action<string>? Log { get; set; }
    }
}
