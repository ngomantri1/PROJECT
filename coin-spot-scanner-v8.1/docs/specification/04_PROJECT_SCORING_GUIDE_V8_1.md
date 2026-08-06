# COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY — PROJECT SCORING GUIDE

## 0. Thông tin phiên bản
- Phiên bản: **V8.1 Professional — Execution Integrity**.
- Tên file: `04_PROJECT_SCORING_GUIDE_V8_1.md`.
- Phạm vi: hướng dẫn chấm điểm thống nhất cho **Quality Score**, **Entry Score**, **Opportunity Score**, **Investment Grade**, **Entry Grade** và **Execution Action**.
- File này phải được dùng cùng:
  - `00_CONTEXT_V8_1.md`.
  - `01_CHECKLIST_V8_1.md`.
  - `02_BLACKLIST_V8_1.md`.
  - `03_OUTPUT_V8_1.md`.
  - `README_V8_1.md`.
- Khi có xung đột:
  1. Hard Rule và Red Flag trong Context/Checklist thắng mọi rubric.
  2. Dữ liệu live/fresh đã xác minh thắng dữ liệu cũ.
  3. Checklist quy định công thức và trọng số.
  4. File này hướng dẫn cách gán subscore nhất quán.
  5. Output chỉ quy định cách trình bày.

---

## 1. Mục đích của Scoring Guide

File này giải quyết các lỗi thường gặp khi AI chấm coin:
- Coin cap nhỏ được điểm cao dù sản phẩm yếu.
- Coin có ứng dụng thật nhưng bị đánh giá ngang coin chỉ có narrative.
- Chấm điểm thay đổi mạnh giữa hai lần quét dù dữ liệu gần như không đổi.
- Dùng chart đẹp để che tokenomics xấu.
- Dùng Quality cao để biện minh cho mua ở điểm Entry xấu.
- Chấm 8–9 điểm chỉ dựa trên nhận định định tính.
- Phạt một rủi ro nhiều lần hoặc cộng thưởng trùng lặp.
- Gọi BUY_SETUP dù thiếu orderbook, unlock, trigger hoặc RR.

Mục tiêu vận hành:
1. Chấm đúng **chất lượng dự án/token**.
2. Chấm riêng **chất lượng điểm mua hiện tại**.
3. Xếp hạng cơ hội mà không để một mặt quá mạnh che một mặt quá yếu.
4. Tạo kết quả ổn định, có thể kiểm tra và cập nhật hằng ngày.
5. Ưu tiên dự án có ứng dụng thật, tokenomics tốt, thanh khoản thật và định giá hợp lý.

---

## 2. Kiến trúc điểm bắt buộc

### 2.1. Quality Score /100

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

### 2.2. Entry Score /100

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

### 2.3. Opportunity Score

`Opportunity Score = Quality Score^0.55 × Entry Score^0.45`

Quy tắc:
- Làm tròn 1 chữ số thập phân.
- Không dùng phép cộng tuyến tính đơn giản.
- Không dùng Quality Multiplier.
- Không dùng bonus tùy ý sau khi đã tính điểm.
- Không dùng Opportunity Score để vượt Hard Rule.

### 2.4. Công thức tính điểm nhóm

Mỗi thành phần được chấm từ 0–10:

`Weighted Points = Subscore / 10 × Component Weight`

Ví dụ:
- Product-Market Fit có trọng số 5.
- Subscore = 8/10.
- Điểm quy đổi = `8/10 × 5 = 4.0`.

Tổng các điểm quy đổi tạo thành Quality Score hoặc Entry Score.

---

## 3. Chuẩn bằng chứng trước khi chấm

### 3.1. Mức bằng chứng

| Mức | Mô tả | Giới hạn chấm |
|---|---|---|
| E0 — Không có | Không tìm thấy dữ liệu hoặc không map đúng token/project | `UNKNOWN`; không tự cho điểm |
| E1 — Yếu | Chỉ có tuyên bố marketing, bài tổng hợp hoặc một nguồn phụ | Thường không quá 4/10 |
| E2 — Trung bình | Có một nguồn đáng tin và dữ liệu định lượng nhưng thiếu đối chiếu | Thường không quá 6/10 |
| E3 — Tốt | Có nguồn chính thức/primary data và ít nhất một nguồn đối chiếu | Có thể 7–8/10 |
| E4 — Rất tốt | Nhiều nguồn đồng nhất, dữ liệu theo thời gian và peer comparison | Có thể 9–10/10 |

Không được chấm 9–10 nếu chỉ có E1 hoặc E2.

### 3.2. Freshness theo loại dữ liệu
- Giá/kline/orderbook: phải dùng dữ liệu live hoặc gần thời điểm quét.
- Volume 24H: timestamp cùng ngày quét.
- Market Cap/FDV/circulating: kiểm tra mapping và nguồn hiện hành.
- Unlock: xác minh 7D/30D/90D tại ngày quét.
- Product metrics: dùng kỳ gần nhất có ý nghĩa; ghi rõ 7D/30D/90D hoặc quý.
- Team/security/governance: dùng trạng thái hiện hành.
- Narrative/catalyst: chỉ tính sự kiện chưa hết hiệu lực và có nguồn chính thức.

### 3.3. Khi thiếu dữ liệu
- Không tự suy đoán.
- Ghi `UNKNOWN` hoặc `CONFLICT`.
- Nếu thành phần thiếu nhưng không phải Hard Rule:
  - Chấm sơ bộ theo phần có dữ liệu.
  - Gắn Confidence thấp hơn.
  - Không chấm trên 6/10 cho thành phần đó.
- Nếu thiếu từ 2 nhóm Quality quan trọng: Quality chỉ là sơ bộ, tối đa WATCHLIST.
- Nếu thiếu orderbook, 4H, unlock hoặc RR: không BUY_SETUP.

---


### 3.4. Evidence Cap theo thành phần
Evidence không làm thay đổi bản chất dữ liệu, nhưng giới hạn mức điểm có thể công bố:
- `E0 — Không có bằng chứng`: NOT_SCORED; không cho điểm mặc định.
- `E1 — Nguồn thứ cấp yếu/không fresh`: tối đa 40% điểm thành phần; Status PROVISIONAL.
- `E2 — Một nguồn đáng tin hoặc dữ liệu chưa đầy đủ`: tối đa 70% điểm thành phần.
- `E3 — Nguồn chính/đáng tin, fresh, metric phù hợp`: được dùng toàn thang điểm.
- `E4 — Nhiều nguồn độc lập khớp + dữ liệu chính thức`: toàn thang điểm, Confidence HIGH.

Ngoại lệ:
- Không dùng Evidence Cap để “cho điểm an toàn” khi dữ liệu là UNKNOWN. UNKNOWN phải để trống/NOT_SCORED.
- Hard Rule vẫn thắng Evidence Level.

### 3.5. Score Status Engine
#### FINAL
- Tất cả nhóm có subscore.
- Không critical group UNKNOWN/CONFLICT.
- Evidence tối thiểu E2; nhóm quyết định luận điểm phải E3/E4.

#### PROVISIONAL
- Đúng 1 critical group thiếu/stale hoặc E1–E2 chưa đủ.
- Phải ghi nhóm thiếu và tác động.

#### RANGE
- Từ 2 critical groups thiếu.
- Chỉ đưa khoảng điểm theo kịch bản thấp/cao có căn cứ.

#### NOT_SCORED
- Mapping sai, dữ liệu quá thiếu hoặc không thể đo đúng metric.

## 4. Thang chấm chung 0–10

| Điểm | Ý nghĩa | Mô tả vận hành |
|---:|---|---|
| 0 | Thất bại nghiêm trọng | Không có sản phẩm, dữ liệu sai, rủi ro cực cao hoặc bằng chứng tiêu cực rõ |
| 1–2 | Rất yếu | Hầu như không có giá trị hoặc có nhiều dấu hiệu bất lợi |
| 3–4 | Yếu | Có yếu tố tích cực nhưng thiếu bằng chứng, kém peer hoặc rủi ro cao |
| 5 | Trung bình | Chấp nhận được, chưa có lợi thế rõ |
| 6 | Khá | Tốt hơn mức trung bình nhưng chưa nổi bật |
| 7 | Tốt | Bằng chứng rõ, vượt peer trung bình |
| 8 | Rất tốt | Nhiều chỉ số mạnh, rủi ro được kiểm soát |
| 9 | Xuất sắc | Dẫn đầu ngành hoặc có lợi thế hiếm, nhiều nguồn xác nhận |
| 10 | Đặc biệt | Trường hợp rất hiếm; gần như dẫn đầu rõ rệt và bền vững |

