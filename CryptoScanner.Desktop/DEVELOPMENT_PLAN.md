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

- [x] Rút gọn DataGrid còn các cột chính: Rank, Coin, Score, Status, Price, MC, Volume, Setup.
- [x] Chuyển số lớn sang dạng dễ đọc: `503M`, `92.1M`, `1.2B`.
- [x] Tô màu status: `BUY READY`, `WATCHLIST`, `REJECT`.
- [x] Hiển thị score bằng số kèm thanh điểm.
- [x] Thêm panel chi tiết bên phải khi click coin.
- [x] Di chuyển các chỉ số phụ như FDV/MC, Circulating, RSI, DataQuality vào panel chi tiết.
- [x] Cải thiện progress/status để biết đang ở bước CoinGecko, Binance hay Technical.
- [ ] Không thêm Chart, SQLite, Unlock, GitHub, DefiLlama trong sprint này.
- [x] Thêm display wrapper `CoinDisplayItem`, giữ `ScanResult` gốc cho export.
- [x] Thêm formatter số compact cho UI.
- [x] Thêm nút mở export và log folder riêng.
- [x] Thêm empty/error/no-result state.

Trạng thái: Hoàn tất. Scanner engine và JSON export không bị thay đổi bởi UI refactor.

### V1.2: UI Polish

Mục tiêu: tinh chỉnh trải nghiệm dùng hằng ngày, chỉ thay đổi presentation layer.

- [x] Rút gọn status badge: `WATCHLIST_PRIORITY` -> `PRIORITY`, `WATCHLIST` -> `WATCH`, `NEEDS_DATA` -> `DATA`.
- [x] Thêm category vào coin cell dòng phụ.
- [ ] Tô màu reason theo loại: wait unlock, low liquidity, wait pullback, manual review, score low.
- [x] Hiển thị rule count: `Risk Flags (2)`, `Fail Rules (0)`, `Pass Rules (6)`, `Unknown Rules (5)`.
- [x] Làm detail panel compact hơn bằng heading rõ hơn và decision ngắn hơn.
- [x] Hiển thị decision dạng ngắn ở dòng chính, decision code đầy đủ ở dòng phụ.
- [x] Thêm breakdown summary: Priority, Watchlist, Reject.
- [x] Không sửa scanner, scoring hoặc export schema trong sprint này.

Trạng thái: Đã hoàn tất phần polish tối thiểu. Còn lại reason color có thể để sprint sau nếu cần.

### V1.3: UI Interaction

Mục tiêu: thêm thao tác tiện dụng sau khi UI polish ổn định.

- [x] Search coin.
- [x] Filter theo status.
- [x] Copy symbol.
- [x] Right click menu.
- [x] Double click mở TradingView.
- [x] Right click mở Binance/CoinGecko.
- [ ] Kiểm tra sort theo header vẫn hoạt động.

Trạng thái: Đã triển khai interaction tối thiểu, chỉ thay đổi UI/ViewModel/display wrapper.

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
- [x] Thay `RelayCommand` async lambda bằng `AsyncRelayCommand`.
- [ ] Thêm tab hoặc panel Logs trong UI.
- [x] Xuất thêm `scanner_log_*.json` theo từng lần export.
- [x] Thêm scan duration vào `scanner_log_*.json`.
- [x] Thêm pipeline counts vào `scanner_log_*.json`.
- [x] Thêm priority symbols/candidates vào `scanner_log_*.json`.
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
- [x] `TREND_BREAKOUT` dùng EMA/MACD chặt hơn.
- [x] `EARLY_REVERSAL` không chấp nhận MACD bearish hoặc D1 quá xa EMA200.
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
- [x] Thêm `VolumeMarketCapRatio`.
- [x] Đổi relative strength sang `RelativePerformanceVsBtc30dPct`.
- [x] Làm tròn số trong snapshot để giảm dung lượng.
- [x] Bổ sung category mapping cho nhóm coin phổ biến.
- [x] Thêm `EntryReadinessScore` tách khỏi `MarketTechnicalScore`.
- [x] Thêm `data_quality_formula`.
- [x] Thêm risk `HIGH_VOLUME_TO_MARKET_CAP`.
- [x] Thêm xử lý `NON_STANDARD_SYMBOL`.
- [ ] Lưu snapshot theo timestamp.
- [ ] Chỉ export top 20-30 coin cho ChatGPT.
- [ ] Chuẩn bị dữ liệu để compare hôm qua/hôm nay.
- [ ] Xuất `scanner_report.html`.
- [x] Xuất `scanner_log_*.json`.

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

Ghi chú unlock data:

