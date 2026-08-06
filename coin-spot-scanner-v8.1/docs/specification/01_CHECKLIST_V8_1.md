# COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY — MASTER CHECKLIST

## 0. Thông tin phiên bản
- Phiên bản: **V8.1 Professional — Execution Integrity**.
- Phạm vi: quét, đánh giá, xếp hạng và lập kế hoạch thực thi **altcoin Spot**.
- File này phải được dùng cùng `00_CONTEXT_V8_1.md`.
- Mục tiêu: tìm coin có chất lượng đủ tốt, thanh khoản thực, định giá còn dư địa và điểm mua có bất đối xứng lợi nhuận/rủi ro phù hợp.
- V8.1 tách ba lớp:
  - **Quality Score /100**: chất lượng dự án và token.
  - **Entry Score /100**: chất lượng điểm mua tại thời điểm quét.
  - **Opportunity Score /100**: xếp hạng cơ hội tổng hợp.
- **Hard Rule, Red Flag, Data Quality và Confidence luôn thắng điểm số.**

---

## 1. Nguyên tắc vận hành bắt buộc
1. Chỉ Spot; không Futures, không leverage.
2. Không ép phải có coin mua.
3. Không gọi `BUY_SETUP` chỉ vì Quality cao hoặc chart đẹp.
4. Không gọi dự án tốt là điểm mua tốt nếu Entry chưa đạt.
5. Không gọi điểm mua đẹp là khoản nắm giữ chính nếu Quality thấp.
6. Không dùng Market Cap nhỏ để thay thế Product Quality, Tokenomics, Liquidity hoặc X2 feasibility.
7. Không suy đoán dữ liệu còn thiếu.
8. Không dùng điểm số để vượt Hard Rule.
9. Mọi vùng mua, stop, TP và RR phải dùng giá mới tại thời điểm quét.
10. Khi dữ liệu thay đổi, phải nêu rõ nguyên nhân thay đổi thứ hạng.

---

## 2. Chế độ quét và Scan Integrity

### 2.1. `RESEARCH_RECAP`
Dùng khi:
- Xuất lại nội dung từ đoạn chat/báo cáo cũ.
- Không thực hiện truy xuất dữ liệu live mới.
- Mục tiêu là lưu trữ hoặc phân tích lại nhận định đã có.

Bắt buộc:
- Ghi rõ `KHÔNG PHẢI QUÉT LIVE`.
- Không cấp BUY_SETUP, entry, stop, TP hoặc RR mới.
- Điểm cũ phải ghi thời điểm và trạng thái `STALE/PROVISIONAL` nếu đã hết freshness.

### 2.2. `FULL_SCAN_RESEARCH`
Mục tiêu: quét universe và chọn shortlist nghiên cứu.

#### Tầng A — Universe Scan
Bắt buộc:
- Quét Top 500 CoinGecko hoặc CoinMarketCap.
- Kiểm tra Binance Spot/USDT.
- Loại token không phù hợp.
- Chạy Red Flag, Market Cap, thanh khoản sơ bộ, supply/unlock sơ bộ.
- Ghi Universe Accounting.

#### Tầng B — Research Shortlist
- Chọn 10–15 coin tốt nhất sau pre-filter.
- Chấm Quality với subscore và Evidence Level.
- Phân nhóm `QUALITY_HIGH_WAIT_ENTRY`, `WATCH_ONLY`, `BLOCKED`, `EXCLUDE`.
- Không cấp BUY_SETUP nếu chưa qua Execution Verification.

### 2.3. `FULL_SCAN_EXECUTION`
Chỉ được dùng khi đã hoàn tất `FULL_SCAN_RESEARCH` và tiếp tục:

#### Tầng C — Execution Verification
Cho 3–5 coin đứng đầu:
- Orderbook Binance live.
- Spread, depth ±0.5%/±1% và slippage.
- Unlock 7D/30D/90D xác minh trong ngày.
- D1/4H và trigger.
- Entry, stop, TP1/TP2/TP3, RR1/RR2 và ATR distance.
- Overhead Supply.

Chỉ coin vượt Tầng C mới được `BUY_SETUP`.

### 2.4. `WATCHLIST_SCAN`
Dùng khi người dùng gửi danh sách coin hoặc ảnh watchlist.
- Chỉ so sánh các coin được đưa ra.
- Vẫn áp dụng đầy đủ Hard Rule.
- Không tự ý thêm coin khác để lấp danh sách.
- Nếu thiếu execution live, chỉ cấp `PROVISIONAL/RANGE` và không BUY_SETUP.

### 2.5. `SINGLE_COIN_REVIEW`
- Tách rõ Quality, Entry, Liquidity, Tokenomics, Token Value Capture, X2/X3 và Action.
- Không kết luận mua nếu thiếu dữ liệu execution.

### 2.6. `COMPARISON_SCAN`
Bắt buộc đặt cạnh nhau:
- Quality Score/Status và Investment Grade.
- Entry Score/Status và Entry Grade.
- Opportunity Score/Status.
- Product/usage.
- Token value capture.
- Tokenomics/unlock.
- Structural liquidity.
- MC/FDV và X2/X3.
- Overhead Supply.
- Action.

Không kết luận coin A tốt hơn coin B chỉ vì cap nhỏ, giá thấp, chưa pump hoặc RSI thấp.

### 2.7. `ENTRY_REFRESH`
- Giữ Quality nếu còn fresh và không có sự kiện mới.
- Tính lại toàn bộ Entry, Opportunity, Hard Rule, unlock, orderbook và blacklist.
- Nếu Quality cũ là PROVISIONAL, không được tự nâng thành FINAL.

### 2.8. Universe Accounting bắt buộc
Báo cáo có chữ `FULL_SCAN` phải ghi:
- Universe source.
- Initial count.
- Binance Spot eligible count.
- Excluded by token type.
- Excluded by Market Cap.
- Blocked by listing/security.
- Failed liquidity pre-filter.
- Failed supply/unlock pre-filter.
- Research Shortlist count.
- Execution Verification count.
- BUY_SETUP count.

Thiếu một trong các số liệu cốt lõi: hạ nhãn thành `WATCHLIST_SCAN` hoặc `RESEARCH_RECAP` tùy thực tế.

## 3. Chuẩn bị dữ liệu và freshness

### 3.1. Ghi nhận bắt buộc
- Ngày, giờ và múi giờ quét.
- Giá tham chiếu và thời điểm giá.
- Nguồn chính cho từng nhóm dữ liệu.
- Thời điểm cập nhật của dữ liệu.
- Ticker, project slug, chain và contract nếu cần để tránh map nhầm.

### 3.2. Cửa sổ freshness vận hành
Các cửa sổ sau là tiêu chuẩn nội bộ để quyết định execution:

| Nhóm dữ liệu | FULL_SCAN/WATCHLIST | BUY NOW/Execution |
|---|---:|---:|
| Giá hiện tại | <=60 phút | <=15 phút |
| Binance orderbook/spread/depth | <=60 phút | Live hoặc <=5 phút |
| Kline 4H | Nến hiện tại/đóng gần nhất | Nến hiện tại/đóng gần nhất |
| Kline D1 | Nến hiện tại/đóng gần nhất | Nến hiện tại/đóng gần nhất |
| Volume 24H/Binance volume | <=6 giờ | <=60 phút |
| MC/FDV/circulating | <=24 giờ | <=6 giờ nếu giá biến động mạnh |
| Unlock 7D/30D/90D | Xác minh trong ngày quét | Xác minh lại trước lệnh |
| Project metrics | Theo cadence chính thức, ưu tiên <=30 ngày | Không bắt buộc live |
| Security/blacklist/news | Xác minh trong ngày quét | Xác minh lại trước lệnh |

### 3.3. Nhóm dữ liệu quan trọng
1. Giá và kline D1/4H.
2. Binance Spot volume và orderbook live.
3. MC, FDV, circulating và supply.
4. Unlock 7D/30D/90D.
5. Product/usage metrics phù hợp với ngành.
6. Entry, stop, TP và RR.

Quy tắc:
- Thiếu 1 nhóm quan trọng: Data Quality tối đa `MIXED`.
- Thiếu từ 2 nhóm quan trọng: chỉ `WATCHLIST`.
- Mapping token/contract không chắc: `BLOCKED` cho đến khi xác minh.

---


## 3A. Score Transparency & Evidence Gate
### 3A.1. Trạng thái điểm
- `FINAL`: đủ dữ liệu, subscore, nguồn, freshness và Evidence Level.
- `PROVISIONAL`: còn đúng 1 nhóm quan trọng UNKNOWN/STALE hoặc evidence chưa đủ mạnh.
- `RANGE`: thiếu từ 2 nhóm quan trọng; chỉ đưa khoảng điểm.
- `NOT_SCORED`: dữ liệu không đủ ý nghĩa.

