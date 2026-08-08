# BUSINESS_RULES

Các rule dưới đây là contract nghiệp vụ hiện hành được phản ánh trong UI/source; nếu thay đổi phải cập nhật file này và kiểm chứng runtime.

## Đặt cược và round

- App đặt Tài/Xỉu qua WebView2; bridge phải sẵn sàng trước khi strategy chạy.
- Chuỗi strategy `1) Chuỗi cầu T/X` nhận `T`, `X`, `0`; chuỗi `3) Chuỗi cầu I/N` nhận `I`, `N`, `0`.
- `0` bỏ qua đúng một ván: chờ session/round tiến triển, không gọi bet, không cập nhật win-loss hoặc money.
- Kết quả/pending history chỉ được chốt khi có bằng chứng round mới theo cơ chế runtime hiện tại; không suy diễn thành công từ việc gọi JavaScript.

## Quản lý vốn

- Đổi chuỗi tiền khi task đang chạy không reset level/state; chuỗi mới được dùng từ ván kế tiếp theo level hiện tại.
- `MultiChain` và `MultiChainAdvanced` hiển thị level theo vị trí phẳng trong toàn bộ các dòng, không dùng giá trị tiền để suy ra level vì tiền có thể trùng.
- `MultiChainAdvanced` cộng net xuyên các dòng. Ngưỡng một dòng là tổng các phần tử của dòng; net dương hoặc vượt tổng ngưỡng âm thì reset dòng 1, mức 1 và net về 0.

## An toàn runtime

- UI callback từ task/timer nền phải qua `Dispatcher`; loop phải có thể hủy.
- Config/stats phải ghi atomic và không làm mất cập nhật khi nhiều tab ghi gần nhau.
- License/trial/lease phải release khi stop/close; trạng thái heartbeat hiện chưa được coi là đã hoàn tất vì đang bị tắt trong source.