- V1 hiện tại giữ `UnlockStatus = UNKNOWN`, không gọi Unlock API.
- Không tích hợp Token Unlocks/CryptoRank ngay khi chưa có API key và chưa ổn định engine.
- Khi triển khai, dùng abstraction `IUnlockProvider` để scanner không phụ thuộc trực tiếp nguồn dữ liệu.
- Provider dự kiến: `CachedUnlockProvider`, `CryptoRankProvider`, `TokenUnlocksProvider`.
- Ưu tiên đọc `unlock-cache.json` local trước, cập nhật tối đa 1 lần/ngày để giảm request và tránh phụ thuộc API liên tục.

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

- [x] Thay `RelayCommand` async lambda bằng `AsyncRelayCommand`.
- [x] Không dùng `async void` gián tiếp cho lệnh scan/export.
- [x] Không nuốt exception trong `ScannerService`.
- [x] Ghi lỗi theo từng coin/source.
- [x] Thêm local daily log tại `%LOCALAPPDATA%\CryptoScanner.Desktop\logs\yyyyMMdd.log`.
- [x] Thêm `scanner_log_*.json`.
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

### Nguyên tắc unlock

- [x] V1 chưa tích hợp Unlock API, giữ `UNKNOWN` là trạng thái an toàn.
- [ ] Thiết kế `IUnlockProvider` trước khi gọi nguồn dữ liệu thật.
- [ ] Thêm `CachedUnlockProvider` đọc `unlock-cache.json` ở local.
- [ ] Chỉ dùng CryptoRank/Token Unlocks khi đã có API key và giới hạn request rõ ràng.
- [ ] Scanner không được biết dữ liệu unlock đến từ provider nào.
- [ ] Không scrape trực tiếp trong luồng scan chính; nếu cần scrape, chạy tác vụ cập nhật cache riêng.

### Thứ tự nên làm

- [ ] Unlock adapter qua `IUnlockProvider`.
- [ ] CryptoRank nếu có API key.
- [ ] Token Unlocks nếu có API commercial.
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
## V1.4: Snapshot History Foundation

Mục tiêu: lưu lịch sử scan ổn định để chuẩn bị cho Snapshot History và Backtest, không thay đổi scanner/scoring/schema `market_snapshot`.

- [x] Lưu history tại `%LOCALAPPDATA%\CryptoScanner.Desktop\history\yyyy-MM-dd`.
- [x] Mỗi scan hoàn tất tạo đúng một history entry.
- [x] Manual export không tạo thêm history entry trùng.
- [x] Snapshot và scanner log dùng chung `scan_id` trong tên file/log/index.
- [x] `history_index.json` dùng relative paths.
- [x] Ghi snapshot/log/index theo cơ chế temp file rồi replace.
- [x] History save lỗi chỉ ghi warning, không làm hỏng scan/export chính.
- [x] Retention 180 ngày dựa trên `generated_at` trong index.
- [x] Dọn entry trỏ tới file không còn tồn tại và xóa folder ngày trống.
- [x] Nếu `history_index.json` hỏng parse, đổi tên file hỏng và rebuild index từ file history còn tồn tại.
- [x] Index có metadata phục vụ backtest: `scan_id`, version, profile, BTC regime, counts, elapsed, priority/watch symbols, config fingerprint.
- [x] Build pass sau khi triển khai.

Trạng thái: hoàn tất foundation. Việc tiếp theo hợp lý là đọc `history_index.json` để hiển thị lịch sử scan hoặc chuẩn bị `backtest_results.json`.
## V1.5: Backtest Foundation

Mục tiêu: đánh giá chất lượng tín hiệu từ history đã lưu, nhưng không sửa scanner, không sửa scoring và không sửa schema `market_snapshot`.

### Nguyên tắc bắt buộc

- [x] Không dùng giá hiện tại thay cho giá đúng mốc 7/14/30 ngày.
- [x] Chỉ backtest snapshot đủ tuổi theo từng horizon.
- [x] Horizon chưa đủ tuổi phải là `PENDING`, không coi là lỗi.
- [x] Lấy giá theo `target_time = snapshot.generated_at + horizon_days`.
- [x] Ghi rõ `price_time`, `price_source`, `price_match`.
- [x] Tính cả return tuyệt đối và return tương đối so với BTC.
- [x] Không sửa snapshot lịch sử; snapshot là dữ liệu bất biến.
- [x] Một coin lỗi giá không làm dừng toàn bộ backtest run.
- [x] Backtest result ghi ra file riêng trong `%LOCALAPPDATA%\CryptoScanner.Desktop\backtests`.
- [x] Ghi file kết quả bằng temp file rồi replace.

### Phase 1: History Reader

