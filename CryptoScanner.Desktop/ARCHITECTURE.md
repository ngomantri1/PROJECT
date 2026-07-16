# ARCHITECTURE

## Cấu trúc project hiện tại

```text
CryptoScanner.Desktop/
├── App.xaml(.cs)
├── MainWindow.xaml(.cs)
├── config/
│   ├── scanner-settings.json
│   └── unlock-cache.example.json
├── Helpers/
│   ├── ObservableObject.cs
│   ├── RelayCommand.cs
│   ├── AsyncRelayCommand.cs
│   └── BoolToVisibilityConverter.cs
├── Models/
│   ├── AppHealthSummary.cs
│   ├── BacktestModels.cs
│   ├── BinanceModels.cs
│   ├── CoinMarket.cs
│   ├── HistoryIndexDocument.cs
│   ├── HistoryIndexEntry.cs
│   ├── HistorySaveResult.cs
│   ├── ScannerSettings.cs
│   ├── ScanPipelineMetrics.cs
│   ├── ScanResult.cs
│   ├── ScanSessionMetadata.cs
│   └── UnlockModels.cs
├── Services/
│   ├── AppHealthService.cs
│   ├── AppLogger.cs
│   ├── BacktestMetricsService.cs
│   ├── BacktestService.cs
│   ├── BinanceClient.cs
│   ├── CachedUnlockProvider.cs
│   ├── CoinGeckoClient.cs
│   ├── ExportService.cs
│   ├── HistoricalPriceProvider.cs
│   ├── HistoryReader.cs
│   ├── HistoryService.cs
│   ├── ScannerService.cs
│   ├── TechnicalAnalysisService.cs
│   └── UnlockRuleEvaluator.cs
└── ViewModels/
    ├── MainViewModel.cs
    └── CoinDisplayItem.cs
```

## Module chính

### UI layer

- `App.xaml`: theme/resource toàn app. Đang chứa style Button, TextBox, ComboBox, DataGrid, DataGridColumnHeader, DataGridCell.
- `MainWindow.xaml`: dashboard, toolbar, health dashboard, search/filter, DataGrid, detail panel, progress/status bar.
- `MainWindow.xaml.cs`: chỉ khởi tạo `MainViewModel` làm `DataContext`.

### Presentation/MVVM

- `MainViewModel.cs`: điều phối scan/cancel/export/backtest/open folder, giữ trạng thái UI, collection kết quả, filter/search, selected coin và health summary.
- `CoinDisplayItem.cs`: display wrapper giữ reference tới `ScanResult` gốc. Chỉ phục vụ binding/format UI.
- `ObservableObject.cs`: `INotifyPropertyChanged`.
- `RelayCommand.cs`: command đồng bộ.
- `AsyncRelayCommand.cs`: command async, chống chạy song song và log unhandled exception.

### Data models

- `ScanResult.cs`: contract chính giữa scanner, export, UI và backtest.
- `CoinMarket.cs`: DTO CoinGecko.
- `BinanceModels.cs`: DTO Binance ticker/klines.
- `ScannerSettings.cs`: cấu hình filter/profile/rule.
- `ScanSessionMetadata.cs`: metadata scan, timing, pipeline, unlock cache.
- `UnlockModels.cs`: cache item, status, summary unlock.
- `BacktestModels.cs`: backtest result/horizon/summary.
- `HistoryIndexDocument.cs`, `HistoryIndexEntry.cs`, `HistorySaveResult.cs`: history index.
- `AppHealthSummary.cs`: DTO đọc health cho UI.

### Infrastructure/API

- `CoinGeckoClient.cs`: REST client lấy market universe.
- `BinanceClient.cs`: REST client lấy ticker, candles, historical prices.
- `AppLogger.cs`: ghi log local vào `%LOCALAPPDATA%\CryptoScanner.Desktop\logs`.
- Chưa có DI/IHttpClientFactory.
- Chưa có retry/backoff đầy đủ.

### Domain/Application services

- `ScannerService.cs`: orchestration chính, filter, candidate ranking, technical analysis, unlock rule, scoring, decision, risk flags.
- `TechnicalAnalysisService.cs`: RSI/EMA/MACD/setup.
- `CachedUnlockProvider.cs`: đọc `%LOCALAPPDATA%\CryptoScanner.Desktop\data\unlock-cache.json`.
- `UnlockRuleEvaluator.cs`: đánh giá unlock PASS/WARN/FAIL theo ngưỡng.
- `ExportService.cs`: xuất `market_snapshot_*.json`, `scanner_log_*.json`, lưu history khi được yêu cầu.
- `HistoryService.cs`: lưu snapshot/log vào history và cập nhật `history_index.json`.
- `HistoryReader.cs`: đọc history cho backtest.
- `HistoricalPriceProvider.cs`: lấy giá historical để backtest.
- `BacktestService.cs`: chạy backtest foundation và xuất `backtest_results_*.json`.
- `BacktestMetricsService.cs`: tính metrics từ kết quả completed.
- `AppHealthService.cs`: đọc scanner log, backtest result, history index để tạo mini health dashboard.

