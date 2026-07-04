# Architecture

## Cau truc chinh

```text
BaccaratPragmatic/
- MainWindow.xaml(.cs)
- MainWindow.Startup.cs
- MainWindow.EmbedMode.cs
- WebView2LiveBridge.cs
- Models.cs
- Tasks/*
- v4_js_xoc_dia_live.js
- worker.js
- devtool_probe_bpt_pool_tails.js
```

## Module va vai tro

- `MainWindow.xaml.cs`
  - dieu phoi runtime, WebView/popup, authority context, countdown/status UI, pending/finalize.
- `v4_js_xoc_dia_live.js`
  - doc DOM game, day snapshot, doc countdown, doc tong cuoc B/P/T, panel Canvas Watch.
- `Tasks/*`
  - cac strategy (`IBetTask`) va tien ich dat cuoc.
- `worker.js`
  - lease/trial lock session.

## Thay doi kien truc moi nhat

- `CDP/HTTP tap` de emergency OFF de giam tai:
  - `DisableHttpAndCdpTaps = true`.
- Trang thai ben phai khong fallback tu nguon cu:
  - tinh truc tiep tu `Prog` (`>0` => cho dat cuoc, con lai doi ket qua).
- Pool B/P/T bo scan rong fallback, chi doc `preferred-tail-only` tu 3 selector da chot.
- Seq sync bo sung guard moi khi doi ban:
  - authority switch nhan context moi ngay theo table moi (uu tien dung nghiep vu doi ban nhanh).
  - incoming seq cua ban moi neu co thi push ngay len C# display.
  - `waiting-board-bootstrap` co delay ngan va chi hien 1 lan moi switch de giam flash.
  - log `AUTH-KEEP-JS` da dedup theo state + heartbeat de giam spam.
- Bet DOM duoc cap nhat theo giao dien baccarat moi:
  - nhan dien vung dat cuoc theo tail `#main-bets` (`css-1or1crx`/`css-1o2wumy`/`css-qso31z`).
  - giu flow cu C# -> `cwBet` -> JS, chi doi heuristics DOM side/target.
- Chip DOM duoc cap nhat theo toolbar moi:
  - scan them `.chip-selector__chip-container`, `.chip-selector__chip-container--selected`.
  - parse menh gia `2.5M` va bo sung allow-set `25K`, `250K`, `2.5M`.
- Canvas Watch visibility policy duoc chuan hoa:
  - khong con force `display:block` trong `__abxStartAuthority()` khi default dang la hidden.
  - root panel luon theo `CW_PANEL_VISIBLE_DEFAULT` + localStorage override.
- Dieu tra/stabilize pragmatic frame-route (2026-05-17):
  - bo sung theo doi nav cua frame qua `FrameNavigationStarting/Completed` de lay dung `target` theo `frameId|navId`.
  - log loi theo frame: `[FrameNav][ERR]`, `[FrameNav][ERR-PAGE]`.
  - authority scout boost cho top `gs2c/game/load` khi score DOM yeu (score=0/rat thap) de khong mat authority vao host frame.
  - bo sung `authority rebind same-game-href` de xu ly truong hop context key doi nhung van cung game URL.
  - bo sung UI guard popup-frame error page (`chrome-error://chromewebdata`) de fallback UI ve main web, khong can thiep cert/TLS.
- TLS/provider route hardening (2026-06-30):
  - hook `ServerCertificateErrorDetected` tren ca main WebView va popup WebView.
  - whitelist hep: chi `pragmaticplaylive.net` / `*.pragmaticplaylive.net`, chi CN mismatch.
  - khi allow TLS thi log `[TLS-BYPASS][ALLOW]`, set status hint va schedule retry.
  - retry hien tai navigate lai cung launcher URL sau 650ms, toi da 2 lan/URL.
  - fallback hien tai sau 8500ms neu con ket `popup-tls-retry-pending`: close popup, reset authority/pipeline, goi lai `VaoXocDia_Click()` de lay launcher URL/token moi.
  - user bao van `File Not Found`, nen kien truc route can tiep tuc xem lai theo log moi: co the can bo retry cung URL va uu tien reacquire launcher moi som hon.

## Data flow (hien tai)

1. WebView load game.
2. JS inject vao top/frame.
3. JS doc:
  - countdown (`span.seconds`),
  - tong cuoc B/P/T tu 3 selector co dinh,
  - bang ket qua (full board scan + raw seq),
  - thong tin can thiet khac.
