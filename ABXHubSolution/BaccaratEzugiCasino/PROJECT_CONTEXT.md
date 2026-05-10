# Project Context

Tai lieu nay duoc tao tu viec doc code hien tai cua project, tap trung cho AI coding.

## Tong quan

- Project la ung dung `WPF .NET 8` dieu khien ban `Baccarat Ezugi` qua `WebView2`.
- Ung dung chay duoc theo 2 mode:
  - `Standalone` WinExe.
  - `Plugin` cho `AutoBetHub` qua `ABX.Core`.
- Logic chinh khong nam o backend server rieng. Phan quan trong nhat la:
  - `MainWindow.xaml.cs`: orchestration runtime.
  - `v4_js_xoc_dia_live.js`: JS inject vao game/page/frame.
  - `Tasks/*.cs`: engine chien luoc cuoc.
  - `worker.js`: Cloudflare Worker cho lease/trial.

## Tinh hinh hien tai sau cap nhat 2026-05-10

- Startup/home page da duoc giam tai ro:
  - khong con doc full HTTP body lon o trang home/login,
  - chi parse WebSocket nang khi da vao dung context game,
  - da them log `[PERF][STARTUP]`, `[PERF][UI]`, `[PERF][UI][STARTUP]` de do do tre UI thread luc khoi dong.
- Canvas Watch panel da duoc sua de hien lai dung tren `play.livetables.io`:
  - co token reset state `abx.canvasWatch.visible.default`,
  - route `play.livetables.io/baccarat?...` duoc coi la game popup hop le va cho phep `__cw_boot()`.
- HUD/Canvas da nhan dung du lieu cua `play.livetables.io`:
  - khoa exact tail moi cho `SỐ DƯ`,
  - merge `authSnap.totals` voi `S._lastTotals` de balance len duoc tren canvas panel,
  - countdown DOM moi duoc doc tu `span.seconds`.
- Countdown hien da co nguon DOM dung va co smoothing cho:
  - panel JS (`Canvas Watch`),
  - thanh/thoi gian WPF ben phai.
- Logging ngay 2026-05-10 xac nhan van con raw jump gap-lon:
  - co chuoi thuc te `12 -> 6 -> 0` trong runtime log.
  - Nghia la bug khong nam o render text don thuan; raw snapshot cadence van den theo buoc lon.
- Da bo sung trace countdown moi de chan doan:
  - C#: `[COUNTDOWN][UI][RAW]`, `[COUNTDOWN][UI][DISPLAY]`, `[COUNTDOWN][TRACE]`.
  - JS: `CWDBG COUNTDOWN raw/display`.
- Da doi hold-window cho display countdown:
  - C#: `UiCountdownMissingGrace ~ 14s` (giu anchor khi thieu raw tick ngan/trung binh).
  - JS: `UI_PROG_HOLD_MS = 14000`.
- Da them timer trace nen (`System.Threading.Timer`) de log sec countdown theo tung giay, khong phu thuoc hoan toan vao nhac UI dispatcher.
- Luu y deploy quan trong:
  - `v4_js_xoc_dia_live.js` dang duoc nap tu `EmbeddedResource` trong DLL, khong doc truc tiep file `.js` tren dia khi runtime.
  - Muon thay doi JS co hieu luc phai rebuild plugin DLL va restart host (`AutoBetHub`) de nap assembly moi.
  - Can doi chieu log `[Bridge] Loaded JS from embedded ... sha256=...` de chac chan host da nap ban script moi.

## Cong nghe su dung

- C# `net8.0-windows`, WPF.
- `Microsoft.Web.WebView2`.
- JavaScript injected vao page/frame.
- CDP `DevToolsProtocol` de tap WebSocket/HTTP response.
- `ABX.Core` cho plugin host.
- GitHub raw JSON cho license.
- Cloudflare Worker KV cho lease/trial.

## Flow hoat dong chinh

1. App/plugin khoi tao `MainWindow`.
2. `LoadConfig()` nap multi-tab config, stats, runtime profile.
3. `EnsureWebReadyAsync()` khoi tao WebView2, hook event, bridge, CDP neu can.
4. `RunStartupAsync()` hoac user action se navigate URL, autofill login, ap nen.
5. `VaoXocDia_Click()` tim game context:
   - reuse tin hieu game neu con nong,
   - click title / reload iframe / route popup neu can.
6. `EnsureToolBridgeInjectedAsync()` inject `v4_js_xoc_dia_live.js` vao top page va frame.
7. JS gui `tick/frame_scout/js_console/cwLogBatch/...` ve C# qua `chrome.webview.postMessage`.
8. C# chon `authority context`, hop nhat DOM snapshot + CDP network state thanh snapshot authoritative.
9. C# co the day nguoc `csharp display snapshot` sang JS de panel canvas dung cung state authoritative.
10. Countdown hien co 2 lop:
   - `raw countdown` tu DOM/authority snapshot,
   - `display countdown` noi suy cho UI/canvas.
11. Muc tieu cua display countdown la muot theo thoi gian that ma khong lam sai authority snapshot.
12. Tu 2026-05-10 co them lop trace countdown:
   - trace raw/display o C# + JS,
   - dung de tach ro loi "raw nhay buoc lon" va loi "display khong repaint deu".
