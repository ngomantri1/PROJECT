# ARCHITECTURE

## Cập nhật hôm nay (2026-07-25)
- `v4_js_xoc_dia_live.js` đã chuyển các nguồn đọc chính sang dạng candidates: ưu tiên `LobbyNew/...`, fallback `MiniGameScene/...` khi game chạy scene/tail legacy.
- Username fallback: `MiniGameScene/Canvas/FootterRoomUi/Left/buttonName/NameUser`.
- Tài khoản/TK fallback: `MiniGameScene/Canvas/FootterRoomUi/Left/buttonMoney/moneyLabel`.
- Phiên fallback: `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbSesionId`.
- Tổng Tài/Xỉu fallback: `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbTotal`, vẫn dùng tọa độ `x=313` cho Tài và `x=799` cho Xỉu.
- Tail bet fallback từ `devtool.log` ngày 2026-07-25: `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeSkeleton/btnCuocTai`, `btnCuocXiu`, `menuMoney/btnFunctions/btnDatCuoc`, và các phỉnh `Btn20M`, `btn5M`, `btn1M`, `btn500K`, `btn100K`, `btn50k`, `btn10k`, `btn1K`.

## Cập nhật hôm nay (2026-07-10)
- HIT Tài Xỉu hiện đọc dữ liệu bằng Cocos scene traversal + tail matching trong `v4_js_xoc_dia_live.js`.
- Canvas Watch được dựng trong DOM root `__cw_root_allin`; bridge probe trong `MainWindow.xaml.cs` phải coi root này là điều kiện ready khi `window.cc` đã sẵn sàng.
- `v4_js_xoc_dia_live.js` đang là nguồn đọc trực tiếp:
- username: `LobbyNew/Canvas/MainUIParent/NewLobby/Footder/footerBar/Normal/lbNameUser` -> fallback `MiniGameScene/Canvas/FootterRoomUi/Left/buttonName/NameUser`
- tài khoản: `LobbyNew/Canvas/MainUIParent/NewLobby/Footder/footerBar/Normal/lbMoneyYser` -> fallback `MiniGameScene/Canvas/FootterRoomUi/Left/buttonMoney/moneyLabel`
- phiên: `LobbyNew/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbSesionId` -> fallback `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbSesionId`
- tổng Tài/Xỉu: tail `LobbyNew/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbTotal` -> fallback `MiniGameScene/MiniGameNode/TopUI/TxGame2/Main/borderTabble/nodeFont/lbTotal`, Tài `x=313`, Xỉu `x=799`
- Tail đặt cược đang dùng trong `v4_js_xoc_dia_live.js`:
- cửa Tài: `LobbyNew/.../nodeSkeleton/btnCuocTai` -> fallback `MiniGameScene/.../nodeSkeleton/btnCuocTai`
- cửa Xỉu: `LobbyNew/.../nodeSkeleton/btnCuocXiu` -> fallback `MiniGameScene/.../nodeSkeleton/btnCuocXiu`
- nút xác nhận: `LobbyNew/.../menuMoney/btnFunctions/btnDatCuoc` -> fallback `MiniGameScene/.../menuMoney/btnFunctions/btnDatCuoc`
- phỉnh: `LobbyNew/.../menuMoney/btnPrices/Btn20M`, `btn5M`, `btn1M`, `btn500K`, `btn100K`, `btn50k`, `btn10k`, `btn1K` -> fallback cùng tên dưới `MiniGameScene/.../menuMoney/btnPrices/`
- Flow click cược đã theo ZoWin: click cửa 1 lần -> click phỉnh theo plan -> click xác nhận 1 lần; không fallback sang `window.cwBet(...)`.
- `CwTotals` trong `Models.cs` chỉ có `T`, `X`, `A`. Các field Chẵn/Lẻ cũ (`SD`, `TT`, `T3T`, `T3D`, `TD`) đã bị loại bỏ khỏi model và JS totals.
- `Scan500Text` dùng để debug khi game đổi node/tail; kết quả log phải là căn cứ trước khi đổi tail production.

## Cập nhật hôm nay (2026-06-02)
- Đã chỉnh luồng money runtime để chuỗi tiền có thể đổi live khi task đang chạy.
- `StrategyTabState` vẫn giữ state chạy hiện tại, nhưng `RunStakeSeq`/`RunStakeChains`/`RunStakeChainTotals` giờ có thể được refresh trong lúc run.
- `GameContext` không còn chỉ là snapshot bất biến cho chuỗi tiền; phần `StakeSeq`/`StakeChains`/`StakeChainTotals` có thể được cập nhật từ `MainWindow`.
- `MoneyManager` không giữ cố định `_seq` từ lúc khởi tạo nữa; thay vào đó đọc chuỗi tiền hiện hành theo provider ở mỗi lần tính stake.
- Mục tiêu: giữ nguyên level/state quản lý vốn, chỉ thay nguồn dữ liệu chuỗi tiền cho các ván kế tiếp.

## Cập nhật hôm nay (2026-05-27)
- Đã chỉnh cơ chế finalize bet history pending trong `MainWindow.xaml.cs`.
- Thêm state `_pendingBaseSeq` để neo round của lô pending.
- Thêm nhánh finalize theo `seq` đổi độc lập với lock `NI`.
- Mục tiêu: đồng bộ UI/history state ổn định khi có kết quả ván.

