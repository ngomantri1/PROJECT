using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Data;
using CryptoScanner.Desktop.Helpers;
using CryptoScanner.Desktop.Models;
using CryptoScanner.Desktop.Services;

namespace CryptoScanner.Desktop.ViewModels;

public sealed class MainViewModel : ObservableObject
{
 readonly ScannerService _scanner = new();
 readonly ExportService _export = new();
 readonly BacktestService _backtest = new();
 readonly List<ScanResult> _rawResults = [];
 CancellationTokenSource? _cts;
 bool _isScanning;
 bool _isExporting;
 bool _isBacktesting;
 bool _hasScanned;
 bool _scanFailed;
 double _progress;
 string _status = "Sẵn sàng";
 string _stage = "Idle";
 string _btc = "UNKNOWN";
 string _searchText = "";
 string _statusFilter = "ALL";
 int _scanned;
 int _progressCurrent;
 int _progressTotal;
 DateTimeOffset? _updated;
 ScanSessionMetadata? _lastScanMetadata;
 CoinDisplayItem? _selectedCoin;

 public ObservableCollection<CoinDisplayItem> DisplayResults { get; } = [];
 public ICollectionView ResultsView { get; }
 public IReadOnlyList<string> StatusFilters { get; } = ["ALL", "PRIORITY", "WATCH", "REJECT", "BUY", "DATA"];

 public CoinDisplayItem? SelectedCoin { get => _selectedCoin; set => Set(ref _selectedCoin, value); }
 public string SearchText { get => _searchText; set { if (Set(ref _searchText, value)) RefreshFilter(); } }
 public string StatusFilter { get => _statusFilter; set { if (Set(ref _statusFilter, value)) RefreshFilter(); } }

 public AsyncRelayCommand ScanCommand { get; }
 public RelayCommand CancelCommand { get; }
 public AsyncRelayCommand ExportCommand { get; }
 public AsyncRelayCommand BacktestCommand { get; }
 public RelayCommand OpenExportFolderCommand { get; }
 public RelayCommand OpenLogFolderCommand { get; }
 public RelayCommand CopySymbolCommand { get; }
 public RelayCommand OpenTradingViewCommand { get; }
 public RelayCommand OpenBinanceCommand { get; }
 public RelayCommand OpenCoinGeckoCommand { get; }

 public MainViewModel()
 {
  ResultsView = CollectionViewSource.GetDefaultView(DisplayResults);
  ResultsView.Filter = FilterResult;

  ScanCommand = new(ScanAsync, () => CanScan, ex => AppLogger.Error("Unhandled scan command exception", ex));
  CancelCommand = new(_ => _cts?.Cancel(), _ => CanCancel);
  ExportCommand = new(ExportAsync, () => CanExport, ex => AppLogger.Error("Unhandled export command exception", ex));
  BacktestCommand = new(BacktestAsync, () => CanBacktest, ex => AppLogger.Error("Unhandled backtest command exception", ex));
  OpenExportFolderCommand = new(_ => OpenExportFolder());
  OpenLogFolderCommand = new(_ => OpenLogFolder());
  CopySymbolCommand = new(x => CopySymbol(x as CoinDisplayItem ?? SelectedCoin), x => (x as CoinDisplayItem ?? SelectedCoin) is not null);
  OpenTradingViewCommand = new(x => OpenTradingView(x as CoinDisplayItem ?? SelectedCoin), x => (x as CoinDisplayItem ?? SelectedCoin) is not null);
  OpenBinanceCommand = new(x => OpenBinance(x as CoinDisplayItem ?? SelectedCoin), x => (x as CoinDisplayItem ?? SelectedCoin) is not null);
  OpenCoinGeckoCommand = new(x => OpenCoinGecko(x as CoinDisplayItem ?? SelectedCoin), x => (x as CoinDisplayItem ?? SelectedCoin) is not null);
 }

