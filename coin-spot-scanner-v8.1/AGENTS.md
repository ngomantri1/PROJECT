# AGENTS.md

> File này là chỉ dẫn bắt buộc cho mọi AI coding làm việc trong phạm vi repository.
> Giữ file ngắn, ổn định và không biến thành changelog, backlog hoặc tài liệu kiến trúc dài.

## Project

- **Tên project:** `COIN SPOT SCANNER V8.1`
- **Mục đích:** Web app nghiên cứu và sàng lọc altcoin Spot theo bộ quy tắc **V8.1 Professional — Execution Integrity**.
- **Người dùng chính:** Nhà đầu tư Spot và quản trị viên vận hành hệ thống quét.
- **Trạng thái nền tảng:** `0.1.0-baseline`.
- **Giới hạn sản phẩm:** Không tự đặt lệnh giao dịch và không được tạo `BUY_SETUP` khi thiếu dữ liệu critical.
- **Repository root:** Thư mục chứa file `AGENTS.md`.

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Ant Design.
- **Backend:** Python 3.12, Django 5.2, Django REST Framework.
- **Background processing:** Celery, Redis, Celery Beat.
- **Database:** PostgreSQL khi chạy Docker; SQLite fallback khi không có `DB_HOST`.
- **External market data:** CoinGecko và Binance public REST API qua `httpx`.
- **Runtime:** Docker Compose.
- **Frontend update flow:** Polling API; hiện chưa có WebSocket hoặc SSE.
- **Ruleset chính:** `backend/rules/v8_1/defaults.json`.

Nếu thông tin trên không còn khớp source/config hiện tại, phải xác minh từ repository trước khi cập nhật.

## Nguồn Sự Thật

- Source, schema, migration, config và test đang được sử dụng là nguồn xác minh trạng thái đã triển khai.
- Business rule do người dùng hoặc tài liệu V8.1 xác nhận không được tự ý xóa, hạ mức hoặc thay đổi chỉ để khớp source.
- Nếu source mâu thuẫn với rule đã xác nhận, phải nêu rõ sai lệch.
- Không ghi suy đoán thành sự thật.
- Không coi UI, tên field hoặc comment đơn lẻ là bằng chứng đầy đủ về nghiệp vụ.
- Không đánh dấu “đã hoàn thành” nếu chưa có bằng chứng từ source và test/build/runtime phù hợp.
- Không hard-code dữ liệu giả và trình bày như dữ liệu production.
- Thiếu dữ liệu phải trả trạng thái trung thực như `UNKNOWN`, `STALE`, `CONFLICT`, `NOT_SCORED` hoặc trạng thái tương ứng trong hệ thống.

## Context Phải Đọc

### Luôn đọc trước khi sửa code

1. `AGENTS.md`
2. `CURRENT_STATE.md`
3. `README.md`
4. `git status` và thay đổi chưa commit
5. Source và test trực tiếp liên quan yêu cầu hiện tại

### Đọc khi task có liên quan

- `PROJECT_CONTEXT.md`: mục tiêu project, domain và quyết định dài hạn.
- `ARCHITECTURE.md`: module, dependency, API, data flow, worker và persistence.
- `BUSINESS_RULES.md`: business rule, validation, calculation, trạng thái và permission.
- `TODO.md`: việc chưa hoàn thành liên quan task.
- `BUGS.md`: bug và rủi ro liên quan task.
- `docs/specification/`: đặc tả nghiệp vụ V8.1.
- `docs/UI_DESIGN.md`: UI baseline và quy chuẩn giao diện nếu file tồn tại.
- Tài liệu khác được các file trên tham chiếu.

Không cần đọc tuần tự toàn bộ repository nếu task chỉ ảnh hưởng một vùng nhỏ. Context không thay thế việc kiểm tra source và test trực tiếp liên quan task.

## Audit Trước Khi Code

Trước khi sửa source, AI phải báo cáo ngắn:

1. Hiểu biết về mục tiêu task.
2. Trạng thái hiện tại có bằng chứng.
3. Rule hoặc invariant liên quan.
4. File, class, function, endpoint, migration, worker hoặc test liên quan.
5. Nguyên nhân hoặc khoảng trống đã xác minh.
6. Patch tối thiểu dự kiến.
7. Kiểm tra sẽ chạy.
8. Rủi ro hoặc mâu thuẫn cần người dùng xác nhận.

Nếu không có mâu thuẫn nghiêm trọng, tiếp tục thực hiện; không cần chờ xác nhận chỉ vì đã báo cáo kế hoạch.

## Conflict Gate

Nếu yêu cầu mới hoặc patch dự kiến thay đổi một trong các nội dung đã xác nhận sau:

