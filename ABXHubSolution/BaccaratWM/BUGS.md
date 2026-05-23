# BUGS

## Bug hiện tại
- `DecisionSeconds` chưa được nối rõ vào runtime decision gate.
- Dấu hiệu: có lưu/đọc `_cfg.DecisionSeconds` và bind `TxtDecisionSecond`, nhưng giá trị đưa vào `GameContext.DecisionPercent` vẫn từ `_decisionPercent = 3`.
- Tác động: người dùng đổi `DecisionSeconds` có thể không ảnh hưởng hành vi task như kỳ vọng.

- `ValidateSeqNI` lệch giữa logic và thông báo.
- Logic: cho phép `2..100`.
- Message lỗi: ghi `2..50`.
- Tác động: gây hiểu sai validation thực tế.

- `App.xaml` tham chiếu `Assets/kq/BANKER.png`, `Assets/kq/PLAYER.png` nhưng thư mục `Assets/kq` hiện chỉ có `THANG/THUA/HOA`.
- Tác động: resource key có thể fail tùy đường chạy; hiện được giảm rủi ro nhờ fallback icon ở code.

## Bug đã fix / đã có cơ chế phòng lỗi
- Trùng lịch sử do ack lặp.
- Đã có cơ chế dedupe dispatch signature + cửa sổ thời gian ngắn trước khi append history.

- Chốt pending nhiều lần trong cùng session.
- Đã có `TryMarkFinalizeOncePerTableSession` + map `_lastFinalizedSessionByTable`.

- Kẹt chờ cửa cược khi countdown/source nhiễu.
- Đã có fallback wait logic trong `TaskUtil.WaitUntilBetWindow` dựa trên nhiều tín hiệu state.

- Mất room list do parser đơn nguồn.
- Đã có multi-source arbitration (`protocol35`, `protocol21`, `table_update`) + buffer publish cho wrapped protocol21.

## Bug chưa fix
- Mismatch `DecisionSeconds` vs `_decisionPercent` (cần trace và nối runtime rõ ràng).
- Mismatch text validation `ValidateSeqNI`.
- Cấu hình csproj dùng `Microsoft.NET.Sdk.WindowsDesktop` phát warning `NETSDK1137` khi build bằng SDK mới.

## Nguyên nhân bug (gốc)
- Nghiệp vụ tập trung trong `MainWindow.xaml.cs` quá lớn nên dễ bỏ sót wire config-runtime.
- Runtime dùng nhiều nguồn tín hiệu song song (JS push, CDP network, popup frame) nên dễ race/inconsistency.
- Một số resource/key legacy còn tồn tại sau nhiều vòng đổi UI assets.

## Workaround tạm thời
- Với decision window: tạm dùng giá trị mặc định thực tế của engine cho tới khi nối xong config-runtime.
- Với `ValidateSeqNI`: hướng dẫn người dùng theo ngưỡng thực chạy (`2..100`) thay vì text UI.
- Với ảnh Banker/Player: ưu tiên icon từ `Assets/side/*` và fallback `FallbackIcons`.
- Với room feed chập chờn: dùng nút refresh room sau khi lobby tải ổn định; theo dõi log `[WM_DIAG]` để chọn nguồn feed đúng.

## Vùng code dễ lỗi
- `MainWindow.xaml.cs`.
- Khối parser protocol21/35 và publish room.
- Khối pending/finalize bet theo session/table.
- Khối inject/re-inject script cho main frame + popup frame.

- `js_home_v2.js`.
- `__cw_bet` queue/confirm/diag.
- Overlay state sync (`__abxTableOverlay`).
- History/road parsing từ DOM/SVG/canvas.

- `Tasks/*`.
- Các strategy có logic money progression + stop condition dễ gây drift nếu state đầu vào lệch.