Nguyên tắc hiệu chỉnh:
- 5 không phải điểm xấu; đó là mức trung bình.
- 7–8 chỉ dùng khi có bằng chứng định lượng rõ.
- 9–10 phải hiếm.
- Không dùng số lẻ giả tạo như 7.37 nếu dữ liệu không đủ chính xác. Subscore có thể dùng bước 0.5 khi cần.

---

# PHẦN A — HƯỚNG DẪN CHẤM QUALITY SCORE

## 5. Product & Real Adoption /24

### 5.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Product-Market Fit | 5 |
| Active users/usage thực | 5 |
| Economic activity | 6 |
| Growth & retention | 4 |
| Ecosystem integrations | 4 |
| **Tổng** | **24** |

### 5.2. Product-Market Fit /5

Câu hỏi bắt buộc:
- Sản phẩm giải quyết vấn đề gì?
- Người dùng có thật sự cần sản phẩm không?
- Có thể thay thế bằng giải pháp khác dễ dàng không?
- Usage có tồn tại khi incentive giảm không?
- Sản phẩm đã hoạt động hay chỉ là roadmap?

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Sản phẩm chưa hoạt động, use case mơ hồ, chủ yếu marketing |
| 3–4 | Có sản phẩm nhưng nhu cầu yếu, usage thấp hoặc phụ thuộc incentive |
| 5–6 | Giải quyết nhu cầu thật, có adoption nhưng chưa nổi bật |
| 7–8 | Product-market fit rõ, usage lặp lại, có vị trí trong ngành |
| 9–10 | Dẫn đầu category, nhu cầu bền vững, khó thay thế |

Không được chấm cao chỉ vì công nghệ phức tạp.

### 5.3. Active users/usage thực /5

Ưu tiên:
- Active users có xu hướng ổn định hoặc tăng.
- Tỷ lệ returning users.
- Số giao dịch hữu ích.
- Usage không chủ yếu từ bot, wash hoặc airdrop farming.
- Phân bổ usage không quá tập trung vào một chương trình incentive.

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Hầu như không có người dùng hoặc dữ liệu không đáng tin |
| 3–4 | Users thấp, biến động mạnh, phụ thuộc incentive/bot |
| 5–6 | Usage thật ở mức trung bình, tương đối ổn định |
| 7–8 | Users/usage tăng hoặc duy trì tốt, retention chấp nhận được |
| 9–10 | Usage dẫn đầu peer, bền vững qua nhiều giai đoạn thị trường |

Không so số users tuyệt đối giữa các ngành khác nhau mà không chuẩn hóa.

### 5.4. Economic activity /6

Metric ưu tiên theo ngành:
- DEX: volume, fees, revenue, LP depth, repeat traders.
- Lending: borrows, utilization, net deposits, bad debt, revenue.
- L1/L2: fees, active addresses, stablecoin, application activity.
- Derivatives: organic volume, open interest quality, fees, liquidations.
- Oracle/infra: secured value, integrations đang dùng, paying customers.
- DePIN/compute: paying demand, utilization, unit economics.
- AI/data: paid requests, compute demand, customer concentration.
- Gaming/social: paying users, retention, creator/player economy.

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Không có hoạt động kinh tế hoặc dữ liệu không chứng minh được |
| 3–4 | Có activity nhưng rất thấp, trợ cấp mạnh hoặc không tạo value |
| 5–6 | Economics trung bình, tương xứng giai đoạn dự án |
| 7–8 | Fees/revenue/demand rõ và có xu hướng tốt |
| 9–10 | Dẫn đầu peer, economics mạnh, bền vững và có khả năng mở rộng |

TVL cao nhưng không tạo usage/fees không tự động được điểm cao.

### 5.5. Growth & retention /4

Cần phân biệt:
- Tăng hữu cơ.
- Tăng do incentive.
- Tăng do thị trường chung.
- Tăng một lần vì sự kiện.
- Tăng có giữ được sau 30–90 ngày hay không.

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Suy giảm rõ, users/revenue rời bỏ |
| 3–4 | Tăng không bền, phần lớn do incentive |
| 5–6 | Đi ngang hoặc tăng nhẹ, retention trung bình |
| 7–8 | Tăng hữu cơ, giữ được phần lớn usage |
| 9–10 | Tăng mạnh qua nhiều kỳ, retention vượt peer rõ |

Nếu chỉ có snapshot một ngày: tối đa 5/10.

### 5.6. Ecosystem integrations /4

Chấm integration khi:
- Đã hoạt động.
- Tạo transaction, volume, secured value hoặc users.
- Có độ sâu tích hợp, không chỉ logo đối tác.
- Không phụ thuộc duy nhất một đối tác.

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Hầu như không có integration hoặc chỉ công bố |
| 3–4 | Có vài integration nhưng usage thấp |
| 5–6 | Có hệ sinh thái hoạt động ở mức trung bình |
| 7–8 | Nhiều integration tạo usage rõ |
| 9–10 | Trở thành hạ tầng thiết yếu hoặc có dependency mạnh |

### 5.7. Hard cap nhóm Product
- Không có bằng chứng product/usage thực: Quality tối đa 59.
- Usage chủ yếu bot/incentive, không có economics: Quality tối đa 64.
- Sản phẩm chưa ra mắt: Product Group thường không quá 8/24, trừ trường hợp đặc biệt có sản phẩm tiền nhiệm và bằng chứng mạnh.
- Không dùng Narrative để bù Product.

---

## 6. Tokenomics, Supply & Unlock /22

### 6.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Circulating, inflation & emission | 5 |
| Unlock 7D/30D/90D | 6 |
| FDV/MC & dilution | 4 |
| Token utility & value capture | 4 |
| Treasury/holder concentration | 3 |
| **Tổng** | **22** |

### 6.2. Circulating, inflation & emission /5

Rubric tham chiếu:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Circulating rất thấp, emission cao, lịch cung khó kiểm chứng |
| 3–4 | Circulating thấp hoặc inflation đáng kể |
| 5–6 | Supply trung bình, emission có thể kiểm soát |
| 7–8 | Circulating cao, inflation thấp/giảm, lịch cung rõ |
| 9–10 | Gần/full circulating, emission rất thấp hoặc cơ chế giảm cung đáng tin |

Lưu ý:
- “Đã unlock hết” là lợi thế pha loãng, không chứng minh giá sẽ tăng.
- Burn chỉ có ý nghĩa khi burn thực, đều đặn và đủ lớn so với emission.
- Staking lock không được tính như circulating bị xóa vĩnh viễn.

### 6.3. Unlock 7D/30D/90D /6

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Unlock cao, cliff team/private, conflict hoặc unverified |
| 3–4 | Unlock đáng kể trong 30–90D, allocation rủi ro |
| 5–6 | Unlock trung bình, minh bạch, có khả năng hấp thụ |
| 7–8 | Unlock thấp, lịch rõ, không có cliff lớn gần |
| 9–10 | Không còn cliff đáng kể, emission thấp, nhiều nguồn khớp |

Hard Rule:
- Unlock conflict: BLOCKED.
- Unlock 7D >1% circulating: BLOCKED.
- Unlock 30D >3%: không mua ngay.
- Unlock 90D >8%: hạ mạnh hoặc loại.
- Unlock Confidence POOR: không Top 3, không BUY_SETUP.

Không cộng thêm bonus riêng cho “hết unlock”; lợi thế đã phản ánh tại đây và tại FDV/MC.

### 6.4. FDV/MC & dilution /4

