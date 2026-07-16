# TODO

## Trạng thái hiện tại

- [x] Baseline chạy được.
- [x] Build sạch khi app không khóa file output.
- [x] CoinGecko + Binance scan.
- [x] Technical analysis cơ bản.
- [x] Candidate ranking trước technical.
- [x] Export `market_snapshot_*.json`.
- [x] Export `scanner_log_*.json`.
- [x] Log runtime trong AppData Local.
- [x] History foundation với `history_index.json`.
- [x] Backtest foundation.
- [x] Metrics engine foundation.
- [x] Cached Unlock Provider đọc local cache.
- [x] V1.8 Mini Health Dashboard.
- [x] UI refactor: DataGrid gọn, detail panel, search/filter, status badge, open export.
- [x] Fix style: disabled button, search/filter, DataGrid header, header border.

## P0 - Việc cần giữ ổn định

- [ ] Khi sửa UI không được sửa scanner/scoring/export schema.
- [ ] Khi sửa scanner không được làm export phụ thuộc `CoinDisplayItem`.
- [ ] Mỗi lần sửa xong phải build khi app đã tắt.
- [ ] Kiểm tra Visual Studio Output không có binding error.
- [ ] Không để manual export tạo duplicate history.
- [ ] Không dùng dữ liệu unlock fake/test cho quyết định đầu tư thật.

## V1.8 - Cần test nốt để chốt hoàn toàn

- [x] Scanner Health đọc scanner log mới nhất.
- [x] Backtest Summary đọc backtest result mới nhất.
- [x] History Summary đọc `history_index.json`.
- [x] Dữ liệu Scanner/History/Backtest đã khớp trong lần kiểm tra: 14 history entries, 14 backtest snapshots.
- [x] `Retention` không có dữ liệu thì hiển thị `--`.
- [ ] Mở app và xác nhận Health panel hiển thị đúng số mới nhất.
- [ ] Quét lại và xác nhận Scanner/History tự refresh.
- [ ] Chạy backtest và xác nhận Backtest panel tự refresh.
- [ ] Kiểm tra Output không có binding error.
- [ ] Test thiếu thư mục/file: exports, backtests, history.
- [ ] Test JSON hỏng: scanner log hỏng, backtest result hỏng, history index hỏng.
- [ ] File mới nhất hỏng thì AppHealthService chọn file hợp lệ trước đó.

## V1.8.1 - Unlock Cache Management

Mục tiêu: làm rõ và quản lý `unlock-cache.json` vì V1.7 hiện chỉ đọc cache, không tự tạo dữ liệu unlock.

- [x] Khi app khởi động, đảm bảo thư mục `%LOCALAPPDATA%\CryptoScanner.Desktop\data` tồn tại.
- [x] Tạo file hướng dẫn `README_unlock_cache.txt` nếu chưa có.
- [x] Không tự tạo dữ liệu unlock fake.
- [x] Health/log hiển thị rõ expected path của unlock cache khi missing.
- [ ] Bổ sung tài liệu cách copy `config\unlock-cache.example.json` sang AppData để test.
- [x] Test không có file: `CACHE_MISSING`, không crash.
- [x] Test provider file hợp lệ: `LOCAL_CACHE`, match > 0.
- [x] Test provider JSON sai: `CACHE_ERROR`, không crash.
- [x] Test provider cache hết hạn: `LOCAL_CACHE_EXPIRED`.
- [x] Build sạch sau patch V1.8.1.
- [x] Test scan end-to-end với file hợp lệ: `LOCAL_CACHE`.
- [x] Test scan end-to-end với JSON sai: `CACHE_ERROR`, app không crash.
- [x] Test scan end-to-end với cache hết hạn: `LOCAL_CACHE_EXPIRED`.
- [x] Kiểm tra Health UI hiển thị `CACHE_MISSING 0/45` đúng theo scanner log mới nhất.

