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
HostLog.Write("[HOST][START] Native Messaging connected");

static EngineResponse ObserveDiagnostic(JsonElement payload)
{
    HostLog.Write($"[EXT][DIAG] {payload.GetRawText()}");
    return new EngineResponse(new DisplayState("connected", "Dang quan sat", "", null, null, null, DateTimeOffset.UtcNow));
}

while (await NativeMessaging.ReadAsync(input, CancellationToken.None) is { } raw)
{
    try
    {
        var message = JsonSerializer.Deserialize<BridgeMessage>(raw, json)
            ?? throw new InvalidOperationException("Native message is empty.");
        var sessionId = string.IsNullOrWhiteSpace(message.SessionId) ? "default" : message.SessionId;
        HostLog.Write($"[HOST][RX] type={message.Type} session={sessionId}");

        GameSnapshot? snapshot = null;
        LegacyTickEnvelope? legacyTick = null;
        EngineResponse response;
        if (message.Type == "game_snapshot")
        {
            snapshot = message.Payload.Deserialize<GameSnapshot>(json)
                ?? throw new InvalidOperationException("Snapshot is missing.");
            response = engine.ObserveSnapshot(sessionId, snapshot);
        }
        else if (message.Type == "legacy_tick")
        {
            legacyTick = message.Payload.Deserialize<LegacyTickEnvelope>(json)
                ?? throw new InvalidOperationException("Legacy tick is missing.");
            snapshot = LegacyTickReader.ToDisplaySnapshot(legacyTick);
            response = engine.ObserveSnapshot(sessionId, snapshot);
            HostLog.Write($"[HOST][LEGACY-TICK] session={sessionId} bytes={Encoding.UTF8.GetByteCount(legacyTick.RawTick)} table={snapshot.TableId ?? "-"} seqLen={snapshot.Sequence.Length}");
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
        await NativeMessaging.WriteAsync(output, JsonSerializer.Serialize(new BridgeMessage(
            "engine_response", sessionId, JsonSerializer.SerializeToElement(response, json)), json), CancellationToken.None);
    }
    catch (Exception ex)
    {
        HostLog.Write($"[HOST][ERROR] {ex.GetType().Name}: {ex.Message}");
        // stdout là protocol Native Messaging; lỗi chỉ được trả qua protocol, không Console.WriteLine.
        var error = new { type = "engine_error", message = ex.Message };
        await NativeMessaging.WriteAsync(output, JsonSerializer.Serialize(error, json), CancellationToken.None);
    }
}

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
