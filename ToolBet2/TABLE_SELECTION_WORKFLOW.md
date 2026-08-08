# ToolBet v2 — nghiệp vụ chọn bàn AE SEXY

Tài liệu này mô tả luồng chọn bàn được xác minh từ source hiện tại, để dùng khi phân tích nghiệp vụ hoặc hỏi ChatGPT. Đây là mô tả hành vi của code, không phải cam kết mọi phiên runtime đều chọn bàn thành công.

## 1. Phạm vi và nguồn cấu hình

- Website được chọn ở màn hình Web/Tài khoản/Mật khẩu. Lựa chọn này chỉ chọn site adapter, URL, shell mode và frame/selector tương ứng; nó không tự chọn bàn.
- Bàn ưu tiên nằm trong `config.yaml` tại `game.table_name`. Cấu hình hiện tại và file mẫu là `Baccarat C01`.
- Tên bàn được chuẩn hóa về dạng `Baccarat C01`, `Baccarat C02`, ... để tránh lệch giữa `C1` và `C01`.

## 2. Thứ tự tổng quát khi khởi động

1. `main.py` xác định page web/game sau khi đăng nhập.
2. Nếu đã ở room/lobby/loading, code thử phát hiện bàn thực tế từ room DOM, collector hoặc WebSocket state. Bàn phát hiện được có thể ghi đè bàn cấu hình vì đó là bàn người dùng đang ở.
3. Nếu chưa có bàn thực tế, code dùng `config.game.table_name` làm `wanted`.
4. Khi ở lobby, `_enter_table_from_lobby()` đọc danh sách bàn hiện có và tạo danh sách ứng viên bằng `lobby_table_candidates()`.

## 3. Thuật toán ứng viên

Hàm: `src/ae_sexy.py::lobby_table_candidates(wanted, available)`.

Thứ tự:

1. Bàn mục tiêu nếu có trong danh sách lobby (`preferred`).
2. Nếu mục tiêu là C01 nhưng C01 không có, thử C02 (`fallback_c02`).
3. Sau đó thử các bàn còn lại có trong lobby theo mã số tăng dần (`fallback_first`).
4. Nếu không đọc được danh sách lobby, thử mù bàn mục tiêu (`preferred_blind`).
5. Nếu hoàn toàn không có ứng viên, dùng bàn mặc định chuẩn hóa (`default`).

Ví dụ với cấu hình C01 và lobby có C02, C03, C04:

```text
Baccarat C01(preferred), Baccarat C02(fallback_c02), Baccarat C03(fallback_first), ...
```

Nếu C01 thật sự có trong danh sách, C01 đứng đầu. C02 chỉ là fallback, không phải bàn mặc định mới.

## 4. Cách đọc và vào bàn

`main.py::_enter_table_from_lobby()` thực hiện:

1. Cài overlay sớm và cuộn lobby để các card bàn được render/lazy-load.
2. Đọc danh sách bàn từ các frame/provider document.
3. Ghi danh sách bàn vào store để audit; đây không phải nguồn kết quả ván.
4. Với từng ứng viên, đọc roadmap nếu có, gọi `_attempt_table_entry()`, cuộn đến card rồi gọi `src/ae_sexy.py::enter_ae_sexy_table()`.
5. Xác nhận đã vào room bằng chip/zone, room state, stream và history theo các guard hiện có.
6. Dừng ở ứng viên đầu tiên đạt trạng thái room/table-ready. Nếu thất bại, chuyển sang ứng viên kế tiếp; click card thành công riêng lẻ chưa được coi là đã vào bàn.

Các phương thức click có nhiều fallback: locator trong document, mouse theo tọa độ card, JavaScript trong frame, gamehall frame locator và page exact text. Mỗi lớp có log nguyên nhân khi thất bại.

## 5. Overlay có che bàn hay không?

Overlay không được xem là nguồn nhận diện bàn. Trước thao tác click lobby, `_hide_overlay_for_click()` đặt `pointer-events: none` cho overlay. Sau thao tác, `_restore_overlay_after_click()` bật lại panel.

