# Kế hoạch xây dựng lại giao diện và nghiệp vụ ToolBet2

## 1. Cách hiểu chính xác

`BaccaratChromeAgent2` chỉ là bản tham chiếu về hình ảnh, cách bố trí và nghiệp vụ.
ToolBet2 không dùng C#, WPF, WebView2 và không lấy lại code giao diện của project
tham chiếu.

Sản phẩm tiếp tục là ứng dụng Python hiện tại:

- Python/asyncio/Playwright xử lý Chrome, captcha, đăng nhập game, lấy kết quả,
  recovery và đặt cược.
- HTML/CSS/JavaScript tạo các màn hình ToolBet2 và overlay trong Chrome.
- Python truyền state cho UI và nhận command qua các bridge có kiểm soát.
- SQLite lưu cấu hình, trạng thái, thống kê và lịch sử; không quay lại CSV.

Mục tiêu là làm giao diện ToolBet2 có hình ảnh và nghiệp vụ gần như giống
`BaccaratChromeAgent2`, nhưng được viết lại bằng HTML/CSS/JavaScript và kết nối
vào engine Python đang có.

## 2. Luồng màn hình mới

```text
Khởi động ToolBet2
  -> Màn hình 1: Đăng nhập tài khoản Tool
     -> login / dùng thử / trạng thái license
  -> Màn hình 2: Đăng nhập tài khoản Game
     -> chọn site / tài khoản game / ghi nhớ
     -> Python dùng captcha và login flow hiện tại
  -> Chrome vào AE SEXY
  -> Màn hình 3: Giao diện quản lý ToolBet2 trong trang game
     -> tab chiến lược
     -> chiến lược & quản lý vốn & chuỗi tiền
     -> trạng thái
     -> thống kê
     -> lịch sử cược
```

Không cho mở màn hình đăng nhập Game nếu Tool login/license chưa hợp lệ. Không cho
bật cược thật nếu game chưa ready hoặc capability của license không cho phép.

## 3. Kiến trúc giao diện ToolBet2

### UI shell

Tách UI khỏi chuỗi JavaScript lớn trong `src/overlay.py` thành các asset:

```text
src/ui/
  shared/
    theme.css
    components.css
    bridge.js
  tool_login/
    index.html
    screen.css
    screen.js
  game_login/
    index.html
    screen.css
    screen.js
  workspace/
    index.html
    workspace.css
    workspace.js
    strategy_tabs.js
    status_panel.js
    statistics_panel.js
    bet_history.js
```

Python vẫn sở hữu lifecycle của page/overlay và inject/bind lại UI khi navigation
hoặc reload. UI chỉ render state; không tự đọc DOM casino và không tự click chip.

### UI state và command

- `UiSnapshot`: tool session, game session, engine health, active table, history,
  tabs, strategy, money, risk, pending bet, statistics và bet history.
- `UiCommand`: tool login/logout, game login, save tab, đổi mode
  simulation/live, bật/tắt chạy thật, query history và update settings.
- Bridge phải có schema/version và trả kết quả `ok/error`; không truyền password,
  token hoặc cookie vào log.
- Mọi refresh UI phải idempotent để overlay có thể mất rồi được inject lại.

### Quyền sở hữu nghiệp vụ

- Collector/TableState là nguồn lịch sử bàn.
- StrategyDecision quyết định cửa và lý do.
- MoneyManager quyết định stake/level.
- RiskDecision quyết định được phép cược hay không.
- AutoBettor là đường duy nhất được phép arm và click cược thật.
- GameOverlay/UI không được tạo pending bet hoặc gọi hàm click chip trực tiếp.

## 4. Parity với giao diện tham chiếu

### Màn đăng nhập Tool

Làm lại bằng HTML/CSS theo ảnh tham chiếu:

- Tiêu đề `Đăng nhập & Điều hướng`, badge trạng thái.
- Tên đăng nhập Tool, mật khẩu, ghi nhớ đăng nhập.
- `Đăng nhập Tool`, `Dùng thử Tool`.
- Thông báo license, thời hạn, thiết bị và trạng thái kết nối.

