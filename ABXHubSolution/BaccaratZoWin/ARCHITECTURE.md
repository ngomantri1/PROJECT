# ARCHITECTURE

> Kiến trúc thực tế của project sau các thay đổi gần nhất. Tài liệu này phản ánh flow Baccarat ZoWin hiện tại, không mô tả theo nhánh cũ đã bỏ.

## Cấu trúc project

- `App.xaml`, `App.xaml.cs`
  - bootstrap app
- `MainWindow.xaml`
  - UI chính
- `MainWindow.xaml.cs`
  - orchestration trung tâm
- `MainWindow.Startup.cs`
  - startup helpers
- `MainWindow.EmbedMode.cs`
  - chạy kiểu embed/plugin
- `BaccaratZoWinPlugin.cs`
  - adapter plugin
- `Models.cs`
  - model snapshot/history/result
- `Tasks\*.cs`
  - strategy và money logic
- `Tasks\TaskUtil.cs`
  - place bet / cooldown / settle helpers
- `WebView2LiveBridge.cs`
  - helper/legacy bridge, không phải runtime authority chính
- `v4_js_xoc_dia_live.js`
  - JS runtime chính
- `DevTools\cw_probe_seq_roi.js`
  - script probe/debug ROI/sequence

## Module chính

### 1. UI shell

- `MainWindow.xaml`
- Chịu trách nhiệm:
  - login/nav
  - cấu hình chiến lược
  - chuỗi tiền
  - countdown/status
  - history/stats
  - panel debug

### 2. Main orchestration

- `MainWindow.xaml.cs`
- Chịu trách nhiệm:
  - config/stats/log
  - WebView2 main/popup
  - inject bridge
  - chọn frame game
  - nhận tick
  - đồng bộ countdown
  - pending/history settle
  - start/stop strategy

### 3. JS runtime

- `v4_js_xoc_dia_live.js`
- Chịu trách nhiệm:
  - xác định context game
  - quét canvas/DOM/text
  - đọc username, balance, rawSeq, countdown
  - dựng snapshot
  - click chip / click vùng bet
  - panel `Canvas Watch`

### 4. Strategy engine

- `Tasks\IBetTask.cs`
- `Tasks\*.cs`
- Chỉ đọc state qua `GameContext`, không thao tác thẳng WebView/UI.

### 5. Betting bridge

- C# gọi JS thông qua:
  - `ExecuteOnBetWebAsync(...)`
  - `TaskUtil.PlaceBet(...)`
- Luồng này hiện ưu tiên exact live frame trước top shell.

## Dependency giữa các module

- `MainWindow` -> `Tasks\*` qua `GameContext`
- `MainWindow` -> `v4_js_xoc_dia_live.js` qua injection
- `MainWindow` -> `Models.cs` cho snapshot/history/pending
- `Plugin` -> `MainWindow`
- `DevTools\cw_probe_seq_roi.js` độc lập, dùng để debug/probe thủ công

## File nào phụ trách gì

### `MainWindow.xaml.cs`

- khởi tạo config/log/stats
- WebView2 lifecycle
- bridge registration
- frame arm/re-arm/drop
- exact live frame scoring
- tick dispatch
- countdown/UI update
- start/stop strategy
- pending/history settle
- save/load config

### `v4_js_xoc_dia_live.js`

- `__cw_readSnapshot()`
- `__cw_probeRoadSeqFrames(...)`
- `__cw_showRoadSeqDebug(8)`
- `__cw_clearRoadSeqDebug()`
- đọc progress/status/totals/rawSeq
- xác định tail DOM/canvas
- click cửa cược
- panel debug

### `Tasks\TaskUtil.cs`

- place bet entry chuẩn
- wait/cooldown helpers
- không nên bypass

### `DevTools\cw_probe_seq_roi.js`

- probe nhiều frame
- tìm ROI road sequence
- so sánh `rawSeq` trực tiếp trong DevTools

## Data flow

