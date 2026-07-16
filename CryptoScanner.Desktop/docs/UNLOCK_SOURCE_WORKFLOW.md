# V1.12 - Unlock Source Workflow

Mục tiêu của V1.12 là chuẩn bị quy trình lấy dữ liệu unlock thật từ nguồn ngoài rồi đưa vào converter V1.11.

V1.12 vẫn không gọi API trong scanner, không scrape website và không tự động ghi vào AppData. Scanner chỉ đọc `unlock-cache.json` đã import.

## Trạng thái dữ liệu

| Loại dữ liệu | Mục đích | Được dùng để đầu tư? |
| --- | --- | --- |
| `test-data/unlock-import/*.json` | Test importer/scanner | Không |
| `manual-real-unlock-test.csv` | Test converter workflow | Không |
| CSV do người dùng tạo từ nguồn thật | Intake dữ liệu thật | Chỉ sau khi kiểm chứng nguồn |

## Nguồn được chấp nhận

Ưu tiên:

1. API chính thức hoặc export chính thức của nhà cung cấp dữ liệu.
2. File CSV/JSON người dùng tải thủ công từ nguồn có thể kiểm chứng.
3. Tài liệu tokenomics chính thức của dự án, nếu có lịch unlock rõ ràng.

Không ưu tiên:

- Scrape HTML.
- Ảnh chụp màn hình không có số liệu máy đọc được.
- Bài viết không ghi mẫu số tính phần trăm.
- Dữ liệu chỉ có symbol nhưng không có identity rõ ràng.

## CSV chuẩn cho converter

Các cột bắt buộc:

```text
coin_id,symbol,unlock_30d_pct,unlock_90d_pct
```

Các cột khuyến nghị:

```text
next_unlock_at,percentage_basis,source,source_url,verified_at,confidence
```

Ví dụ:

```csv
coin_id,symbol,unlock_30d_pct,unlock_90d_pct,next_unlock_at,percentage_basis,source,source_url,verified_at,confidence
celestia,TIA,1.2,2.4,2026-08-15T00:00:00+00:00,CURRENT_CIRCULATING_SUPPLY,MANUAL_REAL_DATA,https://example.com/source,2026-07-16T04:30:00+07:00,LOW
```

## Quy tắc tính phần trăm

V1.12 tiếp tục dùng quy ước của V1.11:

```text
unlock_30d_pct = token unlock trong 30 ngày tới / circulating supply tại thời điểm thu thập
unlock_90d_pct = token unlock trong 90 ngày tới / circulating supply tại thời điểm thu thập
```

Nếu nguồn dùng mẫu số khác, không trộn trực tiếp vào CSV. Cần chuyển đổi hoặc bỏ qua.

## Coin không có lịch unlock

- Không thêm item nếu không có dữ liệu đáng tin.
- Không tự điền `0` nếu nguồn không xác nhận rõ là không có unlock.
- Scanner sẽ coi coin đó là `UNLOCK_UNKNOWN`.

## Coin không match

Nếu import thành công nhưng Health hiển thị `LOCAL_CACHE 0/{candidate_count}`:

1. Kiểm tra `coin_id` có đúng CoinGecko ID không.
2. Kiểm tra `symbol` có đúng ticker không.
3. Kiểm tra coin đó có nằm trong candidate list của lần scan không.
4. Không sửa bằng cách đoán symbol nếu có rủi ro trùng asset.

## Workflow đề xuất

1. Tạo CSV theo format chuẩn.
2. Chạy converter:

```powershell
dotnet run --project .\Tools\UnlockCacheConverter -- `
  --input .\data-source\unlock-real.csv `
  --output .\data-source\unlock-cache.generated.json `
  --updated-at 2026-07-16T04:30:00+07:00
```

3. Import `unlock-cache.generated.json` bằng app.
4. Chạy scanner.
5. Kiểm tra:

```text
Unlock: LOCAL_CACHE x/{candidate_count}
History: Saved
```

6. Lưu lại CSV nguồn và JSON generated để audit.

## Tiêu chí chốt V1.12

- Có ít nhất một CSV real-data do người dùng tạo từ nguồn đã ghi rõ.
- Converter tạo JSON thành công.
- App import JSON thành công.
- Scanner match ít nhất một coin có trong candidate list.
- Snapshot/history lưu thành công.
- Tài liệu ghi rõ nguồn, ngày lấy dữ liệu và mẫu số phần trăm.

