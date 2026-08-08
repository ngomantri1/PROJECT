# AGENTS.md

> File này là chỉ dẫn bắt buộc cho AI coding trong phạm vi repository.  
> Giữ file ngắn, ổn định và không biến thành changelog.

## Project

- Tên project: `TaiXiuLiveHit`
- Phạm vi áp dụng: `ABXHubSolution/TaiXiuLiveHit`
- Mục đích: module/ứng dụng `TaiXiuLiveHit` trong `ABXHubSolution`; mục tiêu nghiệp vụ chi tiết phải được xác minh từ `PROJECT_CONTEXT.md`, `BUSINESS_RULES.md` và source hiện tại trước khi thay đổi hành vi.
- Stack chính đã được xác nhận từ context hiện có: WebView2 + JavaScript integration; các thành phần Dispatcher, cancellation và persistence là contract quan trọng. Các framework/runtime khác phải xác minh từ solution/project/config trước khi ghi nhận.
- Repository root cho phạm vi file này: thư mục `ABXHubSolution/TaiXiuLiveHit` chứa `AGENTS.md` này.
- Scope isolation: không áp dụng `AGENTS.md` của project khác. Nếu phát hiện `AGENTS.md` ở ancestor hoặc thư mục con, phải xác minh phạm vi ưu tiên trước khi sửa code.

Nếu thông tin trên chưa đầy đủ hoặc đã lỗi thời, phải xác minh từ source/config trước khi cập nhật. Không suy đoán stack, kiến trúc hoặc business rule chỉ từ tên project/file/UI.

## Nguồn sự thật

- Source, schema, migration, config và test đang được sử dụng là nguồn xác minh trạng thái triển khai.
- `PROJECT_CONTEXT.md`, `ARCHITECTURE.md` và `BUSINESS_RULES.md` là nguồn context/rule đã xác nhận; chúng không thay thế việc kiểm tra source trực tiếp liên quan task.
- `TODO.md` và `BUGS.md` là danh sách có bằng chứng, không tự động là source of truth cho trạng thái source hiện tại.
- Business rule do người dùng hoặc tài liệu nghiệp vụ xác nhận không được tự ý xóa, hạ mức hoặc thay đổi chỉ để khớp source.
- Nếu source mâu thuẫn rule đã xác nhận, phải nêu rõ sai lệch thay vì âm thầm sửa rule hoặc diễn giải lại nghiệp vụ.
- Không ghi suy đoán thành sự thật.
- Không suy diễn rule từ tên field, tên class, comment hoặc UI đơn lẻ.
- Không đánh dấu task/bug “đã hoàn thành” nếu chưa có bằng chứng source/test/runtime phù hợp.

## Context phải đọc

### Luôn đọc trước khi sửa code

1. `AGENTS.md`
2. `CURRENT_STATE.md`
3. `README.md`
4. `git status` và thay đổi chưa commit
5. Source và test trực tiếp liên quan yêu cầu

### Đọc khi task có liên quan

- `PROJECT_CONTEXT.md`: mục tiêu, domain, quyết định dài hạn và contract đã xác nhận.
- `ARCHITECTURE.md`: module, dependency, API, data flow, worker/thread, persistence và ownership.
- `BUSINESS_RULES.md`: business logic, validation, calculation, status, permission và workflow.
- `TODO.md`: việc chưa hoàn thành có bằng chứng liên quan task.
- `BUGS.md`: bug/rủi ro có bằng chứng liên quan task.
- Tài liệu được các file trên tham chiếu.
- Solution/project/config/build files trực tiếp liên quan đến module đang sửa.

Không cần đọc tuần tự toàn bộ repository nếu task chỉ ảnh hưởng một vùng nhỏ. Tuy nhiên, context không thay thế việc xác minh path/class/API/contract trong source hiện tại.

## Audit trước khi code

Trước khi sửa source, báo cáo ngắn:

1. Hiểu biết về mục tiêu task.
2. Trạng thái hiện tại có bằng chứng.
3. Rule/invariant/contract liên quan.
4. File, class, function, API, Dispatcher, WebView2/JavaScript bridge, persistence, migration hoặc test liên quan.
5. Nguyên nhân hoặc khoảng trống đã xác minh nếu task là sửa bug.
6. Patch tối thiểu dự kiến.
7. Kiểm tra sẽ chạy.
8. Rủi ro hoặc mâu thuẫn cần người dùng xác nhận.