### 3A.2. Quy tắc công bố
Mọi điểm số phải kèm:
- Subscore từng nhóm.
- Trọng số.
- Điểm quy đổi.
- Evidence Level E0–E4.
- Nguồn.
- Freshness.
- Confidence.

Không được:
- Công bố số chính xác nếu không có bảng subscore.
- Dùng `UNKNOWN` như điểm trung bình mặc định.
- Gán Investment Grade chính thức cho `QUALITY RANGE`.
- Tính Opportunity chính xác nếu Quality hoặc Entry không FINAL.

### 3A.3. Critical groups
Quality critical groups:
- Product & Real Adoption.
- Tokenomics/Unlock/Value Capture.
- Structural Liquidity.
- Valuation & X2/X3.

Entry critical groups:
- Price/Kline D1/4H.
- Orderbook/Spread/Depth/Slippage.
- Unlock trong cửa sổ nắm giữ.
- Entry/Stop/TP/RR.
- Trigger/Overhead Supply.

Thiếu từ 2 critical groups: `RANGE` hoặc `NOT_SCORED`.

## 4. Đánh giá Market Regime

### 4.1. Dữ liệu bắt buộc
- BTC D1 và 4H.
- ETH D1 và 4H.
- BTC Dominance.
- ETH/BTC.
- TOTAL3 hoặc proxy đáng tin.
- Breadth altcoin.
- Tỷ lệ coin Binance Spot trên MA20 D1.
- Tỷ lệ tăng/giảm 24H và 7D.
- Volume altcoin so với trung bình 7D.
- Tin vĩ mô, pháp lý, sàn hoặc sự kiện bất thường có ảnh hưởng rộng.

### 4.2. Phân loại
#### THUẬN LỢI
- BTC giữ cấu trúc D1, không tăng dựng đứng hút thanh khoản.
- BTC 4H không breakdown.
- ETH giữ cấu trúc.
- ETH/BTC tạo đáy hoặc tăng.
- BTC.D đi ngang hoặc giảm.
- TOTAL3 giữ hỗ trợ hoặc breakout.
- Breadth mở rộng.
- Volume altcoin tăng lành mạnh.

#### TRUNG TÍNH
- BTC chưa breakdown nhưng BTC.D cao hoặc ETH/BTC yếu.
- TOTAL3/breadth chưa xác nhận.
- Dòng tiền cục bộ theo ngành hoặc một số coin RS cao.

#### XẤU
- BTC/ETH mất hỗ trợ D1.
- BTC 4H breakdown với volume.
- BTC.D tăng mạnh và ETH/BTC tạo đáy mới.
- TOTAL3 breakdown.
- Breadth xấu, volume bán tăng.

### 4.3. Hard Rule thị trường
- Không xác minh được TOTAL3/proxy: Market Regime tối đa `TRUNG TÍNH`.
- BTC biến động bất thường: hạ execution toàn bộ một bậc.
- BTC.D tăng mạnh đồng thời ETH/BTC giảm: cấm small-cap/high-beta.
- Breadth xấu + selling volume tăng: không mở vị thế mới.
- Market `XẤU`: không `BUY_SETUP` mới, bất kể Entry Score.

---


### 4.4. Market Regime Completeness Gate
Kiểm tra 9 nhóm:
1. BTC D1.
2. BTC 4H.
3. ETH D1/4H.
4. BTC.D.
5. ETH/BTC.
6. TOTAL3/proxy.
7. Breadth và % coin trên MA20 D1.
8. Altcoin volume so với trung bình 7D.
9. Macro/legal/event risk.

- Đủ 8–9: có thể `FINAL`.
- Thiếu 1–2: `PROVISIONAL`, Confidence tối đa MEDIUM.
- Thiếu >=3: Confidence LOW, regime tối đa TRUNG TÍNH, không nâng BUY_SETUP.
- Fear & Greed không thay thế bất kỳ nhóm cốt lõi nào.

## 5. Tạo universe

### 5.1. Universe mặc định
- Quét Top 500 CoinGecko hoặc CoinMarketCap.
- Bắt buộc có Binance Spot/USDT, trừ khi người dùng yêu cầu universe khác.
- Loại:
  - Stablecoin.
  - Wrapped token.
  - Bridged token.
  - Liquid staking token.
  - Tokenized stock.
  - Index token.
  - Leveraged token.

### 5.2. Nhóm Market Cap
- `<50M`: EXCLUDE mặc định.
- `50–100M`: micro-liquid, chỉ SPECULATIVE, tối đa 1% NAV.
- `100–250M`: Priority A.
- `250–500M`: Priority A.
- `500–900M`: nhóm bổ sung ưu tiên.
- `900M–1.5B`: Priority B.
- `1.5–3B`: ngoại lệ, cần Quality vượt trội.
- `>3B`: benchmark/watchlist; không Top 3 x2/x3 mặc định.

### 5.3. Nguyên tắc room-to-grow
- Market Cap chỉ phản ánh quy mô hiện tại.
- Không mặc định coin 100M tốt hơn coin 500M.
- Room-to-grow phải được kiểm tra cùng:
  - Product adoption.
  - Token value capture.
  - Liquidity.
  - FDV.
  - Unlock.
  - Đối thủ cùng ngành.
  - Overhead Supply.

---

## 6. Red Flag và loại sớm

### 6.1. Red Flag bắt buộc
- Binance Monitoring Tag.
- Delisting hoặc trading suspension.
- Migration/rebrand chưa rõ.
- Hack/exploit/bridge issue chưa xử lý.
- Lawsuit/regulator nghiêm trọng.
- Team dump hoặc treasury transfer bất thường.
- Mapping ticker/contract conflict.
- Price conflict nghiêm trọng giữa nguồn.
- Unlock conflict.
- Fake volume nghiêm trọng.
- Orderbook quá mỏng.
- Circulating cực thấp.
- Narrative chết, sản phẩm ngừng phát triển hoặc community chỉ còn đầu cơ.

### 6.2. Hành động
- `EXCLUDE`: rủi ro cấu trúc hoặc không còn phù hợp universe.
- `BLOCKED`: rủi ro tạm thời cần xác minh hoặc chờ sự kiện qua.
- `WATCH_ONLY`: chưa đủ bằng chứng để mua.

Fail nghiêm trọng: dừng chấm Entry; chỉ ghi lý do BLOCKED/EXCLUDE.
Có thể vẫn chấm Quality phục vụ nghiên cứu lịch sử nếu ghi rõ `NON_EXECUTABLE`.

---

## 7. Product & Real Adoption

### 7.1. Nguyên tắc chung
Đánh giá ứng dụng thực tế bằng metric phù hợp từng ngành. Không dùng một bộ metric cho mọi coin.

### 7.2. Metric theo ngành
#### DEX / AMM / Aggregator
- Trading volume thực.
- TVL chất lượng.
- Fees và protocol revenue.
- Active traders.
- Market share.
- Retention.
- Organic volume so với incentive volume.

#### Lending / Money Market
- TVL và supplied/borrowed assets.
- Outstanding borrows.
- Fees/revenue.
- Active borrowers.
- Bad debt, liquidation và risk controls.
- Retention và chain diversification.

#### L1 / L2
- Transactions có ý nghĩa.
- Active addresses/users.
- Stablecoin supply và net bridge flows.
- Fees/revenue.
- Developers và ứng dụng hoạt động.
- Usage ngoài bot/spam/incentive.

#### Derivatives
- Volume và open interest chất lượng.
- Active traders.
- Fees/revenue.
- Market share.
- Retention.
- Risk engine và liquidation performance.

#### Oracle / Infrastructure / Interoperability
- Integrations thực.
- Secured value hoặc usage volume.
- Customers/protocol dependency.
- Revenue nếu có.
- Độ khó thay thế.

#### DePIN
- Devices/nodes hoạt động.
- Utilization.
- Revenue.
- Geographic coverage.
- Unit economics.
- Tỷ lệ incentive so với demand thật.

#### AI / Data / Compute
- Người dùng trả phí.
- Jobs/inference/compute demand.
- Revenue.
- Integrations.
- Retention.
- Giá trị token trong hoạt động mạng.

#### Gaming / Consumer / Social
- DAU/MAU.
- Retention.
- Payer rate và ARPU nếu có.
- Revenue.
- Content cadence.
- Organic users so với airdrop farming.

### 7.3. Dấu hiệu không đủ bằng chứng
Không chấm cao chỉ vì:
- Website đẹp hoặc roadmap dài.
- Follower lớn.
- Transaction nhiều do bot/spam.
- TVL tăng do incentive ngắn hạn.
- Revenue không quay về token hoặc không bền vững.
- Partnership chỉ là thông cáo, chưa có sử dụng thực.

---

## 8. Tokenomics, Supply, Unlock và Value Capture

### 8.1. Dữ liệu bắt buộc
- Market cap.
- FDV.
- FDV/MC.
- Circulating supply.
- Total/max supply.
- Circulating percentage.
- Inflation/emission thực tế.
- Cliff và linear unlock.
- Allocation: team/private/seed/ecosystem/treasury.
- Staking rewards và nguồn phần thưởng.
- Burn/buyback.
- Protocol revenue và value accrual cho token.
- Treasury size và quyền sử dụng.

