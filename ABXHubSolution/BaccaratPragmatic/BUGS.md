# Bugs

## Trang thai hien tai (2026-05-10)

- App freeze/kho click khi vao game:
  - Da co mitigation bang cach tat emergency HTTP/CDP taps.
  - Theo user runtime, tai da giam ro sau thay doi nay.
- Countdown khong dong bo truoc day:
  - Da doi status theo `Prog` va tach ro display logic.
  - Con countdown source van tu DOM (`span.seconds`) + smoothing.

## Trang thai cap nhat (2026-05-11)

- Bug dong bo chuoi khi switch ban (`luc duoc luc khong`, co luc dinh chuoi cu):
  - Da doi sang flow nghiep vu don gian: doi ban -> nhan context moi ngay.
  - Neu incoming seq cua ban moi co du lieu thi cap nhat ngay.
  - Log sau patch: `TABLE-SWITCH-REJECT = 0`.
- Hien tuong nhay `seq -> null -> seq`:
  - Da co guard `waiting-board-bootstrap` + delay 600ms.
  - Da gioi han show waiting toi da 1 lan moi switch.
- Spam log `AUTH-KEEP-JS`:
  - Da dedup log theo state + heartbeat 4s (khong doi nghiep vu tinh ket qua).
  - Van co the con nhieu `AUTH-KEEP-JS` neu net seq tiep tuc rong.
- Bug lech tail vung dat cuoc DOM sau khi provider doi layout:
  - Da fix bang map side theo `#main-bets` class (`css-1or1crx`/`css-1o2wumy`/`css-qso31z`).
  - Da bo sung fallback map side theo tail khi text label khong on dinh.
- Bug parse/quet chip DOM thieu menh gia `2.5M`:
  - Da fix parser K/M (ho tro decimal) va mo rong allow-set (`25K`, `250K`, `2.5M`).
  - Da bo sung chip selectors moi `.chip-selector__chip-container*`.
- Bug Canvas Watch nhay hien roi moi an khi default hidden:
  - Nguyen nhan: `__abxStartAuthority()` force `display:block` cho `#__cw_root_allin`.
  - Da fix: dung `__cw_applyPanelDisplayOwner()` de ton trong `CW_PANEL_VISIBLE_DEFAULT=false`.

## Trang thai cap nhat (2026-05-17)

- Van de vao game khong on dinh (luc duoc luc khong):
  - Da bat duoc theo log frame-nav: frame con co the roi vao `chrome-error://chromewebdata`.
  - Co xuat hien loi cert CN mismatch o launcher/frame (`CertificateCommonNameIsIncorrect`) tu phia provider.
  - Day la loi ben ngoai; app khong va khong duoc bypass cert.
- Trieu chung "ket may trang":
  - khi popup frame loi va dung o error page, UI de nhin nhu treo.
  - Da them `[UI-GUARD]` fallback ve main web de tranh ket UI.
  - Luu y: guard chi la giam tac dong UI, khong sua duoc loi TLS/cert goc.
- Mat authority do context key thay doi trong cung game:
  - Da bo sung `[AUTH][REBIND] reason=same-game-href` de giu authority khi href game khong doi.
- Top `gs2c` score DOM yeu:
  - Da bo sung boost score toi thieu khi URL da la game-ready de tranh lock nham host frame.

## Trang thai cap nhat (2026-06-30)

- Bug hien tai: sau khi click game, cua so/popup mo duoc nhung noi dung hien `File Not Found`.
- Log truoc do cho thay:
  - TLS handler da hook thanh cong.
  - app da allow `CertificateCommonNameIsIncorrect` cho `client.pragmaticplaylive.net`.
  - `PopupWeb NavigationCompleted: Err Unknown` tren URL launcher.
  - stage bi giu o `popup-tls-retry-pending`.
- Nguyen nhan kha nang cao:
  - bypass TLS chi giai quyet chan cert cua WebView2.
  - URL launcher Pragmatic sau loi co the da thanh URL/token/JSESSIONID loi hoac stale.
  - reload/retry cung launcher URL khong du, nen van ra `File Not Found`.
