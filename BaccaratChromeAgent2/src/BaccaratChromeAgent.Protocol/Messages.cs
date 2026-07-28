using System.Text.Json;

namespace BaccaratChromeAgent.Protocol;

public sealed record BridgeMessage(
    string Type,
    string? SessionId = null,
    JsonElement Payload = default);

public sealed record GameSnapshot(
    string? TableId,
    string? TableName,
    string? Shoe,
    long? Round,
    string Sequence,
    string? Phase,
    int? Progress,
    decimal? BankerPool,
    decimal? PlayerPool,
    decimal? TiePool,
    RoadInfoSnapshot? RoadInfo,
    CollectorDiagnostics? Diagnostics,
    DateTimeOffset ObservedAtUtc);

public sealed record CollectorDiagnostics(
    string FrameHref,
    bool IsGameFrame,
    int RoadPacketCount,
    DateTimeOffset? LastRoadPacketAtUtc);

/// <summary>Compact roadInfo packet. winCounts: Banker, Player, Tie.</summary>
public sealed record RoadInfoSnapshot(
    string? TableId,
    string? Shoe,
    long? Round,
    int BankerCount,
    int PlayerCount,
    int TieCount,
    int? LatestRoadCode,
    DateTimeOffset ObservedAtUtc);

public sealed record DisplayState(
    string Connection,
    string Status,
    string Sequence,
    string? TableId,
    string? TableName,
    long? Round,
    DateTimeOffset UpdatedAtUtc,
    int? Progress = null);

/// <summary>
/// Payload sent from Native Host to the local Desktop named pipe.
/// Display is retained for compact consumers; Snapshot is the authoritative
/// Chrome reading used by the migrated legacy WPF pipeline.
/// </summary>
public sealed record DesktopPipeEnvelope(
    DisplayState Display,
    GameSnapshot? Snapshot = null,
    LegacyTickEnvelope? LegacyTick = null);

/// <summary>
/// Command sent by the legacy WPF process to the Native Host over the local
/// named pipe. The host forwards it to the already selected Chrome game frame.
/// </summary>
public sealed record DesktopPipeCommand(
    string Type,
    string RequestId,
    string? Side = null,
    decimal? Amount = null,
    long? RoundId = null);

/// <summary>
/// Exact legacy JSON emitted by safePost in v4_js_xoc_dia_live.js. RawTick is
/// intentionally opaque between Chrome and the legacy WPF receiver.
/// </summary>
public sealed record LegacyTickEnvelope(
    string RawTick,
    int? TabId = null,
    int? FrameId = null,
    string? Href = null,
    string? FramePath = null,
    DateTimeOffset? ObservedAtUtc = null);

public sealed record ActionIntent(
    string Kind,
    string RequestId,
    string? Side = null,
    decimal? Amount = null);

public sealed record EngineResponse(
    DisplayState Display,
    ActionIntent? Action = null);
