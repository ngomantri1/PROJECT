# TODO

## Da xong hom nay (2026-05-10)

- [x] Tat emergency HTTP/CDP tap de giam tai runtime (`DisableHttpAndCdpTaps = true`).
- [x] Doi logic status theo `Prog`:
  - `Prog > 0` => `Cho phep dat cuoc` (xanh).
  - `Prog <= 0/null` => `Doi ket qua` (do).
- [x] Bo fallback cu cho tong cuoc B/P/T.
- [x] Chot nguon doc tong cuoc theo 3 selector tail co dinh (`preferred-tail-only`).
- [x] Cap nhat probe script `devtool_probe_bpt_pool_tails.js` theo cung logic selector co dinh.

## Da xong hom nay (2026-05-11)

- [x] Chuyen dong bo chuoi ket qua sang huong DOM board authority (full board scan + raw seq).
- [x] Them pha `waiting-board-bootstrap` khi vao/switch ban de tranh lock chuoi sai.
- [x] Don gian hoa authority switch theo nghiep vu:
  - doi ban -> nhan context moi ngay (bo gate reject weak-pull).
  - co incoming seq cua ban moi -> cap nhat ngay.
- [x] Giam flash waiting:
  - delay `waiting-board-bootstrap` 600ms sau switch.
  - chi show waiting toi da 1 lan moi switch.
- [x] Giam spam log/state:
  - dedup log `AUTH-KEEP-JS` theo state + heartbeat 4s.
- [x] Ra log sau patch:
  - `TABLE-SWITCH-REJECT = 0`.
  - waiting giam ro, ket qua van dung.
- [x] Sua lech tail DOM dat cuoc sau khi provider doi layout:
  - map side theo `#main-bets` (`css-1or1crx`/`css-1o2wumy`/`css-qso31z`).
  - uu tien tail mapping khi text OCR/DOM label khong on dinh.
- [x] Cap nhat scan/parse chip DOM theo log thuc te:
  - nhan `.chip-selector__chip-container*`.
  - ho tro menh gia `25K`, `100K`, `250K`, `1M`, `2.5M`, `5M`, `10M`.
- [x] Fix Canvas Watch nhay hien thi 1 nhip khi `CW_PANEL_VISIBLE_DEFAULT = false`:
  - bo force `display:block` trong `__abxStartAuthority`.
  - ton trong hoan toan policy visible/hidden ngay tu luc vao ban.

## Da xong hom nay (2026-05-17)

- [x] Bo sung trace frame navigation de boc net error theo frame:
  - map `frameId|navId -> target uri` tu `FrameNavigationStarting`.
  - log `FrameNavigationCompleted` bang `[FrameNav][ERR]` + `[FrameNav][ERR-PAGE]`.
- [x] Hardening authority cho Pragmatic `gs2c`:
  - boost scout score toi thieu cho top frame game-ready url.
  - bo sung `AUTH rebind` khi cung `game href` nhung doi context key.
- [x] Them UI guard toi thieu tranh ket man "may trang":
  - detect popup frame roi vao `chrome-error://chromewebdata`.
  - fallback UI ve main web + reset popup bet pipeline.
  - khong bypass cert/TLS.

## Da lam hom nay (2026-06-30)

- [x] Doc lai context hien tai va doi chieu project tham khao `D:\PROJECT\ABXHubSolution\TaiXiuLiveHit`.
- [x] Them TLS bypass co whitelist hep cho Pragmatic:
  - host `pragmaticplaylive.net` va `*.pragmaticplaylive.net`.
  - loi `CertificateCommonNameIsIncorrect` / CommonName.
- [x] Hook cert handler cho main WebView va popup WebView.
- [x] Them log `[TLS-BYPASS][ALLOW]`, `[TLS-BYPASS][RETRY-*]`, `[TLS-BYPASS][FALLBACK-*]`.
- [x] Them retry sau TLS allow.
- [x] Them fallback close popup + click lai game neu sau retry van ket `popup-tls-retry-pending`.
- [x] Bump `CW_PANEL_VISIBLE_DEFAULT_REV` de Canvas Watch default visible co hieu luc lai sau localStorage cu.
- [x] Build thanh cong bang:
  - `dotnet build BaccaratPragmatic.csproj -c Debug /p:SolutionDir="D:\PROJECT\ABXHubSolution\"`
- [x] Copy plugin sang `D:\PROJECT\ABXHubSolution\AutoBetHub\Plugins\BaccaratPragmatic.dll`.

## Viec can tiep tuc