### 8.2. Ngưỡng FDV và circulating
- `FDV/MC <=1.5`: tốt.
- `1.5–2.5`: chấp nhận nếu unlock rõ và value capture tốt.
- `2.5–4`: rủi ro cao.
- `>4`: Quality bị giới hạn; tối đa WATCH_ONLY nếu dilution chưa được giải thích.
- `>5 + unlock chưa rõ`: EXCLUDE.
- `Circulating <25%`: hạ mạnh.
- `Circulating <15%`: BLOCKED trừ ngoại lệ đã xác minh.

### 8.3. Unlock source priority
Ưu tiên theo thứ tự:
1. Tokenomist hoặc API chuyên unlock.
2. CoinGecko Token Unlocks.
3. CoinMarketCap Token Unlocks.
4. DefiLlama Unlocks.
5. Tài liệu tokenomics/vesting chính thức.
6. Nguồn phụ để đối chiếu, không dùng đơn độc khi có conflict.

### 8.4. Cửa sổ unlock
Bắt buộc tính:
- Unlock 7D.
- Unlock 30D.
- Unlock 90D.
- Ngày unlock.
- Số token.
- % circulating.
- Giá trị USD.
- Unlock/value so với volume.
- Cliff hay linear.
- Allocation/category.
- Confidence.

### 8.5. Hard Rule unlock
- Unlock 7D `>1% circulating`: BLOCKED.
- Unlock 30D `>3% circulating`: không mua ngay.
- Unlock 90D `>8% circulating`: hạ mạnh hoặc loại.
- Cliff team/private/seed: rủi ro cao hơn ecosystem emission.
- Source conflict hoặc mapping không chắc: BLOCKED.
- Unlock Confidence `POOR`: không BUY_SETUP, không BUY NOW, không Top 3.
- Unlock Confidence `MIXED`: tối đa WAIT_RETEST/WATCH_ONLY, trừ khi dữ liệu đã có chứng minh không vượt ngưỡng và các nhóm khác rất mạnh.

### 8.6. Coin gần hết unlock
Được cộng điểm trong nhóm Tokenomics khi:
- Circulating cao.
- Không còn cliff lớn.
- Inflation/emission thấp hoặc giảm.
- Treasury risk chấp nhận được.

Không tự động chấm cao nếu:
- Supply tập trung vào cá voi/team.
- Treasury còn lượng lớn có thể bán.
- Staking reward gây lạm phát cao.
- Token không có value capture.

### 8.7. Value capture
Xác minh token có hưởng lợi từ hoạt động dự án hay không:
- Fee share.
- Buyback/burn.
- Required staking/collateral.
- Gas/payment/settlement demand.
- Governance có quyền kinh tế thực.
- Security budget hoặc protocol dependency.

Token chỉ governance hình thức không được chấm tối đa.

---


### 8.8. Protocol–Token Separation Rule
Phải chấm riêng:

**Protocol Quality**
- Product-market fit.
- TVL/usage/users.
- Fees/revenue.
- Growth/retention.

**Token Holder Value**
- Token demand bắt buộc hoặc utility thật.
- Burn/buyback từ dòng tiền thật.
- Fee sharing hoặc staking từ doanh thu thật.
- Net emission.
- Treasury/team/VC selling pressure.
- Quyền kinh tế của holder.

Quy tắc:
- TVL, fees, revenue không được cộng trực tiếp vào Token Value Capture.
- Nếu value capture chưa xác minh: mục Value Capture tối đa 2/4 và Quality tối đa MEDIUM Confidence.
- Nếu token không hưởng lợi rõ: chấm theo dữ liệu thực, không gọi “economics mạnh” chỉ vì protocol revenue cao.
- Không double-count cùng một dòng tiền ở Product, Tokenomics và Valuation.

## 9. Structural Liquidity và Fake Volume Risk

### 9.1. Dữ liệu bắt buộc
- Tổng Spot volume 24H.
- Trung bình volume 7D và 20D.
- Volume/MC.
- Binance Spot volume.
- Binance volume/tổng volume.
- Spread.
- Depth ±0.5% và ±1%.
- Slippage dự kiến cho lệnh 5M/10M/25M VND.
- Số sàn chất lượng và mức độ tập trung volume.

### 9.2. Ngưỡng thực thi
- Tổng Spot volume `<10M USD`: không mua ngay; quá mỏng thì EXCLUDE.
- `10–20M`: chỉ vị thế nhỏ.
- `>20M`: đạt cơ bản.
- Volume/MC `3–15%`: vùng ưu tiên, nhưng phải kiểm tra chất lượng volume.
- Spread `<=0.10%`: tốt.
- `0.10–0.25%`: chấp nhận.
- `>0.25%`: hạ điểm.
- `>0.50%`: không mua chính.
- Slippage `>0.5%`: giảm vị thế hoặc loại.
- Depth ±1% quá mỏng: không BUY_SETUP.

### 9.3. Fake Volume Risk
Dấu hiệu:
- Tổng volume lớn nhưng Binance volume rất thấp.
- Volume/MC cực cao kéo dài nhưng giá/depth không tương xứng.
- Volume tập trung ở sàn ít uy tín.
- Orderbook mỏng hơn nhiều so với volume báo cáo.
- Wick dài, chênh giá giữa sàn bất thường.
- Volume tăng nhưng depth không tăng.

Xếp loại:
- `LOW`: volume và orderbook tương xứng.
- `MEDIUM`: có điểm bất thường nhưng giải thích được.
- `HIGH`: không BUY_SETUP nếu chưa giải thích được.

### 9.4. Structural Liquidity và Tactical Volume
- Structural Liquidity thuộc **Quality Score**: khả năng vào/ra ổn định trong nhiều tuần/tháng.
- Relative Volume thuộc **Entry Score**: dòng tiền hiện tại có xác nhận setup hay không.
- Không trộn hai khái niệm.

---

## 10. Holder, Treasury và Market Maker Risk

### 10.1. Holder Risk
Kiểm tra khi có dữ liệu:
- Top holders.
- Exchange wallets.
- Burn/lock wallets.
- Team/VC/treasury wallets.
- Concentration ngoài sàn.
- Biến động số dư của ví lớn.

Quy tắc:
- Loại địa chỉ sàn/burn/bridge trước khi kết luận.
- Không kết luận từ symbol trùng.
- Concentration cao chưa xác minh: hạ Confidence.
- Team/treasury transfer bất thường: BLOCKED hoặc hạ mạnh.

### 10.2. Market Maker Risk
Dấu hiệu:
- Volume >3x trung bình 7D không có catalyst rõ.
- Wick dài liên tục.
- Spread rộng.
- Orderbook mỏng.
- Volume tăng nhưng depth không tăng.
- Giá lệch giữa sàn.
- Pump nhanh rồi mất toàn bộ biên tăng.

Kết luận: `LOW / MEDIUM / HIGH`.
`HIGH`: không BUY NOW; tối đa SPECULATIVE/WAIT nếu không có Hard Rule khác.

---

## 11. Valuation và X2/X3 Feasibility

### 11.1. Dữ liệu bắt buộc
- Current MC.
- Current FDV.
- MC tại x2 và x3.
- FDV tại x2 và x3.
- Peer valuation cùng ngành.
- TVL/fees/revenue/users hoặc metric ngành phù hợp.
- Unlock trong khung nắm giữ.
- Overhead Supply.
- Catalyst cần có.

### 11.2. Nguyên tắc
- Không cộng điểm chỉ vì cap nhỏ.
- X2/X3 phải hợp lý cả về MC, FDV và dòng tiền.
- So sánh với đối thủ mạnh hơn, không chỉ đối thủ yếu hơn.
- Nếu FDV x2/x3 vượt xa dự án có adoption tốt hơn: hạ feasibility.
- Nếu x2 phải xuyên nhiều vùng cung D1: hạ feasibility.
- Nếu tokenomics làm MC tăng nhưng holder bị pha loãng: hạ feasibility.

### 11.3. Xếp loại
#### X2 HIGH
- MC x2 vẫn hợp lý so với peer.
- FDV x2 không quá căng.
- Product/adoption có thể hỗ trợ.
- Unlock thấp.
- Overhead Supply Low/Medium.
- Có catalyst hoặc dòng tiền khả thi.

#### X2 MEDIUM
- Có room nhưng cần market thuận lợi hoặc catalyst.
- Có một số vùng cung/định giá cần vượt.
- Tokenomics/liquidity chấp nhận được.

#### X2 LOW
- MC/FDV x2 quá cao so với peer.
- Product yếu hoặc value capture thấp.
- Unlock/overhead supply cản trở.
- Cần dòng tiền phi thực tế.

