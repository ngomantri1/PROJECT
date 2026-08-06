# COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY — README

## 0. Thông tin phiên bản
- Phiên bản: **V8.1 Professional — Execution Integrity**.
- Tên file: `README_V8_1.md`.
- Phạm vi: hướng dẫn cài đặt, sử dụng và bảo trì bộ nguồn V8.1 trong **ChatGPT Project**.
- Mục tiêu: dùng hằng ngày để quét altcoin Spot, tách rõ **chất lượng dự án** khỏi **chất lượng điểm mua**, ưu tiên dự án có ứng dụng thật, tokenomics tốt, thanh khoản thực và định giá còn dư địa.
- V8.1 chỉ dùng cho **Spot**; không dùng cho Futures, Margin hoặc leverage.

---


## 0A. V8.1 sửa gì so với V8.0
V8.1 **không thay trọng số**. Phiên bản này sửa tính toàn vẹn vận hành:
- Không gắn `FULL_SCAN` khi chỉ recap hoặc đánh giá vài coin.
- Bắt buộc Universe Accounting.
- Không chấm số chính xác nếu thiếu subscore/evidence.
- Tách Protocol Quality và Token Value Capture.
- Thêm Score Status FINAL/PROVISIONAL/RANGE/NOT_SCORED.
- Thêm Data Coverage Matrix.
- Sửa Capital Plan để cộng đủ 100% NAV.
- Thêm Report Validation Gate.

## 1. Bộ nguồn V8.1 gồm đúng 6 file

Upload đầy đủ sáu file sau vào phần **Nguồn/Project files** của cùng một ChatGPT Project:

1. `00_CONTEXT_V8_1.md`
   - Vai trò, mục tiêu và triết lý đầu tư.
   - Universe mặc định và sở thích người dùng.
   - Hard Rule cấp thị trường/cấp coin.
   - Kiến trúc Quality, Entry và Opportunity Score.
   - Investment Grade, Execution Action và phân bổ vốn.

2. `01_CHECKLIST_V8_1.md`
   - Quy trình quét đầy đủ.
   - Chuẩn dữ liệu và freshness.
   - Red Flag, unlock, liquidity, fake volume, holder và MM risk.
   - Công thức Quality Score và Entry Score.
   - Điều kiện Top 3, Decision Tree và Capital Allocation Engine.

3. `02_BLACKLIST_V8_1.md`
   - Risk Register và trạng thái `REVIEW`, `WATCH_RISK`, `BLOCKED`, `EXCLUDE`, `CLEARED`.
   - Mã rủi ro, Severity và điều kiện gỡ cảnh báo.
   - Danh sách khởi tạo phải được xác minh lại ở mỗi lần quét.

4. `03_OUTPUT_V8_1.md`
   - Mẫu báo cáo chuẩn.
   - Bảng xếp hạng, Top 3–5, Risk Register và Capital Plan.
   - Mẫu FULL_SCAN, WATCHLIST, SINGLE_COIN, COMPARISON và ENTRY_REFRESH.
   - Output JSON tùy chọn cho phần mềm/scanner.

5. `04_PROJECT_SCORING_GUIDE_V8_1.md`
   - Rubric chấm từng subscore từ 0–10.
   - Chuẩn bằng chứng `E0–E4`.
   - Cách áp Hard Cap, Grade, Confidence và tie-breaker.
   - Quy tắc chống cộng thưởng/trừ điểm trùng.

6. `README_V8_1.md`
   - Hướng dẫn upload, kiểm tra, sử dụng hằng ngày và bảo trì.

### Quy tắc bắt buộc
- Không giữ đồng thời V5, V6, V7 hoặc V7.1 trong cùng Project với V8.1.
- Không trộn file Context/Checklist/Output của các phiên bản khác nhau.
- Không đổi tên một file đơn lẻ rồi giữ nội dung phiên bản cũ.
- Khi cập nhật trọng số hoặc Hard Rule, phải kiểm tra đồng bộ toàn bộ sáu file.

---

## 2. Thứ tự đọc và ưu tiên khi có xung đột

Yêu cầu ChatGPT đọc theo thứ tự:

1. `README_V8_1.md`.
2. `00_CONTEXT_V8_1.md`.
3. `01_CHECKLIST_V8_1.md`.
4. `02_BLACKLIST_V8_1.md`.
5. `04_PROJECT_SCORING_GUIDE_V8_1.md`.
6. `03_OUTPUT_V8_1.md`.

