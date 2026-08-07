# AGENTS.md

> File này là chỉ dẫn bắt buộc cho mọi AI coding làm việc trong phạm vi repository.  
> Giữ file ngắn, ổn định và không biến thành changelog, backlog hoặc tài liệu kiến trúc dài.

## Project

- **Tên project:** `ToolBet v2`
- **Mục đích:** Ứng dụng Windows/Python tự động theo dõi Baccarat AE SEXY trong Chrome, phân tích mẫu, hiển thị overlay và có thể thực hiện luồng đặt cược tự động.
- **Stack chính:** Python 3.10+, `asyncio`, Playwright/CDP, SQLAlchemy/SQLite, Pydantic/YAML, Pillow và ddddocr.
- **Repository root:** Thư mục chứa file `AGENTS.md`.

Nếu mô tả, stack hoặc đường dẫn trong file này không còn khớp source/config hiện tại, phải xác minh từ repository trước khi cập nhật.

## Nguồn Sự Thật

- Source, schema, migration, config và test đang được sử dụng là nguồn xác minh trạng thái đã triển khai.
- Business rule do người dùng hoặc tài liệu nghiệp vụ xác nhận không được tự ý xóa, hạ mức hoặc thay đổi chỉ để khớp source.
- Nếu source mâu thuẫn với rule đã xác nhận, phải nêu rõ sai lệch.
- Không suy nghiệp vụ chỉ từ tên file, tên field, selector, UI hoặc tài liệu cũ.
- Không ghi giả thuyết thành sự thật.
- Không đánh dấu hoàn thành nếu chưa có bằng chứng từ source và kiểm tra phù hợp.
- Không dùng DOM, canvas hoặc lobby history như nguồn kết quả đáng tin ngang WebSocket/HTTP khi flow hiện tại yêu cầu reconcile.

## Context Phải Đọc

### Luôn đọc trước khi sửa code

1. `AGENTS.md`
2. `CURRENT_STATE.md`
3. `README.md`
4. `git status` và các thay đổi chưa commit
5. Source và test trực tiếp liên quan yêu cầu hiện tại

### Đọc khi task có liên quan

- `PROJECT_CONTEXT.md`: mục tiêu, domain và quyết định dài hạn.
- `ARCHITECTURE.md`: module, dependency, browser flow, event flow, persistence và lifecycle.
- `BUSINESS_RULES.md`: nghiệp vụ đặt cược, pending bet, chống trùng, reconcile và recovery.
- `TODO.md`: việc chưa hoàn thành liên quan task.
- `BUGS.md`: bug và rủi ro liên quan task.
- Tài liệu khác được các file trên tham chiếu.

Không cần đọc tuần tự toàn bộ repository nếu task chỉ ảnh hưởng một vùng nhỏ. Tài liệu context không thay thế việc kiểm tra source và test trực tiếp liên quan task.

## Audit Trước Khi Code

Trước khi sửa source, AI phải báo cáo ngắn:

1. Hiểu biết về mục tiêu task.
2. Trạng thái hiện tại có bằng chứng.
3. Rule hoặc invariant liên quan.
4. File, class, function, browser event, database path hoặc test liên quan.
5. Nguyên nhân hoặc khoảng trống đã xác minh.
6. Patch tối thiểu dự kiến.
7. Kiểm tra sẽ chạy.
8. Rủi ro hoặc mâu thuẫn cần người dùng xác nhận.

Nếu không có mâu thuẫn nghiêm trọng, tiếp tục thực hiện; không cần chờ xác nhận chỉ vì đã báo cáo kế hoạch.

## Conflict Gate

Nếu yêu cầu mới hoặc patch dự kiến thay đổi một trong các nội dung đã xác nhận sau:

- Quy tắc đặt cược.
- Quy tắc pending bet hoặc chống đặt trùng.
- State ownership hoặc lock.
- Recovery/reconnect lifecycle.
- Nguồn kết quả chuẩn và thứ tự reconcile.
- Browser/site/tab binding.
- API, WebSocket hoặc message flow.
- Database schema hoặc khả năng tương thích dữ liệu cũ.
- Credential handling.
- Kiến trúc module hoặc adapter.

AI phải:

1. Dừng trước khi sửa phần xung đột.
2. Chỉ rõ rule và tài liệu liên quan.
3. Nêu tác động, rủi ro, trade-off và phương án thay thế.
4. Đề xuất tài liệu cần cập nhật.
5. Chờ người dùng xác nhận rõ việc thay đổi nguyên tắc.
6. Sau xác nhận mới cập nhật tài liệu và source.

Nếu task là sửa source để tuân thủ rule đã xác nhận thì không cần thay đổi rule.

## Invariant Không Được Phá

