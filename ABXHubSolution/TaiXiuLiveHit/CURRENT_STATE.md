# CURRENT_STATE

## Snapshot audit — 2026-08-08

- Project: WPF .NET 8, target `net8.0-windows`; Release self-contained `win-x64`, Debug plugin cho AutoBetHub/ABX.
- Có 18 class strategy triển khai `IBetTask`, khớp 18 lựa chọn trong `MainWindow.xaml`.
- Các file context đã chuẩn hóa: `AGENTS.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `BUSINESS_RULES.md`, `CURRENT_STATE.md`, `TODO.md`, `BUGS.md`, `README.md`.
- Source hiện có các flow live money, `MultiChainAdvanced`, skip `0`, pending finalize và bridge readiness/reinject.
- Không tìm thấy thư mục test trong project; các TODO regression chưa có bằng chứng test trong repository.
- Các rủi ro đang mở được liệt kê trong `BUGS.md`; không có mục nào được đánh dấu hoàn thành chỉ từ việc code tồn tại.

## Cách đọc nhanh

1. `PROJECT_CONTEXT.md` — phạm vi và invariant.
2. `CURRENT_STATE.md` — snapshot hiện tại.
3. `ARCHITECTURE.md`/`BUSINESS_RULES.md` — mô tả hệ thống và rule.
4. `TODO.md`/`BUGS.md` — việc còn lại và rủi ro có bằng chứng.
