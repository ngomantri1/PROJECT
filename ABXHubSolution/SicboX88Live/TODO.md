# TODO

## Dang Lam
- Theo doi `Chuỗi kết quả` production sau khi da chuyen sang `CDP live-only`.
- Xac nhan parser `ResultSeq` chi append o `status=ENDED`.
- Xac nhan 4 tong cuoc `CHAN/LE/TAI/XIU` bang `BetArea/lbl_totalbet` van dung tren nhieu layout/man hinh.

## Uu Tien Cao
- Test lai lien tuc chuoi ket qua voi cac tong:
- `5` tu `113`
- `9` tu `144` / `234`
- `10` tu `145`
- `11` tu `335`
- `12` tu `345` / `156`
- Xac nhan moi packet `ENDED + resultRaw` deu sinh:
- `[CDP] ResultSeq add: ...`
- append dung vao `sumSeq`
- Kiem tra UI va mini panel deu hien cung mot chuoi.

## Da Chot
- Khong tiep tuc tim tail countdown giua ban nua.
- Countdown production da lay tu CDP websocket packet.
- Trang thai UI da map dung va da co mau:
- xanh / do / vang
- `Tên nhân vật` da chot:
- `tx_live_tamtam/Canvas/root/userData/lbl_username`
- `Tài khoản` da chot:
- `tx_live_tamtam/Canvas/root/userData/lbl_userMoney`
- 4 tong cuoc production da chot:
- `1 tail chung = BetArea/lbl_totalbet`
- phan loai bang geometry 2x2
- Chuỗi kết quả production da chot:
- chi lay tu `CDP resultRaw`
- chi xu ly `status=ENDED`
- khong fallback lai state/log/scene tail

## Chua Hoan Thanh
- Chua co test regression day du cho moi lan reload app/page de chac chan `sumSeq` bat dau rong dung nhu yeu cau.
- Chua tach parser CDP ra khoi `MainWindow.xaml.cs`.
- `AutoFillLoginAsync()` van dang tat.
- `js_home_v2.js` van thieu.
- Decision input van chua ap dung day du vao runtime.

## Can Refactor
- Tach logic CDP websocket parse thanh helper/module rieng:
- countdown/status
- totals `bs[]`
- result sequence `resultRaw`
- Tach logic debug `Canvas Watch` khoi block scan/bet chinh trong `v4_js_xoc_dia_live.js`.
- Giam coupling `MainWindow.xaml.cs`.
- Giam coupling `v4_js_xoc_dia_live.js`.

## Can Test Lai
- `Canvas Watch` visible `true/false` sau reload app/page.
- `ResultSeq` khong duoc append o packet `BETTING`.
- `ResultSeq` phai append dung o packet `ENDED`.
- `sumSeq` moi phien app bat dau tu rong (`--`) cho den khi CDP co ket qua moi.
- `BetArea/lbl_totalbet` geometry van map dung khi doi do phan giai.
- Username/balance tails van dung sau reload.

## Neu AI Sua Tiep
- Chuỗi kết quả:
- khong duoc bootstrap tu log
- khong duoc load `result-seq.json`
- khong duoc doc scene graph/popup de hien thi production
- neu co sai chuoi, uu tien doi chieu packet `ENDED + resultRaw` trong log truoc
- 4 tong cuoc:
- khong quay lai `lbl_currentBet`, `ChipPanel/lbl_value`, hay tail cu khi chua co ly do ro rang
- khong sua logic dat cuoc neu van de chi la scan/hien thi