X3 chỉ xếp `MEDIUM/HIGH` khi sau x3 vẫn hợp lý về định giá, supply và cạnh tranh.

---

## 12. Moat và vị thế cạnh tranh

Kiểm tra:
- Khác biệt sản phẩm có thực chất không.
- Network effects.
- Liquidity moat.
- Switching cost.
- Brand/community chất lượng.
- Integration/dependency moat.
- Security/reliability history.
- Tốc độ đối thủ sao chép.
- Market share và khả năng giữ thị phần.

Không chấm moat cao chỉ vì:
- Là dự án lâu năm.
- Có token riêng.
- Có nhiều follower.
- Có công nghệ phức tạp nhưng ít người dùng.

Xếp loại tham chiếu:
- `STRONG`: khó thay thế, có network effect hoặc dependency rõ.
- `MODERATE`: có khác biệt nhưng cạnh tranh cao.
- `WEAK`: dễ sao chép, không có switching cost.

---

## 13. Team, Execution, Governance và Security

Kiểm tra:
- Lịch sử giao sản phẩm.
- Roadmap đã hoàn thành hay chỉ hứa hẹn.
- Developer activity phù hợp với loại dự án.
- Minh bạch treasury.
- Governance concentration.
- Audit, exploit history và cách xử lý sự cố.
- Uptime/reliability.
- Phản ứng của team khi thị trường xấu.

Dấu hiệu hạ điểm:
- Roadmap trễ kéo dài không giải thích.
- GitHub activity bề ngoài nhưng sản phẩm không tiến bộ.
- Governance bị một nhóm kiểm soát.
- Treasury thiếu minh bạch.
- Exploit lặp lại hoặc xử lý yếu.

---

## 14. Narrative và Verified Catalysts

### 14.1. Narrative
Đánh giá:
- Dòng tiền ngành.
- Market attention.
- Sức mạnh community có chất lượng.
- Narrative còn sống hay đã bão hòa.

### 14.2. Catalyst
Chỉ tính catalyst có thể xác minh:
- Mainnet/upgrade chính thức.
- Product launch.
- Revenue/value capture change.
- Listing/access expansion.
- Partnership đã triển khai.
- Regulatory/market structure change có tác động rõ.
- Tokenomics improvement đã thông qua.

Không tính tối đa:
- Tin đồn listing.
- Partnership mơ hồ.
- Roadmap không có ngày hoặc bằng chứng.
- Catalyst đã phản ánh hoàn toàn vào giá.

Narrative/catalyst chỉ 6% Quality Score; không được lấn át Product và Tokenomics.

---

## 15. Pump History và Accumulation

### 15.1. Dữ liệu
- 24H/3D/7D/14D/30D/60D/90D.
- Đáy gần nhất.
- Đỉnh gần nhất.
- Pump amplitude.
- Drawdown.
- Range position.
- Số ngày tích lũy sau pump.

### 15.2. Mẫu ưu tiên
- Sideway thấp 30–120 ngày.
- Selling volume giảm.
- Higher low.
- False break/reclaim.
- Spring/shakeout có hấp thụ.
- Breakout/retest thành công.

### 15.3. Hạ bậc
- `>80%/14D` chưa retest: WAIT_RETEST.
- `>100%/30D` chưa tích lũy 15–30 ngày: không mua.
- `>150%/60D` và giữa range: WATCH/EXCLUDE.
- Pump nóng, wick dài, spread lớn: tăng MM Risk.

---

## 16. Chart D1

Kiểm tra:
- Xu hướng lớn.
- Higher high/higher low hoặc lower high/lower low.
- MA20/50/200.
- Nền tích lũy.
- Breakdown/reclaim.
- Volume xu hướng.
- RSI như chỉ báo phụ, không dùng độc lập.
- Hỗ trợ/kháng cự.
- Range position.
- Khoảng cách tới hỗ trợ theo ATR 4H.

Không mua khi:
- D1 lower-high/lower-low rõ.
- Giá giữa range không có lợi thế.
- Giá xa hỗ trợ >1–1.5 ATR 4H.
- Cấu trúc chỉ đẹp trên 4H nhưng D1 vẫn giảm rõ.

---

## 17. Chart 4H và Setup Type

### 17.1. Trigger cần kiểm tra
- False break/sweep.
- Reclaim.
- Breakout.
- Retest.
- Higher low.
- Volume xác nhận.
- Nến đóng xác nhận.
- Khoảng cách từ giá hiện tại tới entry.

### 17.2. Setup Type
- `EARLY_ACCUMULATION`: nền thấp, volume co hẹp, chưa breakout.
- `RECLAIM_ENTRY`: false break/sweep đáy rồi reclaim.
- `BREAKOUT_RETEST`: breakout xác nhận và retest giữ được.
- `BUY_NOW`: còn trong entry zone, trigger đủ, chưa chạy xa.
- `CHASE`: vượt entry upper >0.5 ATR hoặc tăng nhanh; cấm mua.

Không có trigger: `WAIT_RETEST`.

---

## 18. Relative Volume và Money Flow

Kiểm tra:
- Volume co hẹp bao nhiêu ngày trong nền.
- Selling volume có giảm dần không.
- Volume tại nến reclaim.
- Breakout volume so với trung bình 20 phiên.
- Giá tăng cùng volume tăng hay volume giảm.
- Volume xuất hiện trước breakout hay chỉ sau pump.
- Binance buy/sell activity nếu có proxy đáng tin.

Mẫu ưu tiên:
- Volume co hẹp trong tích lũy.
- Selling volume giảm dần.
- Reclaim có volume tăng vừa phải.
- Breakout volume khoảng 1.5–2.5x trung bình 20 phiên, chưa FOMO.

Xếp loại:
- `STRONG`: dòng tiền xác nhận lành mạnh.
- `NEUTRAL`: chưa đủ xác nhận.
- `WEAK`: không BUY NOW, tối đa WAIT_RETEST.

---

## 19. Overhead Supply

Bắt buộc kiểm tra:
- Các vùng cung D1 phía trên.
- Số vùng kháng cự trước x2.
- Khoảng cách đến vùng breakdown lớn.
- Volume profile hoặc proxy.
- Holder kẹt hàng phía trên.
- Tỷ lệ volume đã trao tay trong nền hiện tại.

Xếp loại:
- `LOW`: phía trên tương đối trống, ít vùng cung lớn.
- `MEDIUM`: có 1–2 vùng cung nhưng room vẫn hợp lý.
- `HIGH`: nhiều vùng cung dày, x2 phải xuyên nhiều kháng cự.

Quy tắc:
- HIGH: không Top 3.
- HIGH + catalyst yếu: WATCH_ONLY.
- Chỉ nâng hạng khi volume hấp thụ rõ và catalyst đủ mạnh.

---

## 20. Risk/Reward và Asymmetry

### 20.1. Dữ liệu bắt buộc
- Giá tham chiếu và thời điểm.
- Entry lower/upper.
- Stop/invalidation.
- TP1/TP2/TP3.
- RR1/RR2.
- ATR 4H.
- Khoảng cách tới entry.
- Slippage dự kiến.

### 20.2. Công thức
- `Risk = Entry reference - Stop` đối với vị thế mua.
- `Reward TPn = TPn - Entry reference`.
- `RRn = Reward TPn / Risk`.

Dùng giá entry thực tế hoặc midpoint entry zone; phải ghi rõ cách dùng.

### 20.3. Ngưỡng
- RR1 `<1.5`: không mua.
- Market Trung tính: RR1 `>=1.8`.
- RR2 ưu tiên `>=2.5`.
- Giá thay đổi `3–5%` hoặc >0.5 ATR từ lúc quét: tính lại.
- Vượt entry upper >0.5 ATR: CHASE.

### 20.4. Asymmetry Score /10
Đánh giá:
- Downside tới stop.
- Upside tới TP cơ sở.
- Khả năng giữ runner x2/x3.
- Overhead Supply.
- Thời gian nắm giữ dự kiến.
- Xác suất trigger.
- Slippage và execution risk.

Tham chiếu:
- `8–10`: downside ngắn, RR cao, overhead thấp.
- `6–7`: tốt, đủ Top 3.
- `5`: có điều kiện.
- `<5`: không Top 3.

---

## 21. Relative Strength

Đánh giá:
- Coin/BTC.
- Coin/ETH.
- So với ngành.
- Phản ứng khi BTC giảm.
- Phản ứng khi BTC đi ngang.
- Phản ứng khi BTC hồi.

Thang tham chiếu /10:
- `8–10`: mạnh vượt trội.
- `6–7`: đủ mạnh để xét Top 3.
- `5`: trung bình, chỉ xem xét.
- `<5`: WATCH_ONLY.

BTC hồi mà coin không hồi: hạ RS và không BUY NOW.

---


## 21A. Data Coverage Matrix
Với Top 5 và mọi BUY_SETUP, phải có ma trận:

