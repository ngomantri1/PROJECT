# ARCHITECTURE

## Cập nhật hôm nay (2026-07-25)
- Thêm money strategy `MultiChainAdvanced` cho option UI `8. Quản lý vốn đa tầng nâng cao`.
- `MultiChainAdvanced` dùng state đa tầng có sẵn trong `GameContext`: `MoneyChainIndex`, `MoneyChainStep`, `MoneyChainProfit`.
- Khác `MultiChain` thường: `MoneyChainProfit` của `MultiChainAdvanced` là net xuyên suốt toàn bộ cụm chuỗi, có thể âm/dương, và tầng hiện tại được map lại theo ngưỡng cộng dồn.
- Ngưỡng của từng dòng trong `MultiChainAdvanced` là tổng các phần tử của dòng, tính bằng `MoneyHelper.GetMultiChainAdvancedThreshold(...)`.
- Nếu net vượt dương (`>0`) hoặc âm quá tổng tất cả ngưỡng thì reset về dòng 1, mức 1, net `0`.
- `TaskUtil.ApplyPostRoundMoneyAsync(...)` tách nhánh `MultiChainAdvanced` để cập nhật money state trước rồi đồng bộ `TIỀN THẮNG` UI bằng `UiAddWinAndSetTotal`.
- `TaskUtil.PlaceBet(...)` và post-round money đều gọi `UiSetChainLevel(...)` cho nhóm đa tầng để `LblLevel` hiển thị đúng vị trí phẳng toàn chuỗi.
- `SeqParityFollowTask` và `SeqMajorMinorTask` hỗ trợ ký tự `0`; khi gặp `0`, task gọi `TaskUtil.WaitRoundFinishNoBet(...)` để bỏ qua đúng 1 ván theo `session` đổi.

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
- `TaiXiuLiveHitPlugin.cs`: adapter plugin.
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
- wait no-bet round (`WaitRoundFinishNoBet`) cho ký tự `0`
- place bet (`__cw_bet`)
- judge round
- post-round money
- `Tasks/MoneyHelper.cs`:
- `MoneyManager` helper cũ và logic `MultiChain`/`MultiChainAdvanced`
- `MultiChainAdvanced` map tầng bằng net và ngưỡng cộng dồn theo tổng từng dòng tiền
- `Tasks/SeqParityFollowTask.cs` / `Tasks/SeqMajorMinorTask.cs`:
- chuỗi cầu tự nhập T/X và I/N
- ký tự `0` nghĩa là bỏ qua ván, không đặt cược
- `Tasks/SmartPrevTask.cs`:
- chiến lược 5 (seg1/seg3 rule cũ)
- `Tasks/SmartPrevAdvancedTask.cs`:
- chiến lược 18 (seg1/seg3 rule mới)
- `v4_js_xoc_dia_live.js`:
- push `tick`
- bet queue
- `bet/bet_error/bet_perf`

## Data flow
1. JS scan scene -> emit `tick`.
2. C# parse tick -> cập nhật `_lastSnap` + UI.
3. Task đọc snapshot qua `GameContext.GetSnap()`.
4. Task quyết định side/stake -> `PlaceBet`.
5. JS xử lý queue cược và trả event.
6. C# finalize pending rows khi round chốt (`seq` đổi) theo `_pendingBaseSeq` hoặc theo winners của multi-side.
7. Nếu `TxtStakeCsv` đổi trong lúc run, `MainWindow` đẩy chuỗi mới vào `StrategyTabState` và `GameContext`; từ ván kế tiếp `MoneyManager` lấy stake từ chuỗi mới theo đúng level hiện tại.
8. Với chuỗi cầu T/X hoặc I/N, ký tự `0` bỏ qua 1 ván bằng cách chờ `session` đổi, không gọi `PlaceBet` và không cập nhật money.
9. Với `MultiChainAdvanced`, sau khi biết thắng/thua sẽ cập nhật net, map lại dòng tiền theo ngưỡng cộng dồn, rồi đồng bộ `LblWin`/`LblLevel`.

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
- Dùng `PointerEvent` lên canvas để click chip/side/confirm.
- Có fallback source cho progress/seq/totals/username.