- [x] Tạo `IHistoryReader`.
- [x] Đọc `%LOCALAPPDATA%\CryptoScanner.Desktop\history\history_index.json`.
- [x] Validate `scan_id`, `generated_at`, schema version, snapshot path và log path.
- [x] Snapshot file mất/hỏng thì bỏ qua entry và ghi warning.
- [x] JSON parse lỗi không làm dừng toàn bộ run.
- [x] Candidate count trong snapshot phải khớp metadata nếu có thể kiểm tra.
- [x] Chỉ hỗ trợ schema version đã biết.

### Phase 2: Historical Price Provider

- [x] Tạo `IHistoricalPriceProvider`.
- [x] Ưu tiên Binance kline cho cặp USDT.
- [x] CoinGecko fallback khi Binance thiếu dữ liệu hoặc không có symbol hỗ trợ.
- [x] Không đoán symbol bất thường; đánh dấu `UNSUPPORTED_SYMBOL`.
- [x] Lưu rõ `coin_id`, `symbol`, `price_lookup_symbol`.
- [x] Cache giá lịch sử để không gọi lại cùng dữ liệu.
- [x] BTC cũng phải lấy giá cùng horizon để tính relative return.

### Phase 3: Backtest Core

- [x] Horizon mặc định: 7D, 14D, 30D.
- [x] Nếu snapshot mới 3 ngày: 7D/14D/30D đều `PENDING`.
- [x] Nếu snapshot 10 ngày: 7D `COMPLETED`, 14D/30D `PENDING`.
- [x] Tính `entry_price` từ snapshot.
- [x] Tính `exit_price` tại target horizon.
- [x] Tính `return_pct`.
- [x] Tính `btc_return_pct`.
- [x] Tính `relative_return_vs_btc_pct`.
- [ ] Chuẩn bị field cho MFE/MAE nhưng chưa bắt buộc tính ở V1.5.

### Phase 4: Aggregation

- [x] Tổng hợp theo `Status`.
- [x] Tổng hợp theo `Status + DecisionCode`.
- [x] Tổng hợp theo `Setup`.
- [x] Tổng hợp theo `MarketTechnicalScore` bucket.
- [x] Tổng hợp theo `EntryReadinessScore` bucket.
- [x] Tổng hợp theo `BTC regime`.
- [x] Tổng hợp theo `scan_profile`.
- [x] Tổng hợp theo `scanner_version`.
- [x] Không gom toàn bộ `REJECT` thành một nhóm duy nhất khi phân tích chính.

### Phase 5: Export & Log

- [x] Xuất `backtest_results_yyyy-MM-dd_HHmmss.json`.
- [x] Tạo/cập nhật `backtest_index.json`.
- [x] Có `backtest_id`, `generated_at`, `history_range`, `horizons`.
- [x] Có `snapshots_processed`, `snapshots_skipped`, `price_lookup_summary`.
- [x] Có `group_summaries`.
- [x] Có `snapshot_results`.
- [x] Summary cần có sample size, average, median, win rate, missing price count, pending horizon count.
- [x] Ghi log rõ số snapshot xử lý, số pending, số thiếu giá và số lỗi bị bỏ qua.

### Trạng thái

Đã triển khai foundation: đọc history, xuất backtest JSON, hỗ trợ PENDING theo horizon, Binance primary, CoinGecko fallback, cache giá và aggregation cơ bản. MFE/MAE để lại cho bước nâng cấp sau.

## V1.6: Metrics Engine

Mục tiêu: tách thống kê backtest thành engine riêng để UI và các bước chỉnh scoring sau này chỉ đọc metric, không tự tính.

- [x] Tạo model `BacktestMetricSet`, `BacktestMetricGroup`, `BacktestMetricSummary`.
- [x] Tạo `BacktestMetricsService`.
- [x] `BacktestService` chỉ điều phối history, price lookup và export.
- [x] Metrics chỉ dùng horizon row có status `COMPLETED`.
- [x] `PENDING`, `PRICE_MISSING`, `UNSUPPORTED_SYMBOL` được đưa vào `excluded_counts`.
- [x] Mỗi group có `horizon_days`, không gom 7D/14D/30D.
- [x] Có `metric_definitions` cho `win_rate` và `btc_outperform_rate`.
- [x] Có `metrics_schema_version = 1.0`.
- [x] Có `bucket_version = 1.0`.
- [x] Bucket cố định: MarketTechnicalScore `0-59`, `60-69`, `70-79`, `80-89`, `90-100`.
- [x] Bucket cố định: EntryReadinessScore `0-19`, `20-39`, `40-59`, `60-79`, `80-100`.
- [x] Group dùng `dimensions` thay vì parse chuỗi `group_key`.
- [x] Có `sample_quality`: LOW, MEDIUM, HIGH.
- [x] Có `min_return_pct` và `max_return_pct`.
- [x] Có `btc_outperform_rate_pct`.
- [x] Không sửa scanner, scoring hoặc schema `market_snapshot`.
- [x] Test production history: chưa đủ tuổi nên `group_summaries` rỗng, không lỗi chia 0.
- [x] Test history giả > 7 ngày: có `COMPLETED`, median, min/max, win rate và BTC outperform.

