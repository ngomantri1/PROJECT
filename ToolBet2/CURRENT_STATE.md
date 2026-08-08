# Current State

## Validation update 2026-08-08

- Latest patch: the loading cover no longer blocks the manual table picker
  while phase is `WAITING_MANUAL`; backend reconciliation checks the provider's
  visible room before applying `last_confirmed_table` fallback.
- Post-patch checks: focused UI/table 40/40, full unittest 310 tests (2 skipped),
  controlled CDP validation PASS, py_compile and git diff --check PASS.

- Controlled Playwright UI validation covers the table-selection card, the
  `select_table` command and the header `change_table` command without a real
  casino session.
- `tests.test_ui_runtime` passes 34/34. Focused table-selection, persistence,
  login-probe, browser-startup and screenshot checks also pass.
- Full unittest discovery now passes 309 tests in 69 seconds (`OK`, 2 skipped
  C# reference cases). The license-cache regression is fixed by sharing the
  `LicenseService` clock with `ToolAuthService`.
- A headless UI resource sanity run covered 34 tests in 37.9 seconds with no
  extra browser runtime; sampled Python runner working set peaked at about
  3.3 MB. This is not a production CPU/RAM baseline.
- A 60-second isolated Chrome CDP resource baseline passed with 12 samples:
  Python peak working set 3.3 MB, Chrome peak working set 670 MB, Python CPU
  0.02 seconds, Chrome CPU 8.88 seconds, and peak process tree 14 processes.
  This remains a controlled baseline, not a production target.
- Production browser validation remains pending; use `auto_bet: false` and do
  not use real credentials, casino sessions, or the runtime database.
- `scripts/controlled_runtime_validation.py` now provides a repeatable isolated
  flow: manual selection -> TABLE_READY persistence -> reload -> change table,
  plus viewport bounds for 1024x768, 1280x720, 1920x1080, and 390x844.
- `scripts/controlled_cdp_validation.py` also passes through a real isolated
  headless Chrome CDP connection using a random loopback port and temporary
  profile; the configured port/profile are not touched.

## Phạm vi và bằng chứng

- Audit ngày 2026-08-08. Source hiện có `main.py`, `src/` và `tests/`; 343 khai
  báo test được tìm thấy bằng grep tĩnh. Không thể chạy pytest trong `.venv`
  hiện tại vì environment thiếu module `pytest`.
- `git rev-parse` cho thấy Git root là `D:\PROJECT`; `ToolBet2` không hiện là
  một worktree riêng trong `git status`. Các thay đổi ở project sibling được
  giữ nguyên và không thuộc audit này.
- `README.md` trước audit chưa tồn tại; bản mới chỉ là entrypoint tài liệu.

## Đã xác minh từ source

- Workspace strategy tabs, MoneyManager và mode nằm trong SQLite store; YAML là
  fallback/import khi chưa có workspace lưu.
- Run Start/Stop là process-local theo tab; overlay chỉ mirror state.
- Simulation vẫn tính/journal/settle nhưng không gọi physical chip executor.
- `AutoBettor` có pending/lock/duplicate guards; table/shoe/round là identity
  chính. Placement attempt và allocation được journal riêng.
- Collector AE SEXY dùng WS/HTTP làm nguồn reconcile chính; DOM/canvas hỗ trợ
  nhận diện/đọc UI. Table selection có fallback C01/C02/remaining cards và guard
  table-ready; chi tiết ở `TABLE_SELECTION_WORKFLOW.md`.
- `config.example.yaml` hiện để `license.enabled=false`, `live_execution.mode=disabled`,
  `game.table_name=Baccarat C01`. Đây là giá trị mẫu, không phải kết luận về
  file config runtime hoặc license của người dùng.
- Source có thay đổi browser gần đây: cửa sổ khởi động nhỏ, sau khi mở web/login
  thành công có thể maximize qua `src/browser.py` và `main.py`.

## Chưa có bằng chứng đầy đủ

- Chưa chạy browser end-to-end với casino thật trong audit này.
- Chưa có pytest runtime trong environment nên không xác nhận các con số “full
  suite pass” cũ trong tài liệu trước.
- Độ bền sau mọi loại navigation/recovery, license lease thực tế và aggregate
  physical placement cần runtime log/fixture tương ứng; không coi unit test là
  bằng chứng production.

## Table selection V1 đã cập nhật

- Startup lobby hiện chờ UI manual selection tối đa 30 giây; timeout mới chạy
  fallback. Snapshot V2 có countdown/candidate list và command `select_table`.
- `last_confirmed_table` được lưu additive tại bảng `halls` sau `TABLE_READY`;
  database cũ được migrate khi mở qua `src/database.py`.
- `change_table` tắt run, chặn pending/physical click và suppress recovery trong
  operator selection. Browser thật và screenshot đa viewport vẫn chưa được
  xác minh trong audit này.
- Đã sửa race khi đổi bàn: operator flow gọi lobby provider cưỡng bức và chờ
  lobby thực sự sẵn sàng trước khi bật các nút chọn bàn. Cần restart runtime
  hiện tại để nạp patch và nghiệm thu lại trên Chrome thật.
- Đã chặn callback `CAN_CLICK` và recovery tự động trong cửa sổ
  `WAITING_MANUAL`; startup lobby không còn tự dùng `last_confirmed_table` trước
  khi countdown kết thúc. Cần kiểm tra lại startup Chrome thật sau khi restart.
- Đã thêm xử lý `TargetClosed` khi iframe AE SEXY đang load: startup reconnect
  CDP/resolve lại page tối đa một lần và overlay không tiếp tục thao tác trên page
  đã đóng. Cần nghiệm thu Chrome thật sau khi restart process.