Trạng thái: hoàn tất. Không tạo dữ liệu unlock giả, không đổi scanner/scoring/snapshot/backtest.

## V1.9 - Manual Unlock Import

Mục tiêu: cho phép người dùng chọn file JSON unlock từ máy tính, validate trước rồi nhập an toàn vào `%LOCALAPPDATA%\CryptoScanner.Desktop\data\unlock-cache.json`.

- [x] Thêm `UnlockCacheInspector` để provider và importer dùng chung logic đọc/validate.
- [x] Chuyển `CachedUnlockProvider` sang dùng chung inspector.
- [x] Thêm `UnlockImportResult`.
- [x] Thêm `UnlockCacheImportService`.
- [x] Giới hạn file import 5 MB.
- [x] Validate file tồn tại, đọc được, không rỗng, JSON parse được.
- [x] Validate `schema_version = 1.0`, `updated_at`, `items`.
- [x] Validate item có `coin_id` hoặc `symbol`.
- [x] Validate `unlock_30d_pct` và `unlock_90d_pct` trong khoảng 0-100.
- [x] Từ chối duplicate `coin_id` hoặc duplicate `symbol`.
- [x] Từ chối file không có item hợp lệ.
- [x] Cho phép import cache hết hạn nhưng báo cảnh báo.
- [x] Ghi file theo cơ chế temp file trong cùng thư mục data.
- [x] Thay cache thật bằng thao tác nguyên tử khi file đích đã tồn tại.
- [x] Tạo tối đa một backup `unlock-cache.previous.json`.
- [x] Import lỗi giữ nguyên cache cũ.
- [x] Copy byte sau validation để không đổi encoding/format file nguồn.
- [x] Thêm `ImportUnlockCacheCommand`.
- [x] Disable import khi app đang busy/scan/export/backtest.
- [x] Thêm nút `IMPORT UNLOCK` trên toolbar.
- [x] Import thành công không tự chạy scanner; UI nhắc chạy scanner lại.
- [x] Ghi log `UNLOCK_IMPORT_SUCCESS` / `UNLOCK_IMPORT_FAILED`.
- [x] Test service: valid import.
- [x] Test service: invalid JSON không ghi đè file cũ.
- [x] Test service: duplicate coin_id bị từ chối.
- [x] Test service: percentage sai bị từ chối.
- [x] Test service: expired cache import thành công kèm trạng thái expired.
- [x] Test service: invalid JSON giữ nguyên SHA-256 cache cũ và không để lại temp file.
- [x] Test service: file đích bị khóa trả `WRITE_FAILED`, giữ nguyên SHA-256 cache cũ và dọn temp file.
- [x] Build sạch sau patch V1.9.
- [x] Thêm bộ file test thủ công trong `test-data/unlock-import`.
- [x] Test thủ công nút `IMPORT UNLOCK` mở file picker trong UI.
- [x] Test thủ công import file hợp lệ rồi chạy scan, Health chuyển sang `LOCAL_CACHE`.
- [x] Test thủ công import JSON hỏng không ghi đè cache hợp lệ.
- [x] Test thủ công import cache hết hạn rồi chạy scan, Health chuyển sang `LOCAL_CACHE_EXPIRED`.
- [x] Restore trạng thái sạch bằng cách import lại `valid-unlock-cache.json` và scan ra `LOCAL_CACHE 3/44`.
- [ ] Kiểm tra Visual Studio Output không có binding error sau khi mở UI V1.9.
- [x] Chốt V1.9 DONE với bằng chứng UI/import/scanner/history/snapshot; Output binding để lại checklist vận hành nếu cần.

Trạng thái: hoàn tất. Test UI đã xác nhận `LOCAL_CACHE`, invalid JSON không crash/không ghi đè, `LOCAL_CACHE_EXPIRED`, và restore cache hợp lệ. Không gọi API unlock, không tạo dữ liệu giả, không đổi scanner/scoring/snapshot/backtest.