Không hiển thị URL/tài khoản Game tại màn này.

### Màn đăng nhập Game

Chỉ xuất hiện sau Tool login:

- Chọn site.
- Tài khoản và mật khẩu Game.
- Ghi nhớ tài khoản.
- Nút đăng nhập/tiếp tục.
- Trạng thái Chrome, captcha, login, vào sảnh và vào bàn.

Màn này sử dụng nguyên nghiệp vụ `credentials`, `auth`, `auth_flows`,
`login_panel` và site adapter hiện tại.

### Workspace trong trang game

Viết bằng HTML/CSS/JavaScript và hiển thị như các panel ToolBet2 hiện tại, nhưng
bố cục/nội dung bám giao diện tham chiếu:

- Thanh tab: thêm, đóng, đổi tên, đổi thứ tự và trạng thái chạy.
- Card `Chiến lược & Chuỗi tiền`.
- Dropdown chiến lược và quản lý vốn.
- Chuỗi tiền, countdown, cắt lãi, cắt lỗ, auto reset.
- Nút chạy thật toàn cục và trạng thái tab simulation/live.
- Card `Trạng thái`.
- Card `Thống kê`.
- Card `Lịch sử cược` có lọc và phân trang.

Giao diện phải responsive ở 1366×768, 1920×1080 và Windows scaling 100%/125%.
Overlay không được che khu vực cược quan trọng; có chế độ thu gọn và kéo thả.

## 5. Dữ liệu

SQLite tiếp tục là nguồn dữ liệu bền vững:

- `strategy_tabs`: cấu hình và thứ tự tab.
- `strategy_runtime`: trạng thái runtime tab; mode vận hành hiện hành là
  simulation/live.
- `money_states`: snapshot theo tab và money manager.
- `strategy_decisions`: signal, reason, confidence và risk result.
- `bets`: lifecycle cược thật hiện tại.
- `tool_sessions` và `license_audit`: trạng thái xác thực, không chứa password/token
  thô.

Python là writer chính. UI đọc/ghi thông qua service/domain trong Python, không tự
chạy SQL từ JavaScript. YAML hiện tại được import một lần rồi giữ làm fallback
cho cấu hình hệ thống.

## 6. Các giai đoạn triển khai

### Giai đoạn A — Chuẩn hóa UI runtime

1. [x] Tách theme/component/bridge khỏi `overlay.py`.
2. [x] Định nghĩa `UiSnapshot` và `UiCommand`.
3. [x] Giữ giao diện overlay cũ chạy song song sau feature flag trong lúc chuyển đổi.
4. [x] Thêm browser fixture test cho inject, reload và responsive.

**Nghiệm thu:** UI mới có thể bị xóa khỏi DOM và tự cài lại mà không mất tab/state;
không thay đổi collector, recovery hoặc AutoBettor.

Trạng thái 2026-08-02: runtime v2 là mặc định và legacy overlay là rollback;
browser fixture đã phủ inject, xóa DOM, reload, responsive và phục hồi state.

### Giai đoạn B — Tool Login trước Game Login

1. [x] Xây màn Tool login HTML/CSS giống ảnh tham chiếu.
2. [x] Tạo `ToolAuthService` và session state.
3. [x] Login thành công mới điều hướng tới màn Game login.
4. [x] Tái sử dụng toàn bộ game login/captcha/site adapter hiện tại.
5. [x] Thêm logout Tool và đổi tài khoản Game độc lập.

**Nghiệm thu:** không thể vào Game login/workspace khi Tool session chưa hợp lệ;
captcha và tự đăng nhập Game vẫn hoạt động như trước.

Trạng thái 2026-08-02: Tool Login local dùng PBKDF2 và session trong process.
License authority/client ở giai đoạn F có thể cung cấp capability production.

### Giai đoạn C — Workspace giống BaccaratChromeAgent2

