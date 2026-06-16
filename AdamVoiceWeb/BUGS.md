# BUGS

## Bug hiện tại
- Chưa ghi nhận bug nghiệp vụ blocking nào mới sau đợt chỉnh UI gần nhất.
- Vẫn còn warning build:
  - `NETSDK1194`
  - nguyên nhân: dùng `dotnet build -o` ở solution level.
  - đây không phải bug runtime nhưng cần dọn lại quy trình build.
- `BusinessRules:AudioRetentionDays` chưa có tác dụng thực tế vì chưa có cleanup job.
- Password hash hiện vẫn là dạng demo, chưa đạt chuẩn production.
- JSON datastore vẫn có rủi ro khi chạy nhiều instance.

## Bug đã fix

### Nhầm Model ID và Voice ID của ElevenLabs
- Triệu chứng:
  - tạo giọng lỗi `400 model_not_found`
  - message kiểu: model ID không tồn tại.
- Nguyên nhân:
  - lấy nhầm `Voice ID` gán vào `DefaultModelId`, hoặc ngược lại.
- Fix:
  - `DefaultModelId` dùng model thật, ví dụ `eleven_flash_v2_5`;
  - `ApiVoiceId` dùng đúng voice ID, ví dụ của Adam.
- Ghi chú:
  - đây là rule quan trọng, rất dễ tái phát khi sửa config.

### Chọn giọng / preset không nhớ cho lần sau
- Triệu chứng:
  - vào lại trang bị mất giọng đã chọn hoặc preset đã chọn.
- Fix:
  - lưu vào `localStorage`:
    - selected voice
    - selected preset
    - recent voices

### Nội dung nhập bị mất khi tắt/mở lại
- Triệu chứng:
  - draft text mất sau reload hoặc mở lại trang.
- Fix:
  - lưu draft text bằng `localStorage`.

### Lịch sử gần đây phát nhiều audio song song
- Triệu chứng:
  - click nhiều item thì audio phát chồng.
- Fix:
  - dùng shared audio player;
  - reset item cũ khi phát item mới.

### Lịch sử gần đây không hiện seek bar / icon play-pause không đúng
- Triệu chứng:
  - audio đang chạy nhưng icon không đổi;
  - không tua được trong recent history;
  - mobile từng có trường hợp không thấy thanh seek.
- Fix:
  - state `idle/playing/paused` cho từng item;
  - mở `history-audio-bar` trên item active;
  - đồng bộ current time / duration / progress.

### Popup chọn giọng auto-open khi mới vào trang
- Triệu chứng:
  - mở `/Index` là popup voice picker bật sẵn.
- Fix:
  - gọi `closeVoicePicker()` khi load.

### Popup mobile cao thấp không đồng đều
- Triệu chứng:
  - popup `Giọng nói`, `Lịch sử`, `Chọn giọng` không cùng chiều cao, nhìn lệch.
- Fix:
  - chuẩn hóa height/max-height của bottom-sheet/popup mobile.

### Success alert chèn vào layout
- Triệu chứng:
  - alert thành công đẩy composer xuống thay vì nổi đè lên.
- Fix:
  - success alert dùng `alert-floating`;
  - `position: absolute` trong `#indexMessageStack`;
  - auto-hide sau 2 giây.

### Native confirm / alert không đồng bộ theme
- Triệu chứng:
  - popup xác nhận tạo giọng và một số alert dùng UI hệ điều hành, lệch style trang.
- Fix:
  - thay `confirm()` tạo giọng bằng modal nội bộ;
  - lỗi `chưa nhập nội dung` chuyển sang alert trong trang.

### Điểm hiển thị ở topbar làm bố cục rối
- Triệu chứng:
  - card điểm ở topbar chiếm chỗ, không hợp layout mới.
- Fix:
  - chuyển điểm xuống dưới logo sidebar;
  - bỏ card điểm ở topbar.

## Bug chưa fix / rủi ro kỹ thuật

### Race condition ngoài single process
- `DataStore` chỉ lock trong cùng process.
- Nếu nhiều instance:
  - có thể lost update;
  - có thể lệch điểm / order / voice job.
- Workaround:
  - chạy 1 instance;
  - hoặc chuyển sang SQL trước khi scale.

### Refund không cùng transaction vật lý với API call
- Flow hiện tại:
  - trừ điểm
  - gọi API
  - lỗi thì hoàn điểm
- Nếu process chết ở giữa:
  - có thể cần xử lý tay.
- Workaround:
  - thêm recovery flow / queue / transaction DB thật.

### Audio local storage
- Audio đang nằm trong `wwwroot/audio`.
- Rủi ro:
  - đầy disk;
  - mất file khi deploy sai.

### File CSS/JS đã lớn
- `app.css` và `app.js` đang ôm khá nhiều logic UI.
- Rủi ro:
  - dễ đè rule responsive;
  - khó lần bug popup/history.

## Nguyên nhân bug thường gặp
- Nhầm `Voice ID` với `Model ID`.
- Sửa popup mobile nhưng quên desktop, hoặc ngược lại.
- Sửa CSS responsive nhưng không test cả:
  - desktop
  - tablet
  - mobile
- Ghi đè layout nhưng quên giữ `data-point-balance` / hook JS.
- Chỉnh UI history nhưng bỏ sót player state dùng chung.
- Chỉnh localStorage key hoặc flow restore mà quên migrate logic cũ.

## Workaround tạm thời
- Trước khi update production:
  - backup `App_Data/db.json`
  - backup `wwwroot/audio`
  - backup `appsettings.json`
- Nếu khách báo mất điểm:
  - kiểm tra `PointTransactions`
  - kiểm tra `VoiceJobs`
  - nếu cần, hoàn thủ công bằng `AdminAdjust`
- Nếu tạo giọng lỗi ElevenLabs:
  - kiểm tra `DefaultModelId`
  - kiểm tra `ApiVoiceId`
  - kiểm tra API key

## Vùng code dễ lỗi
- `Pages/Index.cshtml.cs`
  - trừ điểm
  - hoàn điểm
  - async JSON generate flow
- `Pages/Index.cshtml`
  - popup confirm
  - popup voice/history
  - recent history layout
- `wwwroot/js/app.js`
  - shared history audio
  - localStorage restore
  - async generate
  - popup open/close
- `wwwroot/css/app.css`
  - responsive popup
  - floating alert
  - 3-column desktop layout
- `Services/ElevenLabsService.cs`
  - payload/model/voice mapping
  - lưu file audio
