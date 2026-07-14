# Kế hoạch phát triển Crypto Scanner Desktop

## Mục tiêu tổng thể

Xây dựng ứng dụng Windows chạy độc lập, có nút **QUÉT THỊ TRƯỜNG**, tự gọi API, lọc coin, phân tích kỹ thuật, chấm điểm và xuất dữ liệu cho ChatGPT phân tích tiếp.

Ứng dụng không phải bot giao dịch, không tự mua bán, không dùng futures, không dùng margin và không tự đưa lệnh lên sàn.

## Nguyên tắc phát triển

- Ưu tiên build chạy được trước khi mở rộng tính năng.
- V1 chỉ tập trung CoinGecko, Binance, technical, scoring và JSON export.
- Không thêm OpenAI API, Telegram, Discord hoặc auto trade trong V1.
- Không coi thiếu dữ liệu là `PASS`.
- Không hardcode rule scanner nếu có thể đưa ra config.
- Mọi API call phải hỗ trợ cancellation.
- Lỗi từng coin/source phải được ghi lại, không nuốt im lặng.
- Từ V1.1 trở đi, mỗi sprint chỉ làm đúng một module.
- Không thêm tính năng mới khi sprint hiện tại là refactor.
- Không tạo God Class; giữ UI, ViewModel, service, model tách biệt.
- Không phá MVVM: code-behind chỉ khởi tạo UI/DataContext hoặc xử lý UI thuần.
- Mọi thay đổi lớn phải có mục tiêu, file chịu trách nhiệm và tiêu chí hoàn tất rõ ràng.

## Lộ trình sprint mới

### V1.1: UI Refactor

Mục tiêu: làm giao diện dễ đọc, dễ thao tác, chưa thêm engine mới.

- [ ] Rút gọn DataGrid còn các cột chính: Rank, Coin, Score, Status, Price, MC, Volume, Setup.
- [ ] Chuyển số lớn sang dạng dễ đọc: `503M`, `92.1M`, `1.2B`.
- [ ] Tô màu status: `BUY READY`, `WATCHLIST`, `REJECT`.
- [ ] Hiển thị score bằng số kèm thanh điểm.
- [ ] Thêm panel chi tiết bên phải khi click coin.
- [ ] Di chuyển các chỉ số phụ như FDV/MC, Circulating, RSI, DataQuality vào panel chi tiết.
- [ ] Cải thiện progress/status để biết đang ở bước CoinGecko, Binance hay Technical.
- [ ] Không thêm Chart, SQLite, Unlock, GitHub, DefiLlama trong sprint này.

### V1.2: Config Engine

Mục tiêu: toàn bộ rule V1 đọc từ config, có validate và fallback rõ ràng.

- [x] Có `config/scanner-settings.json`.
- [x] `ScannerService` đã đọc config.
- [ ] Validate config.
- [ ] Ghi log khi config thiếu/sai.
- [ ] Hiển thị config đang dùng trên UI hoặc Settings view tối giản.
- [ ] Không hardcode các threshold còn lại trong scoring.

### V1.3: Scanner Stability

Mục tiêu: scan ổn định, dễ debug, không mất lỗi.

- [x] Có local daily log tại `%LOCALAPPDATA%\CryptoScanner.Desktop\logs`.
- [x] Ghi log CoinGecko/Binance/Scanner/Export.
- [ ] Thay `RelayCommand` async lambda bằng `AsyncRelayCommand`.
- [ ] Thêm tab hoặc panel Logs trong UI.
- [ ] Xuất thêm `scanner_log.json` theo từng lần scan.
- [ ] Chuẩn hóa error summary trong kết quả scan.
- [x] Xếp hạng candidate bằng `PreTechnicalScore` trước khi lấy giới hạn technical.
- [x] Thêm scan profile `fast` và `deep` trong config.

### V1.4: Technical Engine

Mục tiêu: nâng chất lượng technical trước khi thêm nguồn dữ liệu mới.

- [x] EMA20/50/200.
- [ ] RSI H4/D1 tốt hơn.
- [x] MACD.
- [ ] ATR.
- [x] Relative Strength so với BTC.
- [ ] Breakout/retest rõ hơn.
- [ ] Early reversal chặt hơn.
- [ ] Viết lại BTC Trend Engine và ghi rõ logic.

### V1.5: Scoring Engine

Mục tiêu: điểm minh bạch, có nhóm điểm và điều kiện bắt buộc.

