# TODO

## Cập nhật hôm nay (2026-07-25)
- Đã hoàn thành: thêm fallback username `MiniGameScene/Canvas/FootterRoomUi/Left/buttonName/NameUser`.
- Đã hoàn thành: thêm fallback tài khoản/TK `MiniGameScene/Canvas/FootterRoomUi/Left/buttonMoney/moneyLabel`.
- Đã hoàn thành: thêm fallback phiên `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbSesionId`.
- Đã hoàn thành: thêm fallback tổng cược Tài/Xỉu `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbTotal`, giữ tọa độ Tài `x=313`, Xỉu `x=799`.
- Đã hoàn thành: rà `D:\NOTE\OneDrive\Desktop\log\devtool.log` và thêm fallback tail `MiniGameScene/...` cho cửa Tài/Xỉu, phỉnh, nút `btnDatCuoc`.
- Đã hoàn thành: đổi cấu hình bet tail sang candidates/tailEnds, ưu tiên `LobbyNew` trước rồi fallback `MiniGameScene`.

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
- Đã hoàn thành: chỉnh cơ chế bet giống `TaiXiuThuongZoWin`: cửa chỉ click 1 lần, sau đó click phỉnh theo plan, cuối cùng click xác nhận đặt cược 1 lần.
- Đã hoàn thành: cập nhật tail đặt cược từ log `D:\NOTE\OneDrive\Desktop\log\devtool.log`: phỉnh `Btn20M/btn5M/btn1M/btn500K/btn100K/btn50k/btn10k/btn1K`, cửa `nodeSkeleton/btnCuocTai`, `nodeSkeleton/btnCuocXiu`, nút xác nhận `menuMoney/btnFunctions/btnDatCuoc`.
- Đã hoàn thành: bỏ fallback sang engine cũ `window.cwBet(...)` trong queue cược Tài/Xỉu để tránh click lại cửa nhiều lần.

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
- Test đặt cược thực tế sau khi đổi tail: cửa Tài/Xỉu chỉ click 1 lần, phỉnh cuối cùng được click đủ theo plan, sau đó `btnDatCuoc` xác nhận 1 lần.
- Test các mệnh giá có trong log mới: `20M`, `5M`, `1M`, `500K`, `100K`, `50K`, `10K`, `1K`; lưu ý hiện không có `50M` và `10M` trong scan mới.
- Test `bet_error`/`bet_perf` khi tail phỉnh/cửa/xác nhận bị lệch để chắc queue báo lỗi thay vì fallback sang engine cũ.
- Test Canvas Watch khi game đang dùng scene `MiniGameScene`: Username, TK, Phiên, Tài, Xỉu phải không còn hiện `--` nếu fallback tail tồn tại.
- Test đặt cược khi game đang dùng scene `MiniGameScene`: cửa/phỉnh/nút xác nhận phải click được bằng fallback tail và vẫn giữ cửa chỉ click 1 lần.
- Test thứ tự ưu tiên candidates: khi cả `LobbyNew` và `MiniGameScene` cùng tồn tại, code phải lấy `LobbyNew` trước.
- Task 17 (multi-side): finalize winners + account delta + pending rows.
- Trial/license expiry theo local timezone và release lease khi đóng app.
- Lock mouse trên VPS/RDP khi toggle nhiều lần.