- Business rule.
- Hard Rule hoặc invariant.
- API contract.
- Database schema, ownership hoặc data scope.
- Permission hoặc authentication flow.
- Workflow hoặc status transition.
- Snapshot, audit hoặc lịch sử.
- Công thức scoring.
- Capital Plan.
- Kiến trúc hoặc dependency flow.

AI phải:

1. Dừng trước khi sửa phần xung đột.
2. Chỉ rõ rule và tài liệu liên quan.
3. Nêu tác động, rủi ro, trade-off và phương án thay thế.
4. Đề xuất tài liệu cần cập nhật.
5. Chờ người dùng xác nhận rõ việc thay đổi nguyên tắc.
6. Sau xác nhận mới cập nhật tài liệu và source.

Nếu task là sửa source để tuân thủ rule đã xác nhận thì không cần thay đổi rule.

## Quy Tắc Nghiệp Vụ Bất Biến V8.1

Các nguyên tắc dưới đây không được làm yếu hoặc vô hiệu hóa ngầm:

- `Hard Rule` luôn thắng điểm số.
- `UNKNOWN` không được coi là `PASS`.
- Không sửa trực tiếp profile `V8.1 DEFAULT — EXECUTION INTEGRITY`.
- Không làm yếu invariant trong `backend/rules/v8_1/defaults.json`.
- Không tạo `BUY_SETUP` nếu thiếu một trong các dữ liệu critical:
  - orderbook;
  - kline 4H;
  - unlock;
  - stop/invalidation;
  - RR.
- `FULL_SCAN` phải có Universe Accounting.
- Quality Score, Entry Score và Opportunity Score phải tách riêng.
- Score phải có trạng thái phù hợp như `FINAL`, `PROVISIONAL`, `RANGE` hoặc `NOT_SCORED`.
- Protocol Quality phải tách khỏi Token Value Capture.
- Top 3 không được lấp đủ bằng coin không đạt Hard Rule.
- Capital Plan phải cộng đủ 100%.
- Report Validation Gate phải chạy trước khi kết luận.
- Không bịa entry, stop, TP, unlock, orderbook hoặc bằng chứng nguồn.

Nếu task ảnh hưởng các nguyên tắc trên, phải đọc `BUSINESS_RULES.md` và `docs/specification/` trước khi sửa.

## Quy Tắc Sửa Code

- Chỉ sửa đúng phạm vi task.
- Ưu tiên patch nhỏ, an toàn và dễ review.
- Không refactor ngoài phạm vi nếu không cần.
- Không rewrite toàn bộ file chỉ để sửa một phần nhỏ.
- Không sửa file không liên quan.
- Không thay API, database, migration, workflow, permission hoặc kiến trúc nếu task không yêu cầu.
- Backend/database phải enforce mutation nghiệp vụ quan trọng; không chỉ dựa vào frontend.
- Bảo toàn snapshot, lịch sử, audit và dữ liệu bất biến.
- Bảo toàn thay đổi chưa commit của người dùng.
- Giữ encoding, BOM và line ending hiện tại.
- Không ghi secret, token, password hoặc dữ liệu nhạy cảm vào source, tài liệu hoặc log.
- Không tự cài dependency, đổi lockfile hoặc nâng version ngoài phạm vi task.
- Không chạy lệnh phá hủy dữ liệu nếu chưa được người dùng xác nhận.
- Không thêm browser automation để bypass CAPTCHA, paywall, login restriction hoặc anti-bot.
- Không thêm dữ liệu demo/hard-coded vào flow production nếu không có cờ hoặc môi trường tách biệt rõ ràng.

## Coding Conventions

- Python variable/function/module: `snake_case`.
- Python class: `PascalCase`.
- React component: `PascalCase`.
- TypeScript variable/function: theo convention hiện có trong module.
- Status, action, risk code và key nghiệp vụ ổn định: giữ dạng uppercase hiện có.
- Không đổi tên public API, serializer field hoặc status key mà không có migration/compatibility plan.
- Giữ type contract giữa backend và frontend đồng bộ.
- Error phải có ngữ cảnh đủ để debug nhưng không làm lộ dữ liệu nhạy cảm.
- Logging phải dùng structured context hiện có khi phù hợp.

## Async, Concurrency Và Background Work

Khi sửa Celery, scheduler, orchestrator hoặc network collector:

- External network work phải chạy trong Celery/orchestrator; không chặn request HTTP lâu.
- Tôn trọng state ownership và lifecycle hiện có.
- Không tạo task trùng, race condition hoặc ghi đè trạng thái của run khác.
- Giữ idempotency, retry, locking và transaction boundary hiện có.
- Không để Celery Beat tạo nhiều lịch trùng cho cùng task.
- Không cập nhật một `ScanRun` bằng dữ liệu từ run khác.
- Khi bước trước thay đổi đầu vào, phải tôn trọng cơ chế stale/invalidation của bước sau nếu đã được triển khai.
- Nếu concurrency rule chưa rõ, phải đọc source orchestration và model liên quan trước khi sửa.
- Không chạy Selenium/browser automation trực tiếp trong request-response của Django.