| FDV/MC | Subscore tham chiếu |
|---:|---:|
| <=1.2 | 9–10 |
| >1.2–1.5 | 8–9 |
| >1.5–2.0 | 6–8 |
| >2.0–2.5 | 5–7 |
| >2.5–4.0 | 2–5 |
| >4.0 | 0–3 + hard cap |
| >5.0 và unlock chưa rõ | EXCLUDE |

Điều chỉnh:
- Có value capture mạnh và adoption tăng: có thể ở đầu trên của khoảng.
- Cliff lớn/holder tập trung: dùng đầu dưới của khoảng.
- Không dùng FDV/MC thấp để che inflation không nằm trong max supply.

### 6.5. Token utility & value capture /4

Value capture mạnh có thể gồm:
- Fee share thực.
- Buyback/burn được tài trợ từ revenue.
- Token bắt buộc làm collateral.
- Staking cần thiết cho security/service.
- Demand token tăng cùng usage.
- Quyền truy cập có giá trị kinh tế.

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Token gần như chỉ governance hình thức, usage không tạo demand |
| 3–4 | Utility yếu hoặc có thể thay token khác |
| 5–6 | Có utility thật nhưng value capture chưa mạnh |
| 7–8 | Usage liên kết rõ với demand/cash-flow/security |
| 9–10 | Value capture trực tiếp, bền vững và quy mô đáng kể |

Không chấm buyback/burn cao nếu mới công bố nhưng chưa thực thi.

### 6.6. Treasury/holder concentration /3

Cần loại khỏi phân tích:
- Ví sàn.
- Burn address.
- Bridge/system contract.
- Custody được xác minh.

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Tập trung cực cao, treasury thiếu minh bạch, transfer bất thường |
| 3–4 | Holder concentration cao hoặc khó xác minh |
| 5–6 | Mức trung bình, chưa có red flag rõ |
| 7–8 | Phân bổ tương đối tốt, treasury minh bạch |
| 9–10 | Phân tán tốt, governance cung rõ, không có lịch sử dump |

Nếu dữ liệu holder không đủ: tối đa 5/10 và hạ Confidence.

### 6.7. Chống double-count
- Unlock không được trừ thêm lần nữa bằng penalty ngoài điểm và Hard Rule.
- FDV/MC không được phạt lại trong Valuation nếu cùng một rủi ro đã được tính; Valuation chỉ đánh giá room ở mức giá hiện tại.
- Holder concentration vừa có thể ảnh hưởng Tokenomics vừa ảnh hưởng Blacklist; khi đã BLOCKED thì không cần tiếp tục “trừ thêm” để giải thích hành động.
- Burn/buyback không cộng bonus ngoài score.

---


### 6.8. Protocol–Token Separation Rubric
Không được lấy điểm Product chuyển thẳng sang Value Capture.

#### Protocol Quality — chấm trong Product /24
- PMF, users, usage, fees/revenue, growth, retention.

#### Token Value Capture — chấm trong Tokenomics /4
- `4/4`: nhu cầu token rõ + value accrual trực tiếp, bền vững, net emission hợp lý.
- `3/4`: có burn/buyback/fee sharing hoặc utility bắt buộc nhưng quy mô chưa lớn.
- `2/4`: utility/value capture có nhưng gián tiếp, chưa chứng minh mạnh.
- `1/4`: governance hình thức hoặc staking chủ yếu từ emission.
- `0/4`: token không hưởng lợi, net value leakage hoặc cơ chế bất lợi.
- `UNVERIFIED`: không chấm; Quality PROVISIONAL; không mặc định 2/4.

Hard cap:
- Value Capture UNVERIFIED: Quality Confidence tối đa MEDIUM.
- Product mạnh nhưng value capture 0–1/4: không gọi token “economics mạnh”.
- Cùng một protocol revenue không được cộng ở Product economic activity, Value Capture và Valuation nếu không có ba luận cứ độc lập.

## 7. Structural Liquidity & Market Access /14

### 7.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Total Spot volume & stability | 3 |
| Binance Spot volume & ratio | 3 |
| Spread | 2 |
| Depth & slippage | 3 |
| Market access & Fake Volume Risk | 3 |
| **Tổng** | **14** |

### 7.2. Total Spot volume & stability /3

| Volume 24H | Subscore cơ sở |
|---:|---:|
| <10M USD | 0–3 |
| 10–20M | 4–5 |
| 20–50M | 6–8 |
| 50–100M | 7–9 |
| >100M | 8–10 nếu volume thật |

Điều chỉnh:
- Volume ổn định 7D/20D: + vào đầu trên khoảng.
- Volume một ngày do pump: dùng đầu dưới.
- Volume/MC bất thường và orderbook mỏng: hạ mạnh.
- Volume lớn không chứng minh chất lượng nếu nằm ở sàn kém uy tín.

### 7.3. Binance Spot volume & ratio /3

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Binance volume rất thấp, pair kém hoạt động hoặc mapping bất thường |
| 3–4 | Binance chiếm tỷ lệ thấp, orderbook chưa tương xứng |
| 5–6 | Binance liquidity đạt mức thực thi cơ bản |
| 7–8 | Binance là nguồn liquidity chính hoặc rất mạnh |
| 9–10 | Volume cao, bền, depth tốt và tỷ lệ hợp lý với tổng |

Không đặt một ngưỡng % cứng cho mọi coin; phải xem phân bổ volume toàn thị trường.

### 7.4. Spread /2

| Spread | Subscore |
|---:|---:|
| <=0.05% | 10 |
| >0.05–0.10% | 8–9 |
| >0.10–0.25% | 6–8 |
| >0.25–0.50% | 2–5 |
| >0.50% | 0–2; không mua chính |

Dùng spread median/typical, không chỉ một snapshot bất thường.

### 7.5. Depth & slippage /3

Đánh giá cho lệnh 5M/10M/25M VND:
- Depth ±0.5%.
- Depth ±1%.
- Slippage ước tính.
- Khả năng thoát vị thế khi market xấu.

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | 5M VND đã gây slippage lớn; book rất mỏng |
| 3–4 | Chỉ phù hợp lệnh nhỏ |
| 5–6 | 5–10M VND thực thi được |
| 7–8 | 25M VND thực thi tốt, depth ổn |
| 9–10 | Depth sâu, slippage rất thấp, ổn định |

Slippage >0.5%: giảm vị thế hoặc loại mua chính.

### 7.6. Market access & Fake Volume Risk /3

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Fake Volume Risk High, volume tập trung sàn yếu, chênh giá bất thường |
| 3–4 | Có dấu hiệu nghi ngờ hoặc market access hạn chế |
| 5–6 | Access và volume chấp nhận được |
| 7–8 | Nhiều sàn uy tín, mapping rõ, volume/depth tương xứng |
| 9–10 | Market access rộng, liquidity thật, ít concentration risk |

Fake Volume Risk High: không BUY_SETUP.

---

## 8. Valuation & X2/X3 Feasibility /16

### 8.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Current MC vs peer/stage | 4 |
| Current FDV vs adoption | 3 |
| X2 feasibility | 5 |
| X3 feasibility | 2 |
| Valuation vs usage/economics | 2 |
| **Tổng** | **16** |

### 8.2. Current MC vs peer/stage /4

Không chấm chỉ theo bucket cap.

Rubric:

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | MC cao rõ so với adoption/peer |
| 3–4 | Định giá đắt hoặc room hạn chế |
| 5–6 | Hợp lý so với stage |
| 7–8 | Hấp dẫn so với product và peer |
| 9–10 | Định giá thấp rõ nhưng không phải do dự án suy yếu |

Bucket ưu tiên 100–500M chỉ là điều kiện tìm kiếm, không tự động là 9–10.

### 8.3. Current FDV vs adoption /3

Rubric:
- 0–2: FDV rất cao so với usage và peer.
- 3–4: FDV cao, cần tăng trưởng mạnh mới hợp lý.
- 5–6: FDV tương đối hợp lý.
- 7–8: FDV hấp dẫn, dilution đã phản ánh.
- 9–10: hiếm; FDV thấp rõ so với economics, supply minh bạch.

### 8.4. X2 feasibility /5

