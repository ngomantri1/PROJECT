# Giai đoạn 1 — Đóng băng và chuyển WPF cũ

## Nguồn chuẩn chỉ đọc

- `D:\PROJECT\ABXHubSolution\BaccaratSexyCasino2`
- Không có file nào trong project nguồn bị sửa trong giai đoạn này.

## Đích

- `D:\PROJECT\BaccaratChromeAgent\src\BaccaratChromeAgent.Desktop`
- Assembly/EXE: `BaccaratChromeAgent.Desktop`
- Namespace nghiệp vụ tạm giữ nguyên: `BaccaratSexyCasino2`
- Dữ liệu cục bộ tách riêng tại `%LOCALAPPDATA%\BaccaratChromeAgent`

## Thành phần đã chuyển

- `MainWindow.xaml`
- `MainWindow.xaml.cs`
- `MainWindow.Startup.cs`
- `MainWindow.EmbedMode.cs`
- `App.xaml`
- `App.xaml.cs`
- `Models.cs`
- `SeqIconVM.cs`
- `ProgressWidthConverter.cs`
- toàn bộ `Tasks`
- `Views`
- các ảnh/icon trong `Assets`

## Thành phần chủ động không chuyển

- `ThirdParty`
- Fixed WebView2 Runtime và ZIP
- `v4_js_xoc_dia_live.js`
- các devtool JavaScript
- `WebView2LiveBridge.cs`
- plugin/ABX Hub bootstrap

Gói NuGet `Microsoft.Web.WebView2` chỉ được giữ tạm để code-behind cũ biên
dịch trong giai đoạn 1. Khởi tạo WebView2, điều hướng và nhúng JavaScript cũ
đều bị chặn tại `Window_Loaded`. Giai đoạn 2 sẽ thay các điểm gọi này bằng
`ChromeGameBridge`.

## Bảo toàn bộ khung Desktop trước khi chuyển

Bộ khung Desktop/Native Host UI trước giai đoạn 1 được lưu tại:

`D:\PROJECT\BaccaratChromeAgent\migration\stage0-desktop-skeleton`

## Kiểm chứng

Lệnh build không đụng output đang bị Visual Studio khóa:

```powershell
dotnet build .\src\BaccaratChromeAgent.Desktop\BaccaratChromeAgent.Desktop.csproj `
  -c Debug `
  -p:OutDir=D:\PROJECT\BaccaratChromeAgent\artifacts\stage1-build\
```

Kết quả kiểm chứng ngày 26/07/2026:

- Build thành công: 0 lỗi.
- Smoke test: tiến trình mở ổn định trên 5 giây.
- Tiêu đề cửa sổ WPF cũ được tạo thành công.
- Không phát sinh fatal log.
- Không khởi tạo/điều hướng WebView2.
- Chưa nhận snapshot từ Chrome; đây là phạm vi Giai đoạn 2.

## Cảnh báo hiện tại

Code nguồn cũ còn nhiều cảnh báo nullable/unreachable. Chúng được giữ nguyên
để không thay đổi nghiệp vụ trong giai đoạn sao chép. Không được sửa hàng loạt
các cảnh báo này trước khi có golden test và lớp bridge tương thích.
