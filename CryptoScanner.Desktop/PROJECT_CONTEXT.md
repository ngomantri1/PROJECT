# PROJECT_CONTEXT

## Tổng quan
Crypto Scanner Desktop V1 là ứng dụng Windows dùng để quét và sàng lọc altcoin Spot. Ứng dụng lấy dữ liệu thị trường từ CoinGecko và Binance, áp dụng bộ lọc cứng, tính một số chỉ báo kỹ thuật cơ bản, chấm điểm sơ bộ, hiển thị kết quả trên giao diện WPF và xuất snapshot JSON cho ChatGPT phân tích sâu.

Ứng dụng **không tự giao dịch**, không đặt lệnh, không quản lý API key sàn và không được xem kết quả V1 là khuyến nghị đầu tư hoàn chỉnh.

## Công nghệ
- C# / .NET 10 (`net10.0-windows`)
- WPF
- MVVM tối giản tự viết
- `HttpClient`
- `System.Text.Json`
- `ObservableCollection<T>` + `INotifyPropertyChanged`
- Không có NuGet ngoài ở V1
- Chưa có database, dependency injection, logging framework hoặc test project

## Flow hoạt động chính
1. Người dùng bấm **QUÉT THỊ TRƯỜNG**.
2. `MainViewModel` tạo `CancellationTokenSource` và gọi `ScannerService.ScanAsync`.
3. `CoinGeckoClient` lấy tối đa 5 trang, 250 coin/trang.
4. `ScannerService` lọc theo market cap, volume, FDV/MC và circulating ratio.
5. `BinanceClient` lấy ticker 24h và giữ coin có cặp `{SYMBOL}USDT`.
6. Với tối đa 45 coin, ứng dụng lấy nến H4 và D1.
7. `TechnicalAnalysisService` tính RSI, EMA và phân loại setup.
8. `ScannerService` chấm điểm, xếp hạng và xác định `BUY READY/WATCHLIST/REJECT`.
9. `MainViewModel` cập nhật `ObservableCollection` trên UI thread.
10. Người dùng có thể xuất `market_snapshot_*.json` qua `ExportService`.

## Coding rules
- Bật nullable; không thêm null-forgiving `!` để che lỗi nếu chưa chứng minh an toàn.
- Mọi API call phải hỗ trợ `CancellationToken`.
- Không block UI thread bằng `.Result`, `.Wait()` hoặc I/O đồng bộ.
- Không nuốt exception. Lỗi phải được log hoặc trả về trạng thái dữ liệu rõ ràng.
- Tách API client, business rules, technical analysis và UI state.
- Không đặt logic quét hoặc HTTP trực tiếp trong code-behind.
- Không hard-code ngưỡng mới trong ViewModel/UI; chuyển dần sang cấu hình.
- Dữ liệu thiếu phải là `UNKNOWN`, không tự động coi là `PASS`.
- Chỉ serialize DTO/snapshot cần thiết; không xuất raw candles nếu không cần.

## Naming rules
- Class, property, method: `PascalCase`.
- Private field: `_camelCase`.
- Local variable/parameter: `camelCase`.
- Async method phải có hậu tố `Async`.
- Interface mới dùng tiền tố `I`.
- Enum/status phải dùng type rõ ràng khi refactor; tránh lan truyền magic string.
- Tên file trùng tên class chính.

## Rule nghiệp vụ quan trọng
- Market cap mặc định: 100M–900M USD.
- Total volume mặc định: >=10M USD.
- FDV/MC mặc định: <=3 khi có đủ dữ liệu.
- Circulating ratio mặc định: >=40% khi có đủ dữ liệu.
- Binance pair hiện giả định `{CoinGeckoSymbol}USDT`.
- Không tìm thấy dữ liệu không đồng nghĩa coin an toàn.
- `BUY READY` sau này bắt buộc: unlock != FAIL, data quality >=80%, R:R >=2 và có xác nhận kỹ thuật.
- Điểm hiện tại chỉ là scoring sơ bộ V1.

## WebSocket flow
- **Không có WebSocket trong V1.**
- Toàn bộ dữ liệu được lấy bằng REST polling khi người dùng bấm quét.
- Không tự thêm WebSocket vào luồng hiện tại nếu chưa có yêu cầu rõ ràng.
- Nếu bổ sung sau này, phải chạy ở service riêng, có reconnect/backoff, cancellation và không cập nhật UI trực tiếp từ background thread.

## Pending flow
- **Không có pending queue/job persistence trong V1.**
- Một lần chỉ nên có một phiên quét.
- `_busy` chặn chạy đồng thời qua `CanExecute`.
- Hủy quét dùng `CancellationTokenSource`.
- Nếu bổ sung queue, phải định nghĩa trạng thái `Queued/Running/Completed/Failed/Cancelled` và không để job sống ngoài vòng đời ứng dụng ngoài ý muốn.

## Threading/UI rules
- Mọi network/CPU workflow phải chạy async.
- `Progress<T>` được tạo trên UI thread để callback cập nhật binding đúng dispatcher.
- `ObservableCollection` chỉ được thay đổi trên UI thread.
- Không gọi `MessageBox` từ service/core layer.
- Không cập nhật property bound từ thread nền nếu chưa dispatch.
- Khi kết thúc dù thành công/thất bại/hủy, phải reset `_busy` và refresh command state.

## Điều tuyệt đối không được phá
- Không biến ứng dụng thành bot auto trade.
- Không đặt private API key hoặc secret vào source control.
- Không coi lỗi/thiếu dữ liệu là coin đạt tiêu chí.
- Không xóa hỗ trợ cancellation.
- Không chuyển HTTP/network sang chạy đồng bộ trên UI thread.
- Không gộp API client, scanner engine và UI vào một class.
- Không thay đổi schema export mà không version hóa hoặc cập nhật tài liệu ChatGPT.
- Không dựa duy nhất vào symbol để xác định coin khi chưa có mapping an toàn.