- Không làm gián đoạn luồng đặt cược đang chạy.
- Recovery phải chờ `AutoBettor` idle và tôn trọng lock/pending bet.
- Chỉ một pending bet cho mode chính.
- Nuôi Hòa có pending riêng; không nhập nhầm vào pending của mode chính.
- Không bỏ cơ chế chống đặt cược trùng theo round.
- Không suy kết quả cuối cùng chỉ từ DOM, canvas hoặc lobby history nếu flow hiện tại yêu cầu WS/HTTP reconcile.
- Không thao tác nhầm site hoặc tab khi nhiều web cùng mở.
- Site mới phải có adapter riêng trong `src/sites/`.
- Không dùng selector đăng nhập hoặc selector nghiệp vụ của site này cho site khác.
- Overlay có thể mất khi navigation/reload; mọi thay đổi phải tôn trọng lifecycle này.
- Không ghi secret hoặc dữ liệu nhạy cảm vào source, log, tài liệu hoặc commit.
- Không sửa schema trực tiếp bằng tay làm mất khả năng tương thích database cũ.

Nếu task có thể ảnh hưởng các invariant trên, phải đọc `BUSINESS_RULES.md`, `ARCHITECTURE.md` và source liên quan trước khi sửa.

## Quy Tắc Sửa Code

- Chỉ sửa đúng phạm vi task.
- Ưu tiên patch nhỏ, an toàn và dễ review.
- Không refactor ngoài phạm vi nếu không cần.
- Không rewrite toàn bộ file chỉ để sửa một phần nhỏ.
- Không sửa file không liên quan.
- Không thay API, database, workflow, permission hoặc kiến trúc nếu task không yêu cầu.
- Bảo toàn thay đổi chưa commit của người dùng.
- Giữ encoding, BOM và line ending hiện tại.
- Không tự cài dependency, đổi lockfile hoặc nâng version ngoài phạm vi task.
- Không chạy lệnh phá hủy dữ liệu nếu chưa được người dùng xác nhận.
- Không hard-code dữ liệu giả vào flow production.
- Không che lỗi bằng cách nuốt exception hoặc trả trạng thái thành công giả.
- Không vô hiệu hóa lock, pending state, duplicate guard hoặc reconcile để “làm cho chạy”.

## Coding Conventions

- Giữ Python type hints ở các vùng hiện có.
- Hàm, biến và module dùng `snake_case`.
- Class dùng `PascalCase`.
- Hằng số dùng chữ hoa theo convention hiện có.
- Không đổi tên public class, method, event key hoặc config field nếu chưa kiểm tra toàn bộ nơi sử dụng.
- Error phải có đủ ngữ cảnh để debug nhưng không làm lộ credential, token, cookie hoặc payload nhạy cảm.
- Giữ cách tổ chức import và logging nhất quán với module đang sửa.

## Async, Concurrency Và Background Work

- Giữ các thao tác Playwright bất đồng bộ.
- Không chèn I/O blocking vào event loop.
- Không dùng `time.sleep()` trong async flow; dùng primitive bất đồng bộ phù hợp.
- Không tạo task nền không được quản lý lifecycle.
- Không tạo race condition giữa browser event, result reconcile, pending bet và recovery.
- Tôn trọng lock và state ownership hiện có.
- Không để reconnect/recovery chạy đồng thời với thao tác đặt cược chưa kết thúc.
- Cancellation phải được xử lý có chủ đích; không để task dở dang cập nhật state sau khi đã hủy.
- Nếu concurrency rule chưa rõ, phải kiểm tra `AutoBettor`, browser/session manager và state model liên quan trước khi sửa.

## Browser, Playwright Và Site Adapter

- Site mới phải triển khai adapter riêng trong `src/sites/`.
- Không dùng selector hoặc login flow của một site cho site khác.
- Giữ allowlist site/tab binding để tránh thao tác nhầm tab.
- Trước khi click hoặc đọc state, xác minh page/tab/frame còn hợp lệ.
- Navigation, reload hoặc iframe replacement có thể làm mất handle và overlay.
- Không giữ locator/element handle lâu hơn lifecycle an toàn của page/frame.
- Không bypass CAPTCHA, paywall, login protection hoặc cơ chế chống bot.
- Không mở rộng browser permission hoặc CDP access ngoài nhu cầu task.
- Với canvas/OCR, phải phân biệt dữ liệu quan sát được với kết quả đã reconcile.

## Result Source Và Reconcile

