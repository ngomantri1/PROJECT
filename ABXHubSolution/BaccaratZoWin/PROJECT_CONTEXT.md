# PROJECT_CONTEXT

> Tài liệu phục vụ AI coding. Ưu tiên logic đang chạy thực tế, không phải spec lý tưởng.

## Tổng quan

- `BaccaratZoWin` là app `WPF .NET 8` và cũng chạy như plugin cho `ABX.Core`.
- App điều khiển `WebView2`, tiêm JS `v4_js_xoc_dia_live.js`, đọc trạng thái game realtime, chạy strategy, quản lý vốn, lưu history/stats.
- Code trung tâm vẫn là `MainWindow.xaml.cs`.
- Runtime hiện tại ưu tiên host/live shell kiểu `same-page` trên `zowin` hơn là điều hướng sang link `webMain.jsp` / `singleBacTable.jsp` cũ.

## Công nghệ

- `C#`, `WPF`, `net8.0-windows`
- `Microsoft.Web.WebView2`
- `ABX.Core` plugin contract
- Embedded JS runtime: `v4_js_xoc_dia_live.js`
- `System.Text.Json`
- `DPAPI`
- CDP / `CallDevToolsProtocolMethodAsync` cho network + trusted click
- Local storage tại `%LOCALAPPDATA%\BaccaratZoWin`

## Flow hoạt động chính

1. `MainWindow` khởi tạo config, stats, log, WebView2.
2. Host đăng ký bridge script vào top doc, frame, popup khi cần.
3. JS quét canvas/DOM/text, đẩy `tick` về C#.
4. C# hợp nhất `tick` với authority từ network/CDP.
5. Strategy đọc snapshot authoritative qua `GameContext`.
6. `TaskUtil.PlaceBet()` gọi JS queue đặt cược.
7. Pending row được giữ tới khi settle đủ context/seq gating.
8. UI/history/stats/money cập nhật trên `Dispatcher`.

## Flow vào game hiện tại

- Ưu tiên `same-page flow` cho host hiện đại:
  - `zowin.nu`
  - `game8b.com`
  - `bpweb.*`
  - `games.*`
  - shell/provider tương tự
- Rule mới nhận diện game theo:
  - `activations/baccarat`
  - `selectedgame=baccarat` và không phải `application=lobby`
  - keyword `baccarat` / `xocdia`
- Không fallback lại `webMain.jsp` / `singleBacTable.jsp` như flow cũ.
- Với host same-page, app ưu tiên click mở live item ngay trên trang và chờ game signal thực.
- Popup/fallback route chỉ còn là nhánh phụ cho host/flow legacy.

## Coding rules

- Không bypass `TaskUtil.PlaceBet` và flow settle authoritative.
- Không update WPF control ngoài `Dispatcher`.
- Không sửa contract JSON giữa JS và C# nếu chưa sửa cả hai đầu.
- Không đổi index strategy nếu chưa migrate config cũ.
- Không nhét logic nghiệp vụ mới trực tiếp vào handler UI nếu có thể tách vào `Tasks\*.cs`.
- Mọi thay đổi JS phải nhớ: file đang là embedded resource, phải rebuild để runtime nhận bản mới.

## Naming rules

- Side chuẩn: `BANKER`, `PLAYER`, `TIE`
- Seq chuẩn: `B`, `P`, `T`
- Major/minor: `N`, `I`
- Runtime strategy dùng `IBetTask.Id`
- Log prefix nên rõ nghĩa: `[Bridge]`, `[PlayEnsureGame]`, `[SEQ]`, `[BET]`, `[NETSEQ]`

## Rule quan trọng

- `MainWindow.xaml.cs` vẫn là orchestration thật; sửa nhỏ, đúng chỗ.
- Snapshot dùng cho strategy phải là snapshot authoritative, không dùng text UI raw.
- Pending bet chỉ được settle khi qua `context + seq gating`.
- Với `zowin` hiện tại, đừng đưa logic quay về assumption `webMain.jsp` / `singleBacTable.jsp`.
- Same-page flow và popup flow cùng tồn tại; phải biết host nào dùng path nào.

## WebSocket / Network flow

- Có 2 nguồn dữ liệu:
  - JS `tick` từ page/frame
  - network/CDP packet cho observed context / winner
- JS tick nhanh cho UI và board snapshot.
- Network/CDP là authority bổ sung để tránh settle sai.
- C# hợp nhất thành `_netSeq*`, observed context và settle authority.

## Pending flow

- Khi bet được queue/send, app tạo `_pendingRows`.
- Row giữ `IssuedSeqVersion`, `IssuedTableId`, `IssuedGameShoe`, `IssuedObservedRound`.
- Khi settle:
  - match theo context nếu có
  - check `seq advanced`
  - reject multi-match sai
- Nếu issue time thiếu context, code dùng `late bind`.
- Đổi table/shoe có thể drop pending cũ để tránh settle nhầm.

## Threading / UI rules

- Task/strategy chạy nền; UI luôn quay về `Dispatcher`.
- WebView event rất dày; đã có coalesce/throttle ở nhiều nhánh.
- Không đưa IO/blocking dài lên UI thread.
- Popup/main/frame bridge đều có thể callback bất kỳ lúc nào; tránh assumption thread đơn giản.

## Canvas / debug rules

- `Canvas Watch` là panel debug trong `v4_js_xoc_dia_live.js`.
- Overlay debug hiện mặc định nhưng đã chỉnh `pointer-events` để không chặn click web.
- `TextMap/MoneyMap/BetMap` phụ thuộc đúng game frame/context; nếu panel hiện mà map rỗng thì thường là bám sai frame, không phải lỗi render đơn thuần.
- `F12` và `Ctrl+Shift+I` mở DevTools cho WebView đang active.

## Những điều tuyệt đối không được phá

- Contract JS ↔ C# của `tick`, `bet`, `bet_error`, `result`
- Seq authority sync khi đổi table/shoe
- Pending settle gating theo context + version
- Embedded JS load path
- Plugin lifecycle `CreateView()` / `Stop()` / host shutdown
- Click-through của overlay debug
- Flow same-page trên `zowin` hiện tại
