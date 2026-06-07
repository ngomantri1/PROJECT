# Bugs

## Hien Tai

### 1. 4 tong cuoc `CHAN/LE/TAI/XIU` chua dong bo production
- File lien quan:
- `MainWindow.xaml.cs`
- `v4_js_xoc_dia_live.js`
- `devtools_ws_bet_totals_probe.js`
- Trieu chung:
- UI production van co the hien `0`
- probe scene/tail co luc bat nham `lbl_currentBet`, `ChipPanel/lbl_value`, `last_result`, `popup`, hoac ra `null`
- Nguyen nhan:
- 4 gia tri tong cuoc khong co tail scene on dinh de dung production
- huong scene graph da duoc xac nhan la khong dang tin cay tren trang moi
- Trang thai hien tai:
- dang debug theo huong websocket packet `bs[]`
- chua chot production mapping cuoi cung

### 2. Probe WebSocket DevTools cho 4 tong cuoc chua bat duoc socket o moi case
- File:
- `devtools_ws_bet_totals_probe.js`
- Trieu chung:
- co truong hop chi thay log `install`
- `__wsBetTotalsProbe.last()` = `null`
- khong co `ws.attach`
- Nguyen nhan kha nang cao:
- websocket game tao trong frame khac
- hook duoc chay sau khi socket da duoc tao
- user paste truc tiep vao Console thay vi `Snippet + reload`
- Trang thai hien tai:
- da them hook cho same-origin frames
- van can user test lai

### 3. Countdown giua ban khong co tail production-ready
- File:
- `v4_js_xoc_dia_live.js`
- Nhiều probe scene graph da thu va deu bat nham:
- `BetArea/lbl_currentBet`
- `Right/last_result/lbl_count_*`
- `popup/session_history_new/*`
- `loading_view/*`
- `screen_view/*`
- Tac dong:
- huong tail cho countdown da duoc bo
- khong nen tiep tuc patch production theo tail countdown
- Trang thai hien tai:
- da workaround bang CDP websocket packet va dang on dinh

### 4. JS file tren disk va JS da inject co the lech nhau
- File lien quan:
- `MainWindow.xaml.cs`
- `v4_js_xoc_dia_live.js`
- Sau khi sua file JS, session dang mo van co the dang chay ban da inject truoc do.
- Tac dong:
- user doi tail/probe/flag nhung tren app dang mo khong thay hieu luc ngay
- Workaround:
- reload page game hoac mo lai app

### 5. `AutoFillLoginAsync()` dang bi tat bang early return
- File:
- `MainWindow.xaml.cs`
- Startup va navigation van goi, nhung method return ngay.

### 6. Home JS resource bi thieu
- File lien quan:
- `MainWindow.xaml.cs`
- `js_home_v2.js` khong ton tai trong project.

### 7. Decision input dang luu nhung chua tac dong runtime day du
- File:
- `MainWindow.xaml.cs`
- `_decisionPercent` chua duoc cap nhat nhat quan tu input UI.

## Da Fix Hoac Da Giam Tac Dong
- CDP network tap da bat on dinh, khong con phu thuoc env `TXLS_CDP_TAP`.
- Da co log `[CDP]` va `[PKT]` de xac nhan socket `wss://livecasino.azhkthg1.net/websocket`.
- Countdown production da lay duoc tu packet server:
- `timeBetCountdown`
- fallback `timeBet`
- `stopBetSecond`
- `status`
- Trang thai UI da map dung:
- `Phiên mới`
- `Ngừng đặt cược`
- `Đang đợi kết quả`
- va da co mau chu:
- xanh / do / vang
- `Tên nhân vật` da chuyen sang:
- `tx_live_tamtam/Canvas/root/userData/lbl_username`
- `Tài khoản` da chuyen sang:
- `tx_live_tamtam/Canvas/root/userData/lbl_userMoney`
- `Canvas Watch` da co co che visible bang flag `true/false`.
- JS loader da uu tien doc `v4_js_xoc_dia_live.js` tu disk truoc embedded resource.

## Chua Fix Het
- 4 tong cuoc `CHAN/LE/TAI/XIU` chua co source production da xac nhan.
- `devtools_ws_bet_totals_probe.js` van dang can test lai de chot socket/frame hook.
- `home_tick` flow khong dang tin cay khi thieu home JS.

## Nguyen Nhan Goc
- `v4_js_xoc_dia_live.js` coupling rat chat voi scene graph game.
- Trang game moi doi tail/path/layout, trong khi nhieu label tong cuoc/countdown khong con lo ra theo `Label.string` don gian.
- Mot so du lieu tren man hinh hien hop ly hon khi lay tu websocket packet thay vi scene graph.
- Bridge JS vua scan, vua click, vua mount debug UI nen de sua 1 cho anh huong cho khac.

## Workaround Tam Thoi
- Countdown/status: da dung websocket packet, khong quay lai tail.
- 4 tong cuoc:
- test bang `devtools_ws_bet_totals_probe.js`
- chay theo `Snippet + reload`
- kiem tra `__wsBetTotalsProbe.logs()` va `__wsBetTotalsProbe.last()`
- Sau moi sua JS, reload page hoac mo lai app.

## Vung Code De Loi
- `v4_js_xoc_dia_live.js`
- boot UI/mount panel
- URL gating / ready gating
- scene traversal / path match
- `TextMap` / `Scan1000Text`
- `MainWindow.xaml.cs`
- JS loader/inject timing
- CDP tap / websocket parse
- pending finalize/history
- `devtools_ws_bet_totals_probe.js`
- websocket hook timing
- frame coverage

## Build / Quality Snapshot
- Build Debug van co the fail neu `SicboX88Live.exe` dang lock file output.
- Nullability/dead code/warning van con nhieu o `MainWindow`, `Models`, `Tasks/*`.
