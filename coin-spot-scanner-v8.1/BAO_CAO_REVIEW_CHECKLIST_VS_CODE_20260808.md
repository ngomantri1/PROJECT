# REVIEW CHECKLIST V8.1 VS SOURCE — 2026-08-08

## Kết luận

Sai lệch nằm ở **implementation hiện tại**, không nằm ở bộ 6 file V8.1 người dùng vừa gửi.

Đã đối chiếu SHA-256: 6 file người dùng upload trùng byte-for-byte với `docs/specification/` trong ZIP source mới nhất. Vì vậy không nên sửa checklist để hợp thức hóa output hiện tại.

## Root cause chính

### 1. `provisional_quality()` không phải Quality Score V8.1

Source cũ: `backend/scanner/services.py:296-312`.

Function chỉ dùng:
- Market Cap.
- Total Volume.
- FDV/MC.

Sau đó tạo range đến `82`, dù chính payload ghi thiếu:
- product metrics;
- unlock 7D/30D/90D;
- token value capture;
- holder/treasury.

Điều này trái Evidence Integrity của V8.1. Product & Real Adoption có trọng số 24/100; Tokenomics/Unlock 22/100; các nhóm còn lại cũng chưa được chấm. Không thể biến ba proxy market thành `Quality 66–82`.

### 2. Bước 3 không thực hiện Research theo checklist

Source cũ: `backend/scanner/orchestrator.py:273-282`.

Bước 3 chỉ:

`order_by("-quality_score_high", "-volume_24h_usd")`

rồi lấy 15 coin.

Nó chưa thu Product/Usage, Token Value Capture, Valuation/Peers, Moat, Team/Security, Catalyst trước khi xếp hạng. Do đó coin có volume lớn và FDV/MC đẹp có thể đứng đầu, kể cả khi chưa chứng minh ứng dụng thực tế.

### 3. Tie bị phá bằng Volume

Nhiều coin cùng upper range `82` hoặc `80`; khi đó `volume_24h_usd` quyết định thứ hạng. Đây là nguyên nhân trực tiếp khiến danh sách như BONK/FET/PENGU/INJ... xuất hiện theo thứ tự không phản ánh trọng số Quality V8.1.

### 4. `quality_weights` hiện chưa được dùng để tính Quality

`defaults.json` có đủ 24/22/14/16/10/8/6 nhưng source hiện không có engine cộng subscore theo các trọng số đó. Việc config tồn tại không có nghĩa checklist đã được thực thi.

### 5. App đang yêu cầu FULL_SCAN_EXECUTION nhưng backend cố ý hạ về FULL_SCAN_RESEARCH

`start.txt` yêu cầu FULL_SCAN_EXECUTION, nhưng `_validation_gate()` hiện luôn trả `validated_mode = FULL_SCAN_RESEARCH`, Entry vẫn NOT_SCORED và BUY_SETUP luôn 0. Đây là baseline an toàn, nhưng có nghĩa app chưa chạy đầy đủ workflow mà câu lệnh yêu cầu.

### 6. Dashboard chỉ hiển thị 8 trong 15 coin

Source cũ: `frontend/src/App.tsx:153` có `.slice(0, 8)`.

Trong screenshot, notification nói Bước 3 đã chọn 15 coin nhưng table chỉ có 8 dòng. Đây là bug UI riêng, không phải logic checklist.

### 7. Default profile có thể stale sau khi `defaults.json` đổi

`seed_v81` cũ dùng `get_or_create`; profile default tồn tại rồi thì config/checksum không tự cập nhật. Vì ScanRun dùng `profile_snapshot`, một DB cũ có thể chạy config cũ dù source mới đã thay defaults.

### 8. Một số notification/message còn hard-code trạng thái cũ

Bước 4 có thể có unlock provider mới nhưng message vẫn ghi `unlock vẫn UNKNOWN`; Bước 5 cũng cố định lý do thiếu unlock/stop/RR. Điều này làm UI dễ tạo cảm giác source chưa phản ánh dữ liệu mới.

---

# Patch đã chuẩn bị

Patch không sửa 6 file specification. Patch sửa implementation để **không còn trình bày prefilter như Quality Score**.

## Hành vi sau patch

1. Universe vẫn lọc Top 500 / Binance / MC / volume như cũ.
2. Thêm `research_prefilter()` để sắp thứ tự nghiên cứu dựa trên evidence rẻ có thể kiểm tra ngay:
   - FDV/MC band.
   - circulating %.
   - Market Cap priority bucket.
   - total volume.
   - volume/MC.
   - Hard Rule circulating <15%.
3. Prefilter **không phải Quality Score**.
4. `quality_score_low/high = null` và `quality_status = NOT_SCORED` khi Product/Token Value/Unlock/Valuation evidence chưa đủ.
5. Không còn hiển thị range giả như `66–82`.
6. Step 3 trả `selection_mode = PREFILTER_ONLY` và message nói rõ chưa phải Quality ranking V8.1.
7. UI hiển thị cột `Ưu tiên nghiên cứu` riêng và hiển thị đủ 15 coin thay vì 8.
8. Step 4/5 message chuyển sang trạng thái động, không luôn ghi unlock UNKNOWN.
9. `seed_v81` đồng bộ locked default profile với `defaults.json` mới nhưng không thay đổi `ScanRun.profile_snapshot` lịch sử.
10. Thêm regression tests cho prefilter/Quality integrity.

## Điều patch này KHÔNG giả vờ đã làm

Patch này **không biến baseline thành Full Quality Engine**.

Để xếp đúng Quality theo đủ checklist vẫn cần implementation thật cho:
- Product/Usage metrics theo ngành.
- Token Value Capture.
- Peer Valuation/X2 feasibility.
- Moat.
- Team/Governance/Security.
- Narrative/Catalysts.
- Holder/Treasury.

Cho tới khi các adapter đó tồn tại, cách đúng theo V8.1 là `Quality = NOT_SCORED`, không phải tạo điểm cao bằng proxy.

Đây là thay đổi nhằm sửa **false ranking / false scoring**, không làm yếu checklist để khớp code.

---

# File source đã thay đổi

- `backend/scanner/services.py`
- `backend/scanner/orchestrator.py`
- `backend/scanner/tests.py`
- `backend/scanner/management/commands/seed_v81.py`
- `frontend/src/App.tsx`
- `README.md`
- `CURRENT_STATE.md`
- `BUSINESS_RULES.md`
- `ARCHITECTURE.md`
- `TODO.md`
- `BUGS.md`

Không có migration mới.
Không sửa 6 file `docs/specification/*.md`.

---

# Verification đã chạy trong môi trường review

PASS:
- `python -m compileall -q backend`
- Python AST parse các file backend đã sửa.
- Isolated logic check của `research_prefilter()` cho Priority A, FDV/MC >5 và circulating <15%.

Chưa thể chạy ở môi trường review này:
- `python manage.py check`
- Django full tests
- frontend `npm run typecheck`
- frontend `npm run build`
- Docker runtime scan

Lý do: runtime review không có Django dependencies, `frontend/node_modules` hoặc Docker project runtime.

Các bước này được giao cho Codex **chỉ test, không sửa code** trong file lệnh riêng.
