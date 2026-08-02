# Business Rules

## Core Business Rules

### Kết quả và màu

- `player` = xanh, `banker` = đỏ, `tie` = hòa.
- Khi `game.skip_tie: true`, hòa bị loại khỏi chuỗi dùng để phân tích mẫu; lịch sử gốc vẫn giữ hòa.
- Cược Player thắng trả lãi 1:1. Cược Banker thắng trừ commission 5%. Hòa đối với cược Player/Banker là `push`, P&L bằng 0 và giữ nguyên stake index.

Source: `src/models.py`, `src/pattern_analyzer.py:filter_history()`, `src/progression.py:win_profit()`, `GroupStakeProgression.apply_result()`.

### Tín hiệu mẫu

- Độ dài hợp lệ của cả hai mẫu là 2, 3 hoặc 4; giá trị ngoài tập này trở về mặc định.
- `mau_1_1`: N ván cuối phải xen kẽ từng màu; cược ván sau theo màu đối diện ván cuối để tiếp tục xen kẽ.
- `mau_bet_2`: N ván cuối cùng một màu; cược tiếp cùng màu.
- Ưu tiên `mau_1_1` trước `mau_bet_2`; hàm phân tích trả về ngay khi mẫu ưu tiên match.
- Mẫu bị tắt không tạo tín hiệu; trạng thái `building` chỉ để hiển thị, không phải tín hiệu cược.

Source: `src/pattern_analyzer.py:analyze_patterns()`, `get_active_signal()`.

### Trigger cược

- Bootstrap nhiều ván ban đầu chỉ đồng bộ, không tạo cược.
- Chỉ các source `gp-winner`, `road-info-round`, `marker-roads` được phép trigger arm cược chính.
- Tín hiệu được arm sau kết quả rồi chờ đúng cửa cược kế tiếp. Nếu history đã tăng quá length lúc arm thì hủy để tránh cược trễ.
- Không đặt khi Auto tắt, limit đã hit, có pending, đang shuffle, UI không sống hoặc round đã được đặt.
- Một ván chỉ có tối đa một record cược chính theo `round_id`. Khi nhiều tab
  live cùng quyết định, record này là aggregate; các phân bổ tab/cửa được giữ
  trong pending/event và state MoneyManager riêng.

Source: `src/auto_bettor.py:BET_TRIGGER_SOURCES`, `on_history_grew()`, `_arm_bet_signal()`, `src/betting_session.py:can_place_bet()`, `src/database.py:BetRecord`.

## Conditions / Decisions

### Stake và chip

- `stakes` không được rỗng hoặc chứa số âm.
- Stake `0` là cược ảo/theo dõi: không click chip, nhưng kết quả vẫn cập nhật loss count, P&L nhóm và progression.
- Stake thật chỉ được đặt khi có thể tạo tổng chính xác từ chip của bàn.
- Nhiều tab live có thể chọn cùng một cửa hoặc hai cửa Player/Banker. Stake thật
  được cộng theo từng cửa; tổng tiền thật phải không vượt số dư trước khi click.
  Player và Banker được click tuần tự trong cùng cửa cược.
- Logic AE SEXY xử lý quirk chip 10: click 10 đầu tiên có thể được bàn ghi 20, ngoại trừ trường hợp stake đúng 10; planner có các nhánh riêng để tránh đặt sai tổng.
- Cửa cược phải có zone/chips hợp lệ; countdown số nhỏ hơn 3 giây bị coi là quá muộn.

Source: `src/progression.py:GroupStakeProgression.__init__()`, `src/ae_sexy_betting.py:stake_to_value_clicks()`, `validate_progression_stakes()`, `src/auto_bettor.py:_betting_window_open()`.

### Giới hạn

- `stop_loss`, `take_profit`, `group_stop_loss`, `group_take_profit` bằng `0` nghĩa là tắt giới hạn tương ứng.
- Daily take profit hit khi P&L ngày `>= take_profit`; daily stop loss hit khi `<= -stop_loss`. Khi hit, Auto tự tắt.
- Group đạt ngưỡng lời/lỗ sẽ đóng nhóm, lưu lý do và reset group P&L, loss count, index và group result list.
- P&L dùng cho daily limit lấy từ DB hôm nay nếu provider được cấu hình, không chỉ từ state kể từ lúc process khởi động.

Source: `src/betting_session.py:check_limits()`, `apply_limit_if_hit()`, `src/progression.py:_maybe_close_group()`, `main.py:HistoryWatcher.__init__()`.

## Calculation Rules

### Progression

Tất cả index đều clamp ở phần tử cuối của `stakes`.