4. JS push snapshot ve C#.
5. C# authority gate + netseq gate:
  - neu net seq rong thi giu incoming DOM seq (khong doi net).
  - khi switch ban: nhan context moi ngay, neu incoming seq rong thi moi hien `waiting-board-bootstrap`.
  - `waiting-board-bootstrap` duoc throttle de tranh spam UI.
6. C# update UI status/progress/totals/seq theo snapshot authority.
7. Strategy su dung `GameContext` de dat cuoc.

## Error-path quan trong (2026-05-17)

1. Popup/child frame dieu huong vao launcher/game url.
2. Neu WebView2 tra ve status loi (`WebErrorStatus`) hoac target thanh `chrome-error://chromewebdata`:
  - ghi log `[FrameNav][ERR*]`.
  - neu frame do la popup frame dang duoc theo doi -> kich hoat `[UI-GUARD]` fallback UI.
3. App KHONG bypass SSL/cert.
4. Neu cert provider sai (vd CN mismatch) thi van co the fail theo tung lan vao game.

## Error-path Pragmatic TLS / File Not Found (2026-06-30)

1. Host NET88 dieu huong qua `games.pragmaticplaylive.net/api/secure/GameLaunch`.
2. Provider redirect sang `client.pragmaticplaylive.net/desktop/launcher/...`.
3. WebView2 co the bao cert CN mismatch tren launcher.
4. App hien tai allow loi nay theo whitelist hep.
5. Sau allow, van co the nhan:
  - `PopupWeb NavigationCompleted: Err Unknown`
  - UI trong popup hien `File Not Found`
  - stage `popup-tls-retry-pending`
6. Retry cung URL co kha nang khong du vi launcher URL/token/JSESSIONID da fail hoac het hieu luc.
7. Huong fix tiep theo:
  - log ro cac moc `[TLS-BYPASS][FALLBACK-*]`.
  - neu fallback da chay ma van File Not Found, doi sang flow reacquire launcher moi thay vi reload URL cu.
  - can so sanh log voi `TaiXiuLiveHit` o doan click/open game va popup/new-window routing.

## DOM bet flow (layout moi)

1. `findBetTarget()` (DOM mode) lay candidates tu `domCollectBetTargetCandidates()`.
2. Candidate duoc score theo tail/text/rect; uu tien host thuoc `#main-bets`.
3. Side duoc map theo text; neu text yeu thi map theo tail class (`css-1or1crx`/`css-1o2wumy`/`css-qso31z`).
4. Chip scan uu tien chip toolbar (`chip-selector__chip-container*`) va parse token K/M (co ho tro `2.5M`).
5. Sau click cua cuoc, confirm step chap nhan them keyword `DAT CUOC`/`PLACE BET`.

## Countdown va status flow

- Raw countdown lay tu DOM source (`span.seconds`).
- Display countdown co smoothing JS (`UI_PROG_HOLD_MS = 14000`).
- Status WPF:
  - `Cho phép đặt cược` (xanh) khi `Prog > 0`.
  - `Đợi kết quả` (do) khi `Prog <= 0` hoac null.

## Bet pool flow (B/P/T)

- Nguon duy nhat:
  - `BANKER`: `div#main-bets > div.css-1o2wumy:nth-of-type(3)`
  - `PLAYER`: `div#main-bets > div.css-1or1crx:nth-of-type(1)`
  - `TIE`: `div#statistics > div.users-amount-container > div.statistics-amount-container:nth-of-type(2)`
- Log debug: `BETPOOL preferred-tail-only`.
- Khong con fallback ve zone/chip/scan rong cu.

## Deploy note

- JS la embedded resource trong DLL.
- Bat buoc rebuild + restart host sau moi sua JS.
- Neu doi default hidden/visible cua Canvas Watch ma runtime con nho state cu, can bump `CW_PANEL_VISIBLE_DEFAULT_REV`.

## Canvas Watch / Countdown Pragmatic route (2026-07-03)

- Route game Pragmatic hiện tại không còn giống route cũ:
  - launcher top: `/desktop/launcher/`
  - game frame: `/desktop/baccarat/`
  - video: `/apps/video/2.0.19/index.html`
- `v4_js_xoc_dia_live.js` phải coi `/desktop/baccarat/` là game page hợp lệ để:
  - dựng Canvas Watch root,
  - autostart panel,
  - push snapshot về C#.
- Khi game không có Cocos context cũ, `collectProgress()` đi qua DOM path:
  1. `collectProgress()`
  2. `domReadBetCountdown()`
  3. `countdownProviderReadFresh()` nếu network/json đã bắt được countdown
  4. `domReadPragmaticVisualCountdown(contexts)` cho route `/desktop/baccarat/`
  5. fallback cũ `domScanBaccaratCards()`
