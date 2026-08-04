# ToolBet2 — Runbook đóng gói và pilot

## 1. Build bản nội bộ

```powershell
.\scripts\build_release.ps1 -Version 0.8.0 -Channel internal
```

Script bắt buộc chạy test, đóng gói Python/Playwright/UI bằng PyInstaller
`onedir`, tạo SHA-256 manifest, tự xác minh và tạo ZIP trong `dist/`.

Bản customer bắt buộc HTTPS license server, Ed25519 public key và chứng thư code
signing:

```powershell
.\scripts\build_release.ps1 `
  -Version 1.0.0 `
  -Channel customer `
  -LicenseApiUrl "https://license.example.com" `
  -LicensePublicKey "C:\secure\license_public.pem" `
  -SigningThumbprint "CERTIFICATE_THUMBPRINT"
```

Private signing key của license server và mật khẩu game không được đưa vào bộ
cài. Không dùng `-SkipTests` cho bản customer.

## 2. Layout máy khách

- Thư mục giải nén: executable, dependency, manifest và tài liệu bất biến.
- `%LOCALAPPDATA%\ToolBet2`: `config.yaml`, SQLite, log, report, license cache và
  Chrome profile.
- Nâng cấp bằng cách giải nén bản mới sang thư mục mới rồi chạy `ToolBet.bat`.
  Dữ liệu người dùng không bị ghi đè.
- Rollback bằng cách chạy `ToolBet.bat` của thư mục release trước đó.

Không copy `credentials.yaml`, `toolbet.db`, Chrome profile hoặc license cache
giữa các máy.

## 3. Các cổng pilot

Mỗi cổng phải chạy tối thiểu đủ ca reload, mất CDP, đổi bàn và restart:

1. `simulation`: `auto_bet=false`; kiểm tra UI, replay và thống kê.
2. `shadow`: tùy chọn so sánh đường legacy, không phải điều kiện chuyển tab live.
3. `stake_zero`: đúng một tab live, `auto_bet=false` lúc chạy preflight và mọi
   mức tiền authoritative của MoneyManager bằng 0; sau khi PASS mới xác nhận
   không click chip và vẫn resolve trạng thái tab.
4. `small_stake`: giai đoạn pilot đầu chỉ dùng đúng một tab live và
   `auto_bet=false` lúc chạy preflight. License production phải có URL HTTPS,
   public key và signed cache hợp lệ với capability `live_bet`; mọi mức tiền có
   thể quote phải nằm trong ngưỡng pilot.
5. Nhóm khách giới hạn: chỉ sau khi các cổng có liên quan có biên bản PASS.

Preflight đọc `database.path` từ file config và dùng SQLite làm nguồn
authoritative cho tab/MoneyManager. Nó kiểm tra `strategy_money_configs`,
MultiChain, khả năng Victor2 nhân đôi và chặn mọi bet chưa có outcome. Giá trị
`betting.stakes` trong YAML không thể làm giảm trần stake của tab live.

Kiểm tra:

```powershell
.\.venv\Scripts\python.exe scripts\pilot_preflight.py shadow
.\.venv\Scripts\python.exe scripts\pilot_preflight.py stake_zero
.\.venv\Scripts\python.exe scripts\pilot_preflight.py small_stake `
  --max-stake 100 --ack "I ACCEPT SMALL STAKE PILOT"
```

Trong bản đóng gói dùng:

```powershell
ToolBet2\ToolBet2.exe --pilot-preflight shadow
ToolBet2\ToolBet2.exe --pilot-preflight small_stake --ack-small-stake
```

### Lease canary tiền nhỏ

Sau khi đã xử lý mọi blocker và backup DB, arm một lease hữu hạn. Ví dụ dưới
đây giới hạn tổng stake mỗi ván 100,
tối đa 3 bet, lỗ tối đa 300 và hết hạn sau 30 phút:

```powershell
.\.venv\Scripts\python.exe scripts\small_stake_pilot.py arm `
  --config config.yaml --max-stake 100 --max-bets 3 `
  --max-loss 300 --duration-minutes 30 `
  --ack "I ACCEPT FINITE SMALL STAKE PILOT"
