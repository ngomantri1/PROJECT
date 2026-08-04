# Project Context

## Durable placement-evidence decision — 2026-08-04

- A boolean executor failure is cancellable only before any possible bet-zone
  click. An unconfirmed possible click is recorded then parked `deferred`, so it
  does not recreate the active-pending behavior absent from the old ToolBet.
- Pending ownership is table-scoped: switching tables parks the old record but
  never deletes it, invents an outcome or relaxes exact-round deduplication.
- Partial DOM chip values remain positional; one unreadable token must not make
  a synthetic tray replace the observed denominations.

## Project Overview

ToolBet v2 là công cụ desktop dạng script dành cho người vận hành Baccarat AE SEXY trên các web casino được hỗ trợ. Ứng dụng kết nối vào Chrome qua Chrome DevTools Protocol (CDP), đăng nhập/mở sảnh và bàn, đồng bộ lịch sử kết quả, phân tích mẫu, inject bảng điều khiển vào trang, lưu dữ liệu cục bộ và có thể tự đặt chip.

An explicit Start with an enabled Live tab evaluates the current loaded table
history immediately using the `operator-start` trigger. It does not wait for
one additional result merely to begin the strategy loop. The resulting arm is
still bound to the next round metadata and the bounded betting-window executor;
authoritative result collection and pending settlement rules are unchanged.

The visible Start/Stop state is process-local. `HistoryWatcher` is authoritative
and `GameOverlay` mirrors the latch into every snapshot so navigation or DOM
reinstall cannot reset the button. Internal execution pauses affect `auto_bet`,
not the operator latch; only explicit Stop changes the button back to Start.

The persisted Live/Simulation tab mode is likewise operator-owned. Runtime
browser/UI/license/strategy warnings never rewrite it. A transient failed UI
health probe keeps an armed decision waiting in the bounded poll and proceeds
only after UI health recovers; immediate pre-click readiness checks remain.

Strategy tabs and their tab-owned MoneyManagers are the sole decision source.
The former 1-1/Bet×2 `legacy_patterns` model is not a selectable/default/fallback
strategy and is not evaluated during ordinary history refresh. The status-card
recommendation, virtual stake and level come from the selected tab; physical
authority comes from enabled Live tabs only.

Live execution deliberately does not read or gate on account balance, matching
the older ToolBet project. Configured stakes flow from each tab's MoneyManager
into Player/Banker aggregation; the operator is responsible for available funds.

## Schedule strategies

`time_sliced_hedge` and `dual_schedule_hedge` use independent, runtime-only
0–9 counters for each tab. Positions advance after that tab's settled
allocation, never from history length, and reset when live runtime resets.
The dual schedule is follow 1–3/9, reverse 4/8, and AI-stat 5–7/10.

Banker wins round `stake × 0.95` to a whole chip away from zero. Tabs can
optionally reset only capital progression when recovery P&L crosses from
negative to nonnegative; SQLite stores the setting and cumulative P&L remains.

`top10_pattern` and `parity_hotback` are also per-tab runtime strategies. Their
state is in memory only and is advanced after that tab settles, never inferred
from the current history length. Top10 maintains the 50-result counts/pattern
cursor and switches on a win; Hot-back maintains candidates/current five-step
pattern and resets that pattern on a loss. Hot-back's reference tie selection
is random; ToolBet seeds its per-tab generator for reproducible process runs.

`ensemble_majority`, `online_ngram`, and `expert_panel` have separate
reference-derived state machines. Ensemble tracks five expert rolling scores;
N-gram owns its 1..6 count tables and adaptive safety fields; Expert Panel owns
its Top10 mock votes, guard/EWMA/beauty state and contrarian output. They are
all process-local per tab. N-gram deliberately warm-starts from the current
table history rather than adding a new persistence schema in this patch.

The B/P registry additionally includes `sequence_follow`, `pattern_follow`,
and `random_side`, ported from C# `SeqParityFollowTask`, `PatternParityTask`,
and `RandomParityTask`. `strategy_tabs.strategy_input` stores the sequence or
pattern text per tab; the SQLite migration is additive.

Cross-language money-state equivalence is guarded by
`tests/golden_vectors/cases.json` and `expected.json`. The Python evaluator
uses ToolBet code; the C# harness links the reference task source. This covers
bet side, stake, level, chain and P&L after every vector round.

`tests/golden_vectors/strategy_cases.json` additionally covers eight
deterministic reference strategies. Its C# harness loads the current
BaccaratChromeAgent2 Desktop assembly and invokes the actual private decision
helpers, while Python uses ToolBet production strategy/MoneyManager code.
Stateful/random/config-persisted strategies are not yet claimed by this contract.

