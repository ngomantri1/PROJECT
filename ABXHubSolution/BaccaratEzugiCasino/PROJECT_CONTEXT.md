# Project Context

Tai lieu nay tom tat code hien tai de AI/dev tiep tuc sua dung huong.

## Tong quan

- App la `WPF .NET 8` dieu khien ban `Baccarat Ezugi` qua `WebView2`.
- Chay 2 che do:
  - `Standalone` WinExe.
  - `Plugin` cho `AutoBetHub` qua `ABX.Core`.
- File trung tam:
  - `MainWindow.xaml.cs` (orchestration runtime).
  - `v4_js_xoc_dia_live.js` (JS inject vao page/frame).
  - `Tasks/*.cs` (chien luoc dat cuoc).

## Cap nhat moi nhat (2026-05-10)

- Da giam tai de tranh nghen app:
  - emergency switch `DisableHttpAndCdpTaps = true`.
  - CDP/HTTP tap de che do tat trong runtime hien tai.
- Trang thai bang dieu khien da doi theo `Prog`:
  - `Prog > 0` => `Cho phép đặt cược`.
  - `Prog <= 0` hoac `Prog = null` => `Đợi kết quả`.
  - Mau status trong WPF:
    - `Cho phép đặt cược`: xanh la.
    - `Đợi kết quả`: do.
- Tong cuoc `BANKER/PLAYER/TIE` da bo fallback cu, chi lay tu 3 selector co dinh:
  - `BANKER`: `div#main-bets > div.css-1o2wumy:nth-of-type(3)`
  - `PLAYER`: `div#main-bets > div.css-1or1crx:nth-of-type(1)`
  - `TIE`: `div#statistics > div.users-amount-container > div.statistics-amount-container:nth-of-type(2)`
- Pool scan DOM hien tai dung che do `preferred-tail-only`.
- Countdown source cho `play.livetables.io` van la `span.seconds`, co smoothing JS (`UI_PROG_HOLD_MS = 14000`).

## Cap nhat moi nhat (2026-05-11)

- Chuoi ket qua da chuyen sang huong `DOM board authority` (uu tien du lieu bang ket qua tren ban) thay vi phu thuoc CDP.
- Da doi lai logic authority table switch theo nghiep vu don gian:
  - doi ban => nhan context moi ngay (khong con gate reject weak-pull nhu truoc).
  - neu incoming seq cua ban moi co du lieu thi cap nhat ngay; neu khong co thi clear display de cho du lieu moi.
- Da bo sung flow bootstrap/switch de giam flash:
  - `waiting-board-bootstrap` co delay ngan (`600ms`) sau switch.
  - `waiting-board-bootstrap` chi hien toi da 1 lan moi switch.
- Da toi uu log/state cho nhanh `AUTH-KEEP-JS`:
  - van giu nghiep vu `net empty -> keep incoming seq`,
  - nhung log da duoc dedup theo state + heartbeat (`4s`) de giam spam/rung UI.
- Ket qua log sau patch:
  - `TABLE-SWITCH-REJECT = 0`,
  - `AUTH-WAIT-BOOTSTRAP` va `waiting-board-bootstrap` giam ro,
  - van con nhieu `AUTH-KEEP-JS` do nguon net seq dang rong nhung khong anh huong ket qua.

## Luu y deploy

- `v4_js_xoc_dia_live.js` duoc nap tu `EmbeddedResource` trong DLL.
- Sua file `.js` tren dia khong co hieu luc neu chua rebuild DLL va restart host.
- Can doi chieu log `[Bridge] Loaded JS from embedded ... sha256=...` de chac chan da nap ban moi.

## Flow chinh

1. App khoi tao `MainWindow`.
2. `EnsureWebReadyAsync()` khoi tao WebView2, hook bridge.
3. `VaoXocDia_Click()` tim dung game context (main/popup/frame).
4. Inject `v4_js_xoc_dia_live.js` vao top + frame.
5. JS day snapshot ve C# qua `postMessage`.
6. C# dung authority/context guard de chap nhan snapshot.
7. Strategy dat cuoc di qua `BuildContext()` + `TaskUtil.PlaceBet()` + `ExecuteOnBetWebAsync()`.
8. Pending chi finalize qua flow settle (`FinalizeLastBet` / `FinalizePendingBetsWithWinners`).

## Rule quan trong

- Khong bypass authority/context gate.
- Khong goi bet JS truc tiep ngoai pipeline `ExecuteOnBetWebAsync()`.
- Khong update WPF control tu background thread.
- Khong sua pending rows tuy tien ngoai flow finalize.
