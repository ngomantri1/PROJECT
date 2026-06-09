# Bugs

## Hien Tai

### 1. `Chuỗi kết quả` de sai neu parser doc nham packet `BETTING`
- File:
- `MainWindow.xaml.cs`
- Trieu chung da gap:
- packet `BETTING` van co the mang `resultRaw` cua van truoc
- neu append som, session se bi danh dau da xu ly
- packet `ENDED` moi cua cung session se bi bo qua
- Vi du da xay ra:
- `session=722509`
- packet som bi add nham `raw=156 sum=12`
- packet `ENDED` that su sau do la `raw=144 sum=9`
- Nguyen nhan goc:
- parser `ResultSeq` truoc day khong khoa theo `status=ENDED`
- Trang thai hien tai:
- da fix trong source
- can tiep tuc test log de dam bao khong tai phat

### 2. `sessionId` trong packet co the xuat hien nhieu lan
- File:
- `MainWindow.xaml.cs`
- Trieu chung da gap:
- packet co `lastBonusInfo.sessionId` truoc
- `sessionId` top-level cua van moi xuat hien sau
- regex lay session dau tien se dedupe nham
- Vi du da gap:
- `resultRaw:\"113\"` tong `5`
- packet chua `lastBonusInfo.sessionId=722437`
- nhung `sessionId` that su la `722438`
- Nguyen nhan goc:
- parser doc `sessionId` dau tien trong chuoi
- Trang thai hien tai:
- da fix bang helper lay `sessionId/sid` lan xuat hien cuoi

### 3. 4 tong cuoc `CHAN/LE/TAI/XIU` phu thuoc scene geometry
- File:
- `v4_js_xoc_dia_live.js`
- Trieu chung:
- production hien tai dung `1 tail chung = BetArea/lbl_totalbet`
- phan biet 4 cua bang bo cuc 2x2
- Neu game doi layout, doi bo cuc, hoac them node trung gian, map co the sai
- Trang thai hien tai:
- dang on tren layout da test
- van can theo doi tren cac do phan giai/trang thai game khac

### 4. JS file tren disk va JS da inject co the lech nhau
- File lien quan:
- `MainWindow.xaml.cs`
- `v4_js_xoc_dia_live.js`
- Trieu chung:
- sau khi sua file JS, app/page dang mo co the van chay ban cu
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
- Socket production da xac nhan:
- `wss://livecasino.azhkthg1.net/websocket`
- Countdown production da lay duoc tu packet server:
- `timeBetCountdown`
- fallback `timeBet`
- `stopBetSecond`
- `status`
- Trang thai UI da map dung va da co mau:
- `Phiên mới`
- `Ngừng đặt cược`
- `Đang đợi kết quả`
- `Tên nhân vật` da chuyen sang:
- `tx_live_tamtam/Canvas/root/userData/lbl_username`
- `Tài khoản` da chuyen sang:
- `tx_live_tamtam/Canvas/root/userData/lbl_userMoney`
- 4 tong cuoc production da chuyen sang:
- `tx_live_tamtam/Canvas/root/BetArea/lbl_totalbet`
- phan loai geometry 2x2
- Chuỗi kết quả production da chuyen sang:
- `CDP resultRaw`
- chi append o `status=ENDED`
- khong load state/log cu
- khong fallback scene tail

## Nguyen Nhan Goc
- `v4_js_xoc_dia_live.js` coupling chat voi scene graph game.
- Trang game moi doi tail/path/layout, nhieu label khong con lo ra theo `Label.string` don gian.
- Packet websocket cung co data cu treo lai trong `BETTING`, nen parser phai rat chat.
- `MainWindow.xaml.cs` qua lon nen de phat sinh side-effect neu sua parser ma khong doi chieu log.

## Workaround Tam Thoi
- Neu thay sai chuoi ket qua:
- doi chieu ngay log `[PKT] ... status=ENDED ... resultRaw`
- so voi `[CDP] ResultSeq add: ...`
- neu khong co dong `ResultSeq add` tuong ung, uu tien nghi parser, khong nghi scene tail
- Sau moi sua JS, reload page hoac mo lai app.

## Vung Code De Loi
- `MainWindow.xaml.cs`
- CDP tap / websocket parse
- dedupe theo `sessionId`
- inject/push `sumSeq` sang page
- `v4_js_xoc_dia_live.js`
- boot UI/mount panel
- render `Chuỗi kết quả`
- geometry map cho 4 tong cuoc

## Build / Quality Snapshot
- Build Debug van co the fail neu `SicboX88Live.exe` dang lock file output.
- Warning nullability/dead code van con nhieu o `MainWindow`, `Models`, `Tasks/*`.
