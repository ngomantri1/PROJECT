# COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY — OUTPUT FORMAT

## 0. Thông tin phiên bản
- Phiên bản: **V8.1 Professional — Execution Integrity**.
- Phạm vi: chuẩn hóa cách ChatGPT trình bày kết quả quét altcoin **Spot**.
- File này phải được dùng cùng:
  - `00_CONTEXT_V8_1.md`.
  - `01_CHECKLIST_V8_1.md`.
  - `02_BLACKLIST_V8_1.md`.
  - `04_PROJECT_SCORING_GUIDE_V8_1.md`.
- Mục tiêu của output:
  1. Phân biệt rõ **dự án tốt** với **điểm mua tốt**.
  2. Không che giấu dữ liệu thiếu, xung đột hoặc Hard Rule.
  3. Cho phép so sánh coin nhất quán giữa các lần quét.
  4. Đưa ra hành động thực thi rõ ràng, không dùng điểm số để hợp thức hóa coin rủi ro.

---

## 1. Nguyên tắc trình bày bắt buộc

### 1.1. Tách ba loại điểm
Mỗi coin phải hiển thị riêng:
- **Quality Score /100**: chất lượng dự án/token.
- **Entry Score /100**: chất lượng điểm mua hiện tại.
- **Opportunity Score /100**: cơ hội tổng hợp.

Công thức mặc định:

`Opportunity Score = Quality Score^0.55 × Entry Score^0.45`

Không được:
- Chỉ đưa một điểm tổng chung rồi bỏ qua Quality/Entry.
- Gọi coin “tốt nhất” mà không nói đang xét **chất lượng dự án**, **điểm mua** hay **cơ hội tổng hợp**.
- Dùng Quality cao để che Entry thấp.
- Dùng Entry cao để che Quality thấp.

### 1.2. Tách Grade và Action
Phải phân biệt:
- **Investment Grade**: AAA/AA/A/BBB/BB/B/CCC, chỉ dựa trên Quality Score.
- **Entry Grade**: S/A/B/C/D/F, chỉ dựa trên Entry Score.
- **Setup Type**: EARLY_ACCUMULATION, RECLAIM_ENTRY, BREAKOUT_RETEST, BUY_NOW, CHASE.
- **Execution Action**: BUY_SETUP, SPECULATIVE_BUY, WAIT_RETEST, QUALITY_HIGH_WAIT_ENTRY, WATCH_ONLY, BLOCKED, EXCLUDE.

Ví dụ đúng:
- Quality 84 — Grade AA.
- Entry 61 — Grade C.
- Setup: EARLY_ACCUMULATION.
- Action: QUALITY_HIGH_WAIT_ENTRY.

Không được viết “Grade A nên mua” vì Investment Grade không phải tín hiệu mua.

### 1.3. Hard Rule thắng điểm số
Một coin có Quality/Entry cao vẫn phải hiển thị `BLOCKED` hoặc `EXCLUDE` nếu vi phạm Hard Rule.

Bắt buộc hiển thị:
- `execution_action`.
- `execution_block_reason` nếu không thể mua.
- Blacklist Status.
- Severity.
- Risk Codes.
- Điều kiện gỡ chặn.

### 1.4. Không tạo bảng siêu rộng khó đọc
FULL_SCAN phải dùng hai lớp:
1. **Bảng xếp hạng rút gọn** để nhìn nhanh.
2. **Phiếu chi tiết từng coin** cho dữ liệu đầy đủ.

Không ép toàn bộ 40–60 trường vào một bảng ngang duy nhất.

### 1.5. Tính trung thực dữ liệu
- Không bịa giá, vùng mua, stop, RR, unlock, orderbook, product metrics hoặc X2/X3 feasibility.
- Dữ liệu không có phải ghi `UNKNOWN`.
- Dữ liệu mâu thuẫn phải ghi `CONFLICT`.
- Không xem thiếu dữ liệu là PASS.
- Mọi giá, volume, orderbook, kline và điểm Entry phải có thời điểm.
- Khi dữ liệu chỉ đủ định tính, dùng Low/Medium/High hoặc khoảng giá; không tạo số chính xác giả tạo.

---


### 1.6. Scan Mode Integrity
Tiêu đề báo cáo chỉ được dùng một trong:
- `RESEARCH_RECAP`.
- `WATCHLIST_SCAN`.
- `SINGLE_COIN_REVIEW`.
- `COMPARISON_SCAN`.
- `FULL_SCAN_RESEARCH`.
- `FULL_SCAN_EXECUTION`.
- `ENTRY_REFRESH`.

Không được ghi `FULL_SCAN` chung chung nếu không nói rõ Research hay Execution.

### 1.7. Score Status bắt buộc
Mỗi điểm phải hiển thị ngay cạnh:
- `FINAL`.
- `PROVISIONAL`.
- `RANGE`.
- `NOT_SCORED`.

Ví dụ đúng:
- `Quality: 78/100 — PROVISIONAL (Unlock và holder data chưa đủ)`.
- `Quality Range: 72–79 — MEDIUM`.
- `Entry: NOT_SCORED — thiếu orderbook và RR`.

Không để người đọc phải tìm chú thích cuối báo cáo mới biết điểm chưa hoàn tất.

## 2. Cấu trúc báo cáo chuẩn
Một báo cáo FULL_SCAN mặc định phải theo thứ tự:

