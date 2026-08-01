using System.Buffers.Binary;
using System.Text;
using System.Text.Json;
using BaccaratChromeAgent.Engine;
using BaccaratChromeAgent.NativeHost;
using BaccaratChromeAgent.Protocol;

var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
var engine = new SessionEngine(HostLog.Write);
using var desktopPipe = new DesktopPipeHub();
using var input = Console.OpenStandardInput();
using var output = Console.OpenStandardOutput();
using var nativeWriteLock = new SemaphoreSlim(1, 1);
var lastChromeSessionId = "";
EngineResponse? lastGameResponse = null;
const string ExpectedExtensionVersion = "0.1.5";
var extensionRuntimeReady = 0;
HostLog.Write("[HOST][START] Native Messaging connected");

async Task WriteNativeAsync(object value)
{
    await nativeWriteLock.WaitAsync();
    try
    {
        await NativeMessaging.WriteAsync(output, JsonSerializer.Serialize(value, json), CancellationToken.None);
    }
    finally { nativeWriteLock.Release(); }
}

using var watchdogShutdown = new CancellationTokenSource();
var watchdogTask = Task.Run(async () =>
{
    long sequence = 0;
    using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
    try
    {
        while (await timer.WaitForNextTickAsync(watchdogShutdown.Token))
        {
            await WriteNativeAsync(new BridgeMessage(
                "watchdog_pulse",
                "",
                JsonSerializer.SerializeToElement(new
                {
                    sequence = ++sequence,
                    observedAtUtc = DateTimeOffset.UtcNow
                }, json)));

            if (sequence == 5 && Volatile.Read(ref extensionRuntimeReady) == 0)
            {
                const string status = "Extension Worker chua xac nhan runtime; hay dong toan bo Chrome Tool va mo lai.";
                HostLog.Write("[EXT][RUNTIME][MISSING] expected=" + ExpectedExtensionVersion);
                await desktopPipe.PublishAsync(new DisplayState(
                    "error", status, "", null, null, null, DateTimeOffset.UtcNow));
            }
        }
    }
    catch (OperationCanceledException) when (watchdogShutdown.IsCancellationRequested)
    {
    }
});

desktopPipe.CommandReceived += async command =>
{
    if (!string.Equals(command.Type, "place_bet", StringComparison.OrdinalIgnoreCase))
    {
        HostLog.Write($"[HOST][CMD][REJECT] unsupported={command.Type}");
        return;
    }

    if (string.IsNullOrWhiteSpace(lastChromeSessionId))
    {
        HostLog.Write($"[HOST][BET][REJECT] request={command.RequestId} reason=no-active-chrome-session");
        return;
    }

    if (string.IsNullOrWhiteSpace(command.Side) || command.Amount is null || command.Amount <= 0)
    {
        HostLog.Write($"[HOST][BET][REJECT] request={command.RequestId} reason=invalid-intent");
        return;
    }

    HostLog.Write($"[HOST][BET][TX] request={command.RequestId} session={lastChromeSessionId} side={command.Side} amount={command.Amount} round={command.RoundId}");
    await WriteNativeAsync(new BridgeMessage(
        "bet_command",
        lastChromeSessionId,
        JsonSerializer.SerializeToElement(new
        {
            requestId = command.RequestId,
            side = command.Side,
            amount = command.Amount,
            roundId = command.RoundId
        }, json)));
};

EngineResponse ObserveDiagnostic(JsonElement payload)
{
    HostLog.Write($"[EXT][DIAG] {payload.GetRawText()}");
    if (payload.TryGetProperty("event", out var eventValue) &&
        string.Equals(eventValue.GetString(), "runtime-ready", StringComparison.Ordinal))
    {
        var version = payload.TryGetProperty("extensionVersion", out var versionValue)
            ? versionValue.GetString()
            : null;
        if (string.Equals(version, ExpectedExtensionVersion, StringComparison.Ordinal))
        {
            Interlocked.Exchange(ref extensionRuntimeReady, 1);
            return new EngineResponse(new DisplayState(
                "connected", $"Extension Worker v{version} da san sang", "", null, null, null, DateTimeOffset.UtcNow));
        }

        HostLog.Write($"[EXT][RUNTIME][MISMATCH] expected={ExpectedExtensionVersion} actual={version ?? "-"}");
        return new EngineResponse(new DisplayState(
            "error", $"Extension Worker sai version (can {ExpectedExtensionVersion}, dang la {version ?? "khong ro"})", "", null, null, null, DateTimeOffset.UtcNow));
    }
    return new EngineResponse(new DisplayState("connected", "Dang quan sat", "", null, null, null, DateTimeOffset.UtcNow));
}