1. `MainWindow` inject bridge vào top document.
2. Khi frame game xuất hiện, host arm frame và inject JS vào frame đó.
3. JS trong frame game sinh snapshot `tick`.
4. C# nhận `tick`, parse và normalize.
5. Snapshot hiện tại được dùng để:
  - cập nhật countdown/UI
  - feed vào strategy
  - settle pending/history
6. Khi strategy quyết định cược:
  - `TaskUtil.PlaceBet()` gọi JS click chip/cửa
7. Sau khi cược:
  - app ghi pending row
8. Khi round đổi hoặc có settle hợp lệ:
  - history/stats/UI được cập nhật

## WebSocket packet flow

### Trạng thái cũ

- Từng có nhánh CDP nghe:
  - `Network.webSocketCreated`
  - `Network.webSocketFrameReceived`
  - `Network.webSocketFrameSent`
- Mục tiêu:
  - parse `observed context`
  - parse `GP_WINNER`

### Trạng thái hiện tại

- Luồng này đã bị tắt ở runtime profile hiện tại.
- Lý do:
  - ZoWin bắn websocket dày
  - code không parse ra packet hữu ích cho host hiện tại
  - gây lag/freeze

### Kết luận

- Không coi websocket/CDP là dependency active của flow Baccarat hiện tại.
- Nếu muốn bật lại, phải có bằng chứng parse ra `observed/winner` thực sự hữu ích.

## UI update flow

1. JS/C# tạo snapshot mới.
2. Host đi qua lớp filter/throttle/coalesce.
3. `QueueTickUiUpdate(...)` giữ payload mới nhất.
4. `DrainTickUiQueue()` apply vào UI qua `Dispatcher`.
5. `ApplyProgUiPayload(...)` cập nhật countdown/progress.
6. `UpdateSeqUI(...)` render chuỗi kết quả.
7. History/stats cũng chỉ cập nhật trên UI thread.

## OCR / canvas flow nếu có

- Không có OCR engine riêng.
- Dùng:
  - canvas scan
  - DOM scan
  - panel text fallback
- `rawSeq` hiện là output quan trọng nhất cho display/debug.
- Probe chuẩn để đối chiếu:
  - `(await __cw_probeRoadSeqFrames(8)).rawSeq`
  - `await __cw_showRoadSeqDebug(8)`

## Visual road sequence flow

### Mục tiêu hiện tại

- Chuỗi kết quả ở panel C# phải khớp với `rawSeq` từ `await __cw_showRoadSeqDebug(8)`.
- Visual debug overlay là nguồn thực tế để xác định ROI/cell đang đúng hay sai.
- Không dùng phần thống kê `CON/HÒA/CÁI` làm chuỗi kết quả; scanner phải chỉ lấy road kết quả.

### Luồng JS mong muốn

1. `brReadCanvasRoadSeq(...)` scan ROI/cell từ canvas.
2. `brKickProbeRoadSeqFrames('manual-debug-overlay' hoặc 'push-visual-sync', 8)` lấy nhiều frame.
3. `brSelectBestProbeRoadFrame(...)` chọn pack visual tốt nhất.
4. `brCommitProbeRoadPack(...)` chỉ được publish khi pack đến từ nguồn visual authority hợp lệ.
5. JS cập nhật:
  - `_domBeadSeqManaged`
  - `window.__cw_bead_raw_seq`
  - `window.__cw_seq_*`
6. `buildSnapshotNow(...)` dựng tick có `rawSeq`.
7. `safePost(tick)` đẩy về C#.
8. C# parse `rawSeq`, qua `QueueTickUiUpdate(...)`, rồi `UpdateSeqUI(...)`.

### Nguồn được phép làm visual authority

- `manual-debug-overlay`
- `push-visual-sync`

### Nguồn không được tự ý ghi đè visual authority

- `buildSnapshotNow-empty-pull`
- các probe nền tự động
- ROI auto sai vùng như `auto-road-b` khi không được kiểm chứng bằng visual debug

### Log cần đối chiếu khi lệch

