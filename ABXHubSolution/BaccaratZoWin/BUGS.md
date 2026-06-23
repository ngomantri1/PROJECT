# BUGS

> Chỉ liệt kê bug/điểm rủi ro đáng chú ý cho AI coding hiện tại.

## Bug hiện tại

### 1. Canvas có tên nhân vật nhưng bảng điều khiển C# vẫn `-`

- Triệu chứng:
  - canvas / `Canvas Watch` đang hiện đúng tên như `minoauto6`
  - bảng điều khiển bên phải ở `LblUserName` vẫn chỉ hiện `-`
  - có thời điểm `main-pull` vẫn log `user=-` hoặc `user=--`
- Chữ ký log đã gặp:
  - `reason=js-empty-clear-board-state`
  - `HUDBAL ... A=- | user=-`
  - `[CWUSER][HOST_READ]` trả rỗng
  - `[CWUSER][TOTALS_COCOS]` cho thấy `TAIL_USER_NAME` không match hoặc `chosenN` rỗng
- Nguyên nhân khả dĩ cao nhất hiện tại:
  - `main-pull` / `PULL_POPUP_TICK_NOW` đang lấy snapshot từ sai context top/frame
  - parser fallback chưa luôn đồng bộ với panel đang render
  - site mới làm `TAIL_USER_NAME` cũ không còn ổn định
- Điều đã chốt:
  - nguồn mong muốn phải là `t.N` / `snap.username` từ scanner/canvas
  - không dùng `__cw_readHostUsername()` làm nguồn nghiệp vụ chính
  - canvas và panel C# phải hội tụ về cùng một snapshot

### 2. Chuỗi kết quả có thể lấy đúng ở probe nhưng app thật vẫn rỗng

- DevTools probe `cw_probe_seq_roi.js` đã lấy được chuỗi đầy đủ
- Nhưng app thật có lúc vẫn hiện `SEQ META len=0`
- Rủi ro nằm ở đoạn:
  - `readTKSeq`
  - `readSeqStateSafe`
  - `buildSnapshotNow`
  - `panel render/push`

### 3. Strategy index / tooltip còn lệch

- UI và code strategy index chưa thật sạch
- Dễ gây map sai strategy khi sửa combo/tooltip/config cũ

### 4. Game detection còn phân tán

- C# và JS đều có rule nhận diện game context
- Đã chuyển sang modern shell flow, nhưng vẫn còn một số nhánh heuristic cũ trong JS
- Rủi ro:
  - bám sai frame
  - `TextMap` rỗng dù game đang hiển thị
  - launch flow nhảy sang path phụ không cần thiết

### 5. `MainWindow.xaml.cs` vẫn là monolith

- Bridge, launch flow, seq sync, pending settle, UI, license nằm chung
- Regression rất dễ xảy ra khi sửa một nhánh liên quan WebView/bridge

### 6. Tên helper/log còn dấu vết legacy

- Logic đã đổi sang same-page + modern shell flow
- Nhưng nhiều helper vẫn mang tên popup/player-flow cũ
- Đây là bug bảo trì: dễ hiểu nhầm code path thật

## Bug đã fix trong phiên này

### 1. Canvas Watch không hiện đúng

- Nguyên nhân:
  - sửa nhầm dòng `display:none`
  - boot sai frame
  - sửa JS xong nhưng runtime vẫn dùng embedded resource cũ
- Đã fix:
  - gom visibility vào một chỗ
  - sửa boot entry
  - rebuild embedded JS

### 2. Canvas Watch hiện nhưng thiếu info

- Nguyên nhân:
  - panel chưa auto-start / chưa auto-show đầy đủ overlay
- Đã fix:
  - auto-start
  - auto-enable `Money/Bet/Text`
  - tăng chi tiết panel info

### 3. Overlay debug chặn click web

- Nguyên nhân:
  - overlay layer nhận pointer event
- Đã fix:
  - default pass-through
  - panel vẫn click được, web dưới vẫn click được

### 4. `TextMap` rỗng sau khi site đổi layout