- [ ] Tách score thành nhóm Fundamental, Liquidity, Tokenomics, Technical, Relative Strength, Risk.
- [ ] Giữ total score 100 điểm.
- [ ] Status dựa trên cả điểm và điều kiện bắt buộc.
- [ ] `BUY READY` không được xuất hiện khi data quality thấp hoặc BTC risk cao.
- [ ] Chuyển magic string sang enum/value object.

### V1.6: Snapshot & Export

Mục tiêu: mỗi lần scan tạo dữ liệu có thể theo dõi và so sánh.

- [x] Chuẩn hóa `market_snapshot.json` có schema version.
- [x] Loại stablecoin, wrapped, meme và coin rủi ro cao bằng exclusion rules bước đầu.
- [x] Không cho `BUY_READY` khi `UnlockStatus` là `UNKNOWN`.
- [x] Hạ cấp trạng thái khi BTC đang `BEAR`.
- [x] Đổi JSON sang `PreliminaryScore`, `FinalScore`, `DataQualityScore`.
- [x] Thêm `PassRules`, `FailRules`, `UnknownRules`, `RiskFlags`.
- [x] Thêm `data_sources`, `scanner_config`, `filter_summary`.
- [x] Thêm `DecisionCode` và `DecisionReason`.
- [ ] Lưu snapshot theo timestamp.
- [ ] Chỉ export top 20-30 coin cho ChatGPT.
- [ ] Chuẩn bị dữ liệu để compare hôm qua/hôm nay.
- [ ] Xuất `scanner_report.html`.
- [ ] Xuất `scanner_log.json`.

### V2: Storage, Chart, Watchlist

- [ ] SQLite.
- [ ] Watchlist.
- [ ] Portfolio.
- [ ] Chart bằng LiveCharts2.
- [ ] Compare snapshot.

### V3: Fundamental Sources

- [ ] Unlock.
- [ ] GitHub.
- [ ] DefiLlama.
- [ ] API Health.

### V4: OpenAI/ChatGPT

- [ ] Chỉ làm khi dữ liệu và scanner ổn định.
- [ ] ChatGPT chỉ đọc snapshot/report.
- [ ] Không auto trade.

## Bước 1: Baseline chạy được

### Mục tiêu

Bấm **QUÉT THỊ TRƯỜNG** không crash, build sạch và xuất được JSON.

### Việc cần làm

- [x] Sửa lỗi build thiếu `HttpClient`, `Path`, `Directory`, `File`.
- [x] Sửa lỗi deserialize Binance `quoteVolume`.
- [x] Đảm bảo project build được.
- [ ] Đóng app đang chạy trước khi build/run để tránh lock file.
- [x] Test lại nút **QUÉT THỊ TRƯỜNG** từ UI.
- [x] Test lại nút **XUẤT JSON**.
- [x] Chuyển thư mục export sang `%LOCALAPPDATA%\CryptoScanner.Desktop\exports`.
- [x] Thêm nút mở thư mục export từ UI.

### Kết quả mong muốn

```text
Build succeeded
Bấm Quét chạy xong
Có danh sách coin
Xuất được market_snapshot_*.json
```

### Trạng thái

Hoàn tất ngày 14/07/2026.

## Bước 2: Làm Scanner V1 ổn định

### Mục tiêu

Lỗi API hoặc lỗi một coin không làm hỏng toàn bộ phiên quét.

### Việc cần làm

- [ ] Thay `RelayCommand` async lambda bằng `AsyncRelayCommand`.
- [ ] Không dùng `async void` gián tiếp cho lệnh scan/export.
- [x] Không nuốt exception trong `ScannerService`.
- [x] Ghi lỗi theo từng coin/source.
- [x] Thêm local daily log tại `%LOCALAPPDATA%\CryptoScanner.Desktop\logs\yyyyMMdd.log`.
- [ ] Thêm `scanner_log.json`.
- [ ] Ghi số coin bị bỏ qua và lý do bỏ qua.
- [ ] Hiển thị trạng thái lỗi rõ hơn trên UI.
- [ ] Giữ cancellation hoạt động đúng.

### Kết quả mong muốn

```text
Một coin lỗi không làm chết scan
Người dùng biết coin nào lỗi và vì sao
Có log để debug khi API thay đổi
```

## Bước 3: Chuẩn hóa config

### Mục tiêu

Không hardcode checklist scanner trong code.

### Việc đã làm

