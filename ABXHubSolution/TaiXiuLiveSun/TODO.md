# TODO

> Ghi chú: mục này được suy ra từ source code và kết quả build hiện tại, không phải từ issue tracker chính thức.

## Task Đang Làm

- Ổn định bridge `WebView2` + JS inject cho nhiều document/frame.
- Duy trì bộ chiến lược lớn trên cùng một runtime snapshot.
- Giữ tương thích 2 mode chạy:
  - plugin cho ABX Hub
  - app standalone single-file

## Task Chưa Hoàn Thành

- Giảm warning build hiện tại, đặc biệt nhóm nullability.
- Loại bỏ dead code/unreachable code còn sót.
- Chuẩn hóa service layer cho:
  - config/stats
  - license/trial/lease
  - bet history
  - WebView/JS bridge
- Tách bớt `MainWindow.xaml.cs` thành module nhỏ hơn.
- Bổ sung contract rõ cho message `abx:*`.

## Task Cần Refactor

- Tách `MainWindow.xaml.cs` theo domain:
  - web runtime
  - strategy runtime
  - persistence
  - licensing
  - history/stats
- Đưa registry chiến lược ra khỏi `switch` trong `PlayXocDia_Click`.
- Gom logic money management vào một abstraction duy nhất; hiện đang có `MoneyManager` và `MoneyHelper`.
- Bỏ hidden dependency của `TaskUtil` vào `MainWindow.ResetBetMiniPanel_External`.
- Chuẩn hóa path/runtime lookup cho single-file publish, tránh phụ thuộc `Assembly.Location`.

## Task Ưu Tiên Cao

- Sửa logic `PlaceBet` hiện coi enqueue là thành công dù JS có thể fail click/bet.
- Rà lại các strategy `N/I` khi `totals` chưa sẵn hoặc null.
- Giảm rủi ro deploy Release single-file do path lookup.
- Kiểm tra lại login/autofill vì sync autofill đang bị short-circuit.
- Giảm rủi ro drift giữa pending history và kết quả thật.

## Task Cần Test Lại

- Startup flow trên:
  - `Debug` plugin mode
  - `Release` standalone mode
- Boot game từ Home -> vào live -> inject -> start push.
- Finalize pending bet khi:
  - 1 cửa
  - multi-side (`JackpotMultiSideTask`)
- Các strategy dùng `N/I` và `MultiChain`.
- License/trial:
  - acquire
  - heartbeat
  - expiry
  - release
- Pagination/history load từ `bets-*.csv`.
- Resource fallback ảnh/icon khi chạy trong Hub và single-file.

