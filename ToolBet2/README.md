# ToolBet v2

## Controlled runtime validation

Run the isolated browser/SQLite flow before any real Chrome validation:

```powershell
.venv\Scripts\python.exe scripts\controlled_runtime_validation.py
```

The runner uses headless Chromium, synthetic UI snapshots, and a temporary
SQLite database. It does not read credentials, `config.yaml`, the production
database, or the Chrome CDP profile.

To validate the CDP connection layer with an isolated random port and profile:

```powershell
.venv\Scripts\python.exe scripts\controlled_cdp_validation.py
```

To collect a short isolated CPU/RAM sanity baseline, run:

```powershell
scripts\measure_controlled_cdp_resources.ps1 -DurationSeconds 60
```

Ứng dụng Python/Playwright điều khiển Chrome CDP để theo dõi Baccarat AE SEXY,
hiển thị workspace chiến lược và journal cược cục bộ SQLite.

## Bắt đầu đọc

1. [AGENTS.md](AGENTS.md) — quy trình bắt buộc cho AI coding.
2. [CURRENT_STATE.md](CURRENT_STATE.md) — trạng thái có bằng chứng, đọc trong
   khoảng 1–2 phút.
3. [ARCHITECTURE.md](ARCHITECTURE.md) — module, state ownership và lifecycle.
4. [BUSINESS_RULES.md](BUSINESS_RULES.md) — rule cược, pending và reconcile.
5. [TABLE_SELECTION_WORKFLOW.md](TABLE_SELECTION_WORKFLOW.md) — vào/chọn bàn AE.
6. [TODO.md](TODO.md) và [BUGS.md](BUGS.md) — việc còn thiếu/rủi ro đã xác minh.

## Chạy trên Windows

Xem [HUONG_DAN_CAI_DAT.md](HUONG_DAN_CAI_DAT.md) và dùng `ToolBet.bat`.
Không đưa `credentials.yaml`, `config.yaml`, SQLite hoặc Chrome profile vào
commit. Dùng `config.example.yaml`/`credentials.example.yaml` làm mẫu.

## Kiểm tra

Test nằm trong `tests/`. Chạy bằng Python environment đã cài dependency; nếu
runner thiếu `pytest`, ghi rõ đó là giới hạn kiểm chứng thay vì tuyên bố test
đạt. Với browser/live flow, ưu tiên Simulation hoặc `auto_bet=false`.