 public double Progress { get => _progress; set => Set(ref _progress, value); }
 public string StatusMessage { get => _status; set => Set(ref _status, value); }
 public string ProgressStage { get => _stage; set => Set(ref _stage, value); }
 public int ProgressCurrent { get => _progressCurrent; set => Set(ref _progressCurrent, value); }
 public int ProgressTotal { get => _progressTotal; set => Set(ref _progressTotal, value); }
 public string ProgressDetail => ProgressTotal > 0 ? $"{ProgressStage}: {ProgressCurrent}/{ProgressTotal}" : ProgressStage;
 public string BtcRegime { get => _btc; set => Set(ref _btc, value); }
 public bool IsScanning { get => _isScanning; private set { if (Set(ref _isScanning, value)) RaiseCommandState(); } }
 public bool IsExporting { get => _isExporting; private set { if (Set(ref _isExporting, value)) RaiseCommandState(); } }
 public bool IsBacktesting { get => _isBacktesting; private set { if (Set(ref _isBacktesting, value)) RaiseCommandState(); } }
 public bool IsBusy => IsScanning || IsExporting || IsBacktesting;
 public bool CanScan => !IsBusy;
 public bool CanCancel => IsScanning || IsBacktesting;
 public bool CanExport => _rawResults.Count > 0 && !IsBusy;
 public bool CanBacktest => !IsBusy;
 public int ScannedCount { get => _scanned; set => Set(ref _scanned, value); }
 public int PassedCount => DisplayResults.Count;
 public int BuyReadyCount => DisplayResults.Count(x => x.Source.Status == "BUY_READY");
 public int PriorityCount => DisplayResults.Count(x => x.Source.Status == "WATCHLIST_PRIORITY");
 public int WatchlistCount => DisplayResults.Count(x => x.Source.Status == "WATCHLIST");
 public int RejectCount => DisplayResults.Count(x => x.Source.Status == "REJECT");
 public int FilteredCount => ResultsView.Cast<CoinDisplayItem>().Count();
 public string BreakdownSummary => $"Priority {PriorityCount}  •  Watch {WatchlistCount}  •  Reject {RejectCount}";
 public string UpdatedAt => _updated?.ToString("dd/MM/yyyy HH:mm") ?? "--";
 public bool HasResults => DisplayResults.Count > 0;
 public bool HasVisibleResults => FilteredCount > 0;
 public bool ShowInitialState => !IsBusy && !_hasScanned && !HasResults && !_scanFailed;
 public bool ShowNoResultsState => !IsBusy && _hasScanned && !HasVisibleResults && !_scanFailed;
 public bool ShowErrorState => _scanFailed;

 async Task ScanAsync()
 {
  IsScanning = true;
  _hasScanned = true;
  _scanFailed = false;
  var scanStartedAt = DateTimeOffset.Now;
  var stopwatch = Stopwatch.StartNew();
  ClearResults();
  try
  {
   AppLogger.Info("Scan command started");
   _cts?.Dispose();
   _cts = new CancellationTokenSource();
   var p = new Progress<(double, string)>(x => UpdateProgress(x.Item1, x.Item2));
   var data = await _scanner.ScanAsync(p, _cts.Token);
   stopwatch.Stop();
   _lastScanMetadata = new ScanSessionMetadata
   {
   ScanStartedAt = scanStartedAt,
   ScanEndedAt = DateTimeOffset.Now,
   ElapsedMs = stopwatch.ElapsedMilliseconds,
    Pipeline = data.Metrics,
    UnlockCache = data.UnlockCache
   };
   _rawResults.AddRange(data.Results);
   foreach (var x in _rawResults)
   {
    DisplayResults.Add(new CoinDisplayItem(x));
   }

   RefreshFilter();
   SelectedCoin = ResultsView.Cast<CoinDisplayItem>().FirstOrDefault();
   ScannedCount = data.Scanned;
   BtcRegime = data.BtcRegime;
   _updated = DateTimeOffset.Now;
   RaiseSummary();
   await SaveCompletedScanHistoryAsync();
   AppLogger.Info($"Scan command completed; scanned={ScannedCount}; results={DisplayResults.Count}; logDir={AppLogger.LogDirectory}");
  }
  catch (OperationCanceledException)
  {
   stopwatch.Stop();
   _lastScanMetadata = new ScanSessionMetadata
   {
    ScanStartedAt = scanStartedAt,
    ScanEndedAt = DateTimeOffset.Now,
    ElapsedMs = stopwatch.ElapsedMilliseconds
   };
   StatusMessage = "Đã hủy.";
   ProgressStage = "Canceled";
   AppLogger.Warn("Scan command canceled");
  }
  catch (Exception ex)
  {
   stopwatch.Stop();
   _lastScanMetadata = new ScanSessionMetadata
   {
    ScanStartedAt = scanStartedAt,
    ScanEndedAt = DateTimeOffset.Now,
    ElapsedMs = stopwatch.ElapsedMilliseconds
   };
   _scanFailed = true;
   StatusMessage = "Quét thất bại. Xem log để biết chi tiết.";
   ProgressStage = "Error";
   AppLogger.Error("Scan command failed", ex);
   MessageBox.Show(ex.ToString(), "Scanner error");
  }
  finally
  {
   IsScanning = false;
   _cts?.Dispose();
   _cts = null;
   RaiseStates();
  }
 }