Cần kiểm tra:
- MC x2.
- FDV x2.
- Peer valuation.
- Dòng tiền cần thêm.
- Overhead Supply.
- Catalyst.
- Supply unlock.
- Khả năng market hấp thụ.

Rubric:

| Subscore | X2 |
|---:|---|
| 0–2 | Rất khó; định giá x2 phi lý hoặc nhiều vùng cung |
| 3–4 | Low |
| 5–7 | Medium |
| 8–9 | High |
| 10 | High đặc biệt, nhiều yếu tố cùng xác nhận |

Không gọi High chỉ vì cap nhỏ.

### 8.5. X3 feasibility /2

Chấm thận trọng:

| Subscore | X3 |
|---:|---|
| 0–2 | Gần như phi lý trong horizon |
| 3–4 | Low |
| 5–6 | Low/Medium |
| 7–8 | Medium |
| 9–10 | High nhưng phải có catalyst và market thuận lợi |

### 8.6. Valuation vs usage/economics /2

Dùng metric ngành:
- MC/fees.
- FDV/revenue.
- MC/TVL chỉ khi TVL thật sự có ý nghĩa.
- MC/secured value.
- MC/active user hoặc demand proxy.
- So với peer cùng stage.

Không dùng một ratio đơn lẻ để kết luận.

---

## 9. Moat & Competitive Position /10

### 9.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Product differentiation | 3 |
| Network effects/switching cost/liquidity moat | 3 |
| Market position & competition | 2 |
| Durability | 2 |
| **Tổng** | **10** |

### 9.2. Product differentiation /3
- 0–2: clone, dễ thay thế.
- 3–4: có khác biệt nhỏ.
- 5–6: có khác biệt có ích.
- 7–8: khác biệt rõ, tạo adoption.
- 9–10: độc đáo hoặc category leader.

### 9.3. Network effects/switching cost/liquidity moat /3
- 0–2: không có network effect.
- 3–4: effect yếu.
- 5–6: có một số switching cost.
- 7–8: liquidity/data/integration tạo moat rõ.
- 9–10: network effect tự củng cố, đối thủ khó bắt kịp.

### 9.4. Market position & competition /2
- 0–2: mất thị phần, cạnh tranh áp đảo.
- 3–4: niche nhỏ, nhiều đối thủ.
- 5–6: vị trí ổn định.
- 7–8: top-tier hoặc dẫn đầu một phân khúc.
- 9–10: dẫn đầu rõ và có power định chuẩn.

### 9.5. Durability /2
Đánh giá khả năng giữ lợi thế 12–36 tháng:
- 0–2: narrative ngắn, dễ bị thay thế.
- 3–4: lợi thế phụ thuộc incentive.
- 5–6: tương đối bền.
- 7–8: lợi thế có thể duy trì.
- 9–10: moat sâu, khó bị phá vỡ.

Toàn nhóm tối đa 5/10 nếu sản phẩm dễ sao chép và không có switching cost.

---

## 10. Team, Execution, Governance & Security /8

### 10.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Execution history | 2 |
| Developer/product activity | 2 |
| Governance & treasury transparency | 2 |
| Security, reliability & incident response | 2 |
| **Tổng** | **8** |

### 10.2. Execution history /2
- Chấm roadmap delivery, shipping history, khả năng xử lý khủng hoảng.
- Không chấm cao chỉ vì founder nổi tiếng.

### 10.3. Developer/product activity /2
- Ưu tiên release, production activity, audit, integration thực.
- GitHub commit count đơn thuần có thể bị game; không dùng một mình.

### 10.4. Governance & treasury transparency /2
- Quy trình governance rõ.
- Treasury usage minh bạch.
- Không có proposal/transfer bất thường.
- Quyền lực không quá tập trung.

### 10.5. Security, reliability & incident response /2
- Lịch sử uptime.
- Audit không thay thế thực tế bảo mật.
- Exploit đã xử lý minh bạch có thể phục hồi điểm.
- Exploit nghiêm trọng chưa xử lý: BLOCKED/EXCLUDE.

Rubric toàn nhóm:
- 0–2: execution yếu, governance mờ, security risk cao.
- 3–4: trung bình/yếu.
- 5–6: execution và transparency chấp nhận.
- 7–8: team giao hàng đều, quản trị và security tốt.
- 9–10: track record đặc biệt, hiếm.

---

## 11. Narrative & Verified Catalysts /6

### 11.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Sector narrative | 2 |
| Catalyst chính thức 30–180D | 2 |
| Catalyst chưa phản ánh hết | 1 |
| Community/attention quality | 1 |
| **Tổng** | **6** |

### 11.2. Sector narrative /2
- 0–2: narrative chết hoặc dòng tiền rời ngành.
- 3–4: yếu.
- 5–6: trung tính.
- 7–8: narrative mạnh, dòng tiền tăng.
- 9–10: dẫn dắt thị trường nhưng phải tránh FOMO.

### 11.3. Catalyst chính thức /2
Catalyst hợp lệ:
- Mainnet/product launch đã xác nhận.
- Upgrade có lịch.
- Integration đã công bố chính thức.
- Tokenomics change đã được thông qua.
- Revenue/value capture activation.
- Regulatory/listing event chính thức nếu phù hợp.

Không tính:
- Tin đồn.
- KOL dự đoán.
- “Có thể được niêm yết”.
- Roadmap không có ngày hoặc chưa xác nhận.

### 11.4. Catalyst chưa phản ánh hết /1
- Giá chưa pump mạnh.
- Volume chưa FOMO.
- Định giá sau catalyst vẫn hợp lý.
- Nếu đã tăng 50–100% vì tin: điểm thấp.

### 11.5. Community/attention quality /1
Chấm chất lượng:
- Developer/user community.
- Thảo luận gắn với product.
- Không chỉ bot, giveaway hoặc KOL shill.

Narrative không bao giờ được dùng để bù Product/Tokenomics yếu.

---

## 12. Quality hard caps và Investment Grade

### 12.1. Hard caps

| Điều kiện | Quality tối đa/Hành động |
|---|---|
| Không có product/usage thực | 59 |
| Product chủ yếu incentive/bot, không economics | 64 |
| FDV/MC >4 | 64 |
| Circulating <20% | 64 |
| Unlock Confidence POOR | Không Top 3; không BUY_SETUP |
| Token utility/value capture gần như không có | Tokenomics tối đa 12/22 |
| Structural volume <10M | Liquidity tối đa 5/14 |
| Fake Volume Risk High | Không BUY_SETUP |
| Security incident nghiêm trọng chưa xử lý | BLOCKED/EXCLUDE |
| Thiếu 2 nhóm Quality quan trọng | Quality sơ bộ; WATCHLIST |

### 12.2. Investment Grade

| Quality | Grade | Ý nghĩa |
|---:|:---:|---|
| 90–100 | AAA | Đặc biệt, rất hiếm |
| 82–89 | AA | Rất cao |
| 74–81 | A | Cao |
| 66–73 | BBB | Khá |
| 58–65 | BB | Trung bình, thiên đầu cơ |
| 50–57 | B | Yếu |
| <50 | CCC | Không phù hợp nhóm mua chính |

Không gán grade theo danh tiếng, vốn hóa hoặc lịch sử giá.

---

# PHẦN B — HƯỚNG DẪN CHẤM ENTRY SCORE

## 13. Market Regime /12

### 13.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| BTC D1/4H | 3 |
| ETH, ETH/BTC & BTC.D | 3 |
| TOTAL3 & breadth | 3 |
| Alt volume & macro/event risk | 3 |
| **Tổng** | **12** |

### 13.2. BTC D1/4H /3
- 0–2: breakdown D1/4H có volume, biến động bất thường.
- 3–4: yếu, chưa ổn định.
- 5–6: trung tính.
- 7–8: giữ cấu trúc, không hút thanh khoản quá mạnh.
- 9–10: cấu trúc thuận lợi rõ cho altcoin.

### 13.3. ETH, ETH/BTC & BTC.D /3
- Chấm cao khi ETH giữ cấu trúc, ETH/BTC tạo đáy/tăng và BTC.D đi ngang/giảm.
- Chấm thấp khi BTC.D tăng mạnh cùng ETH/BTC giảm.