Nếu không có mâu thuẫn nghiêm trọng, tiếp tục thực hiện; không cần chờ xác nhận chỉ vì đã báo cáo kế hoạch.

## Conflict Gate

Nếu yêu cầu mới hoặc patch dự kiến thay đổi một business rule, invariant, API contract, data ownership, permission, workflow, snapshot, persistence contract hoặc kiến trúc đã xác nhận:

1. Dừng trước khi sửa phần xung đột.
2. Chỉ rõ rule/contract và tài liệu hoặc source liên quan.
3. Nêu tác động, rủi ro, trade-off và phương án thay thế.
4. Đề xuất tài liệu cần cập nhật.
5. Chờ người dùng xác nhận rõ việc thay đổi nguyên tắc.
6. Sau xác nhận mới cập nhật tài liệu và source.

Nếu task chỉ sửa source để tuân thủ rule/contract đã xác nhận thì không cần thay đổi nguyên tắc và không cần chờ xác nhận.

## Invariants của project

Các invariant dưới đây phải được bảo toàn trừ khi người dùng xác nhận thay đổi nguyên tắc:

- Giữ contract giữa WebView2 và JavaScript đã được xác nhận trong context/source.
- Không đổi ngầm tên message, payload, callback, event hoặc semantics của WebView2/JavaScript bridge.
- Tôn trọng Dispatcher/thread-affinity; không cập nhật UI từ thread không phù hợp.
- Tôn trọng cancellation lifecycle; không nuốt cancellation, không biến thao tác cancel thành success và không để task đã cancel tiếp tục ghi state trái contract.
- Bảo toàn atomic persistence và transaction boundary đã được xác nhận; không để trạng thái được ghi dở dang hoặc một phần khi operation phải atomic.
- Không tạo race condition, duplicate action hoặc ghi đè state do nhiều luồng/tác vụ cùng chạy.
- Không đánh dấu task/bug hoàn thành nếu chưa có test hoặc runtime evidence phù hợp.
- Khi thay đổi kiến trúc hoặc business flow, cập nhật đúng tài liệu sở hữu thông tin đó; không sao chép toàn bộ cùng một nội dung vào nhiều file context.

