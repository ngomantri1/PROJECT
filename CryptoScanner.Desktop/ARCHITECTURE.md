# ARCHITECTURE

## Cấu trúc hiện tại
```text
CryptoScannerDesktopV1.sln
├── CryptoScanner.Desktop/
│   ├── App.xaml(.cs)
│   ├── MainWindow.xaml(.cs)
│   ├── Helpers/
│   │   ├── ObservableObject.cs
│   │   ├── RelayCommand.cs
│   │   └── AsyncRelayCommand.cs
│   ├── Models/
│   │   ├── CoinMarket.cs
│   │   ├── BinanceModels.cs
│   │   └── ScanResult.cs
│   ├── Services/
│   │   ├── CoinGeckoClient.cs
│   │   ├── BinanceClient.cs
│   │   ├── TechnicalAnalysisService.cs
│   │   ├── ScannerService.cs
│   │   └── ExportService.cs
│   └── ViewModels/
│       ├── MainViewModel.cs
│       └── CoinDisplayItem.cs
├── README.md
└── CODEX_TASKS.md
```

## Module chính

### UI layer
- `App.xaml`: resource/theme toàn ứng dụng.
- `MainWindow.xaml`: dashboard, nút lệnh, summary cards, DataGrid và progress bar.
- `MainWindow.xaml.cs`: chỉ khởi tạo ViewModel làm `DataContext`.

### Presentation/MVVM
- `MainViewModel.cs`: điều phối scan/cancel/export; giữ trạng thái UI và collection kết quả.
- `CoinDisplayItem.cs`: display wrapper giữ reference tới `ScanResult` gốc, chỉ phục vụ format/binding UI.
- `ObservableObject.cs`: triển khai `INotifyPropertyChanged`.
- `RelayCommand.cs`: command đồng bộ cho thao tác nhanh như mở folder/copy/mở link.
- `AsyncRelayCommand.cs`: command async cho scan/export, chống chạy song song và có fallback exception handler.

### Data models
- `CoinMarket.cs`: DTO CoinGecko.
- `BinanceModels.cs`: DTO ticker Binance và parse quote volume.
- `ScanResult.cs`: model kết quả hiển thị và export.

### Infrastructure/API
- `CoinGeckoClient.cs`: REST client lấy danh sách market.
- `BinanceClient.cs`: REST client lấy ticker và close prices từ klines.
- Các client hiện tự tạo `HttpClient`, chưa có DI, retry, timeout policy hoặc cache.

### Domain/application services
- `TechnicalAnalysisService.cs`: RSI, EMA, phát hiện setup sơ bộ.
- `ScannerService.cs`: orchestration, filter, symbol matching, scoring, ranking, BTC regime.
- `ExportService.cs`: xuất `market_snapshot_*.json` và `scanner_log_*.json` vào `%LOCALAPPDATA%\CryptoScanner.Desktop\exports`.

## Dependency hiện tại
```text
MainWindow
  -> MainViewModel
      -> ScannerService
          -> CoinGeckoClient
          -> BinanceClient
          -> TechnicalAnalysisService
          -> Models
      -> ExportService
      -> ScanResult
```

UI không gọi API trực tiếp. Tuy nhiên dependency đang được `new` trực tiếp nên khó mock/test.

## File phụ trách gì
- `MainViewModel`: trạng thái phiên quét và lệnh UI.
- `ScannerService`: toàn bộ pipeline scan và scoring V1.
- `CoinGeckoClient`: universe market đầu vào.
- `BinanceClient`: xác nhận pair, volume và candles.
- `TechnicalAnalysisService`: chỉ báo kỹ thuật.
- `ExportService`: snapshot JSON.
- `ScanResult`: contract chính giữa scanner, UI và export.

## Data flow
```text
CoinGecko /coins/markets
  -> List<CoinMarket>
  -> hard filters
  -> Binance ticker match
  -> Binance H4 + D1 closes
  -> indicators/setup
  -> score/status/data quality
  -> List<ScanResult>
  -> ObservableCollection
  -> DataGrid
  -> JSON export
```

## REST packet flow

### CoinGecko
```text
GET /api/v3/coins/markets
  ?vs_currency=usd
  &order=market_cap_desc
  &per_page=250
  &page=1..5
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
-> lấy phần tử index 4 (close)
-> List<decimal>
```

## WebSocket packet flow
- Không tồn tại trong V1.
- Không có subscribe/unsubscribe, heartbeat, reconnect hoặc packet dispatcher.
- Tên mục này được giữ để AI coding không nhầm REST polling với realtime stream.

## UI update flow
```text
Button Command
 -> MainViewModel.ScanAsync
 -> Progress<(double,string)>
 -> ScannerService.ScanAsync
 -> progress.Report(...)
 -> UI SynchronizationContext
 -> Progress + StatusMessage bindings

Scan complete
 -> foreach result -> ObservableCollection.Add
 -> DataGrid refresh
 -> Raise summary properties
```

## OCR/canvas flow
- Không có OCR, image processing, browser canvas hoặc screenshot flow trong project.
- Không thêm dependency OCR/canvas nếu không có use case mới.

## Kiến trúc đích đề xuất
Khi mở rộng, tách thành project/layer hoặc ít nhất folder rõ ràng:
```text
Desktop/UI
Application/Scanner
Core/Rules + Models + Interfaces
Infrastructure/API + Persistence + Logging
Tests
```
Ưu tiên interface hóa API clients và settings trước khi tách solution lớn.
