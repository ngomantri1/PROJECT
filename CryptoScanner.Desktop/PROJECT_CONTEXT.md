# PROJECT_CONTEXT

## Tổng quan

Crypto Scanner Desktop V1 là ứng dụng Windows dùng để quét và sàng lọc altcoin Spot. Ứng dụng lấy dữ liệu từ CoinGecko và Binance, lọc coin, phân tích kỹ thuật cơ bản, chấm điểm, hiển thị kết quả trên WPF và xuất JSON để ChatGPT đọc tiếp.

Ứng dụng **không phải bot giao dịch**:

- Không tự mua bán.
- Không Futures.
- Không Margin.
- Không đặt lệnh.
- Không dùng private exchange API key.
- Không coi kết quả scanner là khuyến nghị đầu tư hoàn chỉnh.

Mục tiêu hiện tại là công cụ pre-screen hằng ngày: bấm **QUÉT THỊ TRƯỜNG**, có danh sách candidate, có `market_snapshot_*.json`, `scanner_log_*.json`, history và backtest foundation.

## Công nghệ

- C# / .NET 8 WPF (`net8.0-windows`).
- WPF.
- MVVM tối giản tự viết.
- `HttpClient`.
- `System.Text.Json`.
- `ObservableCollection<T>` + `INotifyPropertyChanged`.
- AppData Local để lưu export/log/history/backtest/cache.
- Chưa có SQLite.
- Chưa có chart.
- Chưa có OpenAI API trong app.

## Thư mục dữ liệu runtime

Ứng dụng lưu dữ liệu local tại:

```text
C:\Users\Admin\AppData\Local\CryptoScanner.Desktop
```

Các thư mục quan trọng:

```text
exports\    market_snapshot_*.json, scanner_log_*.json
logs\       log runtime theo ngày, ví dụ 20260715.log
history\    history_index.json và snapshot/log theo ngày
backtests\  backtest_results_*.json
data\       unlock-cache.json nếu người dùng tự cung cấp
```

File unlock cache thật nếu có phải nằm tại:

```text
C:\Users\Admin\AppData\Local\CryptoScanner.Desktop\data\unlock-cache.json
```

File `config\unlock-cache.example.json` trong project chỉ là file mẫu. App không tự đọc file mẫu này khi chạy.

## Flow hoạt động chính

1. Người dùng bấm **QUÉT THỊ TRƯỜNG**.
2. `MainViewModel` tạo `CancellationTokenSource` và gọi `ScannerService.ScanAsync`.
3. `CoinGeckoClient` lấy market list.
4. `ScannerService` lọc theo market cap, volume, FDV/MC và circulating ratio.
5. `BinanceClient` xác nhận cặp spot `{SYMBOL}USDT`.
6. Scanner rank candidate trước technical, rồi lấy tối đa candidate theo profile hiện tại.
7. Với mỗi candidate, app lấy nến H4/D1 từ Binance.
8. `TechnicalAnalysisService` tính RSI/EMA/MACD sơ bộ và setup.
9. `CachedUnlockProvider` đọc `unlock-cache.json` nếu tồn tại.
10. `UnlockRuleEvaluator` áp rule PASS/WARN/FAIL nếu có dữ liệu unlock.
11. `ScannerService` tạo `ScanResult`, chấm điểm, status, decision code, risk flags và rule lists.
12. `MainViewModel` map `ScanResult` sang `CoinDisplayItem` để hiển thị.
13. `ExportService` tự lưu snapshot/history khi scan hoàn tất.
14. Người dùng có thể bấm **XUẤT JSON** để export thủ công.
15. Người dùng có thể bấm **BACKTEST** để chạy backtest foundation.
16. `AppHealthService` đọc các file đã sinh và cập nhật mini health dashboard.

## Cached Unlock Provider

V1.7 hiện là **Cached Unlock Provider**.

Điều đúng cần hiểu:

- App chỉ đọc `unlock-cache.json` nếu người dùng đặt sẵn trong AppData Local.
- App không tự tải dữ liệu unlock từ internet.
- App không tự sinh dữ liệu unlock thật khi quét.
- Nếu không có file, scanner vẫn chạy bình thường và ghi `CACHE_MISSING`.
- Nếu có file hợp lệ, scanner match theo `coin_id`, fallback theo `symbol`.
- Coin match được sẽ có `UnlockStatus`, `Unlock30dPct`, `Unlock90dPct`, rule unlock và data quality tốt hơn.

Không được dùng file unlock test/fake để ra quyết định đầu tư thật.

## Export và History

Mỗi scan hoàn tất sẽ sinh:

- `market_snapshot_*.json`
- `scanner_log_*.json`
- history entry trong `history_index.json`

Manual export có thể sinh thêm một cặp `market_snapshot/scanner_log`, nhưng không được tạo duplicate history nếu không phải scan mới.