| Data group | Status | Freshness | Source | Impact |
|---|---|---|---|---|
| Price/Kline | PASS/UNKNOWN/CONFLICT/STALE/N/A |  |  |  |
| Binance Listing |  |  |  |  |
| Binance Volume |  |  |  |  |
| Orderbook Live |  |  |  |  |
| Unlock 7D/30D/90D |  |  |  |  |
| Product Metrics |  |  |  |  |
| Token Value Capture |  |  |  |  |
| Holder/Treasury |  |  |  |  |
| Security/Blacklist |  |  |  |  |
| Valuation/Peers |  |  |  |  |

Quy tắc:
- `CONFLICT` ở mapping, price, unlock hoặc listing: BLOCKED.
- `UNKNOWN` không tạo penalty tùy ý nhưng hạ Score Status/Confidence.
- Hai nhóm critical UNKNOWN: chỉ RANGE/WATCHLIST.

# PHẦN A — CHẤM QUALITY SCORE /100

## 22. Công thức chung

`Quality Score = Σ (Subscore / 10 × Trọng số)`

Mỗi subscore chấm từ 0–10 dựa trên bằng chứng:
- `0–2`: rất yếu hoặc có bằng chứng tiêu cực.
- `3–4`: yếu, thiếu bằng chứng.
- `5–6`: trung bình/chấp nhận được.
- `7–8`: tốt, bằng chứng rõ.
- `9–10`: xuất sắc, hiếm, nhiều nguồn xác nhận.

Không chấm 9–10 chỉ bằng nhận định định tính.

## 23. Quality Group 1 — Product & Real Adoption /24

| Thành phần | Trọng số |
|---|---:|
| Product-Market Fit và vấn đề giải quyết | 5 |
| Active users/usage thực | 5 |
| Economic activity: volume, fees, revenue hoặc metric ngành | 6 |
| Growth, retention và chất lượng tăng trưởng | 4 |
| Ecosystem integrations và mức độ phụ thuộc | 4 |
| **Tổng** | **24** |

### 23.1. Product-Market Fit /5
- 0–2/10: sản phẩm mơ hồ, không có nhu cầu rõ.
- 3–4/10: sản phẩm có nhưng usage thấp hoặc chủ yếu incentive.
- 5–6/10: giải quyết nhu cầu thật, adoption trung bình.
- 7–8/10: sản phẩm được dùng rõ, có thị trường.
- 9–10/10: dẫn đầu hoặc tạo category, nhu cầu bền vững.

### 23.2. Active users/usage /5
Chấm theo trend, chất lượng và retention; không chỉ số tuyệt đối.

### 23.3. Economic activity /6
Ưu tiên metric tạo giá trị thật:
- Fees/revenue.
- Trading/borrowing/compute demand.
- Paying users.
- Secured value hoặc protocol dependency.

### 23.4. Growth & retention /4
- Tăng do incentive ngắn hạn: không quá 5/10.
- Tăng hữu cơ và giữ được users/revenue: 7–10/10.

### 23.5. Ecosystem integrations /4
Chấm cao khi integration đã hoạt động và tạo usage, không chỉ công bố.

## 24. Quality Group 2 — Tokenomics, Supply & Unlock /22

| Thành phần | Trọng số |
|---|---:|
| Circulating, inflation và emission | 5 |
| Unlock 7D/30D/90D và allocation | 6 |
| FDV/MC và dilution risk | 4 |
| Token utility và value capture | 4 |
| Treasury/holder concentration và supply governance | 3 |
| **Tổng** | **22** |

### 24.1. Circulating, inflation và emission /5
- Circulating cao, inflation thấp/giảm: chấm cao.
- Circulating thấp, emission cao: chấm thấp.

### 24.2. Unlock /6
- Không cliff lớn, lịch rõ, allocation ít rủi ro: 8–10/10.
- Unlock trung bình nhưng minh bạch: 5–7/10.
- Unlock cao/conflict: Hard Rule; không dùng điểm để bù.

### 24.3. FDV/MC /4
- <=1.5: 8–10/10.
- 1.5–2.5: 6–8/10 tùy unlock.
- 2.5–4: 2–5/10.
- >4: 0–3/10 và áp hard cap.

### 24.4. Value capture /4
- Fee share, buyback/burn, required staking/collateral hoặc demand trực tiếp: chấm cao.
- Governance hình thức, không liên hệ usage-token: chấm thấp.

### 24.5. Treasury/holder /3
- Minh bạch, phân tán, không có transfer bất thường: chấm cao.
- Tập trung hoặc khó xác minh: chấm thấp và hạ Confidence.

## 25. Quality Group 3 — Structural Liquidity & Market Access /14

| Thành phần | Trọng số |
|---|---:|
| Tổng Spot volume và độ bền volume | 3 |
| Binance Spot volume và tỷ lệ Binance/tổng | 3 |
| Spread | 2 |
| Depth và slippage | 3 |
| Market access, concentration và Fake Volume Risk | 3 |
| **Tổng** | **14** |

### 25.1. Volume /3
- <10M: 0–3/10 và không mua ngay.
- 10–20M: 4–5/10.
- 20–50M: 6–8/10.
- >50M: có thể 8–10/10 nếu volume thật và ổn định.

Không chấm theo volume tuyệt đối mà bỏ qua MC, depth và chất lượng sàn.

### 25.2. Binance volume /3
- Binance chiếm tỷ lệ hợp lý và orderbook tương xứng: chấm cao.
- Tổng volume cao nhưng Binance rất thấp: hạ mạnh.

### 25.3. Spread /2
- <=0.10%: 9–10/10.
- 0.10–0.25%: 6–8/10.
- 0.25–0.50%: 2–5/10.
- >0.50%: 0–2/10 và không mua chính.

### 25.4. Depth/slippage /3
Đánh giá trực tiếp với quy mô lệnh 5M/10M/25M VND.

### 25.5. Market access/fake volume /3
Chấm cao khi volume phân bổ trên sàn uy tín, mapping rõ và Fake Volume Risk Low.

## 26. Quality Group 4 — Valuation & X2/X3 Feasibility /16

| Thành phần | Trọng số |
|---|---:|
| Current MC so với peer và stage | 4 |
| Current FDV so với peer và adoption | 3 |
| X2 feasibility | 5 |
| X3 feasibility | 2 |
| Valuation so với usage/economics | 2 |
| **Tổng** | **16** |

### 26.1. Current MC /4
- Cap 100–500M không tự động đạt tối đa.
- Chấm dựa trên room sau khi so với product và peer.

### 26.2. Current FDV /3
FDV phải được xem cùng circulating, unlock và value capture.

### 26.3. X2 feasibility /5
- HIGH: 8–10/10.
- MEDIUM: 5–7/10.
- LOW: 0–4/10.

### 26.4. X3 feasibility /2
Chấm thận trọng; không mặc định cap nhỏ sẽ x3.

### 26.5. Usage/economics /2
So sánh định giá với fees/revenue/TVL/users hoặc metric ngành phù hợp.

## 27. Quality Group 5 — Moat & Competitive Position /10

| Thành phần | Trọng số |
|---|---:|
| Product differentiation | 3 |
| Network effects/switching cost/liquidity moat | 3 |
| Market position và competition | 2 |
| Durability của lợi thế | 2 |
| **Tổng** | **10** |

- Dễ sao chép, không có switching cost: tối đa 4–5/10 toàn nhóm.
- Dẫn đầu nhờ network effect, liquidity hoặc dependency: có thể 8–10/10.

## 28. Quality Group 6 — Team, Execution, Governance & Security /8

| Thành phần | Trọng số |
|---|---:|
| Execution history và roadmap delivery | 2 |
| Developer/product activity | 2 |
| Governance và treasury transparency | 2 |
| Security, reliability và incident response | 2 |
| **Tổng** | **8** |

Exploit nghiêm trọng chưa xử lý là Hard Rule, không chỉ trừ điểm.

## 29. Quality Group 7 — Narrative & Verified Catalysts /6

| Thành phần | Trọng số |
|---|---:|
| Sector narrative và dòng tiền ngành | 2 |
| Catalyst chính thức 30–180 ngày | 2 |
| Catalyst chưa phản ánh hoàn toàn vào giá | 1 |
| Community/attention quality | 1 |
| **Tổng** | **6** |

Tin đồn không được tính như catalyst chính thức.

## 30. Quality Score hard caps
Áp dụng sau khi cộng điểm thô:

| Điều kiện | Quality Score tối đa/Hành động |
|---|---|
| Không có bằng chứng product/usage thực | Tối đa 59 |
| Product chủ yếu incentive/bot và không có economics | Tối đa 64 |
| FDV/MC >4 | Tối đa 64 |
| Circulating <20% | Tối đa 64 |
| Unlock Confidence POOR | Không Top 3; không BUY_SETUP |
| Token utility/value capture gần như không có | Nhóm Tokenomics tối đa 12/22 |
| Structural volume <10M | Structural Liquidity tối đa 5/14 |
| Fake Volume Risk High | Không BUY_SETUP |
| Security incident nghiêm trọng chưa xử lý | BLOCKED/EXCLUDE |
| Quality data thiếu từ 2 nhóm quan trọng | Quality chỉ là sơ bộ; WATCHLIST |