- `loss_up_win_reset`: thua tăng `loss_count` và chọn index theo loss count; thắng khi group P&L còn âm thì tăng một bậc, khi không âm thì về đầu/reset loss count (có điều kiện nếu watch recovery bật).
- `win_up_loss_reset`: thua về đầu; thắng ở bước đầu nhảy theo loss count, thắng ở stake thật reset loss count rồi tăng một bậc.
- `both_up`: thắng hoặc thua đều tăng một bậc.
- `win_up_loss_hold`: thắng tăng bậc; thua giữ bậc.
- `profit_lock_loss_up`: thua tăng bậc; thắng chỉ về đầu khi group P&L dương, nếu chưa dương thì tiếp tục tăng.
- `loss_watch_recover` thay đổi điều kiện “về đầu” của mode 1–4; mode 5 đã tự khóa lãi nên toggle này không đổi luật mode 5.

Chi tiết chính xác và các trường hợp bước đầu nằm tại `src/progression.py:GroupStakeProgression._apply_next_index()` và `_index_for_win_at_first_step()`.

### P&L

- Win Player: `+stake`.
- Win Banker: `+stake * 0.95`.
- Loss: `-stake`.
- Push: `0`.
- Nuôi Hòa win: `+stake * payout` (mặc định 8); loss: `-stake`.

Source: `src/progression.py:win_profit()`, `src/tie_nurture_engine.py:resolve_pending()`.

## State / Status Rules

- Main bet status: khởi tạo `placed`, resolve thành `resolved`; DB còn cho phép status khác do recovery code cập nhật.
- Bet group: `open`, `take_profit`, `stop_loss` hoặc `abandoned`.
- Chỉ một `BettingSession.pending` chính tồn tại; nó có thể đại diện cho một
  allocation thường hoặc aggregate nhiều tab live. Nuôi Hòa có pending độc lập
  để có thể đặt thêm Hòa sau cược mẫu trong cùng cửa.
- Bàn runtime phát hiện từ room/WS được dùng trong session; `config.game.table_name` không được ép đè khi người dùng đã ở bàn khác.
- Khi shoe đổi, reserved rounds của bàn được xóa.

Source: `src/betting_session.py`, `src/tie_nurture_engine.py`, `main.py:_apply_runtime_table()`, `src/ae_sexy_collector.py`, `src/database.py`.

## Nuôi Hòa

- Khi bật, đếm số ván liên tiếp không Hòa (`gap`).
- Đạt `gap_min` thì kích hoạt chu kỳ nếu chưa vượt `gap_max` (hoặc `gap_max = 0`).
- Trong cửa cược, cược Hòa được đặt thêm sau cược mẫu; nó không thay progression Player/Banker.
- Chu kỳ kết thúc khi trúng Hòa, gap vượt max, đạt `max_bets`, hoặc chạm stop loss riêng.
- `max_bets = 0`, `gap_max = 0`, `session_stop_loss = 0` lần lượt nghĩa là không giới hạn/tắt giới hạn.
- Bật lại feature xóa cờ stop-loss cũ; tắt feature không xóa pending đang chờ resolve.

Source: `src/tie_nurture_engine.py:TieNurtureEngine`, `src/auto_bettor.py:on_betting_open()`.

## Validation Rules

- Config được Pydantic validate kiểu dữ liệu khi load.
- Site chỉ hợp lệ nếu resolve được qua registry allowlist; site lạ raise `ValueError`.
- Credential được lưu riêng theo site.
- Round được dedup theo `(table, shoe, round)` và `round_id`; bet được dedup theo `round_id`.
- History chỉ được ghi khi có table name và bàn AE đang ready; lobby history không được coi là round có định danh server.

Source: `src/config.py`, `src/sites/__init__.py:resolve_site()`, `src/credentials.py`, `src/db_store.py`.

## Important Edge Cases

- Session/tab/iframe có thể còn tồn tại từ lần chạy trước; startup phải nhận diện và tiếp tục, không ép login/re-enter.
- Phase có thể bị nhận sai là loading; nếu thấy nhiều table trong frame thì sửa thành lobby.
- DOM/canvas có thể stale hoặc khác thống kê; collector không được append chỉ vì một source dài hơn.
- Overlay có thể che zone game; click flow có cơ chế passthrough/restore.
- Browser target có thể đóng giữa await; recovery nhận diện riêng `TargetClosed`.
- Stake index cuối không tăng thêm; sequence giữ ở mức cuối.

## Data Meaning

- `game_shoe`, `game_round`: định danh server ưu tiên cho ván.
- `bead_index`: vị trí trong bead history, dùng hỗ trợ mapping nhưng không thay thế shoe/round khi có.
- `session_date`, `session_no`: định danh hiển thị/theo ngày trong DB.
- `target_round_index`: index history mà bet nhắm tới.
- `pattern_id`: ID ổn định (`mau_1_1`, `mau_bet_2`, `tie_nurture`); `rule_name`/`pattern_name` là nhãn hiển thị.
- `group_pnl_after`, `session_profit_after`: snapshot sau khi resolve.
