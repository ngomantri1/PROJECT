# Bugs

## Open Bugs

Không còn bug mở được xác nhận từ lần rà soát tài liệu ngày 2026-08-02.

## Investigating

Không có bug runtime nào đang được điều tra có bằng chứng trong source/Git hiện có.

## Fixed Bugs

### Sửa hướng dẫn deploy tham chiếu `build.bat` không tồn tại

- Đã thay mục build bằng quy trình copy source và chạy `ToolBet.bat` trên máy đích.
- Liên quan: `HUONG_DAN_CAI_DAT.md`.
- Status: Fixed ngày 2026-08-02.

### Bổ sung progression mode thứ năm

- Đã thêm `profit_lock_loss_up` và mô tả hành vi vào hướng dẫn, đồng thời cập nhật comment trong config mẫu.
- Liên quan: `HUONG_DAN_CAI_DAT.md`, `config.example.yaml`, `src/progression.py`.
- Status: Fixed ngày 2026-08-02.

## Known Risks / Fragile Areas

Các mục sau là rủi ro đã quan sát, không được khẳng định là bug:

- Selector, iframe, WS/HTTP payload và chip UI của casino/provider có thể đổi ngoài project.
- Multi-source history reconciliation rất nhạy với table identity, stats và timing; append sai có thể resolve nhầm bet.
- Recovery có nhiều fallback và phải phối hợp với pending/click lock; sửa timeout hoặc threshold có thể tạo reload giữa lúc đặt cược.
- Không có automated tests cho logic tiền/P&L/progression hoặc browser flow.
- Project không có `.gitignore` nhưng workspace chứa `credentials.yaml`, `config.yaml`, `data/toolbet.db` và Chrome profile. Nếu track nguyên thư mục có nguy cơ lộ secret/session và commit runtime data.
- DB migration có thao tác dedup/index khi startup; phải backup DB thực trước khi thay đổi schema/migration.
