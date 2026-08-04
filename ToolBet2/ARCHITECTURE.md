# Architecture

## High-Level Architecture

ToolBet là một process Python đơn, chạy event loop `asyncio` và điều khiển browser bên ngoài. Không có web server/backend riêng.

```text
ToolBet.bat
  -> main.py / HistoryWatcher
     -> ToolAuthService -> Tool Login -> Game Login
     -> BrowserManager -> Chrome CDP
     -> SiteAdapter -> shell casino -> AE SEXY iframe/provider tab
     -> AeSexyCollector -> WS / HTTP / DOM / canvas
     -> TableState -> pattern analysis -> AutoBettor
     -> ae_sexy_betting -> Playwright click UI
     -> GameDataStore -> SQLAlchemy -> SQLite
     -> GameOverlay -> DOM trong tab game
```

`HistoryWatcher` là composition root và coordinator. Collector, bettor, overlay và store không tự sở hữu toàn bộ lifecycle ứng dụng; chúng được nối bằng callback trong constructor/run. Khi chạy từ `ToolBet.bat`, `BrowserManager` chờ/retry CDP trước khi fallback browser để giữ profile Chrome và session Game ổn định.

## Project Structure

- `main.py` — khởi tạo dependency, startup/login/navigation, watch/recovery loop và callback dữ liệu.
- `src/sites/` — adapter boundary cho từng shell casino; registry giữ active site và binding page-to-site.
- `src/auth.py`, `src/auth_flows.py`, `src/login_panel.py`, `src/credentials.py` — chọn site, đăng nhập, OCR captcha và credential store.
- `src/tool_auth.py`, `src/tool_login_panel.py` — xác thực tài khoản Tool và session gate trước Game Login; không dùng lại hoặc ghi vào credential Game.
- `src/browser.py` — CDP connection, chọn tab, reconnect và browser lifecycle.
- `src/ae_sexy*.py` — provider-specific navigation, state classification, collection, parsing, OCR/canvas và betting UI.
- `src/collector.py`, `src/parser.py`, `src/ongames.py`, `src/table_focus.py` — collector/parser legacy cho provider không phải `ae_sexy`.
- `src/models.py` — enum/value object chia sẻ.
- `src/pattern_analyzer.py`, `src/rules/` — mã legacy/analytics không còn nằm
  trên runtime decision path. Strategy-tab runtime dùng `src/strategy_tabs.py`,
  `src/statistical_strategies.py` và `src/strategy_lifecycle.py`.
- `src/betting_session.py`, `src/progression.py`, `src/auto_bettor.py`, `src/tie_nurture_engine.py` — domain state và orchestration cược.
- `src/database.py`, `src/db_store.py` — ORM, migration và repository-like store.
- `src/overlay.py` — legacy overlay và adapter nối payload hiện tại sang UI runtime.
- `GameOverlay._run_enabled` mirrors the process-local operator latch solely so
  every initial/reinstall snapshot is complete. It is independent of the
  execution-level `_auto_bet` value and is not a second authority for betting.
- `src/ui_contracts.py`, `src/ui_runtime.py`, `src/ui_assets.py`, `src/ui/` —
  contract snapshot/command, lifecycle inject/phục hồi và asset theme/component/bridge
  của UI v2.
- `src/strategy_tabs.py` — cấu hình tab và replay mô phỏng độc lập trên lịch sử đã có.
- `src/statistical_strategies.py` — các chiến lược B/P port từ C#, gồm runtime
  state machine Ensemble/N-gram/Expert Panel/Top10/Hot-back;
  `StrategyLifecycleService` sở hữu state theo tab và chỉ advance nó khi
  allocation của tab đã settle.
- `StrategyTabRecord.strategy_input` — input B/P riêng của tab cho Chuỗi B/P
  và Thế cầu B/P; migration trong `src/database.py` thêm cột tương thích DB cũ.
- `tests/golden_vectors/` — contract JSON và C# harness độc lập link trực tiếp
  `MoneyManager.cs`/`MoneyHelper.cs` của project tham chiếu để so sánh state
  tiền từng ván với evaluator Python. Bộ strategy vectors dùng ProjectReference
  tới BaccaratChromeAgent2 Desktop và reflection vào các decision helper thật,
  sau đó so side/stake/P&L/level/schedule với production evaluator Python.
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

The explicit UI Start path is also a decision trigger:
`SET_RUN_STATE -> HistoryWatcher._arm_current_history_after_start() ->
AutoBettor.arm_from_current_history() -> betting-window watcher`. It reuses the
collector-owned current `TableState` snapshot; it does not mutate or synthesize
history, and result settlement still requires the authoritative collector flow.

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
4. `on_betting_open()` hoặc DOM poll chuyển tín hiệu sang executor. Với
   multi-live, snapshot risk tức thời chỉ được log tham khảo; executor chờ hữu
   hạn cho UI/chips/zone/cửa cược thay vì hủy ngay khi ván vừa đổi.