Khi hai nội dung có vẻ xung đột, áp dụng thứ tự ưu tiên sau:

1. **Hard Rule và Red Flag** trong Context/Checklist.
2. **Dữ liệu live/fresh đã xác minh** tại thời điểm quét.
3. Blacklist/Risk Register sau khi xác minh lại trạng thái hiện hành.
4. Công thức và trọng số trong Checklist.
5. Rubric trong Scoring Guide.
6. Cách trình bày trong Output Format.

Không dùng điểm số để vượt Hard Rule.

---

## 3. Cách tạo ChatGPT Project mới

### Bước 1 — Tạo Project
Tạo một ChatGPT Project riêng, ví dụ:

`COIN SPOT V8.1`

Không dùng chung Project này với tài liệu crypto của phiên bản cũ để tránh lẫn logic.

### Bước 2 — Upload đủ sáu file
Upload đúng sáu file V8.1 được liệt kê ở mục 1.

### Bước 3 — Thêm hướng dẫn Project
Có thể dùng đoạn sau trong phần hướng dẫn của Project:

```text
Luôn đọc và tuân thủ bộ COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY trong nguồn Project.
Chỉ đánh giá Spot, không Futures/leverage.
Hard Rule và dữ liệu live thắng điểm số.
Phải chọn đúng Scan Mode: RESEARCH_RECAP, WATCHLIST_SCAN, FULL_SCAN_RESEARCH, FULL_SCAN_EXECUTION hoặc ENTRY_REFRESH.
Mọi FULL_SCAN phải có Universe Accounting.
Luôn tách Quality Score, Entry Score và Opportunity Score; ghi rõ FINAL, PROVISIONAL, RANGE hoặc NOT_SCORED.
Không công bố điểm chính xác nếu thiếu subscore, Evidence Level, nguồn và freshness.
Luôn tách Protocol Quality khỏi Token Value Capture.
Không gọi BUY_SETUP nếu thiếu orderbook live, kline 4H, unlock, stop hoặc RR.
Không ép phải có coin mua và không lấp đủ Top 3 khi không đủ điều kiện.
Capital Plan phải cộng đủ 100% NAV và tách Current Deployable Capital khỏi Target Reserve After Valid Entries.
Trước khi kết luận phải chạy Report Validation Gate.
```

### Bước 4 — Kiểm tra bộ nguồn
Sau khi upload, gửi lệnh:

```text
Đọc toàn bộ 6 file nguồn và xác nhận đang dùng COIN SPOT AI SPECIFICATION V8.1.
Hãy liệt kê đúng tên 6 file, nêu công thức Opportunity Score, trọng số Quality Score, trọng số Entry Score, điều kiện tối thiểu vào Top 3 và các dữ liệu bắt buộc trước khi gọi BUY_SETUP.
Không quét coin ở bước này.
```

Chỉ bắt đầu dùng khi ChatGPT xác nhận đúng:
- Quality Score /100.
- Entry Score /100.
- `Opportunity Score = Quality Score^0.55 × Entry Score^0.45`.
- Hard Rule thắng điểm số.
- Không BUY_SETUP khi thiếu orderbook, kline 4H, unlock hoặc RR.

---

## 4. Ba loại điểm bắt buộc

### 4.1. Quality Score /100
Đánh giá chất lượng tương đối ổn định của dự án/token:

| Nhóm | Trọng số |
|---|---:|
| Product & Real Adoption | 24 |
| Tokenomics, Supply & Unlock | 22 |
| Structural Liquidity & Market Access | 14 |
| Valuation & X2/X3 Feasibility | 16 |
| Moat & Competitive Position | 10 |
| Team, Execution, Governance & Security | 8 |
| Narrative & Verified Catalysts | 6 |
| **Tổng** | **100** |

Quality Score trả lời:

> Dự án/token này có đáng để nắm giữ hay không?

Quality cao không tự động có nghĩa là nên mua ngay.

### 4.2. Entry Score /100
Đánh giá chất lượng điểm mua tại thời điểm quét:

| Nhóm | Trọng số |
|---|---:|
| Market Regime | 12 |
| D1/4H Structure & Setup | 26 |
| Risk/Reward & Asymmetry | 22 |
| Relative Strength | 14 |
| Relative Volume & Money Flow | 12 |
| Overhead Supply | 8 |
| Trigger, Freshness & Execution Readiness | 6 |
| **Tổng** | **100** |

