# BUGS

## Bug hiện tại / rủi ro đã xác định

### 1. Mapping CoinGecko symbol -> Binance pair chưa an toàn

- **Trạng thái:** Chưa fix hoàn toàn.
- **Vị trí:** `ScannerService`, logic tạo `{SYMBOL}USDT`.
- **Nguyên nhân:** Symbol không phải định danh duy nhất; có ticker trùng hoặc tên khác trên sàn.
- **Hậu quả:** Có thể ghép nhầm asset hoặc bỏ sót coin.
- **Workaround:** Scanner đã có một số rule manual review/non-standard symbol, nhưng vẫn cần kiểm tra top coin thủ công.
- **Fix cần làm:** Mapping theo CoinGecko ID, exchange metadata, contract/network nếu có.

### 2. Timeout/retry/cache API chưa đủ mạnh

- **Trạng thái:** Đã giảm rủi ro ở V1.10 cho CoinGecko markets; vẫn cần mở rộng/kiểm thử thêm.
- **Vị trí:** `CoinGeckoClient`, `BinanceClient`.
- **Nguyên nhân:** Public API có rate limit/lỗi tạm thời; chưa có retry/backoff chuẩn. Test V1.9 ghi nhận CoinGecko trả `429 Too Many Requests` và có lúc đóng connection giữa chừng khi bấm scan liên tục.
- **Hậu quả:** Scan có thể thất bại nếu API tiếp tục lỗi sau retry.
- **Workaround:** Chạy lại scan; xem runtime log và scanner log.
- **Đã làm:** Popup ngắn, không hiện stack trace, log kỹ thuật chi tiết, retry/backoff giới hạn, timeout, giữ kết quả cũ khi scan lỗi.
- **Fix cần làm tiếp:** Test cancel trong lúc retry, mở rộng sang Binance/backtest path nếu cần, cân nhắc cache dữ liệu hợp lý.

### 3. Scoring/setup còn là pre-screen

- **Trạng thái:** Chưa fix hoàn toàn.
- **Vị trí:** `ScannerService`, `TechnicalAnalysisService`.
- **Nguyên nhân:** Công thức vẫn đơn giản, breakout fields phần lớn là framework/future.
- **Hậu quả:** `WATCHLIST_PRIORITY` không đồng nghĩa mua ngay.
- **Workaround:** Dùng ChatGPT/chart kiểm tra lại, đặc biệt khi BTC regime là BEAR.
- **Fix cần làm:** breakout confirmed, retest confirmed, ATR/R:R, volume expansion, BTC regime gating nâng cao.

### 4. Unlock cache không tự sinh

- **Trạng thái:** Không phải bug code, nhưng dễ gây hiểu nhầm. V1.8.1 đã thêm hướng dẫn/cache path; V1.9 đã thêm Manual Unlock Import.
- **Vị trí:** `CachedUnlockProvider`.
- **Nguyên nhân:** V1.7 chỉ là provider đọc cache local, chưa có API/sync engine.
- **Hậu quả:** Nếu không có `unlock-cache.json`, tất cả coin vẫn `UNLOCK_UNKNOWN`, data source là `CACHE_MISSING`.
- **Workaround:** Dùng nút `IMPORT UNLOCK` để nhập file unlock JSON hợp lệ vào `%LOCALAPPDATA%\CryptoScanner.Desktop\data\unlock-cache.json`.
- **Fix/next step:** Nếu cần dữ liệu tự động thì làm provider/API unlock thật ở phiên bản sau, không thuộc V1.9.

### 4.1. File unlock hiện tại là dữ liệu kiểm thử

- **Trạng thái:** Rủi ro vận hành/tài liệu.
- **Vị trí:** `test-data/unlock-import/valid-unlock-cache.json` và cache AppData nếu import từ file này.
- **Nguyên nhân:** File valid hiện dùng để chứng minh pipeline import/cache/provider, không phải dữ liệu unlock thật.
- **Hậu quả:** Có thể hiểu nhầm `LOCAL_CACHE 3/{candidate_count}` là dữ liệu unlock thật.
- **Workaround:** Chỉ dùng file test để nghiệm thu kỹ thuật; không dùng để quyết định đầu tư.
- **Fix cần làm:** V1.11 Real Unlock Data Intake & Normalization: định nghĩa ý nghĩa 30D/90D, nguồn dữ liệu, identity mapping và converter/template dữ liệu thật.

### 5. DataQuality phụ thuộc nguồn dữ liệu còn thiếu

- **Trạng thái:** Đang đúng theo thiết kế hiện tại nhưng chưa hoàn chỉnh.
- **Vị trí:** `ScannerService`.
- **Nguyên nhân:** Unlock/GitHub/TVL/News phần lớn chưa có dữ liệu thật.
- **Hậu quả:** `DataQualityScore` thường thấp hoặc bị giới hạn; `FinalScore` chưa hoạt động đầy đủ.
- **Workaround:** Không dùng DataQuality/FinalScore để giải ngân độc lập.
- **Fix cần làm:** Thêm provider thật và source coverage theo nguồn.

### 6. Build bị khóa khi app đang chạy

