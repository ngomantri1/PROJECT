# BUGS

## Bug hiện tại
- Build Debug vẫn có thể fail nếu:
- `XocDiaSoiVIP389.exe` đang chạy (file lock).
- `ABX.Core.dll` chưa có từ AutoBetHub Debug.
- Nhiều warning nullable/unreachable/async-without-await còn tồn tại.

## Bug đã fix (hôm nay)
- Canvas không vào ở page mới do gate URL/cc:
- Đã cho phép boot/push ở `no-cc`.
- `TextMap` bấm không ra vùng ở page mới:
- Đã thêm fallback DOM `buildTextRectsDom()`.
- Tên nhân vật hiển thị sai/mất trên panel phải:
- Đã chặn `home_tick` ghi đè rỗng + ưu tiên giữ tên hợp lệ gần nhất.
- Prog bị kẹt `1s`:
- Đã xử lý null-hit và ép về `0` khi countdown DOM biến mất cuối phiên.
- Status không đúng theo yêu cầu:
- Đã đổi rule cứng theo prog và màu UI.
- Seq không đọc được sau đổi page:
- Đã thêm parser DOM road `cardroadtable-list1 span.cl_num` cho chuỗi `0..4`.

## Bug chưa fix / còn tồn tại
- Parser DOM vẫn phụ thuộc một số class/id động của vendor; đổi theme lớn có thể cần cập nhật tail.
- Chưa có test tự động cho JS parser (`prog/seq`) nên vẫn dựa nhiều vào smoke test tay.
- Cảnh báo build nhiều, gây nhiễu khi truy lỗi mới.

## Nguyên nhân bug
- Trang mới không còn Cocos scene chuẩn như trang cũ (`no-cc`).
- DOM động thay đổi id/class theo phiên và layout.
- Logic cũ ưu tiên nhánh cc/path cũ nên miss dữ liệu mới.

## Workaround tạm thời
- Khi nghi parser sai: dùng `Scan500Text`/`ScanTK` để lấy tail thực tế rồi cập nhật rule.
- Nếu UI không cập nhật ngay sau sửa JS: rebuild/restart app (JS đang embed runtime).
- Khi build lỗi lock exe: tắt process app trước.

## Vùng code dễ lỗi
- `v4_js_xoc_dia_live.js`:
- `readCountdownSecDom`, `readTKSeqDomRoad`, `buildTextRectsDom`, `tick`, `__cw_startPush`.
- `MainWindow.xaml.cs`:
- Router `WebMessageReceived`, update `LblUserName/LblAmount`, progress/status UI.
- `Assets/Seq/*.png`:
- Sai kích thước/style sẽ làm badge hiển thị lệch.
