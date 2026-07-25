# BUGS

## Cập nhật hôm nay (2026-07-25)
- Đã fix nhóm lỗi Canvas Watch có thể hiện `--` cho Username/TK/Phiên/Tài/Xỉu khi game chạy tail `MiniGameScene/...` thay vì `LobbyNew/...`.
- Đã thêm fallback cho username, tài khoản, phiên, tổng Tài/Xỉu và tail đặt cược theo log `D:\NOTE\OneDrive\Desktop\log\devtool.log` ngày 2026-07-25.
- Đã thêm fallback đặt cược `MiniGameScene/.../nodeSkeleton/btnCuocTai`, `btnCuocXiu`, `menuMoney/btnFunctions/btnDatCuoc`, và các phỉnh `Btn20M`, `btn5M`, `btn1M`, `btn500K`, `btn100K`, `btn50k`, `btn10k`, `btn1K`.
- Fallback chỉ bổ sung nguồn đọc/click; không bật lại legacy `window.cwBet(...)`, nên không làm thay đổi rule click cửa 1 lần.

## Cập nhật hôm nay (2026-07-10)
- Đã fix bug Canvas Watch không hiển thị dù đã bỏ `root.style.display='none'`: nguyên nhân là bridge probe coi JS ready khi có hàm bridge, nhưng root `__cw_root_allin` chưa được inject/dựng.
- Đã fix bug game chỉ mở popup/trang rời: chuyển sang cơ chế click mở Tài Xỉu từ trang chủ HIT.
- Đã fix bug tên nhân vật trên bảng C# null trong khi Canvas Watch có username: nguyên nhân C# gate theo URL game cũ; đã cho phép cập nhật khi `_isGameUi` đúng.
- Đã fix bug tài khoản null: tail ưu tiên là `LobbyNew/Canvas/MainUIParent/NewLobby/Footder/footerBar/Normal/lbMoneyYser`, fallback `MiniGameScene/Canvas/FootterRoomUi/Left/buttonMoney/moneyLabel`.
- Đã fix bug phiên dùng tail cũ `TxGameLive`; tail ưu tiên là `LobbyNew/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbSesionId`, fallback `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbSesionId`.
- Đã fix bug tổng cược Tài/Xỉu không hiển thị: tail ưu tiên là `LobbyNew/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbTotal`, fallback `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbTotal`, phân biệt bằng tọa độ Tài `x=313`, Xỉu `x=799`.
- Đã loại bỏ bug/nhầm lẫn do dùng lại code Chẵn/Lẻ: `CwTotals` và Canvas Watch không còn các field/cửa `SD`, `TT`, `T3T`, `T3D`, `TD`.
- Đã tăng công cụ debug `Scan200Text` lên `Scan500Text` và cho scan money text để tìm tail mới khi UI HIT đổi.
- Đã fix lệch cơ chế bet so với ZoWin: HIT không còn fallback sang `window.cwBet(...)` khi `cwBetTxByChip` fail, vì fallback cũ có thể click cửa lại nhiều lần theo từng phỉnh.
- Đã cập nhật tail đặt cược theo scan log mới: cửa `nodeSkeleton/btnCuocTai`, `nodeSkeleton/btnCuocXiu`; xác nhận `menuMoney/btnFunctions/btnDatCuoc`; phỉnh `Btn20M/btn5M/btn1M/btn500K/btn100K/btn50k/btn10k/btn1K`.

## Cập nhật hôm nay (2026-06-02)
- Đã phát hiện và fix bug runtime money: sửa `TxtStakeCsv` khi đang `Dừng đặt cược` nhưng ván sau vẫn lấy stake từ chuỗi cũ.

## Cập nhật hôm nay (2026-05-27)
- Đã phát hiện và fix bug pending history không chốt `Result/WinLose` dù đã có kết quả ván.

## Cập nhật hôm nay (2026-05-13)
- Chưa phát hiện bug mới do việc thêm Task 18.
- Thay đổi hôm nay chỉ thêm chiến lược mới + mapping index/UI.

## Bug hiện tại
- `Tasks/TaskUtil.cs`: `PlaceBet(...)` đang set `ok=true` gần như luôn thành công ở tầng C#.
- `Tasks/TaskUtil.cs`: `WaitRoundFinishAndJudge(...)` phụ thuộc đổi `session`; có thể chờ lâu/vô hạn nếu session rỗng hoặc không đổi.
- `Tasks/TaskUtil.cs`: dùng `curSeq[^1]` khi session đổi nhưng chưa guard chuỗi rỗng.
- `MainWindow.xaml.cs`: validate chuỗi T/X và I/N đang cho tối đa `100` nhưng text rule hiển thị `2-50`.
- Lease heartbeat bị vô hiệu hóa (`if (false)`), nhưng flow start/stop heartbeat vẫn tồn tại.

