# Project Context

## Snapshot

- Project: `TaiXiuLiveSun`
- Loại app: WPF desktop app trên `.NET 8`, chạy 2 mode:
  - `Debug`: plugin cho ABX Hub qua `IGamePlugin`
  - `Release`: app standalone single-file
- Mục tiêu chính: mở game live trong `WebView2`, inject JS vào game canvas/Cocos scene, đọc trạng thái ván, chạy chiến lược tự động và ghi lịch sử cược.
- Trạng thái build đã kiểm tra:
  - `dotnet build TaiXiuLiveSun.csproj -c Release` pass
  - `0 error`, nhiều warning nullability/dead code/deployment

## Công Nghệ

- `net8.0-windows`, `WPF`
- `Microsoft.Web.WebView2`
- `ABX.Core` cho plugin host
- JS injected vào trang game: [`v4_js_xoc_dia_live.js`](D:/PROJECT/ABXHubSolution/TaiXiuLiveSun/v4_js_xoc_dia_live.js)
- JSON config/stats bằng `System.Text.Json`
- DPAPI cho lưu credential
- CDP network tap tùy chọn để nghe `Network.webSocket*`

## Flow Hoạt Động Chính

1. `MainWindow` load config/stats từ `%LOCALAPPDATA%\\TaiXiuLiveSun`.
2. `WebView2` được khởi tạo với fixed runtime hoặc fallback Evergreen.
3. JS bridge được inject vào top document + iframe.
4. JS dò đúng scene game, boot `__cw_startPush`, rồi bắn `tick` định kỳ về C#.
5. `MainWindow` nhận snapshot, cập nhật UI, giữ `_lastSnap`.
6. Khi người dùng bấm chạy:
   - validate input chiến lược
   - đảm bảo `__cw_bet` và tick đã sẵn
   - dựng `GameContext`
   - start `IBetTask` tương ứng
7. Task đọc snapshot, quyết định cửa/tiền, gọi `TaskUtil.PlaceBet`.
8. Bet được enqueue xuống JS queue; C# ghi pending history ngay lúc enqueue.
9. Khi `seq` đổi ở tick sau, C# finalize `_pendingRows`, cập nhật thắng/thua và ghi CSV.

## Coding Rules

- Không coi `MainWindow.xaml.cs` là nơi tùy tiện nhét logic mới nếu có thể tách helper/service.
- Mọi update UI phải đi qua `Dispatcher` hoặc callback UI trong `GameContext`.
- Mọi thay đổi config/stats phải đi qua `SaveConfigAsync` / `SaveStatsAsync`; không ghi file song song.
- Không finalize lịch sử cược từ JS ack; nguồn sự thật là pending rows phía C#.
- Không đổi message contract `abx:*` giữa JS và C# nếu chưa sửa cả hai đầu.
- Không phá cơ chế multi-tab: mỗi tab có state runtime riêng.
- Không thêm blocking I/O trực tiếp vào UI thread; code hiện tại dùng log queue + background pump.

## Naming Rules

- `*Task` = chiến lược cược, implement `IBetTask`
- `*TxTask` = biến thể `TAI/XIU`
- không có `Tx` = biến thể `CHAN/LE`
- `Seq*` = chạy theo chuỗi nhập
- `Pattern*` = chạy theo pattern nhập
- `Ai*` = chiến lược AI/thống kê/học online
- `*MajorMinor*` = chiến lược dùng chuỗi `N/I`
- `AppConfig` = config từng tab
- `StrategyTabState` = state runtime/UI của tab
- `CwSnapshot` = snapshot từ JS push

## Rule Quan Trọng

- `BetStrategyIndex` đang map trực tiếp sang task trong `PlayXocDia_Click`; đổi index là thay đổi contract config.
- `StakeCsv` hỗ trợ nhiều dòng; mỗi dòng là một chain cho `MultiChain`.
- Một số task vào tiền đầu ván (`WaitUntilNewRoundStart`), một số task vào tiền muộn (`WaitUntilBetWindow`); không đồng nhất hóa bừa.
- `JackpotMultiSideTask` là ngoại lệ multi-side; finalize dùng `UiFinalizeMultiBet`.
- Tất cả dữ liệu runtime quan trọng đi qua `_lastSnap`, không đọc UI làm source logic.

## Websocket Flow

- Flow chính không tiêu thụ trực tiếp websocket payload của game.
- Flow runtime thực tế:
  - JS/Cocos scan -> `chrome.webview.postMessage` -> C#
  - message chính: `tick`, `cw_page_probe`, `game_hint`, `bet`, `bet_error`, `bet_trace`
- CDP websocket tap chỉ là debug tool:
  - bật bởi env `TXLS_CDP_TAP=1`
  - nghe `Network.webSocketCreated`, `Network.webSocketFrameReceived`, `Network.webSocketFrameSent`
  - hiện không phải nguồn quyết định cược chính

## Pending Flow

- C# ghi 1 `BetRow` vào `_betAll` và `_pendingRows` ngay sau khi enqueue bet.
- Dedupe theo key `tabId|roundId|side|amount`.
- Khi tick mới làm `seq` đổi:
  - C# suy ra winners từ ký tự cuối của `seq`
  - finalize tất cả `_pendingRows`
  - append `bets-yyyyMMdd.csv`
  - clear `_pendingRows`
- Không được tạo history lần hai từ JS ack, nếu không sẽ duplicate.

## Threading / UI Rules

- `WebMessageReceived` có thể phát sinh liên tục; luôn marshal update UI bằng `Dispatcher`.
- Mỗi tab có `CancellationTokenSource`, `RunningTask`, `ActiveTask` riêng.
- Background work đang dùng `Task.Run`, `DispatcherTimer`, `System.Threading.Timer`.
- `GameContext` chỉ nên mang callback/UI bridge mỏng; không thêm WPF control trực tiếp vào task.
- `TaskUtil` có hidden dependency tới `MainWindow.ResetBetMiniPanel_External`; đổi tên method này sẽ làm reset UI âm thầm hỏng.

## Tuyệt Đối Không Được Phá

- Contract JS/C# quanh `__cw_startPush`, `__cw_bet_enqueue`, `abx` messages
- Quy tắc finalize pending theo `seq` change
- Mapping strategy index <-> UI <-> config
- Cơ chế plugin mode Debug và standalone mode Release
- Dữ liệu người dùng trong `%LOCALAPPDATA%\\TaiXiuLiveSun`
- Guard chống duplicate history, countdown flicker, frame reinjection
- Flow license/trial/lease nếu app đang triển khai thật