- [ ] Doc log moi sau khi user van bi `File Not Found` de xac dinh fallback co thuc su chay khong:
  - can thay `[TLS-BYPASS][FALLBACK-SCHEDULE]`.
  - neu ket qua sau 8.5s van loi, can thay `[TLS-BYPASS][FALLBACK]` hoac `[TLS-BYPASS][FALLBACK-SKIP]`.
- [ ] Neu fallback khong chay: kiem tra app/Hub dang load dung DLL moi hay van cache plugin cu.
- [ ] Neu fallback co chay ma van `File Not Found`: doi chien luoc sang reacquire launcher moi som hon, khong reload lai URL `client.pragmaticplaylive.net/desktop/launcher/...` cu.
- [ ] So sanh sau hon voi `TaiXiuLiveHit`:
  - flow `window.open`.
  - `NewWindowRequested`.
  - co dong popup cu truoc khi click lai khong.
  - co clear WebView2 route/session truoc khi lay token moi khong.
- [ ] Bo sung log target source chi tiet quanh click game:
  - URL host truoc click.
  - URL GameLaunch.
  - URL launcher.
  - popup/main dang active.
- [ ] Theo doi 24h tan suat `[FrameNav][ERR]` theo `WebErrorStatus` de tach loi ben ngoai/ben trong.
- [ ] Them counter nhe cho `[UI-GUARD]` (theo phien) de biet muc do phat sinh "may trang".
- [ ] Neu external cert mismatch xuat hien thuong xuyen: thong bao ro cho van hanh/provider (ngoai pham vi code app).
- [ ] Theo doi tinh on dinh selector B/P/T theo tung ban (provider co the doi class/tail).
- [ ] Theo doi them 24h cho nhom class moi cua bet target (`css-1or1crx`, `css-1o2wumy`, `css-qso31z`) de phat hien som khi provider rotate class.
- [ ] Theo doi 24h log switch ban:
  - giu `TABLE-SWITCH-REJECT = 0`.
  - thoi gian vao ban moi -> co seq hop le trong muc cho phep.
  - xac nhan waiting khong bi spam lai khi switch lien tuc.
- [ ] Them canh bao log khi 1 trong 3 selector null qua nguong thoi gian.
- [ ] Xac nhan lai countdown long-run (nhieu round lien tiep) de loai tru stall hiem.
- [ ] Theo doi nguon `net seq` (hien tai thuong rong) de quyet dinh co can giam tan suat auth-keep-js state update nua hay khong.
- [ ] Bo sung smoke test checklist sau rebuild:
  - status mau/chu dung theo `Prog`.
  - B/P/T len canvas deu.
  - seq khong nhay nguoc ve chuoi cu khi switch ban/shuffle.
  - app khong freeze sau khi vao game.

## Refactor uu tien

- [ ] Tach bot logic khoi `MainWindow.xaml.cs` (god object).
- [ ] Chuan hoa service doc snapshot/status/totals de de test.
- [ ] Giam logic heuristic cu con du trong nhung nhanh khong con su dung.

## Deploy checklist bat buoc

- [ ] Rebuild plugin DLL.
- [ ] Restart host `AutoBetHub`.
- [ ] Doi chieu log hash: `[Bridge] Loaded JS from embedded ... sha256=...`.
- [ ] Neu thay Canvas Watch van hien trai y do cache cu: bump `CW_PANEL_VISIBLE_DEFAULT_REV` va restart host.

## Đã làm ngày 2026-07-03 - Canvas Watch Pragmatic

- [x] Đọc lại `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `TODO.md`, `BUGS.md` trước khi sửa.
- [x] Xác nhận route game thực tế qua DevTools/log user:
  - `top`: `https://client.pragmaticplaylive.net/desktop/launcher/`
  - game: `https://client.pragmaticplaylive.net/desktop/baccarat/`
  - video: `https://client.pragmaticplaylive.net/apps/video/2.0.19/index.html`
- [x] Cho Canvas Watch nhận diện `/desktop/baccarat/` là game page hợp lệ.
- [x] Cho Canvas Watch hiện mặc định bằng `CW_PANEL_VISIBLE_DEFAULT=true` và bump `CW_PANEL_VISIBLE_DEFAULT_REV`.
- [x] Thêm fallback render để panel không chỉ hiện nút mà còn hiện chi tiết:
  - trạng thái,
  - bàn,
  - tài khoản/số dư,
  - Banker/Player/Tie,
  - bet pool,
  - chuỗi kết quả.
