# Architecture

## Cau truc chinh

```text
BaccaratEzugiCasino/
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
