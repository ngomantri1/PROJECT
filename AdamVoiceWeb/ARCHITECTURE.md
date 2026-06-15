# ARCHITECTURE

## Cấu trúc project
```text
AdamVoiceWeb/
├─ AdamVoiceWeb.csproj
├─ Program.cs
├─ appsettings.json
├─ App_Data/db.json              # sinh khi chạy, database JSON
├─ Models/AppModels.cs           # toàn bộ entity/model
├─ Services/
│  ├─ DataStore.cs               # đọc/ghi seed/normalize db JSON
│  ├─ ElevenLabsService.cs       # tạo audio mock hoặc gọi ElevenLabs
│  └─ TextPreprocessService.cs   # normalize text tiếng Việt và đếm ký tự
├─ Pages/
│  ├─ Index.*                    # tạo giọng
│  ├─ Packages.*                 # mua gói, tạo/confirm/hủy đơn
│  ├─ Admin.*                    # dashboard, duyệt đơn, quản trị user/voice/package
│  ├─ MyVoices.*                 # giọng riêng của user
│  ├─ Voices.*                   # danh sách giọng hệ thống
│  ├─ History.*                  # lịch sử audio
│  ├─ Transactions.*             # lịch sử điểm
│  ├─ Account.*                  # hồ sơ, đổi mật khẩu
│  ├─ Login.* / Register.* / Logout.*
│  ├─ Help.cshtml
│  └─ Shared/_Layout.cshtml      # layout, sidebar, topbar, mobile nav
└─ wwwroot/
   ├─ audio/                     # file audio tạo ra
   ├─ css/app.css                # giao diện chính
   ├─ css/site.css               # CSS phụ/legacy
   ├─ images/                    # logo/favicon
   └─ js/app.js                  # JS UX
```

## Module chính
### Program.cs
- Cấu hình Razor Pages.
- Bật cookie auth.
- Cho anonymous `/Login`, `/Register`.
- Đăng ký DI:
  - `DataStore` singleton
  - `TextPreprocessService` singleton
  - `HttpClient<ElevenLabsService>`

### Models/AppModels.cs
- `AppDb`: root object của JSON database.
- `AppUser`: tài khoản, role, điểm, khóa tài khoản.
- `VoiceOption`: giọng hệ thống/giọng riêng.
- `PointPackage`: gói Starter/Pro/Business tháng/năm.
- `PurchaseOrder`: đơn mua gói chờ duyệt.
- `VoiceJob`: lịch sử tạo audio.
- `PointTransaction`: ledger điểm.

### Services/DataStore.cs
- Quản lý `App_Data/db.json`.
- Seed user demo/admin, system voices, packages.
- Normalize DB để tương thích bản cũ.
- Hash/verify password bằng SHA256 + salt demo.
- Dùng lock nội bộ để serialize thao tác đọc/ghi trong 1 process.

### Services/ElevenLabsService.cs
- Nếu `ElevenLabs:ApiKey` rỗng và `UseMockWhenApiKeyEmpty=true`: tạo WAV demo.
- Nếu có API key: POST `https://api.elevenlabs.io/v1/text-to-speech/{voice.ApiVoiceId}`.
- Lưu file `.mp3` hoặc `.wav` vào `wwwroot/audio`.
- Trả về URL `/audio/<file>`.

### Services/TextPreprocessService.cs
- Chuẩn hóa text tiếng Việt:
  - `kg` → `ki lô gam`
  - `đ/kg` → `đồng một ki lô gam`
  - `40.000đ` → `40 nghìn đồng`
  - `100k` → `100 nghìn`
  - `22h` → `22 giờ`
  - `ship/sale/feedback/TikTok` → từ tiếng Việt dễ đọc hơn
- `CountCharacters()` dùng trim length.

## Dependency giữa module
```text
Pages/*.cshtml.cs
  ├─ DataStore
  ├─ IConfiguration
  ├─ TextPreprocessService     # Index only
  └─ ElevenLabsService         # Index only

ElevenLabsService
  ├─ HttpClient
  ├─ IConfiguration
  └─ IWebHostEnvironment

DataStore
  ├─ IWebHostEnvironment
  └─ Models/AppModels.cs
```