1. **Scan Metadata**.
2. **Executive Decision**.
3. **Market Summary**.
4. **Data Coverage & Confidence**.
5. **Bảng xếp hạng 10–15 coin**.
6. **Top 3–5 đủ điều kiện**.
7. **Quality High — Wait Entry**.
8. **Speculative / Micro-cap**.
9. **Blocked / Excluded / Risk Register**.
10. **Phiếu chi tiết từng coin**.
11. **Capital Plan**.
12. **Triggers cần theo dõi**.
13. **Kết luận 7 dòng bắt buộc**.
14. **Sources & Freshness**.

Nếu người dùng yêu cầu bản ngắn, vẫn phải giữ tối thiểu:
- Market Regime.
- Data Quality.
- Quality/Entry/Opportunity của từng coin được nhắc đến.
- Action và lý do.
- Blocked/Excluded.
- % USDT.
- Trigger tiếp theo.

---

## 3. Scan Metadata
Bắt đầu báo cáo bằng khối sau:

```text
SCAN METADATA
- Scan mode: FULL_SCAN / WATCHLIST_SCAN / SINGLE_COIN_REVIEW / COMPARISON_SCAN / ENTRY_REFRESH
- Checklist version: V8.1
- Scan time: YYYY-MM-DD HH:mm TZ
- Price snapshot time: YYYY-MM-DD HH:mm TZ
- Universe: Top 500 / Watchlist / Named coins
- Exchange requirement: Binance Spot/USDT
- Holding horizon: vài tuần đến 12 tháng
- Primary objective: +50–100%, runner x2–x3 khi đủ điều kiện
- Market Data Quality: GOOD / MIXED / POOR
- Overall Confidence: HIGH / MEDIUM / LOW
```

Nếu dữ liệu được lấy ở nhiều thời điểm khác nhau, phải ghi rõ từng nhóm:
- Price/kline timestamp.
- Orderbook timestamp.
- Unlock verified at.
- Product metrics period.
- Blacklist verified at.

---


## 3A. Universe Accounting
Bắt buộc trong `FULL_SCAN_RESEARCH` và `FULL_SCAN_EXECUTION`:

| Hạng mục | Số lượng | Ghi chú/nguồn |
|---|---:|---|
| Universe ban đầu |  |  |
| Có Binance Spot/USDT |  |  |
| Loại theo token type |  |  |
| Loại theo MC |  |  |
| BLOCKED listing/security |  |  |
| Fail liquidity pre-filter |  |  |
| Fail supply/unlock pre-filter |  |  |
| Research Shortlist |  |  |
| Execution Verification |  |  |
| BUY_SETUP |  |  |

Thiếu bảng này: không được dùng nhãn FULL_SCAN.

## 4. Executive Decision
Ngay sau metadata phải có khối quyết định nhanh:

```text
EXECUTIVE DECISION
- Market Regime: THUẬN LỢI / TRUNG TÍNH / XẤU
- Có nên mở vị thế mới hôm nay: CÓ CHỌN LỌC / CHỈ THĂM DÒ / KHÔNG
- Số BUY_SETUP hợp lệ: X
- Số QUALITY_HIGH_WAIT_ENTRY: X
- Số SPECULATIVE_BUY: X
- Số BLOCKED/EXCLUDE: X
- USDT đề xuất: XX–YY% NAV
- Top opportunity: TICKER — Opportunity XX/100 — Action
- Rủi ro lớn nhất: ...
- Trigger tiếp theo: ...
```

Quy tắc:
- Không ghi “nên mua” nếu không có coin đạt đủ Hard Rule.
- Nếu dưới 2 setup hợp lệ, phải ghi nổi bật:

**CHƯA NÊN MUA SPOT — TIẾP TỤC GIỮ USDT.**

---

## 5. Market Summary

### 5.1. Bảng Market Summary

| Hạng mục | Trạng thái | Dữ liệu/nhận xét | Thời điểm | Confidence |
|---|---|---|---|---|
| BTC D1 | Bullish/Neutral/Bearish | Cấu trúc, MA, hỗ trợ/kháng cự | ... | ... |
| BTC 4H | Bullish/Neutral/Bearish | Breakdown/reclaim/sideway | ... | ... |
| ETH D1/4H | ... | ... | ... | ... |
| BTC.D | Tăng/Đi ngang/Giảm | Tác động altcoin | ... | ... |
| ETH/BTC | Tăng/Đi ngang/Giảm | Dòng tiền sang ETH/alt | ... | ... |
| TOTAL3/proxy | Giữ hỗ trợ/Breakout/Breakdown | ... | ... | ... |
| Breadth | Mở rộng/Trung tính/Thu hẹp | % coin trên MA20 D1 | ... | ... |
| Alt volume | Tăng/Bình thường/Giảm | so với avg 7D | ... | ... |
| Macro/legal | Bình thường/Rủi ro | sự kiện cần chú ý | ... | ... |

### 5.2. Kết luận Market Regime
Phải nêu:
- Regime: THUẬN LỢI / TRUNG TÍNH / XẤU.
- Lý do chính.
- Hard Rule thị trường đang kích hoạt hay không.
- Hành động chung.
- Khoảng USDT đề xuất.

---

## 6. Data Coverage & Confidence

