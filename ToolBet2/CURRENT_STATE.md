# Current Project State

## Build / Run Status

- Khảo sát ngày 2026-08-02: 54 tệp Python parse AST thành công; 48 module dưới `src` import thành công bằng `.venv`.
- Không có test suite, `pyproject.toml` hay `setup.py`; chưa xác minh end-to-end với casino.
- Không chạy `main.py` trong lần khảo sát vì flow mở session browser/casino thật. Cấu hình hiện có `auto_bet: false`.
- `data/toolbet.db` tồn tại, đủ 6 bảng; hiện có 1 hall và chưa có table/round/bet/group/event.

## Current Work

- Không thể xác định chắc chắn feature đang phát triển: toàn bộ `ToolBet2` chưa được Git theo dõi trong repo cha nên không có commit history riêng.
- Source hiện tập trung mạnh vào AE SEXY: multi-source history reconciliation, table/session recovery, overlay và auto betting.

## Recently Changed

- Status: Chưa xác nhận. Git không có commit nào theo path `ToolBet2`; timestamp file không đủ để kết luận nội dung thay đổi.

## Active Areas

- `src/ae_sexy.py` — navigation/health/recovery lớn nhất.
- `src/ae_sexy_collector.py` — source-of-truth lịch sử.
- `main.py` — orchestration và recovery.
- `src/overlay.py` — UI runtime.
- `src/auto_bettor.py` và `src/ae_sexy_betting.py` — safety/execution cược.

## Current Known Problems

- Không có `.gitignore` trong project trong khi có credential, DB và Chrome profile cục bộ.

## Next Suggested Actions

1. Thêm ignore/protection cho secret và runtime data trước khi đưa project vào Git.
2. Thêm test thuần cho pattern, chip planning, progression, limit và tie engine trước khi sửa browser flow.

## Important Files For Next Session

- `main.py`
- `src/ae_sexy_collector.py`
- `src/auto_bettor.py`
- `src/progression.py`
- `src/pattern_analyzer.py`
- `src/database.py`
- `BUGS.md` và `TODO.md`