Trạng thái: hoàn tất. Bước tiếp theo hợp lý là V1.7 Cached Unlock Provider.

## V1.7: Cached Unlock Provider

Mục tiêu: bổ sung dữ liệu unlock từ cache local để giảm `UNLOCK_UNKNOWN`, không gọi API/scrape, không phá schema snapshot và không thay đổi backtest/history.

- [x] Tạo model `UnlockInfo`, `UnlockCacheDocument`, `UnlockProviderResult`, `UnlockCacheSummary`.
- [x] Tạo `CachedUnlockProvider` chỉ đọc cache local.
- [x] Provider không chứa ngưỡng đầu tư; chỉ trả dữ liệu và trạng thái cache.
- [x] Matching ưu tiên `coin_id` exact, alias `coin_id`, rồi mới fallback symbol.
- [x] Symbol fallback bị bỏ qua nếu symbol trùng hoặc symbol không chuẩn.
- [x] Hỗ trợ trạng thái `FOUND`, `NOT_FOUND`, `CACHE_MISSING`, `CACHE_EXPIRED`, `INVALID_ITEM`.
- [x] Cache có kiểm tra `expires_at` hoặc `max_cache_age_hours`.
- [x] Expired cache không được coi là full confidence; chỉ cộng coverage thấp và giữ unlock unknown.
- [x] Tạo `UnlockRuleEvaluator` đọc ngưỡng từ `scanner-settings.json`.
- [x] Thêm `unlockRules`: warn/fail 30D và 90D.
- [x] PASS/WARN/FAIL dựa trên config, không hardcode trong provider.
- [x] Chỉ dữ liệu unlock hợp lệ mới xóa `UNLOCK_UNKNOWN`.
- [x] Chỉ dữ liệu unlock hợp lệ và chưa expired mới tăng SourceCoverage đầy đủ.
- [x] `UNLOCK_FAIL` không override hard reject mạnh hơn như non-standard symbol hoặc Binance volume quá thấp.
- [x] Ghi `unlock_cache_summary` vào `scanner_log`.
- [x] Thêm `config/unlock-cache.example.json` làm mẫu nhập cache thủ công.
- [x] Test positive-path với cache local giả: PASS/WARN/FAIL, match theo `coin_id`, xóa `UNLOCK_UNKNOWN`, tăng SourceCoverage/DataQuality.
- [x] Xóa cache/snapshot/log test giả sau khi kiểm chứng để tránh dùng nhầm dữ liệu đầu tư.
- [x] Build pass sau khi triển khai.

Trạng thái: hoàn tất foundation. Scan khi không có cache vẫn bình thường; scan với cache thử nghiệm đã xác nhận `UnlockStatus`, `Unlock30dPct`, `Unlock90dPct`, rule lists, SourceCoverage/DataQuality và DecisionCode được cập nhật đúng cho coin khớp.

## V1.8: Backtest Review / Mini Health Dashboard

Mục tiêu: hiển thị nhanh tình trạng scanner, backtest và lịch sử ngay trong ứng dụng, không cần mở thủ công JSON. Đây chỉ là lớp đọc và trình bày dữ liệu đã tồn tại.

### Phạm vi khóa

- [x] Không thêm API.
- [x] Không thêm chart.
- [x] Không sửa `ScannerService`.
- [x] Không sửa scoring hoặc decision rules.
- [x] Không sửa schema `market_snapshot`.
- [x] Không sửa output scanner hoặc backtest.
- [x] Không tạo thêm file export.
- [x] Không dùng `FileSystemWatcher`.
- [x] Không thêm nút mở log.
- [x] Không thêm nút mở backtest.
- [x] Không tự chạy scan hoặc backtest.
- [x] Không làm UI dashboard lớn.

### Nguồn dữ liệu chỉ đọc

- [x] `%LOCALAPPDATA%\CryptoScanner.Desktop\exports\scanner_log_*.json`.
- [x] `%LOCALAPPDATA%\CryptoScanner.Desktop\backtests\backtest_results_*.json`.
- [x] `%LOCALAPPDATA%\CryptoScanner.Desktop\history\history_index.json`.

### Nguyên tắc đọc file

- [x] Chọn scanner log và backtest mới nhất bằng `generated_at` trong JSON; fallback `LastWriteTimeUtc` nếu thiếu.
- [x] Nếu file mới nhất bị hỏng, thử file hợp lệ kế tiếp.
- [x] Không để một JSON hỏng làm mất toàn bộ health dashboard.
- [x] Đọc bất đồng bộ, không block UI thread.
- [x] Bắt riêng lỗi file không tồn tại, file đang ghi, JSON lỗi, thiếu property hoặc sai kiểu dữ liệu.
- [x] Không throw exception lên ViewModel/UI.
- [x] Trả trạng thái đọc rõ ràng: `OK`, `NO_DATA`, `READ_ERROR`.
- [x] Không giữ file handle sau khi deserialize.

