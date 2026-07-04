# Project Context

Tai lieu nay tom tat code hien tai de AI/dev tiep tuc sua dung huong.

## Tong quan

- App la `WPF .NET 8` dieu khien ban `Baccarat Pragmatic` qua `WebView2`.
- Nguon goc: migrate tu project cu `BaccaratEzugiCasino` (giu lai mot so ten file/JS de tuong thich).
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
- Da sua logic dat cuoc DOM de theo layout web moi (khong doi pipeline C# -> JS):
  - bo sung nhan dien side dat cuoc theo tail `#main-bets`:
    - `PLAYER` ~ `div.css-1or1crx`
    - `BANKER` ~ `div.css-1o2wumy`
    - `TIE` ~ `div.css-qso31z`
  - bo sung fallback map side theo tail khi text tren host khong ro.
- Da cap nhat scan/parse chip DOM theo thanh chip moi:
  - selectors: `.chip-selector__chip-container`, `.chip-selector__chip-container--selected`.
  - parse duoc menh gia co thap phan (`2.5M`).
  - allow-set DOM bo sung: `25K`, `250K`, `2.5M` (tuong ung `25000`, `250000`, `2500000`).
- Da fix bug Canvas Watch nhay 1 nhip luc moi vao khi de mac dinh an:
  - nguyen nhan: `__abxStartAuthority()` tung force `#__cw_root_allin` -> `display:block`.
  - fix: thay bang goi `__cw_applyPanelDisplayOwner(...)` de ton trong cau hinh `CW_PANEL_VISIBLE_DEFAULT=false`.

## Cap nhat moi nhat (2026-05-17)

- Van de "luc vao duoc, luc khong vao duoc" da duoc khoanh vung ro:
  - frame con cua Pragmatic co luc roi vao `chrome-error://chromewebdata`.
  - nguon goc ben ngoai app: cert mismatch (`CertificateCommonNameIsIncorrect`) tren launcher/frame cua provider.
- Da them log dieu tra frame-nav de boc tach loi theo frame:
  - `[FrameNav][ERR] frameId/navId/status/target`
  - `[FrameNav][ERR-PAGE]` khi target la `chrome-error://chromewebdata`.
- Da cung co authority de giam mat ngu canh khi vao game:
  - top frame `gs2c` duoc boost score toi thieu (de khong thua host frame score thap).
  - them `[AUTH][REBIND] reason=same-game-href` khi context key doi nhung game href giong nhau.
- Da them UI guard toi thieu, KHONG bypass cert:
  - neu popup-frame trung `chrome-error://chromewebdata` thi fallback ve main web + reset pipeline popup.
  - log: `[UI-GUARD] popup frame hit chrome-error page, fallback to main web.`
- Gioi han hien tai:
  - UI guard chi tranh "ket may trang" o UI.
  - neu cert/SSL ben provider sai o thoi diem do thi van co the khong vao duoc game.

## Cap nhat moi nhat (2026-06-30)

- User da chap nhan huong bypass TLS co gioi han cho provider Pragmatic.
- Da them handler `ServerCertificateErrorDetected` cho main WebView va popup WebView:
  - chi allow host `pragmaticplaylive.net` va `*.pragmaticplaylive.net`.
  - chi allow loi cert CN mismatch (`CertificateCommonNameIsIncorrect` / CommonName).
  - khong mo rong sang domain khac.
- Log thuc te da xac nhan handler TLS co chay:
  - `[TLS-BYPASS] main WebView certificate handler hooked.`
  - `[TLS-BYPASS] popup WebView certificate handler hooked.`
  - `[TLS-BYPASS][ALLOW] ... status=CertificateCommonNameIsIncorrect ...`
- Van de hien tai: sau khi allow TLS, popup van co the vao trang `File Not Found`.
  - NavigationCompleted tra `Err Unknown` tren URL `client.pragmaticplaylive.net/desktop/launcher/...`.
  - retry cung launcher URL khong giai quyet duoc vi URL/token launcher co the da fail/stale.
  - fallback close popup + click lai da duoc them nhung user bao van thay `File Not Found`, can tiep tuc doc log moi.
- Da tham khao flow `TaiXiuLiveHit`:
  - voi `window.open` URL that thi dieu huong ve WebView hien tai.
  - `about:blank` van de popup flow xu ly.
- Canvas Watch:
  - `CW_PANEL_VISIBLE_DEFAULT = true`.
  - da bump `CW_PANEL_VISIBLE_DEFAULT_REV = '20260630-show-default'` de reset localStorage visibility cu.
  - neu panel van khong hien thi, can check hash embedded JS trong log va check app dang load DLL moi.

## Luu y deploy

- `v4_js_xoc_dia_live.js` duoc nap tu `EmbeddedResource` trong DLL.
- Sua file `.js` tren dia khong co hieu luc neu chua rebuild DLL va restart host.
- Can doi chieu log `[Bridge] Loaded JS from embedded ... sha256=...` de chac chan da nap ban moi.
- Neu thay panel van hien trai y do state cu, tang `CW_PANEL_VISIBLE_DEFAULT_REV` de reset localStorage visibility flag.
- Khi build truc tiep `.csproj`, can truyen `SolutionDir`, vi csproj dung `$(SolutionDir)` de tim/copy plugin:
  - `dotnet build BaccaratPragmatic.csproj -c Debug /p:SolutionDir="D:\PROJECT\ABXHubSolution\"`
  - neu khong co `SolutionDir`, guard co the bao sai `ABX.Core.dll not found at 'AutoBetHub\...'`.

## Cập nhật Canvas Watch Pragmatic (2026-07-03)

- Trang game thực tế user xác nhận qua DevTools là:
  - top: `https://client.pragmaticplaylive.net/desktop/launcher/`
  - frame game: `https://client.pragmaticplaylive.net/desktop/baccarat/`
  - video frame: `https://client.pragmaticplaylive.net/apps/video/2.0.19/index.html`
- Canvas Watch đã hiển thị được trên route mới `/desktop/baccarat/`.
- Panel ban đầu chỉ hiện nút, sau đó đã thêm fallback render để hiện lại các dòng chi tiết như:
  - trạng thái,
  - bàn,
  - tài khoản/số dư,
  - Banker/Player/Tie,
  - bet pool,
  - chuỗi kết quả.
- `CW_PANEL_VISIBLE_DEFAULT = true` đã có hiệu lực sau khi bump `CW_PANEL_VISIBLE_DEFAULT_REV`.
- `v4_js_xoc_dia_live.js` hiện có fallback cho Pragmatic DOM route:
  - nhận diện `/desktop/baccarat/` là game popup page.
  - tự start Canvas Watch trên Pragmatic baccarat page.
  - dùng `__cw_readSeqStateSafeForUi()` để tránh lỗi `readSeqStateSafe is not defined`.
- Vấn đề còn mở: `Prog` vẫn `--`, chưa đồng bộ được countdown vòng tròn trên giao diện game.
- Đã thử các hướng đọc countdown:
  - đọc từ network/json text qua `countdownProviderObserveText`.
  - đọc từ DOM vùng visual countdown bằng tọa độ.
  - fallback `elementFromPoint` quanh vùng vòng countdown.
- Kết quả user mới nhất: vẫn chưa lấy được `Prog`.
- Để tránh đoán mò, đã thêm log bắt buộc cho tag `COUNTDOWN` từ JS về log chương trình:
  - `[CWDBG][COUNTDOWN] pragmatic-visual-hit`
  - `[CWDBG][COUNTDOWN] pragmatic-visual-miss`
  - `[CWDBG][COUNTDOWN] collect-hit`
  - `[CWDBG][COUNTDOWN] collect-miss`
- Log `COUNTDOWN` được gửi về C# kể cả khi runtime profile không phải Debug và `_enableJsFileLog=false`.
- Khi debug tiếp, cần yêu cầu user gửi đoạn log có `[CWDBG][COUNTDOWN]` để biết:
  - JS có chạy đúng bản mới không,
  - có chạm đúng vùng countdown không (`pointHits`),
  - có thấy số DOM không (`numeric`),
  - bị loại do rect/region/bad-tail hay không.

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

## Cập nhật vào game Pragmatic (2026-07-01)

- Lobby đúng của Pragmatic trên Net88 là `https://net88.fund/livecasino?provider=pragmatic`.
- `DEFAULT_URL` dùng lobby trên, nhưng route lobby phải được build theo host hiện tại/người dùng nhập. Nếu host đổi từ `net88.fund` sang `net88.vu`, hàm build lobby phải giữ path/query `/livecasino?provider=pragmatic` trên host mới, không hard-code riêng `NET88_PRAGMATIC_LOBBY_URL`.
- Luồng vào game đang dùng:
  1. WebView chính mở lobby Net88 Pragmatic.
  2. Click đúng game Baccarat Pragmatic, ưu tiên marker `symbol/gameid/ppGame=401`, tránh tab/category `Baccarat` không có action và tránh mục Xóc Đĩa.
  3. Site mở popup thật qua `window.open/about:blank`.
  4. Popup đi qua `gs2c/playGame.do`.
  5. Provider gọi `games.pragmaticplaylive.net/api/secure/GameLaunch`.
  6. Popup chuyển tới `client.pragmaticplaylive.net/desktop/launcher/...`.
  7. Game load frame `client.pragmaticplaylive.net/desktop/baccarat/`.
- Popup Pragmatic đã được chỉnh theo kiểu project `BaccaratEzugiCasino`: giữ popup WebView riêng, set `e.NewWindow = popupWeb.CoreWebView2`, không ép `window.open` quay về main WebView và không điều hướng URL popup không rỗng trong main WebView.
- Nguyên nhân chính của lỗi đen màn hình/File Not Found/Err Unknown là DNS cục bộ có lúc resolve `client.pragmaticplaylive.net` về IP trả certificate `CN=*.greennet.net.vn`, gây `CertificateCommonNameIsIncorrect`.
- WebView2 environment đã thêm host-map cho `client.pragmaticplaylive.net -> 13.227.227.64`. Cần rebuild và restart hẳn app/host vì tham số WebView2 chỉ có hiệu lực lúc tạo environment.
- Log quan trọng khi debug lại:
  - `[WV2][HOST-MAP]`
  - `[TLS-BYPASS][ALLOW]`
  - `[ROUTE-URL]`
  - `[CLICK-TARGET]`
  - `launcher-nav-error`
  - `[RECOVER-RECLICK]`
  - `PopupWeb NavigationCompleted`
- Đã fix race `_popupWeb was null` trong `InjectOnPopupDocAsync` bằng cách giữ local reference của popup/core và kiểm tra stale event sau `await`.
