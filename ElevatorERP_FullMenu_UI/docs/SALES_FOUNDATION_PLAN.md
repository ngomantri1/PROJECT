# Sales Foundation Plan

## Mục tiêu

Giai đoạn 1 chuẩn hóa luồng kinh doanh nền tảng để hệ thống quản lý đúng quan hệ giữa khách hàng, đăng ký tư vấn, báo giá, hợp đồng và KPI kinh doanh.

Phạm vi đã duyệt:

- Đổi `Đăng ký khách hàng` thành `Đăng ký tư vấn`.
- Tách/chuẩn hóa `Khách hàng` và `Đăng ký tư vấn`.
- Báo giá gắn với `Đăng ký tư vấn`.
- KPI kinh doanh tính theo `Đăng ký tư vấn hợp lệ`.

## Thuật ngữ

### Khách hàng

`Khách hàng` là dữ liệu master định danh cá nhân hoặc doanh nghiệp. Một khách hàng chỉ nên tồn tại một lần trong hệ thống.

Khách hàng lưu:

- tên cá nhân/doanh nghiệp;
- số điện thoại, email, mã số thuế nếu có;
- khu vực, địa chỉ liên hệ;
- người phụ trách hiện tại nếu cần;
- lịch sử đăng ký tư vấn, báo giá, hợp đồng và thang đã chốt.

### Đăng ký tư vấn

`Đăng ký tư vấn` là một nhu cầu thang máy/công trình cụ thể của khách hàng. Đây là đơn vị chính để quản lý pipeline kinh doanh và tính KPI tư vấn.

Một khách hàng có thể có nhiều đăng ký tư vấn theo thời gian.

Đăng ký tư vấn lưu:

- khách hàng liên quan;
- loại khách tại thời điểm tạo hồ sơ: khách mới hoặc khách cũ phát sinh nhu cầu mới;
- nguồn khách;
- nhân viên phụ trách;
- phòng ban/chi nhánh phụ trách;
- ngày tiếp nhận;
- địa chỉ công trình;
- nhu cầu thang máy và thông số kỹ thuật sơ khai;
- tài liệu/ảnh khảo sát;
- lịch sử chăm sóc/tư vấn;
- báo giá;
- hợp đồng nếu chốt;
- trạng thái và thông tin tính KPI.

### Báo giá

`Báo giá` gắn với một đăng ký tư vấn. Một đăng ký tư vấn có thể có nhiều phiên bản báo giá.

Báo giá được tạo từ:

- thông tin khách hàng;
- đăng ký tư vấn;
- thông số kỹ thuật sơ khai;
- danh mục hạng mục báo giá;
- số lượng, đơn giá, chiết khấu, VAT và điều kiện thương mại.

### Hợp đồng

`Hợp đồng` được tạo từ báo giá đã chốt hoặc đăng ký tư vấn đã được khách đồng ý. Hợp đồng là cơ sở tính doanh số và hoa hồng.

Khi hợp đồng thành công, thông số thang được chốt thành dữ liệu tham khảo/tài sản phục vụ dự án, bảo hành và bảo trì. Không sửa/xóa trực tiếp dữ liệu đã chốt; nếu cần thay đổi phải dùng phụ lục hoặc quy trình điều chỉnh.

## Luồng dữ liệu mục tiêu

```text
Khách hàng
  ├── Đăng ký tư vấn 1
  │     ├── Thang tư vấn / thông số kỹ thuật sơ khai 1..n
  │     ├── Tài liệu / ảnh khảo sát
  │     ├── Lịch chăm sóc / hoạt động tư vấn
  │     ├── Báo giá v1..n
  │     └── Hợp đồng nếu chốt
  │
  ├── Đăng ký tư vấn 2
  │     └── ...
  │
  └── Thang đã ký hợp đồng / tài sản 1..n
        ├── Thông số đã chốt
        ├── Hợp đồng liên quan
        └── Bảo hành / bảo trì
```

## Menu kinh doanh đề xuất

```text
Kinh doanh
  ├── Tổng quan kinh doanh
  ├── Khách hàng
  ├── Đăng ký tư vấn
  ├── Lịch chăm sóc
  ├── Báo giá
  └── Hợp đồng
```

Giai đoạn 1 tập trung vào `Khách hàng`, `Đăng ký tư vấn`, `Báo giá` và KPI nền tảng. `Tổng quan kinh doanh` có thể triển khai sau khi dữ liệu đăng ký tư vấn đã chuẩn.

## Luồng khách hàng mới

1. Vào `Đăng ký tư vấn`.
2. Bấm `Đăng ký tư vấn`.
3. Nhập số điện thoại/tên khách hàng.
4. Hệ thống kiểm tra trùng khách hàng theo số điện thoại, email hoặc mã số thuế.
5. Nếu chưa có khách hàng:
   - tạo khách hàng mới;
   - tạo đăng ký tư vấn đầu tiên cho khách hàng;
   - ghi nhận loại hồ sơ là `Khách mới`.
6. Nhập nhu cầu thang máy, thông số kỹ thuật sơ khai, địa chỉ công trình, ảnh/tài liệu khảo sát.
7. Hồ sơ được tính KPI nếu thỏa điều kiện hợp lệ.

## Luồng khách hàng cũ