Entry Score trả lời:

> Giá hiện tại có phải thời điểm mua tốt không?

Entry Score phải được cập nhật khi giá, chart, orderbook hoặc Market Regime thay đổi.

### 4.3. Opportunity Score /100
Công thức bắt buộc:

`Opportunity Score = Quality Score^0.55 × Entry Score^0.45`

- Là trung bình nhân có trọng số.
- Không thay bằng trung bình cộng.
- Không dùng `Quality Multiplier`.
- Không cộng bonus tùy ý sau khi tính.
- Hard Rule vẫn có thể `BLOCKED` hoặc `EXCLUDE` dù Opportunity Score cao.

### 4.4. Ngưỡng tham chiếu
- Quality <60: không vào nhóm mua chính.
- Entry <60: không `BUY_SETUP`.
- Top 3 mặc định: Quality >=70, Entry >=70, Opportunity >=72 và đạt toàn bộ Hard Rule.
- Micro-cap/speculative: Quality >=60, Entry >=78, tối đa 1% NAV và phải ghi `SPECULATIVE_BUY`.

---


## 4A. Cách đọc trạng thái điểm
- `FINAL`: đủ bằng chứng để so sánh/xếp hạng chính thức.
- `PROVISIONAL`: còn một nhóm quan trọng chưa hoàn tất; không BUY_SETUP nếu đó là Entry.
- `RANGE`: thiếu nhiều nhóm; chỉ dùng cho nghiên cứu.
- `NOT_SCORED`: không đủ dữ liệu.

Ví dụ:
- `Quality 78 PROVISIONAL` không tương đương `Quality 78 FINAL`.
- `Entry 55 PROVISIONAL` không phải điểm mua.
- Opportunity chỉ FINAL khi cả hai điểm nguồn đều FINAL.

## 5. Chế độ sử dụng hằng ngày

### 5.1. FULL_SCAN — tìm coin mới
Dùng khi muốn quét toàn thị trường.

Lệnh ngắn:

```text
Tìm coin theo checklist V8.1 ở chế độ FULL_SCAN_EXECUTION; bắt buộc Universe Accounting, subscore, Evidence Level, Score Status và Report Validation Gate.
```

Lệnh đầy đủ khuyến nghị:

```text
Thực hiện FULL_SCAN theo COIN SPOT V8.1.
Quét Top 500, chỉ Binance Spot/USDT, ưu tiên MC 100–500M USD.
Xác minh dữ liệu hiện hành về Market Regime, listing, MC/FDV/circulating, unlock 7D/30D/90D, product metrics, Binance volume, spread, orderbook, D1/4H và RR.
Tính riêng Quality Score, Entry Score và Opportunity Score.
Chỉ đưa Top 3 nếu đạt đầy đủ Hard Rule; không lấp danh sách.
Xuất báo cáo theo 03_OUTPUT_V8_1.md và nêu rõ nguồn, timestamp, Data Quality và Confidence.
```

Kết quả phải có:
- Market Summary.
- Data Coverage & Confidence.
- Bảng 10–15 coin.
- Top BUY_SETUP hợp lệ.
- Nhóm `QUALITY_HIGH_WAIT_ENTRY`.
- Coin BLOCKED/EXCLUDE.
- Capital Plan và % USDT.
- Kết luận 7 dòng.

### 5.2. WATCHLIST_SCAN — đánh giá danh sách đang theo dõi
Dùng khi gửi ticker hoặc ảnh watchlist.

```text
Thực hiện WATCHLIST_SCAN theo V8.1 cho các coin sau: RUNE, S, AERO, PENDLE, INJ.
Không tự thêm coin khác.
Tách Quality, Entry, Opportunity, Investment Grade, Liquidity, Tokenomics/Unlock, X2/X3 feasibility và Execution Action.
Xác minh lại dữ liệu live; coin thiếu dữ liệu chỉ được chấm sơ bộ.
```

### 5.3. SINGLE_COIN_REVIEW — đánh giá một coin

```text
Đánh giá RUNE theo SINGLE_COIN_REVIEW V8.1.
Phân tích product/usage, tokenomics/value capture, circulating/unlock, thanh khoản Binance, MC/FDV, X2/X3 feasibility, moat, D1/4H, RR và overhead supply.
Tính Quality Score, Entry Score, Opportunity Score và kết luận Execution Action.
Không đưa vùng mua nếu dữ liệu execution chưa đủ hoặc đã cũ.
```

