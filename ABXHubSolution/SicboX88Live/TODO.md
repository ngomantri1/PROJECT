# TODO

## Dang Lam
- Duy tri on dinh `Canvas Watch` tren host/trang moi.
- Duy tri `TextMap`/`Scan1000Text` sau khi structure scene doi.
- Tim exact `tail` countdown `Prog` moi ma khong sua logic dat cuoc.

## Uu Tien Cao
- Chot `tail` countdown moi cho trang `sicbox88.swgames.club`.
- Sau khi chot duoc tail, thay the tail cu va bo fallback cu cho `Prog`.
- Xac nhan `Canvas Watch` mount on dinh sau reload, navigate, frame moi.
- Xac nhan JS loader tu disk truoc embedded van an toan cho ca plugin/standalone.

## Chua Hoan Thanh
- Countdown detection moi van chua chot exact node.
- `FindCdTail` va `FindCdDeep` moi dung de chan doan, chua chuyen thanh mapping countdown production chac chan.
- Chua co quy trinh scan scene full/structured de bat kip nhanh khi game doi layout lan sau.
- `AutoFillLoginAsync()` van dang tat.
- `js_home_v2.js` van thieu.
- Decision input van chua ap dung day du vao runtime.

## Can Refactor
- Tach logic debug `Canvas Watch` khoi block scan/bet chinh trong `v4_js_xoc_dia_live.js`.
- Gom logic path matching/text reading thanh helper ro rang hon de tranh patch nhieu lop.
- Tach logic countdown diagnostic thanh module rieng thay vi tron vao bridge chinh.
- Giam coupling `MainWindow.xaml.cs`.
- Giam coupling `v4_js_xoc_dia_live.js`.

## Can Test Lai
- `Canvas Watch` visible `true/false` sau reload app/page.
- Boot panel khi `cc` len cham, URL host moi, hoac frame moi.
- `TextMap` tren trang moi sau khi da noi long path matching.
- `Scan1000Text` thay cho `Scan500Text`.
- Nhan `tick` va `prog` sau navigate lai.
- Loader JS tu disk sau khi sua file va khoi dong lai app.

## Cong Viec Debug Countdown
- Chay lai helper DevTools:
- `__cdTailFinder`
- `__cd2`
- `__cd3`
- Dump node quanh box countdown.
- So khop `tail/text/component/rect` voi o countdown giua man hinh.
- Neu countdown khong phai `Label`, can truy node cha/con quanh `loading_view` / `screen_view`.

## Neu AI Sua Tiep
- Chi sua `tail`, DOM match, scene path, URL gating, mount condition.
- Khong sua logic dat cuoc neu van de chi la scan.
- Ghi ro thay doi nao la diagnostic-only, thay doi nao la production mapping.
