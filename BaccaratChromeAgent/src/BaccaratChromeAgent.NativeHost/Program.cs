using System.Buffers.Binary;
using System.Text;
using System.Text.Json;
using BaccaratChromeAgent.Engine;
using BaccaratChromeAgent.Protocol;

var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
var engine = new SessionEngine(HostLog.Write);
using var input = Console.OpenStandardInput();
using var output = Console.OpenStandardOutput();
HostLog.Write("[HOST][START] Native Messaging connected");

while (await NativeMessaging.ReadAsync(input, CancellationToken.None) is { } raw)
{
    try
    {
        var message = JsonSerializer.Deserialize<BridgeMessage>(raw, json)
            ?? throw new InvalidOperationException("Native message is empty.");
        var sessionId = string.IsNullOrWhiteSpace(message.SessionId) ? "default" : message.SessionId;
        HostLog.Write($"[HOST][RX] type={message.Type} session={sessionId}");

        EngineResponse response = message.Type switch
        {
            "game_snapshot" => engine.ObserveSnapshot(
                sessionId,
                message.Payload.Deserialize<GameSnapshot>(json)
                    ?? throw new InvalidOperationException("Snapshot is missing.")),
            "diagnostic" => ObserveDiagnostic(message.Payload),
            "stop" => engine.Stop(sessionId),
            "ping" => new EngineResponse(new DisplayState("connected", "Engine sẵn sàng", "", null, null, null, DateTimeOffset.UtcNow)),
            _ => new EngineResponse(new DisplayState("error", $"Không hỗ trợ message: {message.Type}", "", null, null, null, DateTimeOffset.UtcNow))
        };

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

static EngineResponse ObserveDiagnostic(JsonElement payload)
{
    HostLog.Write($"[EXT][DIAG] {payload.GetRawText()}");
    return new EngineResponse(new DisplayState("connected", "Đang quan sát", "", null, null, null, DateTimeOffset.UtcNow));
}

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
