# Điều kiện chạy cược thật (tài liệu lịch sử KILL_SWITCH)

> Tài liệu này được giữ để giải thích các log/triển khai cũ. KILL_SWITCH
> sentinel không còn là gate của source hiện tại theo quyết định nghiệp vụ đã
> xác nhận. Không dùng tài liệu này để suy ra runtime state mới; xem
> [BUSINESS_RULES.md](BUSINESS_RULES.md) và [CURRENT_STATE.md](CURRENT_STATE.md).

## Gate hiện tại

Physical live chỉ được đi qua khi đồng thời đạt Tool/license capability,
`live_execution.mode`, RiskDecision, tab/run state, table/shoe/round identity,
pending/duplicate guard, countdown/UI readiness, journal và real-bet guard.
Simulation dùng cùng decision pipeline nhưng không gọi chip executor.

## KILL_SWITCH cũ

Các mô tả về `data/KILL_SWITCH`, `TOOLBET_KILL_SWITCH` hoặc
`TOOLBET_DISABLE_LIVE` chỉ áp dụng cho các phase/pilot cũ. Source hiện tại không
được coi là có gate này; không tạo, xóa hoặc chỉnh file sentinel để xử lý lỗi
runtime. Muốn dừng remote dùng license revoke/lease policy theo
`LICENSE_DEPLOYMENT.md`.