Backtest đọc history snapshot, không sửa snapshot cũ và xuất riêng `backtest_results_*.json`.

## UI hiện tại

UI đã refactor theo V1.2/V1.8:

- Dashboard cards.
- Mini Health Dashboard: Scanner / Backtest / History.
- DataGrid gọn.
- Search box.
- Status filter.
- Detail panel bên phải.
- Status badge.
- Score bar.
- Progress bar.
- Nút **MỞ EXPORT**.
- Không còn nút **MỞ LOG**.
- Nút **BACKTEST** chỉ chạy backtest, không mở thư mục riêng.

Các style WPF quan trọng đã sửa:

- Button disabled không còn nền trắng chữ trắng.
- TextBox/ComboBox dùng nền tối.
- DataGrid header có viền đủ 4 cạnh.
- Cột `Reason` giãn hết chiều ngang còn lại.

## Coding rules

- Giữ file UTF-8, không chuyển encoding sang dạng khác.
- Bật nullable; không dùng null-forgiving `!` để che lỗi nếu chưa chứng minh an toàn.
- API call phải hỗ trợ `CancellationToken`.
- Không block UI thread bằng `.Result`, `.Wait()` hoặc I/O đồng bộ trong luồng UI.
- Không nuốt exception. Lỗi phải được log hoặc phản ánh bằng trạng thái rõ ràng.
- Không đưa logic quét, HTTP, scoring vào code-behind.
- Code-behind chỉ khởi tạo UI/DataContext.
- ViewModel điều phối UI command và binding.
- UI dùng `CoinDisplayItem`/display wrapper, không format trực tiếp từ export schema.
- Export không được đọc display-formatted properties.
- Không thay đổi scanner/scoring/export schema khi đang làm UI.
- Không hard-code ngưỡng mới trong UI.
- Dữ liệu thiếu phải là `UNKNOWN`, không tự coi là `PASS`.

## Naming rules

- Class, property, method: `PascalCase`.
- Private field: `_camelCase`.
- Local variable/parameter: `camelCase`.
- Async method có hậu tố `Async`.
- Interface mới dùng tiền tố `I`.
- Status/rule/decision code nên dần chuyển khỏi magic string khi refactor.
- Tên file trùng tên class chính.

## Rule nghiệp vụ quan trọng

- Market cap mặc định: 100M-900M USD.
- Total volume mặc định: >=10M USD.
- FDV/MC mặc định: <=3 khi có đủ dữ liệu.
- Circulating ratio mặc định: >=40% khi có đủ dữ liệu.
- Binance pair hiện giả định `{CoinGeckoSymbol}USDT`, vẫn là rủi ro cần cải thiện.
- Không có dữ liệu unlock/news/github/tvl không có nghĩa là coin an toàn.
- `BUY_READY` phải rất thận trọng; hiện đa số coin là `WATCHLIST`, `WATCHLIST_PRIORITY` hoặc `REJECT`.
- `FinalScore` là field tương lai; không được giả lập nếu thiếu dữ liệu nguồn.

## WebSocket flow

- Hiện không có WebSocket.
- Toàn bộ dữ liệu lấy bằng REST khi người dùng bấm quét.
- Không tự thêm WebSocket nếu chưa có yêu cầu rõ ràng.
- Nếu bổ sung sau này phải tách service, có reconnect/backoff/cancellation và không update UI trực tiếp từ background thread.

## Pending flow

- Một lần chỉ nên có một phiên scan/backtest.
- `AsyncRelayCommand` và trạng thái `IsBusy` chặn chạy song song.
- Hủy scan/backtest dùng `CancellationTokenSource`.
- Backtest horizon chưa đủ tuổi phải là `PENDING`, không được dùng giá hiện tại để giả lập kết quả.

## Threading/UI rules

- Network/CPU workflow chạy async.
- `Progress<T>` tạo trên UI thread để callback update binding đúng context.
- `ObservableCollection` chỉ thay đổi trên UI thread.
- Service/core không gọi `MessageBox`.
- Bound property không update trực tiếp từ thread nền nếu chưa dispatch.
- Sau thành công/thất bại/hủy phải reset state và refresh command state.
- Health dashboard refresh không được ném exception lên UI.

## Điều tuyệt đối không được phá

- Không biến app thành bot auto trade.
- Không lưu private API key/secret vào source control.
- Không coi lỗi/thiếu dữ liệu là coin đạt tiêu chí.
- Không xóa cancellation support.
- Không chạy HTTP/network đồng bộ trên UI thread.
- Không gộp API client, scanner engine và UI vào một class.
- Không đổi schema export mà không version hóa và cập nhật tài liệu.
- Không để manual export tạo duplicate history.
- Không sửa scanner/scoring khi task chỉ là UI.
- Không để export phụ thuộc vào display wrapper.