### 6.1. Bảng độ phủ dữ liệu

| Nhóm dữ liệu | Status | Freshness | Nguồn | Ghi chú |
|---|---|---|---|---|
| Price + D1/4H kline | PASS/UNKNOWN/CONFLICT | ... | ... | ... |
| Binance Spot volume | ... | ... | ... | ... |
| Orderbook live | ... | ... | ... | spread/depth/slippage |
| MC/FDV/circulating | ... | ... | ... | ... |
| Unlock 7D/30D/90D | ... | ... | ... | confidence/allocation |
| Product metrics | ... | ... | ... | metric phù hợp ngành |
| Holder/Treasury/MM | ... | ... | ... | ... |
| Blacklist/listing/security | ... | ... | ... | ... |

### 6.2. Quy tắc kết luận
- **GOOD**: đủ, fresh, đồng nhất.
- **MIXED**: thiếu một nhóm hoặc dùng nguồn phụ.
- **POOR**: thiếu/mâu thuẫn nhiều nhóm quan trọng.
- Thiếu từ 2 nhóm quan trọng trở lên: chỉ WATCHLIST.
- Confidence LOW: không BUY_SETUP.

---


### 6.3. Data Coverage Matrix theo coin
Với Top 5 và mọi coin có action mạnh:

| Data group | Coin A | Coin B | Coin C |
|---|---|---|---|
| Price/Kline | PASS |  |  |
| Binance Listing | PASS |  |  |
| Binance Volume | PASS |  |  |
| Orderbook Live | UNKNOWN |  |  |
| Unlock 7D/30D/90D | UNKNOWN |  |  |
| Product Metrics | PASS |  |  |
| Token Value Capture | MIXED/UNKNOWN |  |  |
| Holder/Treasury | UNKNOWN |  |  |
| Security/Blacklist | PASS |  |  |
| Valuation/Peers | PASS |  |  |

Chỉ dùng `PASS`, `UNKNOWN`, `CONFLICT`, `STALE`, `NOT_APPLICABLE`.

## 7. Bảng xếp hạng 10–15 coin
Đây là bảng tóm tắt để nhìn nhanh, không thay cho phiếu chi tiết.

| Rank | Coin | MC | 24H Vol | Q / Grade | E / Grade | Opp | Setup | Action | X2 | Key strength | Main risk | Confidence |
|---:|---|---:|---:|---|---|---:|---|---|---|---|---|---|
| 1 | ABC | $... | $... | 82 / AA | 78 / A | 80 | RECLAIM_ENTRY | BUY_SETUP | High | Product + liquidity | Unlock 90D | HIGH |
| 2 | XYZ | $... | $... | 77 / A | 72 / B | 75 | EARLY_ACCUMULATION | WAIT_RETEST | Medium | Tokenomics | Chưa trigger | MEDIUM |

Bắt buộc có:
- Quality Score và Investment Grade.
- Entry Score và Entry Grade.
- Opportunity Score.
- Setup Type.
- Execution Action.
- X2 feasibility.
- Điểm mạnh chính.
- Rủi ro chính.
- Confidence.

Không xếp hạng coin BLOCKED/EXCLUDE phía trên coin hợp lệ chỉ vì điểm số thô cao. Có thể giữ nguyên score để tham khảo nhưng thứ hạng execution phải ưu tiên trạng thái hợp lệ.

---

## 8. Top 3–5 đủ điều kiện
Chỉ đưa coin vào mục này nếu đạt toàn bộ điều kiện Top 3 trong checklist.

### Mẫu cho từng coin

```text
#1 TICKER — NAME
- Investment thesis: ...
- Sector/use case: ...
- Market Cap / FDV / FDV-MC: ...
- Circulating: ...
- Quality Score: XX/100 — Grade ...
- Entry Score: XX/100 — Grade ...
- Opportunity Score: XX/100
- Product & Real Adoption: ...
- Tokenomics/value capture: ...
- Structural Liquidity: ...
- Moat: ...
- X2 feasibility: Low/Medium/High
- X3 feasibility: Low/Medium/High
- Setup Type: ...
- Current price + time: ...
- Entry zone: ...
- Stop/invalidation: ...
- TP1 / TP2 / runner: ...
- RR1 / RR2: ...
- Asymmetry Score: X/10
- Relative Strength: X/10
- Relative Volume: Weak/Neutral/Strong
- Overhead Supply: Low/Medium
- Unlock 7D/30D/90D: ...
- Blacklist Status: CLEARED/REVIEW/WATCH_RISK
- Execution Action: BUY_SETUP / SPECULATIVE_BUY / WAIT_RETEST
- Suggested NAV: ...
- Initial order: 20–30% planned position
- Trigger to activate: ...
- Invalidation condition: ...
- Main risks: ...
- Data Quality / Confidence: ...
```

### 8.1. Lý do chọn phải có bằng chứng
Không được dùng các lý do chung chung như:
- “Dự án tốt”.
- “Cap nhỏ dễ x2”.
- “RSI thấp”.
- “Narrative đang hot”.

Phải nêu bằng chứng cụ thể:
- Usage/fees/revenue/TVL/integrations.
- Circulating/unlock/value capture.
- Binance volume/orderbook.
- Cấu trúc D1/4H.
- RR/Asymmetry.
- Overhead Supply.