Các hàm tìm/scroll/click card loại trừ `#toolbet-ui-v2`. Vì vậy:

- Overlay che phần nhìn thấy của card C01 không làm card biến mất khỏi DOM.
- Code vẫn có thể scroll card vào giữa viewport rồi click bằng locator/JS/mouse.
- Nếu card nằm trong iframe gamehall, code tìm đúng frame trước khi click.
- Nếu lobby chưa hiển thị hoặc iframe chưa sẵn sàng, code chờ/bật lobby rồi thử lại; không tự coi là đã vào bàn.

## 6. Khi recovery hoặc navigation

- Runtime có thể phát hiện bàn thực tế sau navigation/reload và cập nhật `state.table_name`/`state.table_id`.
- Recovery phải xác nhận page/frame/room hiện tại trước khi đặt cược.
- Nếu bàn mục tiêu cũ không còn, thuật toán có thể fallback C02/các bàn khác, nhưng lịch sử và pending bet vẫn phải scope theo bàn; không dùng kết quả bàn cũ cho bàn mới.
- Nếu đang trong room có UI chip/zone, code tránh quay ra lobby chỉ để click lại nhằm không tạo màn đen hoặc làm gián đoạn pending bet.

## 7. Log cần xem khi kiểm tra chọn bàn

- `Doc sanh AE SEXY: ...` — danh sách bàn đọc được.
- `Ke hoach vao ban: ...` — thứ tự ứng viên và lý do.
- `Vao ban: ... (ban muc tieu/fallback_c02/fallback_first)` — ứng viên đang thử.
- `Scroll den ban ...` — đã tìm/đưa card vào viewport.
- `Click the ban ...` — lớp click nào đã được dùng.
- `Ban ... khong co tren sanh ... thu ...` — C01 không khả dụng và chuyển fallback.
- `[TABLE_READY] table=...` — đã xác nhận bàn sẵn sàng.
- `Da trong ban ... (chip/zone) — bo qua vao lai` — đã ở đúng room, không click lobby lại.

## 8. Không nên hiểu nhầm

- Chọn website không phải là chọn bàn ngầm.
- C01 là mặc định cấu hình hiện tại, không phải lúc nào cũng là bàn chạy cuối cùng nếu C01 vắng/bảo trì hoặc runtime đang ở bàn khác.
- Card có mặt trên màn hình không đồng nghĩa room đã sẵn sàng đặt cược; phải qua room/stream/chip/zone/history guards.
- DOM/canvas/lobby history chỉ giúp tìm card hoặc bootstrap; kết quả ván vẫn phải đi qua reconcile WS/HTTP theo rule hiện tại.

## 9. File/source chính

- `main.py`: `_effective_table_name`, `_enter_table_from_lobby`, `_attempt_table_entry`.
- `src/ae_sexy.py`: chuẩn hóa tên, tạo ứng viên, scroll/click card, ẩn overlay, xác nhận room.
- `src/browser.py`: resolve page/tab và lifecycle CDP.
- `src/game.py`: helper vào room Baccarat ở flow cũ.
- `config.yaml` / `config.example.yaml`: bàn mặc định.
- `tests/test_ae_sexy_lobby_selection.py`: kiểm thử thứ tự ứng viên/chọn lobby.

## 10. Manual selection và persistence hiện tại

- Khi lobby sẵn sàng, `HistoryWatcher` mở phase `WAITING_MANUAL` tối đa 30 giây.
- UI V2 nhận `table_selection` trong snapshot, hiển thị countdown và gửi
  command `select_table` về Python; JavaScript không tự click bàn.
- Hết thời gian, thứ tự fallback là `last_confirmed_table`, bàn cấu hình và
  candidate còn lại. `last_confirmed_table` chỉ được ghi sau `TABLE_READY`.
- Giá trị gần nhất được lưu additive tại `halls.last_confirmed_table`, scope
  theo provider/hall và tương thích database cũ qua migration.
- Command `change_table` chặn khi có physical click/pending unsafe, tắt run,
  đưa operator về lobby và suppress recovery kéo về bàn cũ trong lúc chọn.