### 13.4. TOTAL3 & breadth /3
- Breadth mở rộng, nhiều coin trên MA20 D1: cao.
- TOTAL3 breakdown, breadth thu hẹp: thấp.

### 13.5. Alt volume & macro/event risk /3
- Volume altcoin tăng lành mạnh: cao.
- Volume bán tăng, event risk lớn: thấp.

Regime XẤU: Entry tối đa 59 và không BUY_SETUP mới.

---


### 13.6. Market Completeness Cap
- Đủ 8–9/9 nhóm: dùng toàn thang Market Regime.
- Thiếu 1–2: nhóm Market Regime tối đa 8/12, Status PROVISIONAL.
- Thiếu >=3: tối đa 6/12, Confidence LOW, regime tối đa TRUNG TÍNH.
- Fear & Greed không thay thế breadth, ETH/BTC hoặc altcoin volume.

## 14. D1/4H Structure & Setup /26

### 14.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| D1 trend & base | 8 |
| Pump history & accumulation | 5 |
| 4H setup/trigger | 7 |
| Range position/support/ATR | 4 |
| Multi-timeframe alignment | 2 |
| **Tổng** | **26** |

### 14.2. D1 trend & base /8

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Lower-high/lower-low rõ, breakdown chưa reclaim |
| 3–4 | Downtrend chậm lại nhưng chưa có nền |
| 5–6 | Có nền sơ bộ, chưa xác nhận |
| 7–8 | Nền rõ, higher low hoặc reclaim cấu trúc |
| 9–10 | Breakout/retest D1 lành mạnh, cấu trúc mạnh |

D1 lower-high/lower-low rõ: Entry tối đa 59.

### 14.3. Pump history & accumulation /5
Ưu tiên:
- Sideway 30–120 ngày.
- Selling volume giảm.
- Volatility co hẹp.
- Spring/shakeout/reclaim.
- Hấp thụ sau pump.

Hạ điểm:
- >80%/14D chưa retest.
- >100%/30D chưa tích lũy 15–30 ngày.
- Wick dài, pump-dump.
- Giá giữa range sau pump.

### 14.4. 4H setup/trigger /7

| Subscore | Tiêu chuẩn |
|---:|---|
| 0–2 | Không setup hoặc breakdown |
| 3–5 | Setup hình thành nhưng chưa trigger |
| 6–7 | Reclaim/higher low sơ bộ |
| 8–9 | Trigger xác nhận bằng nến đóng và volume |
| 10 | Setup rất sạch, retest giữ tốt, execution rõ |

Không có 4H trigger: Entry tối đa 74 và WAIT_RETEST.

### 14.5. Range position/support/ATR /4
- 0–2: giữa/đỉnh range, xa support >1.5 ATR.
- 3–4: entry không tối ưu.
- 5–6: vị trí trung bình.
- 7–8: gần support hợp lệ, downside ngắn.
- 9–10: sweep/reclaim hoặc retest chính xác, stop ngắn.

### 14.6. Multi-timeframe alignment /2
- D1 xấu, 4H đẹp: thấp.
- D1 nền tốt, 4H trigger cùng hướng: cao.

---

## 15. Risk/Reward & Asymmetry /22

### 15.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Stop/invalidation & downside | 5 |
| RR1 | 5 |
| RR2 | 4 |
| TP structure & runner | 3 |
| Asymmetry Score | 5 |
| **Tổng** | **22** |

### 15.2. Stop/invalidation & downside /5
- 0–2: không có stop hoặc stop tùy ý.
- 3–4: stop quá xa, risk lớn.
- 5–6: stop chấp nhận.
- 7–8: invalidation rõ, risk kiểm soát.
- 9–10: downside ngắn, cấu trúc sạch, slippage nhỏ.

Không có stop: không mua.

### 15.3. RR1 /5

| RR1 | Subscore |
|---:|---:|
| <1.5 | 0–2; không mua |
| 1.5–1.79 | 4–5 |
| 1.8–2.49 | 6–8 |
| >=2.5 | 8–10 nếu TP hợp lý |

Market Trung tính cần RR1 >=1.8.

### 15.4. RR2 /4

| RR2 | Subscore |
|---:|---:|
| <2.0 | 0–3 |
| 2.0–2.49 | 4–6 |
| 2.5–3.49 | 7–8 |
| >=3.5 | 8–10 nếu không xuyên nhiều vùng cung |

RR2 <2.5: không Top 3 mặc định.

### 15.5. TP structure & runner /3
- TP phải theo vùng cung/structure.
- Runner chỉ hợp lý nếu market, Quality, volume và Overhead Supply cho phép.
- TP tùy ý hoặc chỉ nhân % từ entry: điểm thấp.

### 15.6. Asymmetry Score /5
Asymmetry /10 phải xem:
- Downside đến stop.
- Upside đến TP.
- Xác suất trigger.
- Overhead supply.
- Time-to-target.
- Runner potential.

| Asymmetry | Subscore dùng trực tiếp |
|---:|---:|
| <5 | 0–4 |
| 5 | 5 |
| 6–7 | 6–7 |
| 8 | 8 |
| 9–10 | 9–10 |

Asymmetry <5: không Top 3.

---

## 16. Relative Strength /14

### 16.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Coin/BTC | 4 |
| Coin/ETH | 3 |
| So với ngành | 3 |
| Hành vi khi market giảm/đi ngang/hồi | 4 |
| **Tổng** | **14** |

Rubric toàn nhóm:
- 0–2: yếu rõ trên mọi benchmark.
- 3–4: underperform.
- 5–6: trung tính.
- 7–8: outperform ổn định.
- 9–10: dẫn đầu ngành và chống chịu tốt.

Quy tắc:
- BTC hồi mà coin không hồi: hạ mạnh.
- Một nến pump không đủ chứng minh RS.
- Dùng cửa sổ 7D/30D/90D phù hợp, không chỉ 24H.
- RS <5/10: WATCH_ONLY; Entry tối đa 69.

---

## 17. Relative Volume & Money Flow /12

### 17.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Volume contraction trong nền | 3 |
| Selling volume giảm | 2 |
| Reclaim/trigger volume | 3 |
| Breakout volume quality | 2 |
| Binance flow confirmation | 2 |
| **Tổng** | **12** |

Rubric:
- 0–2: volume hỗn loạn, selling pressure cao.
- 3–4: yếu hoặc không xác nhận.
- 5–6: trung tính.
- 7–8: contraction tốt, trigger volume hợp lý.
- 9–10: money flow xác nhận đa khung, chưa FOMO.

Dấu hiệu tốt:
- Volume co hẹp trong nền.
- Nhịp giảm có volume giảm.
- Reclaim tăng volume vừa phải.
- Breakout khoảng 1.5–2.5x avg 20D nhưng chưa quá nóng.
- Binance volume/depth cùng tăng.

Dấu hiệu xấu:
- Giá tăng nhưng volume giảm.
- Volume chỉ xuất hiện sau pump.
- Wick dài và volume không đi cùng depth.
- Relative Volume WEAK: không BUY NOW; Entry tối đa 69.

---

## 18. Overhead Supply /8

### 18.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Mật độ vùng cung | 3 |
| Room tới TP/x2 | 2 |
| Volume profile/absorption | 2 |
| Trapped-holder risk | 1 |
| **Tổng** | **8** |

Rubric:
- 0–3: HIGH — nhiều vùng cung, holder kẹt, x2 phải xuyên nhiều kháng cự.
- 4–6: MEDIUM — có 1–2 vùng cung nhưng vẫn có room.
- 7–10: LOW — phía trên tương đối trống hoặc đã hấp thụ tốt.

Quy tắc:
- Overhead Supply HIGH: Entry tối đa 69, không Top 3.
- High + narrative yếu: WATCH_ONLY.
- Không kết luận Low chỉ vì chart zoom gần không thấy kháng cự; phải xem D1 đủ dài.

---

## 19. Trigger, Freshness & Execution Readiness /6

### 19.1. Cấu trúc