### 8.2. Không lấp đủ Top 3
Nếu chỉ có 1–2 coin đạt, chỉ đưa 1–2 coin.
Không dùng coin cap lớn hoặc coin thiếu dữ liệu để lấp danh sách.

---


### 8.3. Bảng subscore bắt buộc cho Top 5
#### Quality Score
| Nhóm | Trọng số | Subscore | Điểm quy đổi | Evidence | Source/Freshness | Confidence |
|---|---:|---:|---:|---|---|---|
| Product & Adoption | 24 |  |  | E0–E4 |  |  |
| Tokenomics & Value Capture | 22 |  |  | E0–E4 |  |  |
| Structural Liquidity | 14 |  |  | E0–E4 |  |  |
| Valuation & X2/X3 | 16 |  |  | E0–E4 |  |  |
| Moat | 10 |  |  | E0–E4 |  |  |
| Team/Governance/Security | 8 |  |  | E0–E4 |  |  |
| Narrative/Catalyst | 6 |  |  | E0–E4 |  |  |
| **Tổng** | **100** |  |  |  |  |  |

#### Entry Score
| Nhóm | Trọng số | Subscore | Điểm quy đổi | Evidence | Source/Freshness | Confidence |
|---|---:|---:|---:|---|---|---|
| Market Regime | 12 |  |  | E0–E4 |  |  |
| D1/4H Structure | 26 |  |  | E0–E4 |  |  |
| RR & Asymmetry | 22 |  |  | E0–E4 |  |  |
| Relative Strength | 14 |  |  | E0–E4 |  |  |
| Relative Volume | 12 |  |  | E0–E4 |  |  |
| Overhead Supply | 8 |  |  | E0–E4 |  |  |
| Trigger/Execution | 6 |  |  | E0–E4 |  |  |
| **Tổng** | **100** |  |  |  |  |  |

Không có hai bảng này: điểm chỉ được ghi PROVISIONAL/RANGE, không gọi FINAL.

## 9. QUALITY_HIGH_WAIT_ENTRY
Mục này dành cho dự án tốt nhưng chưa có điểm mua.

| Coin | Quality / Grade | Entry | Lý do Quality cao | Vì sao chưa mua | Vùng/trigger cần chờ | Refresh condition |
|---|---|---:|---|---|---|---|
| ABC | 85 / AA | 58 | Usage + tokenomics | D1 downtrend/chưa reclaim | ... | nến 4H đóng trên... |

Bắt buộc phân biệt:
- Coin tốt nhưng chart xấu.
- Coin tốt nhưng đang CHASE.
- Coin tốt nhưng market xấu.
- Coin tốt nhưng orderbook/unlock chưa xác minh.

Nếu bị Hard Rule chặn, dùng `BLOCKED`, không dùng QUALITY_HIGH_WAIT_ENTRY để làm nhẹ rủi ro.

---

## 10. SPECULATIVE / MICRO-CAP

| Coin | MC | Quality | Entry | Opportunity | Liquidity | Action | Max NAV | Lý do speculative | Rủi ro chính |
|---|---:|---:|---:|---:|---|---|---:|---|---|
| ABC | $... | 62 | 80 | ... | ... | SPECULATIVE_BUY | <=1% | setup mạnh/catalyst | cap nhỏ/depth |

Quy tắc:
- MC 50–100M: tối đa 1% NAV.
- Quality trung bình không được nâng thành vị thế chính chỉ vì Entry đẹp.
- Phải ghi rõ thanh khoản, spread, depth và slippage.
- Không dùng từ “an toàn”.

---

## 11. BLOCKED / EXCLUDED / RISK REGISTER
Mọi coin bị chặn phải được hiển thị, không được bỏ khỏi báo cáo mà không giải thích.

| Ticker | Status | Severity | Risk Codes | Lý do | Verified at | Confidence | Execution | Clear condition |
|---|---|---:|---|---|---|---|---|---|
| ABC | BLOCKED | S3 | TOK-01 | Unlock 7D >1% circulating | ... | HIGH | Không mua | Qua unlock + hấp thụ 2–4 nến 4H |
| XYZ | EXCLUDE | S4 | LST-03 | Delist đã xác nhận | ... | HIGH | Loại | Chỉ review khi listing thay đổi chính thức |
| DEF | REVIEW | S1 | DAT-06 | Dữ liệu stale | ... | LOW | Chưa kết luận | Xác minh lại nguồn live |

Bắt buộc có:
- Blacklist Status.
- Severity S0–S4.
- Risk Codes.
- Lý do cụ thể.
- Thời điểm xác minh.
- Confidence.
- Execution.
- Điều kiện gỡ.

Không được chỉ ghi “rủi ro cao”.

---

## 12. Phiếu chi tiết từng coin
Mỗi coin trong Top 3, QUALITY_HIGH_WAIT_ENTRY hoặc coin người dùng yêu cầu phải có phiếu chi tiết.

### 12.1. Identity & Market Data

```text
- Ticker / Name:
- Chain / Contract / Project slug:
- Binance Spot pair:
- Current price:
- Price timestamp:
- Market Cap:
- FDV:
- FDV/MC:
- Circulating supply %:
- Total/max supply:
- 24H Spot volume:
- Avg volume 7D / 20D:
- Volume/MC:
- Binance Spot volume:
- Binance volume / total volume:
```