### Phase 1: Scanner Health Summary

Nguồn: scanner log hợp lệ mới nhất trong `exports`.

- [x] Last Scan từ `generated_at`.
- [x] Scan Status từ `scan_status`.
- [x] BTC Regime từ `scan_summary.btc_regime`.
- [x] Candidates từ `scan_summary.candidates`.
- [x] Priority/Watch/Reject từ `scan_summary`.
- [x] Elapsed từ `scan_timing.elapsed_seconds`.
- [x] Unlock Matches/Missing từ `unlock_cache_summary`.
- [x] History Saved từ `history.history_saved`.
- [x] Suy ra Unlock Source từ `unlock_cache_summary`, không cần đọc `market_snapshot`.

Quy tắc Unlock Source:

- [x] `loaded=true`, `is_expired=false` => `LOCAL_CACHE`.
- [x] `loaded=true`, `is_expired=true` => `LOCAL_CACHE_EXPIRED`.
- [x] `loaded=false` và warning chứa `not found` => `CACHE_MISSING`.
- [x] `loaded=false` với lỗi đọc/parse => `CACHE_ERROR`.
- [x] Không có scanner log => `NO_DATA`.

### Phase 2: Backtest Summary

Nguồn: backtest result hợp lệ mới nhất trong `backtests`.

- [x] Last Backtest từ `backtest_id`.
- [x] Generated At từ `generated_at`.
- [x] Snapshots Processed từ `snapshots_processed`.
- [x] Snapshots Skipped từ `snapshots_skipped`.
- [x] Pending Horizons từ `excluded_counts.pending`.
- [x] Missing Price từ `excluded_counts.missing_price`.
- [x] Unsupported Symbol từ `excluded_counts.unsupported_symbol`.
- [x] Completed Horizons phải đếm trực tiếp từ `snapshot_results -> candidates -> horizons -> status == COMPLETED`.
- [x] Không lấy completed từ `group_summaries`.
- [x] Có thể đếm trực tiếp Pending/Missing/Unsupported để kiểm tra chéo với `excluded_counts`; nếu lệch thì hiển thị nguồn chuẩn và ghi warning.
- [x] `group_summaries` rỗng không làm summary lỗi.

### Phase 3: History Summary

Nguồn: `history\history_index.json`.

- [x] History Entries là số entry hợp lệ.
- [x] Last Snapshot xác định bằng timestamp mới nhất, không mặc định phần tử cuối mảng.
- [x] Last Scan ID từ entry mới nhất hợp lệ.
- [x] Entry thiếu timestamp hoặc scan ID phải được bỏ qua an toàn.
- [x] Retention Days chỉ hiển thị nếu đã có field hoặc cấu hình hiện hữu đọc được.
- [x] Không sửa schema `history_index.json` chỉ để phục vụ UI.
- [x] Nếu chưa có retention source thì hiển thị `—` hoặc bỏ dòng.

### Phase 4: Refresh

- [x] Tạo một luồng refresh duy nhất: `RefreshHealthAsync()`.
- [x] Gọi sau khi `MainViewModel` khởi tạo xong.
- [x] Gọi sau khi scan hoàn thành và file đã ghi xong.
- [x] Gọi sau khi backtest hoàn thành và file kết quả đã ghi xong.
- [x] Gọi sau export thủ công nếu command export vẫn tạo file độc lập.
- [ ] Không gọi refresh khi file mới bắt đầu ghi.
- [ ] Không refresh hai lần cho cùng một scan chỉ vì scan vừa hoàn thành vừa export JSON.
- [x] Chống refresh chồng nhau bằng `SemaphoreSlim`, cancellation token hoặc cờ `IsRefreshingHealth`.
- [x] Đọc và deserialize ngoài UI thread.
- [x] Gán summary mới về ViewModel một lần; không cập nhật từng property rời rạc khi đang đọc.
- [ ] Giữ summary cũ cho tới khi summary mới đọc xong.
- [ ] Nếu refresh lỗi, không làm mất dữ liệu hợp lệ trước đó; chỉ cập nhật trạng thái lỗi phù hợp.

### Model và service dự kiến