Hard cap không thay thế Hard Rule; điều kiện EXCLUDE/BLOCKED vẫn ưu tiên.

## 31. Investment Grade
- `AAA`: Quality 90–100.
- `AA`: 82–89.
- `A`: 74–81.
- `BBB`: 66–73.
- `BB`: 58–65.
- `B`: 50–57.
- `CCC`: <50.

Grade là chất lượng dự án/token, không phải tín hiệu mua.

---


## 31A. Quality Score Status
- `FINAL QUALITY`: cả 7 nhóm có subscore; 4 critical groups không UNKNOWN/CONFLICT; Evidence tối thiểu E2, ít nhất Product và Tokenomics đạt E3 nếu vào Top 3.
- `PROVISIONAL QUALITY`: đúng 1 critical group thiếu/stale hoặc Evidence chỉ E1–E2; phải ghi nhóm thiếu.
- `QUALITY RANGE`: >=2 critical groups thiếu; không cấp Investment Grade chính thức.
- `NOT_SCORED`: mapping hoặc dữ liệu nền tảng không đáng tin.

Không dùng một con số chính xác khi trạng thái là RANGE.

# PHẦN B — CHẤM ENTRY SCORE /100

## 32. Công thức chung

`Entry Score = Σ (Subscore / 10 × Trọng số)`

Entry Score phải được tính lại khi:
- Giá thay đổi 3–5%.
- Giá di chuyển >0.5 ATR 4H.
- Nến 4H mới đóng làm đổi cấu trúc.
- Market Regime thay đổi.
- Orderbook/liquidity thay đổi đáng kể.
- Có unlock, blacklist hoặc tin bất thường mới.

## 33. Entry Group 1 — Market Regime /12

| Thành phần | Trọng số |
|---|---:|
| BTC D1/4H | 3 |
| ETH, ETH/BTC và BTC.D | 3 |
| TOTAL3 và breadth | 3 |
| Altcoin volume và macro/event risk | 3 |
| **Tổng** | **12** |

- Thuận lợi: thường 7–10/10 toàn nhóm.
- Trung tính: thường 4–7/10.
- Xấu: 0–3/10 và không BUY_SETUP mới.

## 34. Entry Group 2 — D1/4H Structure & Setup /26

| Thành phần | Trọng số |
|---|---:|
| D1 trend và nền tích lũy | 8 |
| Pump history và accumulation quality | 5 |
| 4H setup/trigger | 7 |
| Range position, support và ATR distance | 4 |
| Multi-timeframe alignment | 2 |
| **Tổng** | **26** |

### 34.1. D1 trend /8
- Lower-high/lower-low rõ: 0–3/10.
- Tạo nền nhưng chưa reclaim cấu trúc: 4–6/10.
- Nền rõ, higher low hoặc reclaim: 7–9/10.
- Breakout/retest D1 lành mạnh: 8–10/10.

### 34.2. Accumulation /5
Ưu tiên 30–120 ngày, selling volume giảm và hấp thụ tốt.

### 34.3. 4H setup /7
- Không trigger: tối đa 5/10, WAIT_RETEST.
- Reclaim/breakout/retest có nến đóng: 7–10/10.

### 34.4. Range position/ATR /4
- Giữa range hoặc >1–1.5 ATR khỏi hỗ trợ: chấm thấp.
- Gần support hợp lệ, downside ngắn: chấm cao.

### 34.5. Multi-timeframe /2
D1 và 4H cùng hướng được chấm cao.

## 35. Entry Group 3 — Risk/Reward & Asymmetry /22

| Thành phần | Trọng số |
|---|---:|
| Stop/invalidation quality và downside | 5 |
| RR1 | 5 |
| RR2 | 4 |
| TP structure và runner potential | 3 |
| Asymmetry Score | 5 |
| **Tổng** | **22** |

### 35.1. Stop/downside /5
- Stop tùy ý, quá xa hoặc không theo cấu trúc: 0–4/10.
- Stop dưới invalidation rõ, risk kiểm soát: 7–10/10.

### 35.2. RR1 /5
- <1.5: 0–2/10 và không mua.
- 1.5–1.79: 4–5/10, chỉ market thuận lợi.
- 1.8–2.49: 6–8/10.
- >=2.5: 8–10/10 nếu TP hợp lý.

### 35.3. RR2 /4
- <2.0: 0–3/10.
- 2.0–2.49: 4–6/10.
- >=2.5: 7–10/10.

### 35.4. TP/runner /3
TP phải gắn vùng cung và khả năng x2/x3, không đặt tùy ý.

### 35.5. Asymmetry /5
Dùng Asymmetry Score /10 đã tính ở mục 20.

## 36. Entry Group 4 — Relative Strength /14

| Thành phần | Trọng số |
|---|---:|
| Coin/BTC | 4 |
| Coin/ETH | 3 |
| So với ngành | 3 |
| Hành vi khi market giảm/đi ngang/hồi | 4 |
| **Tổng** | **14** |

RS tổng <5/10: WATCH_ONLY và Entry Score bị hard cap.

## 37. Entry Group 5 — Relative Volume & Money Flow /12

| Thành phần | Trọng số |
|---|---:|
| Volume contraction trong nền | 3 |
| Selling volume giảm | 2 |
| Reclaim/trigger volume | 3 |
| Breakout volume quality | 2 |
| Binance flow/volume confirmation | 2 |
| **Tổng** | **12** |

Relative Volume `WEAK`: không BUY NOW.

## 38. Entry Group 6 — Overhead Supply /8

| Thành phần | Trọng số |
|---|---:|
| Số lượng/mật độ vùng cung | 3 |
| Khoảng trống giá và room tới TP/x2 | 2 |
| Volume profile/absorption | 2 |
| Trapped-holder risk | 1 |
| **Tổng** | **8** |

- LOW: thường 7–10/10.
- MEDIUM: 4–7/10.
- HIGH: 0–3/10 và không Top 3.

## 39. Entry Group 7 — Trigger, Freshness & Execution Readiness /6

| Thành phần | Trọng số |
|---|---:|
| Giá/kline fresh | 1 |
| Orderbook/spread/depth live | 1.5 |
| Trigger được xác nhận | 2 |
| Giá còn trong entry zone và slippage đạt | 1.5 |
| **Tổng** | **6** |

Không có orderbook live hoặc trigger cần thiết: không BUY_SETUP.

## 40. Entry Score hard caps

| Điều kiện | Entry Score tối đa/Hành động |
|---|---|
| Market Regime XẤU | Tối đa 59; không BUY_SETUP mới |
| D1 lower-high/lower-low rõ | Tối đa 59; WATCH_ONLY |
| Không có 4H trigger | Tối đa 74; WAIT_RETEST |
| CHASE | Tối đa 59; cấm mua |
| RR1 <1.5 | Tối đa 54; không mua |
| RR1 <1.8 trong market Trung tính | Tối đa 64 |
| RR2 <2.5 | Không Top 3 mặc định |
| Asymmetry <5 | Tối đa 69; không Top 3 |
| RS <5 | Tối đa 69; WATCH_ONLY |
| Relative Volume WEAK | Tối đa 69; không BUY NOW |
| Overhead Supply HIGH | Tối đa 69; không Top 3 |
| Orderbook không live | Tối đa 59; không BUY_SETUP |
| Kline 4H stale/không đạt | Tối đa 59; không BUY_SETUP |
| Giá vượt entry upper >0.5 ATR | CHASE; không mua |
| Pump >100%/30D chưa tái tích lũy | Tối đa 59; WAIT_RETEST |

## 41. Entry Grade
- `S`: 85–100.
- `A`: 75–84.
- `B`: 65–74.
- `C`: 55–64.
- `D`: 40–54.
- `F`: <40.

Entry Grade không tự động quyết định hành động; Hard Rule và Market Regime có thể hạ execution.

---


## 41A. Entry Score Status
- `FINAL ENTRY`: giá fresh; D1/4H; orderbook live; spread/depth/slippage; unlock; entry/stop/TP/RR; trigger và overhead supply đều đạt.
- `PROVISIONAL ENTRY`: thiếu đúng 1 critical group; không BUY_SETUP.
- `ENTRY RANGE`: thiếu >=2 critical groups; chỉ WATCHLIST.
- `NOT_SCORED`: không có dữ liệu giá/kline đáng tin hoặc mapping sai.

Entry Score tối đa 59 khi orderbook không live; nếu đồng thời thiếu unlock hoặc RR thì không ghi số chính xác, phải dùng RANGE/NOT_SCORED.

# PHẦN C — OPPORTUNITY SCORE VÀ QUYẾT ĐỊNH

## 42. Opportunity Score

Công thức:

`Opportunity Score = Quality Score^0.55 × Entry Score^0.45`

