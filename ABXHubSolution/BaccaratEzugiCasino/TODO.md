# TODO

## Da xong hom nay (2026-05-10)

- [x] Tat emergency HTTP/CDP tap de giam tai runtime (`DisableHttpAndCdpTaps = true`).
- [x] Doi logic status theo `Prog`:
  - `Prog > 0` => `Cho phép đặt cược` (xanh).
  - `Prog <= 0/null` => `Đợi kết quả` (do).
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
- [x] Rà log sau patch:
  - `TABLE-SWITCH-REJECT = 0`,
  - waiting giam ro, ket qua van dung.

## Viec can tiep tuc

- [ ] Theo doi tinh on dinh selector B/P/T theo tung ban (provider co the doi class/tail).
- [ ] Theo doi 24h log switch ban:
  - giu `TABLE-SWITCH-REJECT = 0`.
  - thoi gian vao ban moi -> co seq hop le trong muc cho phep.
  - xac nhan waiting khong bi spam lai khi switch lien tuc.
- [ ] Them canh bao log khi 1 trong 3 selector null qua nguong thoi gian.
- [ ] Xac nhan lai countdown long-run (nhieu round lien tiep) de loai tru stall hiem.
- [ ] Theo doi nguon `net seq` (hien tai thuong rong) de quyet dinh co can giam tan suat auth-keep-js state update nua hay khong.
- [ ] Bo sung smoke test checklist sau rebuild:
  - status mau/chu dung theo `Prog`,
  - B/P/T len canvas deu,
  - seq khong nhay nguoc ve chuoi cu khi switch ban/shuffle,
  - app khong freeze sau khi vao game.

## Refactor uu tien

- [ ] Tach bot logic khoi `MainWindow.xaml.cs` (god object).
- [ ] Chuan hoa service doc snapshot/status/totals de de test.
- [ ] Giam logic heuristic cu con du trong nhung nhanh khong con su dung.

## Deploy checklist bat buoc

- [ ] Rebuild plugin DLL.
- [ ] Restart host `AutoBetHub`.
- [ ] Doi chieu log hash: `[Bridge] Loaded JS from embedded ... sha256=...`.