### 5.4. COMPARISON_SCAN — so sánh hai hoặc nhiều coin

```text
So sánh RUNE và SONIC theo COMPARISON_SCAN V8.1.
Đặt cạnh nhau Quality Score, Entry Score, Opportunity Score, product/usage, tokenomics/unlock, structural liquidity, MC/FDV, X2/X3 feasibility, moat, overhead supply và Execution Action.
Không kết luận chỉ dựa trên Market Cap nhỏ hơn.
Nêu coin nào là dự án tốt hơn và coin nào có điểm mua tốt hơn; đây có thể là hai đáp án khác nhau.
```

### 5.5. ENTRY_REFRESH — cập nhật điểm mua
Dùng khi Quality Score đã được nghiên cứu gần đây nhưng giá/market thay đổi.

```text
Thực hiện ENTRY_REFRESH V8.1 cho RUNE.
Giữ Quality Score cũ chỉ khi project metrics, tokenomics, security và unlock chưa có thay đổi đáng kể.
Tính lại Market Regime, D1/4H, giá, orderbook, volume, RS, RR, Asymmetry, Overhead Supply, Entry Score và Opportunity Score.
So sánh với lần trước và ghi rõ nguyên nhân thay đổi Action.
```

### 5.6. BLACKLIST_REFRESH — cập nhật Risk Register

```text
Quét lại Risk Register V8.1 cho toàn bộ watchlist.
Xác minh Monitoring Tag, delisting/suspension, security incident, unlock, fake volume, orderbook, holder/treasury/MM, mapping và product risk.
Cập nhật Status, Severity, Risk Code, nguồn, ngày xác minh và điều kiện gỡ.
Không giữ trạng thái cũ nếu chưa xác minh lại.
```

---


## 5A. Chọn đúng chế độ quét
| Nhu cầu | Chế độ nên dùng |
|---|---|
| Xuất lại nội dung cũ | `RESEARCH_RECAP` |
| Đánh giá watchlist | `WATCHLIST_SCAN` |
| Quét Top 500, chọn shortlist | `FULL_SCAN_RESEARCH` |
| Quét Top 500 + kiểm tra live để ra BUY_SETUP | `FULL_SCAN_EXECUTION` |
| Cập nhật điểm mua trước lệnh | `ENTRY_REFRESH` |

### Lệnh FULL_SCAN_RESEARCH chuẩn
```text
Quét theo COIN SPOT V8.1 ở chế độ FULL_SCAN_RESEARCH.
Bắt buộc thực sự quét universe, xuất Universe Accounting, chọn 10–15 coin,
chấm Quality với subscore và Evidence Level. Không cấp BUY_SETUP nếu chưa qua execution live.
```

### Lệnh FULL_SCAN_EXECUTION chuẩn
```text
Quét theo COIN SPOT V8.1 ở chế độ FULL_SCAN_EXECUTION.
Hoàn thành Universe Scan và Research Shortlist, sau đó kiểm tra live orderbook Binance,
unlock 7D/30D/90D, D1/4H, entry/stop/TP/RR cho 3–5 coin đứng đầu.
Chỉ đưa Top 3 nếu Quality, Entry và Opportunity đều FINAL.
```

## 6. Câu lệnh chuyên sâu

### Tìm dự án tốt nhưng chưa có điểm mua

```text
Tìm 10 coin Quality Score cao nhất theo V8.1 nhưng Entry Score chưa đạt.
Xếp riêng nhóm QUALITY_HIGH_WAIT_ENTRY và ghi trigger cần chờ.
```

### Tìm coin có ứng dụng thật

```text
Quét V8.1, ưu tiên Product & Real Adoption, economic activity, users, fees/revenue và moat.
Không chấm cao dự án chỉ có whitepaper, công nghệ hoặc narrative.
```

### Tìm coin gần hết unlock

```text
Tìm coin có circulating cao và áp lực unlock thấp theo V8.1.
Không cộng điểm tối đa chỉ vì gần hết unlock; vẫn phải chấm value capture, holder concentration, demand và liquidity.
```

### Tìm coin x2 nhưng không hy sinh chất lượng

