# Business Rules

Tài liệu này chỉ ghi rule đã được người dùng xác nhận hoặc đang được source/test
enforce. Khi hai bên lệch nhau phải ghi vào `CURRENT_STATE.md`/`BUGS.md`, không
đổi rule để khớp implementation.

## Kết quả và progression

- Player xanh, Banker đỏ, Tie xanh lá trong UI. `game.skip_tie` chỉ loại Tie khỏi
  phân tích mẫu; lịch sử gốc vẫn giữ Tie.
- Player thắng 1:1; Banker thắng trừ commission 5%; Tie của Player/Banker là
  push, P&L 0 và giữ stake index.
- Không suy kết quả cuối chỉ từ DOM/canvas/lobby history khi WS/HTTP reconcile
  chưa xác nhận.

## Signal và Start

- Bootstrap history chỉ đồng bộ, không tự tạo cược.
- Trigger được allowlist trong `AutoBettor`; `operator-start` được phép tính từ
  history hợp lệ hiện có. Signal arm cho round/cửa cược kế tiếp và bị hủy nếu
  đã quá length hoặc identity thay đổi.
- Không đặt khi tab không chạy, AutoBettor bị gate, có pending/duplicate,
  UI/round/countdown không hợp lệ, hoặc limit đã đạt.
- Mỗi tab có run latch riêng. Stop ngăn allocation mới; task/click đã bắt đầu
  không được giả vờ hủy nếu chưa biết kết quả.

## Live và Simulation

- Checkbox mode lưu ngay theo tab vào SQLite và không reset MoneyManager/run.
- Hai mode dùng cùng decision, stake, settlement, journal và statistics pipeline.
- Simulation ghi `virtual`, cập nhật state như Live nhưng tuyệt đối không click
  chip. Live mới gọi physical executor sau tất cả guard.
- Start reset `run_profit=0`, MoneyManager về level 1 và tiền cược kế tiếp về
  stake đầu của tab; thống kê tích lũy dài hạn không reset. Tùy chọn tự quay về
  mức đầu cũng chỉ reset run profit/capital runtime sau kết quả đủ điều kiện.
  Icon reset mới reset thống kê tích lũy.

## Pending, duplicate và multi-live

- Một logical bet tối đa cho cùng table/shoe/round; multi-live giữ allocation
  theo tab/cửa nhưng không tạo logical record thứ hai.
- Journal intent/placement trước click. Không có zone click thì `cancelled`;
  có khả năng đã click nhưng thiếu bằng chứng thì `uncertain`; mismatch bàn/ván
  hoặc chưa thể đối soát thì `deferred`.
- Chỉ allocation đã placement/virtual hợp lệ và reconcile được mới được resolve
  win/loss/push, cập nhật P&L/MoneyManager/streak.
- Pending khác bàn được park, không xóa và không dùng kết quả bàn mới để settle.
- Tie nurture có pending/state riêng, không nhập vào pending chính.

## Table/site/browser

- Site adapter và tab/frame phải bind đúng web đang active.
- Runtime table đã mở được ưu tiên hơn table cấu hình; khi ở lobby candidate
  mặc định là `config.game.table_name` (mẫu `Baccarat C01`) rồi fallback theo
  thuật toán documented trong `TABLE_SELECTION_WORKFLOW.md`.
- Overlay không được chặn chip/zone; recovery phải chờ AutoBettor idle.

## License và credential

- Tool Login là điều kiện workspace. Physical live còn cần license capability,
  RiskDecision, pending/round/journal và execution mode gate.
- Private key, password, token, cookie và database runtime không được ghi vào
  source/log/tài liệu. License provider `signed` hoặc `baccarat_chrome_agent2`
  được chọn bằng config.
