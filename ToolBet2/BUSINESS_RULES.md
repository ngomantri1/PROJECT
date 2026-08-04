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
- Các source `gp-winner`, `road-info-round`, `marker-roads` được phép trigger arm cược chính. Ngoài ra, `operator-start` được phép arm ngay từ snapshot lịch sử đã nạp khi người dùng bấm Start.
- Start không yêu cầu chờ thêm một kết quả mới. Nếu tab Live, bàn và lịch sử hiện tại hợp lệ, chiến lược được tính ngay và watcher chờ cửa cược. Nếu chưa có lịch sử/bàn thì runtime vẫn chạy và chờ dữ liệu.
- Tín hiệu được arm sau kết quả rồi chờ đúng cửa cược kế tiếp. Nếu history đã tăng quá length lúc arm thì hủy để tránh cược trễ.
- Không đặt khi Auto tắt, limit đã hit, có pending, đang shuffle, UI không sống hoặc round đã được đặt.
- Với aggregate multi-live, snapshot `risk tổng hợp` ngay sau khi có kết quả chỉ
  dùng để log tham khảo; nó không được hủy tín hiệu trước khi executor có thời
  gian chờ cửa cược. Readiness thực tế của chip/zone/cửa cược thuộc
  `wait_and_place_bet()`.
- Một ván chỉ có tối đa một record cược chính theo `round_id`. Khi nhiều tab
  live cùng quyết định, record này là aggregate; các phân bổ tab/cửa được giữ
  trong pending/event và state MoneyManager riêng.

Source: `src/auto_bettor.py:BET_TRIGGER_SOURCES`, `on_history_grew()`, `_arm_bet_signal()`, `src/betting_session.py:can_place_bet()`, `src/database.py:BetRecord`.

## Run state and tab mode

- A valid Tool session permits use of the workspace. It does not require a
  separate `live_bet` capability merely to start the session run state.
- `run_enabled` is session-only and starts false on every process start; it is
  not a persisted betting preference. Start/Stop is the only command allowed to
  change this operator latch. An internal safety/configuration path may pause
  `auto_bet` without changing the latch or the visible “Dừng chạy” state.
- The per-tab simulation/live setting controls whether an eligible signal can
  reach the live executor. Simulation still evaluates strategy, stake, and
  P&L, but never clicks a chip. Changing this checkbox is persisted immediately
  to SQLite and is reloaded only when the workspace is installed again.
- The durable simulation/live setting is operator-owned. Browser, UI, license,
  strategy or executor warnings may wait, recover or reject the current click,
  but must never rewrite a Live tab to Simulation. A transient unhealthy UI
  probe keeps the current arm and is polled again within the bounded watcher;
  physical execution still requires a healthy UI immediately before clicking.
- Pending/duplicate-round/table checks and the configured real-bet guard remain
  required safeguards. KILL_SWITCH is no longer part of the product runtime.

## Conditions / Decisions

### Runtime strategy state

- `sequence_follow` chỉ nhận ký tự B/P từ input của tab, đặt lần lượt và quay
  vòng sau mỗi allocation settle. Input trống/không hợp lệ không tạo cược.
- `pattern_follow` nhận các cặp `vế-trái-vế-phải` (ví dụ `BPP-BP; PP-P`), ưu
  tiên vế trái dài hơn. Khi khớp, vế phải được xếp hàng và thực hiện từng bước
  qua các allocation settle; không khớp thì skip.
- `random_side` chọn một cửa B/P khi một vòng được arm và giữ nguyên lựa chọn
  đó đến khi allocation settle, tránh đổi cửa trong các lần evaluate lặp lại.
- `ensemble_majority` chấm năm expert theo rolling 10 kết quả B/P, sau đó vote
  theo base/performance/regime weight. Chỉ kết quả B/P đã settle mới cập nhật
  score expert.
- `online_ngram` warm-start chuỗi hiện tại thành tables 1..6, dùng Laplace,
  backoff và adaptive safety. Mỗi tab chỉ học thêm kết quả B/P sau settlement;
  khi chưa đủ confidence/support thì chọn ngẫu nhiên có seed theo tab. Hòa chỉ
  ghi undecidable-window, không đổi loss streak, safety hold hoặc decay.
- `expert_panel` dùng Top10 mock votes, guard, EWMA và beauty state riêng; cấu
  hình tham chiếu mặc định đặt ngược (`contrarian`) với quyết định panel nhưng
  học theo kết quả giả lập của panel gốc.
- `top10_pattern` giữ counts của các cửa sổ 10 B/P trong frame 50, pattern
  đang chạy và cursor riêng cho mỗi tab. Sau settle, chỉ win mới được phép đổi
  sang pattern tốt hơn; các outcome còn lại advance cursor. Cửa sổ mới chỉ được
  cộng khi frame đã đủ 50 B/P, giống `AddRightmost10` của reference.
- `parity_hotback` giữ candidate set và pattern 5 B/P đang chạy riêng cho mỗi
  tab. Sau settle, loss xóa/reset pattern hiện tại; win hoặc hòa advance cursor.
  Candidate đối nghịch với cửa sổ B/P mới nhất bị loại.
- State này không lưu SQLite và được reset khi process khởi động hoặc tab đổi
  trạng thái live; không được suy từ `len(history)` ở mỗi lần evaluate.

### Stake và chip

- Khi DOM trả đủ vị trí và có ít nhất hai mệnh giá dương, các giá trị DOM là
  nguồn thật kể cả khi một vị trí bằng `0`; không thay toàn bộ khay bằng bảng
  mệnh giá giả chỉ vì một token chưa đọc được.

