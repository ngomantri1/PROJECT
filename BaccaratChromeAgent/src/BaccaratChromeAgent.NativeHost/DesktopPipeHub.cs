using System.Buffers.Binary;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using BaccaratChromeAgent.Protocol;

namespace BaccaratChromeAgent.NativeHost;

internal sealed class DesktopPipeHub : IDisposable
{
    internal const string PipeName = "BaccaratChromeAgent.Desktop";
    private readonly CancellationTokenSource _shutdown = new();
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private readonly object _gate = new();
    private NamedPipeServerStream? _client;
    private DesktopPipeEnvelope? _lastEnvelope;

    internal event Func<DesktopPipeCommand, Task>? CommandReceived;

    public DesktopPipeHub() => _ = AcceptLoopAsync(_shutdown.Token);

    public async Task PublishAsync(DisplayState display, GameSnapshot? snapshot = null, LegacyTickEnvelope? legacyTick = null)
    {
        _lastEnvelope = new DesktopPipeEnvelope(display, snapshot, legacyTick);
        NamedPipeServerStream? client;
        lock (_gate) client = _client;
        if (client is null || !client.IsConnected) return;
        try { await WriteAsync(client, JsonSerializer.Serialize(_lastEnvelope), _shutdown.Token); }
        catch { lock (_gate) if (ReferenceEquals(_client, client)) _client = null; }
    }

    private async Task AcceptLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            using var pipe = new NamedPipeServerStream(PipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
            try
            {
                await pipe.WaitForConnectionAsync(cancellationToken);
                lock (_gate) _client = pipe;
                if (_lastEnvelope is not null) await WriteAsync(pipe, JsonSerializer.Serialize(_lastEnvelope), cancellationToken);
                while (pipe.IsConnected && await ReadAsync(pipe, cancellationToken) is { } raw)
                {
                    DesktopPipeCommand? command = null;
                    try { command = JsonSerializer.Deserialize<DesktopPipeCommand>(raw); }
                    catch { }
                    if (command is null || string.IsNullOrWhiteSpace(command.Type))
                        continue;

                    var handlers = CommandReceived;
                    if (handlers is not null)
                    {
                        foreach (Func<DesktopPipeCommand, Task> handler in handlers.GetInvocationList())
                            await handler(command);
                    }
                }
            }
            catch (OperationCanceledException) { break; }
            catch { }
            finally { lock (_gate) if (ReferenceEquals(_client, pipe)) _client = null; }
        }
    }

    internal static async Task<string?> ReadAsync(Stream stream, CancellationToken cancellationToken)
    {
        var header = new byte[4];
        if (!await ReadExactlyAsync(stream, header, cancellationToken)) return null;
        var length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length is <= 0 or > 1_048_576) throw new InvalidOperationException("Desktop message length is invalid.");
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

    public void Dispose() { _shutdown.Cancel(); _writeLock.Dispose(); _shutdown.Dispose(); }
}
