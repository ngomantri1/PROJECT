# AGENTS.md

## Project

ToolBet v2 là ứng dụng Windows/Python tự động theo dõi Baccarat AE SEXY trong Chrome, phân tích mẫu, hiển thị overlay và có thể đặt cược tự động. Stack chính: Python 3.10+, `asyncio`, Playwright/CDP, SQLAlchemy/SQLite, Pydantic/YAML, Pillow và ddddocr.

Đọc context theo thứ tự:

1. `CURRENT_STATE.md`
2. `PROJECT_CONTEXT.md`
3. `ARCHITECTURE.md`
4. `BUSINESS_RULES.md`
5. `TODO.md` và `BUGS.md`

## Quy tắc khi sửa

- Ưu tiên thay đổi nhỏ nhất đúng phạm vi; không refactor ngoài task.
- Source hiện tại là nguồn sự thật. Không suy nghiệp vụ từ tên file hay tài liệu cũ.
- Giữ Python type hints, `snake_case` cho hàm/biến/module, `PascalCase` cho class và hằng số viết hoa.
- Giữ các thao tác Playwright bất đồng bộ; không chèn I/O blocking vào event loop.
- Không làm gián đoạn luồng đặt cược đang chạy. Recovery phải chờ `AutoBettor` idle và tôn trọng lock/pending bet.
- Chỉ một bet pending cho mode chính và một pending riêng cho Nuôi Hòa; không bỏ cơ chế chống đặt trùng theo round.
- Không coi DOM/canvas/lobby history là nguồn kết quả đáng tin ngang WS/HTTP nếu code hiện tại đang yêu cầu reconcile.
- Mọi cập nhật UI phải đi qua `GameOverlay`; overlay được inject vào trang và có thể mất khi navigation/reload.
- Site mới phải có adapter riêng trong `src/sites/`; không dùng selector đăng nhập của site này cho site khác.
- Giữ allowlist site/tab binding để không thao tác nhầm tab khi nhiều web cùng mở.
- Không commit `credentials.yaml`, `config.yaml`, `data/toolbet.db` hoặc `data/cdp_profile/`. Không log username/password, token, cookie hay payload nhạy cảm.
- Không sửa schema trực tiếp bằng tay; cập nhật model và migration tương thích DB cũ trong `src/database.py`.
- Sau khi sửa, tối thiểu parse/import toàn bộ module. Với logic thuần, bổ sung/chạy test tập trung; với browser flow, xác minh trên session không có tiền thật hoặc bật `auto_bet: false`.

