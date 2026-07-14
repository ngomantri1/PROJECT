# Công việc đề xuất cho Codex

## Ưu tiên P0
1. Chạy build, sửa mọi lỗi compiler trên máy Windows.
2. Thêm retry/backoff, timeout và cache API.
3. Thêm `scanner-settings.json`, không hard-code ngưỡng.
4. Thêm mapping coin ID ↔ Binance symbol an toàn.
5. Không bỏ qua exception âm thầm; ghi log ra file.

## P1
1. SQLite snapshots và lịch sử quét.
2. Token unlock adapter: PASS / FAIL / UNKNOWN / CONFLICT.
3. DefiLlama adapter.
4. GitHub adapter.
5. Order-book spread/depth.
6. MACD, volume expansion, breakout/retest chính xác hơn.

## P2
1. Trang Coin Details và biểu đồ.
2. Watchlist, portfolio 700 triệu, stop-loss và targets.
3. Windows Task Scheduler.
4. Xuất CSV/XLSX.
5. Unit tests cho indicators và scoring.

## Quy tắc
- Không coi thiếu dữ liệu là PASS.
- BUY READY yêu cầu unlock != FAIL, DataQuality >=80%, R:R >=2.
- Giữ API clients tách biệt để thay nguồn dễ dàng.