Chức năng chính:

- Bắt đầu bằng Tool Login, sau đó mới hiện Game Login và chọn site/tài khoản trong
  panel được inject vào một tab Chrome.
- Hỗ trợ shell `vipbet389`, `222b` và `dly8829` qua site adapter.
- Tự nhận diện trạng thái web/sảnh/phòng/loading và khôi phục session, tab, iframe hoặc stream lỗi.
- Thu thập lịch sử từ WebSocket, HTTP response, DOM và canvas/bead plate; reconcile nhiều nguồn.
- Phân tích hai nhóm mẫu Baccarat đang hoạt động: xen kẽ và chuỗi cùng màu.
- Quản lý chuỗi stake theo nhóm, giới hạn lời/lỗ và chế độ Nuôi Hòa.
- Đặt cược bằng thao tác UI Playwright, theo dõi một pending chính (có thể gồm
  nhiều phân bổ tab/cửa) và resolve khi có kết quả.
- Workspace HTML/CSS/JavaScript có tab `simulation`/`live`, lưu cấu hình và
  runtime theo tab trong SQLite. Nhiều tab live có thể gom stake Player và
  Banker trong một ván.
- Lưu bàn, ván, nhóm cược, cược và event vào SQLite; cung cấp báo cáo/backtest/đề xuất cấu hình.
- Bet intent và allocation multi-live được journal trước click. Pending
  `placed`/virtual cũ được deferred. `placing`/`uncertain` chỉ giữ active lock
  tới khi WS/HTTP authoritative đóng/advance target round, sau đó được
  quarantined và tách sang MoneyManager recovery epoch; không đoán outcome.
  Workflow đối chiếu backup-first vẫn dùng cho evidence operator.
- Stake-zero pilot dùng `bets.execution_mode=virtual` và start/finish audit để
  chứng minh cửa sổ bet không chứa stake thật hoặc allocation click thật.
- `live_execution.mode` tách `disabled`, finite-lease `pilot` và `production`.
  Production chỉ bỏ lease theo ca; nó không thay thế Tool/license capability,
  RiskDecision hoặc durable journal. KILL_SWITCH has been removed from the
  current runtime by confirmed operator decision.

## Technology Stack

- Language/runtime: Python 3.10+ 64-bit; project hiện có `.venv`.
- Concurrency: `asyncio`; phần lớn browser/network flow dùng Playwright async API.
- Browser automation: Playwright kết nối Chrome CDP, mặc định `http://localhost:9222`.
- Configuration: YAML + Pydantic v2.
- Persistence: SQLite qua SQLAlchemy 2.
- Image/OCR: Pillow cho canvas/bead screenshot; ddddocr cho captcha.
- UI: HTML/CSS/JavaScript được inject vào trang qua Playwright, không có frontend build riêng.
- Packaging/launch: `ToolBet.bat` chuẩn bị venv/dependency/Chrome rồi chạy `main.py`.

Dependencies được khai báo trong `requirements.txt`: Playwright, PyYAML, SQLAlchemy, python-dotenv, Pydantic, pydantic-settings, Pillow và ddddocr.

## Main Application Flow

1. `ToolBet.bat` bảo đảm Python 64-bit, tạo `.venv`, cài dependency, mở Chrome CDP/profile riêng và dừng instance `main.py` cũ.
2. `main.py:main()` tạo `HistoryWatcher` và chạy `HistoryWatcher.run()`.
3. `HistoryWatcher` load config, khởi tạo SQLite, store, browser manager, overlay, betting session và auto bettor.
4. Tool kết nối Chrome, luôn yêu cầu Tool Login trước. Sau session Tool hợp lệ,
   Game Login lưu site/tài khoản đã chọn rồi resolve đúng tab của site.
5. Site adapter kiểm tra/đăng nhập và mở AE SEXY theo kiểu iframe hoặc provider tab.
6. Tool phát hiện bàn đang mở; bàn runtime được ưu tiên hơn `config.game.table_name`, còn config là lựa chọn khi đi từ sảnh.
7. `AeSexyCollector` gắn hook WebSocket/HTTP và polling DOM; lịch sử đáng tin được reconcile rồi chuyển vào `TableState`.
8. Khi lịch sử tăng, kết quả được lưu DB, pending bet được resolve, mẫu được phân tích và tín hiệu hợp lệ được arm.
9. Khi cửa cược mở, `AutoBettor` xác minh UI/round/limit. Các tab live được
   gom stake theo Player/Banker, có thể click cả hai cửa trong cùng ván, ghi một
   bet tổng hợp và chờ kết quả.