```text
Tìm coin có X2 feasibility High/Medium, Quality >=74, Structural Liquidity đạt, Overhead Supply Low/Medium và Entry chưa CHASE.
Ưu tiên MC 100–500M nhưng không hạ dự án tốt chỉ vì MC lớn hơn.
```

### Chấm minh bạch từng subscore

```text
Chấm Quality Score và Entry Score theo V8.1, trình bày từng subscore, trọng số, bằng chứng E0–E4 và Hard Cap đã áp dụng.
Không cho điểm 8 trở lên khi bằng chứng chưa đạt E3.
```

### Kiểm tra nhận định thay đổi

```text
So sánh đánh giá hôm nay với lần quét trước.
Nêu chính xác nhóm dữ liệu nào thay đổi: giá, MC/FDV, unlock, product metric, volume, orderbook, chart, Market Regime hoặc risk status.
Không giải thích chung chung.
```

### Xuất JSON cho scanner/phần mềm

```text
Thực hiện FULL_SCAN V8.1 và xuất cả báo cáo đọc được lẫn JSON theo schema trong 03_OUTPUT_V8_1.md.
Dữ liệu thiếu dùng null, không dùng 0.
```

---

## 7. Dữ liệu bắt buộc trước khi gọi BUY_SETUP

Không được gọi `BUY_SETUP` hoặc `BUY NOW` nếu thiếu một trong các nhóm sau:

1. Binance Spot/USDT hiện hành.
2. Giá và timestamp đủ mới.
3. Kline D1 và 4H.
4. Binance orderbook/spread/depth đủ mới.
5. Unlock 7D/30D/90D đã xác minh.
6. Entry zone, stop/invalidation và TP.
7. RR1/RR2 tính từ giá hiện tại.
8. Không vi phạm blacklist/Hard Rule.
9. Data Quality và Confidence đủ điều kiện.

Nếu thiếu:
- Ghi `WATCH_ONLY`, `WAIT_RETEST`, `QUALITY_HIGH_WAIT_ENTRY` hoặc `BLOCKED` tùy nguyên nhân.
- Không bịa vùng mua.
- Không dùng RR của lần quét cũ.
- Không gọi BUY NOW khi giá đã vượt entry upper >0.5 ATR hoặc thuộc `CHASE`.

---

## 8. Chuẩn nguồn và freshness

V8.1 yêu cầu dùng dữ liệu hiện hành, không chấm từ trí nhớ khi thông tin có thể thay đổi.

### Khi quét hằng ngày
- Giá, kline, volume, listing và orderbook: dữ liệu mới tại thời điểm quét.
- MC, FDV, circulating: xác minh mapping đúng project/token.
- Unlock: kiểm tra lại cửa sổ 7D/30D/90D trong ngày quét.
- Product metrics: dùng kỳ gần nhất có ý nghĩa, ghi rõ 7D/30D/90D hoặc quý.
- Catalyst: chỉ dùng thông tin chính thức, chưa hết hiệu lực.
- Blacklist: không mặc định trạng thái cũ còn đúng.

### Khi dữ liệu thiếu hoặc mâu thuẫn
- Ghi `UNKNOWN`, `CONFLICT` hoặc `UNVERIFIED`.
- Không tự điền bằng suy đoán.
- Hạ Data Quality/Confidence.
- Thiếu từ hai nhóm quan trọng trở lên: chỉ đưa WATCHLIST.
- Unlock conflict hoặc mapping conflict: `BLOCKED` cho đến khi xác minh.

---

## 9. Cách hiểu Grade và Action

### 9.1. Investment Grade
Investment Grade chỉ phản ánh Quality Score:

| Quality | Grade |
|---:|:---:|
| 90–100 | AAA |
| 82–89 | AA |
| 74–81 | A |
| 66–73 | BBB |
| 58–65 | BB |
| 50–57 | B |
| <50 | CCC |

Investment Grade cao không đồng nghĩa nên mua ngay.

### 9.2. Entry Grade

| Entry | Grade | Ý nghĩa tham chiếu |
|---:|:---:|---|
| 85–100 | S | BUY NOW chỉ khi còn trong entry zone và đủ trigger |
| 75–84 | A | BUY RETEST / RECLAIM ENTRY |
| 65–74 | B | WAIT_RETEST hoặc speculative nhỏ |
| 55–64 | C | WATCH_ONLY |
| 40–54 | D | Không mở vị thế mới |
| <40 | F | Loại khỏi danh sách điểm mua |