## File nào phụ trách gì
- `Pages/Index.cshtml.cs`: nghiệp vụ tạo giọng, trừ/hoàn điểm, lưu job.
- `Pages/Packages.cshtml.cs`: hiển thị gói theo kỳ, tạo order, user confirm paid, cancel order.
- `Pages/Admin.cshtml.cs`: dashboard, approve/reject order, admin adjust point, lock user, update voice/package, approve/reject custom voice.
- `Pages/MyVoices.cshtml.cs`: user thêm voice ID riêng hoặc gửi request tạo voice.
- `Pages/History.cshtml.cs`: lấy danh sách `VoiceJob` của user.
- `Pages/Transactions.cshtml.cs`: lấy ledger điểm của user.
- `Pages/Voices.cshtml.cs`: danh sách system voices active/approved.
- `Pages/Account.cshtml.cs`: update profile, đổi password.
- `Pages/Shared/_Layout.cshtml`: menu, điểm hiện tại, logo, mobile nav.
- `wwwroot/js/app.js`: frontend helpers, không chứa nghiệp vụ tiền/điểm thật.

## Data flow
### Tạo giọng
```text
Index.cshtml form
→ IndexModel.OnPostAsync
→ TextPreprocessService.Normalize/CountCharacters
→ DataStore.Read: validate user/voice/balance/rate limits
→ DataStore.Update: trừ điểm + UsePoint transaction
→ ElevenLabsService.GenerateSpeechAsync
→ DataStore.Update: add VoiceJob Completed
→ RedirectToPage
```

### Lỗi tạo giọng
```text
ElevenLabsService throw exception
→ catch trong IndexModel
→ DataStore.Update: cộng lại điểm + RefundPoint transaction + VoiceJob Refunded
→ TempData Error
→ RedirectToPage
```

### Mua gói
```text
Packages.cshtml submit packageId
→ PackagesModel.OnPostCreateOrder
→ DataStore.Update: add PurchaseOrder Pending
→ user chuyển khoản thủ công
→ OnPostConfirmPaid: set UserNote/ConfirmedAt
→ Admin.OnPostApproveOrder
→ cộng điểm user + PurchaseApproved transaction + order Paid
```

### Custom voice
```text
MyVoices form
→ add VoiceOption OwnerUserId=userId
→ Status Approved nếu user tự thêm Voice ID
→ Status Pending nếu yêu cầu admin tạo
→ Admin approve: fill ApiVoiceId, rate, Status Approved
→ Index Load hiển thị voice nếu OwnerUserId == current user
```

## WebSocket packet flow
- Không có WebSocket/SignalR.
- Không có packet realtime.
- Các cập nhật UI dựa trên page reload/redirect sau POST.
- Nếu cần realtime sau này, đề xuất SignalR chỉ để báo trạng thái job; ledger điểm vẫn phải update trong server transaction.

## UI update flow
- `app.js` cập nhật tức thời:
  - số ký tự;
  - điểm ước tính;
  - preset slider;
  - confirm trước khi submit;
  - copy chuyển khoản;
  - mở/đóng sidebar mobile.
- Sau POST, server redirect, Razor render lại dữ liệu mới từ `DataStore`.
- `TempData` dùng cho message success/error sau redirect.

## OCR/canvas flow
- Không có OCR.
- Không có canvas automation.
- Không có capture/screenshot flow.

## Lưu trữ file
- Database JSON: `App_Data/db.json`.
- Audio: `wwwroot/audio/voice_<timestamp>_<guid>.mp3|wav`.
- Logo/favicon: `wwwroot/images/*`.

## Cấu hình quan trọng
- `ElevenLabs:ApiKey`
- `ElevenLabs:DefaultModelId`
- `ElevenLabs:UseMockWhenApiKeyEmpty`
- `Payment:*`
- `BusinessRules:MaxCharactersPerJob`
- `BusinessRules:MaxJobsPer10Minutes`
- `BusinessRules:LowPointWarning`
- `BusinessRules:AudioRetentionDays` hiện mới là config, chưa có cleanup job.