- [x] Fix lỗi JS `readSeqStateSafe is not defined` bằng wrapper `__cw_readSeqStateSafeForUi()`.
- [x] Thử bắt `Prog` từ network/json text bằng countdown provider.
- [x] Thử bắt `Prog` từ DOM visual countdown theo vùng giữa-dưới màn hình.
- [x] Thử fallback `elementFromPoint()` quanh vị trí vòng countdown.
- [x] Bổ sung log bắt buộc cho tag `COUNTDOWN` từ JS về log chương trình.
- [x] C# ghi log `COUNTDOWN` kể cả khi `_enableJsFileLog=false`.
- [x] Build kiểm tra sau patch:
  - `node --check .\v4_js_xoc_dia_live.js`
  - `dotnet build .\BaccaratPragmatic.csproj -c Debug /p:SolutionDir="D:\PROJECT\ABXHubSolution\" /p:OutDir="D:\PROJECT\ABXHubSolution\BaccaratPragmatic\bin\CodexVerify\"`

## Cần làm tiếp - Prog countdown vẫn `--` (2026-07-03)

- [ ] Rebuild/restart đúng app hoặc host đang chạy để chắc chắn dùng JS embedded mới.
- [ ] Đối chiếu log hash embedded JS sau restart:
  - `[Bridge] Loaded JS from embedded ... sha256=...`
- [ ] Lấy log chương trình có các dòng:
  - `[CWDBG][COUNTDOWN] pragmatic-visual-miss`
  - `[CWDBG][COUNTDOWN] pragmatic-visual-hit`
  - `[CWDBG][COUNTDOWN] collect-miss`
  - `[CWDBG][COUNTDOWN] collect-hit`
- [ ] Dựa vào `diag` trong `pragmatic-visual-miss` để quyết định bước tiếp:
  - `contexts=0`: JS không chạy trong đúng frame `/desktop/baccarat/` hoặc bridge chưa inject đúng frame.
  - `pointHits=0`: tọa độ `elementFromPoint` đang sai hoặc frame coordinate khác.
  - `numeric=0`: countdown không expose dưới dạng DOM text, cần chuyển sang CDP network hoặc OCR/canvas.
  - `rejectedRegion/rejectedRect/rejectedBad` cao: điều kiện lọc đang loại nhầm candidate.
- [ ] Nếu DOM không expose countdown:
  - bật/đọc CDP network tap cho Pragmatic message stream,
  - tìm field countdown/timeLeft/betTime/remaining trong WebSocket/XHR,
  - map về `Prog`.
- [ ] Nếu network không có countdown rõ:
  - cân nhắc OCR/canvas crop riêng vùng vòng countdown,
  - hoặc dùng pixel/ring progress chỉ làm fallback sau cùng.

## Đã làm ngày 2026-07-01

- [x] Đọc log và ảnh lỗi màn hình đen/File Not Found khi vào Pragmatic.
- [x] Xác nhận lobby đúng: `https://net88.fund/livecasino?provider=pragmatic`.
- [x] Chỉnh route lobby để phụ thuộc host hiện tại/người dùng nhập, không phụ thuộc hard-code riêng `net88.fund`.
- [x] Sửa click target để ưu tiên Baccarat Pragmatic, marker `symbol/gameid/ppGame=401`, bỏ qua tab/category `Baccarat` không có href/action và tránh Xóc Đĩa.
- [x] Thêm log route để thấy rõ main URL, popup URL, `playGame.do`, `GameLaunch`, launcher và tham số.
- [x] So sánh project `D:\PROJECT\ABXHubSolution\BaccaratEzugiCasino`.
- [x] Đổi popup Pragmatic sang flow popup thật giống Ezugi, không override `window.open` về main WebView.
- [x] Fix lỗi `NullReferenceException` khi `_popupWeb` null trong `InjectOnPopupDocAsync`.
- [x] Chẩn đoán DNS/cert mismatch: `client.pragmaticplaylive.net` có lúc đi vào cert `*.greennet.net.vn`.
- [x] Thêm WebView2 host-map cho `client.pragmaticplaylive.net -> 13.227.227.64`.
- [x] User đã xác nhận có lúc vào được game sau các thay đổi trên.

## Cần test tiếp

- [ ] Rebuild và restart hẳn app/host để chắc chắn WebView2 environment mới có `--host-resolver-rules`.
- [ ] Smoke test vào/thoát game ít nhất 10 lần liên tiếp.
- [ ] Kiểm tra log có `[WV2][HOST-MAP] client.pragmaticplaylive.net -> 13.227.227.64`.
- [ ] Kiểm tra log còn `CertificateCommonNameIsIncorrect`, `Err Unknown`, `File Not Found` hay không.
- [ ] Nếu CloudFront IP `13.227.227.64` đổi hoặc stale, cân nhắc đưa host-map thành cấu hình hoặc probe DNS/IP trước khi tạo WebView2 environment.
- [ ] Xác nhận `AutoBetHub` đang load đúng DLL mới sau rebuild.
