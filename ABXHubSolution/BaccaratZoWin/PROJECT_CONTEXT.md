# PROJECT_CONTEXT

> Tài liệu ngữ cảnh thực tế cho AI/coding agent. Ưu tiên trạng thái code đang chạy thật và các quyết định đã chốt trong chat, không ưu tiên spec lý tưởng cũ.

## Mô tả tổng quan project

- `BaccaratZoWin` là app `WPF .NET 8` dùng `WebView2` để điều khiển game Baccarat ZoWin.
- App có thể chạy standalone hoặc theo kiểu plugin gắn với `ABX.Core`.
- Runtime chính nằm ở:
  - `MainWindow.xaml.cs`
  - embedded JS `v4_js_xoc_dia_live.js`
- App làm các việc chính:
  - mở web game
  - inject JS bridge vào top/frame
  - đọc countdown, kết quả, tên nhân vật, số dư, chuỗi road
  - quyết định cược theo strategy
  - click bet/click chip
  - lưu pending/history/stats

## Công nghệ sử dụng

- `C#`
- `WPF`
- `.NET 8 (net8.0-windows)`
- `Microsoft.Web.WebView2`
- `System.Text.Json`
- `Dispatcher / async-await`
- `DPAPI`
- `ABX.Core`
- embedded JavaScript runtime

## Flow hoạt động chính

1. `MainWindow` khởi tạo config, stats, log, WebView2.
2. C# inject JS bridge vào top document và các frame game.
3. JS đọc snapshot game và đẩy `tick` về C#.
4. C# nhận `tick`, chuẩn hóa snapshot, cập nhật state hiện tại.
5. Strategy đọc snapshot qua `GameContext`.
6. `TaskUtil.PlaceBet()` gọi JS để click chip/cửa cược.
7. Sau khi issue bet, app tạo `pending row`.
8. Khi round settle, app finalize pending row, cập nhật history/stats/UI.

## Coding rules

- Không phá luồng nghiệp vụ đặt cược hiện tại từ C# xuống JS nếu chưa có bằng chứng rõ ràng.
- Không bypass `TaskUtil.PlaceBet()`.
- Không update control WPF ngoài `Dispatcher`.
- Không đổi contract JSON JS -> C# nếu chưa sửa cả hai đầu.
- Không thêm logic nghiệp vụ lớn trực tiếp vào event UI nếu có thể tách helper/service.
- Mọi thay đổi trong `v4_js_xoc_dia_live.js` đều cần rebuild vì đây là embedded resource.
- Khi sửa bridge/frame logic, luôn ưu tiên exact live frame thay vì shell/top frame.

## Naming rules

- Side chuẩn:
  - `BANKER`
  - `PLAYER`
  - `TIE`
- Sequence chuẩn:
  - `B`
  - `P`
  - `T`
- Major/minor:
  - `N`
  - `I`
- Log prefix chuẩn:
  - `[Bridge]`
  - `[SEQ]`
  - `[BET]`
  - `[BET][HIST]`
  - `[NETSEQ]`
  - `[PERF]`
  - `[TickIngress]`

## Các rule quan trọng

- `rawSeq` là nguồn hiển thị ưu tiên cho chuỗi kết quả ở panel C#.
- Không quay lại phụ thuộc `snap.seq` cho phần display nếu `snap.rawSeq` đã có dữ liệu tốt.
- Không dùng lại `boardCountB/P/T/boardCountSource` và không khôi phục `_netSeqDisplay` cũ theo kiểu phụ thuộc điều kiện cứng.
- Exact live game frame hiện phải ưu tiên các URL dạng:
  - `/internal/livestream_page/...bcrlive...`
  - đặc biệt các frame `c5_bcrlive_withautoplay...` hoặc `c5_bcrlive_withoutoplay...`
- Với ZoWin hiện tại, `top` và `web.zowin.ph` thường chỉ là shell; không được coi là nguồn thật nếu live frame đã có.
- Countdown đặt cược giờ dùng logic `đặt khi còn giây`, không còn dùng `%`.

## WebSocket flow

### Trạng thái hiện tại

- Luồng `CDP websocket/network tap` đã bị tắt hẳn cho runtime ZoWin hiện tại.
- Lý do:
  - log thực tế cho thấy `wsR` tăng rất mạnh
  - nhưng `obsPkt=0`, `winnerPkt=0`
  - tức là tốn tài nguyên nhưng không giúp đồng bộ hoặc settle

### Kết luận thực tế

- Hiện tại app không dùng websocket/CDP để điều khiển luồng bet chính.
- Snapshot/authority hiện chạy chủ yếu bằng JS bridge + frame pull.
- Code CDP cũ vẫn còn trong source như một nhánh legacy/debug, nhưng không được bật trong profile hiện tại.

## Pending flow

- Khi issue bet, app tạo `_pendingRows`.
- Mỗi pending row giữ các dữ liệu như:
  - side
  - stake
  - `IssuedSeqDisplay`
  - `IssuedSeqVersion`
  - `IssuedTableId`
  - `IssuedGameShoe`
  - `IssuedObservedRound`
- Pending row chỉ được settle khi qua gating:
  - context phù hợp
  - seq advanced hoặc điều kiện settle hợp lệ
- Có logic:
  - late bind context
  - drop stale row khi reset context
  - multi-match guard

## Threading / UI rules