- [x] Thêm `Models\AppHealthSummary.cs`.
- [x] Thêm `Services\AppHealthService.cs`.
- [x] `AppHealthSummary` gồm `ScannerHealthSummary`, `BacktestHealthSummary`, `HistoryHealthSummary`.
- [x] Mỗi nhóm có `HealthReadStatus Status`, `string? Message`, `DateTimeOffset? GeneratedAt`.
- [x] `AppHealthService` resolve AppData paths, tìm file hợp lệ mới nhất, đọc JSON an toàn, tính summary.
- [x] `AppHealthService` không chứa logic UI, không sửa file, không gọi scanner/backtest và không tạo export.

### UI đề xuất

- [x] Thêm một panel nhỏ dưới hàng dashboard card.
- [x] Không chart.
- [x] Không DataGrid mới.
- [x] Không popup.
- [x] Không nút mở file.
- [ ] Không dùng màu cảnh báo quá mạnh.
- [ ] `NO_DATA` hiển thị rõ nhưng không coi là lỗi nghiêm trọng.
- [ ] Dùng binding nullable/fallback phù hợp, không binding tới property không tồn tại.
- [ ] Không đặt logic đọc file trong code-behind.

Ví dụ:

```text
SCANNER HEALTH
Last scan: 09:45 | 45 candidates | BTC: BEAR
Unlock: LOCAL_CACHE 3/{candidates} | History: Saved

BACKTEST
Latest: 09:49 | snapshots: 9/0
Horizons: 0 completed | 1170 pending | missing: 0

HISTORY
Entries: 9 | latest: 20260715T094500_86EC
```

### File có thể cần sửa

- [ ] `ViewModels\MainViewModel.cs`.
- [ ] `MainWindow.xaml`.
- [ ] `DEVELOPMENT_PLAN.md`.

### Tiêu chí chốt

- [ ] App mở được khi chưa có thư mục `exports`.
- [ ] App mở được khi chưa có scanner log.
- [ ] App mở được khi chưa có backtest file.
- [ ] App mở được khi chưa có history file.
- [ ] App mở được khi cả ba nguồn đều chưa tồn tại.
- [ ] Scanner log hỏng không làm crash app.
- [ ] Backtest JSON hỏng không làm crash app.
- [ ] History index hỏng không làm crash app.
- [ ] File mới nhất hỏng thì scanner/backtest health thử file hợp lệ trước đó.
- [ ] JSON thiếu property không gây lỗi binding.
- [ ] Scanner health hiển thị đúng scan mới nhất, BTC regime, counts, elapsed, unlock source, unlock match/missing và history saved.
- [ ] Backtest health hiển thị đúng file mới nhất, processed/skipped, completed từ horizon status, pending/missing/unsupported không đếm trùng.
- [ ] History health đếm đúng entry hợp lệ, latest entry theo timestamp và latest scan ID.
- [ ] Health summary tải khi mở app.
- [ ] Sau scan, scanner và history summary cập nhật.
- [ ] Sau backtest, backtest summary cập nhật.
- [ ] Không refresh chồng nhiều lần.
- [ ] Không đọc file khi file chưa ghi hoàn tất.
- [ ] UI không bị treo trong lúc refresh.
- [ ] Không có binding error.
- [ ] Không có unhandled exception.
- [ ] Build sạch.
- [ ] Không thay đổi scanner output.
- [ ] Không thay đổi backtest output.
- [ ] Không thay đổi snapshot schema.
- [ ] Không tạo file export mới.
- [ ] Không ảnh hưởng kết quả scan, scoring hoặc decision code.

### Test tối thiểu

- [ ] Chạy app khi xóa toàn bộ scanner log, backtest và history.
- [ ] Chạy app với scanner log hợp lệ.
- [ ] Chạy app với scanner log mới nhất bị hỏng và file trước đó hợp lệ.
- [ ] Chạy app khi chưa có backtest.
- [ ] Chạy app với backtest chỉ có `PENDING`.
- [ ] Chạy app với backtest có ít nhất một `COMPLETED`.
- [ ] Chạy app với `history_index.json` rỗng.
- [ ] Chạy app với history index bị hỏng.
- [ ] Chạy scan và kiểm tra UI refresh.
- [ ] Chạy backtest và kiểm tra UI refresh.
- [ ] Kiểm tra Output window không có binding error.
- [ ] So sánh file scanner/backtest trước và sau V1.8 để xác nhận dashboard không đổi schema hoặc nội dung output.

Trạng thái: đã khóa kế hoạch. Sẵn sàng triển khai khi bắt đầu sprint V1.8.

## V1.9: Manual Unlock Import

Mục tiêu: cho phép người dùng chọn một file JSON unlock, validate toàn bộ nội dung rồi nhập an toàn vào `%LOCALAPPDATA%\CryptoScanner.Desktop\data\unlock-cache.json`.

### Phạm vi khóa

