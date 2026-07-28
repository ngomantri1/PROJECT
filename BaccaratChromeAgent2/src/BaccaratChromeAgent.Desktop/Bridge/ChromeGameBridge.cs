using System.Buffers.Binary;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using BaccaratChromeAgent.Protocol;

namespace BaccaratSexyCasino2;

/// <summary>
/// Duplex client for the Native Host Desktop pipe. Chrome remains the only
/// browser executor; this class only carries user-authorized bet intents.
/// </summary>
internal sealed class ChromeGameBridge : IDisposable
{
    private const string PipeName = "BaccaratChromeAgent.Desktop";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    private readonly CancellationTokenSource _shutdown = new();
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private readonly object _gate = new();
    private readonly Action<string> _log;
    private NamedPipeClientStream? _pipe;

    internal event Action<DesktopPipeEnvelope>? EnvelopeReceived;
    internal event Action<bool>? ConnectionChanged;

    internal ChromeGameBridge(Action<string> log) => _log = log;

    internal void Start() => _ = ListenAsync(_shutdown.Token);

    internal bool IsConnected
    {
        get { lock (_gate) return _pipe?.IsConnected == true; }
    }

    internal async Task<string> SendBetAsync(string side, long amount, long roundId, CancellationToken cancellationToken)
    {
        NamedPipeClientStream? pipe;
        lock (_gate) pipe = _pipe;
        if (pipe is null || !pipe.IsConnected)
            return "err:chrome-bridge-disconnected";

        var command = new DesktopPipeCommand(
            "place_bet",
            Guid.NewGuid().ToString("N"),
            side,
            amount,
            roundId);
        try
        {
            await WriteAsync(pipe, JsonSerializer.Serialize(command), cancellationToken);
            _log($"[CHROME-BRIDGE][BET][TX] request={command.RequestId} side={side} amount={amount:N0} round={roundId}");
            return "queued";
        }
        catch (Exception ex)
        {
            _log("[CHROME-BRIDGE][BET][TX-ERR] " + ex.Message);
            return "err:" + ex.Message;
        }
    }

    private async Task ListenAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                using var pipe = new NamedPipeClientStream(".", PipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
                await pipe.ConnectAsync(1500, cancellationToken);
                lock (_gate) _pipe = pipe;
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

            finally { lock (_gate) _pipe = null; }
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

    private async Task WriteAsync(Stream stream, string message, CancellationToken cancellationToken)
    {
        await _writeLock.WaitAsync(cancellationToken);
        try
        {
            var body = Encoding.UTF8.GetBytes(message);
            var header = new byte[4];
            BinaryPrimitives.WriteInt32LittleEndian(header, body.Length);
            await stream.WriteAsync(header, cancellationToken);
            await stream.WriteAsync(body, cancellationToken);
            await stream.FlushAsync(cancellationToken);
        }
        finally { _writeLock.Release(); }
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
        _writeLock.Dispose();
        _shutdown.Dispose();
    }
}
