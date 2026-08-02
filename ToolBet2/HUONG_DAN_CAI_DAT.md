# ToolBet v2 — Hướng dẫn cài đặt (máy đích)

Copy nguyên thư mục `ToolBet2` sang máy cần chạy. Không cần copy `.venv`, `data/toolbet.db`, hay `config.yaml` từ máy dev (trừ khi muốn giữ cấu hình cũ).

## Yêu cầu

- Windows 10/11 64-bit
- **Python 3.10+ 64-bit** ([python.org](https://www.python.org/downloads/)) — khi cài nhớ tick **Add Python to PATH**
- **Google Chrome**
- (Khuyến nghị) [Visual C++ Redistributable x64](https://aka.ms/vs/17/release/vc_redist.x64.exe) — tránh lỗi `greenlet` / Playwright

## Cài lần đầu

1. Mở thư mục `ToolBet2` đã copy.
2. Double-click **`ToolBet.bat`**.
3. Lần đầu tool sẽ:
   - tạo `.venv`
   - cài `requirements.txt` (5–15 phút)
   - tải Chromium cho Playwright
   - tạo `config.yaml` từ `config.example.yaml` nếu chưa có
4. Nếu chưa có `credentials.yaml`, tool tạo file mẫu và mở Notepad — điền username/password rồi chạy lại `ToolBet.bat`.
   - Hoặc bỏ trống credentials và **login thủ công trên Chrome** trước khi tool chạy.

## Chạy hàng ngày

1. Double-click **`ToolBet.bat`**.
2. Tool tự mở Chrome CDP (port **9222**, profile `data\cdp_profile`) nếu chưa mở.
3. Vào sảnh AE SEXY / bàn cấu hình trong `config.yaml` (`game.table_name`).
4. Bật **Auto** trên overlay nếu muốn tự đặt cược.

Dừng: `Ctrl+C` trong cửa sổ console, hoặc đóng cửa sổ.

## Cấu hình chính (`config.yaml`)

| Mục | Ý nghĩa |
|-----|---------|
| `site.url` / `site.cdp_url` | URL casino và Chrome debug (`http://localhost:9222`) |
| `game.table_name` | Tên bàn (vd. `Baccarat C01`) |
| `betting.stakes` | Chuỗi stake trong nhóm; **mức 0** = theo dõi (không đặt chip) |
| `betting.auto_bet` | Bật/tắt auto mặc định |
| `betting.stop_loss` / `take_profit` | Giới hạn P&L ngày |
| `betting.group_take_profit` / `group_stop_loss` | Đóng nhóm khi lãi/lỗ nhóm đạt ngưỡng |
| `betting.progression_mode` | Cách tăng stake trong nhóm (xem dưới) |
| `patterns.*` | Bật/tắt mẫu `mau_1_1`, `mau_bet_2` |
| `database.path` | SQLite (mặc định `data/toolbet.db`) |

### `progression_mode` (5 lựa chọn)

- `loss_up_win_reset` — thua tăng theo `loss_count`; thắng khi P&L nhóm còn âm thì tăng tiếp, khi không âm thì về mức đầu và reset `loss_count`
- `win_up_loss_reset` — tăng khi thắng, thua về mức đầu
- `both_up` — thắng/thua đều tăng mức
- `win_up_loss_hold` — thắng tăng mức, thua giữ nguyên
- `profit_lock_loss_up` — thua tăng mức; thắng chỉ về đầu khi P&L nhóm dương, nếu chưa dương thì tăng tiếp

Có thể đổi trên overlay (select + **Lưu**), không bắt buộc sửa YAML tay.

## Chrome CDP thủ công (nếu cần)

Nếu `ToolBet.bat` không mở được Chrome:

```bat
scripts\start_chrome_debug.bat
```

Hoặc:

```text
chrome.exe --remote-debugging-port=9222 --user-data-dir="...\ToolBet2\data\cdp_profile"
```

Đóng hết Chrome thường trước khi dùng profile CDP riêng.

## Script tiện ích

| File | Công dụng |
|------|-----------|
| `scripts\stop_running_toolbet.ps1` | Dừng instance `main.py` cũ (ToolBet.bat gọi sẵn) |
| `scripts\start_chrome_debug.bat` | Mở Chrome debug |
| `scripts\query_bets.py` | Xem lịch sử cược trong DB |
| `scripts\query_pattern_stats.py` | Thống kê theo mẫu |

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| Không tìm thấy Python | Cài Python 64-bit, tick Add to PATH, mở lại CMD |
| Lỗi `greenlet` / không import Playwright | Cài VC++ Redistributable x64 → xóa `.venv` → chạy lại `ToolBet.bat` |
| Không kết nối Chrome / CDP | Mở Chrome port 9222; tắt Chrome thường đang giữ profile |
| Overlay không hiện | Đảm bảo đang trong bàn AE SEXY, refresh trang, xem log console |
| Không đặt chip (stake 0) | Đúng thiết kế mức theo dõi — xem chuỗi `betting.stakes` |

## Chuẩn bị bản deploy

Project hiện không có bước build hoặc `build.bat`. Để triển khai sang máy khác:

1. Copy thư mục source `ToolBet2`.
2. Không cần copy `.venv`, `data/cdp_profile`, `data/toolbet.db`, `config.yaml` hoặc `credentials.yaml` trừ khi chủ động muốn giữ dữ liệu/cấu hình cũ.
3. Trên máy đích, chạy `ToolBet.bat`; script sẽ tạo môi trường và các file cấu hình cần thiết.
