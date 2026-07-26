using System.Buffers.Binary;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using BaccaratChromeAgent.Protocol;

namespace BaccaratSexyCasino2;

/// <summary>
/// Read-only client for the Native Host Desktop pipe. It never sends a bet
/// command; Stage 2A only relays Chrome snapshots into the legacy WPF logic.
/// </summary>
internal sealed class ChromeGameBridge : IDisposable
{
    private const string PipeName = "BaccaratChromeAgent.Desktop";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    private readonly CancellationTokenSource _shutdown = new();
    private readonly Action<string> _log;

    internal event Action<DesktopPipeEnvelope>? EnvelopeReceived;
    internal event Action<bool>? ConnectionChanged;

    internal ChromeGameBridge(Action<string> log) => _log = log;

    internal void Start() => _ = ListenAsync(_shutdown.Token);

    private async Task ListenAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                using var pipe = new NamedPipeClientStream(".", PipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
                await pipe.ConnectAsync(1500, cancellationToken);
                ConnectionChanged?.Invoke(true);
                _log("[CHROME-BRIDGE] Connected to Native Host pipe.");

                while (await ReadAsync(pipe, cancellationToken) is { } raw)
                {
                    var envelope = JsonSerializer.Deserialize<DesktopPipeEnvelope>(raw, JsonOptions);
                    if (envelope?.Display is not null)
                        EnvelopeReceived?.Invoke(envelope);
                    else
                        _log("[CHROME-BRIDGE] Ignored malformed pipe envelope without display.");
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log($"[CHROME-BRIDGE] Waiting for Native Host: {ex.Message}");
                ConnectionChanged?.Invoke(false);
            }

            try { await Task.Delay(1500, cancellationToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private static async Task<string?> ReadAsync(Stream stream, CancellationToken cancellationToken)
    {
        var header = new byte[4];
        if (!await ReadExactlyAsync(stream, header, cancellationToken)) return null;
        var length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length is <= 0 or > 1_048_576)
            throw new InvalidOperationException("Desktop bridge message length is invalid.");
        var body = new byte[length];
        if (!await ReadExactlyAsync(stream, body, cancellationToken)) return null;
        return Encoding.UTF8.GetString(body);
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

    public void Dispose()
    {
        _shutdown.Cancel();
        _shutdown.Dispose();
    }
}