```

Lease gắn đúng một `tab_id` và SQLite. Runtime kiểm tra lại trước từng physical
click; thay tab, tăng envelope stake, có pending khác, hết thời gian/số bet,
chạm stop-loss, mất lease hoặc bật Nuôi Hòa đều chặn. Không sửa
file JSON bằng tay.

Kết thúc ca: tắt Auto, chờ mọi pending được resolve, lấy báo cáo rồi đóng lease:

```powershell
.\.venv\Scripts\python.exe scripts\small_stake_pilot.py finish --config config.yaml
.\.venv\Scripts\python.exe scripts\small_stake_pilot.py close --config config.yaml
```

Bản đóng gói dùng `ToolBet2.exe --small-stake-pilot arm|status|finish|close`
với cùng các flag. `finish` chỉ PASS khi có ít nhất một bet tiền thật mới, toàn
bộ đã resolve và ca không vượt bất kỳ giới hạn lease nào.

### Bằng chứng ca stake-zero

Sau khi preflight `stake_zero` PASS, lấy baseline trước khi bật ca:

```powershell
.\.venv\Scripts\python.exe scripts\stake_zero_audit.py start --config config.yaml
```

Ghi lại `baseline_bet_id`. Sau khi kết thúc ca, tắt Auto và chờ hết pending rồi
chạy:

```powershell
.\.venv\Scripts\python.exe scripts\stake_zero_audit.py finish `
  --config config.yaml --after-bet-id 123 `
  --output reports\stake-zero-evidence.json
```

`finish` chỉ PASS khi có ít nhất một bet mới, tất cả đều đã resolve với stake 0
và `execution_mode=virtual`, đồng thời mọi allocation đều stake 0/virtual. Bản
đóng gói dùng `ToolBet2.exe --stake-zero-audit start|finish`. Báo cáo DB không
thay thế kiểm tra UI/collector/reload của operator trong ca browser.

Xử lý mọi lỗi preflight và backup DB trước khi operator bắt đầu đúng ca pilot
đã duyệt. Nếu preflight báo pending,
không xóa/sửa DB thủ công để ép PASS.

### Đối chiếu pending sau restart

Dừng ToolBet trước khi đối chiếu. Trước hết chỉ liệt kê:

```powershell
.\.venv\Scripts\python.exe scripts\reconcile_pending.py list --config config.yaml
```

Chỉ khi có kết quả từ nguồn WS/HTTP hoặc hồ sơ vận hành đáng tin cậy, chạy
resolve với đúng `bet-id`, nguyên văn `round-id`, mô tả evidence và câu ack:

```powershell
.\.venv\Scripts\python.exe scripts\reconcile_pending.py resolve `
  --config config.yaml --bet-id 27 `
  --round-id "ae_sexy:C03:24963:39" --result player `
  --evidence "trusted source reference" `
  --ack "I VERIFIED TRUSTED ROUND RESULT"
```

Ví dụ trên chỉ minh họa cú pháp; không dùng `player` cho bet 27 nếu chưa có bằng
chứng. Command tự tạo backup đã `quick_check`, từ chối `placing`/`uncertain` và
ghi audit event. Khởi động lại ToolBet sau đối chiếu để xóa pending trong memory.
Bản đóng gói dùng cùng contract qua `ToolBet2.exe --reconcile-pending list`
hoặc `--reconcile-pending resolve` với các flag tương tự.

## 4. License revoke

- KILL_SWITCH local đã được bỏ theo quyết định nghiệp vụ đã xác nhận.
- Khi cần dừng từ xa, revoke account/device trên license server. Client sẽ
  fail-closed ở lần refresh/kiểm tra kế tiếp.

## 5. Tiêu chí dừng pilot

Dừng phiên chạy ngay nếu có một trong các trường hợp:

- Click sai cửa, sai chip hoặc duplicate round.
- Cược mới xuất hiện khi pending chưa resolve.
- Collector không reconcile được WS/HTTP hoặc nguồn kết quả xuống cấp.
- Browser/license/UI health bị lỗi nhưng tab không tự demote.
- SQLite mất pending, money state hoặc tab state sau restart.
- CPU/RAM vượt baseline đã duyệt liên tục.

Không xóa DB khi đang có pending. Sao lưu toàn bộ `%LOCALAPPDATA%\ToolBet2` trước
khi điều tra hoặc rollback schema.

## 6. Support bundle và đo tài nguyên

Bản source:

```powershell
.\.venv\Scripts\python.exe scripts\export_diagnostics.py
.\scripts\measure_resource_baseline.ps1
```

Bản đóng gói: chạy `EXPORT-DIAGNOSTICS.bat`. ZIP chỉ chứa config/log đã che bí
mật, thông tin hệ thống và thống kê schema/count; không chứa DB, password, token
hoặc cookie.
