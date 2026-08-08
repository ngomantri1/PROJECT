# Project Context

## Mục tiêu

ToolBet v2 là ứng dụng Windows/Python theo dõi Baccarat AE SEXY trong Chrome,
đồng bộ lịch sử bàn, tính tín hiệu/chuỗi tiền theo từng tab chiến lược, hiển
thị overlay và (khi đủ quyền/gate) thực hiện click chip qua Playwright/CDP.
SQLite là dữ liệu cục bộ cho cấu hình tab, journal cược, round và audit.

## Quyết định ổn định

- Tool Login là cổng trước Game Login; credential Tool và Game tách biệt.
- Mỗi tab chiến lược sở hữu cấu hình, MoneyManager và run state riêng. SQLite là
  nguồn cấu hình workspace khi đã có tab lưu; YAML chỉ là fallback/import ban đầu.
- `Bắt đầu chạy`/`Dừng chạy` là latch theo phiên, trong bộ nhớ; internal pause
  không được biến thành Stop. Start của tab hợp lệ được tính từ history hiện có
  và arm cho round kế tiếp, không cần chờ thêm một kết quả chỉ để khởi động.
- Mô phỏng dùng cùng pipeline quyết định, progression, journal và reconcile như
  Live; khác ở bước thực thi: Simulation ghi virtual và không click chip.
- Tiền thắng phiên chạy, giới hạn Cắt lãi/Cắt lỗ và các số thống kê tích lũy là
  các khái niệm khác nhau; reset phiên không được xóa thống kê dài hạn. Reset
  thống kê chỉ do lệnh reset của người dùng.
- Một logical bet được định danh theo table/shoe/round; placement attempt và
  allocation được journal riêng để giữ bằng chứng click và chống trùng.
- Pending phải scope theo bàn và round. Click không chắc chắn được giữ dưới dạng
  `uncertain`/`deferred`, không tự suy ra đã đặt hoặc tự ghi kết quả.
- Kết quả đáng tin phải đi qua thứ tự reconcile hiện có (WS/HTTP ưu tiên hơn
  DOM/canvas/lobby history). DOM/canvas chỉ hỗ trợ nhận diện UI, chip, card hoặc
  bootstrap khi source chuẩn chưa đủ.
- Overlay là UI trong trang game, có thể mất khi navigation/reload và phải được
  cài lại idempotent mà không che thao tác click cược.
- Bàn cấu hình mặc định hiện là `Baccarat C01`; khi ở sảnh, runtime thử theo
  danh sách ứng viên và guard table-ready. Bàn thực tế đã mở được ưu tiên hơn
  cấu hình sảnh. Chi tiết nằm trong [TABLE_SELECTION_WORKFLOW.md](TABLE_SELECTION_WORKFLOW.md).

## Phạm vi hiện tại

Các site adapter nằm trong `src/sites/`; collector AE SEXY dùng WS/HTTP cùng
polling DOM/canvas; runtime chiến lược nằm ở `strategy_tabs.py`,
`statistical_strategies.py` và `strategy_lifecycle.py`; execution/pending nằm ở
`auto_bettor.py`, `betting_session.py`, `database.py` và `db_store.py`.

License có hai client được source hỗ trợ: `signed` và
`baccarat_chrome_agent2` (GitHub license + Worker lease). File mẫu mặc định
`license.enabled=false`; không đưa credential, token hoặc database runtime vào
tài liệu hay commit.

## Tài liệu liên quan

- Kiến trúc và state ownership: [ARCHITECTURE.md](ARCHITECTURE.md)
- Rule cược/reconcile: [BUSINESS_RULES.md](BUSINESS_RULES.md)
- Trạng thái có bằng chứng: [CURRENT_STATE.md](CURRENT_STATE.md)
- Việc còn thiếu: [TODO.md](TODO.md)
- Bug/rủi ro đã xác minh: [BUGS.md](BUGS.md)
- Cài đặt/chạy: [README.md](README.md)
