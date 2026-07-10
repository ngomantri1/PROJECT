# TODO

## Cập nhật hôm nay (2026-07-10)
- Đã hoàn thành: hiển thị Canvas Watch bằng `SHOW_CANVAS_WATCH=true`.
- Đã hoàn thành: sửa bridge readiness để reinject khi có `window.cc` nhưng chưa có root `__cw_root_allin`.
- Đã hoàn thành: mở Tài Xỉu từ trang chủ HIT bằng click/home flow, không phụ thuộc popup rời.
- Đã hoàn thành: đổi username/tên nhân vật sang tail duy nhất `LobbyNew/Canvas/MainUIParent/NewLobby/Footder/footerBar/Normal/lbNameUser`.
- Đã hoàn thành: đổi tài khoản sang tail `LobbyNew/Canvas/MainUIParent/NewLobby/Footder/footerBar/Normal/lbMoneyYser`.
- Đã hoàn thành: đổi phiên sang tail `LobbyNew/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbSesionId`.
- Đã hoàn thành: đổi tổng cược Tài/Xỉu sang tail `LobbyNew/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbTotal`, phân biệt Tài `x=313`, Xỉu `x=799`.
- Đã hoàn thành: đổi `Scan200Text` thành `Scan500Text` và cho phép scan text dạng tiền.
- Đã hoàn thành: bỏ code/model các cửa Chẵn/Lẻ (`SD`, `TT`, `T3T`, `T3D`, `TD`) khỏi project HIT Tài Xỉu.

## Cập nhật hôm nay (2026-06-02)
- Đã hoàn thành: fix đổi `TxtStakeCsv` khi task đang chạy để ván kế tiếp ăn chuỗi tiền mới.
- Đã hoàn thành: giữ nguyên level hiện tại nhưng map sang giá trị của chuỗi mới cho non-`MultiChain`.
- Đã hoàn thành: refresh `StakeChains`/`StakeChainTotals` live cho `MultiChain` mà không cần restart task.

## Cập nhật hôm nay (2026-05-27)
- Đã hoàn thành: fix pending history không cập nhật `Result/WinLose` sau khi có kết quả.
- Đã hoàn thành: tách trigger finalize pending khỏi lock `NI` bằng `_pendingBaseSeq`.

## Cập nhật hôm nay (2026-05-13)
- Đã hoàn thành: thêm `Task 18) Bám cầu trước nâng cao` từ Task 5.
- Đã hoàn thành: nối UI + mapping runtime cho index `17`.
- Đã hoàn thành: cập nhật context docs.

## Task đang làm
- Ổn định bridge WebView2/frame reinject + probe readiness.
- Duy trì `18` strategy chạy theo tab độc lập.
- Đồng bộ config/stats theo tab + global credentials.
- Theo dõi tail HIT sau mỗi lần game đổi UI bằng `Scan500Text` trước khi sửa hardcoded tail.

## Task chưa hoàn thành
- Tách nhỏ `MainWindow.xaml.cs` (đang quá lớn).
- Hợp nhất 2 nhánh bridge (`WebView2LiveBridge` và bridge nội tại `MainWindow`) để giảm drift.
- Chuẩn hóa encoding comment/log tiếng Việt cũ.

## Task cần refactor
- Tách service theo domain: Web, StrategyRunner, License, BetHistory, Tabs.
- `TaskUtil.PlaceBet`: xác nhận success theo kết quả JS thực tế, không hardcode.
- Tách/loại bớt flow legacy (`*_Legacy`) nếu không còn dùng.
- Tách phần tail config HIT khỏi `v4_js_xoc_dia_live.js` thành một vùng cấu hình rõ ràng hơn nếu tail tiếp tục thay đổi thường xuyên.

## Task ưu tiên cao
- Sửa logic success/fail trong `TaskUtil.PlaceBet`.
- Sửa `ValidateSeqCL/ValidateSeqNI` cho khớp rule hiển thị (2-50).
- Gia cố `WaitRoundFinishAndJudge` để tránh loop vô hạn khi session rỗng/không đổi.
- Quyết định lại heartbeat lease (đang tắt bằng `if(false)`).

## Task cần test lại
- Test đổi chuỗi tiền khi đang chạy:
- đang ở mức 1 của chuỗi cũ -> sửa chuỗi mới -> ván sau lên mức 2 phải lấy mức 2 của chuỗi mới.
- Test cả non-`MultiChain` và `MultiChain` khi sửa `TxtStakeCsv` giữa phiên.
- Test lại luồng pending: tạo bet -> chờ `seq` đổi -> kiểm tra `Result/WinLose/Account` được chốt đúng cho mọi dòng pending.
- Regression Task 5 vs Task 18 trên cùng dữ liệu đầu vào.
- Play/Stop liên tục khi nhiều tab chạy song song.
- Reinject bridge khi iframe/navigation thay đổi nhanh.
- Canvas Watch sau restart app: phải hiện khi `SHOW_CANVAS_WATCH=true`, ẩn khi `false`.
- Canvas Watch chỉ hiển thị `TK`, `TÀI`, `XỈU`, không còn `SẤP ĐÔI`, `TỨ TRẮNG`, `TỨ ĐỎ`, `3 TRẮNG`, `3 ĐỎ`.
- Bảng C# phải nhận đúng tên nhân vật, tài khoản, phiên, tổng cược Tài/Xỉu từ tick bridge.
- Bấm `Scan500Text` phải thấy được text dạng tiền/tổng cược và tail tương ứng trong DevTools log.
- Task 17 (multi-side): finalize winners + account delta + pending rows.
- Trial/license expiry theo local timezone và release lease khi đóng app.
- Lock mouse trên VPS/RDP khi toggle nhiều lần.
