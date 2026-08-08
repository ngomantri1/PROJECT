# TODO

Chỉ giữ việc chưa hoàn thành, có điểm kiểm chứng rõ hoặc cần quyết định. Khi hoàn thành phải kèm test/runtime evidence rồi mới chuyển khỏi đây.

## Ưu tiên cao

- Sửa `Tasks/TaskUtil.cs:PlaceBet` để diễn giải kết quả `window.__cw_bet` thay vì luôn trả thành công.
- Quyết định và triển khai cơ chế kết thúc round không phụ thuộc duy nhất vào `session`; đồng thời guard `curSeq` rỗng trong `WaitRoundFinishAndJudge`.
- Đồng bộ giới hạn validator T/X/0 và I/N/0 với rule UI 2–50, hoặc cập nhật rule UI nếu 100 là chủ định.
- Quyết định heartbeat lease: bật lại có kiểm chứng hoặc loại bỏ flow heartbeat không dùng.

## Refactor có phạm vi rõ

- Tách trách nhiệm trong `MainWindow.xaml.cs` theo web/strategy/license/history/tab.
- Hợp nhất hoặc xác định ranh giới của bridge trong `WebView2LiveBridge.cs` và phần bridge nội tại `MainWindow.xaml.cs`.

## Cần kiểm chứng trước khi đóng milestone

- Unit/regression cho `MultiChainAdvanced`: net dương, từng khoảng ngưỡng âm, và vượt tổng ngưỡng.
- Regression cho level phẳng khi các dòng tiền có giá trị trùng nhau.
- Regression cho `0` trong chuỗi T/X và I/N: bỏ đúng một ván, không bet, không đổi money.
- Regression đổi chuỗi tiền trong lúc chạy cho cả non-`MultiChain` và `MultiChain`.
- Regression pending history, multi-side, Play/Stop nhiều tab và bridge reinject.
- Kiểm tra trial/license timezone, release lease và lock mouse khi toggle nhiều lần.