### 9.3. Execution Action
Action cuối cùng có thể thấp hơn Grade vì Hard Rule hoặc dữ liệu:
- `BUY_SETUP`.
- `SPECULATIVE_BUY`.
- `WAIT_RETEST`.
- `QUALITY_HIGH_WAIT_ENTRY`.
- `WATCH_ONLY`.
- `BLOCKED`.
- `EXCLUDE`.

Không được đánh đồng Grade với Action.

---

## 10. Quy tắc Top 3

Không bắt buộc phải có đủ ba coin.

Coin chỉ được vào Top 3 khi đồng thời:
- Đạt Hard Rule.
- Dữ liệu đủ và fresh.
- Quality >=70.
- Entry >=70.
- Opportunity >=72.
- Có nền tích lũy/tái tích lũy rõ.
- Unlock không nguy hiểm trong thời gian dự kiến nắm giữ.
- RR2 và Asymmetry đạt chuẩn Checklist.
- RS đạt.
- Orderbook và thanh khoản thực đạt.
- Overhead Supply Low/Medium.
- X2 feasibility ít nhất Medium.
- Không thuộc `CHASE`.

Nếu chỉ có một hoặc hai setup hợp lệ, chỉ đưa một hoặc hai.

Nếu không có ít nhất hai setup hợp lệ, kết luận:

**CHƯA NÊN MUA SPOT — TIẾP TỤC GIỮ USDT.**

---

## 11. Quy tắc phân bổ vốn

Khung mặc định trong V8.1:
- Không all-in.
- Không quá 3–4 coin cùng lúc.
- Lệnh đầu: 20–30% vị thế dự kiến.
- Chỉ DCA khi giữ đáy/reclaim hoặc breakout-retest thành công.
- Không DCA chỉ vì giá giảm.
- Tổng high-beta/meme không quá 35% phần vốn đã giải ngân.

### Theo Market Regime
- Thuận lợi: 5–10% NAV/coin với BUY_SETUP chất lượng cao; giữ 25–40% USDT.
- Trung tính: 1–3% NAV/coin; giữ 60–80% USDT.
- Xấu: không mở BUY_SETUP mới; giữ 80–100% USDT.

### Theo Market Cap
- 50–100M: tối đa 1% NAV.
- 100–250M: tối đa 3–6% NAV.
- 250–500M: tối đa 5–8% NAV.
- 500M–1.5B: tối đa 4–7% NAV tùy Quality và liquidity.

Đây là khung kiểm soát rủi ro, không phải cam kết lợi nhuận.

---


## 11A. Cách đọc Capital Plan V8.1
Báo cáo phải tách:
- `Current Deployable Capital`: vốn được phép giải ngân ngay.
- `Target Reserve After Valid Entries`: USDT mục tiêu sau khi có lệnh hợp lệ.
- `Existing Positions`: vị thế đang có nếu người dùng cung cấp.

Nếu không có BUY_SETUP và không có vị thế hiện hữu được cung cấp:
- Current Deployable Capital = 100% USDT.
- Con số 60–80% chỉ là Target Reserve cho giai đoạn sau khi có setup hợp lệ.

## 12. Các lỗi AI bị cấm

- Chỉ đưa một điểm tổng mà không tách Quality và Entry.
- Chấm coin cap nhỏ cao hơn chỉ vì room-to-grow.
- Chấm Product cao từ whitepaper hoặc lời quảng cáo.
- Chấm Tokenomics cao chỉ vì gần hết unlock.
- Chấm Liquidity cao chỉ dựa trên tổng volume, không xét Binance volume/orderbook.
- Gán X2/X3 feasibility chỉ từ Market Cap.
- Gọi Investment Grade cao là tín hiệu mua.
- Gọi Entry Grade cao là đủ mua khi Hard Rule fail.
- Gọi BUY NOW khi giá đã CHASE.
- Dùng dữ liệu giá/RR cũ.
- Không hiển thị coin BLOCKED/EXCLUDE.
- Lấp đủ Top 3 bằng coin không đạt chuẩn.
- Thay đổi điểm nhưng không giải thích dữ liệu nào thay đổi.
- Cộng bonus ngoài mô hình làm tổng vượt 100.
- Phạt cùng một rủi ro ở nhiều nhóm mà không kiểm soát double-count.
- Gọi coin “hết unlock nên không thể bị làm giá”.