| Thành phần | Trọng số |
|---|---:|
| Giá/kline fresh | 1 |
| Orderbook/spread/depth live | 1.5 |
| Trigger xác nhận | 2 |
| Giá trong entry zone & slippage đạt | 1.5 |
| **Tổng** | **6** |

Rubric:
- 0–2: dữ liệu stale, không có orderbook/trigger.
- 3–4: một phần dữ liệu đủ nhưng chưa sẵn sàng thực thi.
- 5–6: fresh, orderbook live, trigger và entry zone rõ.
- 7–8: execution tốt.
- 9–10: execution rất sạch và dễ lặp lại.

Hard Rule:
- Không orderbook live: không BUY_SETUP.
- Kline 4H stale/không đạt: không BUY_SETUP.
- Vượt entry upper >0.5 ATR: CHASE.
- Giá đã thay đổi 3–5%: tính lại RR và Entry.

---

## 20. Entry hard caps và Entry Grade

### 20.1. Hard caps

| Điều kiện | Entry tối đa/Hành động |
|---|---|
| Market XẤU | 59; không BUY_SETUP |
| D1 lower-high/lower-low rõ | 59; WATCH_ONLY |
| Không 4H trigger | 74; WAIT_RETEST |
| CHASE | 59; cấm mua |
| RR1 <1.5 | 54; không mua |
| RR1 <1.8 trong market Trung tính | 64 |
| RR2 <2.5 | Không Top 3 |
| Asymmetry <5 | 69; không Top 3 |
| RS <5 | 69; WATCH_ONLY |
| Relative Volume WEAK | 69; không BUY NOW |
| Overhead Supply HIGH | 69; không Top 3 |
| Orderbook không live | 59; không BUY_SETUP |
| Kline 4H stale | 59; không BUY_SETUP |
| Pump >100%/30D chưa tái tích lũy | 59; WAIT_RETEST |

### 20.2. Entry Grade

| Entry | Grade | Hành động tham chiếu |
|---:|:---:|---|
| 85–100 | S | BUY NOW nếu đủ trigger và còn trong zone |
| 75–84 | A | BUY RETEST / RECLAIM ENTRY |
| 65–74 | B | WAIT_RETEST hoặc speculative nhỏ |
| 55–64 | C | WATCH_ONLY |
| 40–54 | D | Không mở vị thế |
| <40 | F | Loại khỏi danh sách điểm mua |

Entry Grade không thắng Hard Rule.

---


## 20A. Exact Score vs Range
### Quality
- Không có bảng 7 nhóm: không công bố số chính xác.
- Một critical group UNKNOWN: có thể công bố PROVISIONAL nếu phần còn lại đủ; phải nêu cap.
- >=2 critical groups UNKNOWN: dùng khoảng hoặc NOT_SCORED.

### Entry
- Thiếu orderbook live: tối đa PROVISIONAL, không BUY_SETUP.
- Thiếu orderbook + unlock hoặc RR: RANGE/NOT_SCORED.
- Giá thay đổi >3–5% hoặc >0.5 ATR từ thời điểm chấm: điểm cũ STALE, cần ENTRY_REFRESH.

### Opportunity
- Chỉ FINAL khi cả Quality và Entry FINAL.
- Không xếp hạng Top 3 chính thức bằng Opportunity PROVISIONAL/RANGE.

# PHẦN C — OPPORTUNITY, ACTION VÀ XẾP HẠNG

## 21. Opportunity Score

### 21.1. Công thức
`Opportunity = Quality^0.55 × Entry^0.45`

Ví dụ:
- Quality 84, Entry 60 → Opportunity khoảng 72.
- Quality 65, Entry 88 → Opportunity khoảng 74.
- Quality 80, Entry 80 → Opportunity 80.

Ý nghĩa:
- Dự án tốt nhưng chưa có điểm mua: Opportunity bị kéo xuống.
- Chart đẹp nhưng dự án trung bình: Opportunity không được phóng đại.
- Chỉ khi cả hai cùng cao thì Opportunity mới cao bền vững.

### 21.2. Ngưỡng

| Opportunity | Ý nghĩa |
|---:|---|
| >=82 | Rất mạnh, vẫn cần Hard Rule pass |
| 75–81.9 | Mạnh |
| 68–74.9 | Có tiềm năng, thường cần chờ hoặc vị thế nhỏ |
| 60–67.9 | Watchlist |
| <60 | Không ưu tiên |

### 21.3. Sàn bắt buộc
- Quality <60: không nhóm mua chính.
- Entry <60: không BUY_SETUP.
- Top 3: Quality >=70, Entry >=70, Opportunity >=72.
- Micro-cap speculative: Quality >=60, Entry >=78, tối đa 1% NAV.

---

## 22. Execution Action

### 22.1. BUY_SETUP
Chỉ khi:
- Hard Rule pass.
- Data Quality GOOD hoặc MIXED không thiếu dữ liệu bắt buộc.
- Confidence không LOW.
- Quality >=60; nhóm mua chính thường >=70.
- Entry >=70 hoặc trường hợp đặc biệt theo checklist.
- Có orderbook live.
- Có 4H trigger.
- Có stop/invalidation.
- RR đạt.
- Không CHASE.

### 22.2. SPECULATIVE_BUY
Dùng khi:
- Quality 60–69 hoặc MC 50–100M.
- Entry rất mạnh, thường >=78.
- Thanh khoản đủ cho vị thế nhỏ.
- Tối đa 1% NAV với micro-cap.
- Ghi rõ không phải vị thế chính.

### 22.3. WAIT_RETEST
- Setup tốt nhưng chưa trigger/retest.
- Giá hơi xa entry.
- RR chưa tối ưu.
- Không được biến thành BUY NOW.

### 22.4. QUALITY_HIGH_WAIT_ENTRY
- Quality cao, thường >=74.
- Entry <65 hoặc cấu trúc chưa phù hợp.
- Không có Hard Rule nghiêm trọng.
- Phải ghi trigger cần chờ.

### 22.5. WATCH_ONLY
- Dữ liệu chưa đủ.
- RS/RR/structure chưa đạt.
- Quality trung bình hoặc market không thuận lợi.

### 22.6. BLOCKED
- Có rủi ro có thể gỡ theo điều kiện.
- Phải ghi risk code và clear condition.

### 22.7. EXCLUDE
- Vi phạm nghiêm trọng hoặc không phù hợp universe.
- Không dùng điểm số để làm nhẹ trạng thái.

---

## 23. Quy tắc xếp hạng khoa học

Thứ tự xếp:
1. Loại `EXCLUDE`.
2. Tách `BLOCKED`.
3. Tách `WATCH_ONLY/WAIT_RETEST/QUALITY_HIGH_WAIT_ENTRY`.
4. Trong nhóm đủ điều kiện, xếp theo:
   - Hard Rule pass.
   - Confidence.
   - Opportunity Score.
   - Quality Score.
   - Entry Score.
   - Liquidity thực.
   - X2 feasibility.
5. Khi Opportunity chênh <2 điểm:
   - Ưu tiên Quality cao hơn cho vị thế chính.
   - Ưu tiên Entry cao hơn cho trade ngắn nhưng giảm NAV nếu Quality thấp.
   - Ưu tiên liquidity tốt hơn nếu vốn giải ngân lớn.
   - Ưu tiên unlock thấp và value capture rõ.
6. Không xếp coin chỉ vì một ngày volume/pump mạnh.

### 23.1. Tie-breaker
Khi hai coin gần bằng:
1. Product & Real Adoption.
2. Tokenomics/value capture.
3. Structural Liquidity.
4. X2 feasibility.
5. Overhead Supply.
6. Entry freshness.
7. Market Cap nhỏ hơn chỉ là tie-breaker cuối, không phải ưu tiên đầu.

---


### 23.2. Integrity tie-breaker
Khi điểm gần nhau, ưu tiên theo thứ tự:
1. Score Status FINAL hơn PROVISIONAL.
2. Evidence E3/E4 nhiều hơn.
3. Token Value Capture rõ hơn.
4. Structural Liquidity tốt hơn.
5. Unlock thấp hơn.
6. Overhead Supply thấp hơn.
7. RR và Asymmetry tốt hơn.
8. Market Cap nhỏ hơn chỉ là tie-breaker cuối, không phải tiêu chí đầu.

