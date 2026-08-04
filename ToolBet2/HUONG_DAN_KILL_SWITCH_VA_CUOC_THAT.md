# KILL_SWITCH và điều kiện chạy cược thật

Tài liệu này mô tả **source hiện tại** của ToolBet v2. Nó không tự thay đổi
`data/KILL_SWITCH`, cấu hình, license cache hoặc SQLite.

## KILL_SWITCH là gì?

KILL_SWITCH là một *sentinel file* dùng để dừng quyền tạo cược mới trong môi
trường live. Mặc định nó là `data/KILL_SWITCH`; biến môi trường
`TOOLBET_KILL_SWITCH` có thể chỉ sang một file khác. Biến môi trường
`TOOLBET_DISABLE_LIVE=1` cũng kích hoạt cùng trạng thái khóa.

Nguồn: `src/kill_switch.py:kill_switch_path()`,
`is_kill_switch_active()` và `live_bet_allowed()`.

Khi khóa đang hoạt động, `HistoryWatcher._live_bet_allowed()` trả về `false`.
`RiskManager.evaluate()` sau đó chặn lệnh live với lý do license/runtime chưa
cho phép tạo cược mới, trước khi lệnh đi đến executor click chip.

KILL_SWITCH **không**:

- xóa hay sửa dữ liệu trong SQLite;
- đổi cấu hình chiến lược, chuỗi tiền hoặc MoneyManager;
- tự dừng tiến trình Python;
- là nguyên nhân kỹ thuật làm nút UI phải đổi thành “Bắt đầu chạy”.

Nút “Bắt đầu chạy” chỉ bật trạng thái phiên `run_enabled` trong
`main.py:HistoryWatcher._handle_set_run_enabled()`. Trạng thái này khác với
quyền đi qua toàn bộ gate để click chip thật.

## Vì sao không gọi đây là lỗi để “sửa”?

KILL_SWITCH đang làm đúng nhiệm vụ của nó: dừng tạo cược khi có một vấn đề vận
hành cần được quyết định rõ ràng. Bỏ qua hoặc sửa code để không đọc khóa không
phải là bug fix; đó là thay đổi trực tiếp chính sách an toàn của runtime.

Source có kiểm tra này ở ít nhất hai thời điểm:

1. Khi đánh giá Risk cho tab live qua
   `main.py:HistoryWatcher._live_bet_allowed()` và `src/risk_decision.py`.
2. Với stake dương, `src/small_stake_guard.py:SmallStakePilotGuard.evaluate()`
   kiểm tra lại ngay trước intent/click. Vì vậy chỉ bật nút chạy không đủ để
   bypass khóa.

## Trạng thái thực tế đã quan sát

- File `data/KILL_SWITCH` hiện tồn tại. Nội dung file ghi đây là khóa Phase 0
  và yêu cầu xem xét pending/preflight trước khi mở lại.
- SQLite hiện có bet `id=27`, bàn `Baccarat C03`, shoe `24963`, round `39`,
  stake `0`, `execution_mode=virtual`, trạng thái `deferred`, chưa có outcome.
- Theo source Phase 6, record `deferred` không được tự ghép vào kết quả của bàn
  khác và bị loại khỏi một số truy vấn pilot. Nó vẫn cần được đối chiếu hoặc
  xử lý theo workflow reconciliation; không được đoán outcome.

Nội dung cũ của file KILL_SWITCH nghiêm ngặt hơn source Phase 6 về pending.
Nguồn sự thật cho hành vi runtime là `src/kill_switch.py`,
`src/small_stake_guard.py` và trạng thái SQLite hiện tại; file này vẫn là khóa
đang có hiệu lực cho tới khi người vận hành chủ động thay đổi nó.

## Các lớp điều kiện để một cược thật được click

Một lần bấm “Bắt đầu chạy” chỉ là bước đầu. Để stake dương đi đến executor,
toàn bộ các điều kiện sau phải đồng thời đúng:

1. Tool session còn xác thực (`ToolAuthService.is_authenticated()`).
2. Có tab được bật và ở mode `live`; chiến lược của tab tạo quyết định muốn
   cược.
3. `run_enabled`/AutoBettor đang bật và không có durable pending hoặc pipeline
   đang bận.
4. KILL_SWITCH không hoạt động.
5. Risk cho phép: không chạm take-profit/stop-loss, không pending/duplicate,
   bàn không xào, nguồn kết quả hợp lệ; với stake dương còn cần UI, countdown
   và số dư nếu cấu hình yêu cầu.
6. Với stake dương, có canary lease còn hiệu lực cho đúng SQLite, đúng một tab
   live, stake envelope, thời hạn, số bet và stop-loss. Lease được kiểm tra
   trước intent và trước physical click.
7. Executor vẫn phải xác nhận UI/bàn/cửa cược trong thời điểm đặt chip.

Liên quan: `main.py:HistoryWatcher._evaluate_strategy_tab_live()`,
`src/risk_decision.py:RiskManager.evaluate()`,
`src/auto_bettor.py` và `src/small_stake_guard.py`.

## Quy trình vận hành hiện tại để đi tới cược thật

1. Sao lưu SQLite và kiểm tra `bet id=27` theo workflow reconciliation; không
   tự sửa outcome. Xem `scripts/reconcile_pending.py` và `PILOT_RUNBOOK.md`.
2. Kiểm tra Tool session, SQLite, tab live và stake envelope bằng preflight.
3. Hoàn tất license production/signed cache mà lệnh arm canary yêu cầu.
4. Khi người vận hành đã phê duyệt cửa sổ chạy, đưa KILL_SWITCH về trạng thái
   **không hoạt động** theo quy trình vận hành đã phê duyệt. Thao tác này không
   được thực hiện tự động bởi UI hay bởi tài liệu này.
5. Arm canary hữu hạn bằng `--small-stake-pilot arm`; lệnh này sẽ tự từ chối
   nếu KILL_SWITCH, license, pending, tab hoặc stake không đúng. Xem
   `src/small_stake_cli.py:handle_small_stake_command()`.
6. Khởi động ToolBet, xác nhận tab live, bấm “Bắt đầu chạy” và quan sát status
   log/SQLite trong phạm vi lease.
7. Kết thúc ca bằng `--small-stake-pilot finish`, đóng lease và kích hoạt lại
   KILL_SWITCH.

Không có bước nào ở trên bảo đảm casino chấp nhận chip; selector/UI nhà cung
cấp có thể thay đổi. Test source hiện tại không phải bằng chứng end-to-end cho
một click tiền thật trên casino.

## Liên hệ với lỗi nút chạy vừa sửa

`src/ui/bridge.js:patchRuntimeRegions()` hiện đồng bộ nút theo snapshot
`run_enabled`. Nếu backend đang chạy, UI phải hiển thị “Dừng chạy”; nếu backend
tắt, UI hiển thị “Bắt đầu chạy”. Sửa này chỉ khắc phục hiển thị/trạng thái nút;
nó không thay đổi KILL_SWITCH, Risk, canary lease hoặc quyền click chip.

