# Architecture

## Sơ đồ runtime

```text
ToolBet.bat -> main.py / HistoryWatcher
  -> ToolAuth -> Game Login/site adapter -> BrowserManager/Chrome CDP
  -> AE SEXY collector (WS/HTTP + DOM/canvas hỗ trợ)
  -> TableState -> strategy tabs/lifecycle -> AutoBettor
  -> ae_sexy_betting (chip/zone UI) -> journal/reconcile -> SQLite
  -> GameOverlay/UI runtime trong trang game
```

`HistoryWatcher` là composition root và điều phối lifecycle. Một asyncio event
loop được dùng; Playwright là async. Không có backend web riêng trong runtime
customer.

## Ranh giới module

- `main.py`: startup, login/navigation, table/recovery loop và callback state.
- `src/browser.py`: kết nối CDP, chọn page, cửa sổ và reconnect lifecycle.
- `src/sites/`, `src/auth_flows.py`: site binding, login và selector riêng từng web.
- `src/ae_sexy.py`: phase lobby/room/loading, vào bàn và recovery.
- `src/ae_sexy_collector.py`, `src/ae_sexy_ws.py`, `src/ae_sexy_http.py`:
  thu thập, chấm nguồn và reconcile history/round.
- `src/strategy_tabs.py`, `src/statistical_strategies.py`,
  `src/strategy_lifecycle.py`: catalog, input và state theo tab.
- `src/auto_bettor.py`, `src/betting_session.py`, `src/progression.py`,
  `src/tie_nurture_engine.py`: arm, pending, progression, limit và settlement.
- `src/ae_sexy_betting.py`: phân rã chip, chọn cửa, click/verify zone.
- `src/database.py`, `src/db_store.py`, `src/money_state_store.py`: schema,
  migration additive, journal và snapshot MoneyManager.
- `src/overlay.py`, `src/ui_runtime.py`, `src/ui/bridge.js`: contract, inject,
  patch vùng UI và command; UI không phải authority đặt cược.
- `src/tool_auth.py`, `src/license_client.py`, `src/reference_license.py`:
  Tool session và license/lease.

## Luồng dữ liệu và cược

1. Collector nhận payload provider, đối chiếu identity table/shoe/round và cập
   nhật `TableState` khi dữ liệu đủ tin cậy.
2. History update resolve pending trước, sau đó strategy tab tính signal.
3. Start có thể arm từ history hiện có; arm snapshot table/round/config và chờ
   cửa cược hữu hạn.
4. AutoBettor kiểm tra run latch, mode, license/gate, pending và duplicate.
   Simulation vẫn tạo allocation/journal nhưng không gọi chip executor.
5. Live phân rã stake theo chip, click zone và ghi placement evidence. Kết quả
   kế tiếp chỉ resolve allocation đủ điều kiện; `uncertain`/`deferred` không được
   biến thành win/loss.

## State/persistence ownership

- `TableState`: bàn, phase, history và metadata round hiện tại.
- `BettingSession`/`AutoBettor`: pending và execution lifecycle trong process.
- `StrategyTabStore`: cấu hình tab và mode; `MoneyStateStore`: snapshot manager.
- SQLite `bets` là logical bet; allocation/placement-attempt là audit chi tiết.
- `GameOverlay` chỉ phản chiếu snapshot; `HistoryWatcher` là authority cho run.

## Table selection

`main.py::_enter_table_from_lobby()` lấy candidate từ
`src/ae_sexy.py::lobby_table_candidates()`, scroll card, thử
`enter_ae_sexy_table()` và chỉ dừng khi room/table-ready guard đạt. Overlay được
ẩn/passthrough khi cần; card bị che vẫn có thể tìm bằng locator/frame, nhưng
click thành công riêng lẻ chưa phải bằng chứng room-ready. Xem chi tiết và log
codes trong [TABLE_SELECTION_WORKFLOW.md](TABLE_SELECTION_WORKFLOW.md).

## Recovery và an toàn

Navigation/reload có thể thay page/frame/overlay. Recovery phải bind lại target,
không chạy đồng thời với bettor bận, không dùng history cũ cho bàn mới và không
đặt lại cùng table/shoe/round. Schema chỉ được nâng cấp qua migration tương
thích trong `src/database.py`.
