# BỘ QUY TRÌNH AI CODING ĐA PROJECT — V1.0

Bộ file này dùng chung cho đa số repository có source code, không phụ thuộc ngôn ngữ hoặc framework.

## 1. Mục tiêu

Giúp Codex hoặc AI coding:

- Hiểu project nhanh khi không có lịch sử chat.
- Không phụ thuộc vào bộ nhớ của một cuộc hội thoại.
- Đọc đúng tài liệu và source liên quan trước khi sửa.
- Giữ business rule, kiến trúc, trạng thái, TODO và bug xuyên nhiều phiên.
- Hạn chế lặp prompt dài và giảm lượng token phải đọc.
- Tiếp tục công việc chính xác khi chuyển sang chat mới.

## 2. Các file trong bộ này

| File | Khi dùng |
|---|---|
| `01_AGENTS_TEMPLATE.md` | Sao chép vào root mỗi repository và đổi tên thành `AGENTS.md` |
| `02_PROMPT_BOOTSTRAP_CONTEXT.txt` | Chạy một lần khi project chưa có bộ context hoặc cần xây dựng lại |
| `03_PROMPT_TASK_HANG_NGAY.txt` | Dùng để giao việc code hằng ngày |
| `04_PROMPT_SYNC_CONTEXT.txt` | Dùng khi chat sắp đầy hoặc còn quyết định chưa được lưu vào repository |
| `05_PROMPT_AUDIT_CONTEXT.txt` | Dùng sau milestone lớn hoặc sau nhiều task để rà soát context |
| `06_PROMPT_HANDOFF_KHONG_CO_REPOSITORY.txt` | Dùng cho chat không được truy cập trực tiếp repository |

## 3. Bộ context chuẩn tại root repository

Mỗi project nên có:

```text
AGENTS.md
PROJECT_CONTEXT.md
ARCHITECTURE.md
BUSINESS_RULES.md
CURRENT_STATE.md
TODO.md
BUGS.md
README.md
```

Có thể bổ sung khi project cần:

```text
docs/UI_DESIGN.md
docs/API.md
docs/DATABASE.md
docs/DEPLOYMENT.md
```

Không tạo nhiều bản trùng nhau ở các thư mục khác nếu repository chưa có quy ước riêng.

## 4. Quy trình cho project mới

### Bước 1 — Thêm `AGENTS.md`

Sao chép:

```text
01_AGENTS_TEMPLATE.md
```

vào root project và đổi tên thành:

```text
AGENTS.md
```

Có thể thay các placeholder như:

```text
<PROJECT_NAME>
<PROJECT_PURPOSE>
<PRIMARY_STACK>
```

Nếu chưa biết, có thể để AI điền sau khi phân tích repository.

### Bước 2 — Bootstrap context một lần

Mở Codex tại đúng repository root và chạy nội dung:

```text
02_PROMPT_BOOTSTRAP_CONTEXT.txt
```

AI sẽ tạo hoặc hợp nhất:

- `PROJECT_CONTEXT.md`
- `ARCHITECTURE.md`
- `BUSINESS_RULES.md`
- `CURRENT_STATE.md`
- `TODO.md`
- `BUGS.md`

Sau đó cần review và commit bộ tài liệu.

### Bước 3 — Giao task bình thường

Từ task tiếp theo, chỉ dùng:

```text
03_PROMPT_TASK_HANG_NGAY.txt
```

Không cần dán lại prompt “Khởi động chat mới” dài vì `AGENTS.md` đã điều hướng AI đọc context và source liên quan.

## 5. Quy trình hằng ngày

```text
Mở Codex tại repository root
→ Dán task bằng PROMPT_TASK_HANG_NGAY
→ AI đọc AGENTS.md và context liên quan
→ AI kiểm tra source/test liên quan
→ AI thực hiện patch tối thiểu
→ AI chạy kiểm tra phù hợp
→ AI cập nhật context bị ảnh hưởng
→ Review git diff
→ Commit
```

## 6. Khi mở chat Codex mới

Nếu Codex đang mở đúng repository và `AGENTS.md` nằm trong phạm vi áp dụng:

- Không cần chạy lại `02_PROMPT_BOOTSTRAP_CONTEXT.txt`.
- Không cần chạy một prompt khởi động dài.
- Chỉ cần giao task cụ thể bằng `03_PROMPT_TASK_HANG_NGAY.txt`.

Điều kiện:

1. Bộ context đã tồn tại.
2. Bộ context tương đối cập nhật.
3. Các thay đổi quan trọng đã được commit hoặc ít nhất đã ghi trong tài liệu.
4. Codex có quyền đọc repository.

## 7. Khi token gần đầy hoặc chat bắt đầu chậm

Trước khi đổi chat, kiểm tra:

> Có quyết định, rule, trạng thái, bug hoặc TODO quan trọng nào chỉ còn nằm trong chat mà chưa có trong repository không?

