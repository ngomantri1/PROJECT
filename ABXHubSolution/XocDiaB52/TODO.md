# TODO

## Current Focus
- Giu on dinh selector va runtime scan cho B52 trong `v4_js_xoc_dia_live.js`
- Verify lai flow dat cuoc tren layout moi
- Verify multi-round betting sau fix `seq` sliding window
- Theo doi runtime sau khi bo fallback dat cuoc va selector cu cho layout moi
- Verify lai profile ingame exact tail moi cho:
  - ten nhan vat `.../NameUser`
  - tai khoan `.../moneyLabel`
- Verify countdown progress bar sau khi khoa thang co dinh `20s`

## High Priority
- Verify thuc chien 6 cua exact DOM moi:
  - `CHAN`
  - `LE`
  - `TRANG3_DO1`
  - `DO3_TRANG1`
  - `TU_TRANG`
  - `TU_DO`
- Quyet dinh xu ly `SAP_DOI`:
  - neu layout moi khong co that thi disable hoac guard ro rang
  - khong de heuristics click nham
- Xac nhan khong con duong code nao phu thuoc `betnode/gate*` cu trong flow dat cuoc hien tai
- Khoi phuc hoac bo sung `js_home_v2.js` vao project/embed resource neu Home auto flow van can
- Giam duplicate bridge giua `MainWindow.xaml.cs` va `WebView2LiveBridge.cs`
- Giam compiler warnings hien co, dac biet nullability va unreachable code
- Xac nhan pending rows da finalize lai dung sau khi account tail moi tra `totals.A` on dinh
- Xac nhan cac strategy dung `WaitUntilNewRoundStart()` khong vao nham van khi da bo gate `DecisionSeconds`

## Incomplete / Fragile Areas
- Home flow dang co dependency vao Home JS nhung file nguon khong nam trong tree hien tai
- CDP websocket logging moi bat mot phan; recv/send payload chua log that
- Lease/license van phu thuoc manh vao textbox credentials va runtime HTTP
- Runtime verify cho multi-tab va multi-strategy cung luc chua co test tu dong
- Chua co xac nhan day du cho strategy multi-side neu van co yeu cau `SAP_DOI`

## Refactor Candidates
- Tach `MainWindow.xaml.cs` theo domain:
  - bridge/webview
  - config/stats
  - license/lease
  - history/pending
  - strategy runner
- Tach contract `abx:*` ra tai lieu hoa hoac constant chung
- Gom shared betting loop helpers de giam lap trong `Tasks/*`
- Gom cac probe `devtools_*.js` vao thu muc debug/tools thong nhat

## Test / Verify Again
- Start/stop lien tuc nhieu lan khong bi race
- Strategy chi start khi `__cw_bet`, Cocos va `tick` deu san sang
- Task dat duoc nhieu van lien tiep, khong chi 1 van roi treo cho `seq`
- Pending row khong bi duplicate hoac finalize sai van
- Pending row cap nhat duoc `Ket qua` / `Thang-Thua` / `Tai khoan` sau khi co ket qua moi
- Betting amount `100`, `500`, `600`, `1100` deu tach plan dung
- 6 cua exact DOM moi deu click dung sau khi chuyen layout/trang
- `JackpotMultiSideTask` finalize winners dung cho multi-side
- `MultiChain` va `WinUpLoseKeep` update step dung sau win/loss lien tiep
- Plugin mode va standalone mode cung hien thi resource/icon dung
- DevTools shortcut `F12` va `Ctrl+Shift+I` con hoat dong sau embed mode
- Username/account UI khop exact tail moi tren layout `RoomScene/FooterRoomUi/Left/avatar/*`
- Countdown bar day tu dau round theo thang `20s`, khong bi hut do max runtime > 20

## Lower Priority
- Don comment/debug cu trong JS inject
- Chuan hoa ten strategy hien thi va ID neu can
- Them smoke test tai lieu hoa cho build:
  - `dotnet build`
  - `node --check v4_js_xoc_dia_live.js`

## Non-Goals
- Khong doi business rules cua strategy neu chi co selector/scene doi
- Khong day logic quyet dinh cuoc xuong JS
