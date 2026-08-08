# Giai đoạn G — Chiến lược AI/thống kê

> **Tài liệu milestone.** Nội dung port/kiểm thử chiến lược được giữ để truy
> vết quyết định; trạng thái hiện tại phải lấy từ source/test và
> [CURRENT_STATE.md](CURRENT_STATE.md), không lấy các dòng trạng thái cũ ở đây
> làm bằng chứng hoàn thành.

## Phạm vi đã nối

Các chiến lược dưới đây chạy qua cùng `StrategyDecision`. Chúng dùng được trong
tab `simulation` hoặc `live`; Shadow cũ chỉ còn là công cụ so sánh. Chúng không
gọi Playwright, không chọn stake và không click chip:

- `ai_stat_parity` — Bám cầu B/P theo thống kê AI
- `sequence_follow` — Chuỗi B/P tự nhập (`BPP` sẽ lặp B → P → P)
- `pattern_follow` — Thế cầu B/P tự nhập (`BPP-BP; PP-P`)
- `random_side` — Cửa B/P ngẫu nhiên, giữ nguyên cửa đã chọn đến settle
- `state_transition` — Xu hướng chuyển trạng thái
- `run_length` — Run-length
- `ensemble_majority` — Chuyên gia bỏ phiếu
- `time_sliced_hedge` — Lịch chẻ 10 tay
- `knn_subsequence` — KNN chuỗi con
- `dual_schedule_hedge` — Lịch hai lớp
- `online_ngram` — AI học tại chỗ (n-gram)
- `expert_panel` — Hội đồng chuyên gia
- `top10_pattern` — Top10 tích lũy
- `parity_hotback` — Chuỗi cầu B/P hay về

Tie bị loại khỏi chuỗi B/P và không làm thay đổi tín hiệu của các thuật toán này.
Các thuật toán ngẫu nhiên/tie-break trong bản tham chiếu được đổi thành
deterministic tie-break để replay, shadow và restart cho cùng một kết quả.

## Chốt an toàn

`sequence_major_minor` và `pattern_major_minor` có trong registry để giao diện
không làm mất nghiệp vụ tham chiếu, nhưng trả `skip` và không được bật live.
Hai thuật toán này cần số tiền pool Banker/Player và chuỗi N/I; collector ToolBet2
hiện tại chưa cung cấp các trường đó. Không suy diễn N/I từ kết quả B/P.

`expert_panel` giữ chú thích kỹ thuật rằng nguồn Top10 trong project C# là
`mock/glue`. Khi một tab được chuyển trực tiếp sang live, các gate RiskDecision
và license vẫn giữ nguyên.

## Chạy kiểm thử

```powershell
.\scripts\run_tests.ps1
```

Kiểm thử riêng phần G:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_statistical_strategies -v
```

## Golden vectors C# / Python

Các vector quản lý vốn và tám chiến lược xác định dùng chung nằm tại
`tests/golden_vectors/`. Strategy harness tham chiếu trực tiếp assembly hiện tại
của BaccaratChromeAgent2 thay vì sao chép thuật toán. Chạy cả reference C# và
ToolBet Python bằng:

```powershell
.\scripts\verify_golden_vectors.ps1
```