### Không có

Mở chat mới và giao task tiếp theo. Không cần tóm tắt lại toàn bộ chat.

### Có

Chạy:

```text
04_PROMPT_SYNC_CONTEXT.txt
```

Sau đó:

1. Review `git diff`.
2. Xác nhận tài liệu đúng.
3. Commit.
4. Mở chat mới.

Không lưu nguyên transcript dài vào repository.

## 8. Khi nào audit context

Chạy:

```text
05_PROMPT_AUDIT_CONTEXT.txt
```

khi:

- Hoàn thành một milestone.
- Đã làm khoảng 5–10 task lớn.
- Có thay đổi kiến trúc hoặc business flow.
- Tài liệu bắt đầu dài hoặc trùng lặp.
- Đường dẫn/class/API đã đổi.
- AI mới đọc context nhưng hiểu sai project.
- Có nghi ngờ source và tài liệu mâu thuẫn.

Không cần audit sau mỗi sửa lỗi nhỏ.

## 9. Khi chat không được truy cập repository

ChatGPT hoặc AI không được gắn repository sẽ không tự đọc được `AGENTS.md` trên máy.

Khi đó:

1. Gửi tám file context.
2. Gửi source hoặc file trực tiếp liên quan task.
3. Dùng `06_PROMPT_HANDOFF_KHONG_CO_REPOSITORY.txt`.

Tài liệu context không thay thế source thực tế. Với task code, AI vẫn phải được cung cấp source liên quan.

## 10. Trách nhiệm duy nhất của từng file context

### `AGENTS.md`

- Quy tắc bắt buộc AI phải tuân thủ.
- Cách đọc context.
- Cách sửa code.
- Conflict gate.
- Yêu cầu test và cập nhật context.

Không chứa lịch sử dài, TODO chi tiết hoặc bug chi tiết.

### `PROJECT_CONTEXT.md`

- Mục đích project.
- Người dùng chính.
- Stack.
- Main business flow.
- Quyết định dài hạn và ổn định.
- Các component quan trọng.

Không chứa trạng thái hằng ngày.

### `ARCHITECTURE.md`

- Kiến trúc thực tế đang tồn tại.
- Module ownership.
- Dependency/data flow.
- API/event/worker/UI/persistence flow.
- Constraint kỹ thuật.

Không mô tả kiến trúc mong muốn như thể đã tồn tại.

### `BUSINESS_RULES.md`

- Rule nghiệp vụ đã được xác nhận.
- Validation/calculation/status/permission/snapshot rules.
- Nguồn bằng chứng và nơi implementation.

Rule được duyệt nhưng chưa code vẫn phải giữ ở đây.

### `CURRENT_STATE.md`

- Handoff hiện tại.
- Build/runtime có bằng chứng.
- Việc đang làm.
- Vấn đề đang mở.
- Bước tiếp theo.
- File nên đọc đầu tiên.

Phải đọc được trong khoảng 1–2 phút.

### `TODO.md`

- Việc đã được xác nhận nhưng chưa hoàn thành.
- TODO/FIXME có bằng chứng.
- Test còn thiếu đã được yêu cầu.
- Technical debt có căn cứ.

Đề xuất của AI phải nằm riêng dưới `Suggested Improvements`.

### `BUGS.md`

- Bug có bằng chứng.
- Vấn đề đang điều tra.
- Rủi ro hoặc vùng mong manh.
- Bug đã sửa có giá trị chống hồi quy.

Không gọi một đoạn code là bug chỉ vì AI không thích cách viết.

### `README.md`

- Cài đặt.
- Chạy project.
- Biến môi trường.
- Build/test.
- Sử dụng cơ bản.
- Troubleshooting phổ biến.

## 11. Nguyên tắc nguồn sự thật

- Source/config/schema/migration/test đang chạy là nguồn xác minh trạng thái triển khai.
- Business rule do người dùng hoặc tài liệu chính thức xác nhận không được tự xóa chỉ vì source chưa làm đúng.
- Nếu source mâu thuẫn rule:
  - Giữ rule trong `BUSINESS_RULES.md`.
  - Ghi sai lệch vào `BUGS.md` nếu tạo lỗi/rủi ro.
  - Ghi task sửa vào `TODO.md`.
- Không đánh dấu hoàn thành nếu chưa có source và bằng chứng test/runtime phù hợp.
- Không ghi suy đoán thành sự thật.

## 12. Quy trình tối giản được khuyến nghị

```text
PROJECT MỚI
→ AGENTS.md
→ Bootstrap context một lần
→ Review và commit

MỖI TASK
→ Task prompt ngắn
→ Patch tối thiểu
→ Test
→ Cập nhật context liên quan
→ Commit

CHAT ĐẦY
→ Context đã đủ: mở chat mới
→ Context còn thiếu: Sync context rồi mở chat mới

MILESTONE LỚN
→ Audit context
```
