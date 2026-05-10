# TODO

Ghi chu nay la TODO suy ra tu code hien tai, log guard va cau truc project; khong phai issue tracker chinh thuc.

## Task dang lam

- On dinh `authority frame` de chi nhan dung tick tu game frame that.
- Giu `DOM bootstrap + CDP append` khong lam lech chuoi ket qua khi doi ban/doi shoe.
- On dinh route `main web -> popup web` cho cac provider launch flow khac nhau.
- Giam truong hop `pending` khong settle do thieu context hoac seq chua advance dung.
- Hoan thien smoothing countdown de UX di dung tung nhip `12,11,10...0` tren:
  - canvas panel
  - thanh/timer WPF ben phai
- Chan doan va chot nguyen nhan runtime "khong thay doi" countdown:
  - xac nhan host da nap DLL moi (embedded JS) sau rebuild/restart
  - xac nhan log countdown da ra lien tuc theo display cadence

## Task chua hoan thanh

- Tach `MainWindow.xaml.cs` thanh nhieu partial/service nho hon.
- Hop nhat logic bridge dang bi trung giua `MainWindow` va `WebView2LiveBridge.cs`.
- Chuan hoa provider-specific launch flow dang con nhieu fallback cung.
- Chot 1 display-countdown model dung cho ca JS va WPF thay vi moi ben tu noi suy rieng.
- Bo sung test/manual checklist cho cac case:
  - table switch
  - shoe switch
  - popup route
  - network winner late
  - pending late-bind
  - countdown jump gap lon
- Chot quy trinh deploy khi sua JS embedded:
  - rebuild plugin DLL
  - restart host AutoBetHub
  - doi chieu sha256 script trong log bridge

## Task can refactor

- `MainWindow.xaml.cs` qua lon, kho reasoning va de regression.
- Gom nhom state `_net*`, `_active*`, `_authority*` thanh model/service ro rang hon.
- Tach history settlement khoi UI class.
- Tach license/lease khoi `MainWindow`.
- Tach parser CDP packet/history/bet-pool khoi orchestration UI.
- Giam duplication giua strategy callbacks va update UI tab state.

## Task uu tien cao

- Bao ve `pending flow` khoi finalize sai context.
- Bao ve `authority lost/switch` khoi nhan nham tick tu wrapper/about:blank frame.
- Kiem tra moi duong vao bet deu di qua `__cw_bet_enqueue`.
- Giu `GetBetWebView()` chon dung `PopupWeb` khi popup active.
- Ra soat lai `context reset` de khong drop nham pending row van con cho final winner.
- Sua countdown jump:
  - khong duoc roi buoc lon `12 -> 6`, `4 -> 0`
  - uu tien ra duoc chuoi so nguyen `12,11,10...0`
  - neu nguon raw bi thua/tre thi display layer phai bu offset de van di tung giay
- Dam bao log countdown dung du de ket luan:
  - `[COUNTDOWN][UI][RAW]` phan biet raw source update
  - `[COUNTDOWN][UI][DISPLAY]` va `[COUNTDOWN][TRACE]` phan biet repaint/display 1Hz
  - `CWDBG COUNTDOWN raw/display` phia JS panel

## Task can test lai

- `Play` ngay sau `VaoXocDia` khi bridge moi inject.
- Game launch bang:
  - click title thuong
  - trusted click
  - iframe reload
  - popup route
- Sequence khi:
  - vao giua shoe
  - doi shoe
  - doi table
  - late network winner
- Lease/license:
  - acquire
  - heartbeat
  - release
  - recheck 5 phut/lan
- Money strategy:
  - `MultiChain`
  - `Victor2`
  - `WinUpLoseKeep`
- `play.livetables.io/baccarat`:
  - panel auto hien khi `CW_PANEL_VISIBLE_DEFAULT = true`
  - balance len ca canvas va WPF
  - countdown source `span.seconds`
  - countdown UX co con jump gap lon hay khong
  - countdown log co lien tuc khong:
    - C#: `TRACE`/`DISPLAY` co xuong tung giay
    - JS: `displayWhole` co di `12..0`
- Deploy verify:
  - check `[Bridge] Loaded JS from embedded` co hash moi
  - neu hash cu: ket qua test countdown khong hop le vi chua nap code moi

## Candidate improvements

- Them tai lieu rieng cho provider matrix / launch quirks.
- Them replay log hoac snapshot log compact cho bug settle.
- Them test harness cho parser `winner/history/bet-pool`.
- Them debug log rieng cho countdown:
  - raw sec
  - display sec
  - drift/gap
  - source tail
  - source hash/embedded version de tranh "sua JS nhung host chay code cu"
- Them smoke test cho JS API:
  - `__cw_readSnapshot`
  - `__cw_startPush`
  - `__cw_bet_enqueue`