- [x] Không gọi API.
- [x] Không scrape.
- [x] Không tạo dữ liệu unlock giả.
- [x] Không tự sửa dữ liệu người dùng.
- [x] Không tự chạy scanner sau import.
- [x] Không sửa scoring.
- [x] Không sửa `ScannerService`.
- [x] Không sửa schema `market_snapshot`.
- [x] Không sửa backtest engine.

### Triển khai

- [x] Thêm `UnlockCacheInspector` dùng chung cho `CachedUnlockProvider` và `UnlockCacheImportService`.
- [x] Thêm `UnlockImportResult`.
- [x] Thêm `UnlockCacheImportService`.
- [x] Import validate trước khi ghi cache thật.
- [x] File import giới hạn 5 MB.
- [x] Từ chối invalid JSON, unsupported schema, missing `updated_at`, no valid item, duplicate `coin_id`/`symbol`, percentage ngoài 0-100.
- [x] Cache hết hạn được import thành công kèm cảnh báo.
- [x] Ghi temp file trong cùng thư mục data và replace atomically.
- [x] Giữ tối đa một backup `unlock-cache.previous.json`.
- [x] Import lỗi không làm thay đổi cache hiện tại.
- [x] Copy bytes sau validation để không đổi encoding/format file nguồn.
- [x] Thêm command/nút `IMPORT UNLOCK`.
- [x] Disable import khi app đang busy.
- [x] Import thành công nhắc người dùng chạy scanner lại.
- [x] Ghi runtime log success/failure, không ghi nội dung file vào log.

### Test đã chạy

- [x] Valid import: tạo được `unlock-cache.json`.
- [x] Invalid JSON: import fail, cache cũ giữ nguyên.
- [x] Duplicate `coin_id`: import fail, cache cũ giữ nguyên.
- [x] Percentage sai: import fail, cache cũ giữ nguyên.
- [x] Expired cache: import success, `IsExpired=true`.
- [x] Invalid JSON giữ nguyên SHA-256 cache cũ và không để lại temp file.
- [x] File đích bị khóa trả `WRITE_FAILED`, giữ nguyên SHA-256 cache cũ và không để lại temp file.
- [x] Build Release sạch.
- [x] Thêm bộ file test thủ công trong `test-data/unlock-import`.

### Cần test thủ công

- [x] Nút `IMPORT UNLOCK` mở file picker trong UI.
- [x] Import file hợp lệ qua UI, sau đó chạy scanner và Health hiển thị `LOCAL_CACHE`.
- [x] Import JSON hỏng qua UI, cache hợp lệ trước đó không bị ghi đè.
- [x] Import cache hết hạn qua UI, sau đó chạy scanner và Health hiển thị `LOCAL_CACHE_EXPIRED`.
- [x] Import lại file hợp lệ sau test expired, sau đó chạy scanner và Health trở về `LOCAL_CACHE`.
- [ ] Output window không có binding error.

Trạng thái: DONE. V1.9 đã có bằng chứng UI/import/scanner/history/snapshot cho valid import, invalid JSON, expired cache và restore cache hợp lệ. Output binding là checklist vận hành còn có thể kiểm tra thêm khi mở bằng Visual Studio.

## V1.10: Stabilization

Mục tiêu: khóa chất lượng runtime trước khi thêm nguồn unlock thật. V1.10 chỉ sửa lỗi và ổn định vận hành; không thêm API, không scrape, không thêm provider mới, không đổi scoring, không đổi snapshot schema, không đổi backtest engine và không mở rộng UI lớn.

- [x] Không hiển thị stack trace dài trong popup người dùng.
- [x] Không spam nhiều popup cho một lần scan lỗi.
- [x] Phân loại `429 Too Many Requests` thành thông báo thử lại sau.
- [x] Phân loại lỗi transport/connection closed thành lỗi mạng tạm thời.
- [x] Phân loại timeout thành lỗi nguồn dữ liệu phản hồi quá lâu.
- [x] Thêm retry/backoff nhẹ cho CoinGecko markets.
- [x] Retry có số lần tối đa.
- [x] CoinGecko client có timeout.
- [x] Giữ stack trace chi tiết trong runtime log.
- [x] Không ghi snapshot/history thành công giả khi scan thất bại.
- [x] Không xóa bảng kết quả cũ khi scan mới thất bại.
- [x] Sau scan thành công, Scanner Health lấy trạng thái unlock từ kết quả vừa chạy trong bộ nhớ để tránh hiển thị scanner log cũ.
- [x] Auto history save không phụ thuộc metadata null.
- [x] Snapshot/history lưu lại sau scan thành công: scan ID `20260716T031514_BA3D`.
- [x] Unlock cache pipeline verified with controlled test data: `LOCAL_CACHE 3/43`.