### 12.2. Liquidity & Execution

```text
- Spread:
- Depth ±0.5%:
- Depth ±1%:
- Estimated slippage 5M VND:
- Estimated slippage 10M VND:
- Estimated slippage 25M VND:
- Fake Volume Risk: LOW / MEDIUM / HIGH
- Structural Liquidity conclusion:
- Orderbook timestamp:
```

### 12.3. Product & Real Adoption
Chỉ dùng metric phù hợp ngành.

```text
- Sector/use case:
- Core product:
- Product-market fit evidence:
- Active users/usage:
- Fees/revenue/economic activity:
- TVL or sector-equivalent metric:
- Growth/retention:
- Integrations/ecosystem:
- Usage quality: Organic / Incentivized / Mixed / Unknown
- Data period and source:
```

Không áp TVL cho mọi dự án. Không dùng follower/community để thay thế usage thật.

### 12.4. Tokenomics & Value Capture

```text
- Circulating/inflation/emission:
- Unlock 7D:
- Unlock 30D:
- Unlock 90D:
- Next unlock date:
- Unlock type: Cliff / Linear
- Allocation: Team / Private / Seed / Ecosystem / Other
- Unlock value / volume:
- Unlock confidence:
- Staking lock:
- Burn:
- Buyback:
- Protocol revenue accrual to token:
- Governance utility:
- Treasury risk:
- Holder concentration risk:
- Tokenomics conclusion:
```

Coin gần hết unlock phải ghi thêm:
- Có còn emission không.
- Treasury/team còn nắm bao nhiêu.
- Value capture có thực hay không.
- Không được suy luận “hết unlock = không thể làm giá”.


### 12.4A. Protocol Quality và Token Holder Value phải tách riêng
Bắt buộc trình bày hai khối:

**Protocol Quality**
- Product/PMF.
- TVL/usage/users.
- Fees/revenue.
- Growth/retention.

**Token Holder Value**
- Utility/demand.
- Burn/buyback/fee sharing.
- Net emission.
- Staking reward source.
- Treasury/team/VC pressure.
- Kết luận value capture: Strong/Medium/Weak/Unverified.

Không viết “economics mạnh” chỉ từ protocol revenue nếu token value capture chưa được chứng minh.

### 12.5. Valuation & X2/X3

```text
- Current Market Cap:
- Market Cap at x2:
- Market Cap at x3:
- Current FDV:
- FDV at x2:
- FDV at x3:
- Comparable projects:
- Usage/economic comparison:
- Capital-flow requirement:
- Overhead resistance before x2:
- Catalyst required:
- Unlock impact:
- X2 feasibility: LOW / MEDIUM / HIGH
- X3 feasibility: LOW / MEDIUM / HIGH
- Valuation conclusion:
```

### 12.6. Moat, Team & Catalyst

```text
- Moat:
- Switching cost/network effect/liquidity advantage:
- Competitive position:
- Team execution:
- Governance/security:
- Narrative:
- Verified catalyst 30–180D:
- Catalyst already priced in: Yes / Partial / No / Unknown
```

### 12.7. Technical & Entry

```text
- Return 24H / 3D / 7D / 14D / 30D / 60D / 90D:
- Pump amplitude:
- Drawdown:
- Range position:
- Accumulation days:
- D1 trend and structure:
- MA20 / MA50 / MA200:
- D1 support/resistance:
- 4H structure:
- Trigger:
- Setup Type:
- Relative Volume Quality:
- Relative Strength vs BTC / ETH / sector:
- Overhead Supply:
- ATR 4H:
- Distance current price to entry:
- Entry lower / upper:
- Stop / invalidation:
- TP1 / TP2 / TP3:
- RR1 / RR2:
- Asymmetry Score /10:
```

### 12.8. Risk & Blacklist

```text
- Blacklist Status:
- Severity:
- Risk Codes:
- Security risk:
- Holder risk:
- Treasury risk:
- Market Maker risk:
- Data conflict:
- execution_block_reason:
- Clear condition:
- Verified at:
```

### 12.9. Scorecard

#### Quality Score /100

| Quality group | Weight | Score | Evidence | Confidence |
|---|---:|---:|---|---|
| Product & Real Adoption | 24 | ... | ... | ... |
| Tokenomics, Supply & Unlock | 22 | ... | ... | ... |
| Structural Liquidity & Market Access | 14 | ... | ... | ... |
| Valuation & X2/X3 Feasibility | 16 | ... | ... | ... |
| Moat & Competitive Position | 10 | ... | ... | ... |
| Team, Execution, Governance & Security | 8 | ... | ... | ... |
| Narrative & Verified Catalysts | 6 | ... | ... | ... |
| **Quality Score** | **100** | **...** |  |  |

Bắt buộc ghi:
- Quality hard cap đã áp dụng, nếu có.
- Investment Grade.

#### Entry Score /100

| Entry group | Weight | Score | Evidence | Freshness |
|---|---:|---:|---|---|
| Market Regime | 12 | ... | ... | ... |
| D1/4H Structure & Setup | 26 | ... | ... | ... |
| Risk/Reward & Asymmetry | 22 | ... | ... | ... |
| Relative Strength | 14 | ... | ... | ... |
| Relative Volume & Money Flow | 12 | ... | ... | ... |
| Overhead Supply | 8 | ... | ... | ... |
| Trigger, Freshness & Execution Readiness | 6 | ... | ... | ... |
| **Entry Score** | **100** | **...** |  |  |