 async Task ExportAsync()
 {
  IsExporting = true;
  try
  {
   AppLogger.Info("Export command started");
   var path = await _export.ExportAsync(_rawResults, BtcRegime, ScannedCount, _lastScanMetadata);
   StatusMessage = "Đã xuất: " + path;
   MessageBox.Show(path, "Xuất JSON thành công");
  }
  catch (Exception ex)
  {
   AppLogger.Error("Export command failed", ex);
   MessageBox.Show(ex.Message, "Export error");
  }
  finally
  {
   IsExporting = false;
  }
 }

 async Task BacktestAsync()
 {
  IsBacktesting = true;
  try
  {
   AppLogger.Info("Backtest command started");
   _cts?.Dispose();
   _cts = new CancellationTokenSource();
   Progress = 0;
   ProgressStage = "Backtest";
   ProgressCurrent = 0;
   ProgressTotal = 0;
   StatusMessage = "Đang chạy backtest...";
   var path = await _backtest.RunAsync(_cts.Token);
   Progress = 100;
   ProgressStage = "Completed";
   StatusMessage = "Đã xuất backtest: " + path;
  }
  catch (OperationCanceledException)
  {
   StatusMessage = "Đã hủy backtest.";
   AppLogger.Warn("Backtest command canceled");
  }
  catch (Exception ex)
  {
   StatusMessage = "Lỗi backtest: " + ex.Message;
   AppLogger.Error("Backtest command failed", ex);
  }
  finally
  {
   IsBacktesting = false;
   RaiseStates();
  }
 }

 async Task SaveCompletedScanHistoryAsync()
 {
  try
  {
   if (_rawResults.Count == 0 || _lastScanMetadata is null) return;
   var path = await _export.ExportAsync(_rawResults, BtcRegime, ScannedCount, _lastScanMetadata, saveHistory: true);
   StatusMessage = "Đã tự lưu snapshot/history: " + path;
  }
  catch (Exception ex)
  {
   AppLogger.Warn("Auto history export failed: " + ex.Message);
  }
 }

 void OpenExportFolder() => OpenFolder(ExportService.ExportDirectory, "export");
 void OpenLogFolder() => OpenFolder(AppLogger.LogDirectory, "log");

 void OpenFolder(string directory, string label)
 {
  try
  {
   Directory.CreateDirectory(directory);
   Process.Start(new ProcessStartInfo { FileName = directory, UseShellExecute = true });
   StatusMessage = $"Đã mở thư mục {label}: {directory}";
   AppLogger.Info($"Opened {label} folder: {directory}");
  }
  catch (Exception ex)
  {
   AppLogger.Error($"Open {label} folder failed", ex);
   MessageBox.Show(ex.Message, $"Open {label} folder error");
  }
 }

 void CopySymbol(CoinDisplayItem? item)
 {
  if (item is null) return;
  Clipboard.SetText(item.Symbol);
  StatusMessage = "Đã copy symbol: " + item.Symbol;
 }

 void OpenTradingView(CoinDisplayItem? item)
 {
  var symbol = TradableSymbol(item);
  if (symbol.Length == 0) return;
  OpenUrl($"https://www.tradingview.com/chart/?symbol=BINANCE:{Uri.EscapeDataString(symbol)}USDT");
 }

 void OpenBinance(CoinDisplayItem? item)
 {
  var symbol = TradableSymbol(item);
  if (symbol.Length == 0) return;
  OpenUrl($"https://www.binance.com/en/trade/{Uri.EscapeDataString(symbol)}_USDT?type=spot");
 }

 void OpenCoinGecko(CoinDisplayItem? item)
 {
  if (item is null || string.IsNullOrWhiteSpace(item.Id)) return;
  OpenUrl($"https://www.coingecko.com/en/coins/{Uri.EscapeDataString(item.Id)}");
 }

 void OpenUrl(string url)
 {
  Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
  AppLogger.Info("Opened external URL: " + url);
 }

