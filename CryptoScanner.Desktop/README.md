# Crypto Scanner Desktop V1

## Yêu cầu
- Windows 10/11
- Visual Studio 2026 hoặc .NET 10 SDK với workload **.NET desktop development**.

## Chạy
1. Mở `CryptoScannerDesktopV1.sln`.
2. Chọn `CryptoScanner.Desktop` làm Startup Project.
3. Restore/build rồi nhấn F5.
4. Nhấn **QUÉT THỊ TRƯỜNG**.
5. Nhấn **XUẤT JSON** để tạo file trong thư mục `exports`.

## V1 đã có
- Giao diện WPF dark dashboard.
- CoinGecko: market cap, FDV, volume, circulating supply.
- Binance: cặp USDT, volume, nến H4/D1.
- RSI, EMA, market regime, setup cơ bản.
- Lọc Market Cap 100M–900M; volume >=10M; FDV/MC <=3; circulating >=40%.
- Chấm điểm ban đầu và xuất snapshot JSON.

## Giới hạn V1
- Chưa tích hợp unlock, GitHub, DefiLlama, tin tức và order-book spread.
- Mapping CoinGecko symbol → Binance symbol có thể sai với ticker trùng tên.
- Score là phiên bản kỹ thuật ban đầu, chưa phải khuyến nghị đầu tư.
- API công khai có thể rate-limit; cần thêm cache/retry trong V1.1.

## Lệnh build
```powershell
dotnet restore
dotnet build -c Release
```