- Patch da co:
  - TLS allow whitelist hep.
  - retry sau TLS allow.
  - fallback sau 8.5s: close popup + reset authority/pipeline + click lai game de lay launcher moi.
- User bao sau patch van khong thay thay doi va van `File Not Found`.
  - can doc log moi de biet fallback co duoc build/load/chay khong.
  - neu log khong co `[TLS-BYPASS][FALLBACK-*]`, kha nang cao app dang chay DLL cu hoac route khong di qua SchedulePragmaticTlsFallback.
  - neu co `[TLS-BYPASS][FALLBACK]` ma van loi, can doi sang flow lay launcher moi chu dong hon thay vi retry URL cu.
- Luu y build/deploy:
  - build truc tiep `.csproj` phai truyen `SolutionDir`.
  - neu khong, guard `ABX.Core.dll` co the check sai path.
  - JS la embedded resource, can rebuild + restart host moi thay Canvas Watch/default JS thay doi.

## Da fix / da giam ro

- Da bo fallback cu cua tong cuoc B/P/T tranh scan nham (nhat la dinh chip `10M`).
- Da chuyen sang `preferred-tail-only` voi 3 selector co dinh.
- Da doi status UI thanh rule don gian theo `Prog` + mau xanh/do ro rang.
- Da bo sung log chi tiet cho switch/sync seq de truy vet nhanh:
  - `[AUTH][TABLE-SWITCH-ACCEPT]`, `[CANVAS][DISPLAY-CLEAR-*]`
  - `[NETSEQ][AUTH-KEEP-JS]`, `[NETSEQ][AUTH-WAIT-BOOTSTRAP]`, `[SEQ][RX-DATA]`.
- Da bo sung log dieu tra frame:
  - `[FrameNav][ERR] frameId/navId/status/target`
  - `[FrameNav][ERR-PAGE] target=chrome-error://chromewebdata`
  - `[UI-GUARD] popup frame hit chrome-error page, fallback to main web.`

## Risk con lai

- TLS bypass la rui ro bao mat da duoc user chap nhan cho provider Pragmatic.
- Whitelist hien tai phai giu hep, khong mo rong sang host/domain khac.
- Neu cert/tls cua provider loi theo thoi diem, app van co the that bai vao game du logic trong app dung.
- Selector class cua provider co the doi bat ky luc nao, gay null B/P/T hoac sai target dat cuoc.
- Khi selector doi, vi da bo fallback cu, pool se ve `--` ngay (dung theo thiet ke moi).
- `MainWindow.xaml.cs` van lon, de phat sinh regression khi sua nhanh.
- Van can theo doi them case hiem:
  - switch ban rat nhanh + source pull den truoc du lieu board day du, co the thay waiting ngan.
  - net seq rong keo dai lam nhieu tick di qua nhanh `AUTH-KEEP-JS` (du ket qua van dung).
- Canvas Watch visible state co the bi anh huong boi localStorage cu neu doi default ma khong bump rev key.

## Dau hieu can theo doi trong log

- `BETPOOL preferred-tail-only`:
  - theo doi `B/P/T/source/score/tailB/tailP/tailT`.
- `cwBet` DOM:
  - theo doi log fail `bet target not found`, `focus chip failed`, `confirm failed`.
- Countdown trace:
  - C#: `[COUNTDOWN][UI][RAW]`, `[COUNTDOWN][UI][DISPLAY]`, `[COUNTDOWN][TRACE]`.
  - JS: `CWDBG COUNTDOWN raw/display`.

## Bug hiện tại - Prog countdown Pragmatic vẫn `--` (2026-07-03)

### Triệu chứng