---

## 13. Bảo trì bộ nguồn

| Nhu cầu thay đổi | File chính cần sửa | File cần kiểm tra đồng bộ |
|---|---|---|
| Mục tiêu, sở thích, universe, Hard Rule, vốn | `00_CONTEXT_V8_1.md` | Checklist, Output, README |
| Quy trình, ngưỡng, công thức, trọng số | `01_CHECKLIST_V8_1.md` | Context, Scoring Guide, Output, README |
| Risk Code, trạng thái, coin cảnh báo | `02_BLACKLIST_V8_1.md` | Context/Checklist nếu thay Hard Rule |
| Bố cục báo cáo hoặc JSON schema | `03_OUTPUT_V8_1.md` | Checklist và README |
| Cách chấm subscore/bằng chứng | `04_PROJECT_SCORING_GUIDE_V8_1.md` | Checklist, Output |
| Hướng dẫn upload và câu lệnh | `README_V8_1.md` | Toàn bộ tên file/phiên bản |

### Khi thay đổi trọng số
Phải sửa đồng thời ít nhất:
- `00_CONTEXT_V8_1.md`.
- `01_CHECKLIST_V8_1.md`.
- `03_OUTPUT_V8_1.md` nếu bảng scorecard thay đổi.
- `04_PROJECT_SCORING_GUIDE_V8_1.md`.
- `README_V8_1.md`.

### Khi thay đổi phiên bản
- Đổi số phiên bản trong toàn bộ sáu file.
- Ghi ngày cập nhật và Change Log.
- Không giữ tên V8 nhưng nội dung đã là V9.
- Kiểm tra lại công thức, Hard Cap, Top 3 threshold, Action và Capital Allocation.

---

## 14. Quy trình sử dụng hằng ngày đề xuất

### Buổi quét chính
1. Chạy FULL_SCAN hoặc WATCHLIST_SCAN.
2. Đọc Market Regime trước.
3. Xem coin BLOCKED/EXCLUDE.
4. Xem nhóm Quality cao nhưng chưa có Entry.
5. Chỉ xem vùng mua của coin đủ BUY_SETUP.
6. Kiểm tra % USDT và NAV đề xuất.
7. Không dùng vùng mua cũ nếu giá đã thay đổi.

### Trước khi đặt lệnh
1. Chạy ENTRY_REFRESH cho coin dự định mua.
2. Xác minh lại giá, orderbook, spread, depth và slippage.
3. Xác minh lại unlock/Risk Register.
4. Tính lại RR từ giá hiện tại.
5. Xác nhận không CHASE.
6. Chỉ dùng lệnh đầu 20–30% vị thế dự kiến.

### Khi đang nắm giữ
Yêu cầu ChatGPT cập nhật:
- Luận điểm Product/Tokenomics còn nguyên không.
- Market Regime có xấu đi không.
- Có unlock, security, treasury hoặc listing risk mới không.
- D1/4H có mất invalidation không.
- TP1/TP2 và runner có còn hợp lý không.

Lệnh gợi ý:

```text
Rà soát vị thế RUNE theo V8.1.
So sánh luận điểm hiện tại với lúc vào lệnh, cập nhật project risk, tokenomics, market regime, D1/4H, invalidation và kế hoạch TP.
Không khuyến nghị DCA chỉ vì giá giảm.
```

---

## 15. Kiểm tra nhanh trước mỗi báo cáo

### Quality
- [ ] Map đúng ticker/project/contract.
- [ ] Product metric phù hợp ngành.
- [ ] Có users/usage/economic activity thực.
- [ ] Xác minh circulating, emission và unlock.
- [ ] Đánh giá value capture.
- [ ] Xét total volume, Binance volume, spread, depth và slippage.
- [ ] So định giá với peer và mức adoption.
- [ ] Đánh giá moat, team, governance và security.
- [ ] Catalyst có nguồn chính thức.
- [ ] Áp Quality Hard Cap.

### Entry
- [ ] Giá, D1/4H và orderbook đủ mới.
- [ ] Market Regime đã cập nhật.
- [ ] Setup Type gắn đúng.
- [ ] Không CHASE.
- [ ] Có entry, stop, TP và invalidation.
- [ ] RR tính từ giá hiện tại.
- [ ] RS, Relative Volume và Overhead Supply đã chấm.
- [ ] Áp Entry Hard Cap.

