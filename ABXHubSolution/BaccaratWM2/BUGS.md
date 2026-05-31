# BUGS

## Bug hiện tại
- Vào sảnh WM trên các site dùng wrapper chưa ổn định tuyệt đối theo từng phiên chạy, đặc biệt trên VPS yếu.
- Triệu chứng còn gặp:
- Có phiên popup chỉ dừng ở `Lobby/Navigation` hoặc `LoginToSupplier` rất lâu, màn hình trắng/đen.
- Có phiên nếu chờ đủ lâu thì vẫn tự nhảy sang `wmvn.m8810.com` và load sảnh đầy đủ.
- Có phiên patch can thiệp sai làm điều hướng nhầm hoặc dừng trước khi transit tự hoàn tất.

## Bug đã giảm/đã khắc phục một phần
- Đã xác định rõ không nên coi mọi transit WM chậm là treo.
- Đã xác định top-level wrapper không phải lúc nào cũng là nơi launch game thật.
- Đã loại bỏ hướng kick frame `LoginToSupplier` gây sai URL và `Server Error in '/' Application`.

## Bug chưa fix
- Vẫn còn case transit WM quá chậm trên WebView2/VPS nên người dùng tưởng app không vào được.
- Chưa có ngưỡng chắc chắn để kết luận khi nào transit WM là "đang sống" và khi nào là "chết thật".
- Chưa có dashboard metric tổng hợp theo phiên popup để nhìn nhanh tỉ lệ thành công/thất bại.
- Warning build cũ của solution vẫn nhiều (không chặn build nhưng gây nhiễu khi điều tra).

## Nguyên nhân bug (theo log gần nhất)
- Vấn đề hiện tại chủ yếu nằm ở pha transit WM:
- `Lobby/Navigation -> LoginToSupplier -> wmvn`
- Trên một số phiên VPS, transit có thể mất hơn 10 phút rồi mới tự đi tiếp.
- Các patch retry/kick quá sớm làm phá flow tự nhiên hoặc bỏ cuộc trước thời điểm transit hoàn tất.
- Trong log WM đã có bằng chứng:
- có phiên app bỏ cuộc ở `max-attempts`
- sau đó nhiều phút popup vẫn tự chuyển sang `wmvn` và load `Gateway.php`, websocket, `rooms=39`

## Workaround tạm thời
- Khi gặp popup trắng/đen hoặc chờ lâu, xem log phiên mới nhất tại:
- `D:\NOTE\OneDrive\Desktop\log\20260531.log`
- Theo dõi các marker:
- `[BUILD] diag-probe-matrix-v9-passive-transit-hold`
- `NewWindowRequested ... Lobby/Navigation`
- `[WM_TRANSIT_DIAG]`
- `[PopupWeb][TRANSIT-HOLD]`
- `[PopupWeb][STUCK-RECOVERY]`
- `NavigationCompleted: OK | wmvn...`
- `Gateway.php`
- `rooms=39`

## Vùng code dễ lỗi
- `MainWindow.xaml.cs`:
- `NewWindowRequested`
- `PopupWeb_NewWindowRequested`
- `PopupWeb_NavigationStarting`
- `PopupWeb_NavigationCompleted`
- `TryHandlePopupTransitDiagMessage`
- `LogWmTransitHttpResponseDiagIfNeeded`
- `LogWmTransitHttpBodyDiagIfNeeded`
- `SetPopupTransitPassiveHold`
- `ArmPopupTransitWatch`

- `js_home_v2.js`:
- `clickBaccNhieuBanFromHome` (guard mở game)
- `__abx_bacc_lobby_retry` (interval retry + busy guard)
