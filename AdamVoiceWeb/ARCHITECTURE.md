# ARCHITECTURE

## Cấu trúc project hiện tại
```text
AdamVoiceWeb/
├─ AdamVoiceWeb.csproj
├─ Program.cs
├─ appsettings.json
├─ app.db                        # SQLite runtime khi DataRootPath = "."
├─ audio/                        # audio runtime khi DataRootPath = "."
├─ App_Data/db.json              # legacy JSON để import lần đầu nếu DB trống
├─ Data/
│  └─ AppDbContext.cs
├─ Models/
│  └─ AppModels.cs
├─ Services/
│  ├─ AppDataPaths.cs
│  ├─ SqliteBootstrapService.cs
│  ├─ ElevenLabsService.cs
│  ├─ AiEnhanceService.cs
│  ├─ TextPreprocessService.cs
│  └─ DataStore.cs               # còn dùng cho hash/legacy seed, không phải datastore runtime chính
├─ Pages/
│  ├─ Index.cshtml / Index.cshtml.cs
│  ├─ Packages.*
│  ├─ Admin.*
│  ├─ MyVoices.*
│  ├─ Voices.*
│  ├─ History.*
│  ├─ Transactions.*
│  ├─ Account.*
│  ├─ Login.* / Logout.* / Register.*
│  ├─ Help.cshtml
│  └─ Shared/_Layout.cshtml
└─ wwwroot/
   ├─ css/app.css
   ├─ images/
   └─ js/app.js
```

## Module chính

### Program.cs
- cấu hình Razor Pages;
- cookie auth;
- Google OAuth nếu có:
  - `Authentication:Google:ClientId`
  - `Authentication:Google:ClientSecret`
- DI cho:
  - `AppDataPaths`
  - `AppDbContext`
  - `TextPreprocessService`
  - `HttpClient<ElevenLabsService>`
  - `HttpClient<AiEnhanceService>`
  - `SqliteBootstrapService`
- mount static audio từ `appDataPaths.AudioRootPath` ra `/audio`.

### Data/AppDbContext.cs
- datasource chính của app.
- các bảng chính:
  - `Users`
  - `Voices`
  - `Packages`
  - `VoiceJobs`
  - `PointTransactions`
  - `PurchaseOrders`
- có unique index cho:
  - `Users.Username`
  - `PurchaseOrders.OrderCode`

### Services/AppDataPaths.cs
- resolve toàn bộ đường dẫn runtime.
- logic:
  - nếu `Storage:DataRootPath` rỗng thì fallback `App_RuntimeData/`;
  - nếu có cấu hình thì resolve relative theo `ContentRootPath`.
- hiện cấu hình đang là `"."`, nên runtime nằm ngay ở root project.

### Services/SqliteBootstrapService.cs
- `EnsureCreated()` cho SQLite.
- vá thêm cột/index khi schema tăng dần.
- nếu DB trống:
  - đọc `App_Data/db.json` nếu có;
  - import sang SQLite;
  - nếu không có thì seed dữ liệu mẫu.

### Services/ElevenLabsService.cs
- gọi ElevenLabs Text-to-Speech.
- dùng:
  - `voice.ApiVoiceId` cho voice endpoint;
  - `ElevenLabs:DefaultModelId` hoặc model override cho request;
- lưu audio vào thư mục runtime do `AppDataPaths` cấp.

### Services/AiEnhanceService.cs
- xử lý text enrich trước khi gửi sang ElevenLabs khi bật `Enhance`.
- flow:
  - normalize nếu cần;
  - nếu chưa có `OpenAI:ApiKey` thì fallback rule-based;
  - nếu có key thì gọi OpenAI Responses API;
  - kiểm tra để không làm thay đổi trật tự từ gốc;
  - trả text enhance cho backend dùng nội bộ.