- UI chỉ được chạm qua `Dispatcher`.
- WebView callback, frame callback, timer callback có thể đến từ thread nền.
- Không đọc `TextBox`, `PasswordBox`, `CheckBox` từ background thread.
- `SaveConfigAsync()` phải marshal về UI thread trước khi đọc control.
- Tick UI phải coalesce/throttle để tránh spam render.
- Không để log/file IO/blocking dài chạy trên UI thread.

## OCR / canvas / frame rules

- Project không dùng OCR engine riêng; chủ yếu dùng scan canvas/DOM/text trong JS.
- `Canvas Watch` là panel debug để soi nguồn dữ liệu gần runtime thật.
- Hàm debug visual road đang dùng để đối chiếu trực tiếp là:
  - `await __cw_showRoadSeqDebug(8)`
  - `__cw_clearRoadSeqDebug()`
- Yêu cầu hiện tại đã chốt: chuỗi ở panel C# `CHUỖI KẾT QUẢ` phải đồng bộ theo đúng `rawSeq` mà `await __cw_showRoadSeqDebug(8)` trả về.
- Không được để các probe nền như `buildSnapshotNow-empty-pull` hoặc ROI auto sai vùng ghi đè chuỗi visual authority nếu chúng không cùng nguồn với visual debug.
- Khi panel debug đúng nhưng C# sai:
  - ưu tiên kiểm tra frame source
  - kiểm tra exact live frame có được chọn chưa
  - kiểm tra `main-pull` có đang rơi về `top` hay không
  - kiểm tra log `probe-canvas-visual-authority`, `push-visual-sync`, `PULLRAW`, `[SEQ][RX]`, `[SEQ][UI][RENDER]`
- Exact frame hiện phải lấy trực tiếp từ live frame, không chỉ lọc theo shell host.

## Những điều tuyệt đối không được phá

- Contract bridge JS <-> C# của `tick`, `result`, `bet`, `bet_error`.
- Luồng start/stop strategy hiện tại.
- Luồng pending/history settle đang dùng.
- Exact frame betting đã sửa cho 3 cửa `BANKER/PLAYER/TIE`.
- Rule hiển thị chuỗi kết quả theo `rawSeq`.
- Logic countdown theo giây còn lại.
- Cơ chế click thật vào cửa cược trong live frame.
- Click một lần cho mỗi hành động cược.

## Cập nhật quan trọng từ chat hiện tại

- Đã bỏ `_netSeqDisplay` theo hướng cũ và đổi ưu tiên hiển thị sang `rawSeq`.
- Đã đổi các chỗ dùng `snap.seq` sang `snap.rawSeq` cho phần display/authority liên quan.
- Đã bỏ các biến `boardCountB/P/T/boardCountSource` khỏi hướng xử lý mới.
- Đã thêm ưu tiên exact live frame thay vì quét dàn trải shell/top.
- Đã sửa logic click cửa cược để phù hợp DOM/tail mới của ZoWin.
- Đã sửa countdown để dùng số giây còn lại.
- Đã ghi nhận root cause freeze lớn:
  - flood message bridge
  - pull snapshot sai frame
  - CDP websocket vô ích nhưng nặng
  - đọc UI control từ background thread
- Trạng thái mới nhất của chuỗi kết quả:
  - Countdown đã được người dùng xác nhận đồng bộ OK, không được sửa phá phần này.
  - JS debug `await __cw_showRoadSeqDebug(8)` đọc được visual road đúng hơn panel C#.
  - Panel C# từng hiển thị sai do probe nền/ROI auto ghi đè chuỗi đúng và do lỗi scope `_forcePushOnce`.
  - Đã thử hướng `push-visual-sync` chạy thưa để đồng bộ visual road lên C#, nhưng người dùng báo hiện tại panel C# không còn hiển thị chuỗi kết quả; cần tiếp tục debug log/code trước khi coi là fix xong.
  - Log mới đã xác nhận app có chạy embedded JS mới hơn (`len=792314`) nhưng payload `[PULLRAW]` vẫn có `seq=""`, `rawSeq=""` vì luồng `buildSnapshotNow-empty-pull` chỉ kick probe/cache, không publish visual authority lên `window.__cw_seq*`.
  - Đã vá tiếp để khi `pull` trống thì kick `brKickProbeRoadSeqFrames('push-visual-sync', 8)` thay vì reason `buildSnapshotNow-empty-pull`, đồng thời thêm log `buildSnapshotNow-empty-pull-kick-visual-sync`, `visual-road-publish-state`, `readSeqStateSafe-published-fallback`.
  - Bản vá mới nhất chưa được xác nhận runtime vì `BaccaratZoWin.dll` bị khóa bởi app đang chạy và Visual Studio; phải đóng app/debugger rồi build lại để embedded JS mới thật sự vào app.
  - Khi sửa tiếp, ưu tiên tối thiểu: giữ countdown, không bật CDP websocket, không đổi contract tick/result/bet.

## Ghi chú build/runtime mới nhất

- `v4_js_xoc_dia_live.js` là embedded resource; sửa JS mà không build/restart app thì runtime không đổi.
- `AutoBetHub` Debug đã cần build trước để tạo dependency `AutoBetHub\bin\Debug\net8.0-windows\ABX.Core.dll`.
- Lỗi build hay gặp:
  - `BaccaratZoWin.exe` hoặc `BaccaratZoWin.dll` bị khóa bởi process `BaccaratZoWin`.
  - Visual Studio có thể giữ lock DLL khi đang debug/mở project.
- Nếu log `Loaded JS from embedded` vẫn không đổi `len` sau sửa JS, nghĩa là app chưa chạy bản build mới.
