# Architecture

## High-Level Architecture

ToolBet là một process Python đơn, chạy event loop `asyncio` và điều khiển browser bên ngoài. Không có web server/backend riêng.

```text
ToolBet.bat
  -> main.py / HistoryWatcher
     -> BrowserManager -> Chrome CDP
     -> SiteAdapter -> shell casino -> AE SEXY iframe/provider tab
     -> AeSexyCollector -> WS / HTTP / DOM / canvas
     -> TableState -> pattern analysis -> AutoBettor
     -> ae_sexy_betting -> Playwright click UI
     -> GameDataStore -> SQLAlchemy -> SQLite
     -> GameOverlay -> DOM trong tab game
```

`HistoryWatcher` là composition root và coordinator. Collector, bettor, overlay và store không tự sở hữu toàn bộ lifecycle ứng dụng; chúng được nối bằng callback trong constructor/run.

## Project Structure

- `main.py` — khởi tạo dependency, startup/login/navigation, watch/recovery loop và callback dữ liệu.
- `src/sites/` — adapter boundary cho từng shell casino; registry giữ active site và binding page-to-site.
- `src/auth.py`, `src/auth_flows.py`, `src/login_panel.py`, `src/credentials.py` — chọn site, đăng nhập, OCR captcha và credential store.
- `src/browser.py` — CDP connection, chọn tab, reconnect và browser lifecycle.
- `src/ae_sexy*.py` — provider-specific navigation, state classification, collection, parsing, OCR/canvas và betting UI.
- `src/collector.py`, `src/parser.py`, `src/ongames.py`, `src/table_focus.py` — collector/parser legacy cho provider không phải `ae_sexy`.
- `src/models.py` — enum/value object chia sẻ.
- `src/pattern_analyzer.py`, `src/rules/` — phân tích tín hiệu. Runtime chính gọi trực tiếp `pattern_analyzer`; rules engine là nhánh tổng quát/legacy.
- `src/betting_session.py`, `src/progression.py`, `src/auto_bettor.py`, `src/tie_nurture_engine.py` — domain state và orchestration cược.
- `src/database.py`, `src/db_store.py` — ORM, migration và repository-like store.
- `src/overlay.py` — HTML/CSS/JS cùng bridge callback Python.
- `src/bet_analytics.py`, `src/backtest.py`, `src/bet_replay.py`, `src/pattern_discovery.py`, `src/config_optimizer.py` — read/report/optimization trên DB.
- `scripts/` — query DB, mở CDP và dừng process cũ.

## Dependency Flow

Luồng chính:

```text
HistoryWatcher
  -> BrowserManager + SiteAdapter
  -> AeSexyCollector
     -> ae_sexy_ws / ae_sexy_http / ae_sexy_bead / ae_sexy_reader
     -> TableState
  -> pattern_analyzer
  -> AutoBettor
     -> BettingSession -> GroupStakeProgression
     -> TieNurtureEngine
     -> ae_sexy_betting
  -> GameDataStore -> database ORM
  -> GameOverlay
```

Các module thấp không import `main.py`. `HistoryWatcher` cấp callback để tránh collector/bettor phụ thuộc trực tiếp vào coordinator.

## Data Flow

### Lịch sử bàn

1. Browser events và injected hook thu WS/HTTP payload; polling bổ sung DOM/canvas state.
2. `ae_sexy_ws.py`/`ae_sexy_http.py` decode road, winner và metadata shoe/round.
3. `AeSexyCollector` đánh giá source, so với thống kê Banker/Player/Tie, merge phần tăng thêm và loại dữ liệu bàn khác/stale.
4. Lịch sử được đưa vào `TableState.history`, callback `HistoryWatcher._on_ae_history_update()`.
5. Khi bàn ready, `GameDataStore.append_history()` upsert table và lưu round theo `(table, game_shoe, game_round)`.
6. Lịch sử mới được resolve bet trước, rồi phân tích mẫu và cập nhật overlay.

Lobby roadmap chỉ cập nhật table metadata; code chủ động không lưu các round lobby vì thiếu `gameShoe/gameRound`.

### Cược

1. Source kết quả hợp lệ làm history tăng.
2. `AutoBettor.on_history_grew()` resolve pending cũ, cập nhật Nuôi Hòa rồi gọi `_arm_bet_signal()`.
3. Arm giữ snapshot length/table/round; watcher chờ cửa cược tối đa hữu hạn.
4. `on_betting_open()` hoặc DOM poll xác minh chưa miss window, UI sống, chips/zone visible và countdown an toàn.
5. `ae_sexy_betting.wait_and_place_bet()` phân rã stake thành chip click chính xác, chọn side, click/confirm và kiểm chứng zone amount.
6. Round được reserve, bet được ghi DB và giữ trong `BettingSession.pending`.
7. Kết quả kế tiếp resolve outcome/P&L/progression, cập nhật bet và bet group.