## 24. Confidence Engine

### 24.1. Confidence cấp thành phần
- HIGH: dữ liệu E3–E4, fresh, đồng nhất.
- MEDIUM: E2–E3, còn thiếu một phần.
- LOW: E0–E1, stale hoặc conflict.

### 24.2. Confidence tổng
- HIGH:
  - Không có nhóm quan trọng LOW.
  - Price/orderbook/unlock/product data đủ.
- MEDIUM:
  - Thiếu một nhóm không phải Hard Rule.
  - Có nguồn phụ nhưng không conflict nghiêm trọng.
- LOW:
  - Thiếu từ 2 nhóm quan trọng.
  - Unlock/orderbook/mapping conflict.
  - Product metrics không kiểm chứng.

Confidence LOW: không BUY_SETUP.

### 24.3. Không nhân score với Confidence
Confidence là cổng hành động, không phải multiplier.
Không dùng:
- `Score × 0.8`.
- `Quality + bonus confidence`.
- Phạt trùng dữ liệu thiếu.

---

## 25. Quy tắc tránh double-count và thiên lệch

### 25.1. Không cộng bonus tùy ý
Không cộng ngoài 100 điểm cho:
- Hết unlock.
- Buyback.
- Burn.
- Revenue growth.
- Narrative hot.
- Listing lớn.

Các yếu tố này đã nằm trong rubric tương ứng.

### 25.2. Không phạt trùng
Ví dụ unlock cao:
- Chấm thấp Tokenomics.
- Áp Hard Rule/hard cap nếu vượt ngưỡng.
- Không trừ thêm -10 vào tổng.

### 25.3. Không dùng thương hiệu thay bằng chứng
Coin nổi tiếng không tự động:
- Quality cao.
- Moat cao.
- Security cao.
- X2 feasibility cao.

### 25.4. Không ưu tiên cap nhỏ quá mức
- Cap nhỏ không chứng minh room thật.
- Phải xem liquidity, product, supply và overhead.
- Coin cap 300M chất lượng cao có thể xếp trên coin 80M chất lượng yếu.

### 25.5. Không thiên kiến “đã giảm sâu”
Giảm 80–90% có thể phản ánh:
- Product thất bại.
- Tokenomics xấu.
- Narrative chết.
- Holder dump.
Không tự cho điểm Valuation/Entry cao.

### 25.6. Không thiên kiến chart
Chart đẹp không bù:
- Unlock conflict.
- Fake volume.
- Product không có.
- Value capture bằng 0.
- Security incident.

---

## 26. Metric theo ngành

### 26.1. DEX/AMM/Aggregator
Ưu tiên:
- Organic spot volume.
- Fees/revenue.
- Liquidity depth.
- Repeat traders.
- Market share.
- LP sustainability.
- Token fee capture.

Không chấm TVL cao nếu volume thấp và vốn chỉ đến từ incentives.

### 26.2. Lending/Money Market
Ưu tiên:
- Active borrows.
- Utilization.
- Net deposits.
- Revenue.
- Bad debt.
- Liquidation performance.
- Collateral diversity.
- Token value capture.

### 26.3. L1/L2
Ưu tiên:
- Fees.
- Active applications.
- Stablecoin supply.
- Developer/activity quality.
- Economic throughput.
- Decentralization/security.
- Token demand từ gas/security.

Không chấm TPS lý thuyết cao nếu usage thấp.

### 26.4. Derivatives
Ưu tiên:
- Organic volume.
- Fees.
- Open interest quality.
- Repeat traders.
- Market share.
- Insurance/risk system.
- Token value capture.

Cần loại wash volume và incentive farming.

### 26.5. Oracle/Infrastructure/Interoperability
Ưu tiên:
- Secured value.
- Paying customers.
- Integrations đang dùng.
- Dependency/switching cost.
- Reliability.
- Revenue/value capture.
- Security history.

### 26.6. DePIN/Compute
Ưu tiên:
- Paying demand.
- Utilization.
- Unit economics.
- Supply quality.
- Customer concentration.
- Revenue.
- Token emission so với demand.

### 26.7. AI/Data
Ưu tiên:
- Sản phẩm chạy thật.
- Paid requests/customers.
- Compute/data demand.
- Revenue.
- Retention.
- Token necessity.
- Khả năng chống bị thay thế.

Không chấm cao chỉ vì gắn nhãn AI.

### 26.8. Gaming/Consumer/Social
Ưu tiên:
- DAU/MAU.
- Retention.
- Paying users.
- Revenue.
- Content creator economy.
- Session/activity quality.
- Token sink/source balance.

### 26.9. Meme
Quality bị giới hạn do thiếu product/value capture:
- Có thể có Community/Liquidity/Entry cao.
- Không xem narrative/community là Product.
- Chỉ SPECULATIVE, tỷ trọng giới hạn.
- Monitoring Tag hoặc holder concentration phải kiểm tra riêng.

---

## 27. Chuẩn cập nhật điểm

### 27.1. Quality Score
Chỉ cập nhật mạnh khi có thay đổi:
- Product launch/failure.
- Usage/revenue trend mới.
- Tokenomics/unlock change.
- Security incident.
- Governance/treasury change.
- Moat/market share thay đổi.
- Catalyst trở thành hiện thực hoặc bị hủy.

Không thay Quality 5–10 điểm chỉ vì giá biến động một ngày.

### 27.2. Entry Score
Cập nhật khi:
- Nến 4H mới đóng.
- Giá thay đổi 3–5%.
- Giá di chuyển >0.5 ATR.
- Market Regime thay đổi.
- Volume/orderbook đổi đáng kể.
- Trigger xuất hiện hoặc thất bại.
- Giá chuyển thành CHASE.

### 27.3. Opportunity Score
Tính lại sau khi Quality hoặc Entry thay đổi.
Không giữ Opportunity cũ khi Entry đã stale.

### 27.4. Change Log
Mỗi thay đổi đáng kể phải ghi:
- Điểm cũ.
- Điểm mới.
- Delta.
- Lý do.
- Dữ liệu mới.
- Timestamp.

Ví dụ:
```text
RUNE
- Quality: 78 → 80 (+2)
- Entry: 72 → 65 (-7)
- Lý do: product metrics cải thiện; giá vượt entry zone và 4H mất RR
- Action: BUY_SETUP → WAIT_RETEST
- Updated at: ...
```

---

## 28. Mẫu Scorecard chuẩn

```text
QUALITY SCORE
1. Product & Real Adoption: XX/24
   - PMF: X/10 × 5
   - Usage: X/10 × 5
   - Economic activity: X/10 × 6
   - Growth/retention: X/10 × 4
   - Integrations: X/10 × 4

2. Tokenomics, Supply & Unlock: XX/22
   - Circulating/emission: X/10 × 5
   - Unlock: X/10 × 6
   - FDV/MC: X/10 × 4
   - Value capture: X/10 × 4
   - Treasury/holder: X/10 × 3

3. Structural Liquidity: XX/14
4. Valuation & X2/X3: XX/16
5. Moat: XX/10
6. Team/Governance/Security: XX/8
7. Narrative/Catalyst: XX/6

Raw Quality: XX.X
Hard cap applied: YES/NO
Final Quality: XX/100
Investment Grade: ...
Quality Confidence: HIGH/MEDIUM/LOW
```

```text
ENTRY SCORE
1. Market Regime: XX/12
2. D1/4H Structure: XX/26
3. RR & Asymmetry: XX/22
4. Relative Strength: XX/14
5. Relative Volume: XX/12
6. Overhead Supply: XX/8
7. Trigger/Freshness/Execution: XX/6

Raw Entry: XX.X
Hard cap applied: YES/NO
Final Entry: XX/100
Entry Grade: ...
Setup Type: ...
Entry Confidence: HIGH/MEDIUM/LOW
```

```text
FINAL
Opportunity Score: XX.X/100
Blacklist Status: ...
Risk Codes: ...
Execution Action: ...
Execution Block Reason: ...
Suggested NAV: ...
Trigger to activate:
Invalidation:
```

---