- `domReadPragmaticVisualCountdown()` hiện có 2 lớp dò:
  - scan DOM text nodes trong vùng giữa-dưới màn hình.
  - fallback `elementFromPoint()` quanh vùng vòng countdown thực tế rồi dò node con/cha gần nhất.
- Các tail/class đã xác định là không phải countdown vẫn bị loại:
  - bet pool,
  - Player/Banker/Tie card values,
  - road/bead/history/card nodes.
- Vấn đề chưa giải quyết: countdown vòng tròn có thể không nằm trong DOM text thường, hoặc node dưới điểm không expose text; do đó `Prog` vẫn có thể là `--`.

## JS -> C# log flow cho Countdown (2026-07-03)

- JS dùng `cwDbg(tag, msg, data, throttleMs, key)`.
- Log JS được batch qua `cwLogBatch` và gửi bằng `chrome.webview.postMessage`.
- C# nhận trong `HandleIncomingWebMessageAsync()` rồi gọi `IngestJsLogBatch()`.
- Trước đây `COUNTDOWN` không nằm trong nhóm luôn ghi file, và `_enableJsFileLog` chỉ bật khi RuntimeProfile là Debug.
- Hiện tại tag `COUNTDOWN` là diagnostic bắt buộc:
  - JS vẫn gửi `COUNTDOWN` dù `window.__cw_file_log_enable` tắt.
  - C# vẫn ghi item tag `COUNTDOWN` dù `_enableJsFileLog=false`.
- Các dòng cần theo dõi:
  - `[CWDBG][COUNTDOWN] pragmatic-visual-hit`
  - `[CWDBG][COUNTDOWN] pragmatic-visual-miss`
  - `[CWDBG][COUNTDOWN] collect-hit`
  - `[CWDBG][COUNTDOWN] collect-miss`
- `pragmatic-visual-miss` có `diag` để phân tích:
  - `contexts`: có thấy frame `/desktop/baccarat/` không.
  - `pointHits`: `elementFromPoint` có trả phần tử không.
  - `pointRoots`: số node cha/con đã scan quanh điểm.
  - `scanned`: tổng node đã xét.
  - `numeric`: số node có text dạng `0..20`.
  - `rejectedRect`, `rejectedRegion`, `rejectedBad`: lý do bị loại.

## Route vào game Pragmatic (2026-07-01)

- WebView2 dùng chung `_webEnv`. Mọi nơi tạo environment phải đi qua `BuildWebView2EnvironmentOptions()` để giữ cùng cấu hình.
- `BuildWebView2EnvironmentOptions()` thêm `AdditionalBrowserArguments` với host resolver rule:
  - `MAP client.pragmaticplaylive.net 13.227.227.64`
  - `EXCLUDE localhost`
- Lý do host-map: DNS hệ thống có thể resolve `client.pragmaticplaylive.net` về IP lỗi certificate (`CN=*.greennet.net.vn`). JS probe không xử lý được lỗi này vì TLS fail xảy ra trước khi page/script load.
- Main WebView và popup WebView đều hook certificate handler. TLS bypass chỉ whitelist `pragmaticplaylive.net`/subdomain và chỉ allow lỗi common-name mismatch, không mở rộng sang domain khác.
- Popup flow hiện tại bắt chước `BaccaratEzugiCasino`:
  1. `NewWindowRequested` tạo hoặc reuse `_popupWeb`.
  2. Gán `e.NewWindow = popupWeb.CoreWebView2`.
  3. Popup tự nhận route `about:blank`, `playGame.do`, `GameLaunch`, `launcher`.
  4. `PopupWeb_NewWindowRequested` xử lý nested popup trong popup, không đẩy route chính về main WebView.
- `PopupWeb_NavigationStarting` và `PopupWeb_NavigationCompleted` ghi log route qua `LogRouteUrlParts` để tách:
  - host chính,
  - path,
  - query/tham số,
  - stage như `pragmatic-playgame`, `pragmatic-gamelaunch`, `pragmatic-launcher`.
- Khi gặp `File Not Found`, `Err Unknown`, hoặc launcher navigation error:
  1. log stage lỗi,
  2. thử recovery có kiểm soát,
  3. đóng popup stale,
  4. reset main về lobby Pragmatic được build theo host hiện tại,
  5. click lại để lấy launcher token mới thay vì reload token cũ.
- Injection popup phải dùng local `popupWeb`/`core` đã capture trước `await`. Event `DOMContentLoaded` cũ có thể bắn sau khi popup bị đóng, nên không được truy cập trực tiếp `_popupWeb` sau `await`.