 static string TradableSymbol(CoinDisplayItem? item)
 {
  if (item is null) return "";
  var symbol = new string(item.Symbol.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
  return symbol.Length == 0 ? "" : symbol;
 }

 void ClearResults()
 {
  _rawResults.Clear();
  DisplayResults.Clear();
  SelectedCoin = null;
  ScannedCount = 0;
  Progress = 0;
  ProgressCurrent = 0;
  ProgressTotal = 0;
  ProgressStage = "Starting";
  StatusMessage = "Đang chuẩn bị quét...";
  _lastScanMetadata = null;
  RefreshFilter();
  RaiseSummary();
  RaiseCommandState();
 }

 void UpdateProgress(double percent, string message)
 {
  Progress = percent;
  StatusMessage = message;
  ParseProgress(message);
  Raise(nameof(ProgressDetail));
 }

 void ParseProgress(string message)
 {
  if (message.Contains("CoinGecko", StringComparison.OrdinalIgnoreCase))
  {
   ProgressStage = "CoinGecko";
   ProgressCurrent = 0;
   ProgressTotal = 0;
  }
  else if (message.Contains("Binance", StringComparison.OrdinalIgnoreCase))
  {
   ProgressStage = "Binance";
   ProgressCurrent = 0;
   ProgressTotal = 0;
  }
  else if (message.Contains("Phân tích", StringComparison.OrdinalIgnoreCase))
  {
   ProgressStage = "Technical";
   var start = message.LastIndexOf('(');
   var slash = message.LastIndexOf('/');
   var end = message.LastIndexOf(')');
   if (start >= 0 && slash > start && end > slash && int.TryParse(message[(start + 1)..slash], out var current) && int.TryParse(message[(slash + 1)..end], out var total))
   {
    ProgressCurrent = current;
    ProgressTotal = total;
   }
  }
  else if (message.Contains("Hoàn tất", StringComparison.OrdinalIgnoreCase))
  {
   ProgressStage = "Completed";
   ProgressCurrent = ProgressTotal;
  }
 }

 bool FilterResult(object item)
 {
  if (item is not CoinDisplayItem coin) return false;
  return MatchesSearch(coin) && MatchesStatus(coin);
 }

 bool MatchesSearch(CoinDisplayItem coin)
 {
  if (string.IsNullOrWhiteSpace(SearchText)) return true;
  var text = SearchText.Trim();
  return coin.Symbol.Contains(text, StringComparison.OrdinalIgnoreCase)
   || coin.Name.Contains(text, StringComparison.OrdinalIgnoreCase)
   || coin.Category.Contains(text, StringComparison.OrdinalIgnoreCase)
   || coin.Setup.Contains(text, StringComparison.OrdinalIgnoreCase);
 }

 bool MatchesStatus(CoinDisplayItem coin) => StatusFilter switch
 {
  "PRIORITY" => coin.Status == "WATCHLIST_PRIORITY",
  "WATCH" => coin.Status == "WATCHLIST",
  "REJECT" => coin.Status == "REJECT",
  "BUY" => coin.Status == "BUY_READY",
  "DATA" => coin.Status == "NEEDS_DATA",
  _ => true
 };

 void RefreshFilter()
 {
  ResultsView.Refresh();
  if (SelectedCoin is not null && !ResultsView.Contains(SelectedCoin))
  {
   SelectedCoin = ResultsView.Cast<CoinDisplayItem>().FirstOrDefault();
  }

  Raise(nameof(FilteredCount));
  RaiseStates();
 }

 void RaiseSummary()
 {
  Raise(nameof(PassedCount));
  Raise(nameof(BuyReadyCount));
  Raise(nameof(PriorityCount));
  Raise(nameof(WatchlistCount));
  Raise(nameof(RejectCount));
  Raise(nameof(BreakdownSummary));
  Raise(nameof(UpdatedAt));
  RefreshFilter();
 }

 void RaiseStates()
 {
  Raise(nameof(IsBusy));
  Raise(nameof(CanScan));
  Raise(nameof(CanCancel));
  Raise(nameof(CanExport));
  Raise(nameof(CanBacktest));
  Raise(nameof(HasResults));
  Raise(nameof(HasVisibleResults));
  Raise(nameof(ShowInitialState));
  Raise(nameof(ShowNoResultsState));
  Raise(nameof(ShowErrorState));
 }

 void RaiseCommandState()
 {
  Raise(nameof(IsBusy));
  Raise(nameof(CanScan));
  Raise(nameof(CanCancel));
  Raise(nameof(CanExport));
  Raise(nameof(CanBacktest));
  RaiseStates();
  RefreshCommands();
 }

 void RefreshCommands()
 {
  ScanCommand.RaiseCanExecuteChanged();
  CancelCommand.RaiseCanExecuteChanged();
  ExportCommand.RaiseCanExecuteChanged();
  BacktestCommand.RaiseCanExecuteChanged();
  CopySymbolCommand.RaiseCanExecuteChanged();
  OpenTradingViewCommand.RaiseCanExecuteChanged();
  OpenBinanceCommand.RaiseCanExecuteChanged();
  OpenCoinGeckoCommand.RaiseCanExecuteChanged();
 }
}