5. `ae_sexy_betting.wait_and_place_bet()` phân rã stake thành chip click chính xác, chọn side, click/confirm và kiểm chứng zone amount.
6. Round được reserve, bet được ghi DB và giữ trong `BettingSession.pending`.
7. Kết quả kế tiếp resolve outcome/P&L/progression, cập nhật bet và bet group.

Executor trả bằng chứng theo ba trạng thái: `False` khi chưa có zone click,
`BetPlacementUncertain` khi zone click có thể đã xảy ra, và `True` khi placement
đã được quan sát/xác nhận. Nhánh không xác nhận được và các ambiguous row sau
restart được park `deferred`, mô phỏng pending RAM không phục hồi của bản cũ mà
vẫn giữ audit. `AutoBettor.park_pending_for_table()` park journal bàn khác trước
Start/arm; exact-round guard vẫn bảo vệ identity cũ.

## Important Runtime Flows

### Startup/authentication

`HistoryWatcher.run()` luôn hiện Tool Login trước, kể cả khi browser đang ở game. Chỉ sau
session Tool hợp lệ mới hiện Game Login; lựa chọn Game Login cập nhật active site và
`config.site.url`. Nếu chưa ở AE SEXY, adapter kiểm tra login; có credential thì
OCR/login tối đa hai lần, thất bại thì dừng session. Nếu browser đã ở lobby/room hợp lệ,
bước login shell được bỏ qua. Tool session hết hạn/logout sẽ dừng phiên Game thay vì tự
đi vào recovery/login Game.

### Page/table selection

`BrowserManager.resolve_game_page()` ưu tiên tab AE SEXY thuộc site active và bỏ shell page của site khác. `HistoryWatcher` phát hiện table runtime từ UI/WS; table này thắng config trong session. Khi từ lobby, `config.game.table_name` là lựa chọn ưu tiên.

### Recovery

`HistoryWatcher._watch_forever()` và các helper trong `ae_sexy.py` phân biệt browser disconnect, session expiry, fatal page, lobby glitch, render zombie, stream zombie và UI betting failure. Recovery có threshold/cooldown, có thể re-enter table, relaunch provider hoặc reconnect CDP. Trước recovery có grace period để bettor hoàn tất; collector polling bị gate khi đang click cược.

### Overlay

`GameOverlay.install()` inject panel vào page phù hợp và expose callback Python.
`update()` đẩy payload lịch sử, P&L, strategy-tab status, progression, limits và tie mode. UI v2 nhận
`UiSnapshot`, giữ snapshot gần nhất phía Python và tự inject lại asset/DOM sau khi bị
xóa hoặc reload. Hai runtime được điều khiển bởi `ui.runtime_v2_enabled` và
`ui.legacy_overlay_enabled`; từ giai đoạn C mặc định hiển thị runtime v2, còn legacy
được giữ làm rollback. Overlay click passthrough
được dùng khi cần thao tác game phía dưới.

Workspace runtime v2 dựng toàn bộ card/tab/form/trạng thái/thống kê/lịch sử bằng
`src/ui/bridge.js` cùng theme/component CSS. JavaScript chỉ gửi cấu hình hoặc
lệnh chạy có kiểu qua bridge; nó không tạo pending bet và không gọi AutoBettor
hoặc click chip. Khi cấu trúc workspace không đổi, bridge chỉ patch các vùng
runtime để giữ input, focus, scroll và vị trí kéo thả.

The first newly created panel DOM renders its scroll at the top and repeats that
assignment on the following animation frame to defeat browser scroll
restoration. Reinstalling an existing panel and normal `update()` calls retain
the existing scroll position, so live data updates do not move an operator away
from the current section.

`StrategyTabStore` là lớp persistence của workspace. SQLite lưu:

- `strategy_tabs`: cấu hình, thứ tự và tab đang chọn.
- `strategy_money_configs`: chuỗi stake độc lập theo cặp tab × MoneyManager.
- `strategy_tab_runtime`: snapshot runtime mới nhất riêng theo tab.
- `strategy_tab_history`: chuỗi snapshot thống kê theo tab/bàn/ván.

Khi SQLite chưa có tab, cấu hình YAML hiện hữu được import một lần. Sau đó SQLite
là nguồn authoritative để đóng/mở Tool không làm mất tab.

Bridge debounce 500 ms cho mỗi form edit hợp lệ và gọi handler SQLite hiện có;
không có nút lưu thủ công. Draft có tên hoặc stake rỗng/không hợp lệ chỉ ở UI và
không thay thế cấu hình đã persist.

