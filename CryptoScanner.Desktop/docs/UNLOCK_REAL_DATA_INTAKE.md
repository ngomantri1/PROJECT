# V1.11 - Real Unlock Data Intake & Normalization

Mục tiêu của V1.11 là chuẩn hóa dữ liệu unlock lấy từ nguồn bên ngoài thành `unlock-cache.json` mà CryptoScanner đã đọc được.

V1.11 không tự gọi API, không scrape website, không nhúng trình duyệt và không biến file test thành dữ liệu thật.

## Phân biệt dữ liệu test và dữ liệu thật

Các file trong `test-data/unlock-import` dùng để kiểm thử kỹ thuật:

- `valid-unlock-cache.json`: dữ liệu hợp lệ có kiểm soát để test `LOCAL_CACHE`.
- `invalid-json-unlock-cache.json`: dữ liệu lỗi để test import failure.
- `expired-unlock-cache.json`: dữ liệu hết hạn để test `LOCAL_CACHE_EXPIRED`.

Những file này không phải dữ liệu unlock thật và không được dùng để ra quyết định đầu tư.

Khi tài liệu ghi `LOCAL_CACHE 3/{candidate_count}`, điều đó chỉ chứng minh pipeline cache/import/provider hoạt động. Nó không chứng minh dữ liệu unlock là chính xác.

## Schema cache hiện tại

Importer hiện hỗ trợ schema:

```json
{
  "schema_version": "1.0",
  "updated_at": "2026-07-15T12:00:00+07:00",
  "max_cache_age_hours": 72,
  "items": []
}
```

Các field bắt buộc ở cấp root:

- `schema_version`: phải là `"1.0"`.
- `updated_at`: thời điểm dữ liệu được cập nhật/chuẩn hóa.
- `items`: danh sách coin unlock.

Các field khuyến nghị ở cấp root:

- `max_cache_age_hours`: số giờ cache còn được coi là mới.

Không thêm field root mới bắt buộc trong V1.11 nếu chưa nâng schema. Parser hiện có thể bỏ qua property bổ sung, nhưng validator chỉ đảm bảo hợp đồng schema `1.0`.

## Item schema

Mỗi item nên có:

```json
{
  "coin_id": "celestia",
  "symbol": "TIA",
  "unlock_30d_pct": 1.2,
  "unlock_90d_pct": 2.4,
  "next_unlock_at": "2026-08-15T00:00:00+00:00",
  "percentage_basis": "CURRENT_CIRCULATING_SUPPLY",
  "source": "MANUAL",
  "source_url": "https://example.com/source",
  "verified_at": "2026-07-15T12:00:00+07:00",
  "confidence": "MEDIUM"
}
```

Bắt buộc:

- Có ít nhất một trong hai field: `coin_id` hoặc `symbol`.
- `unlock_30d_pct` trong khoảng 0-100.
- `unlock_90d_pct` trong khoảng 0-100.
- `unlock_90d_pct >= unlock_30d_pct`.

Khuyến nghị:

- Luôn có `coin_id` CoinGecko.
- Luôn có `symbol` để người dùng đọc dễ hơn.
- Có `percentage_basis`, `source`, `source_url`, `verified_at`, `confidence` để kiểm toán nguồn.

## Ý nghĩa phần trăm

Trong V1.11, quy ước đề xuất cho scoring:

```text
unlock_30d_pct = phần trăm token dự kiến unlock trong 30 ngày tới
                 so với circulating supply tại thời điểm dữ liệu được thu thập.

unlock_90d_pct = phần trăm token dự kiến unlock trong 90 ngày tới
                 so với circulating supply tại thời điểm dữ liệu được thu thập.
```

`percentage_basis` nên ghi:

```text
CURRENT_CIRCULATING_SUPPLY
```

Không trộn dữ liệu dùng mẫu số khác nhau như max supply, total supply, FDV hoặc lượng token còn khóa. Nếu nguồn không nói rõ mẫu số, không nên import vào cache thật.

## Identity mapping

Ưu tiên định danh:

1. `coin_id` CoinGecko.
2. `symbol` chỉ là fallback.

Lý do: symbol có thể trùng giữa nhiều dự án. Không tự suy đoán coin nếu chỉ có symbol và có khả năng nhầm asset.

V1.11 chưa bắt buộc `contract` hoặc `network`, nhưng nên ghi chú nguồn nếu symbol có rủi ro trùng.

## Quy trình thủ công an toàn

1. Lấy dữ liệu unlock từ nguồn bên ngoài.
2. Ghi lại ngày lấy dữ liệu.
3. Chuẩn hóa coin identity sang CoinGecko `coin_id`.
4. Tính `unlock_30d_pct` và `unlock_90d_pct` theo `CURRENT_CIRCULATING_SUPPLY`.
5. Tạo file theo template `test-data/unlock-import/real-data-template.json`.
6. Import bằng nút `IMPORT UNLOCK`.
7. Chạy lại scanner.
8. Kiểm tra Health:

```text
Unlock: LOCAL_CACHE x/{candidate_count}
```

## Converter ngoài app chính

V1.11 có tool riêng:

```text
Tools/UnlockCacheConverter
```

Tool này chuyển CSV hoặc JSON đơn giản sang `unlock-cache.json` schema `1.0`.

Ví dụ:

```powershell
dotnet run --project .\Tools\UnlockCacheConverter -- `
  --input .\test-data\unlock-import\manual-real-unlock-test.csv `
  --output .\test-data\unlock-import\converted-unlock-cache.json `
  --updated-at 2026-07-16T04:30:00+07:00
```

Sau đó import `converted-unlock-cache.json` bằng nút `IMPORT UNLOCK`.

Converter không tự copy file vào AppData và không gọi API.

## Không làm trong V1.11

- Không scrape trực tiếp website.
- Không hardcode HTML selector.
- Không nhúng trình duyệt.
- Không tự đăng nhập website.
- Không gọi API unlock trong scanner.
- Không tự copy file vào AppData.
- Không dùng file test/fake để ra quyết định đầu tư.