- Canvas Watch đã hiển thị được trên game Pragmatic route `/desktop/baccarat/`.
- Panel đã hiện chi tiết như trạng thái, bàn, Banker/Player/Tie, bet pool, chuỗi kết quả.
- Riêng dòng `Prog` trên Canvas Watch vẫn là `--`.
- Bảng điều khiển C# bên phải cũng chưa đồng bộ countdown từ game cho case này.
- User xác nhận sau nhiều patch: `Vẫn chưa được`, `Prog vẫn -- chưa lấy được`.

### Những gì đã kiểm tra

- DevTools cho thấy frame đang dùng:
  - launcher: `/desktop/launcher/`
  - baccarat: `/desktop/baccarat/`
  - video: `/apps/video/2.0.19/index.html`
- Các scan trước đó từng bắt được số `9/8` nhưng xác định là giá trị bài Player/Banker, không phải countdown.
- Các tail/candidate như `nl_*`, `jP_*`, `centerTopBet`, `PG_PR` không được coi là countdown chính xác.
- Countdown vòng tròn nằm trực quan ở vùng giữa-dưới màn hình, nhưng chưa chứng minh được nó expose dưới dạng DOM text.

### Patch đã áp dụng

- Thêm `/desktop/baccarat/` vào nhận diện game page cho Canvas Watch.
- Thêm fallback render panel để không bị trống nội dung.
- Thêm `__cw_readSeqStateSafeForUi()` để tránh crash khi render panel.
- Thêm `countdownProviderObserveText()` để thử bắt countdown từ network/json text.
- Thêm `domReadPragmaticVisualCountdown()` để quét DOM text theo vùng countdown.
- Thêm fallback `elementFromPoint()` quanh vị trí vòng countdown.
- Thêm log bắt buộc cho tag `COUNTDOWN`:
  - JS vẫn gửi log dù `__cw_file_log_enable` tắt.
  - C# vẫn ghi log tag `COUNTDOWN` dù `_enableJsFileLog=false`.

### Giả thuyết hiện tại

- JS có thể chưa được rebuild/restart đúng bản embedded mới trong app đang chạy.
- Hoặc countdown không nằm trong DOM text thường mà được render qua canvas/video/SVG nội bộ không expose text.
- Hoặc `elementFromPoint` đang chạy sai context/coordinate so với frame thật.
- Hoặc bộ lọc rect/region/bad-tail đang loại nhầm candidate thật.
- Hoặc countdown chỉ có trong message network/WebSocket, không có trong DOM.

### Cần log để xử lý tiếp

- Bắt buộc lấy đoạn log chương trình có:
  - `[CWDBG][COUNTDOWN] pragmatic-visual-miss`
  - `[CWDBG][COUNTDOWN] pragmatic-visual-hit`
  - `[CWDBG][COUNTDOWN] collect-miss`
  - `[CWDBG][COUNTDOWN] collect-hit`
- Nếu không có bất kỳ dòng `[CWDBG][COUNTDOWN]` nào:
  - app có thể chưa chạy bản JS/C# mới,
  - bridge log chưa inject vào đúng frame,
  - hoặc chưa rebuild/restart host.
- Nếu có `pragmatic-visual-miss`, đọc `diag`:
  - `contexts=0`: không thấy đúng frame game.
  - `pointHits=0`: `elementFromPoint` không chạm vùng countdown.
  - `numeric=0`: DOM không có text số countdown.
  - `rejectedRect/rejectedRegion/rejectedBad`: candidate bị filter loại.

### Hướng fix tiếp theo

- Ưu tiên đọc log `COUNTDOWN` trước, không đoán thêm tail.
- Nếu `diag` chứng minh DOM không có countdown, chuyển sang CDP network:
  - bật network/WebSocket tap cho Pragmatic,
  - tìm field countdown/timeLeft/betTime/remaining,
  - map giá trị đó về `Prog`.
- Nếu CDP network vẫn không có countdown rõ, cân nhắc fallback OCR/canvas crop vùng countdown.

## Workaround van dung

- Neu thay thay doi JS khong co hieu luc:
  - rebuild DLL,
  - restart host,
  - check log hash embedded JS.