Mỗi tab seed đủ tám `strategy_money_configs` khi save/reload; record thiếu dùng
`[0]`, riêng `MultiChain` dùng `[[0]]`. Lưu một manager chỉ chạm record `(tab_id, manager_id)`
đó, nên đổi manager trên UI sẽ nạp lại chuỗi tiền riêng đã lưu.

`HistoryWatcher` rehydrate `StrategyTabStore` ngay trước `overlay.install()`;
đây là boundary cài lại panel sau vào bàn/recovery/reload, không phải một poll
trong luồng snapshot. Trạng thái tab live được đối chiếu tại đây; trạng thái
mode được lưu ngay khi checkbox simulation/live đổi. `_run_enabled` là latch
Start/Stop thuộc process; `BettingSession.state.auto_bet` là execution state
nội bộ. Các đường tạm ngưng nội bộ chỉ đổi execution state, không xóa latch.

`GameOverlay._panels_present()` ưu tiên `BrowserUiRuntime.present()` khi v2 bật;
chỉ fallback sang legacy DOM khi legacy overlay được bật. Điều này phân biệt panel
thực sự mất với panel v2 đang còn tồn tại, tránh install/rehydrate lặp.

Lịch sử cược dùng `StrategyTabStore.history_page()` với `LIMIT/OFFSET` và sort
mới nhất trước. UI chỉ tải trang 10/20/50 dòng đang xem; page-size là preference
cục bộ trong Chrome, không phải runtime state ghi lặp vào SQLite.

For `MultiChain`, `bridge.js` renders `stake_chains` as a textarea with one
chain per line. Saving accepts those line breaks (and legacy semicolons), then
stores each parsed line in the existing `stake_chains` JSON field.

### Strategy tab lifecycle

Strategy tabs are the only simulation/live decision authority. The selected
tab's replay status supplies the status-card side, stake and level. Live tabs
are evaluated by `StrategyLifecycleService` with their tab-owned MoneyManager;
`AutoBettor` does not fall back to the retired 1-1/Bet×2 analyzer when the tab
evaluator is unavailable.

`StrategyLifecycleService` có đường điều khiển hiện hành gồm hai chế độ theo tab:
`simulation` và `live`.
Người dùng tích “Chỉ mô phỏng/test” để tab không đặt tiền; bỏ tích thì cấu hình
được lưu ngay vào SQLite để tab tham gia chạy thật. Không còn Shadow, live candidate, ngưỡng đánh giá hoặc
Promote. Nhiều tab được live đồng thời.

Nút “Bắt đầu chạy thật” bật AutoBettor chung. Mỗi tab live tạo `StrategyDecision`
và dùng MoneyManager riêng. Các stake cùng cửa được cộng lại; nếu các tab chọn cả
Player và Banker thì AutoBettor đặt cả hai cửa trong cùng cửa cược. Toàn bộ phân bổ
được giữ trong một pending tổng hợp để chống duplicate/recovery, rồi resolve và lưu
state MoneyManager riêng theo từng tab.

The visible run label is “Bắt đầu chạy”/“Dừng chạy” for both tab modes. The
simulation checkbox does not hide it; it only selects simulation versus live.
Authorization and runtime safety gates are separate from this UI state.

Risk được đánh giá lúc arm và ngay trước click. Gate cuối yêu cầu Tool session hợp
lệ, không pending/duplicate/shuffle, nguồn hợp lệ, UI khỏe và countdown đủ.
Account balance is outside the execution data flow, matching the older ToolBet
contract. Stake 0 là virtual nên không click nhưng vẫn
tham gia resolve/progression. Browser/page/UI/license không an toàn có thể tạm
ngưng execution (`auto_bet=false`) nhưng không tự thay đổi latch Start/Stop của
người vận hành.

The durable tab mode is also never changed by runtime recovery. `HistoryWatcher`
routes `AutoBettor` runtime issues to `_report_live_runtime_issue()`, which logs
without calling `StrategyLifecycleService.demote_live()`. During the bounded
bet-open poll, a transient failed UI-health probe delays execution and retains
the arm; the executor is entered only after the probe succeeds.

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

- ORM: `HallRecord`, `TableRecord`, `RoundRecord`, `BetGroupRecord`, `BetRecord`,
  `EventRecord`, `StrategyTabRecord`, `StrategyTabRuntimeRecord`,
  `StrategyTabHistoryRecord`.
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

## Decision Pipeline (đang chuyển đổi)

Domain boundary mới nằm trong:

- `src/strategy_decision.py` — input bất biến, strategy protocol và tín hiệu.
- `src/money_manager.py` — quote/update/snapshot quản lý vốn; adapter progression cũ.
- `src/capital_managers.py` — 8 MoneyManager tham chiếu, gồm MultiChain và Victor2.
- `src/money_state_store.py` — snapshot restart theo tab + manager trong SQLite.
- `src/license_contracts.py` — signed lease/capability/status bất biến.
- `src/license_client.py` — HTTP client, verify public key, refresh và grace.
- `src/license_server.py` — authority SQLite; chỉ triển khai trên server riêng.
- `src/risk_decision.py` — gate thuần, mã lý do và real/virtual execution mode.
- `src/strategy_lifecycle.py` — owns each live tab's runtime-only 10-round
  schedule position; `main.py` advances it only after that tab's allocation is
  settled.
