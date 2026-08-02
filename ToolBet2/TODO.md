# TODO

## High Priority

Không có TODO mức cao được xác nhận trong source hoặc lịch sử Git khả dụng.

## In Progress

Không xác định được task đang làm dở. Project chưa được Git theo dõi nên không có diff/commit theo path để làm bằng chứng.

## Pending

Không tìm thấy marker `TODO`, `FIXME`, `HACK` hoặc `NotImplemented` có ý nghĩa trong `main.py`, `src/` và `scripts/`.

## Refactor / Technical Debt

Không ghi nhận refactor bắt buộc nào. Các khối `pass` đã kiểm tra là base class hoặc nhánh bỏ qua exception/fallback, không đủ bằng chứng để gọi là code chưa hoàn thiện.

## Needs Testing

- Chưa có test suite. Các flow browser/live casino, recovery, click chip và end-to-end persistence chưa có bằng chứng kiểm thử tự động trong project.
- Kiểm tra tĩnh ngày 2026-08-02: 54 tệp Python parse thành công và 48 module `src` import thành công.

## Suggested Improvements

Các mục dưới đây là đề xuất từ khảo sát, không phải yêu cầu đã được xác nhận:

- Thêm test đơn vị cho `pattern_analyzer`, `progression`, `betting_session`, chip planner và `tie_nurture_engine`.
- Thêm test integration dùng fixture payload cho WS/HTTP reconciliation, không kết nối casino thật.
- Thiết lập `.gitignore`/secret scanning trước khi track project.
- Xác lập một lệnh kiểm tra chuẩn (ví dụ lint + test + import smoke test).

