# Bugs

## Bug Hiện Tại

- `Tasks/TaskUtil.cs`
  - `PlaceBet` luôn coi bet là `ok=true` sau khi enqueue xuống JS.
  - Hệ quả: UI/history/money flow có thể tin là đã cược dù JS click fail hoặc trả `bet_error`.
- `MainWindow.Startup.cs`, `MainWindow.xaml.cs`, `TaiXiuLiveSunPlugin.cs`
  - vẫn có chỗ dùng `Assembly.Location`.
  - Trong publish single-file, path này có thể rỗng; build đã cảnh báo `IL3000`.
- `Tasks/SeqMajorMinorTask.cs`, `Tasks/PatternMajorMinorTask.cs`, các bản `Tx`
  - nếu `snap.totals` chưa có, logic `N/I` fallback về `0/0` và thiên lệch kết quả.
- `MainWindow.xaml.cs`
  - `AutoFillLoginAsync` đang return sớm ngay đầu method.
  - Hệ quả: sync autofill thực tế đang bị vô hiệu hóa.
- Toàn project
  - build Release pass nhưng còn nhiều warning; đây là nguồn bug tiềm ẩn, chủ yếu quanh nullability và dead code.

## Bug Đã Fix Hoặc Đã Có Guard

- Duplicate bet history:
  - đã có `_betIssueHistoryKeys` để chặn ghi trùng theo `tabId|roundId|side|amount`.
- Countdown nháy ngược:
  - đã có `_pendingRiseSec` + `_pendingRiseHits` để xác nhận cú nhảy lên 2 tick liên tiếp.
- Inject JS mất trong iframe/document mới:
  - đã có reinjection logic ở `WebView2LiveBridge` và hook `FrameCreated`.
- Resource ảnh lỗi khi chạy plugin:
  - đã có `PackRes` + `FallbackIcons` để fallback pack/file resource.
- Ghi config/stats không an toàn:
  - đã có semaphore + temp file -> move.

## Bug Chưa Fix

- `PlaceBet` chưa phân biệt rõ:
  - enqueue thành công
  - JS trace thành công
  - click/bet thực sự thành công
- `MainWindow.xaml.cs` quá lớn:
  - bug mới rất dễ chồng state ngoài ý muốn.
- Một số branch unreachable/dead code vẫn còn trong startup, autofill, lease/trial.
- Nullability warnings còn dày ở `Models.cs`, `GameContext.cs`, `MoneyHelper.cs`, `PatternMajorMinor*.cs`, `SeqMajorMinor*.cs`.

## Nguyên Nhân Bug

- Runtime phụ thuộc mạnh vào state phân tán trong `MainWindow.xaml.cs`.
- Bridge dựa trên JS selectors/path Cocos rất dễ gãy khi game đổi scene/node path.
- Có nhiều async boundary:
  - WebView
  - JS queue
  - task strategy
  - UI dispatcher
  - timer/license/lease
- App có 2 mode deploy khác nhau nên path/runtime behavior không hoàn toàn giống nhau.

## Workaround Tạm Thời

- Khi điều tra lỗi bet:
  - bật log `bet_trace`
  - không dựa riêng vào `bet` ack
- Khi test Release single-file:
  - rà kỹ các đoạn còn dùng `Assembly.Location`
- Với chiến lược `N/I`:
  - chỉ test khi tick/totals đã ổn định
- Với login:
  - dựa vào flow Home/login watcher hiện tại, không kỳ vọng `AutoFillLoginAsync` sync path đang hoạt động
- Khi debug packet:
  - chỉ bật `TXLS_CDP_TAP=1` lúc cần, tránh tăng noise/I/O

## Vùng Code Dễ Lỗi

- [`MainWindow.xaml.cs`](D:/PROJECT/ABXHubSolution/TaiXiuLiveSun/MainWindow.xaml.cs)
  - orchestration quá lớn, nhiều state chéo nhau
- [`v4_js_xoc_dia_live.js`](D:/PROJECT/ABXHubSolution/TaiXiuLiveSun/v4_js_xoc_dia_live.js)
  - selectors/path Cocos, geometry bet target, push loop
- [`Tasks/TaskUtil.cs`](D:/PROJECT/ABXHubSolution/TaiXiuLiveSun/Tasks/TaskUtil.cs)
  - place bet, wait round, UI reset hidden coupling
- [`Tasks/MoneyHelper.cs`](D:/PROJECT/ABXHubSolution/TaiXiuLiveSun/Tasks/MoneyHelper.cs)
  - `MultiChain` state transitions
- [`Tasks/PatternMajorMinorTask.cs`](D:/PROJECT/ABXHubSolution/TaiXiuLiveSun/Tasks/PatternMajorMinorTask.cs), [`Tasks/SeqMajorMinorTask.cs`](D:/PROJECT/ABXHubSolution/TaiXiuLiveSun/Tasks/SeqMajorMinorTask.cs)
  - phụ thuộc `totals`
- License/trial/lease methods trong `MainWindow.xaml.cs`
  - phụ thuộc network + timer + local session state

## Build Note

- Kiểm tra ngày `2026-06-19`:
  - `dotnet build TaiXiuLiveSun.csproj -c Release` pass
  - `0 error`
  - `223 warnings`