- `strategy_tabs.auto_reset_on_nonnegative_pnl` is SQLite-persisted and passed
  into each tab-owned MoneyManager; recovery P&L is separate from cumulative
  session P&L.

Dependency dự kiến:

```text
Collector -> StrategyDecision -> MoneyQuote -> RiskDecision -> AutoBettor
                                         \-> overlay/log/analytics
```

Các module domain không sở hữu Playwright, DB hoặc lifecycle. Tại thời điểm
2026-08-02 vẫn giữ `ShadowDecisionPipeline` để so sánh/diagnostic với đường cũ,
nhưng workspace không dùng Shadow/candidate/Promote để kích hoạt tab. Với từng
tab `live`, StrategyDecision và MoneyManager riêng cấp side/stake cho
RiskDecision; `AutoBettor` vẫn là thành phần duy nhất arm, click và persist.
Nhiều authority live được gom thành một pending tổng hợp theo ván; phân bổ
Player/Banker được click tuần tự trong cùng cửa cược và state manager được
resolve riêng. Tab `simulation` không có authority. Chi tiết contract tại
`DECISION_CONTRACTS.md`.

Ranh giới irreversible click dùng SQLite journal: `bets` được tạo với status
`placing` trước click; aggregate có thêm `bet_allocations` theo tab/cửa và cập
nhật trạng thái sau từng cửa. Pending `placed`/virtual cũ chuyển `deferred` và
chỉ được resolve từ metadata WS/HTTP exact table/shoe/round. `placing` hoặc
`uncertain` chỉ giữ active lock khi target round còn hiện hành; kết quả
authoritative chứng minh round đã đóng/advance sẽ chuyển nó thành
`quarantined`. Allocation bị ảnh hưởng bắt đầu recovery epoch từ snapshot vốn
đã settled gần nhất, không áp outcome/P&L giả. Exact-round duplicate được kiểm
tra cả in-memory và SQLite; deferred/quarantined của round cũ không chặn round
mới.
`src/pending_reconciliation.py` vẫn là domain service offline kết thúc pending
từ evidence operator; CLI backup-first tại `scripts/reconcile_pending.py` ghi
audit event trong cùng transaction.

Pilot stake-zero có evidence boundary riêng. `bets.execution_mode` được ghi
cùng intent; `src/stake_zero_audit.py` chỉ đọc một cửa sổ bet sau baseline và
kiểm tra bet/allocation đều virtual, zero-stake, resolved. Source CLI nằm tại
`scripts/stake_zero_audit.py`; packaged CLI dùng `--stake-zero-audit` qua
`src/release_cli.py`. Audit không cấp authority đặt cược và không sửa SQLite.

Chính sách physical execution nằm ở `live_execution.mode`:
`disabled` không cấp live; `pilot` dùng finite lease; `production` bỏ yêu cầu
lease theo ca nhưng giữ Tool/license, RiskDecision,
round/source/UI/countdown/journal gate. Pilot tiền nhỏ có thêm
irreversible-action boundary tại
`src/small_stake_guard.py`. CLI chỉ tạo lease sau khi preflight production
PASS; lease atomic gắn `database_path + tab_id + baseline` và các giới hạn hữu
hạn. `HistoryWatcher` chuyển kiểm tra file/SQLite sang `asyncio.to_thread`, còn
`AutoBettor` gọi guard trước intent và ngay trước executor cho single/multi/Tie.
`src/small_stake_cli.py` dùng chung cho source script và executable đóng gói.
Lease không thay license; tất cả các gate còn lại phải đồng thời PASS.

KILL_SWITCH sentinel/environment gate has been removed from the current
runtime, launchers, preflight and packaged release by confirmed operator
decision. It is not part of the physical-execution dependency flow.

License có hai trust boundary. Customer ToolBet chỉ giữ Ed25519 public key và
cache DPAPI gắn device. Authority server giữ private key, password hash,
entitlement, activation, token hash và audit. Capability `workspace` bảo vệ
luồng Tool Login → Game Login; capability `live_bet` được kiểm tra lại trong
RiskDecision cuối. Private key/server database không thuộc gói customer.

`StrategyTabStore` là ownership boundary cho cấu hình tab. YAML chỉ là fallback
cho lần import khi SQLite chưa có tab active; luồng đổi site/Game Login tạo
`AppConfig` mới phải rehydrate `strategy_tabs` từ store trước khi publish
snapshot overlay.