## Ưu tiên trung hạn

- [ ] Metrics Engine nâng cao: average return, median return, win rate, BTC outperform theo status/decision/risk.
- [ ] CryptoRank/Token Unlock provider thật hoặc manual import pipeline.
- [ ] GitHub activity provider.
- [ ] DefiLlama TVL/revenue provider.
- [ ] News/risk provider.
- [ ] BTC Regime Engine nâng cấp: Strong Bull, Bull, Neutral, Bear, Strong Bear.
- [ ] FinalScore engine sau khi có đủ nguồn dữ liệu.
- [ ] Backtest Review UI sau khi metrics đủ ổn.

## Chưa hoàn thành

- [ ] Unlock API thật.
- [ ] DefiLlama adapter.
- [ ] GitHub adapter.
- [ ] News/risk adapter.
- [ ] Order-book spread/depth.
- [ ] ATR, volume expansion, breakout/retest chính xác.
- [ ] Relative strength với BTC/ETH nâng cao.
- [ ] Risk/Reward, entry, stop-loss, targets.
- [ ] SQLite snapshots/history/cache.
- [ ] Chart.
- [ ] Watchlist.
- [ ] Portfolio.
- [ ] Settings UI.
- [ ] API Health UI nâng cao.
- [ ] Export HTML/CSV/XLSX.

## V1.10 - Stabilization

Phạm vi: chỉ ổn định runtime, retry/cancel, file integrity, logging và tài liệu. Không thêm API, không scrape, không thêm provider mới, không đổi scoring, snapshot schema hoặc backtest engine.

- [x] CoinGecko lỗi tạm thời hiển thị popup ngắn, không hiện stack trace.
- [x] Log kỹ thuật vẫn giữ chi tiết lỗi CoinGecko.
- [x] Retry/backoff CoinGecko có số lần tối đa và timeout.
- [x] Scan lỗi không xóa bảng kết quả cũ.
- [x] Scan lỗi không ghi snapshot/history thành công giả.
- [x] Scanner Health cập nhật từ kết quả scan vừa chạy trong bộ nhớ.
- [x] Unlock cache pipeline verified with controlled test data: `LOCAL_CACHE 3/{candidate_count}`.
- [x] History save phục hồi sau lỗi metadata null.
- [x] Latest verification: `LOCAL_CACHE 3/43`, `History: Saved`, scan ID `20260716T031514_BA3D`.
- [x] Test người dùng bấm `DỪNG` trong lúc scan đang chạy/retry: app không treo, không popup lặp, nút trở lại đúng trạng thái.
- [ ] Xác nhận Debug build sạch sau khi đóng app, không còn file lock.
- [ ] Xác nhận Release build sạch và chạy smoke test bản Release.
- [ ] Kiểm tra Visual Studio Output không có binding error sau V1.10.

Ghi chú: `LOCAL_CACHE 3/{candidate_count}` chỉ chứng minh pipeline cache/import/provider hoạt động với dữ liệu kiểm thử có kiểm soát. Đây không phải bằng chứng dữ liệu unlock thật hoặc chính xác cho đầu tư.

## V1.11 - Real Unlock Data Intake & Normalization

Mục tiêu: chuyển dữ liệu unlock lấy từ nguồn bên ngoài sang schema nội bộ của CryptoScanner với nguồn gốc, thời gian cập nhật và ý nghĩa phần trăm rõ ràng. Không tự gọi web/API trong app.