1. [x] Port hình ảnh card, tab, form, bảng trạng thái, thống kê và lịch sử sang
   HTML/CSS/JavaScript.
2. [x] Mỗi tab có config/runtime/statistics/history riêng.
3. [x] Chuyển lưu tab từ YAML sang SQLite.
4. [x] Nối các strategy mô phỏng đã có.
5. [x] Thêm screenshot regression tại các kích thước/DPI mục tiêu.

**Nghiệm thu:** giao diện và thao tác chính tương đương bản tham chiếu; đóng/mở tool
không mất tab. Lifecycle live được bổ sung ở giai đoạn D.

Trạng thái 2026-08-02: hoàn thành workspace HTML/CSS/JavaScript, SQLite là nguồn
lưu bền vững cho cấu hình/runtime/thống kê/lịch sử riêng của từng tab. UI runtime v2
được bật mặc định, legacy overlay giữ làm rollback. Screenshot regression chạy tại
1280×720, 1920×1080 scaling 125% và 390×844 scaling 200%.

### Giai đoạn D — Tab live và AutoBettor

1. [x] Tab có switch trực tiếp `simulation`/`live`.
2. [x] Nhiều tab live chạy song song; stake được gom theo Player/Banker và có thể
   đặt cả hai cửa trong cùng ván.
3. [x] Tab cung cấp StrategyDecision/MoneyManager; AutoBettor hiện tại vẫn
   arm/click/persist một pending aggregate.
4. [x] RiskDecision chặn license, pending, duplicate round, shuffle, source,
   countdown, UI health và balance tổng.
5. [x] Tự demote các tab live khi engine/browser/license không an toàn.

**Nghiệm thu code:** unit tests phủ authority aggregate và Stake 0. Nghiệm thu
vận hành còn yêu cầu `auto_bet=false`, stake 0 và pilot stake nhỏ có kiểm soát.

Trạng thái 2026-08-02: hoàn thành code lifecycle, bridge UI, SQLite migration,
multi-live authority, RiskDecision và auto-demote fail-closed. Direct live không
cần shadow threshold/Promote. Chưa chạy pilot tiền thật.

### Giai đoạn E — Hoàn thiện 8 quản lý vốn

Port theo nghiệp vụ tham chiếu, không port code C#:

1. `IncreaseWhenLose`
2. `IncreaseWhenWin`
3. `Victor2`
4. `ReverseFibo`
5. `MultiChain`
6. `IncreaseEveryRound`
7. `WinUpLoseKeep`
8. `WinUpLoseDown`

Mỗi MoneyManager Python phải có `quote`, `apply_result`, `snapshot`, `restore`,
`reset`, xử lý Tie/push, Banker commission, TP/SL và restart. Chuỗi tiền lưu theo
tab + money manager trong SQLite.

**Nghiệm thu:** replay cùng fixture tạo stake/level/P&L giống kết quả tham chiếu;
restore state cho quyết định ván tiếp theo giống trước khi restart.

Trạng thái 2026-08-02: hoàn thành code cả 8 MoneyManager Python. Runtime active
tab dùng `StrategyDecision -> MoneyManager -> RiskDecision`; AutoBettor vẫn là
thành phần duy nhất arm/click/persist. Tie được tính push, Banker dùng commission
5%, TP/SL tự tắt cược mới. Cấu hình chuỗi và snapshot runtime được lưu riêng theo
`tab_id + manager_id` trong SQLite. Fixture parity, MultiChain, commission,
TP/SL, reset và restart đều có fixture regression. Chưa chạy pilot tiền thật.

### Giai đoạn F — License

1. Tool account, password hash, refresh rotation và device activation.
2. Plan/capability, expiry, max device, revoke và audit.
3. Signed lease có thời hạn ngắn và grace period giới hạn khi mất mạng.
4. Tool login điều khiển màn hình; RiskDecision kiểm tra lại capability trước bet.
5. Không hard-code secret hoặc dùng file/repo license plaintext.