- Giữ thứ tự ưu tiên nguồn kết quả đang được source hiện tại enforce.
- WebSocket/HTTP là nguồn đáng tin hơn DOM/canvas/lobby history khi flow hiện tại quy định như vậy.
- Không xác nhận round chỉ từ một tín hiệu phụ.
- Không ghi kết quả trùng cho cùng round.
- Khi các nguồn mâu thuẫn, giữ trạng thái chưa xác nhận và đi qua reconcile thay vì tự chọn dữ liệu thuận tiện.
- Không dùng dữ liệu cũ sau navigation/reconnect như kết quả của round mới.

## UI Và GameOverlay

- Mọi cập nhật UI trong trang phải đi qua `GameOverlay`.
- Không inject nhiều overlay trùng nhau.
- Overlay có thể mất sau navigation/reload; việc khôi phục phải idempotent.
- Không để overlay giữ reference đã stale đến page/frame cũ.
- UI không được là nơi duy nhất enforce rule đặt cược hoặc pending state.
- Không để lỗi hiển thị làm thay đổi state nghiệp vụ.
- Nếu UI update chạy từ task nền, phải tôn trọng event loop và lifecycle của page.

## Database Và Migration

- Database hiện dùng SQLAlchemy/SQLite.
- Không sửa trực tiếp schema hoặc file database bằng thao tác tay để che lỗi.
- Khi thay model/schema, cập nhật migration hoặc cơ chế nâng cấp tương thích DB cũ trong `src/database.py`.
- Không làm mất dữ liệu lịch sử, pending state hoặc audit có giá trị.
- Migration phải có chủ đích, dễ review và có xử lý rollback/failure phù hợp khi khả thi.
- Không commit database local.
- Không giả định database mới hoàn toàn; phải xem xét dữ liệu từ phiên bản cũ.

## Config, Credential Và Dữ Liệu Nhạy Cảm

Không commit:

- `credentials.yaml`
- `config.yaml`
- `data/toolbet.db`
- `data/cdp_profile/`

Không log hoặc đưa vào tài liệu:

- Username/password.
- Token.
- Cookie.
- Session data.
- Authorization header.
- Payload nhạy cảm.
- Nội dung profile trình duyệt.

Khi cần ví dụ cấu hình, dùng placeholder và file mẫu không chứa secret.

## Kiểm Tra Sau Khi Sửa

Tự xác định lệnh đúng từ repository, ví dụ từ:

- `pyproject.toml`
- `requirements*.txt`
- test configuration
- script hiện có
- CI workflow
- README

Ưu tiên chạy theo phạm vi:

1. Parse/compile/import module.
2. Format/lint nếu repository có cấu hình.
3. Type-check nếu repository có công cụ.
4. Unit test liên quan.
5. Integration/browser test liên quan.
6. `git diff --check`.
7. Review `git diff`.

### Yêu cầu tối thiểu

- Parse hoặc import toàn bộ module bị ảnh hưởng.
- Với logic thuần, bổ sung hoặc chạy test tập trung.
- Với browser flow, xác minh trên session không có tiền thật hoặc đặt:

```yaml
auto_bet: false
```

- Với thay đổi `AutoBettor`, pending bet, duplicate guard hoặc recovery, phải test:
  - không tạo bet trùng;
  - không ghi đè pending;
  - recovery không chạy khi bettor chưa idle;
  - cancel/reconnect không để task cũ tiếp tục cập nhật state.
- Với thay đổi database, phải test mở database cũ hoặc migration tương thích nếu có fixture phù hợp.

Không tuyên bố test đã pass nếu chưa chạy. Nếu không chạy được, nêu rõ lý do và rủi ro còn lại.

## Cập Nhật Context Sau Task

Chỉ cập nhật file thực sự bị ảnh hưởng:

- `CURRENT_STATE.md`: trạng thái có bằng chứng, công việc hiện tại, test/runtime.
- `TODO.md`: việc đã hoàn thành, đang làm hoặc còn lại.
- `BUGS.md`: bug mới, bug đã sửa hoặc rủi ro.
- `BUSINESS_RULES.md`: rule mới đã được người dùng hoặc tài liệu xác nhận.
- `ARCHITECTURE.md`: module, dependency, browser flow, event flow, database hoặc state ownership thay đổi.
- `PROJECT_CONTEXT.md`: quyết định dài hạn và ổn định.
- `README.md`: cài đặt, chạy, config hoặc sử dụng thay đổi.
- `AGENTS.md`: chỉ khi quy trình bắt buộc cho mọi AI thay đổi.

Không cập nhật tất cả file theo thói quen. Không lặp cùng một nội dung đầy đủ ở nhiều file.

## Báo Cáo Cuối Task

Báo cáo ngắn:

- File đã sửa và lý do.
- Hành vi trước và sau.
- Config, database hoặc interface thay đổi nếu có.
- Lệnh kiểm tra đã chạy và kết quả.
- Context đã cập nhật.
- Bug, rủi ro và việc còn lại.