- Mỗi bet phải snapshot `execution_mode`. Stake 0 dùng `virtual`; chỉ stake
  dương mới dùng `real`. Một ca pilot stake-zero chỉ PASS khi mọi bet mới đã
  resolve, có stake 0/mode virtual và mọi allocation đều stake 0/virtual.
- `stakes` không được rỗng hoặc chứa số âm.
- Stake `0` là cược ảo/theo dõi: không click chip, nhưng kết quả vẫn cập nhật loss count, P&L nhóm và progression.
- Stake thật chỉ được đặt khi có thể tạo tổng chính xác từ chip của bàn.
- Nhiều tab live có thể chọn cùng một cửa hoặc hai cửa Player/Banker. Stake thật
  được cộng theo từng cửa; Player và Banker được click tuần tự trong cùng cửa cược.
- Theo contract của ToolBet cũ, số dư tài khoản không được đọc và không tham gia
  quyết định arm, tạo intent, phân bổ hoặc click. Người vận hành chịu trách nhiệm
  bảo đảm tài khoản có đủ tiền cho stake đã cấu hình.
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

Golden vectors là contract hồi quy cho eight MoneyManagers: sau mỗi ván phải
khớp cửa đã cược, stake, P&L ván/tổng, `level_index`, `chain_index` và stake
tiếp theo với C# reference. Bất kỳ thay đổi nào cho MoneyManager hoặc công thức
P&L phải cập nhật vector có chủ đích và chạy cả Python/C# harness.

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
- Win Banker: `round_away_from_zero(stake * 0.95)` to a whole chip unit.
- Loss: `-stake`.
- Push: `0`.
- Nuôi Hòa win: `+stake * payout` (mặc định 8); loss: `-stake`.

- Per-tab “Reset vốn khi P&L ≥ 0” is optional and disabled by default. On a
  negative-to-nonnegative recovery it resets only the MoneyManager stake level,
  chain and Victor2 pending double; cumulative P&L/statistics are retained.

Source: `src/progression.py:win_profit()`, `src/tie_nurture_engine.py:resolve_pending()`.

## State / Status Rules

- `time_sliced_hedge` and `dual_schedule_hedge` use a per-tab runtime counter,
  not the length of B/P history. It starts at round 1 when live runtime starts
  and moves to the next slot only after that tab's bet settles, including a Tie
  push. The counter is not persisted across a process restart.
- `dual_schedule_hedge`: follow at slots 1–3 and 9; reverse at 4 and 8;
  AI-stat at 5–7 and 10.
- Main bet phải được ghi `placing` trước physical click, sau đó mới chuyển
  `placed`; click không xác nhận được phải giữ `uncertain`. Multi-live phải có
  allocation journal durable trước click đầu tiên.
- Pending `placed` phục hồi sau restart, hoặc gặp kết quả từ bàn/round server
  khác, chuyển thành `deferred`; nó không áp P&L/progression và không chặn bàn
  khác. Chỉ WS/HTTP `gp-winner`/`road-info-round` có đúng table + game shoe +
  game round mới được tự resolve. `placing`/`uncertain` khóa khi target round
  còn hiện hành; khi `gp-winner`/`road-info-round` chứng minh round đã đóng hoặc
  advance, record chuyển `quarantined`, rời active pending và mở recovery epoch
  từ snapshot MoneyManager đã settled. Không tự gán outcome hoặc thay đổi P&L.
  DOM/canvas/lobby hay “kết quả mới nhất” không đủ để thực hiện transition.
- Bet group: `open`, `take_profit`, `stop_loss` hoặc `abandoned`.
- `live_execution.mode=disabled` không cấp physical execution. `pilot` yêu cầu
  lease canary local hợp lệ gắn đúng SQLite/tab; `production` không yêu cầu
  lease theo ca. Cả pilot/production vẫn bắt buộc Tool/live capability,
  RiskDecision, exact-round, source/shuffle, UI/countdown, stake/journal và
  final pre-click guard.
- Việc `risk tổng hợp` là tham khảo không thay đổi final pre-click guard. Guard
  này vẫn có quyền hủy intent chưa click.
- Intent bị guard chặn trước mọi click có `status=cancelled`,
  `outcome=cancelled`, P&L 0 và không tính vào hạn mức bet canary. Nếu đã có ít
  nhất một click thì không được cancel; phải giữ pending/uncertain để đối chiếu.
- `False` từ executor chỉ được đóng `cancelled` khi chưa thử click vùng cược.
  Nếu có khả năng click nhưng executor không xác nhận được thì journal ghi nhận
  dấu vết rồi park `deferred`; nó không khóa các ván sau, tương đương hành vi
  bỏ qua ván của ToolBet cũ nhưng không xóa bằng chứng.
  `multi_live_placed` chỉ được ghi khi mọi allocation vật lý cần thiết thành
  công; nhánh một phần/không chắc dùng event riêng.
- Pending của bàn khác được park `deferred`: không khóa bàn hiện tại nhưng vẫn
  chặn đúng `(table, shoe, round)` ban đầu. Metadata bàn khác không được dùng để
  resolve hoặc quarantine pending đó.
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

- Hai mẫu legacy `1-1` và `Bet×2` không còn là chiến lược, fallback hay nguồn
  hiển thị. Cửa đề xuất, stake, mức tiền, cược ảo và lệnh live chỉ được lấy từ
  chiến lược của tab và MoneyManager thuộc chính tab đó.

- Session/tab/iframe có thể còn tồn tại từ lần chạy trước; startup phải nhận diện và tiếp tục, không ép login/re-enter.
- Với site `casino_iframe`, URL shell gốc không tự chứng minh người chơi đã ra
  khỏi bàn; phải kiểm tra shell/room UI trước khi phân loại `PHASE_WEB` và kích
  hoạt recovery điều hướng.
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