## Database Và Migration

- Thay Django model phải tạo migration mới.
- Không sửa migration cũ đã phát hành nếu không có lý do và kế hoạch migration rõ ràng.
- Migration phải có chủ đích, dễ review và có hướng rollback khi phù hợp.
- Không sửa dữ liệu production để che lỗi source.
- Không xóa bảng, cột, dữ liệu hoặc volume nếu chưa được người dùng xác nhận.
- Giữ transaction boundary phù hợp cho Scan Run, Step Run, scoring và snapshot.
- Không ghi đè configuration snapshot hoặc report snapshot đã gắn với một run lịch sử.

## API Và Frontend Contract

Khi thay API:

- Cập nhật serializer/view/route backend liên quan.
- Cập nhật `frontend/src/api.ts`.
- Cập nhật `frontend/src/types.ts`.
- Cập nhật component/query sử dụng contract đó.
- Cập nhật test và tài liệu API liên quan.
- Không thay response contract hoặc request semantics ngầm.
- Validate ở boundary phù hợp.
- Không log credential hoặc payload nhạy cảm.

Frontend không được là nơi duy nhất enforce các Hard Rule hoặc validation nghiệp vụ quan trọng.

## External Integrations

Khi sửa collector hoặc nguồn dữ liệu:

- Ưu tiên public API hoặc endpoint được phép sử dụng.
- Có timeout, retry và xử lý rate limit.
- Phân biệt lỗi nguồn, lỗi parser, dữ liệu thiếu và dữ liệu mâu thuẫn.
- Không coi request thành công là dữ liệu đủ điều kiện.
- Lưu source, timestamp, freshness và trạng thái bằng chứng khi flow hiện có yêu cầu.
- Không bypass CAPTCHA, paywall hoặc cơ chế chống bot.
- Nếu nguồn không truy cập được, trả trạng thái trung thực thay vì tạo dữ liệu thay thế.

## Kiểm Tra Sau Khi Sửa

Tự xác định lệnh đúng từ:

- `package.json`
- `requirements*.txt`
- Django config
- Docker Compose
- CI workflow
- README
- các script hiện có

### Kiểm tra tối thiểu hiện tại

```bash
python -m compileall -q backend
```

### Trong Docker hoặc môi trường đã cài dependency

```bash
python backend/manage.py check
python backend/manage.py test
cd frontend && npm run typecheck && npm run build
```

### Kiểm tra chung

```bash
git diff --check
git diff
```

Ưu tiên chạy theo phạm vi:

1. Format/lint.
2. Type-check/compile.
3. Unit test liên quan.
4. Integration/E2E liên quan.
5. Build.
6. `git diff --check`.
7. Review `git diff`.

Nếu sửa orchestration, rule engine hoặc scoring, bắt buộc test trường hợp thiếu dữ liệu và xác nhận không sinh `BUY_SETUP`.

Không tuyên bố kiểm tra đã pass nếu chưa chạy. Nếu không chạy được, nêu rõ lý do và rủi ro còn lại.

## Cập Nhật Context Sau Task

Chỉ cập nhật file thực sự bị ảnh hưởng:

- `CURRENT_STATE.md`: trạng thái có bằng chứng, công việc hiện tại, build/test/runtime.
- `TODO.md`: việc đã hoàn thành, đang làm hoặc còn lại.
- `BUGS.md`: bug mới, bug đã sửa hoặc rủi ro.
- `BUSINESS_RULES.md`: rule mới đã được người dùng hoặc tài liệu xác nhận.
- `ARCHITECTURE.md`: module, dependency, API, schema, data flow hoặc ownership thay đổi.
- `PROJECT_CONTEXT.md`: quyết định dài hạn và ổn định.
- `README.md`: cài đặt, chạy, config hoặc sử dụng thay đổi.
- `docs/UI_DESIGN.md`: UI baseline hoặc quy chuẩn giao diện thay đổi.
- `docs/specification/`: chỉ khi người dùng xác nhận thay đổi đặc tả.
- `AGENTS.md`: chỉ khi quy trình bắt buộc cho mọi AI thay đổi.

Không cập nhật tất cả file theo thói quen. Không lặp cùng một nội dung đầy đủ ở nhiều file.

## Báo Cáo Cuối Task

Báo cáo ngắn:

- File đã sửa và lý do.
- Hành vi trước và sau.
- Migration, config hoặc API thay đổi nếu có.
- Lệnh kiểm tra đã chạy và kết quả.
- Context đã cập nhật.
- Bug, rủi ro và việc còn lại.