Bắt buộc ghi:
- Entry hard cap đã áp dụng, nếu có.
- Entry Grade.
- Setup Type.

#### Final Decision

```text
- Quality Score / Investment Grade:
- Entry Score / Entry Grade:
- Opportunity Score:
- Data Quality:
- Confidence:
- Execution Action:
- Block reason:
- Suggested NAV:
- Trigger:
- Invalidation:
```

---

## 13. Phân nhóm bắt buộc
Báo cáo phải phân coin vào đúng nhóm, không để cùng một coin xuất hiện mâu thuẫn ở nhiều nhóm hành động.

### Nhóm hành động
- BUY_SETUP.
- SPECULATIVE_BUY.
- WAIT_RETEST.
- QUALITY_HIGH_WAIT_ENTRY.
- WATCH_ONLY.
- BLOCKED.
- EXCLUDE.

### Nhóm setup
- EARLY_ACCUMULATION.
- RECLAIM_ENTRY.
- BREAKOUT_RETEST.
- BUY_NOW.
- CHASE — cấm mua.

### Nhóm đặc tính/rủi ro
- Quality cao nhưng Entry thấp.
- Entry đẹp nhưng Quality trung bình.
- Small-cap đủ thanh khoản.
- Micro-cap speculative.
- Chưa pump.
- Tái tích lũy.
- Vừa pump/chase.
- Unlock cao/conflict.
- FDV cao/circulating thấp.
- Overhead Supply High.
- Fake Volume Risk High.
- Orderbook mỏng.
- Product/usage yếu.
- Narrative chết.
- Holder/Treasury/MM Risk High.

---


## 14. Capital Plan

### 14.1. Current Deployable Capital
| Hạng mục | Tỷ trọng | Lý do |
|---|---:|---|
| BUY_SETUP hợp lệ |  |  |
| Vốn mới chưa giải ngân |  |  |
| Existing Positions |  |  |
| **Tổng** | **100%** |  |

Nếu BUY_SETUP = 0 và không có Existing Positions được cung cấp:
- Vốn mới chưa giải ngân = 100% USDT.

### 14.2. Target Reserve After Valid Entries
| Market Regime | USDT mục tiêu sau khi mở lệnh hợp lệ |
|---|---:|
| Thuận lợi | 25–40% |
| Trung tính | 60–80% |
| Xấu | 80–100% |

### 14.3. Bảng phân bổ dự kiến khi trigger đạt
| Coin | Action hiện tại | Max NAV khi đủ điều kiện | Lệnh đầu | Điều kiện tăng | Điều kiện hủy |
|---|---|---:|---:|---|---|
|  |  |  |  |  |  |

### 14.4. Quy tắc phải nhắc lại
- Không all-in.
- Không quá 3–4 coin.
- Lệnh đầu 20–30% vị thế dự kiến.
- Không DCA vì giá giảm.
- Tổng high-beta/meme <=35% phần vốn đã giải ngân.
- Bảng phải cộng đủ 100% hoặc ghi rõ dữ liệu vị thế hiện tại chưa được cung cấp.

## 15. Trigger Board
Đưa ra danh sách điều kiện cụ thể để lần quét sau biết cần kiểm tra gì.

| Coin | Current Action | Trigger nâng hạng | Trigger mua | Invalidation | Refresh when |
|---|---|---|---|---|---|
| ABC | WAIT_RETEST | retest giữ + volume xác nhận | đóng 4H trên... | mất... | sau nến 4H |
| XYZ | BLOCKED | qua unlock + hấp thụ | chưa áp dụng | ... | ngày... |

Trigger phải có thể kiểm chứng. Không dùng câu mơ hồ như “khi thị trường đẹp hơn”.

---

## 16. Kết luận 7 dòng bắt buộc
Mọi FULL_SCAN hoặc WATCHLIST_SCAN phải kết thúc bằng đúng bảy ý:

1. **Market Regime:** ...
2. **Data Quality / Confidence:** ...
3. **Có nên mua Spot hôm nay:** ...
4. **Top cơ hội hợp lệ:** ...
5. **QUALITY_HIGH_WAIT_ENTRY đáng chú ý:** ...
6. **BLOCKED/EXCLUDE và % USDT đề xuất:** ...
7. **Trigger cần chờ trước lần giải ngân tiếp theo:** ...

Nếu không có ít nhất 2 setup hợp lệ, dòng 3 phải ghi:

**CHƯA NÊN MUA SPOT — TIẾP TỤC GIỮ USDT.**

---

## 17. Sources & Freshness
Cuối báo cáo phải có danh sách nguồn theo nhóm:

```text
SOURCES & FRESHNESS
- Price/kline:
- Binance Spot pair/volume/orderbook:
- MC/FDV/supply:
- Unlock:
- Product/usage:
- Fees/revenue/TVL or sector metric:
- Holder/treasury:
- Security/listing/announcements:
- Verified catalysts:
- Last verified at:
```

Quy tắc:
- Ưu tiên nguồn chính thức/primary source.
- Dữ liệu market live phải ghi thời điểm.
- Metric product phải ghi kỳ dữ liệu.
- Không trích nguồn không hỗ trợ đúng kết luận.

