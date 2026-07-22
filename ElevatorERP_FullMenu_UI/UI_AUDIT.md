# UI AUDIT — Elevator ERP

> Ngày rà soát: 2026-07-21  
> Phạm vi: frontend hiện tại, đối chiếu `Elevator ERP UI Standard.docx`, `DESIGN.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `TODO.md` và `BUGS.md`.  
> Trạng thái: Phase 1 hoàn tất ở mức source audit; điểm số là điểm hiện trạng, chưa phải chứng nhận đạt chuẩn.

## 1. Kết luận nhanh

Project đã có nền ERP/Admin Shell tốt: shell dùng chung không remount theo route, menu desktop accordion, mobile drawer, light/dark theme, primary action đặt tại page header, table/card responsive và Ant Design/ProComponents được giữ nguyên.

Project **chưa đạt ngưỡng 92/100** của checklist. Các khoảng trống chính:

1. Design token chưa thực sự là nguồn duy nhất. `ConfigProvider` tồn tại nhưng `globals.css` vẫn override sâu class nội bộ Ant Design.
2. Status mapping, format ngày/tiền, loading/empty/error và page structure còn lặp giữa module.
3. Nhiều màn hình thiếu error state có nút retry, permission-denied state, dirty-form guard và lưu trạng thái filter/pagination.
4. Bảng API hiện vẫn tải toàn bộ dữ liệu về client rồi sort/filter/paginate.
5. Customer 360 còn lỗi nghiệp vụ nghiêm trọng: có thể gây nhầm **Cấu hình tư vấn** với **Thang máy tài sản**.
6. Nhiều icon-only action chưa có accessible name rõ nghĩa; reduced-motion trước audit chưa được xử lý.
7. 38 workspace mô phỏng dùng `localStorage`; không được xem là module nghiệp vụ đã hoàn thành.

## 2. Số liệu source audit

| Hạng mục | Hiện trạng |
|---|---:|
| File TS/TSX/CSS frontend | 17 TSX, 1 CSS chính |
| `globals.css` | 1.141 dòng |
| Màu hex trong `globals.css` | khoảng 460 |
| Selector override `.ant-*` | khoảng 588 |
| `!important` | khoảng 436 |
| Font weight ngoài 400/600 | khoảng 45 |
| Inline `style={{...}}` | khoảng 16 |
| Điểm lặp status/font-weight tìm thấy | khoảng 107 |

Các số liệu trên không đồng nghĩa mọi occurrence đều sai. Chúng chỉ ra rằng theme token chưa kiểm soát được phần lớn giao diện và chi phí hồi quy khi nâng Ant Design sẽ cao.

## 3. Danh sách màn hình và điểm hiện trạng

Điểm theo trọng số checklist: shell/navigation 15, token/consistency 15, table 20, form 15, feedback 10, responsive 10, accessibility 10, performance 5.

| Màn hình / nhóm | Component chính | Điểm | Vấn đề chính |
|---|---|---:|---|
| Login `/login` | Ant Form, Input, Alert | 84 | Giao diện tốt nhưng chứa sẵn demo credential; chưa có reset password; chưa kiểm tra đầy đủ contrast/focus 5 viewport |
| Dashboard `/` | PageContainer, ProCard, Progress | 87 | Responsive tốt; màu chart hard-code; loading dùng Spin thay vì Skeleton gần layout; một số phần mang tính trang trí nhiều hơn tác vụ |
| Shell dùng chung | ProLayout, Menu, Dropdown | 86 | Kiến trúc đúng; breadcrumb bị tắt toàn cục; màu ProLayout hard-code; chưa có Help action như checklist; route permission chưa đầy đủ |
| Khách hàng `/business/customers` | PageContainer, ProTable, Drawer | 82 | Cấu trúc list đúng; thiếu error/retry rõ; client pagination/sort; action icon cần audit aria; status chưa dùng registry chung trước patch |
| Đăng ký tư vấn `/customers` | ProTable, DrawerForm, Tabs/sections, Map modal | 76 | File 2.940 dòng; form/map rất phức tạp; thiếu dirty guard; nhiều CSS riêng và icon-only action; khó bảo trì và có nguy cơ phá ownership nghiệp vụ |
| Customer 360 | Tabs, Table, Card, Timeline | 69 | Lỗi nghiêm trọng về count/label cấu hình tư vấn và tài sản; tab công nợ/tiến độ/bảo trì còn placeholder; initial loading là Spin; tabs override `.ant-*` sâu |
| Chăm sóc `/care` | ProTable, Calendar, DrawerForm | 79 | Có list/calendar/mobile; thiếu bộ filter API đầy đủ; `+n lịch khác` chưa mở chi tiết; chưa tạo lịch tiếp theo; error chỉ là toast, không có retry state |
| Báo giá `/quotations` | ProTable, Drawer, Form | 75 | Form dài trong Drawer, client-side pagination/sort, thiếu dirty guard/error-retry; status mapping riêng; chưa đủ permission-aware action |
| Người dùng `/admin/users` | ProTable, Select, List | 78 | Có loading/mobile; thiếu error panel retry và guard tự gỡ vai trò admin cuối; permission state chưa tách rõ |
| Danh mục `/admin/catalogs` | Card/List/Table/Form | 79 | Cấu trúc khá rõ; style/status/category tag còn trộn; error/retry và responsive cần test đủ viewport |
| 38 workspace mô phỏng | ModuleWorkspace, ProTable, DrawerForm | 64 | UI pattern khá đồng nhất nhưng dữ liệu localStorage, không có API/schema/permission/audit; không có loading/error/retry thật; filter/pagination không được bảo toàn theo URL |

Không màn hình nào được đánh dấu hoàn thành vì chưa đạt 92/100 và chưa qua toàn bộ kiểm tra thủ công theo checklist.

## 4. Đối chiếu checklist

### Đã làm đúng hoặc gần đúng

- Giữ Ant Design 5 và ProComponents; không thêm UI library.
- Shell được đặt trong shared authenticated frame; `/login` nằm ngoài shell.
- Desktop sidebar có collapse và một nhóm top-level mở tại một thời điểm; mobile dùng drawer.
- Primary create action nằm ở page header; filter bar không chứa nút tạo mới.
- List page chính có KPI, filter, table/card mobile, export và pagination UI.
- Table đặt nhận dạng bên trái, action bên phải; tiền căn phải ở các bảng có giá trị.
- Search khách hàng có debounce; filter nâng cao dùng Drawer.
- Light/dark theme được quản lý bằng `ConfigProvider` và lưu lựa chọn.
- Không có horizontal overflow ở kiểm tra nhanh dashboard và báo giá tại 360 px.
- Login input có label; shell notification/account button có `aria-label`.

### Chưa đạt và cần sửa

#### P0 — sai nghiệp vụ hoặc an toàn

- `frontend/src/app/business/customers/[id]/page.tsx`: tách rõ count/label **Cấu hình tư vấn** và **Thang máy tài sản**; link cấu hình về hồ sơ nguồn.
- `frontend/src/components/AppShell.tsx`: mọi route cần permission metadata trước khi nối dữ liệu thật; menu visibility không thay backend authorization.
- Màn hình form dài: thêm dirty-form guard, giữ dữ liệu khi API lỗi và disable/loading khi submit.

#### P1 — foundation dùng chung

- `frontend/src/components/AppProviders.tsx`: chuẩn hóa typography, 32 px control, radius 6/8 và weight 400/600 bằng token.
- `frontend/src/app/globals.css`: giảm dần hard-code, `.ant-*` và `!important`; chuyển màu/surface/spacing sang semantic token.
- `frontend/src/components/AppStatusTag.tsx`: dùng registry chung cho status code; text luôn đi cùng màu.
- Tạo formatter dùng chung cho tiền, số lượng, ngày và thời gian; hiện logic còn lặp ở customer, quotation, care, Customer 360 và workspace.
- Tạo shared state components cho initial loading, empty, no-result, error/retry và permission denied.

#### P1 — table/search

- Chuyển bảng lớn sang server pagination/filter/sort; hiện đa số API list load toàn bộ rồi xử lý client.
- Đồng bộ filter/pagination với URL để quay lại từ detail không mất trạng thái.
- Nội dung dài cần ellipsis + Tooltip có hệ thống, không xử lý tùy trang.
- Mọi icon-only action cần `aria-label`; destructive action phải confirm ở đúng trigger, không lồng Popconfirm trong Dropdown label nếu hành vi bàn phím không ổn định.

#### P1 — responsive/accessibility

- Kiểm tra đủ 360×800, 390×844, 768×1024, 1366×768, 1920×1080 cho từng module thật.
- Chuẩn hóa mobile target 40–44 px cho tác vụ chính; tối thiểu WCAG là 24×24 px.
- Thêm focus-visible cho custom native button và tôn trọng `prefers-reduced-motion`.
- Kiểm tra contrast dark theme, đặc biệt text phụ, tag trạng thái và selected menu.
- Dùng Skeleton cho initial content loading; Spin chỉ cho vùng cục bộ.

## 5. Component trùng và điểm cần gom

| Pattern lặp | Vị trí điển hình | Shared target |
|---|---|---|
| Status map + `<Tag>` | care, quotations, customers, Customer 360, users, workspace | `AppStatusTag` + registry |
| Format VND | quotations, Customer 360, workspace | `AppMoneyText` / `formatMoney` |
| Format ngày | tất cả list/detail | `AppDateTimeText` / formatter |
| Page header hai dòng | customer, care, quotation, workspace | `AppPageHeader` |
| KPI card | dashboard và các list page | `AppKpiCard` |
| Filter toolbar | customer, care, quotation, workspace | `AppSearchToolbar` |
| Desktop table/mobile card | mọi list page | `AppDataTable` hoặc wrapper pattern |
| Loading/error/empty | xử lý khác nhau theo trang | `AppLoadingState`, `AppErrorState`, `AppEmptyState` |
| Form section/footer | nhiều DrawerForm | `AppFormSection`, `AppFormFooter` |
| Địa chỉ + pin | customer consultation/configuration | `AppAddressWithMap` |

Không nên tạo toàn bộ component trên cùng một patch. Ưu tiên theo số màn hình hưởng lợi và mức rủi ro: token → status/formatter → state → page/table wrapper → form/map.

## 6. Patch nền tối thiểu đã áp dụng

- Chuẩn hóa token mặc định tại `AppProviders.tsx`: font 14, strong 600, control 32, radius 6/8, card padding 24 và system font stack.
- Giữ primary xanh `#008848` vì đây là brand direction đã được duyệt trong `PROJECT_CONTEXT.md`; không ép project quay về primary xanh dương mặc định của Ant Design.
- Thêm `AppStatusTag` và registry status dùng chung; áp dụng vào workspace và các trang thật có status chính.
- Thêm accessible name cho nút row-action dùng chung của 38 workspace.
- Đưa background layout về CSS semantic variable, khôi phục focus-visible cho account trigger và thêm `prefers-reduced-motion`.

## 7. Patch tiếp theo nhỏ nhất được khuyến nghị

1. Sửa Customer 360 count/label/link nguồn (một file UI và DTO nếu API chưa đủ trường).
2. Tạo `lib/formatters.ts`, thay thế formatter lặp ở bốn bề mặt chính.
3. Tạo `AppErrorState` có Retry và áp dụng trước cho customer, quotation, care, users.
4. Tách `globals.css` theo shell/table/form/map nhưng chưa đổi selector; sau đó mới thay dần hard-code bằng token.
5. Bổ sung aria-label cho icon-only action theo từng module và test keyboard.

## 8. Kiểm tra thủ công còn bắt buộc

- Visual regression ở đủ năm viewport cho light và dark.
- Keyboard-only: menu, table action dropdown, Drawer/Modal, form validation và focus return.
- Screen reader: label form, error announcement, status text, icon-only action.
- Dirty form khi đóng Drawer/đổi route.
- Loading/empty/no-result/request-failed/permission-denied cho từng API page.
- Không nhầm cấu hình tư vấn với tài sản vật lý trong Customer 360.