- Nguyên nhân:
  - app bám shell `web.zowin.nu` thay vì game frame/context thật
- Đã fix:
  - mở rộng game shell detection
  - inject/autostart đúng frame hơn
  - chuyển flow ưu tiên sang same-page launch

### 5. Không mở được DevTools bằng phím

- Đã fix:
  - `F12`
  - `Ctrl+Shift+I`

### 6. Chẩn đoán sai do `LblAmount` từng tự hiện `0`

- Nguyên nhân:
  - UI từng default `LblAmount = "0"` khi thiếu amount
  - làm tưởng rằng luồng account/balance vẫn về C# bình thường
- Đã fix:
  - thiếu amount thì hiện `-`
  - tránh nhầm `giá trị mặc định` với `dữ liệu thật`

### 7. Nhãn canvas sai bản chất dữ liệu

- Nguyên nhân:
  - canvas từng ghi `TÀI KHOẢN` trong khi dữ liệu thực tế là tên nhân vật
- Đã fix:
  - đổi nhãn thành `TÊN NHÂN VẬT`

## Bug chưa fix dứt điểm

- Canvas và panel C# chưa cùng hiện được tên nhân vật từ một nguồn trong mọi vòng chạy
- `main-pull` / `PULL_POPUP_TICK_NOW` vẫn cần xác nhận lại trên site mới
- `TAIL_USER_NAME` cũ có thể không còn đúng hoàn toàn trên layout mới
- Chuỗi kết quả trong app thật vẫn cần test vòng kín sau khi rebuild
- Strategy index/tooltip mismatch
- Rule game detection C# / JS chưa hợp nhất hoàn toàn
- Legacy popup helpers chưa được rename sạch
- Monolith orchestration chưa được tách nhỏ

## Nguyên nhân bug chính

- Provider/host đổi layout, đổi frame, đổi route nhưng app vẫn phải hỗ trợ cả path cũ lẫn mới
- JS tick, network authority, popup/main/frame injection là nhiều luồng đồng thời
- Một file điều phối quá lớn làm invariant khó nhìn
- Embedded JS khiến dễ quên rebuild khi sửa script
- Có độ lệch giữa:
  - dữ liệu canvas đang render
  - dữ liệu `main-pull` đang kéo về host
  - dữ liệu UI C# đang giữ lại từ tick cuối

## Workaround tạm thời

- Nếu JS sửa mà runtime không đổi: rebuild vì JS là embedded resource
- Nếu panel debug hiện nhưng map rỗng: kiểm tra đang bám đúng frame game chưa
- Nếu host same-page chưa lên game: ưu tiên click launch item/card ngay trên trang
- Nếu cần inspect: dùng `F12` trên bản build mới
- Nếu cần debug tên nhân vật: xem log `[CWUSER]` trước khi kết luận scanner hay host bridge hỏng
- Nếu panel phải hiện `0` ở `TÀI KHOẢN`, không được coi đó là bằng chứng luồng snapshot còn tốt; phải đối chiếu log tick thật

## Vùng code dễ lỗi

- `MainWindow.xaml.cs`
  - launch flow
  - bridge inject
  - same-page vs popup path
  - `PULL_POPUP_TICK_NOW`
  - `ExecuteOnBetWebAsync` / `ShouldPreferFrameBridgeResult`
  - pending settle
- `v4_js_xoc_dia_live.js`
  - game context detect
  - `totals()`
  - `buildSnapshotNow()`
  - `__cw_last_panel_snapshot`
  - `TAIL_USER_NAME`
  - TextMap/MoneyMap/BetMap
  - Canvas Watch
  - boot entry
- `Tasks\TaskUtil.cs`
  - place bet
  - settle wait

## Invariant phải giữ

- Không settle pending bet nếu chưa qua `context + seq gating`
- Không để overlay debug chặn click web mặc định
- Không quay flow modern shell về assumption `webMain.jsp` / `singleBacTable.jsp`
- Không để JS tick rỗng overwrite authority tốt hơn
- Không update WPF control ngoài `Dispatcher`
