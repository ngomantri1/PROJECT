# ToolBet2 Resource Baseline

Mục tiêu của baseline là đo riêng hai nhóm tiến trình:

- `toolbet_python`: tiến trình Python chạy `main.py` và tiến trình con.
- `toolbet_chrome`: cây Chrome có `--remote-debugging-port` và dùng
  `data/cdp_profile` của project.

Chrome được báo cáo riêng vì giao diện Strategy Manager mới chỉ được phép tăng
nhẹ tài nguyên Python/overlay, không được tạo thêm WebView2 hoặc browser runtime.

## Chạy test nền

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_tests.ps1
```

Lệnh chạy toàn bộ `unittest` trong `tests/`, sau đó compile `main.py`, `src/` và
`tests/`. Test không kết nối browser và không đặt cược.

## Đo tài nguyên

Mở ToolBet2 và để nó ở trạng thái cần so sánh, sau đó chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\measure_resource_baseline.ps1 `
  -DurationSeconds 300 `
  -IntervalSeconds 1 `
  -Scenario "in-game-auto-off"
```

Kết quả được ghi vào `reports/`:

- `resource-baseline-*.json`: số liệu tổng hợp min/mean/p95/max.
- `resource-baseline-*.csv`: từng mẫu để phân tích lại.

CPU được chuẩn hóa theo tổng số logical processor, tương tự tỷ lệ sử dụng toàn
máy. Mẫu đầu tiên không có CPU delta nên bị loại khỏi phần tổng hợp.

Script sẽ dừng với lỗi nếu không tìm thấy tiến trình Python của ToolBet2. Điều
này ngăn một lần đo khi ứng dụng chưa chạy bị ghi nhận nhầm thành baseline 0%.

## Quy trình so sánh

Để kết quả trước/sau có ý nghĩa, cả hai lần đo phải dùng cùng:

1. Máy tính và nguồn điện.
2. Site, bàn và số tab Chrome.
3. Trạng thái video/âm thanh.
4. Khoảng thời gian đo, khuyến nghị tối thiểu 5 phút.
5. Trạng thái `auto_bet`; nên đo riêng `idle` và `active`.

Baseline phát hành cần ít nhất ba kịch bản:

| Kịch bản | Thời lượng | Mục đích |
|---|---:|---|
| Trong game, auto bet tắt | 5 phút | Idle runtime và overlay |
| Trong game, theo dõi qua nhiều round | 15 phút | Collector, phân tích, DB |
| Recovery có kiểm soát, không có pending bet | 5 phút | Đỉnh CPU/RAM khi phục hồi |

Không chủ động gây recovery hoặc bật cược thật chỉ để đo tài nguyên.

## Baseline kỹ thuật ngày 2026-08-02

Môi trường: Windows 10 Pro build 19045, RAM 32 GB, 12 logical processor,
Python 3.13.3. ToolBet được khởi động với `auto_bet=false`; Chrome dùng profile
riêng của project.

Đây là baseline khởi động/runtime ban đầu, chưa phải baseline 15 phút tại một
bàn game ổn định:

| Cửa sổ | Nhóm | CPU mean / p95 | Working set mean / p95 |
|---|---|---:|---:|
| Warm-up 60 giây | Python | 3.742% / 7.127% | 244.403 / 275.070 MB |
| Warm-up 60 giây | Chrome | 11.635% / 19.621% | 1392.201 / 1467.648 MB |
| Runtime auto-off 45 giây | Python | 3.014% / 9.195% | 269.818 / 277.086 MB |
| Runtime auto-off 45 giây | Chrome | 11.359% / 18.729% | 1404.669 / 1427.121 MB |

Trong các cửa sổ hoạt động, nhóm Python gồm launcher/runtime và hai worker con
ngắn hạn. Sau khi ổn định, hai worker này có thể biến mất; chúng vẫn được tính
vào baseline vì là chi phí thực của luồng hiện tại.

File chi tiết:

- `reports/resource-baseline-20260802-130608.json` và `.csv`: warm-up 60 giây.
- `reports/resource-baseline-20260802-130743.json` và `.csv`: runtime 45 giây.