## 28A. Scorecard Integrity fields
Mỗi scorecard phải có thêm:
- `scan_mode`.
- `quality_status`.
- `entry_status`.
- `opportunity_status`.
- `missing_critical_groups`.
- `evidence_level_by_group`.
- `protocol_quality_summary`.
- `token_value_capture_summary`.
- `data_coverage_matrix`.
- `score_caps_applied`.
- `freshness_timestamp`.

Thiếu các trường này: scorecard chỉ mang tính nghiên cứu sơ bộ.

## 29. Ví dụ hiệu chỉnh giả định

### 29.1. Coin A — dự án mạnh, điểm mua yếu
- Product: mạnh.
- Tokenomics: tốt.
- Liquidity: tốt.
- Quality: 84/100 — AA.
- D1 chưa tạo đáy, không trigger.
- Entry: 59/100 — C.
- Opportunity: khoảng 72.
- Action: `QUALITY_HIGH_WAIT_ENTRY`.

Kết luận đúng:
> Dự án đáng theo dõi/nắm giữ có chọn lọc, nhưng chưa phải thời điểm mua mới.

Kết luận sai:
> Quality cao nên mua ngay.

### 29.2. Coin B — chart đẹp, chất lượng trung bình
- Quality: 62/100 — BB.
- Entry: 84/100 — A.
- Opportunity: khoảng 71.
- Action: `SPECULATIVE_BUY` hoặc `WAIT_RETEST`.
- NAV nhỏ.

Kết luận đúng:
> Setup tốt nhưng không phải vị thế lõi vì chất lượng dự án trung bình.

### 29.3. Coin C — thanh khoản yếu
- Product tốt.
- Quality thô 76.
- Volume <10M, orderbook mỏng.
- Liquidity group bị cap.
- Không BUY_SETUP dù chart đẹp.
- Action: WATCH_ONLY hoặc EXCLUDE tùy severity.

### 29.4. Coin D — gần hết unlock nhưng không có value capture
- Unlock 9/10.
- FDV/MC tốt.
- Value capture 2/10.
- Tokenomics không được chấm tối đa.
- Không cộng bonus “hết unlock”.
- Chất lượng phụ thuộc product, demand và liquidity.

---

## 30. Checklist kiểm tra trước khi công bố điểm

### Quality
- [ ] Đã map đúng token/project/contract.
- [ ] Có dữ liệu product/usage thực.
- [ ] Metric phù hợp ngành.
- [ ] Đã phân biệt usage hữu cơ và incentive.
- [ ] Đã kiểm tra circulating, inflation, emission.
- [ ] Đã xác minh unlock 7D/30D/90D.
- [ ] Đã đánh giá value capture.
- [ ] Đã kiểm tra volume thật, Binance ratio, spread, depth.
- [ ] Đã so định giá với peer và usage.
- [ ] Đã đánh giá moat, team, governance, security.
- [ ] Catalyst là chính thức, chưa hết hiệu lực.
- [ ] Đã áp hard cap.

### Entry
- [ ] Giá và kline fresh.
- [ ] BTC/ETH/BTC.D/ETH-BTC/TOTAL3/breadth đã kiểm tra.
- [ ] D1 và 4H không mâu thuẫn nghiêm trọng.
- [ ] Setup type được gắn đúng.
- [ ] Không CHASE.
- [ ] Có entry, stop, TP và invalidation.
- [ ] RR1/RR2 tính từ giá hiện tại.
- [ ] Asymmetry đã xét overhead supply.
- [ ] RS so với BTC/ETH/ngành.
- [ ] Relative volume xác nhận.
- [ ] Orderbook live.
- [ ] Đã áp hard cap.

### Final
- [ ] Blacklist Status.
- [ ] Severity và Risk Codes.
- [ ] Data Quality và Confidence.
- [ ] Opportunity Score tính đúng.
- [ ] Execution Action không mâu thuẫn Grade.
- [ ] Không lấp Top 3 bằng coin thiếu điều kiện.
- [ ] Có timestamp và nguồn.

---


## 30A. Validation Gate trước khi công bố
- [ ] Metric đúng ngành.
- [ ] Protocol và token tách riêng.
- [ ] Mọi subscore có evidence.
- [ ] UNKNOWN không nhận điểm mặc định.
- [ ] Score Status đúng.
- [ ] Hard cap đã áp dụng.
- [ ] Opportunity Status kế thừa trạng thái thấp hơn.
- [ ] Top 3 chỉ dùng FINAL.
- [ ] Không double-count.
- [ ] Sources/freshness đủ.

## 31. Các lỗi AI bị cấm
- Chấm điểm từ trí nhớ khi dữ liệu hiện hành có thể thay đổi.
- Gán volume, MC, unlock hoặc giá mà không có timestamp.
- Chấm Product cao chỉ vì whitepaper/công nghệ.
- Chấm Tokenomics cao chỉ vì gần hết unlock.
- Chấm Liquidity cao chỉ vì total volume.
- Chấm Valuation cao chỉ vì cap nhỏ.
- Chấm Moat cao chỉ vì dự án nổi tiếng.
- Chấm Narrative bằng tin đồn.
- Gọi Investment Grade là tín hiệu mua.
- Gọi Entry Grade cao là đủ mua khi Hard Rule fail.
- Cộng bonus/penalty ngoài mô hình làm tổng vượt 100.
- Dùng cùng một rủi ro để phạt nhiều lần.
- Thay đổi điểm mà không ghi lý do.
- Gọi BUY NOW khi giá đã CHASE.
- Tạo Top 3 khi không đủ coin đạt chuẩn.

---

## 32. Câu lệnh sử dụng file này

Các câu lệnh gợi ý:
- `Chấm Quality Score và Entry Score theo V8.1, trình bày từng subscore và bằng chứng.`
- `So sánh RUNE và SONIC theo Scoring Guide V8.1; ưu tiên ứng dụng thật, tokenomics và thanh khoản.`
- `Giải thích vì sao điểm hôm nay thay đổi so với lần quét trước.`
- `Không cho điểm 8 trở lên nếu thiếu bằng chứng E3.`
- `Áp hard cap sau khi tính điểm thô và ghi rõ cap nào được kích hoạt.`
- `Chỉ đưa BUY_SETUP khi orderbook, unlock, 4H trigger và RR đều đủ.`
- `Dùng tie-breaker V8.1 nếu Opportunity Score chênh dưới 2 điểm.`

---

## 33. Bảo trì Scoring Guide
- Thay đổi trọng số: phải sửa đồng thời `00_CONTEXT_V8_1.md`, `01_CHECKLIST_V8_1.md`, `03_OUTPUT_V8_1.md` và file này.
- Thay đổi Hard Rule: sửa Context/Checklist/Blacklist trước.
- Thay đổi chỉ cách diễn giải điểm: sửa file này.
- Không sửa một ngưỡng riêng lẻ mà không kiểm tra ảnh hưởng tới:
  - Hard cap.
  - Top 3 eligibility.
  - Capital Allocation.
  - Output.
- Mỗi phiên bản mới phải ghi:
  - Ngày cập nhật.
  - Lý do.
  - Mục thay đổi.
  - Tương thích với phiên bản nào.

---

## 34. Kết luận vận hành
1. **Quality Score** đánh giá dự án/token, không đánh giá điểm mua.
2. **Entry Score** đánh giá điểm mua hiện tại, phải refresh thường xuyên.
3. **Opportunity Score** chỉ cao bền vững khi cả Quality và Entry cùng cao.
4. Product, tokenomics và structural liquidity được ưu tiên hơn cap nhỏ và narrative.
5. Hết unlock là lợi thế về pha loãng nhưng không thay thế value capture, holder risk hoặc demand.
6. Hard Rule, Data Quality và Confidence luôn thắng điểm số.
7. Không ép phải có coin mua; khi không đủ setup, giữ USDT là quyết định hợp lệ.

---

## 35. Phiên bản
**COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY**

Scoring Guide chính thức. Giữ nguyên trọng số V8.0 và bổ sung Evidence Cap, Score Status, Exact-vs-Range, Protocol–Token Separation và Integrity Validation.