---

## 18. Mẫu SINGLE_COIN_REVIEW
Khi người dùng yêu cầu đánh giá một coin, output tối thiểu:

```text
SINGLE COIN REVIEW — TICKER
1. Snapshot
2. Product & Real Adoption
3. Tokenomics & Unlock
4. Liquidity & Orderbook
5. Valuation & X2/X3
6. Moat/Team/Catalyst
7. D1/4H & Entry
8. Quality Score breakdown
9. Entry Score breakdown
10. Opportunity Score
11. Blacklist/Risk status
12. Execution Action
13. Vùng mua/stop/TP chỉ khi đủ dữ liệu
14. Kết luận: dự án có đáng giữ không và hiện tại có đáng mua không
```

Câu kết luận bắt buộc phải tách hai ý:
- **Chất lượng dự án:** ...
- **Thời điểm mua hiện tại:** ...

---

## 19. Mẫu COMPARISON_SCAN
Khi so sánh hai hoặc nhiều coin, không chỉ so điểm tổng.

### 19.1. Bảng so sánh

| Tiêu chí | Coin A | Coin B | Coin C | Winner | Lý do |
|---|---|---|---|---|---|
| Product & Adoption | ... | ... | ... | ... | ... |
| Tokenomics/unlock | ... | ... | ... | ... | ... |
| Structural liquidity | ... | ... | ... | ... | ... |
| Valuation/x2 | ... | ... | ... | ... | ... |
| Moat | ... | ... | ... | ... | ... |
| Quality Score/Grade | ... | ... | ... | ... | ... |
| D1/4H setup | ... | ... | ... | ... | ... |
| RR/Asymmetry | ... | ... | ... | ... | ... |
| Entry Score/Grade | ... | ... | ... | ... | ... |
| Opportunity Score | ... | ... | ... | ... | ... |
| Liquidity for user capital | ... | ... | ... | ... | ... |
| Execution Action | ... | ... | ... | ... | ... |

### 19.2. Kết luận so sánh bắt buộc
Phải trả lời riêng:
1. Coin nào có **dự án tốt hơn**.
2. Coin nào có **tokenomics tốt hơn**.
3. Coin nào có **thanh khoản tốt hơn**.
4. Coin nào có **khả năng x2 hợp lý hơn**.
5. Coin nào có **điểm mua tốt hơn hôm nay**.
6. Coin nào phù hợp **vị thế chính**.
7. Coin nào chỉ phù hợp **speculative/watch**.

Không được dùng cap nhỏ làm lý do duy nhất để xếp coin cao hơn.

---

## 20. Mẫu ENTRY_REFRESH
ENTRY_REFRESH chỉ cập nhật dữ liệu biến động nhanh, không tự ý viết lại toàn bộ Quality Score nếu không có sự kiện nền tảng mới.

```text
ENTRY REFRESH — TICKER
- Previous scan time:
- Current scan time:
- Price change:
- ATR distance change:
- D1/4H structure change:
- Relative Volume change:
- RS change:
- Orderbook/spread/depth change:
- Market Regime change:
- Previous Entry Score:
- Current Entry Score:
- Previous Opportunity Score:
- Current Opportunity Score:
- Action change:
- Reason for change:
- New trigger/invalidation:
```

Nếu giá vượt entry upper >0.5 ATR:
- Setup Type = CHASE.
- Execution Action tối đa WAIT_RETEST.
- Không giữ lại BUY_NOW từ lần quét cũ.

---

## 21. Change Log và chống mâu thuẫn
Khi điểm hoặc thứ hạng thay đổi đáng kể, phải có bảng:

| Coin | Metric | Previous | Current | Change reason | Source/time | Action impact |
|---|---|---:|---:|---|---|---|
| ABC | Quality Score | 76 | 82 | Product usage/revenue cải thiện | ... | Grade A → AA |
| ABC | Entry Score | 81 | 63 | Giá chạy xa entry, RS giảm | ... | BUY_SETUP → WAIT_RETEST |

Quy tắc:
- Không nói chung chung “dữ liệu đã thay đổi”.
- Phải nêu nhóm điểm thay đổi.
- Nếu điểm lần trước là sơ bộ do thiếu dữ liệu, ghi rõ.
- Không sửa lịch sử để làm cho nhận định cũ có vẻ đúng.

---

## 22. Output dạng JSON tùy chọn
Khi người dùng yêu cầu dùng cho phần mềm/scanner, có thể thêm JSON sau phần báo cáo đọc được.

