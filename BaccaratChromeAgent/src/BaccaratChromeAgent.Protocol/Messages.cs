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
    DateTimeOffset UpdatedAtUtc);

public sealed record ActionIntent(
    string Kind,
    string RequestId,
    string? Side = null,
    decimal? Amount = null);

public sealed record EngineResponse(
    DisplayState Display,
    ActionIntent? Action = null);
