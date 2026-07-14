# BUGS

## Bug hiện tại / rủi ro đã xác định

### 1. Exception bị nuốt trong scanner
- **Trạng thái:** Chưa fix.
- **Vị trí:** `ScannerService.ScanAsync`, `catch { }` trong vòng coin và BTC regime.
- **Nguyên nhân:** Bỏ qua lỗi để scan tiếp.
- **Hậu quả:** Coin biến mất không lý do; BTC regime có thể `UNKNOWN` mà không biết nguồn lỗi.
- **Workaround:** Xem tổng kết quả thủ công; chạy debugger.
- **Fix cần làm:** Structured per-source/per-coin error logging và export error summary.

### 2. Mapping CoinGecko symbol → Binance pair không an toàn
- **Trạng thái:** Chưa fix.
- **Vị trí:** `coin.Symbol.ToUpperInvariant() + "USDT"`.
- **Nguyên nhân:** Symbol không phải định danh duy nhất; có ticker trùng hoặc tên khác trên sàn.
- **Hậu quả:** Ghép nhầm asset hoặc bỏ sót coin.
- **Workaround:** Kiểm tra Top coin thủ công.
- **Fix cần làm:** Mapping theo CoinGecko ID, contract/network và exchange metadata.

### 3. Thiếu FDV/supply đang được xử lý quá dễ dãi
- **Trạng thái:** Chưa fix.
- **Vị trí:** hard filters và giá trị mặc định `fdvMc=1`, `circ=0`.
- **Nguyên nhân:** Logic cho phép thiếu dữ liệu đi qua filter FDV/circulating ở một số nhánh.
- **Hậu quả:** Data quality/score có thể gây hiểu nhầm.
- **Workaround:** Không coi kết quả thiếu dữ liệu là BUY.
- **Fix cần làm:** `UNKNOWN`, policy rõ ràng và gating status.

### 4. Async command là `async void` gián tiếp
- **Trạng thái:** Chưa fix.
- **Vị trí:** `new(async _ => await ScanAsync())` với `RelayCommand(Action<object?>)`.
- **Nguyên nhân:** Async lambda chuyển thành `async void`.
- **Hậu quả:** Exception/cancel lifecycle khó kiểm soát; double invocation có thể có race nhỏ trước `_busy` refresh.
- **Workaround:** ViewModel có try/catch và `_busy`.
- **Fix cần làm:** `IAsyncCommand/AsyncRelayCommand`.

### 5. Không có timeout/retry/cache
- **Trạng thái:** Chưa fix.
- **Vị trí:** `CoinGeckoClient`, `BinanceClient`.
- **Nguyên nhân:** HttpClient mặc định và gọi public API trực tiếp.
- **Hậu quả:** Scan chậm, rate-limit, lỗi tạm thời làm mất coin.
- **Workaround:** Chạy lại scan.
- **Fix cần làm:** timeout hợp lý, retry/backoff, 429 handling và cache.

### 6. Scoring và setup có false positive
- **Trạng thái:** Chưa fix.
- **Vị trí:** `ScannerService`, `TechnicalAnalysisService.DetectSetup`.
- **Nguyên nhân:** Công thức đơn giản; `EARLY_REVERSAL` chỉ kiểm tra RSI<40 và close hiện tại > close 4 nến trước.
- **Hậu quả:** Trạng thái `BUY READY` chưa đáng tin.
- **Workaround:** Chỉ xem là pre-screen, xác minh bằng ChatGPT/chart.
- **Fix cần làm:** volume, structure break, divergence thật, ATR/R:R, BTC regime gating.

### 7. `DataQuality` không phản ánh đủ nguồn
- **Trạng thái:** Chưa fix.
- **Vị trí:** `ScannerService`.
- **Nguyên nhân:** Công thức cố định, Binance mặc nhiên cộng điểm; chưa có unlock/news/on-chain.
- **Hậu quả:** Giá trị có thể cao giả tạo.
- **Workaround:** Không dùng DataQuality để giải ngân.
- **Fix cần làm:** tính theo ma trận nguồn và trạng thái PASS/UNKNOWN/CONFLICT.

### 8. DataGrid summary có thể chưa cập nhật tức thời trong lúc thêm item
- **Trạng thái:** Chưa fix/ảnh hưởng thấp.
- **Vị trí:** `PassedCount`, `BuyReadyCount` chỉ Raise sau khi load xong.
- **Nguyên nhân:** Derived properties không subscribe collection change.
- **Hậu quả:** Card chỉ cập nhật cuối scan, không realtime.
- **Workaround:** Chờ scan hoàn tất.
- **Fix cần làm:** Raise khi collection thay đổi hoặc bind collection view/statistics model.

## Bug đã fix
- Chưa có changelog hoặc bằng chứng source về bug đã fix trước đó.

## Vùng code dễ lỗi
- `ScannerService.ScanAsync`: orchestration, filter, scoring, exception handling.
- `TechnicalAnalysisService`: công thức chỉ báo và index dữ liệu.
- `BinanceClient.GetClosesAsync`: phụ thuộc cấu trúc mảng JSON và parse string.
- Symbol matching giữa CoinGecko và Binance.
- Async command/cancellation trong `MainViewModel`.
- Export schema khi bổ sung field mới.
