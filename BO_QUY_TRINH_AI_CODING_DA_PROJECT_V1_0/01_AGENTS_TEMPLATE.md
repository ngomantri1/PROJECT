# AGENTS.md

> File này là chỉ dẫn bắt buộc cho AI coding trong phạm vi repository.  
> Giữ file ngắn, ổn định và không biến thành changelog.

## Project

- Tên project: `<PROJECT_NAME>`
- Mục đích: `<PROJECT_PURPOSE>`
- Stack chính: `<PRIMARY_STACK>`
- Repository root: thư mục chứa file này.

Nếu thông tin trên chưa được điền hoặc đã lỗi thời, phải xác minh từ source/config trước khi cập nhật.

## Nguồn sự thật

- Source, schema, migration, config và test đang được sử dụng là nguồn xác minh trạng thái triển khai.
- Business rule do người dùng hoặc tài liệu nghiệp vụ xác nhận không được tự ý xóa hoặc hạ mức chỉ để khớp source.
- Nếu source mâu thuẫn rule đã xác nhận, phải nêu rõ sai lệch.
- Không ghi suy đoán thành sự thật.
- Không đánh dấu hoàn thành nếu chưa có bằng chứng source/test/runtime phù hợp.

## Context phải đọc

### Luôn đọc trước khi sửa code

1. `AGENTS.md`
2. `CURRENT_STATE.md`
3. `README.md`
4. `git status` và thay đổi chưa commit
5. Source và test trực tiếp liên quan yêu cầu

### Đọc khi task có liên quan

- `PROJECT_CONTEXT.md`: mục tiêu, domain, quyết định dài hạn.
- `ARCHITECTURE.md`: module, dependency, API, data flow, worker, persistence.
- `BUSINESS_RULES.md`: business logic, validation, calculation, status, permission.
- `TODO.md`: việc chưa hoàn thành liên quan task.
- `BUGS.md`: bug/rủi ro liên quan task.
- Tài liệu được các file trên tham chiếu.

Không cần đọc tuần tự toàn bộ repository nếu task chỉ ảnh hưởng một vùng nhỏ.

## Audit trước khi code

Trước khi sửa source, báo cáo ngắn:

1. Hiểu biết về mục tiêu task.
2. Trạng thái hiện tại có bằng chứng.
3. Rule/invariant liên quan.
4. File, class, function, API, migration hoặc test liên quan.
5. Patch tối thiểu dự kiến.
6. Kiểm tra sẽ chạy.
7. Rủi ro hoặc mâu thuẫn cần người dùng xác nhận.

Nếu không có mâu thuẫn nghiêm trọng, tiếp tục thực hiện; không cần chờ xác nhận chỉ vì đã báo cáo kế hoạch.

## Conflict Gate

Nếu yêu cầu mới hoặc patch dự kiến thay đổi một business rule, invariant, API contract, database ownership, permission, workflow, pricing, snapshot hoặc kiến trúc đã xác nhận:

1. Dừng trước khi sửa phần xung đột.
2. Chỉ rõ rule và tài liệu liên quan.
3. Nêu tác động, rủi ro, trade-off và phương án thay thế.
4. Đề xuất tài liệu cần cập nhật.
5. Chờ người dùng xác nhận rõ việc thay đổi nguyên tắc.
6. Sau xác nhận mới cập nhật tài liệu và source.

Nếu task là sửa source để tuân thủ rule đã xác nhận thì không cần thay đổi rule.

## Quy tắc sửa code

- Chỉ sửa đúng phạm vi task.
- Ưu tiên patch nhỏ, an toàn, dễ review.
- Không refactor ngoài phạm vi nếu không cần thiết.
- Không rewrite file chỉ để thay đổi một phần nhỏ.
- Không sửa file không liên quan.
- Không thay API, database, migration, workflow, permission hoặc kiến trúc nếu task không yêu cầu.
- Backend/database phải enforce mutation nghiệp vụ quan trọng; không chỉ dựa vào frontend.
- Bảo toàn snapshot, lịch sử, audit và dữ liệu bất biến.
- Bảo toàn thay đổi chưa commit của người dùng.
- Giữ encoding, BOM và line ending hiện tại.
- Không ghi secret, token, password hoặc dữ liệu nhạy cảm vào source/tài liệu/log.
- Không tự cài dependency, đổi lockfile hoặc nâng version ngoài phạm vi task.
- Không chạy lệnh phá hủy dữ liệu nếu chưa được người dùng xác nhận.

## Async, concurrency và background work

Khi project có async/thread/worker/queue/scheduler:

- Tôn trọng state ownership và lifecycle hiện có.
- Không cập nhật UI từ thread không phù hợp.
- Không tạo task trùng, race condition hoặc ghi đè trạng thái.
- Giữ idempotency, retry, transaction boundary và locking hiện có.
- Nếu chưa xác định được concurrency rule, phải kiểm tra source trước khi sửa.

## Database và API

- Migration phải có chủ đích, có thể review và có hướng rollback khi phù hợp.
- Không sửa dữ liệu production để che lỗi code.
- Không thay response contract hoặc request semantics ngầm.
- Validate ở boundary phù hợp.
- Không log credential hoặc payload nhạy cảm.
- Nếu đổi schema/API, cập nhật test và tài liệu liên quan.

## Kiểm tra sau khi sửa

Tự xác định lệnh đúng từ repository, ví dụ từ:

- `package.json`
- solution/project file
- `pyproject.toml`
- `requirements*.txt`
- `Makefile`
- CI workflow
- README

Ưu tiên chạy kiểm tra theo phạm vi:

1. Format/lint.
2. Type-check/compile.
3. Unit test liên quan.
4. Integration/E2E liên quan.
5. Build.
6. `git diff --check`.
7. Review `git diff`.

Không tuyên bố test đã pass nếu chưa chạy. Nếu không chạy được, nêu rõ lý do và rủi ro còn lại.

## Cập nhật context sau task

Chỉ cập nhật file thực sự bị ảnh hưởng:

- `CURRENT_STATE.md`: trạng thái có bằng chứng, công việc hiện tại, lệnh test/runtime.
- `TODO.md`: việc đã hoàn thành, đang làm hoặc còn lại.
- `BUGS.md`: bug mới, bug đã sửa hoặc rủi ro.
- `BUSINESS_RULES.md`: rule mới đã được người dùng/tài liệu xác nhận.
- `ARCHITECTURE.md`: module, dependency, API, schema, data flow hoặc ownership thay đổi.
- `PROJECT_CONTEXT.md`: quyết định dài hạn và ổn định.
- `README.md`: cài đặt, chạy, config hoặc sử dụng thay đổi.
- `docs/UI_DESIGN.md`: UI baseline/quy chuẩn đã được duyệt.
- `AGENTS.md`: chỉ khi quy trình bắt buộc cho mọi AI thay đổi.

Không cập nhật tất cả file theo thói quen. Không lặp cùng một nội dung đầy đủ ở nhiều file.

## Báo cáo cuối task

Báo cáo ngắn:

- File đã sửa và lý do.
- Hành vi trước/sau.
- Migration/config/API thay đổi nếu có.
- Lệnh kiểm tra đã chạy và kết quả.
- Context đã cập nhật.
- Bug, rủi ro và việc còn lại.