- [x] Thêm `config/scanner-settings.json`.
- [x] Thêm `ScannerSettings`.
- [x] Cho `ScannerService` đọc config.

### Việc cần làm tiếp

- [ ] Validate config khi app khởi động hoặc khi scan.
- [x] Nếu config thiếu/sai, fallback default và ghi log.
- [ ] Đưa thêm các threshold scoring ra config.
- [ ] Sau này thêm Settings UI để chỉnh.

### Kết quả mong muốn

```text
Muốn đổi rule chỉ sửa scanner-settings.json
Không cần sửa code
```

## Bước 4: Chuẩn hóa JSON cho ChatGPT

### Mục tiêu

`market_snapshot.json` là đầu ra chính cho ChatGPT đọc và phân tích.

### Việc cần làm

- [ ] Version hóa schema JSON.
- [ ] Thêm `schema_version`.
- [ ] Thêm `generated_at`.
- [ ] Thêm `btc_regime`.
- [ ] Thêm `total_scanned`.
- [ ] Thêm `passed_filter`.
- [ ] Thêm `buy_ready_count`.
- [ ] Thêm `watchlist_count`.
- [ ] Thêm `data_sources`.
- [ ] Thêm `errors_summary`.
- [ ] Chỉ xuất top 20-30 coin.
- [ ] Không xuất 1000 coin.

### Mỗi coin nên có

- [ ] Rank.
- [ ] Symbol.
- [ ] Name.
- [ ] Score.
- [ ] Status.
- [ ] Market cap.
- [ ] Volume.
- [ ] FDV/MC.
- [ ] Circulating ratio.
- [ ] Binance volume.
- [ ] RSI H4/D1.
- [ ] Setup.
- [ ] Data quality.
- [ ] Generated timestamp.

### Kết quả mong muốn

```text
ChatGPT đọc JSON là hiểu ngay bối cảnh, nguồn dữ liệu và kết quả scanner
```

## Bước 5: Cải thiện scoring V1

### Mục tiêu

Điểm minh bạch hơn, không chỉ là một số tổng mơ hồ.

### Việc cần làm

- [ ] Tách score thành nhóm `Fundamental`.
- [ ] Tách score thành nhóm `Liquidity`.
- [ ] Tách score thành nhóm `Tokenomics`.
- [ ] Tách score thành nhóm `Technical`.
- [ ] Tách score thành nhóm `Relative Strength`.
- [ ] Tách score thành nhóm `Risk`.
- [ ] Vẫn giữ `TotalScore`.
- [ ] `BUY READY` chỉ khi data quality đủ cao.
- [ ] Thiếu dữ liệu quan trọng thì không tự động đạt.
- [ ] BTC `BEAR` thì hạ trạng thái hoặc giảm điểm.
- [ ] Chuyển magic string sang enum/value object sau khi ổn định.

### Kết quả mong muốn

```text
Biết coin đạt vì lý do gì
Không còn BUY READY giả do thiếu dữ liệu
```

## Bước 6: Technical Engine V1.5

### Mục tiêu

Phân tích kỹ thuật đủ dùng cho pre-screen Spot.

### Việc cần làm

- [ ] RSI H4/D1.
- [ ] EMA20/50/200.
- [ ] MACD.
- [ ] ATR.
- [ ] Relative Strength so với BTC.
- [ ] Relative Strength so với ETH.
- [ ] Breakout/retest cơ bản.
- [ ] Early reversal chặt hơn.
- [ ] Volume expansion.

### Kết quả mong muốn

```text
Scanner lọc được coin có setup rõ ràng hơn
```

## Bước 7: Báo cáo HTML

### Mục tiêu

Ngoài JSON cho ChatGPT, có báo cáo đẹp để xem nhanh bằng trình duyệt.

### Việc cần làm

- [ ] Xuất `scanner_report.html`.
- [ ] Hiển thị BTC regime.
- [ ] Hiển thị summary cards.
- [ ] Hiển thị top candidates.
- [ ] Nhóm `Buy Ready`.
- [ ] Nhóm `Watchlist`.
- [ ] Nhóm `Reject`.
- [ ] Hiển thị lý do điểm cao/thấp.
- [ ] Thêm nút mở báo cáo từ UI.

### Kết quả mong muốn

```text
Sau scan có:
market_snapshot.json
scanner_report.html
scanner_log.json
```

## Bước 8: SQLite Cache

### Mục tiêu

