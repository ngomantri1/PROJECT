# ARCHITECTURE

> Kiến trúc thực tế sau các chỉnh sửa gần đây. Tập trung vào module và flow AI cần hiểu đúng.

## Cấu trúc project

- `App.xaml`, `App.xaml.cs`: bootstrap app
- `MainWindow.xaml`, `MainWindow.xaml.cs`: UI + orchestration chính
- `MainWindow.Startup.cs`: startup/public entry
- `MainWindow.EmbedMode.cs`: mode chạy trong Hub
- `BaccaratZoWinPlugin.cs`: adapter plugin
- `Models.cs`: snapshot/runtime/settle models
- `Tasks\*.cs`: strategy + money logic
- `Tasks\TaskUtil.cs`: place bet / wait settle / cooldown
- `WebView2LiveBridge.cs`: helper bridge legacy/tham khảo, không phải flow chính
- `v4_js_xoc_dia_live.js`: runtime JS chính trong game
- `DevTools\cw_probe_seq_roi.js`: script probe/manual cho road sequence

## Module chính

### 1. UI shell

- `MainWindow.xaml`
- Login/nav, strategy tabs, money settings, status, history, stats, panel sequence

### 2. Orchestration

- `MainWindow.xaml.cs`
- Chịu trách nhiệm:
  - config/stats/log
  - WebView2 main/popup
  - bridge injection
  - CDP/network tap
  - start/stop strategy
  - seq authority
  - pending rows

### 3. Web bridge

- C# inject top doc / frame / popup
- JS push `tick`
- C# parse `tick`, `game_hint`, `bet`, `result`, diagnostics

### 4. Strategy engine

- `Tasks\IBetTask.cs`
- `Tasks\*.cs`
- Strategy chỉ đọc `GameContext`, không chạm thẳng UI

### 5. Money engine

- `Tasks\MoneyManager.cs`
- `Tasks\MoneyHelper.cs`

## Dependency giữa các module

- `MainWindow` -> `Tasks\*` qua `GameContext`
- `MainWindow` -> `v4_js_xoc_dia_live.js` qua WebView2 injection
- `JS tick` + `CDP/network` -> authority sync trong `MainWindow`
- `Plugin` -> `MainWindow`

## File nào phụ trách gì

- `MainWindow.xaml.cs`
  - runtime entry
  - same-page launch flow
  - popup fallback
  - bridge/frame injection
  - `PULL_POPUP_TICK_NOW`
  - sequence sync / authority
  - pending settle
- `v4_js_xoc_dia_live.js`
  - detect game context
  - scan canvas/DOM/text
  - render Canvas Watch
  - build snapshot / totals / username / sequence
  - queue bet phía JS
- `DevTools\cw_probe_seq_roi.js`
  - pick ROI
  - run probe nhiều frame
  - đọc road sequence để đối chiếu với runtime app

## Data flow

1. Top document và frame được inject script.
2. JS xác định context game thật.
3. JS quét canvas/DOM/text rồi push `tick`.
4. C# parse `tick` và merge với authority từ network.
5. `GameContext.GetSnap()` trả snapshot authoritative cho strategy.
6. Strategy tính quyết định.
7. `TaskUtil.PlaceBet()` gọi JS bet queue.
8. Pending row được giữ tới khi settle đủ điều kiện.

## WebSocket packet flow

1. Enable CDP/network tap trên main/popup khi cần
2. Quan sát WebSocket / HTTP response
3. Parse:
  - table/shoe/round
  - winner / observed packets
4. Update `_netObserved*`, `_netSeq*`
5. Dùng làm authority bổ sung cho settle/history

## UI update flow

1. Tick mới vào host
2. Host lọc noisy/duplicate
3. Snapshot authoritative được cập nhật
4. `Dispatcher` apply UI:
  - progress/status
  - sequence
  - tên nhân vật
  - account/balance
  - history/stats

## OCR / canvas flow

- Không dùng OCR engine riêng
- Dùng JS scan `Cocos/canvas/DOM/text`
- `Canvas Watch` là panel debug gần nguồn thật nhất cho:
  - road sequence
  - tên nhân vật
  - số dư đọc cùng snapshot

## Road sequence flow hiện tại

1. `DevTools\cw_probe_seq_roi.js`
   - script probe/manual
   - dùng để xác nhận ROI và sequence đúng trong DevTools
2. `window.__cw_probeRoadSeqFrames(count)`
   - API runtime trong `v4_js_xoc_dia_live.js`
   - `rawSeq` từ API này là source-of-truth khi debug
3. `readDomBeadSeq()`
   - hợp nhất sequence từ canvas/DOM
4. `buildSnapshotNow()`
   - có thể promote `rawSeq` lên `seq`
   - có nhánh `buildSnapshotNow-use-raw-primary`
5. `SyncNetworkSeqFromSnapshot()`
   - merge `snap.seq`, `snap.rawSeq`, board count và `_netSeqDisplay`
   - hiện có thêm nhánh `stale-authority-resync`
6. `QueueTickUiUpdate()` -> `UpdateSeqUI()`
   - layer hiển thị cuối cùng

## UI sequence architecture mới

- `MainWindow.xaml`
  - ô `CHUỖI KẾT QUẢ` render từ `ItemsControl SeqIcons`
  - đã đổi sang `WrapPanel`
  - không còn `ScrollViewer` auto-scroll right
- `MainWindow.xaml.cs`
  - `ShouldUseRawSeqForUi(...)`: quyết định có dùng `rawSeq` cho UI
  - `SyncNetworkSeqFromSnapshot(...)`: quyết định authority thật sự
  - `UpdateSeqUI(...)`: chỉ render chuỗi nhận được

## Log / debug flow cần nhớ

- Nếu `__cw_probeRoadSeqFrames(8).rawSeq` đúng mà panel sai:
  - debug authority C#, không quay lại debug ROI trước
- Log quan trọng:
  - `[NETSEQ][RAW-AUTHORITY]`
  - `[NETSEQ][COUNT-ONLY-HOLD]`
  - `[SEQ][UI][QUEUE]`
  - `[SEQ][UI][APPLY]`

## Điểm kiến trúc quan trọng

- `MainWindow.xaml.cs` vẫn là monolith điều phối
- `WebView2LiveBridge.cs` không phải nguồn sự thật chính
- Same-page flow trên ZoWin là flow ưu tiên
- `main-pull` không được phép làm mất dữ liệu mà canvas cùng thời điểm đang có
