# Project Context

## Overview
- `SicboX88Live` la app WPF `.NET 8` dieu khien auto bet cho game live qua `WebView2`.
- Runtime chinh la cau noi `C# <-> JS`:
- C# quan ly UI, config, task, pending history, license/trial.
- JS trong page game scan `canvas/Cocos`, doc state, va click bet.
- Vung thay doi nhieu nhat hien tai la `v4_js_xoc_dia_live.js` de theo kip DOM/scene moi cua `sicbox88.swgames.club`.

## Tech Stack
- `C#`, `WPF`, `net8.0-windows`
- `Microsoft.Web.WebView2`
- `System.Text.Json`
- `ABX.Core`
- JS bridge: `v4_js_xoc_dia_live.js`
- Build/plugin support: `MainWindow.Startup.cs`, `MainWindow.EmbedMode.cs`, `SicboX88LivePlugin.cs`

## Main Flow
1. `MainWindow` khoi tao config/log/stats va `WebView2`.
2. C# inject JS bridge vao page game.
3. JS scan `cc.director.getScene()` + DOM/canvas roi post `tick` ve C#.
4. C# cap nhat `_lastSnap`, UI, history pending, state round.
5. Strategy chay trong `Task.Run`, doc `GameContext`, goi `TaskUtil.PlaceBet`.
6. C# ghi pending ngay luc enqueue, JS queue click thuc te tren canvas.
7. Khi `seq` doi, C# finalize pending row va cap nhat CSV/UI/stats.

## Coding Rules
- Khong rewrite flow bet-history: nguon su that la C# enqueue, khong phai JS ack.
- Moi update WPF phai qua `Dispatcher`/`UiDispatcher`.
- Moi doc/ghi snapshot song song phai qua `_snapLock`.
- Moi ghi `config.json`/`stats.json` phai qua gate ghi file hien co.
- Moi thay doi bridge phai giu nguyen contract `abx`.
- Khong block UI thread bang loop/poll/file IO/network IO.
- Khong sua logic task neu issue chi nam o `tail`, DOM, scene path, URL gating.

## Naming Rules
- Side parity: `CHAN`, `LE`
- Side tai xiu: `TAI`, `XIU`
- `seq`: chuoi ket qua goc
- `niSeq`: chuoi `N/I` suy ra tu tong tien
- `BetStrategyIndex`: map bang `switch`, khong tin vao so trong `DisplayName`
- JS/C# contract key: `tick`, `bet`, `bet_error`, `bet_trace`, `cw_page_probe`, `cw_ui_state`, `cw_js_error`, `game_hint`

## Important Rules
- Khong doi semantics finalize: chi finalize khi round/`seq` da doi.
- Khong duplicate row tu JS ack.
- Khong pha thu tu JS bet queue.
- Khong bo qua `WaitForBridgeAndGameDataAsync()` truoc khi start strategy.
- Khong pha flow plugin + standalone dung chung `RunStartupAsync()`.
- Khong xoa fallback `PackRes`, `FallbackIcons`, `WebView2` runtime fallback neu chua co thay the chac chan.

## WebSocket Flow
- App khong dua quyet dinh vao parse websocket business payload.
- Data game chinh di qua JS scan scene graph/canvas roi post `tick`.
- CDP websocket chi dung de debug packet khi bat env `TXLS_CDP_TAP=1`.

## Pending Flow
- `TaskUtil.PlaceBet`:
- ghi row vao `_betAll`
- them vao `_pendingRows`
- cap nhat mini panel ngay luc enqueue
- Khi `seq` doi:
- suy ra winner
- finalize row pending
- ghi CSV
- clear `_pendingRows`
- Khong finalize theo JS click ack.

## Threading And UI Rules
- Strategy chay background, UI phai marshal ve `Dispatcher`.
- `GameContext` la entry point an toan cho task thay vi cham truc tiep `MainWindow`.
- Log/file write di qua queue, khong ghi truc tiep trong loop nong.
- `CancellationToken` la co che stop chuan.

## Canvas / UI Diagnostic Rules
- `Canvas Watch` la cong cu debug song song voi bridge, khong duoc de dieu kien boot UI phu thuoc cứng vao `cc` hoac URL cu.
- Visible state cua `Canvas Watch` phai dieu khien bang flag `true/false`, khong dung comment/uncomment dong lenh.
- Khi sua cac nut debug nhu `TextMap`, `Scan1000Text`, `FindCdTail`, `FindCdDeep`, chi duoc sua phan scan/tail/path, khong duoc sua logic dat cuoc.
- JS game hien da uu tien load `v4_js_xoc_dia_live.js` tu disk truoc embedded resource; thay doi file can reload page/app de inject lai.

## Websocket / Scene Update Specifics
- `TextMap` da phai noi long match path va fallback quet toan scene vi structure moi khong con trung full path cu.
- `Canvas Watch` boot tung bi chan boi URL gating va readiness gating; voi host moi can chap nhan `sicbox88.swgames.club` va mount panel truoc, data den sau.
- `Scan500Text` da duoc nang thanh `Scan1000Text`.

## Things Must Not Break
- Contract message JS/C# va shape payload.
- Pending bet history + finalize theo round-close.
- Mapping `BetStrategyIndex -> IBetTask`.
- JS queue click bet.
- Atomic save config/stats.
- Plugin mode, standalone mode, lease/release lifecycle.

## Current Known Gaps
- `AutoFillLoginAsync()` dang bi tat bang early return.
- `js_home_v2.js` khong ton tai trong project.
- Gia tri decision input dang luu nhung chua ap dung day du vao runtime.
- Countdown `Prog` cua trang moi chua chot duoc exact `tail`; tail cu khong con dung, cac candidate dang nham vao `BetArea`, `last_result`, `popup`, va cum `loading_view/screen_view`.
- `MainWindow.xaml.cs` va `v4_js_xoc_dia_live.js` van la 2 vung rui ro cao nhat khi sua.
