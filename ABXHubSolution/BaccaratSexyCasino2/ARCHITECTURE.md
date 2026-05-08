# Architecture

## Project Structure
- `MainWindow.xaml` / `MainWindow.xaml.cs`
  - UI chính, WebView host, authority selection, seq/pool/history/task orchestration.
- `MainWindow.Startup.cs`
  - startup flow: config, WebView ready, navigate, auto login.
- `MainWindow.EmbedMode.cs`
  - tạo embedded content cho Hub.
- `WebView2LiveBridge.cs`
  - inject JS vào top/frame, re-inject theo document/frame lifecycle.
- `Models.cs`
  - snapshot models từ JS và scout frame.
- `v4_js_xoc_dia_live.js`
  - JS collector + canvas watch + DOM scan + net probe + click/bet executor.
- `Tasks/*`
  - chiến lược cược, money management, shared runtime utilities.
- `BaccaratSexyCasino2Plugin.cs`
  - plugin entry cho AutoBetHub.

## Main Modules
- UI module:
  - `MainWindow.xaml`
  - history grid, status card, strategy tabs, WebView region.
- Bridge/injection module:
  - `WebView2LiveBridge.cs`
- JS runtime module:
  - `v4_js_xoc_dia_live.js`
- Network/seq authority module:
  - logic trong `MainWindow.xaml.cs`
- Task engine:
  - `GameContext`
  - `IBetTask`
  - `TaskUtil`
  - `MoneyManager`
  - concrete tasks trong `Tasks/`

## File Responsibilities
- `MainWindow.xaml.cs`
  - parse inbound messages,
  - choose authority frame,
  - bootstrap/append sequence,
  - finalize pending rows,
  - update WPF UI,
  - push display snapshot to Canvas,
  - start/stop auto-bet tasks.
- `v4_js_xoc_dia_live.js`
  - frame context detection,
  - DOM scan for board/status/pool/account,
  - WebSocket/XHR payload probing,
  - Canvas Watch overlay,
  - JS-side bet enqueue/click logic.
- `TaskUtil.cs`
  - common wait/place/settle helpers cho tasks,
  - duplicate send guard,
  - optimistic bet recording.
- `GameContext.cs`
  - dependency bag giữa MainWindow và task runtime.

## Dependencies
- `MainWindow` phụ thuộc:
  - `WebView2LiveBridge`
  - `CwSnapshot` / `FrameScoutSnapshot`
  - `Tasks/*`
  - embedded JS resource.
- `Tasks/*` phụ thuộc:
  - `GameContext`
  - `TaskUtil`
  - `MoneyManager` / `MoneyHelper`
- `Plugin` phụ thuộc:
  - `MainWindow`
  - `ABX.Core`

## Data Flow
1. JS build snapshot / probe packet.
2. WebView2 post message -> `MainWindow`.
3. C# parse JSON loose.
4. C# route:
   - `tick` -> snapshot authority/UI/pool/prog/status.
   - `frame_scout` -> authority scoring.
   - `net_probe` -> network sequence / diagnostics.
5. Accepted state update:
   - WPF labels/tables.
   - push snapshot back to JS Canvas.

## WebSocket Packet Flow
- JS intercepts WS/XHR and sends compact probe.
- Packet types relevant:
  - `GameHallInfo handler=1/2/4`
  - `GameInfo handler=1/3/4`
  - `roadInfo.winCounts`
- C# stages:
  - `ObserveNetworkGameState(...)`
  - `TryBuildRoadInfoCountsPacket...`
  - `BuildWinnersFromRoadInfoCountsLocked(...)`
  - `ProcessNetworkWinnerPacket(...)`

## UI Update Flow
- Tick/network update internal state.
- `UpdateSeqUI`, result labels, win/loss, pool/status labels update on WPF thread.
- History grid refresh after finalize/drop pending.
- Canvas display snapshot pushed by `PushAcceptedDisplayToCanvas(...)`.

## OCR / Canvas / Scan Flow
- Không có OCR thật; JS dùng DOM/textmap/rect scan.
- `Canvas Watch` là overlay debug + live mirror của snapshot.
- Scan groups:
  - status/process bar
  - road/bead board
  - bet boxes / pool
  - account / balance
  - devtool probes (`devtool_scan200text.js`, `devtool_probe_*`)

## Sequence Authority Flow
- Bootstrap:
  - DOM raw board từ `singleBacTable.jsp`.
- Append:
  - `roadInfo.winCounts` từ network/CDP.
- Repair:
  - chỉ cho trusted fallback raw board của đúng active single-bac table.
- Waiting state:
  - `waiting-board-bootstrap` được dùng thay vì render seq rỗng.

## Pending / Settle Flow
- `PlaceBet(...)` -> `_pendingRows`.
- `FinalizeLastBet(...)`:
  - context match,
  - seq advance match,
  - special fallback cho winner đầu sau reset.
- Sau finalize:
  - update result/winlose/account,
  - persist CSV,
  - refresh history UI.