### Services/TextPreprocessService.cs
- chuẩn hóa text tiếng Việt dễ đọc hơn cho TTS;
- đếm ký tự để validate và tính điểm;
- có fallback enhance cơ bản khi chưa có AI thật.

## Dependency giữa các module
```text
Pages/*.cshtml.cs
  ├─ AppDbContext
  ├─ IConfiguration
  ├─ TextPreprocessService
  ├─ ElevenLabsService
  └─ AiEnhanceService            # Index

Program.cs
  ├─ AppDataPaths
  ├─ AppDbContext
  ├─ Google OAuth
  └─ StaticFileOptions(/audio)

SqliteBootstrapService
  ├─ AppDbContext
  ├─ AppDataPaths
  └─ App_Data/db.json            # chỉ dùng để import legacy

ElevenLabsService
  ├─ HttpClient
  ├─ IConfiguration
  └─ AppDataPaths

AiEnhanceService
  ├─ HttpClient
  ├─ IConfiguration
  └─ TextPreprocessService
```

## Data flow

### Tạo giọng async
```text
User click "Tạo giọng nói"
→ JS submit async
→ insertPendingHistoryItem()
→ fetch ?handler=Generate
→ server validate + trừ điểm
→ nếu bật Enhance thì backend gọi AiEnhanceService
→ backend gọi ElevenLabs
→ lưu VoiceJob Completed
→ trả JSON
→ JS render lịch sử + cập nhật điểm + toast
```

### Lỗi tạo giọng
```text
ElevenLabs lỗi / exception
→ catch server-side
→ cộng lại điểm
→ tạo PointTransaction RefundPoint
→ lưu VoiceJob Refunded
→ trả JSON lỗi
→ JS xóa pending item và báo toast
```

### Flow Enhance hiện tại
```text
User bật EnableEnhance
→ UI chỉ đổi trạng thái toggle
→ backend quyết định có enhance hay không
→ text enhance không bắt buộc hiển thị lại vào textarea
→ output dùng để gửi ElevenLabs với model phù hợp
```

### Mua gói
```text
Packages form
→ OnPostCreateOrder
→ nếu đã có đơn Pending/Reported thì reuse đơn đang mở
→ mở popup bước 2
→ hiển thị QR local + thông tin chuyển khoản
→ user bấm "Tôi đã chuyển khoản"
→ order Pending → Reported
→ admin duyệt
→ order Paid + cộng điểm
```

## Trạng thái dữ liệu quan trọng

### PurchaseOrder
- `Pending`: đã tạo đơn, chưa báo chuyển khoản.
- `Reported`: người dùng đã bấm báo chuyển khoản.
- `Paid`: admin đã duyệt và cộng điểm.
- `Cancelled`: đơn bị hủy.

### VoiceJob
- `Completed`
- `Refunded`

### VoiceOption
- `Approved`
- `Pending`
- `Rejected`

## Lưu trữ file
- DB runtime: `app.db` trong `DataRootPath`
- Audio runtime: `audio/` trong `DataRootPath`
- Asset UI: `wwwroot/images`
- Legacy JSON chỉ để import: `App_Data/db.json`

## Cấu hình quan trọng
- `Storage:DataRootPath`
- `ElevenLabs:ApiKey`
- `ElevenLabs:DefaultModelId`
- `ElevenLabs:EnhanceModelId` nếu có
- `OpenAI:ApiKey`
- `OpenAI:EnhanceModel`
- `Authentication:Google:*`
- `Payment:*`
- `BusinessRules:*`

## Dev/runtime note
- `AdamVoiceWeb.csproj` đã exclude các file runtime khỏi watch:
  - `app.db`
  - `app.db-*`
  - `audio/**/*`
  - `App_RuntimeData/**/*`
- mục tiêu là tránh `dotnet watch` bị kích bởi DB/audio runtime.

## WebSocket / realtime
- Không có WebSocket/SignalR.
- Realtime hiện là async request/response + pending UI.