while (await NativeMessaging.ReadAsync(input, CancellationToken.None) is { } raw)
{
    try
    {
        var message = JsonSerializer.Deserialize<BridgeMessage>(raw, json)
            ?? throw new InvalidOperationException("Native message is empty.");
        var sessionId = string.IsNullOrWhiteSpace(message.SessionId) ? "default" : message.SessionId;
        if (message.Type == "legacy_tick") lastChromeSessionId = sessionId;
        HostLog.Write($"[HOST][RX] type={message.Type} session={sessionId}");

        GameSnapshot? snapshot = null;
        LegacyTickEnvelope? legacyTick = null;
        EngineResponse response;
        if (message.Type == "game_snapshot")
        {
            snapshot = message.Payload.Deserialize<GameSnapshot>(json)
                ?? throw new InvalidOperationException("Snapshot is missing.");
            response = engine.ObserveSnapshot(sessionId, snapshot);
            lastGameResponse = response;
        }
        else if (message.Type == "legacy_tick")
        {
            legacyTick = message.Payload.Deserialize<LegacyTickEnvelope>(json)
                ?? throw new InvalidOperationException("Legacy tick is missing.");
            snapshot = LegacyTickReader.ToDisplaySnapshot(legacyTick);
            response = engine.ObserveSnapshot(sessionId, snapshot);
            lastGameResponse = response;
            HostLog.Write($"[HOST][LEGACY-TICK] session={sessionId} bytes={Encoding.UTF8.GetByteCount(legacyTick.RawTick)} table={snapshot.TableId ?? "-"} seqLen={snapshot.Sequence.Length}");
        }
        else if (message.Type == "bet_result")
        {
            var result = message.Payload.ValueKind is JsonValueKind.Undefined ? "{}" : message.Payload.GetRawText();
            HostLog.Write($"[HOST][BET][RESULT] session={sessionId} payload={result}");
            // A bet acknowledgement has no snapshot. Keep the latest game state
            // so the extension overlay does not erase its current sequence.
            response = lastGameResponse ?? new EngineResponse(
                new DisplayState("connected", "Bet result received", "", null, null, null, DateTimeOffset.UtcNow));
        }
        else
        {
            response = message.Type switch
            {
                "diagnostic" => ObserveDiagnostic(message.Payload),
                "stop" => engine.Stop(sessionId),
                "ping" => new EngineResponse(new DisplayState("connected", "Engine sẵn sàng", "", null, null, null, DateTimeOffset.UtcNow)),
                _ => new EngineResponse(new DisplayState("error", $"Không hỗ trợ message: {message.Type}", "", null, null, null, DateTimeOffset.UtcNow))
            };
        }

        await desktopPipe.PublishAsync(response.Display, message.Type == "legacy_tick" ? null : snapshot, legacyTick);
        await WriteNativeAsync(new BridgeMessage(
            "engine_response", sessionId, JsonSerializer.SerializeToElement(response, json)));
    }
    catch (Exception ex)
    {
        HostLog.Write($"[HOST][ERROR] {ex.GetType().Name}: {ex.Message}");
        // stdout là protocol Native Messaging; lỗi chỉ được trả qua protocol, không Console.WriteLine.
        var error = new { type = "engine_error", message = ex.Message };
        await WriteNativeAsync(error);
    }
}

watchdogShutdown.Cancel();
try { await watchdogTask; }
catch (OperationCanceledException) { }

internal static class LegacyTickReader
{
    internal static GameSnapshot ToDisplaySnapshot(LegacyTickEnvelope envelope)
    {
        using var document = JsonDocument.Parse(envelope.RawTick);
        var root = document.RootElement;
        var tableId = Text(root, "seqTableId") ?? Text(root, "tableId");
        var tableName = Text(root, "seqTableName") ?? Text(root, "tableName");
        var sequence = Filter(Text(root, "seq"));
        return new GameSnapshot(
            tableId,
            tableName,
            Text(root, "shoe"),
            Number(root, "round") ?? Number(root, "seqVersion"),
            sequence,
            Text(root, "status"),
            Number(root, "prog"),
            null, null, null, null, null,
            envelope.ObservedAtUtc ?? DateTimeOffset.UtcNow);
    }

    private static string? Text(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined
            ? value.ToString()
            : null;

    private static int? Number(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value)) return null;
        if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined) return null;
        if (value.TryGetInt32(out var number)) return number;
        return int.TryParse(value.ToString(), out number) ? number : null;
    }

    private static string Filter(string? source) =>
        new string((source ?? string.Empty).Where(c => c is 'B' or 'P' or 'T').ToArray());
}

#if false
static EngineResponse ObserveDiagnostic(JsonElement payload)
{
    HostLog.Write($"[EXT][DIAG] {payload.GetRawText()}");
    return new EngineResponse(new DisplayState("connected", "Đang quan sát", "", null, null, null, DateTimeOffset.UtcNow));
}

#endif
internal static class HostLog
{
    private static readonly object Gate = new();
    private static readonly string DirectoryPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BaccaratChromeAgent", "logs");

    public static void Write(string line)
    {
        try
        {
            lock (Gate)
            {
                Directory.CreateDirectory(DirectoryPath);
                var file = Path.Combine(DirectoryPath, DateTime.Now.ToString("yyyyMMdd") + ".log");
                File.AppendAllText(file, $"[{DateTime.Now:HH:mm:ss}] {line}{Environment.NewLine}");
            }
        }
        catch { /* Native host phải giữ stdout sạch cho protocol. */ }
    }
}

internal static class NativeMessaging
{
    public static async Task<string?> ReadAsync(Stream stream, CancellationToken cancellationToken)
    {
        var header = new byte[4];
        if (!await ReadExactlyAsync(stream, header, cancellationToken)) return null;
        var length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length is <= 0 or > 1_048_576) throw new InvalidOperationException("Native message length is invalid.");
        var body = new byte[length];
        if (!await ReadExactlyAsync(stream, body, cancellationToken)) throw new EndOfStreamException();
        return Encoding.UTF8.GetString(body);
    }

    public static async Task WriteAsync(Stream stream, string message, CancellationToken cancellationToken)
    {
        var body = Encoding.UTF8.GetBytes(message);
        var header = new byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(header, body.Length);
        await stream.WriteAsync(header, cancellationToken);
        await stream.WriteAsync(body, cancellationToken);
        await stream.FlushAsync(cancellationToken);
    }

    private static async Task<bool> ReadExactlyAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset), cancellationToken);
            if (read == 0) return offset == 0;
            offset += read;
        }
        return true;
    }
}
