# TODO

## P0 — Ưu tiên cao
- [ ] Build solution trên Windows/.NET 10 và sửa toàn bộ compiler/runtime error.
- [ ] Thay `async` lambda trên `RelayCommand` bằng `AsyncRelayCommand` có quản lý exception và trạng thái chạy.
- [ ] Không nuốt exception trong vòng quét từng coin và BTC regime; ghi lỗi theo coin/source.
- [ ] Thêm timeout, retry exponential backoff và xử lý HTTP 429/5xx.
- [ ] Dùng `IHttpClientFactory` hoặc shared managed `HttpClient` qua DI.
- [ ] Đưa filter/scoring thresholds ra `scanner-settings.json`.
- [ ] Xây mapping CoinGecko ID ↔ Binance symbol an toàn; xử lý ticker trùng tên.
- [ ] Thêm trạng thái dữ liệu `PASS/FAIL/UNKNOWN/CONFLICT`.
- [ ] Version hóa schema `market_snapshot.json` và thêm source timestamp/error summary.

## Task đang làm / baseline hiện có
- [x] WPF dark dashboard.
- [x] Scan/Cancel/Export commands.
- [x] CoinGecko market fetch.
- [x] Binance ticker + H4/D1 candles.
- [x] RSI/EMA/setup cơ bản.
- [x] Filter và scoring sơ bộ.
- [x] JSON export.

## Chưa hoàn thành
- [ ] Unlock adapter.
- [ ] DefiLlama adapter.
- [ ] GitHub adapter.
- [ ] News/risk adapter.
- [ ] Order-book spread/depth.
- [ ] MACD, ATR, volume expansion, breakout/retest chính xác.
- [ ] Relative strength với BTC/ETH.
- [ ] Risk/Reward, entry, stop-loss, targets.
- [ ] Data quality thực tế theo nguồn.
- [ ] SQLite snapshots/history/cache.
- [ ] Coin Details, chart, watchlist, portfolio.
- [ ] Export CSV/XLSX/HTML và scanner log.
- [ ] Settings UI và API status.

## Cần refactor
- [ ] Tách interface cho clients/services.
- [ ] Tách filter, scoring, market regime khỏi `ScannerService`.
- [ ] Thay magic string setup/status bằng enum/value object.
- [ ] Thay hard-coded `Take(45)`, delays, periods và thresholds bằng config.
- [ ] Chuẩn hóa result/error contract.
- [ ] Tách DTO API khỏi domain model.
- [ ] Bổ sung dependency injection và structured logging.

## Cần test lại
- [ ] Parse Binance `quoteVolume` theo invariant culture.
- [ ] CoinGecko pagination/rate limit.
- [ ] Cancellation giữa các API calls và `Task.Delay`.
- [ ] RSI với dữ liệu ngắn, loss=0 và dữ liệu phẳng.
- [ ] EMA period lớn hơn số mẫu.
- [ ] Setup `EARLY_REVERSAL` tránh index lỗi và false positive.
- [ ] Mapping symbol đối với coin trùng ticker.
- [ ] Missing FDV/total supply không được làm coin vượt filter mặc định.
- [ ] Score/status boundaries.
- [ ] JSON schema và decimal serialization.
- [ ] UI command enable/disable sau lỗi hoặc hủy.