## Bug đã fix (đã có trong code)
- `MainWindow.xaml.cs`: fix finalize pending theo `_pendingBaseSeq` khi `seq` đổi, không còn phụ thuộc riêng lock `NI`/`prog==0`.
- `MainWindow.xaml.cs` + `Tasks/GameContext.cs` + `Tasks/MoneyManager.cs`: fix đổi chuỗi tiền live khi task đang chạy; ván kế tiếp lấy đúng mức tương ứng của chuỗi mới.
- `MainWindow.xaml.cs`: bridge probe/reinject đã kiểm tra root `__cw_root_allin`, tránh trạng thái hàm bridge có nhưng Canvas Watch chưa hiển thị.
- `v4_js_xoc_dia_live.js`: đã cập nhật tail HIT cho username, tài khoản, phiên, tổng cược Tài/Xỉu.
- `v4_js_xoc_dia_live.js` + `Models.cs`: đã bỏ các field/cửa Chẵn/Lẻ khỏi totals Tài/Xỉu.
- Guard start strategy bằng `WaitForBridgeAndGameDataAsync(...)`.
- Bridge reinject theo lifecycle top doc + frame.
- Save config/stats dạng atomic (`.tmp` -> `File.Move`).
- Countdown license/trial dùng mốc local time (`DateTimeOffset.Now`).
- JS bet queue có `bet_perf` metrics; fallback sang engine cũ đã tắt để giữ đúng nghiệp vụ click cửa 1 lần.

## Bug chưa fix
- Chưa có nguồn truth thống nhất cho kết quả bet ở tầng C#.
- Chưa xử lý triệt để case round mới nhưng `session` không đổi.
- Chưa chuẩn hóa xong việc tách legacy/new flow trong `MainWindow`.

## Nguyên nhân bug
- `MainWindow.xaml.cs` đang gộp quá nhiều trách nhiệm.
- Bridge logic hiện phân tán ở nhiều nơi.
- State round phụ thuộc heuristic (`session`, `seq`, `prog`) hơn là state machine tách biệt.
- Tồn tại song song branch legacy/new làm tăng độ phức tạp.
- Money runtime trước đây snapshot chuỗi tiền lúc start và `MoneyManager` giữ `_seq` cố định, nên thay đổi UI không vào được vòng task đang chạy.
- HIT đổi node/tail theo UI mới; các tail cũ dạng `MiniGameScene/.../TxGameLive/...` hoặc `moneyLabel` có thể không còn đúng.
- HIT có thể chạy song song hai prefix scene `LobbyNew/...` và `MiniGameScene/...`; nếu chỉ hardcode một prefix thì Canvas Watch hoặc click cược dễ hiện `--`/không tìm thấy node.
- Tail đặt cược cũ trỏ `MiniGameScene/.../TxGameLive/...` và danh sách phỉnh cũ có `50M/10M`, trong khi log mới của HIT là `LobbyNew/.../TxGame2/...`, có `20M/5M` và không thấy `50M/10M`.
- Fallback `window.cwBet(...)` là legacy flow, không phù hợp yêu cầu hiện tại vì có thể click cửa lặp lại theo từng phỉnh.
- Một số code cũ dùng lại naming Chẵn/Lẻ (`C/L`, `Chan/Le`) trong khi nghiệp vụ HIT là Tài/Xỉu (`T/X`), dễ gây lệch model và UI.

## Workaround tạm thời
- Trước khi Play, kiểm tra có `tick` ổn định và log bridge ready.
- Nếu loop đứng lâu, Stop/Play lại để reset token/bridge probe.
- Theo dõi `bet_error`/`bet_perf` thay vì chỉ tin giá trị trả về `PlaceBet`.
- Giữ `DecisionSeconds` vùng an toàn (đặc biệt nhóm N/I).
- Không còn cần workaround Stop/Play lại chỉ để đổi chuỗi tiền; runtime đã hỗ trợ ăn chuỗi mới từ ván kế tiếp.
- Khi nghi tail sai, bấm `Scan500Text` và lưu DevTools log; chỉ đổi hardcoded tail sau khi thấy đúng text/tọa độ trong log.
- Khi nghi tail đặt cược sai, bấm `Scan500Bet` hoặc xem log DevTools để xác nhận lại 3 nhóm tail: phỉnh, `btnCuocTai/btnCuocXiu`, và `btnDatCuoc`.
- Nếu Username/TK/Phiên/Tài/Xỉu hiện `--`, kiểm tra log có prefix `LobbyNew` hay `MiniGameScene`; code hiện đã có fallback cho cả hai prefix chính.
- Nếu Canvas Watch không hiện, kiểm tra console probe `hasRoot/rootDisplay`; nếu `hasCc=true` nhưng `hasRoot=false` thì cần reinject JS.

## Vùng code dễ lỗi
- `MainWindow.xaml.cs`: `WebMessageReceived`, play/stop, bridge inject/probe, timers license/trial.
- `Tasks/TaskUtil.cs`: place/judge/post-round money.
- `v4_js_xoc_dia_live.js`: click canvas, queue cược, tail phỉnh/cửa/xác nhận, fallback username/TK/totals/session/progress.
- `v4_js_xoc_dia_live.js`: không bật lại fallback legacy `window.cwBet(...)` trong flow Tài/Xỉu nếu chưa đổi lại yêu cầu nghiệp vụ click cửa 1 lần.
- `v4_js_xoc_dia_live.js`: vùng tail HIT cho username/tài khoản/phiên/tổng T/X và root `__cw_root_allin`.
- `Models.cs`: `CwTotals` phải giữ đúng `T`, `X`, `A`; không thêm lại field Chẵn/Lẻ.
- Config/stats I/O khi save liên tiếp nhiều tab.