1. Vào `Đăng ký tư vấn`.
2. Bấm `Đăng ký tư vấn`.
3. Nhập số điện thoại/tên khách hàng.
4. Hệ thống gợi ý khách hàng đã tồn tại.
5. Chọn khách hàng cũ.
6. Hệ thống hiển thị lịch sử tham khảo:
   - đăng ký tư vấn trước đây;
   - thang đã ký hợp đồng;
   - báo giá/hợp đồng liên quan;
   - lịch chăm sóc.
7. Nếu khách có nhu cầu thang máy/công trình mới:
   - tạo đăng ký tư vấn mới;
   - ghi nhận loại hồ sơ là `Khách cũ phát sinh nhu cầu mới`;
   - hồ sơ mới được tính KPI nếu hợp lệ.
8. Nếu khách chỉ hỏi lại báo giá/hồ sơ cũ:
   - không tạo đăng ký tư vấn mới;
   - cập nhật hoạt động chăm sóc hoặc báo giá trong hồ sơ đang mở.

## Quy tắc KPI kinh doanh

KPI tư vấn không tính theo số khách hàng thuần và không tính theo số phiên bản báo giá. KPI tính theo:

```text
Số đăng ký tư vấn hợp lệ trong kỳ
```

Một đăng ký tư vấn hợp lệ tính `1 KPI` khi có đủ:

- khách hàng rõ ràng;
- nhân viên phụ trách;
- ngày tiếp nhận nằm trong kỳ tính KPI;
- nhu cầu thang máy/công trình cụ thể;
- không bị đánh dấu test, trùng hoặc hủy nhầm;
- có hoạt động tư vấn thực tế hoặc đã tạo/gửi báo giá.

Không cộng thêm KPI khi:

- sửa báo giá;
- gửi báo giá phiên bản 2, 3;
- gọi chăm sóc nhiều lần cùng một nhu cầu;
- bổ sung ảnh/tài liệu;
- cập nhật lại thông số kỹ thuật trong cùng hồ sơ.

Cộng KPI mới khi:

- khách mới phát sinh nhu cầu thang máy đầu tiên;
- khách cũ phát sinh nhu cầu thang máy/công trình mới;
- hồ sơ cũ đã chốt/thua/không nhu cầu và sau này khách phát sinh nhu cầu mới thật sự.

## Báo giá gắn với đăng ký tư vấn

Quy tắc:

- Báo giá phải có `ConsultationProfileId`.
- Một đăng ký tư vấn có thể có nhiều báo giá.
- Mỗi báo giá có nhiều dòng hạng mục.
- Chỉ một báo giá được đánh dấu là báo giá chốt tại một thời điểm.
- Gửi báo giá là bằng chứng đủ mạnh để đăng ký tư vấn được tính KPI, nhưng không tạo thêm KPI mới nếu gửi nhiều phiên bản.

Luồng:

```text
Đăng ký tư vấn
  → Tạo báo giá
  → Chọn hạng mục báo giá
  → Hệ thống tự tính tổng tiền
  → Lưu nháp / gửi / duyệt
  → Chốt thành hợp đồng nếu khách đồng ý
```

## Hợp đồng và dữ liệu thang đã chốt

Khi hợp đồng thành công:

- đăng ký tư vấn chuyển trạng thái `Chốt hợp đồng`;
- báo giá chốt chuyển trạng thái `Đã chốt`;
- tạo hợp đồng;
- tạo dữ liệu thang đã ký hợp đồng/tài sản khách hàng;
- dữ liệu kỹ thuật đã chốt bị khóa sửa/xóa trực tiếp;
- doanh số và hoa hồng được tính từ hợp đồng hợp lệ.

## Trạng thái đăng ký tư vấn

Đề xuất trạng thái:

- `Mới tiếp nhận`
- `Đã liên hệ`
- `Đang tư vấn`
- `Đã khảo sát`
- `Đã gửi báo giá`
- `Đàm phán`
- `Chốt hợp đồng`
- `Không nhu cầu`
- `Tạm dừng`
- `Hủy/trùng`

## Gợi ý entity/API cho giai đoạn triển khai

Entity cần chuẩn hóa hoặc bổ sung:

- `Customer`
- `ConsultationProfile`
- `ConsultationElevator`
- `CustomerAttachment`
- `CareActivity`
- `Quotation`
- `QuotationLine`
- `Contract`
- `ContractElevator` hoặc `ElevatorAsset`

API cần có:

- `GET /customers`
- `GET /customers/{id}`
- `POST /customers`
- `PUT /customers/{id}`
- `GET /consultation-profiles`
- `POST /consultation-profiles`
- `GET /consultation-profiles/{id}`
- `PUT /consultation-profiles/{id}`
- `POST /consultation-profiles/{id}/close`
- `POST /consultation-profiles/{id}/reopen`
- `GET /quotations?consultationProfileId=...`
- `POST /consultation-profiles/{id}/quotations`

## Tiêu chí hoàn thành Giai đoạn 1

- Menu `Đăng ký khách hàng` được đổi thành `Đăng ký tư vấn`.
- Có màn danh sách `Khách hàng` hoặc ít nhất API/data model tách khách hàng khỏi đăng ký tư vấn.
- Tạo đăng ký tư vấn cho khách mới tự tạo khách hàng nếu chưa tồn tại.
- Tạo đăng ký tư vấn cho khách cũ không tạo trùng khách hàng.
- Báo giá gắn với đăng ký tư vấn.
- KPI tháng đếm theo đăng ký tư vấn hợp lệ.
- Thang đã chốt hợp đồng chỉ để xem/tham khảo, không sửa/xóa trực tiếp trong đăng ký tư vấn mới.
