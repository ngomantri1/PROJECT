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
