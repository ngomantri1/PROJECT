# Bugs

## Hien Tai

### 1. Countdown `Prog` cua trang moi chua map duoc exact tail
- File: `v4_js_xoc_dia_live.js`
- Tail cu countdown khong con dung tren trang moi.
- Cac candidate scan hien tai thuong nham vao:
- `BetArea/lbl_currentBet`
- `Right/last_result/lbl_count_*`
- `popup/session_history_new/*`
- `loading_view`, `screen_view`, `webview`
- Tac dong:
- `Prog` tren `Canvas Watch` khong doc duoc countdown that
- strategy/debug phu thuoc countdown co nguy co sai timing
- Nguyen nhan kha nang cao:
- structure scene doi
- countdown khong con la `Label.string` don gian
- co the render qua node/container khac

### 2. `Canvas Watch` tung bi an do boot condition qua chat
- File: `v4_js_xoc_dia_live.js`
- Da tung gap:
- mount UI phu thuoc `cc` san sang
- URL gating cu khong nhan host moi
- script return som o nhanh wait/boot
- Tac dong:
- vao mot so game thi panel khong hien du da set visible `true`
- Trang thai hien tai:
- da co fix de mount panel som hon va chap nhan host moi
- van can test lai sau moi dot sua countdown/text map

### 3. `TextMap` bi vo khi doi cau truc trang
- File: `v4_js_xoc_dia_live.js`
- Logic cu phu thuoc full path/tail cu.
- Khi structure scene doi, `TextMap` khong quet ra dung node mong muon.
- Trang thai hien tai:
- da noi long path matching
- da them fallback quet toan scene
- van can test lai sau moi layout moi

### 4. JS file tren disk va JS da inject co the lech nhau
- File lien quan: `MainWindow.xaml.cs`, `v4_js_xoc_dia_live.js`
- Sau khi sua file JS, session dang mo van co the dang chay ban da inject truoc do.
- Tac dong:
- user doi `true/false` hoac doi tail nhung tren app dang mo khong thay hieu luc ngay
- Workaround:
- reload page game hoac mo lai app

### 5. `AutoFillLoginAsync()` dang bi tat bang early return
- File: `MainWindow.xaml.cs`
- Startup va navigation van goi, nhung method return ngay.

### 6. Home JS resource bi thieu
- File lien quan: `MainWindow.xaml.cs`
- `js_home_v2.js` khong ton tai trong project.

### 7. Decision input dang luu nhung chua tac dong runtime day du
- File: `MainWindow.xaml.cs`
- `_decisionPercent` chua duoc cap nhat nhat quan tu input UI.

## Da Fix Hoac Da Giam Tac Dong
- `Canvas Watch` da co co che visible bang flag `true/false`, khong can comment/uncomment dong lenh.
- JS loader da uu tien doc `v4_js_xoc_dia_live.js` tu disk truoc embedded resource.
- `Scan500Text` da nang thanh `Scan1000Text`.
- `TextMap` da duoc noi long tail/path matching va fallback quet scene.
- Boot `Canvas Watch` da duoc noi long de host moi co the mount panel du `cc` len cham.

## Chua Fix Het
- Countdown `Prog` chua co tail moi production-ready.
- `FindCdTail`/`FindCdDeep` moi la diagnostic, chua phai final mapping.
- Van co kha nang mot so trang/game hien panel, mot so trang thi false positive/false negative do gating va scene timing.
- `home_tick` flow khong dang tin cay khi thieu home JS.

## Nguyen Nhan Goc
- `v4_js_xoc_dia_live.js` coupling rat chat voi scene graph game.
- Trang game moi doi tail/path/layout nhung logic scan cu duoc viet theo path cu.
- Countdown co dau hieu render khong theo kieu text label don gian.
- Bridge JS vua scan, vua click, vua mount debug UI nen de sua 1 cho anh huong cho khac.

## Workaround Tam Thoi
- Sau moi sua JS, reload page hoac mo lai app.
- Dung `Canvas Watch` + `FindCdTail` + `FindCdDeep` de khoanh vung countdown moi.
- Neu can debug sau hon, dung helper DevTools `__cdTailFinder`, `__cd2`, `__cd3`.
- Khi `Prog` sai, khong sua logic bet; chi sua scan/tail/path.

## Vung Code De Loi
- `v4_js_xoc_dia_live.js`
- boot UI/mount panel
- URL gating / ready gating
- scene traversal / path match
- countdown detection
- `TextMap` / `Scan1000Text`
- `MainWindow.xaml.cs`
- JS loader/inject timing
- session reload/refresh
- pending finalize/history

## Build / Quality Snapshot
- Build Debug van co the fail neu `SicboX88Live.exe` dang lock file output.
- Nullability/dead code/warning van con nhieu o `MainWindow`, `Models`, `Tasks/*`.