## Cập nhật hôm nay (2026-05-13)
- Thêm `Tasks/SmartPrevAdvancedTask.cs` cho chiến lược 18.
- `CmbBetStrategy` đã có item `18) Bám cầu trước nâng cao`.
- Mapping task trong `MainWindow.xaml.cs` đã hỗ trợ index `17`.
- Guard load config strategy index đổi từ `<=16` sang `<=17`.

## Cấu trúc project
- `MainWindow.xaml` / `MainWindow.xaml.cs`: UI + orchestration runtime.
- `MainWindow.Startup.cs`: startup pipeline standalone/plugin.
- `MainWindow.EmbedMode.cs`: embed mode cho Hub.
- `WebView2LiveBridge.cs`: bridge inject/reinject cho top doc/frame.
- `v4_js_xoc_dia_live.js`: đọc dữ liệu game + đặt cược.
- `Tasks/`: chiến lược + utility bet/money.
- `TaiXiuThuongHitPlugin.cs`: adapter plugin.
- `Models.cs`: snapshot/totals/decision model.

## Module chính
- UI/Orchestrator: `MainWindow*`.
- Bridge: `WebView2LiveBridge` + JS bridge.
- Strategy Engine: `Tasks/*.cs` (`18` strategy).
- Money Engine: `MoneyManager`, `MoneyHelper`.
- Persistence: config/stats/bet logs/AI state.
- License/Trial/Lease: trong `MainWindow.xaml.cs`.

## Dependency giữa module
- `MainWindow` -> `Tasks` (build context, start/stop).
- `Tasks` -> `TaskUtil` -> `EvalJsAsync` -> JS.
- `MainWindow` -> WebView2 -> JS bridge -> `postMessage` -> `MainWindow`.
- `MainWindow` -> money engine cho stake/result update.
- `MainWindow` -> filesystem cho config/stats/log/state.
- `MainWindow` -> runtime tab state / `GameContext` cho refresh chuỗi tiền live khi đang chạy.

## File trách nhiệm chính
- `MainWindow.xaml.cs`:
- lifecycle web/app
- `WebMessageReceived`
- tab runtime
- play/stop/finalize
- cập nhật `TxtStakeCsv` vào runtime đang chạy
- `Tasks/TaskUtil.cs`:
- wait bet window
- place bet (`__cw_bet`)
- judge round
- post-round money
- `Tasks/SmartPrevTask.cs`:
- chiến lược 5 (seg1/seg3 rule cũ)
- `Tasks/SmartPrevAdvancedTask.cs`:
- chiến lược 18 (seg1/seg3 rule mới)
- `v4_js_xoc_dia_live.js`:
- push `tick`
- bet queue
- `cwBetTxByChip`: lập plan phỉnh, click cửa 1 lần, click phỉnh theo plan, click `btnDatCuoc` xác nhận 1 lần
- `bet/bet_error/bet_perf`
- đọc username/tài khoản/phiên/tổng cược T/X bằng tail HIT chính xác
- dựng Canvas Watch và các nút debug `Scan500Money`, `Scan500Bet`, `Scan500Text`
- `Models.cs`:
- `CwTotals` chỉ biểu diễn `T`, `X`, `A`

## Data flow
1. JS scan scene bằng tail HIT -> emit `tick`.
2. C# parse tick -> cập nhật `_lastSnap` + UI.
3. Task đọc snapshot qua `GameContext.GetSnap()`.
4. Task quyết định side/stake -> `PlaceBet`.
5. JS xử lý queue cược bằng `cwBetTxByChip`: tìm tail cửa/phỉnh/xác nhận -> click cửa 1 lần -> click phỉnh theo plan -> click xác nhận 1 lần -> trả event.
6. C# finalize pending rows khi round chốt (`seq` đổi) theo `_pendingBaseSeq` hoặc theo winners của multi-side.
7. Nếu `TxtStakeCsv` đổi trong lúc run, `MainWindow` đẩy chuỗi mới vào `StrategyTabState` và `GameContext`; từ ván kế tiếp `MoneyManager` lấy stake từ chuỗi mới theo đúng level hiện tại.

## Websocket packet flow
- CDP `Network.enable` bật receiver cho:
- `webSocketCreated`
- `webSocketFrameReceived`
- `webSocketFrameSent`
- Packet flow hiện là observer; nghiệp vụ vẫn dùng bridge tick.

## UI update flow
- Source-of-truth runtime: `_lastSnap` + `StrategyTabState`.
- Tick update: progress, status, account, seq/result.
- Task callback update: side/stake/win-loss/level/win total/stats.
- Tất cả update UI qua `Dispatcher`.
- `LblLevel`/`LblStake` phải bám `RunStakeSeq` hiện hành, không được giữ mảng snapshot cũ sau khi người dùng sửa chuỗi tiền.

## OCR/canvas flow
- Không dùng OCR lib.
- Dùng Cocos scene traversal + tail matching trong JS.
- Dùng `PointerEvent` lên canvas để click side/chip/confirm; với HIT Tài/Xỉu hiện tại, side chỉ được click 1 lần trước khi click phỉnh.
- Có fallback source cho progress/seq và các tail dữ liệu chính; username/tài khoản/phiên/tổng T/X vẫn ưu tiên tail HIT `LobbyNew` đã xác nhận bằng log trước khi dùng fallback `MiniGameScene`.
- Canvas Watch hiển thị username, tài khoản, phiên, Tài, Xỉu; không hiển thị các cửa Chẵn/Lẻ.
- Khi cần tìm tail mới, dùng `Scan500Text` vì tool này scan cả money text và tăng giới hạn từ 200 lên 500.