10. `GameOverlay` hiển thị workspace v2 với lịch sử, tín hiệu, P&L, trạng thái
   tab và cấu hình SQLite trong lúc chạy.
11. Watch loop giám sát tab/iframe/UI/stream/session và phục hồi mà không cắt ngang thao tác đặt cược.

## Important Components

- `main.py` — composition root và state machine cấp ứng dụng (`HistoryWatcher`).
- `src/ae_sexy.py` — nhận diện phase, điều hướng sảnh/phòng và recovery AE SEXY.
- `src/ae_sexy_collector.py` — hợp nhất WS/HTTP/DOM/canvas thành lịch sử bàn.
- `src/ae_sexy_http.py`, `src/ae_sexy_ws.py` — parse, đánh điểm và reconcile payload provider.
- `src/ae_sexy_bead.py`, `src/ae_sexy_reader.py` — đọc bead plate/canvas/DOM.
- `src/auto_bettor.py`, `src/ae_sexy_betting.py` — arm tín hiệu, đồng bộ cửa cược và click chip/zone.
- `src/pattern_analyzer.py` — catalog và luật nhận diện mẫu đang dùng.
- `src/betting_session.py`, `src/progression.py`, `src/tie_nurture_engine.py` — state cược, P&L, progression và Nuôi Hòa.
- `src/database.py`, `src/db_store.py` — schema, migration, dedup và persistence.
- `src/pending_reconciliation.py`, `scripts/reconcile_pending.py` — đối chiếu
  pending offline có evidence; không xác minh placement mơ hồ thay operator.
- `src/stake_zero_audit.py`, `scripts/stake_zero_audit.py` — bằng chứng read-only
  cho ca pilot stake-zero sau khi preflight PASS.
- `src/small_stake_guard.py`, `src/small_stake_cli.py`,
  `scripts/small_stake_pilot.py` — lease, runtime guard và evidence ca tiền nhỏ.
- `src/overlay.py`, `src/ui_runtime.py`, `src/ui/bridge.js` — UI inject,
  snapshot/command bridge và workspace v2.
- `src/tool_auth.py`, `src/tool_login_panel.py` — Tool Login/session gate.
- `src/strategy_lifecycle.py`, `src/strategy_tab_store.py`,
  `src/money_state_store.py` — live/simulation tab và persistence theo tab.
- `src/sites/` — metadata/selector/flow riêng từng web.
- `src/backtest.py`, `src/bet_analytics.py`, `src/bet_replay.py`, `src/pattern_discovery.py`, `src/config_optimizer.py` — phân tích offline và báo cáo.

## Coding Conventions

- Module/hàm/biến dùng `snake_case`; class/dataclass/enum dùng `PascalCase`; constant dùng `UPPER_SNAKE_CASE`.
- Public flow quan trọng có type hints; object trạng thái dùng dataclass hoặc Pydantic model.
- Browser flow dùng `async def`, timeout hữu hạn và retry/recovery theo trạng thái.
- Lỗi có thể phục hồi thường được log rồi fallback; `TargetClosed` được nhận diện riêng.
- Log vận hành dùng `logging`; `src/round_trace.py` chuẩn hóa các log ván/cược.
- Callback nối collector, overlay và auto bettor; state dùng chung chính nằm trong `HistoryWatcher` và `TableState`.
- File config được ghi lại bằng `yaml.safe_dump(..., allow_unicode=True, sort_keys=False)`.

## Important Technical Rules

- `auto_bet` mặc định tắt; stake `0` là bước theo dõi, không click chip nhưng vẫn tham gia kết quả/progression.
- Không đặt cược từ bootstrap history hoặc nguồn không nằm trong allowlist trigger của `AutoBettor`.
- Không đặt trùng một round: dùng pending state, lock, `_placing_key`,
  `_placed_round_keys`, exact table/shoe/round lookup trong SQLite và unique
  `bets.round_id`. Record deferred/quarantined chỉ chặn đúng round cũ.
- Không reload/recover trong lúc bettor đang bận; poll collector cũng bị gate trong lúc click chip.
- Nhánh aggregate multi-live không được dùng một snapshot UI/countdown vừa sau
  kết quả để hủy trước khi chờ cửa cược. `wait_and_place_bet()` sở hữu bounded
  wait; real-bet guard vẫn được kiểm tra lại trước physical click.
