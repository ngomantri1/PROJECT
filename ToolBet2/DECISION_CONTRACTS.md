# Decision Contracts

Ba contract tách quyết định cược thành ba trách nhiệm độc lập:

```text
StrategyContext
  -> BetStrategy.evaluate()
  -> StrategyDecision
  -> MoneyManager.quote()
  -> MoneyQuote
  -> RiskManager.evaluate()
  -> RiskDecision
  -> AutoBettor / executor
```

Các module này là domain thuần Python. Chúng không import `main.py`, Playwright,
database hoặc overlay.

## StrategyDecision

Source: `src/strategy_decision.py`.

`StrategyContext` là snapshot bất biến gồm lịch sử, bàn, shoe, round và source.
Một `BetStrategy` chỉ được đọc context và trả một trong hai kết quả:

- `StrategyAction.BET`: bắt buộc có `side`, `reason`, `strategy_id`.
- `StrategyAction.SKIP`: không được có `side`, luôn có lý do bỏ qua.

`confidence` nằm trong `[0, 1]`. Đây là độ tin cậy do từng chiến lược định nghĩa,
không phải xác suất thắng được đảm bảo.

`StrategyDecision.from_pattern_analysis()` là adapter cho
`PatternAnalysis` hiện tại. Adapter bảo toàn `pattern_id`, tên mẫu, progress và
lý do nhưng không thay đổi analyzer cũ.

## MoneyManager

Source: `src/money_manager.py`.

Interface `MoneyManager` có năm thao tác:

- `quote()` trả mức tiền hiện tại mà không thay đổi state.
- `apply_result()` cập nhật state sau win/loss/push.
- `snapshot()` tạo state có thể lưu.
- `restore()` phục hồi state đã kiểm tra mode và chuỗi tiền.
- `reset()` đưa manager về trạng thái đầu.

`MoneyQuote.stake == 0` có nghĩa là theo dõi ảo. Quote không tự quyết định có
được đặt hay không.

`ProgressionMoneyManager` bọc trực tiếp `GroupStakeProgression`; năm mode cũ,
commission, group TP/SL và `loss_watch_recover` vẫn dùng đúng source hiện tại.
`MoneyUpdate` giữ quote trước/sau, P&L và thông tin đóng nhóm.

Snapshot chỉ được restore khi `manager_id` và toàn bộ chuỗi tiền trùng cấu hình.
Điều này ngăn phục hồi level của mode/chuỗi khác.

`src/capital_managers.py` triển khai 8 nghiệp vụ tham chiếu:
`IncreaseWhenLose`, `IncreaseWhenWin`, `Victor2`, `ReverseFibo`, `MultiChain`,
`IncreaseEveryRound`, `WinUpLoseKeep`, `WinUpLoseDown`. Các manager này dùng
Banker commission 5%, coi Tie là push và áp dụng TP/SL trên P&L thực tế tích lũy.

`src/money_state_store.py` lưu snapshot theo `tab_id + manager_id`; bảng
`strategy_money_configs` lưu chuỗi tiền độc lập cho từng cặp tab/manager. Restore
chỉ thành công khi fingerprint cấu hình (manager, chuỗi, TP/SL, commission) khớp.

## RiskDecision

Source: `src/risk_decision.py`.

`RiskManager` là gate không side effect. Nó không tự tắt Auto, ghi DB hoặc click
UI. Nó trả:

- `allowed`
- mã ổn định `RiskCode`
- lý do hiển thị/log
- `ExecutionMode.REAL`, `VIRTUAL` hoặc `NONE`
- cờ `recoverable`

Thứ tự first-failure hiện tại:

1. Strategy không tạo tín hiệu.
2. Auto bet tắt.
3. License không cho tạo cược mới.
4. Daily take-profit/stop-loss.
5. Main hoặc Tie đang pending.

Trong chế độ license, `license_allowed` không còn đồng nghĩa đơn thuần với
“đã có Tool session”. Nó là kết quả capability `live_bet` từ signed lease đã
được xác minh public key, device, expiry/revoke và offline grace. Gate này được
chạy lại ngay trước click. Nếu license mất hiệu lực khi đang pending, không tạo
cược mới nhưng vẫn cho luồng resolve/persist hoàn tất.
6. Round đã được đặt.
7. Đang shuffle.
8. Source không được phép trigger.
9. Với stake thật: UI, countdown và số dư.

Stake `0` được duyệt là `VIRTUAL` sau khi qua cổng pending, duplicate, shuffle và
source. Nó không cần UI, countdown hoặc số dư vì executor không được click chip.

## Shadow comparison compatibility

`AutoBettor._arm_bet_signal()` chạy `ShadowDecisionPipeline` trước đường arm cũ.
Shadow tự phân tích lại history, clone progression để lấy `MoneyQuote`, chạy risk
gate rồi so với snapshot quyết định cũ.

Đường cũ sau đó vẫn tự gọi `get_active_signal()` và là nguồn duy nhất được phép
gán `_armed_bet`. Shadow không trả giá trị cho nhánh arm, không tạo pending và
không gọi Playwright.

Quan sát runtime:

- Match ghi ở log level `DEBUG`.
- Mỗi 25 lần đánh giá ghi tổng match/mismatch/error ở level `INFO`.
- Mismatch ghi ngay ở level `WARNING` và event
  `decision_shadow_mismatch`.
- Exception trong shadow được giữ lại, tăng counter `errors` và không thoát ra
  đường cược cũ.
- Mismatch trùng fingerprint trong cùng bàn/history/source chỉ lưu DB một lần.
- Payload không chứa chuỗi history, credential, token hoặc cookie.

`HistoryWatcher._overlay_betting_payload()` có trường `decision_shadow` gồm
counter và mismatch gần nhất. Overlay hiện chưa render trường này.

Xem mismatch đã lưu:

```powershell
.\.venv\Scripts\python.exe .\scripts\query_shadow_mismatches.py --limit 100
```

Shadow hiện chỉ so pipeline cược mẫu Player/Banker. Pending và engine Nuôi Hòa
vẫn độc lập, không được chuyển vào pipeline này.

Shadow vẫn hữu ích để so sánh đường legacy, nhưng không còn là điều kiện để chuyển
tab sang live. Workspace hiện dùng switch trực tiếp `simulation`/`live`; live tab
đi qua `StrategyDecision -> MoneyManager -> RiskDecision` rồi được
`AutoBettor` gom theo round. Trước khi dùng chip thật vẫn cần quan sát phiên
`auto_bet=false` và stake 0 theo runbook vận hành.

Smoke ngày 2026-08-02 với `auto_bet=false` đã quan sát một trigger thật:
`total=1, match=1, mismatch=0, error=0`. Đây chỉ là smoke proof, chưa đủ thay thế
soak test nhiều round.
# Same-round execution contract

`RiskDecision` and executor callers must distinguish an executor-in-progress
from a settled-round pending record. Same-side re-entry is permitted only with
a new operator `run_epoch`; the combined exposure (confirmed/assumed existing
stake plus requested stake) remains subject to all active guards. Settlement
uses the aggregate logical allocation exactly once.