Quy tắc:
- Làm tròn 1 chữ số thập phân.
- Không tính nếu Quality hoặc Entry chỉ là ước đoán không có dữ liệu tối thiểu.
- Không dùng Opportunity để vượt Hard Rule.
- Quality thấp sẽ kéo Opportunity xuống ngay cả khi chart đẹp.
- Entry thấp sẽ kéo Opportunity xuống ngay cả khi dự án tốt.

### 42.1. Ngưỡng tham chiếu
- `>=82`: cơ hội rất mạnh, vẫn cần Hard Rule pass.
- `75–81.9`: cơ hội mạnh.
- `68–74.9`: có tiềm năng nhưng thường cần chờ hoặc vị thế nhỏ.
- `60–67.9`: watchlist.
- `<60`: không ưu tiên.

### 42.2. Sàn bắt buộc
- Quality <60: không nhóm mua chính.
- Entry <60: không BUY_SETUP.
- Top 3: Quality >=70, Entry >=70, Opportunity >=72.
- Micro-cap speculative: Quality >=60, Entry >=78, tối đa 1% NAV.

---


### 42.3. Opportunity Score Status
- Quality FINAL + Entry FINAL: Opportunity `FINAL`.
- Một điểm PROVISIONAL: Opportunity `PROVISIONAL`.
- Một điểm RANGE/NOT_SCORED: Opportunity `RANGE` hoặc `N/A`.
- Chỉ Opportunity FINAL mới được dùng để xác lập Top 3 chính thức.

## 43. Data Quality và Confidence

### 43.1. Data Quality
- `GOOD`: live/fresh, đủ, đồng nhất.
- `MIXED`: thiếu một nhóm hoặc dùng nguồn phụ, không có conflict nghiêm trọng.
- `POOR`: stale, mâu thuẫn hoặc thiếu nhiều nhóm.

### 43.2. Confidence
- `HIGH`: nhiều nguồn khớp, mapping rõ, không có giả định quan trọng.
- `MEDIUM`: có nguồn phụ hoặc một số khoảng trống không phá luận điểm chính.
- `LOW`: thiếu dữ liệu, conflict, mapping không chắc hoặc project metric không đáng tin.

### 43.3. Quy tắc hành động
- Data Quality POOR: chỉ WATCHLIST.
- Confidence LOW: không BUY_SETUP.
- Unlock Confidence POOR: BLOCKED khỏi Top 3.
- Không được tăng Confidence chỉ vì coin nổi tiếng.

---

## 44. Điều kiện vào Top 3
Coin chỉ được vào Top 3 khi đồng thời:
1. Không vi phạm Hard Rule.
2. Data Quality không POOR.
3. Confidence không LOW.
4. Quality Score >=70.
5. Entry Score >=70.
6. Opportunity Score >=72.
7. MC ưu tiên 100–500M; ngoại lệ phải giải thích.
8. Có nền tích lũy/tái tích lũy rõ.
9. Unlock không nguy hiểm trong khung nắm giữ.
10. RR2 >=2.5.
11. Asymmetry Score >=6.
12. RS >=6.
13. Overhead Supply Low/Medium.
14. Orderbook live và thanh khoản đạt.
15. X2 feasibility ít nhất Medium.
16. Không CHASE.
17. Có bằng chứng Product/Usage hoặc catalyst chính thức đủ mạnh.

Loại khỏi Top 3 khi:
- X2 phải vượt quá nhiều vùng cung.
- FDV x2 cao hơn rõ rệt peer mạnh hơn.
- Giá đã pump nóng mà chưa tái tích lũy.
- Binance volume thấp dù tổng volume cao.
- 4H đẹp nhưng D1 vẫn giảm rõ.
- Quality cao nhưng Entry chưa đạt.
- Entry đẹp nhưng Quality <70, trừ nhóm speculative riêng.

---


### 44.1. Điều kiện Integrity bổ sung
Ngoài các điều kiện hiện có, Top 3 bắt buộc:
- Quality Status = FINAL.
- Entry Status = FINAL.
- Opportunity Status = FINAL.
- Data Coverage không có UNKNOWN/CONFLICT ở nhóm critical.
- Product Quality và Token Value Capture đã được trình bày riêng.
- Có subscore và nguồn cho từng nhóm.

Coin Quality cao nhưng Entry chưa FINAL phải chuyển `TOP QUALITY_HIGH_WAIT_ENTRY`, không được dùng tiêu đề Top 3 cơ hội mua.

## 45. Execution Action

### BUY_SETUP
Điều kiện tối thiểu:
- Không Hard Rule.
- Quality >=60; nhóm mua chính ưu tiên >=70.
- Entry >=60; BUY mạnh ưu tiên >=75.
- Data Quality GOOD/MIXED.
- Confidence HIGH/MEDIUM.
- Orderbook live.
- Kline 4H fresh.
- Unlock đủ xác minh.
- RR đạt.
- Có stop/invalidation.

### SPECULATIVE_BUY
- MC 50–150M hoặc beta cao.
- Quality 60–69 hoặc rủi ro cao hơn nhóm chính.
- Entry >=78.
- Tối đa 1% NAV với micro-cap 50–100M.
- Phải ghi rõ rủi ro và điều kiện vô hiệu.

### WAIT_RETEST
- Quality tốt nhưng chưa có retest/trigger.
- Giá chưa về entry zone.
- Relative Volume chưa xác nhận.

### QUALITY_HIGH_WAIT_ENTRY
- Quality >=74.
- Entry <60 hoặc setup chưa hình thành.
- Không hạ Quality chỉ vì chưa có điểm mua.

### WATCH_ONLY
- Có tiềm năng nhưng Quality/Entry/data chưa đạt.

### BLOCKED
- Rủi ro tạm thời: unlock, conflict, monitoring, event, mapping, security.

### EXCLUDE
- Không phù hợp universe hoặc rủi ro cấu trúc.

---

## 46. Setup priority
Thứ tự ưu tiên:
1. EARLY_ACCUMULATION.
2. RECLAIM_ENTRY.
3. BREAKOUT_RETEST.
4. BUY_NOW.
5. CHASE — cấm mua.

BUY NOW chỉ được dùng khi:
- Giá còn trong entry zone.
- Trigger đủ.
- Orderbook live.
- Không vượt entry upper >0.5 ATR.
- RR vẫn đạt theo giá hiện tại.

---


## 47. Capital Allocation Engine

### 47.1. Hai lớp vốn bắt buộc
1. `Current Deployable Capital`: vốn mới được phép giải ngân ngay vào BUY_SETUP hợp lệ.
2. `Target Reserve After Valid Entries`: tỷ lệ USDT còn lại sau khi mở các setup hợp lệ.

Nếu BUY_SETUP = 0:
- Current Deployable Capital = `100% USDT`.
- Không được ngụ ý rằng phần còn lại đã được đầu tư.

### 47.2. Theo Market Regime
#### Thuận lợi
- Target Reserve: 25–40% USDT sau khi có setup hợp lệ.

#### Trung tính
- Target Reserve: 60–80% USDT sau khi có setup hợp lệ.
- Chỉ RS, RR, orderbook và Quality đạt.

#### Xấu
- Current Deployable Capital: 0% cho lệnh mới.
- Giữ 80–100% USDT tùy vị thế hiện tại.

### 47.3. Theo Market Cap
- 50–100M: tối đa 1% NAV.
- 100–250M: tối đa 3–6% NAV.
- 250–500M: tối đa 5–8% NAV.
- 500–900M: tối đa 3–6% NAV.
- >900M: theo Quality/Entry và room-to-grow, không mặc định cao.

### 47.4. Theo Quality/Entry
- Quality >=82 và Entry >=75: vị thế chính trong giới hạn cap.
- Quality 74–81 và Entry >=75: vị thế trung bình.
- Quality 66–73 hoặc Entry 65–74: thăm dò nhỏ/WAIT_RETEST.
- Quality <66: không vị thế chính.

### 47.5. Quy tắc lệnh
- Lệnh đầu 20–30% vị thế dự kiến.
- Chỉ tăng khi reclaim hoặc breakout-retest giữ được.
- Không DCA vì giá giảm.
- Tổng high-beta/meme <=35% phần vốn đã giải ngân.
- Không quá 3–4 coin cùng lúc.
- Bảng Capital Plan phải cộng đủ 100% NAV hoặc ghi rõ phần `Existing Positions`.

## 48. Take Profit và quản trị vị thế
- TP1: +15–25%, chốt 15–25%.
- TP2: +40–60%, chốt thêm 20–30%.
- Runner +80–200% chỉ khi:
  - Market thuận lợi.
  - Quality thesis còn nguyên.
  - D1/4H còn nguyên.
  - Volume xác nhận.
  - Overhead Supply Low/Medium.
  - Unlock/catalyst không chuyển xấu.
