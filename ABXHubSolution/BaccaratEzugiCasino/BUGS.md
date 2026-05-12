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

## Da fix / da giam ro

- Da bo fallback cu cua tong cuoc B/P/T tranh scan nham (nhat la dinh chip `10M`).
- Da chuyen sang `preferred-tail-only` voi 3 selector co dinh.
- Da doi status UI thanh rule don gian theo `Prog` + mau xanh/do ro rang.
- Da bo sung log chi tiet cho switch/sync seq de truy vet nhanh:
  - `[AUTH][TABLE-SWITCH-ACCEPT]`, `[CANVAS][DISPLAY-CLEAR-*]`
  - `[NETSEQ][AUTH-KEEP-JS]`, `[NETSEQ][AUTH-WAIT-BOOTSTRAP]`, `[SEQ][RX-DATA]`.

## Risk con lai

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
