using System.ComponentModel;
using System.Buffers.Binary;
using System.IO;
using System.IO.Pipes;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using BaccaratChromeAgent.Protocol;
using System.Windows;
using System.Windows.Media;

namespace BaccaratChromeAgent.Desktop;

public partial class MainWindow : Window, INotifyPropertyChanged
{
    private const string DesktopPipeName = "BaccaratChromeAgent.Desktop";
    private readonly CancellationTokenSource _shutdown = new();
    private string _connectionText = "Đang chờ Chrome";
    private Brush _connectionBrush = Brushes.DarkOrange;
    private string _statusText = "Mở Chrome và vào bàn Baccarat";
    private string _tableText = "-";
    private string _roundText = "-";
    private string _sequenceText = "-";
    private string _logText = "Desktop đã khởi động.";

    public MainWindow()
    {
        InitializeComponent();
        DataContext = this;
        _ = ListenToNativeHostAsync(_shutdown.Token);
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    public string ConnectionText { get => _connectionText; private set => Set(ref _connectionText, value); }
    public Brush ConnectionBrush { get => _connectionBrush; private set => Set(ref _connectionBrush, value); }
    public string StatusText { get => _statusText; private set => Set(ref _statusText, value); }
    public string TableText { get => _tableText; private set => Set(ref _tableText, value); }
    public string RoundText { get => _roundText; private set => Set(ref _roundText, value); }
    public string SequenceText { get => _sequenceText; private set => Set(ref _sequenceText, value); }
    public string LogText { get => _logText; private set => Set(ref _logText, value); }

    private async Task ListenToNativeHostAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                using var pipe = new NamedPipeClientStream(".", DesktopPipeName, PipeDirection.In, PipeOptions.Asynchronous);
                await pipe.ConnectAsync(1500, cancellationToken);
                await Dispatcher.InvokeAsync(() => { ConnectionText = "Đã kết nối Native Host"; ConnectionBrush = Brushes.ForestGreen; });
                while (await ReadPipeAsync(pipe, cancellationToken) is { } raw)
                {
                    var envelope = JsonSerializer.Deserialize<DesktopStateEnvelope>(raw);
                    if (envelope?.Display is not { } display) continue;
                    await Dispatcher.InvokeAsync(() => Apply(display));
                }
            }
            catch (OperationCanceledException) { break; }
            catch
            {
                await Dispatcher.InvokeAsync(() => { ConnectionText = "Đang chờ Native Host"; ConnectionBrush = Brushes.DarkOrange; });
                await Task.Delay(1500, cancellationToken);
            }
        }
    }

    private void Apply(DisplayState display)
    {
        ConnectionText = display.Connection == "connected" ? "Đã kết nối Chrome" : display.Connection;
        ConnectionBrush = display.Connection == "connected" ? Brushes.ForestGreen : Brushes.Firebrick;
        StatusText = display.Status;
        if (!string.IsNullOrWhiteSpace(display.TableName)) TableText = display.TableName;
        else if (!string.IsNullOrWhiteSpace(display.TableId)) TableText = display.TableId;
        if (display.Round.HasValue) RoundText = display.Round.Value.ToString();
        if (!string.IsNullOrWhiteSpace(display.Sequence)) SequenceText = display.Sequence;
        LogText = $"{DateTime.Now:HH:mm:ss}  {display.Status}{Environment.NewLine}{LogText}";
    }

    private void CheckBridge_Click(object sender, RoutedEventArgs e) => StatusText = "Bridge đặt cược sẽ được kiểm tra ở giai đoạn lệnh có xác nhận.";
    private void Stop_Click(object sender, RoutedEventArgs e) => StatusText = "Đã dừng tại Desktop. Chưa có lệnh cược nào được gửi.";
    protected override void OnClosed(EventArgs e) { _shutdown.Cancel(); base.OnClosed(e); }
    private void Set<T>(ref T field, T value, [CallerMemberName] string? name = null) { if (EqualityComparer<T>.Default.Equals(field, value)) return; field = value; PropertyChanged?.Invoke(this, new(name)); }
    private static async Task<string?> ReadPipeAsync(Stream stream, CancellationToken cancellationToken)
    {
        var header = new byte[4];
        if (!await ReadExactlyAsync(stream, header, cancellationToken)) return null;
        var length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length is <= 0 or > 1_048_576) throw new InvalidOperationException("Desktop message length is invalid.");
        var body = new byte[length];
        if (!await ReadExactlyAsync(stream, body, cancellationToken)) return null;
        return Encoding.UTF8.GetString(body);
    }
    private static async Task<bool> ReadExactlyAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < buffer.Length) { var read = await stream.ReadAsync(buffer.AsMemory(offset), cancellationToken); if (read == 0) return offset == 0; offset += read; }
        return true;
    }
}

public sealed record DesktopStateEnvelope(DisplayState? Display);