- Sau TP1, dời stop theo cấu trúc.
- Giảm/thoát khi:
  - Product/tokenomics thesis bị phá vỡ.
  - Team/treasury có hành vi bất thường.
  - Unlock mới xuất hiện hoặc dữ liệu bị sửa.
  - Mất invalidation với selling volume lớn.
  - Market Regime chuyển xấu.

---


## 49. Quy trình FULL_SCAN từng bước

### Tầng A — Universe Scan
#### Bước 1 — Metadata và nguồn
- Thời điểm, múi giờ, universe source, giá và freshness.

#### Bước 2 — Market Regime
- Chạy Completeness Gate; gắn FINAL/PROVISIONAL.

#### Bước 3 — Universe Accounting
- Ghi initial count và từng nhóm loại.

#### Bước 4 — Listing/Token Type filter
- Binance Spot/USDT và loại token không phù hợp.

#### Bước 5 — Red Flag pre-filter
- Listing, security, mapping, legal, migration.

#### Bước 6 — Liquidity/Supply pre-filter
- Volume, FDV/MC, circulating, unlock sơ bộ.

### Tầng B — Research Shortlist
#### Bước 7 — Chọn 10–15 coin
- Không dùng cap lớn để lấp danh sách; không ép đủ số nếu universe không đạt.

#### Bước 8 — Product & Protocol Quality
- Metric theo ngành, nguồn và freshness.

#### Bước 9 — Token Holder Value
- Value capture, net emission, treasury và holder risk.

#### Bước 10 — Quality Score
- Subscore, Evidence E0–E4, Score Status và Confidence.

#### Bước 11 — Provisional Research Ranking
- Tách FINAL/PROVISIONAL/RANGE.

### Tầng C — Execution Verification
#### Bước 12 — Chọn 3–5 coin đứng đầu
- Không mặc định đây là Top 3 để mua.

#### Bước 13 — Live execution data
- Orderbook, spread, depth, slippage, unlock, D1/4H, trigger, overhead supply.

#### Bước 14 — Entry/Opportunity
- Entry, stop, TP, RR, Entry Status, Opportunity Status.

#### Bước 15 — Top 3 eligibility
- Chỉ FINAL và vượt mọi Hard Rule.

#### Bước 16 — Capital Plan
- Current Deployable Capital + Target Reserve + Existing Positions.

#### Bước 17 — Validation Gate
- Tự kiểm tra trước khi xuất.

#### Bước 18 — Kết luận
- Có thể kết luận không có BUY_SETUP; không ép danh sách.

## 50. Decision Tree chi tiết

Start
→ Dữ liệu market đủ? Không: Regime tối đa Trung tính
→ Market Xấu? Có: không BUY_SETUP mới
→ Binance Spot/USDT? Không: EXCLUDE
→ Token mapping rõ? Không: BLOCKED
→ Monitoring/delist/suspend/hack? Có: BLOCKED/EXCLUDE
→ MC <50M? Có: EXCLUDE mặc định
→ Structural liquidity đạt? Không: WATCH_ONLY/EXCLUDE
→ Fake Volume Risk High? Có: không BUY_SETUP
→ FDV/MC >5 + unlock chưa rõ? Có: EXCLUDE
→ Circulating <15%? Có: BLOCKED
→ Unlock conflict/7D >1%? Có: BLOCKED
→ Unlock 30D >3%? Có: không mua ngay
→ Product/usage có bằng chứng? Không: Quality cap 59
→ Quality >=60? Không: không nhóm mua chính
→ X2 feasibility ít nhất Medium? Không: không Top 3
→ Pump nóng/CHASE? Có: WAIT_RETEST
→ D1 có nền/reclaim? Không: WATCH_ONLY
→ 4H trigger? Không: WAIT_RETEST
→ Relative Volume xác nhận? Không: WAIT_RETEST/WATCH_ONLY
→ RS >=6? Không: không Top 3
→ RR1/RR2 đạt? Không: WATCH_ONLY
→ Asymmetry >=6? Không: không Top 3
→ Overhead Low/Medium? Không: không Top 3
→ Entry >=60? Không: QUALITY_HIGH_WAIT_ENTRY/WATCH_ONLY
→ Quality >=70 + Entry >=70 + Opportunity >=72? Có: xét Top 3
→ Orderbook live + giá trong entry zone? Có: BUY_SETUP/BUY NOW theo setup

---

## 51. Quy tắc cập nhật điểm

### 51.1. Quality Score
Cập nhật khi:
- Báo cáo product metrics mới.
- Tokenomics/unlock thay đổi.
- Buyback/burn/value capture thay đổi.
- Security incident.
- Team/roadmap/governance thay đổi.
- MC/FDV thay đổi lớn làm valuation đổi đáng kể.

Nếu không có sự kiện mới, Quality có thể tái sử dụng trong thời gian ngắn nhưng phải xác minh lại MC/FDV/unlock trước execution.

### 51.2. Entry Score
Phải cập nhật thường xuyên hơn Quality:
- Mỗi lần quét mua.
- Sau nến 4H quan trọng.
- Khi giá thay đổi 3–5% hoặc >0.5 ATR.
- Khi market regime, volume hoặc orderbook đổi.

### 51.3. Opportunity Score
Luôn tính lại sau khi Quality hoặc Entry thay đổi.

---

## 52. Quy tắc chống mâu thuẫn
- Nếu thứ hạng thay đổi, nêu nhóm điểm nào thay đổi và dữ liệu gây thay đổi.
- Không tự sửa điểm cũ bằng mô tả chung chung.
- Nếu lần trước chỉ là điểm sơ bộ, phải nói rõ.
- Khi so sánh RUNE/SONIC hoặc bất kỳ cặp coin nào, không dùng cap nhỏ làm lý do duy nhất.
- Dự án tốt hơn có thể Quality cao hơn nhưng Entry thấp hơn.
- Coin thanh khoản yếu không được đứng trên coin thanh khoản mạnh chỉ nhờ MC nhỏ nếu các tiêu chí khác không bù được.
- Hết unlock chỉ tăng điểm Tokenomics; không tự động tăng điểm Holder/MM Risk.

---

## 53. Trường dữ liệu tối thiểu cho mỗi coin
- Ticker, name, chain/contract nếu cần.
- Binance Spot pair.
- Giá và thời điểm.
- MC, FDV, FDV/MC, circulating %.
- Volume 24H, avg 7D/20D, Binance volume.
- Binance volume/tổng volume.
- Spread, depth ±0.5%/±1%, slippage.
- Product metrics phù hợp ngành.
- Token value capture.
- Unlock 7D/30D/90D, allocation, confidence.
- Holder/Treasury/MM risk.
- Current MC/FDV và x2/x3.
- X2/X3 feasibility.
- Moat.
- Narrative/catalyst.
- D1/4H structure.
- Pump/accumulation.
- Relative Volume.
- RS.
- Overhead Supply.
- Entry, stop, TP1/TP2/TP3, RR1/RR2.
- Asymmetry Score.
- Quality Score + breakdown.
- Investment Grade.
- Entry Score + breakdown.
- Entry Grade.
- Opportunity Score.
- Data Quality và Confidence.
- Setup Type.
- Execution Action và block reason.

---

## 54. Quy tắc trình bày và tính trung thực
- Không bịa vùng mua.
- Không dùng RR từ giá cũ.
- Không giấu coin BLOCKED/EXCLUDE.
- Không dùng cap lớn để lấp danh sách.
- Không gọi BUY NOW nếu CHASE.
- Không gọi BUY_SETUP nếu thiếu orderbook live, kline 4H, unlock hoặc RR.
- Không gán Quality cao chỉ dựa trên danh tiếng.
- Không gán Project Quality thấp chỉ vì chart xấu.
- Không gán Entry cao chỉ vì giá đã giảm sâu.
- Không đưa con số chính xác giả tạo khi dữ liệu chỉ đủ định tính; phải ghi range hoặc Confidence thấp hơn.

---


## 54A. Report Validation Gate
Trước khi xuất:
- [ ] Scan Mode đúng thực tế.
- [ ] FULL_SCAN có Universe Accounting.
- [ ] Market Regime qua Completeness Gate.
- [ ] Điểm chính xác có subscore + evidence.
- [ ] PROVISIONAL/RANGE được ghi sát điểm.
- [ ] Protocol và Token Value Capture tách riêng.
- [ ] UNKNOWN không biến thành PASS.
- [ ] BUY_SETUP đủ execution data.
- [ ] Capital Plan cộng đủ 100%.
- [ ] Top 3 chỉ dùng score FINAL.
- [ ] Sources/timestamp gắn với nhận định quan trọng.

Nếu fail một mục critical: hạ Scan Mode/Confidence và không BUY_SETUP.

## 55. Phiên bản
**COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY**

Master Checklist chính thức cho quét Spot hằng ngày. Trọng số giữ nguyên V8.0; quy trình thực thi được siết bằng Universe Accounting, Evidence Gate, Score Status, Protocol–Token Separation và Validation Gate.