- Runtime table đang nhìn thấy là nguồn đúng cho session; config table chỉ là ưu tiên vào bàn từ sảnh.
- Chỉ ghi lịch sử AE vào DB khi thực sự trong phòng, bàn ready và có round metadata đủ tin cậy.
- Tab provider CDN phải được bind về site đang active; không chọn shell tab của site khác.
- Overlay tồn tại trong DOM trang, vì vậy phải cài lại sau navigation/reload và không được che thao tác click cược.

## External Integration

- Chrome/Playwright CDP và Chrome profile tại `data/cdp_profile/`.
- Ba casino shell trong `src/sites/`; endpoint/DOM của chúng có thể thay đổi ngoài project.
- AE SEXY thông qua provider tab/iframe, WebSocket, HTTP responses, DOM và canvas.
- Local filesystem: `config.yaml`, `credentials.yaml`, SQLite và Chrome profile.
- Runtime customer không cần web backend để theo dõi/cược. Khi bật license sản
  xuất, `src/license_client.py` gọi authority riêng triển khai bằng
  `src/license_server.py`; private key và database authority không thuộc máy khách.

## Important Paths

- `main.py` — bắt đầu đọc runtime orchestration.
- `src/ae_sexy_collector.py` — bắt đầu đọc data synchronization.
- `src/auto_bettor.py` — bắt đầu đọc execution safety.
- `src/progression.py` và `src/pattern_analyzer.py` — bắt đầu đọc nghiệp vụ.
- `src/database.py` và `src/db_store.py` — persistence.
- `src/sites/` và `src/auth_flows.py` — tích hợp từng web/login/OCR.
- `src/ui_runtime.py`, `src/ui/bridge.js`, `src/overlay.py` — UI runtime,
  partial update và adapter legacy.
- `config.example.yaml` — cấu hình mẫu; không dùng `credentials.yaml` làm tài liệu.
- `HUONG_DAN_CAI_DAT.md` và `ToolBet.bat` — cài đặt/chạy trên Windows.

Chiến lược, MoneyManager và chuỗi stake là SQLite-owned sau lần import đầu
tiên. Bất kỳ thao tác nào tạo lại `AppConfig` từ YAML (ví dụ đổi site sau Game
Login) phải nạp lại `strategy_tabs` qua `StrategyTabStore.load_or_import()`;
không được để YAML mặc định ghi đè workspace đã lưu.

Workspace không có nút lưu thủ công. `src/ui/bridge.js` debounce 500 ms rồi
gửi mỗi thay đổi tab hợp lệ về `StrategyTabStore`; input tên tab hoặc chuỗi
stake đang rỗng/không hợp lệ không được ghi đè bản SQLite đã lưu. Riêng checkbox
“Chỉ mô phỏng/test” lưu ngay khi đổi để mode live/simulation không bị mất trước
một lần cài lại overlay.

Nạp ngược SQLite vào workspace chỉ xảy ra ngay trước khi overlay được cài lại
(vào lại bàn/recovery/reload/DOM mất), không xảy ra ở các snapshot runtime
thường xuyên. Checkbox “Chỉ mô phỏng/test” chỉ chọn mode của tab; nút
“Bắt đầu chạy” luôn hiển thị. Simulation luôn virtual và không tham gia
physical aggregate.

Chỉ khi DOM workspace được tạo mới, thanh cuộn bảng điều khiển mới bắt đầu ở
đầu. Reinstall cùng DOM và snapshot runtime thông thường giữ nguyên vị trí
cuộn hiện có, không gây nhảy trang.

The `MultiChain` editor is multiline: each line represents one separate stake
chain. It is persisted through the existing SQLite-owned `stake_chains` field;
legacy semicolon-separated input remains valid.

The run control stays visible in both simulation and live modes and uses the
short visible label “Bắt đầu chạy”/“Dừng chạy”. The simulation checkbox changes
only the durable tab mode. The process-local operator run latch changes only on
an explicit Start/Stop command; internal execution pauses do not clear it.

`strategy_money_configs` is keyed by `(tab_id, manager_id)`. Every tab must
have an independent chain for all eight MoneyManagers. Missing records seed on
save/reload to `[0]` (`MultiChain` to `[[0]]`); never copy or overwrite another manager's
saved chain when switching the selected manager.

Health checks must treat a present `BrowserUiRuntime` as a present overlay. Do
not use the legacy DOM check alone when the legacy overlay is disabled: doing
so reinstalls the workspace repeatedly and causes visible header flicker.