**Nghiệm thu:** expire/revoke chặn cược mới nhưng vẫn resolve pending; copy data sang
máy khác không kích hoạt được; log không có credential/token.

Trạng thái 2026-08-02: hoàn thành license client và authority server tách biệt.
Lease được ký Ed25519, gắn device, có plan/capability, expiry, refresh rotation,
revoke, max-device, offline grace giới hạn và audit SQLite phía server. Refresh
token phía client được bảo vệ bằng Windows DPAPI; private key không nằm trong
ToolBet khách hàng. `workspace` chặn trước Game Login, `live_bet` được kiểm tra
lại ở RiskDecision ngay trước click. Khi revoke/expire, cược mới bị chặn và tab
live bị demote; cược pending vẫn được resolve/persist trước khi thoát. Hướng dẫn
triển khai tại `LICENSE_DEPLOYMENT.md`.

### Giai đoạn G — Port chiến lược AI/thống kê

Các strategy đã có trong `src/statistical_strategies.py` gồm thống kê B/P,
state-transition, run-length, ensemble, lịch, KNN, n-gram, expert panel và
Top10. Chúng trả `StrategyDecision` deterministic, không gọi Playwright/chọn
stake/click chip. Chi tiết chính xác và hai strategy chưa đủ dữ liệu để live nằm
trong `PHASE_G_STRATEGIES.md`.

Strategy chạy qua simulation/replay và có thể được bật live trực tiếp nếu strategy
đủ điều kiện live. Shadow chỉ còn là công cụ so sánh legacy.

### Giai đoạn H — Đóng gói và pilot

1. [x] Đóng gói Python, HTML/CSS/JS asset, browser dependency và migration.
2. [x] Tách data người dùng khỏi thư mục cài đặt; nâng cấp không mất SQLite/config.
3. [x] Pipeline code signing, checksum, crash report redacted và rollback.
4. [x] Gate pilot: simulation, tùy chọn shadow comparison, stake 0, stake nhỏ,
   nhóm khách giới hạn.
5. [x] License revoke và tài liệu support; local kill switch was later retired.
6. [ ] Đo CPU/RAM của phiên pilot đủ thời lượng so với baseline hiện tại.

**Nghiệm thu:** cài mới/nâng cấp/gỡ sạch; recovery qua reload/mất mạng; không mất
pending/state; tài nguyên trong ngân sách.

Trạng thái 2026-08-02: đã tạo pipeline PyInstaller `onedir`, launcher không cần
Python hệ thống, tách data sang `%LOCALAPPDATA%\ToolBet2`, SHA-256 integrity,
customer build bắt buộc HTTPS license/public key/code-signing certificate,
rotating log có redaction, support ZIP và pilot preflight
fail-closed. Artifact nội bộ `0.8.0` đã qua packaged self-check cho Playwright,
UI assets, ddddocr/ONNX và SQLite. Chưa gọi đây là bản customer:
còn cần endpoint/license public key/certificate production, chạy pilot thực tế
theo từng gate và đo CPU/RAM đủ thời lượng.

## 7. Bộ kiểm thử bắt buộc

- Python unit/characterization tests.
- UI bridge/schema tests.
- Browser fixture cho inject/reload/responsive.
- Screenshot visual regression so với ảnh tham chiếu.
- SQLite migration và restart-state tests.
- Deterministic replay cho strategy và 8 MoneyManager.
- Integration fixture cho WS/HTTP reconciliation.
- Live smoke luôn bắt đầu với `auto_bet=false`.
- Recovery test khi reload, mất CDP, đổi bàn và Tool restart.

## 8. Trạng thái tiếp theo

Các giai đoạn A–H có code nền tảng trong source. Việc tiếp theo là nghiệm thu vận
hành theo `TODO.md` và `PILOT_RUNBOOK.md`: quan sát `auto_bet=false`, stake 0,
small stake có kiểm soát, recovery thật và đo tài nguyên đủ thời lượng.