- Neu B/P/T ve `--` hoac click nham cua:
  - check selector/tail tren ban hien tai,
  - cap nhat lai map tail cua bet target.
- Neu Canvas Watch van hien trai y du da set default hidden:
  - bump `CW_PANEL_VISIBLE_DEFAULT_REV`,
  - rebuild + restart host.
- Neu sau TLS bypass van `File Not Found`:
  - khong ket luan cert handler hong ngay.
  - kiem tra log `[TLS-BYPASS][ALLOW]`, `[RETRY-*]`, `[FALLBACK-*]`.
  - neu retry/fallback chay nhung van loi, can lay launcher token moi tu host thay vi reload URL cu.

## Trạng thái lỗi vào Pragmatic (2026-07-01)

### Bug

- Vào game Pragmatic không ổn định: lúc vào được, lúc màn hình đen và báo `File Not Found`.
- Log có thể thấy `PopupWeb NavigationCompleted: Err Unknown` ở URL `client.pragmaticplaylive.net/desktop/launcher/...`.
- Khi debug Visual Studio từng gặp `System.NullReferenceException` vì `_popupWeb was null` trong `InjectOnPopupDocAsync`.

### Nguyên nhân đã xác định

- DNS/cert mismatch: `client.pragmaticplaylive.net` có lúc resolve về IP trả certificate `CN=*.greennet.net.vn`, làm WebView2 báo `CertificateCommonNameIsIncorrect`/`Err Unknown`.
- Retry launcher URL cũ không đủ ổn định vì launcher URL/token/session có thể đã fail hoặc hết hiệu lực sau lỗi TLS.
- Popup flow cũ từng override `window.open` hoặc đẩy popup route về main WebView, khác cách vào game ổn định của project `BaccaratEzugiCasino`.
- Fallback click có rủi ro bấm nhầm tab/category `Baccarat` hoặc mục Xóc Đĩa thay vì game Baccarat Pragmatic thật.
- Event popup cũ có thể bắn sau khi popup đã bị đóng, gây `_popupWeb` null nếu dùng field trực tiếp sau `await`.

### Fix đã áp dụng

- Build lobby Pragmatic theo host hiện tại/người dùng nhập, giữ path/query `/livecasino?provider=pragmatic`.
- Giữ popup WebView riêng theo flow Ezugi: `e.NewWindow = popupWeb.CoreWebView2`.
- Bỏ hướng ép popup URL về main WebView cho Pragmatic.
- Sửa click heuristic: ưu tiên marker `401`, tránh Xóc Đĩa và tránh category tab không có action.
- Thêm TLS handler scoped cho domain Pragmatic và lỗi common-name mismatch.
- Thêm WebView2 host-map: `client.pragmaticplaylive.net -> 13.227.227.64`.
- Recovery khi launcher lỗi: đóng popup stale, quay lại lobby Pragmatic, click lại để lấy launcher mới.
- Fix race `_popupWeb null` bằng local reference cho popup/core trong `InjectOnPopupDocAsync`.

### Workaround/khi lỗi lại

- Rebuild và restart hẳn app/host. WebView2 host-map chỉ có hiệu lực khi tạo environment mới.
- Gửi log có các dòng:
  - `[WV2][HOST-MAP]`
  - `[TLS-BYPASS][ALLOW]`
  - `[ROUTE-URL]`
  - `[CLICK-TARGET]`
  - `PopupWeb NavigationCompleted`
  - `launcher-nav-error`
  - `[RECOVER-RECLICK]`
- Nếu vẫn lỗi sau host-map, kiểm tra lại DNS/IP/CDN của `client.pragmaticplaylive.net`; IP CloudFront có thể thay đổi theo thời gian.

### Rủi ro còn lại

- Host-map dùng IP cụ thể nên có thể stale nếu provider/CDN đổi route.
- TLS bypass phải giữ hẹp cho Pragmatic, không mở rộng sang domain khác.
- Provider có thể đổi DOM/game marker, làm click heuristic cần cập nhật lại.