## Important Runtime Flows

### Startup/authentication

`HistoryWatcher.run()` luôn hiển thị login panel, kể cả khi đã ở trong game. Lựa chọn panel cập nhật active site và `config.site.url`. Nếu chưa ở AE SEXY, adapter kiểm tra login; có credential thì OCR/login tối đa hai lần, thất bại thì dừng session. Nếu browser đã ở lobby/room hợp lệ, bước login shell được bỏ qua.

### Page/table selection

`BrowserManager.resolve_game_page()` ưu tiên tab AE SEXY thuộc site active và bỏ shell page của site khác. `HistoryWatcher` phát hiện table runtime từ UI/WS; table này thắng config trong session. Khi từ lobby, `config.game.table_name` là lựa chọn ưu tiên.

### Recovery

`HistoryWatcher._watch_forever()` và các helper trong `ae_sexy.py` phân biệt browser disconnect, session expiry, fatal page, lobby glitch, render zombie, stream zombie và UI betting failure. Recovery có threshold/cooldown, có thể re-enter table, relaunch provider hoặc reconnect CDP. Trước recovery có grace period để bettor hoàn tất; collector polling bị gate khi đang click cược.

### Overlay

`GameOverlay.install()` inject panel vào page phù hợp và expose callback Python. `update()` đẩy payload lịch sử, mẫu, P&L, progression, limits và tie mode. Navigation/reload làm DOM mất nên watch loop cài lại. Overlay click passthrough được dùng khi cần thao tác game phía dưới.

### Threading/concurrency

- Một `asyncio` event loop; không thấy worker thread do project quản lý.
- Collector tạo background polling task.
- Auto bettor có `asyncio.Lock`, một bet-open polling task và counters báo busy/clicking.
- Callback có thể là coroutine và phải được await/schedule đúng context.
- SQLAlchemy session được tạo theo từng store/analytics operation rồi đóng trong `finally`.

## Key Files / Classes

`main.py`

- `HistoryWatcher.__init__()` — wire config, DB, browser, overlay, collector/bettor state.
- `HistoryWatcher.run()` — startup đến vào bàn.
- `HistoryWatcher._watch_forever()` — giám sát và recovery.
- `HistoryWatcher._on_ae_history_update()` — persistence, resolve và phân tích sau history change.

`src/ae_sexy.py`

- `detect_ae_sexy_phase()` / `probe_game_state()` — phân loại web/lobby/loading/room.
- `enter_ae_sexy_hall()` / `enter_ae_sexy_table()` — navigation.
- `assess_ae_sexy_connection()` / `recover_ae_sexy_connection()` — health và recovery.

`src/ae_sexy_collector.py`

- `AeSexyCollector.install_hook()` / `attach_http()` / `attach_cdp()` — gắn nguồn.
- `load_full_history()` / `_apply_history()` — bootstrap/reconcile.
- `check_round_update()` / `poll_dom()` — incremental updates.

`src/auto_bettor.py`

- `AutoBettor.on_history_grew()` — resolve rồi arm.
- `AutoBettor.on_betting_open()` — execution tại cửa cược.
- `_try_place_bet()` / `_try_place_tie_bet()` — reserve, click và persist.

`src/betting_session.py`

- `BettingSession.can_place_bet()` / `check_limits()` — gate.
- `resolve_pending()` — outcome, P&L và progression.

`src/progression.py`

- `GroupStakeProgression.apply_result()` — luật index/P&L/group close.

`src/database.py`

- ORM: `HallRecord`, `TableRecord`, `RoundRecord`, `BetGroupRecord`, `BetRecord`, `EventRecord`.
- `_migrate_schema()` — nâng cấp SQLite cũ.

`src/db_store.py`

- `GameDataStore.save_round()` / `reserve_round()` — identity và dedup round.
- `save_bet()` / `resolve_bet()` — lifecycle cược.

## Architectural Constraints

- State ownership: `TableState` là snapshot bàn; progression/pending thuộc `BettingSession`; tie pending thuộc `TieNurtureEngine`; app lifecycle thuộc `HistoryWatcher`.
- Một round không được có nhiều bet record do `bets.round_id` unique; logic in-memory cũng phải giữ invariant này.
- Round identity ưu tiên `game_shoe + game_round`; không tạo lịch sử DB từ dữ liệu lobby thiếu metadata.
- DB migration phải additive và tương thích file SQLite hiện có.
- Page object có lifecycle ngắn; mọi code phải chịu được target đóng/navigation và re-bind collector/overlay.
- Site-specific selector/URL không được rò sang site adapter khác.
- Recovery và data polling không được click hoặc reload đồng thời với bet execution.
- Browser/live casino là hệ thống ngoài không ổn định; timeout/retry/fallback hiện có là một phần kiến trúc, không phải code thừa.

