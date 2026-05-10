# Bugs

Ghi chu nay chia lam 2 nhom:
- bug/risk hien tai suy ra tu code va cac guard/log dang ton tai,
- bug da co dau hieu da duoc fix hoac da co mitigation ro rang.

## Bug hien tai / risk hien tai

- `Pending bet` van co nguy co khong settle ngay.
  - Dau hieu: co nhieu guard `pending-not-settled`, `context-mismatch`, `seq-not-advanced`, `late-bind`.
- `Authority frame` co the lock sai hoac mat lock khi provider dung wrapper/iframe/popup phuc tap.
  - Dau hieu: co logic scout score, reject tick, authority lost, relock, proxy frame.
- `Game launch` van chua deterministic hoan toan.
  - Dau hieu: `VaoXocDia_Click()` phai dung nhieu fallback: click, reload iframe, popup route, trusted click.
- `Bet issued without full context` van la case dang duoc chan doan.
  - Dau hieu: co log `pending-recorded-without-context`, `missing-context`.
- `Countdown UX` van chua muot du tren `play.livetables.io` da doc dung nguon.
  - Dau hieu:
    - van co jump gap lon `12 -> 6`, `4 -> 0`
    - user muon nhin thay chuoi deu `12,11,10...0`
  - Trang thai:
    - da fix phan detect source `span.seconds`
    - da co smoothing o JS va WPF
    - da them log trace countdown moi o C# va JS de theo doi raw/display rieng
    - da tang hold-window (C# grace ~14s, JS `UI_PROG_HOLD_MS=14000`)
    - nhung smoothing hien tai chua giai quyet dut diem cadence gap-lon tu authority/raw snapshot
- `Countdown fix khong co hieu luc runtime` la risk deploy quan trong.
  - Dau hieu:
    - sua `v4_js_xoc_dia_live.js` nhung chay that van hanh vi cu
  - Nguyen nhan:
    - JS duoc nap tu `EmbeddedResource` trong DLL, khong doc truc tiep file `.js` disk
  - He qua:
    - de ket luan sai la "code fix khong dung" trong khi host dang chay DLL cu
- `MainWindow.xaml.cs` qua lon.
  - Day la bug kien truc: sua mot vung de lam vo vung khac.

## Bug da fix / da co mitigation

- 1 account chay nhieu session:
  - da co `sessionId + clientId` qua `worker.js` va lease acquire/release/heartbeat.
- Thieu resource anh khi chay plugin:
  - da co `PackRes` + inject image fallback vao `App`/`Window`.
- WebView2 fixed runtime:
  - da co fallback `fixed runtime -> Evergreen`.
- Bet double send cung round:
  - da co local dedupe, cooldown, in-flight guard trong `TaskUtil`.
- Start task khi bridge chua san:
  - da co preflight `__cw_bet`, cho tick va reinject bridge.
- Network winner den muon:
  - da co nhanh `late-context` / `late-winner` de co the settle pending.
- Startup lag/home login:
  - da giam tai bang cach ngung doc full HTTP body lon o home/login
  - da gate parse WebSocket nang chi khi vao dung game context
  - da them startup perf log de xac nhan UI thread load
- Canvas Watch khong hien khi de default visible:
  - da co reset token cho `abx.canvasWatch.visible.default`
  - da sua nhan dien route `play.livetables.io/baccarat` de `__cw_boot()` chay
- `SỐ DƯ` khong len canvas panel:
  - da khoa exact tail moi cua `play.livetables.io`
  - da merge `authSnap.totals` voi `S._lastTotals`
- Countdown khong doc duoc tren `play.livetables.io`:
  - da nhan duoc nguon `span.seconds`
  - da cap nhat len canvas panel va WPF status panel
- Countdown diagnostics:
  - da co `[COUNTDOWN][UI][RAW]`, `[COUNTDOWN][UI][DISPLAY]`, `[COUNTDOWN][TRACE]` ben C#
  - da co `CWDBG COUNTDOWN raw/display` ben JS
  - da co `[Bridge] Loaded JS from embedded ... sha256=...` de doi chieu ban script runtime

## Bug chua fix hoan toan

- Khong co automated tests.
- Launch flow provider-specific con phu thuoc heuristic URL/frame.
- Authority scoring van la heuristic, khong phai hard proof.
- Countdown smoothing/display cadence chua on dinh.
  - Van co kha nang nhay xa khi raw source update khong deu hoac authority snapshot den theo cum.
  - Can tiep tuc verify sau moi lan rebuild/restart host de loai tru truong hop runtime van dung DLL cu.
- Pending flow van phai dua vao nhieu fallback:
  - issued context
  - observed context
  - seq version
  - settle round
  - final winner grace
- Logic bridge dang bi phan tan giua nhieu noi nen de lech behavior khi sua.

## Nguyen nhan bug chinh

- Provider game nhung nhieu lop `iframe/about:blank/popup`.
- DOM snapshot va network packet khong den cung luc.
- Context game that (`table/shoe/round`) co the biet muon hon thoi diem bet.
- UI, WebView, JS inject, CDP tap va task strategy cung chia se state runtime lon.
- Nhieu fallback lich su lam logic rat kho tuyen tinh.
- Countdown UX hien tai con kho vi:
  - raw countdown update theo DOM/authority cadence, khong dam bao 1Hz deu
  - JS panel va WPF panel la 2 lop display rieng
  - authority snapshot van co the den tre hoac den theo buoc lon
  - deploy path la embedded JS nen de gap tinh huong sua source nhung runtime chua nap ban moi

## Workaround tam thoi

- Luon `Vao Xoc Dia` truoc, chi `Play` sau khi log/game state da san.
- Neu thay bridge thieu:
  - reinject bridge,
  - reload iframe,
  - route popup lai.
- Neu history co pending lau:
  - kiem tra log `context`, `seqVersion`, `winner`.
- Dung runtime profile `Performance` cho chay that, `Debug` cho chan doan.
- Voi countdown:
  - xem `span.seconds` la nguon dung
  - coi panel hien tai chi la display layer, khong xem no la authority logic
  - neu "khong thay doi sau khi sua code": check hash `[Bridge] Loaded JS from embedded` truoc khi ket luan
- Khi sua logic seq/context:
  - test lai `table switch`, `shoe switch`, `late winner`, `popup`.

## Vung code de loi

- `MainWindow.xaml.cs`
  - `HandleIncomingWebMessageAsync`
  - `ObserveFrameScout`
  - `ApplyNetworkSeqAuthorityLocked`
  - `TryProcessNetworkWinnerPacket`
  - `RecordBetIssuedUi`
  - `FinalizeLastBet`
  - `VaoXocDia_Click`
  - `PlayXocDia_Click`
- `v4_js_xoc_dia_live.js`
  - authority / scout
  - seq build / bootstrap
  - canvas watch
  - countdown display smoothing
  - bet queue / click pipe
- `Tasks/TaskUtil.cs`
  - dedupe send
  - settle wait
- `worker.js`
  - acquire / heartbeat / release TTL behavior

## Luu y cho AI coding

- Neu thay bug o UI, dung voi sua UI truoc khi kiem tra `authority`, `seq`, `context`, `pending`.
- Neu thay bug o strategy, kiem tra truoc xem snapshot task da authoritative chua.
- Neu thay bug "khong bet duoc", kiem tra:
  - `GetBetWebView()`
  - `__cw_bet`
  - armed frame count
  - popup/main source
