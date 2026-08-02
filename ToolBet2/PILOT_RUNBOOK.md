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
3. `stake_zero`: mọi mức tiền bằng 0; xác nhận không click chip và vẫn resolve
   trạng thái riêng cho các tab.
4. `small_stake`: license thật; xác nhận một hoặc nhiều tab live, kể cả khi
   Player và Banker cùng được phân bổ, chỉ với tổng stake trong ngưỡng pilot.
5. Nhóm khách giới hạn: chỉ sau khi các cổng có liên quan có biên bản PASS.

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

## 4. Kill switch và license revoke

- Chạy `STOP-LIVE-BET.bat`: tạo kill switch trong data người dùng. Cược mới bị
  chặn; cược pending vẫn được resolve/persist.
- Chạy `ALLOW-LIVE-BET.bat`: chỉ gỡ kill switch local. License và RiskDecision
  vẫn phải hợp lệ.
- Khi cần dừng từ xa, revoke account/device trên license server. Client sẽ
  fail-closed ở lần refresh/kiểm tra kế tiếp.

## 5. Tiêu chí dừng pilot

Dừng ngay và giữ kill switch nếu có một trong các trường hợp:

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
