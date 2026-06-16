# ARCHITECTURE

## Cấu trúc project
```text
AdamVoiceWeb/
├─ AdamVoiceWeb.csproj
├─ Program.cs
├─ appsettings.json
├─ App_Data/db.json
├─ Models/
│  └─ AppModels.cs
├─ Services/
│  ├─ DataStore.cs
│  ├─ ElevenLabsService.cs
│  └─ TextPreprocessService.cs
├─ Pages/
│  ├─ Index.cshtml / Index.cshtml.cs
│  ├─ Packages.*
│  ├─ Admin.*
│  ├─ MyVoices.*
│  ├─ Voices.*
│  ├─ History.*
│  ├─ Transactions.*
│  ├─ Account.*
│  ├─ Login.* / Register.* / Logout.*
│  ├─ Help.cshtml
│  └─ Shared/_Layout.cshtml
└─ wwwroot/
   ├─ audio/
   ├─ css/app.css
   ├─ images/
   └─ js/app.js
```

## Module chính

### Program.cs
- cấu hình Razor Pages;
- cookie auth;
- DI cho:
  - `DataStore`
  - `TextPreprocessService`
  - `HttpClient<ElevenLabsService>`

### Models/AppModels.cs
- `AppDb`
- `AppUser`
- `VoiceOption`
- `PointPackage`
- `PurchaseOrder`
- `VoiceJob`
- `PointTransaction`

### Services/DataStore.cs
- quản lý `App_Data/db.json`;
- seed dữ liệu mặc định;
- normalize DB cũ nếu schema thay đổi nhẹ;
- hash password demo;
- `_lock` cho đọc/ghi trong cùng process.

### Services/ElevenLabsService.cs
- mock WAV nếu chưa có API key;
- gọi ElevenLabs Text-to-Speech nếu đã cấu hình;
- dùng:
  - `voice.ApiVoiceId` cho voice endpoint;
  - `ElevenLabs:DefaultModelId` cho model;
- lưu audio vào `wwwroot/audio`.

### Services/TextPreprocessService.cs
- chuẩn hóa text tiếng Việt dễ đọc hơn cho TTS;
- chuyển số / đơn vị / từ vay mượn sang dạng đọc tốt hơn;
- `CountCharacters()` dùng để tính điểm và validate.

## Dependency giữa các module
```text
Pages/*.cshtml.cs
  ├─ DataStore
  ├─ IConfiguration
  ├─ TextPreprocessService       # Index
  └─ ElevenLabsService           # Index

wwwroot/js/app.js
  ├─ gọi handler Razor async
  ├─ cập nhật UI pending/history
  └─ localStorage cho UX state

ElevenLabsService
  ├─ HttpClient
  ├─ IConfiguration
  └─ IWebHostEnvironment

DataStore
  ├─ IWebHostEnvironment
  └─ Models/AppModels.cs
```

## File nào phụ trách gì
- `Pages/Index.cshtml`
  - UI tạo giọng chính;
  - 2 cột/3 vùng tùy theo breakpoint;
  - popup chọn giọng;
  - popup xác nhận tạo giọng;
  - lịch sử gần đây;
  - vùng nhập và hành động tạo giọng.
- `Pages/Index.cshtml.cs`
  - nghiệp vụ tạo giọng;
  - trừ / hoàn điểm;
  - trả JSON cho async generate;
  - preview voice handler nếu có.
- `Pages/Shared/_Layout.cshtml`
  - sidebar;
  - topbar;
  - logo home link;
  - điểm hiện tại dưới logo;
  - mobile nav.
- `wwwroot/js/app.js`
  - char count;
  - localStorage:
    - draft text
    - selected voice
    - selected preset
    - recent voices
  - voice picker popup;
  - preview voice audio;
  - async create voice;
  - pending history item;
  - shared player cho lịch sử;
  - mobile sheet open/close;
  - custom confirm modal;
  - success toast auto-hide.
- `wwwroot/css/app.css`
  - theme chính;
  - responsive layout;
  - popup / sheet / history player / toast / confirm modal.

## Data flow

### Tạo giọng async hiện tại
```text
User click "Tạo giọng nói"
→ JS confirmCreateVoice()
→ mở modal xác nhận nội bộ
→ acceptCreateVoiceConfirm()
→ form.requestSubmit()
→ JS intercept submit
→ focusRecentHistoryPanel()
→ insertPendingHistoryItem()
→ fetch ?handler=Generate
→ server validate + trừ điểm + gọi ElevenLabs
→ server trả JSON
→ JS renderIndexMessages()
→ JS renderRecentHistoryList()
→ JS updatePointBalance()
```

### Lỗi tạo giọng
```text
GenerateSpeechAsync throw / return lỗi
→ catch server-side
→ hoàn điểm
→ tạo RefundPoint
→ lưu VoiceJob Refunded
→ trả JSON lỗi
→ JS xóa pending item
→ JS hiện alert lỗi
```

### Mua gói
```text
Packages form
→ OnPostCreateOrder
→ add PurchaseOrder Pending
→ user chuyển khoản
→ OnPostConfirmPaid
→ Admin approve
→ cộng điểm + PurchaseApproved
```

### Chọn giọng
```text
User click selected voice card
→ openVoicePicker()
→ filter/search/recent/mine
→ optional previewVoice()
→ selectVoiceFromPicker()
→ lưu radio checked + localStorage
→ updateSelectedVoiceCard()
```

## WebSocket packet flow
- Không có WebSocket/SignalR.
- Không có packet realtime.
- Trạng thái realtime hiện tại là fake realtime qua pending item trên client.

## UI update flow

### Voice page
- `Index` không reload toàn trang khi tạo giọng thành công/lỗi.
- `RecentHistory` cập nhật cục bộ từ JSON response.
- success alert:
  - nổi đè lên vùng message;
  - không chiếm chỗ layout;
  - tự ẩn sau 2 giây.

### History audio flow
- chỉ có **một audio player dùng chung**;
- click item mới thì item cũ reset;
- không cho nhiều voice phát song song;
- thanh seek hiện ngay trên item đang active;
- `RecentHistory` cũng có nút tải xuống.

### Mobile popup flow
- `Giọng nói` và `Lịch sử` mở dưới dạng bottom sheet.
- popup chọn giọng là modal riêng, không auto-open khi vào trang.
- popup xác nhận tạo giọng trên mobile hiện giữa màn hình, không phải native confirm.

## OCR / canvas flow
- Không có OCR.
- Không có canvas automation.
- Không có screenshot/capture flow trong app runtime.

## Lưu trữ file
- DB JSON: `App_Data/db.json`
- Audio: `wwwroot/audio`
- Asset UI: `wwwroot/images`

## Cấu hình quan trọng
- `ElevenLabs:ApiKey`
- `ElevenLabs:DefaultModelId`
- `ElevenLabs:UseMockWhenApiKeyEmpty`
- `Payment:*`
- `BusinessRules:MaxCharactersPerJob`
- `BusinessRules:MaxJobsPer10Minutes`
- `BusinessRules:LowPointWarning`
- `BusinessRules:AudioRetentionDays`