- [x] Khóa tài liệu schema cache hiện tại trước khi mở rộng.
- [x] Quy định `unlock_30d_pct` và `unlock_90d_pct` dùng mẫu số nào.
- [x] Khuyến nghị hiện tại: phần trăm token sẽ unlock trong kỳ so với circulating supply tại thời điểm dữ liệu được thu thập.
- [x] Chuẩn hóa identity: ưu tiên `coin_id` CoinGecko, `symbol` chỉ là fallback.
- [x] Thiết kế template dữ liệu thật thủ công, không dùng file test để ra quyết định đầu tư.
- [x] Thiết kế converter ngoài app chính: CSV/JSON đơn giản -> `unlock-cache.json`.
- [x] Converter validate duplicate, percentage, required fields và report item lỗi.
- [x] Converter không tự copy vào AppData; người dùng vẫn import qua V1.9.
- [x] Converter workflow pass qua app: `LOCAL_CACHE 3/43`, `History: Saved`, scan ID `20260716T043700_D467`.
- [x] Tài liệu nguồn dữ liệu được chấp nhận, ngày lấy dữ liệu, cách convert, cache expiry, coin không match.

Trạng thái: V1.11 Intake + Converter workflow đã pass bằng controlled/manual test data. Chưa phải dữ liệu unlock thật từ nguồn chính thức.

## V1.12 - Unlock Source Workflow

Mục tiêu: chuẩn bị CSV dữ liệu unlock thật từ nguồn ngoài để đưa qua converter V1.11. Không gọi API trong scanner, không scrape và không tự ghi AppData.

- [x] Tạo tài liệu workflow nguồn dữ liệu thật: `docs/UNLOCK_SOURCE_WORKFLOW.md`.
- [ ] Chọn nguồn dữ liệu unlock thật được chấp nhận.
- [ ] Tạo CSV thật theo format converter.
- [ ] Chạy converter tạo `unlock-cache.generated.json`.
- [ ] Import file generated vào app.
- [ ] Scan và xác nhận `LOCAL_CACHE x/{candidate_count}` với dữ liệu thật.
- [ ] Ghi rõ nguồn, ngày lấy dữ liệu, `percentage_basis`, coin không match.

Không làm trong V1.11: scrape website, nhúng trình duyệt, hardcode HTML selector, tự đăng nhập website, gọi API trong scanner, tự suy đoán coin khi symbol trùng.

## Cần refactor

- [ ] Tách interface cho clients/services.
- [ ] Thêm DI.
- [ ] Dùng `IHttpClientFactory` hoặc shared managed `HttpClient`.
- [ ] Mở rộng retry/error handling cho các API/backtest path còn lại nếu cần.
- [ ] Tách filter, scoring, decision, market regime khỏi `ScannerService`.
- [ ] Thay magic string setup/status/rules bằng enum/value object hoặc constants tập trung.
- [ ] Chuẩn hóa result/error contract.
- [ ] Tách DTO API khỏi domain model.
- [ ] Thêm test project.

## Cần test lại

- [ ] Parse Binance `quoteVolume` theo invariant culture.
- [ ] CoinGecko pagination/rate limit.
- [ ] Cancellation giữa API calls và delay.
- [ ] RSI với dữ liệu ngắn, loss=0, dữ liệu phẳng.
- [ ] EMA period lớn hơn số mẫu.
- [ ] Setup `EARLY_REVERSAL` tránh false positive.
- [ ] Setup `BREAKOUT_CANDIDATE` khi chưa có breakout confirmed.
- [ ] Mapping symbol với coin trùng ticker.
- [ ] Missing FDV/total supply không làm coin đạt tiêu chí sai.
- [ ] Score/status boundaries.
- [ ] Unlock PASS/WARN/FAIL thresholds.
- [ ] History không duplicate khi manual export.
- [ ] Backtest PENDING không dùng giá hiện tại.
- [ ] AppHealthService với file thiếu/hỏng.
- [ ] WPF binding sau mỗi lần chỉnh UI.

## Lưu ý vận hành

- Nếu build báo file locked bởi `CryptoScanner.Desktop`, phải dừng app trong Visual Studio trước khi build.
- `unlock-cache.json not found` không phải lỗi scan; đó là trạng thái chưa có dữ liệu unlock local.
- File AppData mới là dữ liệu runtime thật; file trong `config` chỉ là mẫu/cấu hình project.