13. Khi `Play`:
   - verify license/lease,
   - cho `__cw_bet` + tick san sang,
   - build `GameContext`,
   - chay `IBetTask` theo tab active.
14. Task goi `ExecuteOnBetWebAsync()` de enqueue bet.
15. Bet duoc ghi vao history o trang thai `pending`.
16. Khi nhan winner/seq advance/context settle, `FinalizeLastBet()` moi chot ket qua.

## WebSocket flow

- Co 2 lop message khac nhau:
  - `WebView JS -> C#`: snapshot/tick/log/scout qua `postMessage`.
  - `Game network -> C#`: CDP tap `WebSocket/HTTP` de lay winner/history/bet pool/context.
- Nguon seq authoritative hien tai uu tien:
  - DOM bootstrap dung context.
  - Sau do append/sync bang network winner/history.
- Khong dung truc tiep packet nao lam UI ngay neu khong qua gate `authority/context`.

## Pending flow

- Bet hop le duoc tao `BetRow` va them vao `_pendingRows`.
- Pending row luu:
  - `IssuedSeqDisplay/Calc/Version/Event`
  - `IssuedTableId/GameShoe/ObservedRound`
  - `SawClosedAfterIssue`
- Pending chi duoc chot qua:
  - `FinalizeLastBet(...)`
  - `FinalizePendingBetsWithWinners(...)`
- Khi reset context/shoe/table:
  - row co the bi drop `RESET-CONTEXT`
  - hoac duoc giu tam neu con kha nang cho final winner.
- Day la flow nhay cam nhat cua project. Khong duoc "don gian hoa" neu chua hieu het cac guard.

## Threading / UI rules

- UI chi update qua `Dispatcher`.
- Task chien luoc chay background nhung moi update UI/history/tab-state phai marshal ve UI thread.
- Snapshot runtime dung lock:
  - `_snapLock` cho snapshot cuoi.
  - `_roundStateLock` cho seq/context/network state.
- Ghi file config/stats dung `SemaphoreSlim`:
  - `_cfgWriteGate`
  - `_statsWriteGate`
- Timer dung ca `DispatcherTimer` va `System.Threading.Timer`; khong duoc cham control WPF truc tiep tu timer nen.

## Coding rules

- Uu tien sua theo partial flow hien co, khong nhet them logic moi vao UI event neu da co helper tuong ung.
- Bet phai di qua:
  - `BuildContext()`
  - `TaskUtil.PlaceBet()`
  - `ExecuteOnBetWebAsync()`
- Snapshot task phai lay tu:
  - `CloneAuthoritativeTaskSnap()`
  - `CloneAuthoritativeRawSnap()`
- Dong bo seq/context phai di qua `ApplyNetworkSeqAuthorityLocked()` va cac guard context hien co.
- Finalize history phai di qua `FinalizeLastBet()`, khong tu sua `_pendingRows` tuy tien.
- Khi them JS bridge moi:
  - inject o document created,
  - inject lai cho frame/popup,
  - giu tuong thich `main web` va `popup web`.

## Naming rules

- `Cw*`: model/snapshot tu canvas-watch/JS.
- `_net*`: state den tu network/CDP.
- `_active*`: context game dang active sau khi resolve.
- `_authority*`: frame/context da lock lam nguon hop le.
- `_pending*`: bet/history chua settle.
- `*Async`: ham async that.
- `Task` trong `Tasks/`: chien luoc cuoc cu the, implement `IBetTask`.

## Rule quan trong

- `MainWindow.xaml.cs` la orchestration khong lo; moi thay doi phai gioi han dung vung.
- `UseDomBootstrapCdpAppendSeq` la tu duy cot loi: DOM bootstrap, network append.
- `GetBetWebView()` quyet dinh bet dang ban vao `Web` hay `PopupWeb`.
- `authority context` quyet dinh tick nao duoc accept.
- `play.livetables.io/baccarat` hien la 1 route quan trong, da co handling rieng cho boot panel, balance va countdown.
- `context reset` va `shoe switch` phai reset seq/network/base state dong bo.
- Khong co OCR that; project dung DOM/canvas/Cocos introspection.

## Nhung dieu tuyet doi khong duoc pha

- Khong bo gate `authority` khi nhan tick/frame data.
- Khong bypass `ExecuteOnBetWebAsync()` de goi `Web.ExecuteScriptAsync()` truc tiep cho logic cuoc.
- Khong finalize bet chi dua vao UI text/status.
- Khong cap nhat WPF control tu background thread.
- Khong ghi config/stats song song ngoai gate.
- Khong pha route `main web <-> popup web`.
- Khong doi semantic cua `IssuedTableId/GameShoe/ObservedRound` neu chua sua toan bo pending flow.
- Khong doi ten/behavior cac JS API loi neu chua sua ca C#:
  - `__cw_startPush`
  - `__cw_readSnapshot`
  - `__cw_bet`
  - `__cw_bet_enqueue`
  - `__abxStartAuthority`