- **Trạng thái:** Known operational issue.
- **Vị trí:** `bin\Debug\net8.0-windows\CryptoScanner.Desktop.exe`.
- **Nguyên nhân:** Visual Studio/app đang chạy giữ lock file.
- **Hậu quả:** `dotnet build` báo MSB3021/MSB3027.
- **Workaround:** Dừng app/debug session trước khi build.
- **Fix cần làm:** Không cần fix code; cập nhật thói quen build/test.

### 7. Health Dashboard chưa test đủ các nhánh lỗi file

- **Trạng thái:** Chưa test hết.
- **Vị trí:** `AppHealthService`.
- **Nguyên nhân:** Chưa thử đủ trường hợp missing/corrupt/latest invalid.
- **Hậu quả:** Có thể còn edge case hiển thị `READ_ERROR` chưa đẹp.
- **Workaround:** Nếu UI vẫn mở và log warning thì chấp nhận tạm.
- **Fix cần làm:** Test thiếu file, JSON hỏng, latest file hỏng, history rỗng.

## Bug đã fix

### 1. Thiếu `HttpClient`, `Path`, `Directory`, `File`

- **Trạng thái:** Đã fix.
- **Nguyên nhân:** Thiếu using/reference.
- **Kết quả:** Build baseline chạy được.

### 2. Deserialize Binance `quoteVolume`

- **Trạng thái:** Đã fix.
- **Nguyên nhân:** Binance trả số dạng string/format cần parse đúng.
- **Kết quả:** Không còn lỗi deserialize `HttpClient`/Binance model ban đầu.

### 3. JSON property name conflict trong Binance ticker

- **Trạng thái:** Đã fix.
- **Nguyên nhân:** Model Binance có property JSON trùng tên.
- **Kết quả:** Scan không còn crash khi gọi Binance.

### 4. Async command exception

- **Trạng thái:** Đã fix.
- **Vị trí cũ:** `RelayCommand` dùng async lambda.
- **Fix:** Thêm `AsyncRelayCommand` và chuyển scan/export/backtest sang async command có exception handler.

### 5. Binding ghi vào property read-only `MarketTechnicalScore`

- **Trạng thái:** Đã fix.
- **Nguyên nhân:** Binding mặc định TwoWay/OneWayToSource trên property chỉ đọc trong display item.
- **Fix:** Set binding `Mode=OneWay` cho các field display.

### 6. Binding ghi vào property read-only `LastScanDisplay`

- **Trạng thái:** Đã fix.
- **Nguyên nhân:** `Run.Text` trong Health panel mặc định cố ghi ngược vào property chỉ đọc.
- **Fix:** Set `Mode=OneWay` cho các `Run Text` binding trong Health panel.

### 7. UI nền trắng chữ trắng khi scan

- **Trạng thái:** Đã fix.
- **Nguyên nhân:** WPF default style cho disabled button, TextBox, ComboBox, DataGrid header không theo dark theme.
- **Fix:** Style global trong `App.xaml` cho Button/TextBox/ComboBox/DataGrid header/cell/row.

### 8. Header DataGrid thiếu viền bao

- **Trạng thái:** Đã fix.
- **Nguyên nhân:** `DataGridColumnHeader` chỉ có `BorderThickness="0,0,1,1"`.
- **Fix:** Đổi thành `BorderThickness="1,1,1,1"`.

### 9. Header/DataGrid không phủ hết chiều ngang

- **Trạng thái:** Đã fix.
- **Nguyên nhân:** Cột cuối `Reason` có width cố định, phần trống bên phải không có header.
- **Fix:** Đổi cột `Reason` sang `Width="*"`.

### 10. Nút mở log không cần thiết

- **Trạng thái:** Đã xử lý theo yêu cầu.
- **Fix:** Bỏ nút/lệnh `MỞ LOG`; giữ `MỞ EXPORT`.

## Vùng code dễ lỗi

- `ScannerService.ScanAsync`: orchestration, filter, scoring, decision, unlock rule.
- `TechnicalAnalysisService`: chỉ báo kỹ thuật và index dữ liệu.
- `BinanceClient`: parse ticker/candles/historical price.
- `CachedUnlockProvider`: đọc file local, schema, match coin_id/symbol, expired/invalid.
- `ExportService`: snapshot/log/history và schema compatibility.
- `HistoryService` + `HistoryReader`: duplicate/history index/path.
- `BacktestService`: PENDING/COMPLETED/MISSING/UNSUPPORTED horizon.
- `AppHealthService`: đọc file mới nhất hợp lệ, xử lý file hỏng/thiếu.
- `MainWindow.xaml`: binding mode, dark theme style, DataGrid layout.
- `MainViewModel`: async command state, cancellation, refresh health, collection update.

## Workaround vận hành

- Nếu build bị lock: dừng app trong Visual Studio rồi build lại.
- Nếu unlock báo `CACHE_MISSING`: tạo/copy file `unlock-cache.json` vào AppData Local đúng đường dẫn.
- Nếu UI crash binding: kiểm tra Output/Exception, ưu tiên tìm binding TwoWay vào property chỉ đọc.
- Nếu scan ra ít/khác candidate: kiểm tra scanner log, pipeline counts, unlock cache status và BTC regime.
