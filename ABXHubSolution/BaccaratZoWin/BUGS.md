# BUGS

> Chỉ liệt kê bug/điểm rủi ro đáng chú ý cho AI coding hiện tại.

## Bug hiện tại

### 1. Strategy index / tooltip còn lệch

- UI và code strategy index chưa thật sạch
- Dễ gây map sai strategy khi sửa combo/tooltip/config cũ

### 2. Game detection còn phân tán

- C# và JS đều có rule nhận diện game context
- Đã chuyển sang modern shell flow, nhưng vẫn còn một số nhánh heuristic cũ trong JS
- Rủi ro:
  - bám sai frame
  - `TextMap` rỗng dù game đang hiển thị
  - launch flow nhảy sang path phụ không cần thiết

### 3. `MainWindow.xaml.cs` vẫn là monolith

- Bridge, launch flow, seq sync, pending settle, UI, license nằm chung
- Regression rất dễ xảy ra khi sửa một nhánh liên quan WebView/bridge

### 4. Tên helper/log còn dấu vết legacy

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

## Bug chưa fix dứt điểm

- Strategy index/tooltip mismatch
- Rule game detection C# / JS chưa hợp nhất hoàn toàn
- Legacy popup helpers chưa được rename sạch
- Monolith orchestration chưa được tách nhỏ

## Nguyên nhân bug chính

- Provider/host đổi layout, đổi frame, đổi route nhưng app vẫn phải hỗ trợ cả path cũ lẫn mới
- JS tick, network authority, popup/main/frame injection là nhiều luồng đồng thời
- Một file điều phối quá lớn làm invariant khó nhìn
- Embedded JS khiến dễ quên rebuild khi sửa script

## Workaround tạm thời

- Nếu JS sửa mà runtime không đổi: rebuild vì JS là embedded resource
- Nếu panel debug hiện nhưng map rỗng: kiểm tra đang bám đúng frame game chưa
- Nếu host same-page chưa lên game: ưu tiên click launch item/card ngay trên trang
- Nếu cần inspect: dùng `F12` trên bản build mới

## Vùng code dễ lỗi

- `MainWindow.xaml.cs`
  - launch flow
  - bridge inject
  - same-page vs popup path
  - pending settle
- `v4_js_xoc_dia_live.js`
  - game context detect
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