```json
{
  "version": "8.0",
  "scan_mode": "FULL_SCAN",
  "scan_time": "YYYY-MM-DDTHH:mm:ssZ",
  "market_regime": "NEUTRAL",
  "market_data_quality": "GOOD",
  "overall_confidence": "HIGH",
  "usdt_recommendation_pct": [60, 80],
  "coins": [
    {
      "ticker": "ABC",
      "name": "Example",
      "binance_pair": "ABCUSDT",
      "price": null,
      "price_time": null,
      "market_cap_usd": null,
      "fdv_usd": null,
      "fdv_mc": null,
      "circulating_pct": null,
      "volume_24h_usd": null,
      "binance_volume_24h_usd": null,
      "spread_pct": null,
      "depth_1pct_usd": null,
      "slippage_25m_vnd_pct": null,
      "quality_score": null,
      "investment_grade": null,
      "entry_score": null,
      "entry_grade": null,
      "opportunity_score": null,
      "setup_type": null,
      "execution_action": null,
      "execution_block_reason": null,
      "x2_feasibility": null,
      "x3_feasibility": null,
      "asymmetry_score": null,
      "relative_strength": null,
      "overhead_supply": null,
      "unlock_confidence": null,
      "blacklist_status": null,
      "severity": null,
      "risk_codes": [],
      "data_quality": null,
      "confidence": null,
      "entry_lower": null,
      "entry_upper": null,
      "stop": null,
      "tp1": null,
      "tp2": null,
      "tp3": null,
      "rr1": null,
      "rr2": null,
      "suggested_nav_pct": null,
      "trigger": null,
      "invalidation": null
    }
  ]
}
```

Quy tắc JSON:
- Dữ liệu không có dùng `null`, không dùng `0`.
- Không đổi tên enum tùy từng lần chạy.
- Không để status và action mâu thuẫn.
- Coin `BLOCKED` hoặc `EXCLUDE` không được có `suggested_nav_pct > 0`.

---


## 22A. Report Validation Gate
Trước khi trả báo cáo, phải hiển thị hoặc tự xác nhận:
- [ ] Scan Mode đúng.
- [ ] FULL_SCAN có Universe Accounting.
- [ ] Market Regime đủ dữ liệu hoặc đã gắn PROVISIONAL.
- [ ] Điểm chính xác có subscore và Evidence.
- [ ] PROVISIONAL/RANGE nằm ngay cạnh điểm.
- [ ] Protocol Quality tách Token Value Capture.
- [ ] UNKNOWN không bị coi PASS.
- [ ] BUY_SETUP đủ orderbook, unlock, D1/4H, stop, RR.
- [ ] Capital Plan cộng đủ 100%.
- [ ] Top 3 chỉ gồm FINAL score và vượt Hard Rule.
- [ ] Source/timestamp đi kèm dữ liệu quan trọng.

Nếu không đạt, phải hạ nhãn, hạ Confidence hoặc bỏ BUY_SETUP trước khi xuất.


### 22.1. Trường Integrity bổ sung cho JSON
```json
{
  "scan_mode": "FULL_SCAN_RESEARCH | FULL_SCAN_EXECUTION | WATCHLIST_SCAN | RESEARCH_RECAP",
  "universe_accounting": {
    "initial": 0,
    "binance_eligible": 0,
    "research_shortlist": 0,
    "execution_verified": 0,
    "buy_setup_count": 0
  },
  "score_status": {
    "quality": "FINAL | PROVISIONAL | RANGE | NOT_SCORED",
    "entry": "FINAL | PROVISIONAL | RANGE | NOT_SCORED",
    "opportunity": "FINAL | PROVISIONAL | RANGE | N/A"
  },
  "protocol_token_separation": {
    "protocol_quality": "",
    "token_value_capture": "STRONG | MEDIUM | WEAK | UNVERIFIED"
  },
  "capital": {
    "current_deployable_usdt_pct": 100,
    "target_reserve_after_entries_pct": 70
  }
}
```

## 23. Các lỗi output bị cấm
- Chỉ đưa một điểm tổng mà không tách Quality/Entry.
- Xếp coin Quality thấp lên đầu chỉ vì Entry đẹp hoặc cap nhỏ.
- Gọi coin Quality cao là BUY khi Entry thấp.
- Gọi BUY_NOW khi giá đã CHASE.
- Không hiển thị coin BLOCKED/EXCLUDE.
- Không ghi thời điểm dữ liệu.
- Ghi volume tổng nhưng không ghi Binance volume/orderbook.
- Gọi coin “hết unlock nên an toàn”.
- Không ghi project metrics phù hợp ngành.
- Gán Investment Grade bằng cảm tính hoặc danh tiếng.
- Tạo vùng mua/stop/RR từ dữ liệu cũ.
- Không nêu điều kiện vô hiệu.
- Bịa X2/X3 feasibility chỉ từ Market Cap.
- Dùng bảng quá rộng đến mức không đọc được.
- Lấp đủ Top 3 dù không có đủ setup hợp lệ.
- Đưa ra tỷ trọng vốn lớn khi Data Quality MIXED/POOR hoặc Confidence LOW.

---

## 24. Mẫu kết luận chuẩn đầy đủ

```text
KẾT LUẬN
1. Market Regime: ...
2. Data Quality / Confidence: ...
3. Quyết định hôm nay: ...
4. Top BUY_SETUP hợp lệ: ...
5. Quality cao nhưng cần chờ Entry: ...
6. BLOCKED/EXCLUDE + USDT đề xuất: ...
7. Trigger tiếp theo: ...

Lưu ý quan trọng:
- Quality Score đánh giá dự án; Entry Score đánh giá thời điểm mua.
- Hard Rule thắng mọi điểm số.
- Vùng mua chỉ có hiệu lực tại thời điểm dữ liệu được ghi trong báo cáo.
```

---

## 25. Phiên bản
**COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY**

Output Format chính thức, bắt buộc Universe Accounting cho FULL_SCAN, subscore/evidence cho điểm chính xác, Protocol–Token Separation, Capital Plan đủ 100% và Report Validation Gate.