- `[JSSEQ][probe-canvas-visual-authority]`
- `[JSSEQ][probe-canvas-frames-hit]`
- `[JSSEQ][buildSnapshotNow-empty-pull-kick-visual-sync]`
- `[JSSEQ][visual-road-publish-state]`
- `[JSSEQ][readSeqStateSafe-published-fallback]`
- `[PULLRAW]`
- `[SEQ][RX]`
- `[SEQ][UI][RAW-DIRECT]`
- `[SEQ][UI][RENDER]`

### Ghi chú luồng pull mới nhất

- Log runtime đã cho thấy `buildSnapshotNow('pull')` có thể thấy probe canvas hit nhưng vẫn gửi `PULLRAW` với `seq=""`, `rawSeq=""`.
- Nguyên nhân kiến trúc: reason `buildSnapshotNow-empty-pull` trước đó chỉ kick probe/cache, không được coi là `visual authority`, nên `brCommitProbeRoadPack(...)` không publish vào `window.__cw_seq*`.
- Patch mới nhất đổi fallback trống của `buildSnapshotNow('pull')` sang kick `brKickProbeRoadSeqFrames('push-visual-sync', 8)` để dùng cùng quyền publish/ưu tiên preset với visual sync.
- `readSeqStateSafe()` có fallback đọc `window.__cw_seq_pub`, `window.__cw_seq_raw`, `window.__cw_seq`, `window.__cw_bead_raw_seq` khi `readTKSeq()` trả rỗng.
- `brPublishVisualRoadSeqState(...)` là điểm publish trực tiếp state visual road sang:
  - `window.__cw_seq`
  - `window.__cw_seq_raw`
  - `window.__cw_seq_pub`
  - `window.__cw_bead_raw_seq`
  - `window.__cw_bead_managed_seq`
- Bản patch này chỉ có hiệu lực sau khi app được rebuild/restart vì JS là embedded resource.

## Frame selection flow

### Exact live frame

- Host hiện phải ưu tiên các frame có URL dạng:
  - `/internal/livestream_page/...bcrlive...`
- Các pattern thực tế:
  - `c5_bcrlive_withautoplay...`
  - `c5_bcrlive_withoutoplay...`

### Shell frame

- `top`
- `web.zowin.ph`
- các frame shell trung gian

### Rule hiện tại

- Exact live frame luôn phải được score cao hơn shell frame.
- Nếu exact frame đã trả kết quả hợp lệ, không chạy đè lại trên top shell cho cùng lệnh bridge.

## Betting DOM / click flow

- JS hiện phải click theo DOM/tail mới của ZoWin.
- Các vùng cược:
  - `BANKER`
  - `PLAYER`
  - `TIE`
- Yêu cầu đã chốt:
  - click thật
  - đúng vùng
  - chịu được thay đổi độ phân giải
  - chỉ click 1 lần

## Countdown / progress flow

- Logic cũ dùng `%` đã bỏ ở phần quyết định đặt cược.
- Logic hiện tại:
  - input là `đặt khi còn giây`
  - khi `countdown <= giá trị cấu hình` thì được phép đặt cược
- Progress/countdown vẫn được update từ snapshot JS.

## Điểm kiến trúc dễ phát sinh lỗi

- `MainWindow.xaml.cs` còn rất lớn, nhiều invariant chồng nhau.
- `PULL_POPUP_TICK_NOW` có cả logic walk frame và chấm điểm candidate.
- Exact frame host-side và exact frame JS-side phải đồng bộ, nếu lệch nhau sẽ vẫn kéo snapshot sai.
- Các event WebView/frame/popup chạy bất đối xứng, dễ dẫn đến race condition.
- Road sequence hiện có nhiều nguồn cạnh tranh:
  - visual debug/probe
  - readSnapshot/pull
  - cached/published seq state
  - fallback panel text
  Nếu không khóa quyền ghi authority, chuỗi đúng từ visual road có thể bị ghi đè bởi chuỗi sai hoặc trống.
- Build/runtime cũng là điểm dễ gây nhầm: log có thể vẫn là bản JS cũ nếu `BaccaratZoWin.exe`/`BaccaratZoWin.dll` bị khóa và build không copy được output mới.