## Dependency hiện tại

```text
MainWindow
  -> MainViewModel
      -> ScannerService
          -> CoinGeckoClient
          -> BinanceClient
          -> TechnicalAnalysisService
          -> CachedUnlockProvider
          -> UnlockRuleEvaluator
          -> ScannerSettings
      -> ExportService
          -> HistoryService
      -> BacktestService
          -> HistoryReader
          -> HistoricalPriceProvider
          -> BacktestMetricsService
      -> AppHealthService
          -> scanner_log_*.json
          -> backtest_results_*.json
          -> history_index.json
      -> CoinDisplayItem
```

UI không gọi API trực tiếp. Dependency vẫn được `new` trực tiếp, chưa có DI nên test/mocking còn hạn chế.

## Data flow scan

```text
CoinGecko /coins/markets
  -> List<CoinMarket>
  -> hard filters
  -> Binance ticker match
  -> pre-technical ranking
  -> top technical candidates
  -> Binance H4/D1 candles
  -> technical indicators/setup
  -> CachedUnlockProvider
  -> UnlockRuleEvaluator
  -> score/status/decision/risk/rules
  -> List<ScanResult>
  -> CoinDisplayItem collection
  -> DataGrid + detail panel
  -> ExportService
  -> market_snapshot + scanner_log + history
```

## Export flow

```text
Scan complete
  -> ExportService.ExportAsync(saveHistory: true)
  -> exports\market_snapshot_*.json
  -> exports\scanner_log_*.json
  -> history\yyyy-MM-dd\...
  -> history\history_index.json

Manual export
  -> ExportService.ExportAsync(saveHistory: false)
  -> exports\market_snapshot_*.json
  -> exports\scanner_log_*.json
  -> no duplicate history entry
```

## Backtest flow

```text
BACKTEST command
  -> BacktestService.RunAsync
  -> HistoryReader reads history_index.json
  -> load each historical snapshot
  -> evaluate 7D/14D/30D horizons
  -> if target time not reached: PENDING
  -> if enough age: fetch historical price
  -> output backtest_results_*.json
```

Backtest không sửa snapshot cũ.

## Health Dashboard flow

```text
App start / scan completed / export completed / backtest completed
  -> MainViewModel.RefreshHealthAsync
  -> AppHealthService.LoadAsync
      -> latest valid scanner_log_*.json
      -> latest valid backtest_results_*.json
      -> history_index.json
  -> AppHealthSummary
  -> UI binding
```

Nguyên tắc:

- Không dùng `FileSystemWatcher` ở V1.8.
- Đọc file async.
- File hỏng hoặc thiếu trả `NO_DATA`/`READ_ERROR`, không crash UI.
- `Completed` backtest phải đếm trực tiếp từ horizon status, không lấy từ `group_summaries`.
- `Retention` chỉ hiển thị nếu có dữ liệu, nếu không là `--`.

## REST packet flow

### CoinGecko

```text
GET /api/v3/coins/markets
  ?vs_currency=usd
  &order=market_cap_desc
  &per_page=250
  &page=1..n
  &sparkline=false
-> JSON array
-> CoinMarket
```

### Binance ticker

```text
GET /api/v3/ticker/24hr
-> JSON array
-> BinanceTicker
-> Dictionary<symbol, ticker>
```

### Binance candles

```text
GET /api/v3/klines?symbol={PAIR}&interval={4h|1d}&limit=220
-> JSON arrays
-> close at index 4
-> List<decimal>
```

## WebSocket packet flow

- Không có WebSocket trong project hiện tại.
- Không có subscribe/unsubscribe, heartbeat, reconnect hoặc packet dispatcher.
- Nếu sau này thêm realtime thì phải tách service riêng.

## UI update flow

```text
Button Command
 -> MainViewModel async command
 -> service async workflow
 -> Progress<(double,string)>
 -> UI SynchronizationContext
 -> bound properties

Scan complete
 -> raw List<ScanResult>
 -> DisplayResults: ObservableCollection<CoinDisplayItem>
 -> ICollectionView filter/search
 -> DataGrid + detail panel
```

## OCR/canvas flow

- Không có OCR.
- Không có canvas.
- Không có screenshot/image processing flow.

## Kiến trúc đích đề xuất

Khi mở rộng:

```text
Desktop/UI
Application/Scanner
Application/Backtest
Core/Rules + Models + Interfaces
Infrastructure/API + Cache + Persistence + Logging
Tests
```

Ưu tiên refactor:

- Interface hóa clients/services.
- DI cho settings/client/service.
- Tách filter/scoring/decision khỏi `ScannerService`.
- Thêm test project cho rule/backtest/health reader.