### Final
- [ ] Quality, Entry và Opportunity tách riêng.
- [ ] Investment Grade không bị dùng như tín hiệu mua.
- [ ] Blacklist Status, Severity và Risk Codes đầy đủ.
- [ ] Data Quality và Confidence được ghi rõ.
- [ ] Action không mâu thuẫn Hard Rule.
- [ ] Có nguồn và timestamp.
- [ ] Không lấp Top 3.

---


## 15A. Câu lệnh kiểm tra tính toàn vẹn báo cáo
```text
Kiểm tra báo cáo vừa tạo theo V8.1 Execution Integrity:
1) Scan Mode có đúng không?
2) FULL_SCAN có Universe Accounting không?
3) Điểm có subscore và Evidence Level không?
4) Điểm thiếu dữ liệu đã ghi PROVISIONAL/RANGE chưa?
5) Protocol Quality đã tách Token Value Capture chưa?
6) BUY_SETUP có đủ orderbook, unlock, D1/4H và RR không?
7) Capital Plan có cộng đủ 100% không?
8) Top 3 có toàn bộ score FINAL không?
Nếu lỗi, sửa báo cáo trước khi kết luận.
```

## 16. Câu lệnh mặc định nên lưu

### Lệnh quét hằng ngày

```text
Tìm coin theo checklist V8.1 ở chế độ FULL_SCAN_EXECUTION; bắt buộc Universe Accounting, subscore, Evidence Level, Score Status và Report Validation Gate.
Dùng FULL_SCAN, dữ liệu hiện hành, chỉ Binance Spot/USDT và ưu tiên MC 100–500M.
Tách Quality Score, Entry Score và Opportunity Score.
Ưu tiên dự án có ứng dụng thật, tokenomics tốt, thanh khoản thực và X2 feasibility hợp lý.
Áp đầy đủ blacklist, unlock, fake volume, orderbook, D1/4H, RR và Hard Rule.
Không ép đủ Top 3; xuất theo 03_OUTPUT_V8_1.md.
```

### Lệnh quét nhanh watchlist

```text
Quét watchlist theo V8.1: [DANH SÁCH COIN].
Xếp theo Opportunity Score nhưng ưu tiên Action hợp lệ.
Nêu rõ dự án tốt nhất, điểm mua tốt nhất và coin nên loại.
```

### Lệnh kiểm tra trước khi mua

```text
ENTRY_REFRESH V8.1 cho [TICKER].
Dùng dữ liệu live, kiểm tra orderbook, unlock, blacklist, D1/4H, RR, Asymmetry và CHASE.
Chỉ xác nhận BUY_SETUP khi toàn bộ điều kiện execution đều đạt.
```

---

## 17. Giới hạn của framework

- Điểm số là công cụ sàng lọc, không bảo đảm coin tăng giá.
- Dữ liệu crypto có thể thay đổi nhanh, bị sửa hoặc mâu thuẫn giữa nguồn.
- Product tốt không bảo đảm token holder nhận được giá trị nếu value capture yếu.
- Circulating cao không loại bỏ holder/treasury/MM risk.
- Thanh khoản lịch sử tốt không bảo đảm orderbook vẫn tốt tại thời điểm đặt lệnh.
- X2/X3 feasibility là đánh giá xác suất và định giá tương đối, không phải dự báo chắc chắn.
- Khi Data Quality hoặc Confidence thấp, quyết định đúng có thể là giữ USDT.

---

## 18. Cấu trúc kết luận bắt buộc

Mỗi FULL_SCAN nên kết thúc bằng đúng bảy dòng nội dung:

1. Market Regime.
2. Data Quality / Confidence.
3. Có nên mua hôm nay không.
4. Top BUY_SETUP hoặc coin đáng chú ý.
5. Quality cao nhưng cần chờ Entry.
6. BLOCKED/EXCLUDE và % USDT đề xuất.
7. Trigger tiếp theo.

Nếu không đủ setup hợp lệ, dùng kết luận:

**CHƯA NÊN MUA SPOT — TIẾP TỤC GIỮ USDT.**

---

## 19. Phiên bản
**COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY**

Đây là bộ 6 file chính thức dùng trực tiếp trong ChatGPT Project hằng ngày. Không giữ đồng thời V8.0 hoặc V7.x trong cùng Project.
