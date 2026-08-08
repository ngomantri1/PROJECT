# Bugs and Risks

## Open, có bằng chứng

### Test runner chưa khả dụng trong `.venv`

`D:\PROJECT\ToolBet2\.venv\Scripts\python.exe -m pytest --collect-only -q`
không chạy được vì thiếu module `pytest`. Đây là khoảng trống kiểm chứng, không
phải kết luận source có lỗi.

### Live authority sau shoe transition chưa có root cause

Log lịch sử từng cho thấy placement trước transition rồi xuất hiện
`NO_ELIGIBLE_AUTHORITY`, nhưng thiếu đủ RiskDecision/tab fields để kết luận.
Source đã có structured diagnostic; cần một lần tái hiện non-money để phân tích.

### Browser/provider end-to-end chưa được chứng minh

Selector, iframe, stream, chip UI và payload provider có thể đổi ngoài project.
Multi-live placement/recovery mới có kiểm thử mock/unit theo tài liệu hiện tại,
chưa có bằng chứng casino thật trong audit này.

### License cache/lease cần runtime verification

Source có signed client và `ReferenceLicenseService`, nhưng audit này không gọi
endpoint và không xác nhận cache/heartbeat/expiry trên thiết bị thật.

## Known limitations (không gọi là bug)

- Config/runtime data (`config.yaml`, `credentials.yaml`, `data/`, Chrome profile)
  là dữ liệu triển khai, không nên commit hoặc đưa vào context.
- Database migration được thiết kế additive nhưng bản production phải backup
  trước khi nâng phiên bản.
- DOM/canvas/lobby history có thể stale; hệ thống phải giữ pending chưa xác nhận
  thay vì đoán kết quả.

## Đã xử lý trong source nhưng không lặp lại như changelog

Các invariant đã xác minh qua code hiện tại được ghi ở
[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) và [BUSINESS_RULES.md](BUSINESS_RULES.md):
table-scoped pending, exact-round guard, simulation không click chip, per-tab
run state, overlay lifecycle và additive schema migration. Chi tiết lịch sử patch
không thuộc tài liệu bug hiện hành.