Giảm API call, lưu lịch sử và chuẩn bị cho V2.

### Việc cần làm

- [ ] Thêm SQLite.
- [ ] Tạo bảng `Coins`.
- [ ] Tạo bảng `Snapshots`.
- [ ] Tạo bảng `Candles`.
- [ ] Tạo bảng `Indicators`.
- [ ] Tạo bảng `Watchlist`.
- [ ] Tạo bảng `Settings`.
- [ ] Tạo bảng `Portfolio`.
- [ ] Tạo bảng `Logs`.
- [ ] Cache CoinGecko/Binance trong thời gian hợp lý.
- [ ] Lưu snapshot mỗi lần scan.

### Kết quả mong muốn

```text
Có lịch sử scan
App chạy nhanh hơn
Có nền cho Watchlist/Portfolio
```

## Bước 9: Watchlist và Portfolio

### Mục tiêu

Bắt đầu dùng app như công cụ theo dõi thật.

### Watchlist

- [ ] Thêm coin yêu thích.
- [ ] Ghi chú.
- [ ] Trạng thái theo dõi.

### Portfolio

- [ ] Coin đã mua.
- [ ] Giá vốn.
- [ ] Số vốn.
- [ ] Target.
- [ ] Stoploss.
- [ ] Trạng thái.
- [ ] Không tự trade.
- [ ] Không cần API key sàn.

### Kết quả mong muốn

```text
Theo dõi được coin đang quan tâm và coin đã mua Spot
```

## Bước 10: Nguồn dữ liệu mở rộng

### Mục tiêu

Nâng từ V1 lên V3, bổ sung tokenomics và fundamental.

### Thứ tự nên làm

- [ ] Unlock adapter.
- [ ] Tokenomist nếu có API key.
- [ ] Fallback `UNKNOWN`.
- [ ] Không có dữ liệu unlock thì không tính `PASS`.
- [ ] DefiLlama TVL.
- [ ] DefiLlama fees.
- [ ] DefiLlama revenue.
- [ ] GitHub commits.
- [ ] GitHub releases.
- [ ] GitHub activity.
- [ ] News/risk metadata.

### Kết quả mong muốn

```text
Scanner không chỉ nhìn technical mà có thêm tokenomics và fundamental
```

## Bước 11: UI nâng cao

### Mục tiêu

Dashboard đủ tiện để dùng hằng ngày.

### Việc cần làm

- [ ] Coin detail screen.
- [ ] Bộ lọc nhanh `Buy Ready`.
- [ ] Bộ lọc nhanh `Watchlist`.
- [ ] Bộ lọc nhanh `Reject`.
- [ ] Bộ lọc nhanh `Unlock Unknown`.
- [ ] Bộ lọc nhanh `Breakout`.
- [ ] Bộ lọc nhanh `Early Reversal`.
- [ ] Bộ lọc nhanh theo market cap range.
- [ ] Chart bằng LiveCharts2.
- [ ] Settings screen.
- [ ] API status screen.
- [ ] Dark/light theme.

### Kết quả mong muốn

```text
App đủ tiện để dùng hằng ngày
```

## Bước 12: AI/OpenAI sau cùng

### Mục tiêu

Chỉ làm khi scanner và dữ liệu đã ổn.

### Nguyên tắc

- [ ] Không làm trong V1.
- [ ] App vẫn tự quét dữ liệu.
- [ ] OpenAI chỉ đọc snapshot/report.
- [ ] Không để AI tự quyết định mua bán.
- [ ] Không auto trade.

### Prompt mục tiêu

```text
Đọc market_snapshot.json.
Áp dụng toàn bộ checklist Crypto Scanner V11.
Kiểm tra thêm Narrative, Catalyst, Tin tức, Unlock nếu cần.
Xuất BUY READY, WATCHLIST, REJECT.
Đưa Top 3 đáng mua nhất.
Nếu không có coin nào đạt, hãy nói không giải ngân.
```

## Ưu tiên gần nhất

Thứ tự 5 task nên làm tiếp:

1. `AsyncRelayCommand`.
2. `scanner_log.json`.
3. Chuẩn hóa `market_snapshot.json`.
4. Tách scoring thành nhóm điểm.
5. Xuất thêm `scanner_report.html`.

Sau 5 task này, V1 sẽ đủ nền để mở rộng sang SQLite, Watchlist, Portfolio, Unlock, DefiLlama và GitHub.
