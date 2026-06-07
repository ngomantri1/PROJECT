# TODO

## Dang Lam
- Chot huong websocket cho 4 tong cuoc `CHAN/LE/TAI/XIU`.
- Test `devtools_ws_bet_totals_probe.js` tren DevTools bang `Snippet + reload`.
- Sau khi probe websocket cho ket qua dung, noi 4 tong cuoc vao production trong `MainWindow.xaml.cs`.

## Uu Tien Cao
- Xac nhan `devtools_ws_bet_totals_probe.js` lay dung:
- `XIU`
- `TAI`
- `LE`
- `CHAN`
- Neu dung, cap nhat production UI de doc 4 tong cuoc tu packet `bs[]`.
- Duy tri `Canvas Watch` mount on dinh sau reload, navigate, frame moi.
- Xac nhan JS loader tu disk truoc embedded van an toan cho ca plugin/standalone.

## Da Chot
- Khong tiep tuc tim tail countdown giua ban nua.
- Countdown production da lay tu CDP websocket packet.
- Trang thai UI da map dung va da co mau:
- xanh / do / vang
- `Tên nhân vật` da chot:
- `tx_live_tamtam/Canvas/root/userData/lbl_username`
- `Tài khoản` da chot:
- `tx_live_tamtam/Canvas/root/userData/lbl_userMoney`

## Chua Hoan Thanh
- 4 tong cuoc `CHAN/LE/TAI/XIU` chua dong bo trong production.
- Probe scene/tail cho 4 tong cuoc khong dang tin cay.
- Can xac nhan probe websocket trong DevTools co bat duoc socket dung o dung frame hay khong.
- `AutoFillLoginAsync()` van dang tat.
- `js_home_v2.js` van thieu.
- Decision input van chua ap dung day du vao runtime.

## Can Refactor
- Tach logic CDP websocket parse thanh helper/module rieng thay vi de trong `MainWindow.xaml.cs`.
- Tach logic debug `Canvas Watch` khoi block scan/bet chinh trong `v4_js_xoc_dia_live.js`.
- Gom logic path matching/text reading thanh helper ro rang hon de tranh patch nhieu lop.
- Giam coupling `MainWindow.xaml.cs`.
- Giam coupling `v4_js_xoc_dia_live.js`.

## Can Test Lai
- `Canvas Watch` visible `true/false` sau reload app/page.
- Boot panel khi `cc` len cham, URL host moi, hoac frame moi.
- `TextMap` tren trang moi sau khi da noi long path matching.
- `Scan1000Text` thay cho `Scan500Text`.
- Nhan `tick` va `prog` sau navigate lai.
- Loader JS tu disk sau khi sua file va khoi dong lai app.
- `devtools_ws_bet_totals_probe.js`:
- co `ws.attach`
- co `ws.totals`
- `last()` ra dung 4 tong cuoc

## Cong Viec Debug Bet Totals
- Chay `devtools_ws_bet_totals_probe.js` bang `Sources -> Snippets`.
- Reload trang sau khi run snippet.
- Kiem tra:
- `__wsBetTotalsProbe.logs()`
- `__wsBetTotalsProbe.last()`
- Neu van khong co `ws.attach`, socket game co the dang o frame inaccessible hoac tao truoc hook.

## Neu AI Sua Tiep
- Uu tien websocket packet cho 4 tong cuoc, khong quay lai patch tail production nua neu chua co bang chung rat ro.
- Khong sua logic dat cuoc neu van de chi la scan/hien thi.
- Ghi ro thay doi nao la diagnostic-only, thay doi nao la production mapping.