Nếu chi tiết cụ thể của một invariant chưa rõ, phải đọc `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `BUSINESS_RULES.md` và source liên quan trước khi sửa.

## Quy tắc sửa code

- Chỉ sửa đúng phạm vi task.
- Ưu tiên patch nhỏ, an toàn, dễ review.
- Không refactor ngoài phạm vi nếu không cần thiết.
- Không rewrite file chỉ để thay đổi một phần nhỏ.
- Không sửa file không liên quan.
- Không thay API, database, migration, workflow, permission hoặc kiến trúc nếu task không yêu cầu.
- Backend/core logic/persistence layer phải enforce mutation nghiệp vụ quan trọng ở boundary phù hợp; không chỉ dựa vào UI nếu project có nhiều đường gọi.
- Bảo toàn snapshot, lịch sử, audit và dữ liệu bất biến nếu chúng tồn tại trong flow liên quan.
- Bảo toàn thay đổi chưa commit của người dùng.
- Giữ encoding, BOM và line ending hiện tại.
- Không ghi secret, token, password hoặc dữ liệu nhạy cảm vào source/tài liệu/log.
- Không tự cài dependency, đổi lockfile hoặc nâng version ngoài phạm vi task.
- Không chạy lệnh phá hủy dữ liệu nếu chưa được người dùng xác nhận.
- Không sửa database, migration, dependency hoặc lockfile chỉ để cập nhật context/tài liệu.
- Không thay đổi contract WebView2/JavaScript chỉ để “đơn giản hóa” implementation nếu chưa xác minh tất cả caller/consumer.

## Async, concurrency và background work

Khi task liên quan async/thread/worker/queue/timer/scheduler/WebView2 callback:

- Tôn trọng state ownership và lifecycle hiện có.
- Không cập nhật UI từ thread không phù hợp; dùng Dispatcher hoặc cơ chế thread-marshalling hiện có.
- Không tạo task trùng, race condition hoặc ghi đè trạng thái.
- Giữ idempotency, retry, transaction boundary và locking hiện có.
- Cancellation phải được truyền và kiểm tra ở các điểm có thể chờ lâu hoặc lặp dài nếu source hiện tại dùng cancellation token/lifecycle tương ứng.
- Không giữ lock trong lúc chờ network/WebView2/IO nếu kiến trúc hiện tại không yêu cầu.
- Không để callback đến muộn ghi đè state của request/session/run mới hơn.
- Nếu chưa xác định được concurrency rule, phải kiểm tra source và tài liệu liên quan trước khi sửa.

## Database và API

- Migration phải có chủ đích, có thể review và có hướng rollback khi phù hợp.
- Không sửa dữ liệu production để che lỗi code.
- Không sửa migration cũ đã phát hành chỉ để thuận tiện cho task mới, trừ khi repository có policy khác đã được xác nhận.
- Không thay response contract, request semantics, message payload hoặc event semantics ngầm.
- Validate ở boundary phù hợp.
- Không log credential hoặc payload nhạy cảm.
- Nếu đổi schema/API/bridge contract, cập nhật toàn bộ caller/consumer, test và tài liệu liên quan.
- Nếu persistence được yêu cầu atomic, phải giữ operation trong transaction/atomic boundary phù hợp và test failure/rollback path.

## Kiểm tra sau khi sửa

Tự xác định lệnh đúng từ repository, ví dụ từ:

- solution/project files (`.sln`, `.csproj` hoặc tương đương)
- `package.json`
- build scripts
- test projects
- CI workflow
- README
- config/tooling hiện có

Ưu tiên chạy kiểm tra theo phạm vi:

1. Format/lint nếu repository có cấu hình.
2. Type-check/compile.
3. Unit test liên quan.
4. Integration/E2E/runtime test liên quan.
5. Build.
6. `git diff --check`.
7. Review `git diff`.

Nếu task ảnh hưởng WebView2/JavaScript bridge, Dispatcher, cancellation hoặc persistence, phải có kiểm tra trực tiếp cho flow đó khi repository cho phép.

Không tuyên bố test đã pass nếu chưa chạy. Nếu không chạy được, nêu rõ lệnh chưa chạy, lý do và rủi ro còn lại.

## Cập nhật context sau task

Chỉ cập nhật file thực sự bị ảnh hưởng:

- `CURRENT_STATE.md`: trạng thái có bằng chứng, công việc hiện tại, lệnh test/runtime.
- `TODO.md`: việc đã hoàn thành, đang làm hoặc còn lại.
- `BUGS.md`: bug mới, bug đã sửa hoặc rủi ro còn lại.
- `BUSINESS_RULES.md`: rule mới đã được người dùng/tài liệu xác nhận.
- `ARCHITECTURE.md`: module, dependency, API, schema, data flow, Dispatcher/thread, persistence hoặc ownership thay đổi.
- `PROJECT_CONTEXT.md`: quyết định dài hạn và ổn định.
- `README.md`: cài đặt, chạy, config hoặc sử dụng thay đổi.
- `docs/UI_DESIGN.md`: UI baseline/quy chuẩn đã được duyệt nếu file tồn tại và task ảnh hưởng giao diện.
- `AGENTS.md`: chỉ khi quy trình bắt buộc cho mọi AI thay đổi.

Không cập nhật tất cả file theo thói quen. Không lặp cùng một nội dung đầy đủ ở nhiều file. Không sửa database/migration/dependency/lockfile chỉ để làm context “khớp”.

## Báo cáo cuối task

Báo cáo ngắn:

- File đã sửa và lý do.
- Hành vi trước/sau.
- Contract WebView2/JavaScript, Dispatcher, cancellation hoặc persistence thay đổi nếu có.
- Migration/config/API/dependency thay đổi nếu có.
- Lệnh kiểm tra đã chạy và kết quả thực tế.
- Runtime evidence nếu task cần xác minh hành vi runtime.
- Context đã cập nhật.
- Bug, rủi ro và việc còn lại.

Không ghi “hoàn thành”, “fixed”, “pass” hoặc tương đương nếu chưa có bằng chứng phù hợp.