Điểm cần hiểu đúng: `LOCAL_CACHE 3/43` chứng minh pipeline cache/import/provider hoạt động với dữ liệu kiểm thử có kiểm soát. Nó không chứng minh dữ liệu unlock là dữ liệu thật hoặc chính xác cho đầu tư. Trong tài liệu chung phải ghi mẫu số động là `3/{candidate_count}`, không hardcode `43`.

### Cần test nốt trước khi đánh dấu DONE tuyệt đối

- [x] Người dùng bấm `DỪNG` trong lúc scan đang chạy/retry, app không treo, không popup lặp và nút trở lại đúng trạng thái.
- [ ] Debug build sạch sau khi đóng app, không còn lock file.
- [ ] Release build sạch và chạy smoke test bản Release.
- [ ] Output window không có binding error.
- [ ] File integrity: snapshot/log/history index không 0 byte và không để lại temp file.

Trạng thái: patch chính đã pass qua UI cho popup 429, cancel, `LOCAL_CACHE 3/43`, `History: Saved` và auto snapshot/history. Chưa đánh dấu DONE tuyệt đối cho tới khi hoàn tất Debug/Release build, Output binding và Release smoke test.

## V1.11: Real Unlock Data Intake & Normalization

Mục tiêu: chuyển dữ liệu unlock lấy từ nguồn bên ngoài sang đúng schema nội bộ của CryptoScanner, có nguồn gốc và thời gian cập nhật rõ ràng. Không tự gọi web/API trong app và không lặp lại chức năng import đã hoàn thành ở V1.9.

### Phạm vi khóa

- [x] Không scrape trực tiếp website.
- [x] Không nhúng trình duyệt.
- [x] Không hardcode HTML selector.
- [x] Không tự đăng nhập website.
- [x] Không gọi API trong scanner.
- [x] Không biến file mẫu thành dữ liệu thật.
- [x] Không tự động suy đoán coin khi symbol trùng.

### Thiết kế cần khóa

- [x] Định nghĩa rõ `unlock_30d_pct` và `unlock_90d_pct`.
- [x] Khuyến nghị: phần trăm lượng token sẽ unlock trong kỳ so với circulating supply tại thời điểm dữ liệu được thu thập.
- [ ] Xác nhận logic scoring hiện tại dùng đúng ý nghĩa phần trăm này.
- [x] Identity ưu tiên `coin_id` CoinGecko, `symbol` chỉ là fallback.
- [ ] Xem có cần `source`/`retrieved_at` trong cache schema hay giữ schema `1.0` hiện tại.
- [ ] Nếu thêm `source`, chỉ làm khi parser chấp nhận property bổ sung hoặc chủ động nâng schema lên `1.1`.

### Converter ngoài app chính

- [x] Thiết kế `Tools/UnlockCacheConverter`.
- [x] Input: CSV, JSON đơn giản hoặc file thủ công theo template.
- [x] Output: `unlock-cache.json`.
- [x] Validate required fields, duplicate `coin_id`/`symbol`, percentage 0-100.
- [ ] Nếu input là danh sách event, tính 30D/90D rõ ràng.
- [x] In report item hợp lệ/lỗi.
- [x] Không tự chép vào AppData; người dùng import qua nút `IMPORT UNLOCK`.
- [x] Converter workflow pass qua app: `LOCAL_CACHE 3/43`, `History: Saved`, scan ID `20260716T043700_D467`.

### Tài liệu nguồn dữ liệu

- [x] Nguồn nào được chấp nhận.
- [x] Ngày lấy dữ liệu và `retrieved_at`.
- [x] Cách chuyển đổi.
- [x] Ý nghĩa 30D/90D.
- [x] Coin không có lịch unlock xử lý thế nào.
- [x] Coin không match xử lý thế nào.
- [x] Cache hết hạn sau bao lâu.
- [x] Không dùng dữ liệu mẫu để ra quyết định đầu tư thật.

Trạng thái: V1.11 Intake + Converter workflow đã pass bằng controlled/manual test data. Chưa phải dữ liệu unlock thật từ nguồn chính thức.

## V1.12: Unlock Source Workflow

Mục tiêu: chuẩn bị nguồn dữ liệu unlock thật ở dạng CSV/JSON để đưa qua converter V1.11. V1.12 vẫn không gọi API trong scanner, không scrape website và không tự động ghi cache vào AppData.

- [x] Tạo `docs/UNLOCK_SOURCE_WORKFLOW.md`.
- [ ] Chọn nguồn dữ liệu unlock thật được chấp nhận.
- [ ] Tạo CSV thật theo format converter.
- [ ] Chạy converter tạo `unlock-cache.generated.json`.
- [ ] Import file generated vào app.
- [ ] Scan và xác nhận `LOCAL_CACHE x/{candidate_count}` với dữ liệu thật.
- [ ] Ghi audit: nguồn, ngày lấy dữ liệu, `percentage_basis`, coin không match.
