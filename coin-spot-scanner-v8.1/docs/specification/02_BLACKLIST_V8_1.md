# COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY — BLACKLIST & RISK REGISTER

## 0. Thông tin phiên bản
- Phiên bản: **V8.1 Professional — Execution Integrity**.
- Phạm vi: quản lý rủi ro, trạng thái chặn và điều kiện gỡ cảnh báo cho hệ thống sàng lọc **altcoin Spot**.
- File này kế thừa blacklist V7.1 nhưng được mở rộng thành **Risk Register có trạng thái, mức độ nghiêm trọng, bằng chứng, thời hạn xác minh và điều kiện gỡ**.
- File này không thay thế `00_CONTEXT_V8_1.md` hoặc `01_CHECKLIST_V8_1.md`.
- Khi có xung đột, **Hard Rule và dữ liệu live/fresh đã xác minh luôn được ưu tiên**.

---

## 1. Mục đích
Blacklist V8.1 dùng để:
1. Loại sớm coin có rủi ro cấu trúc hoặc không phù hợp universe.
2. Tạm chặn coin đang có sự kiện chưa rõ, unlock nguy hiểm, sự cố bảo mật hoặc dữ liệu xung đột.
3. Theo dõi coin có rủi ro đáng kể nhưng chưa đủ căn cứ để loại.
4. Buộc AI phải ghi rõ **lý do, nguồn, ngày xác minh, trạng thái và điều kiện gỡ**.
5. Ngăn việc coin có điểm Quality/Entry cao vượt qua một Hard Rule.
6. Tránh dùng cảnh báo cũ như kết luận vĩnh viễn.

Blacklist là **hệ thống quản trị rủi ro động**, không phải danh sách kết tội cố định.

---

## 2. Nguyên tắc bắt buộc
- Không được coi coin an toàn chỉ vì không có tên trong file này.
- Không được giữ nguyên trạng thái cũ nếu chưa xác minh lại trong ngày quét.
- Không được dùng tin đồn, bài đăng ẩn danh hoặc một nguồn phụ đơn lẻ để EXCLUDE.
- Không được suy đoán contract, ticker, lịch unlock, ví team hoặc địa chỉ sàn.
- Không được gỡ cảnh báo chỉ vì giá tăng.
- Không được hạ mức rủi ro chỉ vì dự án nổi tiếng hoặc Market Cap lớn.
- Không được dùng Quality Score, Entry Score hoặc Opportunity Score để vượt `BLOCKED`/`EXCLUDE`.
- Không được phạt trùng một rủi ro nhiều lần mà không ghi rõ:
  - Blacklist quyết định **khả năng thực thi**.
  - Quality/Entry hard cap phản ánh **chất lượng hoặc điểm mua**.
- Mọi trạng thái phải có thời điểm xác minh và nguồn hỗ trợ.

---

## 3. Hệ thống trạng thái

### 3.1. `EXCLUDE`
Loại khỏi universe mua chính.

Dùng khi:
- Không có Binance Spot/USDT trong universe mặc định.
- Delist đã xác nhận hoặc giao dịch bị dừng vô thời hạn.
- Scam/rug hoặc gian lận nghiêm trọng có bằng chứng mạnh.
- Dự án bị bỏ, sản phẩm ngừng hoạt động và không còn kế hoạch khôi phục đáng tin.
- FDV/MC `>5` đồng thời lịch unlock không rõ.
- Thanh khoản cấu trúc quá mỏng, không phù hợp với quy mô lệnh của người dùng.
- Mapping token/contract không thể xác minh sau nhiều nguồn chính thức.
- Rủi ro pháp lý hoặc bảo mật làm luận điểm đầu tư không còn hợp lệ.

Ý nghĩa:
- Không tính là ứng viên mua.
- Có thể lưu lại để theo dõi lịch sử.
- Chỉ được chuyển trạng thái sau khi có bằng chứng mới đủ mạnh.

### 3.2. `BLOCKED`
Tạm chặn thực thi do Hard Rule hoặc sự kiện chưa được giải quyết.

Dùng khi:
- Binance Monitoring Tag hoặc cảnh báo tương đương chưa được xác minh là đã gỡ.
- Trading suspension tạm thời.
- Security incident/hack/exploit nghiêm trọng chưa xử lý hoàn toàn.
- Unlock 7D `>1% circulating`.
- Unlock source conflict hoặc không map đúng token/contract.
- Circulating `<15%`, trừ ngoại lệ đã xác minh.
- Team/treasury transfer bất thường chưa có giải thích đáng tin.
- Migration/rebrand/token swap chưa rõ.
- Data conflict nghiêm trọng ảnh hưởng trực tiếp đến MC, FDV, supply, price hoặc unlock.

Ý nghĩa:
- Không BUY_SETUP.
- Không BUY NOW.
- Không Top 3.
- Có thể tiếp tục nghiên cứu Quality với nhãn `NON_EXECUTABLE`.

### 3.3. `WATCH_RISK`
Có rủi ro đáng kể nhưng chưa đến mức chặn tuyệt đối.

Dùng khi:
- Unlock 30D `>3% circulating` nhưng chưa nằm trong cửa sổ 7D.
- Unlock 90D `>8% circulating` hoặc dilution cao trong khung nắm giữ.
- Circulating `<25%` nhưng `>=15%`.
- FDV/MC `2.5–4` hoặc tokenomics cần theo dõi.
- Fake Volume Risk `MEDIUM`.
- Holder concentration hoặc treasury risk cao nhưng chưa có hành vi bán bất thường.
- Market Maker Risk `HIGH` nhưng chưa có Hard Rule khác.
- Overhead Supply High.
- Product/usage suy giảm đáng kể nhưng chưa xác nhận dự án chết.
- Narrative yếu hoặc catalyst chưa chính thức.

Ý nghĩa:
- Mặc định `WATCH_ONLY` hoặc `WAIT_RETEST`.
- Chỉ nâng hành động khi dữ liệu mới xác minh rủi ro đã giảm.
- Không tự động loại Quality Score; phải chấm đúng nhóm bị ảnh hưởng.

### 3.4. `REVIEW`
Cần xác minh lại trước khi đưa ra kết luận.

Dùng khi:
- Cảnh báo cũ đã quá thời hạn freshness.
- Nguồn hiện tại không đủ.
- Có tin mới nhưng chưa có xác nhận chính thức.
- Ticker/slug dễ trùng.
- Lịch unlock từ các nguồn chưa đồng nhất nhưng chưa đủ căn cứ BLOCKED.
- Coin thuộc danh sách khởi tạo V7.1 nhưng chưa được kiểm tra lại ở lần quét hiện tại.

Ý nghĩa:
- Không được coi là đã an toàn.
- Nếu REVIEW liên quan dữ liệu execution quan trọng, không BUY_SETUP cho đến khi hoàn tất xác minh.

### 3.5. `CLEARED`
Cảnh báo đã được gỡ sau khi có đủ bằng chứng.

Điều kiện tối thiểu:
- Nguyên nhân cảnh báo đã được giải quyết hoặc không còn đúng.
- Có nguồn chính thức hoặc nhiều nguồn đáng tin khớp nhau.
- Dữ liệu live xác nhận thanh khoản, orderbook hoặc giao dịch đã phục hồi nếu có liên quan.
- Đã qua thời gian quan sát bắt buộc theo loại sự kiện.

`CLEARED` không đồng nghĩa với BUY_SETUP. Coin vẫn phải qua toàn bộ checklist V8.1.

---

## 4. Mức độ nghiêm trọng
Mức độ nghiêm trọng tách biệt với trạng thái để mô tả tác động.

| Severity | Ý nghĩa | Hành động mặc định |
|---|---|---|
| `S0` | Không còn rủi ro hoạt động; chỉ lưu lịch sử | CLEARED |
| `S1` | Rủi ro nhẹ hoặc dữ liệu cần theo dõi | REVIEW/WATCH_RISK |
| `S2` | Rủi ro trung bình, ảnh hưởng điểm hoặc tỷ trọng | WATCH_RISK |
| `S3` | Rủi ro cao, ảnh hưởng trực tiếp execution | BLOCKED |
| `S4` | Rủi ro cấu trúc/nghiêm trọng | EXCLUDE hoặc BLOCKED nghiêm ngặt |

Quy tắc:
- Trạng thái quyết định hành động.
- Severity mô tả mức độ và ưu tiên xác minh.
- Không tự động chuyển `S3` thành `EXCLUDE`; phải căn cứ tính chất rủi ro và khả năng khắc phục.

---

## 5. Mã nhóm rủi ro
Mỗi cảnh báo phải có ít nhất một `risk_code`.

### 5.1. Listing và sàn — `LST`
- `LST-01`: Không có Binance Spot/USDT.
- `LST-02`: Monitoring Tag/cảnh báo rủi ro.
- `LST-03`: Delisting announcement.
- `LST-04`: Trading suspension.
- `LST-05`: Deposit/withdrawal bị dừng kéo dài.
- `LST-06`: Migration/rebrand/token swap ảnh hưởng giao dịch.

### 5.2. Bảo mật — `SEC`
- `SEC-01`: Hack/exploit đang diễn ra.
- `SEC-02`: Bridge exploit.
- `SEC-03`: Smart-contract vulnerability chưa xử lý.
- `SEC-04`: Key compromise/admin-key risk.
- `SEC-05`: Oracle failure hoặc bad debt nghiêm trọng.
- `SEC-06`: Audit/incident disclosure mâu thuẫn.

### 5.3. Tokenomics, supply và unlock — `TOK`
- `TOK-01`: Unlock 7D >1% circulating.
- `TOK-02`: Unlock 30D >3% circulating.
- `TOK-03`: Unlock 90D >8% circulating.
- `TOK-04`: Cliff team/private/seed lớn.
- `TOK-05`: Circulating <15%.
- `TOK-06`: Circulating 15–25%.
- `TOK-07`: FDV/MC >4.
- `TOK-08`: FDV/MC >5 + unlock chưa rõ.
- `TOK-09`: Inflation/emission cao hoặc tăng bất thường.
- `TOK-10`: Staking reward chủ yếu từ phát hành mới.
- `TOK-11`: Value capture yếu hoặc governance hình thức.
- `TOK-12`: Unlock source conflict/mapping conflict.

### 5.4. Thanh khoản và fake volume — `LIQ`
- `LIQ-01`: Tổng Spot volume <10M USD.
- `LIQ-02`: Binance volume quá thấp so với tổng volume.
- `LIQ-03`: Spread >0.25%.
- `LIQ-04`: Spread >0.50%.
- `LIQ-05`: Depth ±1% quá mỏng.
- `LIQ-06`: Slippage >0.5% với quy mô lệnh mục tiêu.
- `LIQ-07`: Fake Volume Risk HIGH.
- `LIQ-08`: Volume tập trung ở sàn chất lượng thấp.
- `LIQ-09`: Orderbook không live hoặc không thể xác minh.
- `LIQ-10`: Giá lệch bất thường giữa các sàn.

### 5.5. Holder, treasury và market maker — `HLD`
- `HLD-01`: Holder concentration cao sau khi loại ví sàn/burn/bridge.
- `HLD-02`: Team/VC wallet tập trung cao.
- `HLD-03`: Treasury nắm tỷ trọng lớn và quyền bán không rõ.
- `HLD-04`: Team/treasury transfer bất thường.
- `HLD-05`: Exchange inflow bất thường từ ví liên quan.
- `HLD-06`: Market Maker Risk HIGH.
- `HLD-07`: Wick dài liên tục, pump-dump, depth không tương xứng.

### 5.6. Dữ liệu và mapping — `DAT`
- `DAT-01`: Ticker trùng hoặc slug không chắc.
- `DAT-02`: Contract/chain mapping conflict.
- `DAT-03`: Price conflict nghiêm trọng.
- `DAT-04`: MC/FDV/supply conflict.
- `DAT-05`: Unlock conflict.
- `DAT-06`: Dữ liệu stale.
- `DAT-07`: Không xác minh được nguồn chính.
- `DAT-08`: Product metric thiếu nguồn/freshness hoặc không phù hợp ngành.
- `DAT-09`: Token Value Capture chưa xác minh hoặc bị trộn với protocol revenue.
- `DAT-10`: Dữ liệu execution được lấy từ recap/stale nhưng bị dùng như live.

### 5.7. Team, governance, pháp lý — `GOV`
- `GOV-01`: Team dump hoặc hành vi không minh bạch.
- `GOV-02`: Founder/team rời dự án bất thường.
- `GOV-03`: Governance capture hoặc thay đổi quyền kinh tế bất lợi.
- `GOV-04`: Lawsuit/regulatory action nghiêm trọng.
- `GOV-05`: Treasury misuse.
- `GOV-06`: Roadmap thất bại kéo dài hoặc thông tin sai lệch có hệ thống.

### 5.8. Product, usage và narrative — `PRD`
- `PRD-01`: Sản phẩm ngừng hoạt động.
- `PRD-02`: Usage chủ yếu bot/spam/incentive.
- `PRD-03`: TVL/users/fees/revenue giảm kéo dài.
- `PRD-04`: Product-market fit chưa có bằng chứng.
- `PRD-05`: Narrative chết.
- `PRD-06`: Catalyst chỉ là tin đồn.
- `PRD-07`: Token không hưởng lợi từ hoạt động dự án.

### 5.9. Cấu trúc giá và execution — `EXE`
- `EXE-01`: D1 lower-high/lower-low rõ.
- `EXE-02`: Pump >100%/30D chưa tái tích lũy.
- `EXE-03`: CHASE — giá vượt entry upper >0.5 ATR.
- `EXE-04`: Overhead Supply High.
- `EXE-05`: Không có stop/invalidation.
- `EXE-06`: RR1 <1.5.
- `EXE-07`: RR2 <2.5.
- `EXE-08`: Kline 4H stale/không đạt.

Lưu ý:
- `EXE` thường tạo `WATCH_ONLY`, `WAIT_RETEST` hoặc cấm mua tại thời điểm hiện tại; không phải lúc nào cũng đưa coin vào blacklist dài hạn.
- Chỉ lưu `EXE` trong Risk Register khi rủi ro cần theo dõi qua nhiều lần quét.

---

## 6. Ma trận tự động gán trạng thái

| Điều kiện | Status mặc định | Severity | Execution |
|---|---|---:|---|
| Không Binance Spot/USDT | EXCLUDE | S4 | Không mua |
| Delist đã xác nhận | EXCLUDE | S4 | Không mua |
| Trading suspension | BLOCKED | S3 | Không mua |
| Monitoring Tag chưa gỡ | BLOCKED | S3 | Không mua |
| Hack/exploit nghiêm trọng chưa xử lý | BLOCKED/EXCLUDE | S3–S4 | Không mua |
| Mapping token/contract không chắc | BLOCKED | S3 | Không chấm execution |
| Unlock 7D >1% circulating | BLOCKED | S3 | Không mua |
| Unlock 30D >3% circulating | WATCH_RISK; BLOCKED khi vào cửa sổ 7D | S2–S3 | Không mua ngay |
| Unlock 90D >8% circulating | WATCH_RISK hoặc EXCLUDE tùy allocation | S2–S4 | Hạ mạnh |
| Circulating <15% | BLOCKED | S3 | Không mua chính |
| Circulating 15–25% | WATCH_RISK | S2 | Hạ Quality/tỷ trọng |
| FDV/MC >5 + unlock chưa rõ | EXCLUDE | S4 | Không mua |
| Fake Volume Risk HIGH | BLOCKED cho execution | S3 | Không BUY_SETUP |
| Tổng Spot volume <10M | WATCH_RISK/EXCLUDE nếu quá mỏng | S2–S4 | Không mua ngay |
| Spread >0.50% hoặc depth/slippage không đạt | WATCH_RISK/BLOCKED | S2–S3 | Không mua chính |
| Orderbook không live | REVIEW/BLOCKED cho execution | S2–S3 | Không BUY_SETUP |
| Team/treasury transfer bất thường | BLOCKED | S3 | Chờ giải thích |
| Data conflict nghiêm trọng | BLOCKED | S3 | Không kết luận |
| Overhead Supply High | WATCH_RISK | S2 | Không Top 3 |
| Narrative chết + product yếu | WATCH_RISK/EXCLUDE | S2–S4 | Không nhóm mua chính |
| D1 downtrend rõ | WATCH_RISK | S2 | WATCH_ONLY |
| CHASE/pump nóng | WATCH_RISK tạm thời | S2 | WAIT_RETEST |

Khi nhiều điều kiện đồng thời:
- Chọn trạng thái nghiêm trọng nhất.
- Ghi tất cả `risk_code`.
- Không gộp mất nguyên nhân.
- Một rủi ro đã đủ EXCLUDE thì không cần cộng thêm điểm phạt để “giải thích” EXCLUDE.

---


## 6A. Data Unknown không tự động là Blacklist
- Thiếu dữ liệu không đồng nghĩa coin gian lận hoặc rủi ro cấu trúc.
- `UNKNOWN/STALE` thông thường tạo `REVIEW`, hạ Confidence và chặn BUY_SETUP nếu thuộc nhóm critical.
- Chỉ chuyển `BLOCKED` khi Hard Rule yêu cầu hoặc dữ liệu mâu thuẫn có thể gây quyết định sai nghiêm trọng.
- Không dùng Risk Register để che lỗi quy trình của báo cáo. Ví dụ gắn sai `FULL_SCAN` là lỗi Scan Integrity, không phải rủi ro của coin.
- Một coin tốt nhưng chưa xác minh orderbook/unlock phải ghi `REVIEW — DATA INCOMPLETE`, không gọi là coin xấu.

## 7. Quy tắc theo từng nhóm rủi ro

### 7.1. Listing, Monitoring Tag và delisting
Bắt buộc kiểm tra:
- Trang spot pair hiện tại.
- Announcement chính thức của Binance.
- Monitoring Tag/Seed Tag/cảnh báo hiện hành.
- Deposit/withdrawal status nếu có sự kiện.

Quy tắc:
- Delist đã xác nhận: `EXCLUDE`.
- Monitoring Tag hiện hành: `BLOCKED` khỏi nhóm mua chính.
- Chỉ có cảnh báo cũ nhưng chưa xác minh: `REVIEW`, không tự động EXCLUDE.
- Sau khi tag được gỡ, vẫn phải kiểm tra thanh khoản, orderbook và 2–4 nến 4H trước khi `CLEARED` cho execution.

### 7.2. Security incident
Bắt buộc lấy:
- Thời điểm sự cố.
- Thiệt hại và phạm vi ảnh hưởng.
- Chain/contract/module bị ảnh hưởng.
- Có pause, rollback, reimbursement hoặc governance action hay không.
- Audit/post-mortem chính thức.
- Tình trạng sản phẩm sau khắc phục.

`EXCLUDE` khi:
- Mất quyền kiểm soát kéo dài.
- Team che giấu hoặc thông tin sai lệch nghiêm trọng.
- Tokenomics hoặc tài sản bảo chứng bị phá vỡ.
- Không có phương án khôi phục đáng tin.

`BLOCKED` khi:
- Đang điều tra/khắc phục.
- Chưa xác nhận hết lỗ hổng.
- Deposit/withdrawal hoặc protocol chưa hoạt động bình thường.

Điều kiện gỡ tối thiểu:
- Có post-mortem hoặc thông báo chính thức.
- Lỗ hổng đã vá hoặc phạm vi ảnh hưởng được cô lập.
- Sản phẩm hoạt động ổn định.
- Không còn dòng tiền bất thường liên quan.
- Tối thiểu 2–4 nến 4H sau khi giao dịch bình thường trở lại; sự cố lớn có thể cần thời gian dài hơn.

### 7.3. Unlock và dilution
Bắt buộc kiểm tra:
- 7D/30D/90D.
- % circulating, không chỉ % max supply.
- USD value.
- Unlock/value so với volume.
- Cliff/linear.
- Allocation.
- Nguồn và Confidence.

Quy tắc:
- 7D >1% circulating: `BLOCKED`.
- 30D >3%: `WATCH_RISK`; không mua ngay; khi sự kiện vào 7D chuyển `BLOCKED`.
- 90D >8%: `WATCH_RISK` mạnh; có thể `EXCLUDE` nếu cliff team/private lớn và thanh khoản không đủ hấp thụ.
- Source conflict hoặc mapping không chắc: `BLOCKED`.
- Coin gần hết unlock chỉ được `CLEARED` khỏi rủi ro dilution khi:
  - Không còn cliff lớn.
  - Inflation/emission thấp hoặc giảm.
  - Treasury/holder concentration chấp nhận được.
  - Dữ liệu từ nguồn chính khớp nhau.

Sau unlock lớn:
- Không tự động gỡ ngay khi thời gian sự kiện đã qua.
- Kiểm tra exchange inflow, volume, spread, depth và phản ứng giá.
- Tối thiểu 2–4 nến 4H xác nhận hấp thụ; cliff lớn có thể cần 3–14 ngày tùy thanh khoản.

### 7.4. Fake volume và thanh khoản
Bắt buộc kiểm tra:
- Tổng volume và Binance volume.
- Binance volume/tổng volume.
- Orderbook depth ±0.5%/±1%.
- Spread.
- Slippage cho 5M/10M/25M VND.
- Phân bổ volume theo sàn.
- Giá lệch giữa sàn.

`Fake Volume Risk HIGH` khi có nhiều dấu hiệu đồng thời:
- Volume báo cáo cao nhưng Binance volume thấp bất thường.
- Depth rất mỏng so với volume.
- Volume tập trung ở sàn ít uy tín.
- Wick dài, wash-like pattern hoặc giá lệch đáng kể.
- Volume tăng mạnh nhưng depth không tăng.

Hành động:
- HIGH: `BLOCKED` cho BUY_SETUP.
- MEDIUM: `WATCH_RISK`, giảm tỷ trọng và Confidence.
- LOW: không có nghĩa thanh khoản đã đạt; vẫn phải kiểm tra volume/spread/depth.

Điều kiện gỡ:
- Binance volume và orderbook tương xứng.
- Spread/depth ổn định trong nhiều lần kiểm tra.
- Không còn lệch giá bất thường.
- Structural volume phục hồi, không chỉ một nến pump.

### 7.5. Holder, treasury và MM risk
Không kết luận từ danh sách holder thô.

Bắt buộc loại hoặc gắn nhãn:
- Ví sàn.
- Burn wallet.
- Bridge/escrow.
- Staking contract.
- Treasury đã công khai.

`BLOCKED` khi:
- Ví team/treasury chuyển lượng lớn lên sàn mà chưa có giải thích hợp lý.
- Quyền mint/admin thay đổi bất thường.
- Treasury bán hoặc chuyển token làm thay đổi rõ luận điểm supply.

`WATCH_RISK` khi:
- Holder concentration cao nhưng chưa có hành vi bán.
- MM Risk HIGH nhưng không có bằng chứng gian lận.
- Wick/depth bất thường cần quan sát thêm.

Điều kiện gỡ:
- Có giải thích chính thức khớp với dữ liệu on-chain.
- Không có tiếp diễn exchange inflow bất thường.
- Orderbook và giá ổn định sau sự kiện.
- Confidence ít nhất MEDIUM.

### 7.6. Product, usage và narrative
Không EXCLUDE chỉ vì TVL/users giảm ngắn hạn.

`WATCH_RISK` khi:
- TVL/users/fees/revenue giảm nhiều kỳ liên tiếp.
- Usage chủ yếu do incentive.
- Roadmap trì hoãn kéo dài.
- Catalyst chưa chính thức.

`EXCLUDE` hoặc Quality cap nghiêm ngặt khi:
- Sản phẩm ngừng hoạt động.
- Dự án bị bỏ.
- Không còn bằng chứng usage/economics thực.
- Narrative chết đồng thời product yếu và team không thực thi.

Điều kiện gỡ:
- Có metric chính thức mới chứng minh phục hồi.
- Product hoạt động lại.
- Users/economic activity phục hồi đủ nhiều kỳ, không chỉ spike một ngày.
- Catalyst đã thành thông tin chính thức và có tác động thực.

### 7.7. Dữ liệu conflict và mapping
`BLOCKED` ngay khi xung đột ảnh hưởng đến:
- Đúng token/contract.
- MC/FDV/supply.
- Unlock.
- Giá tham chiếu.
- Binance pair.

Quy trình xử lý:
1. Xác minh tên dự án, chain, contract và project slug.
2. So khớp nguồn chính thức với Binance và nguồn dữ liệu thị trường.
3. Không dùng ticker đơn độc.
4. Ghi rõ điểm nào đang mâu thuẫn.
5. Chỉ `CLEARED` khi mapping thống nhất.

---


### 7.8. Protocol–Token Separation trong Risk Register
- `PRD-07` hoặc `DAT-09` áp dụng khi giao thức có hoạt động nhưng token value capture yếu/chưa rõ.
- Không dùng protocol TVL/revenue để gỡ `TOK-11` nếu token không nhận giá trị.
- Nếu value capture chưa rõ: `REVIEW`, Quality PROVISIONAL; không mặc định BLOCKED.
- Nếu xác minh token có net value leakage, emission cao hoặc governance hình thức: `WATCH_RISK` hoặc hạ Quality theo rubric.

## 8. Danh sách khởi tạo V8.1
Danh sách này được kế thừa từ V7.1 để nhắc AI kiểm tra, **không phải trạng thái live và không phải kết luận vĩnh viễn**.

Mọi mục dưới đây phải bắt đầu bằng `REVIEW` nếu chưa được xác minh trong ngày quét.

| Ticker | Trạng thái khởi tạo | Risk code gợi ý | Lý do lịch sử cần kiểm tra lại | Yêu cầu trước khi nâng hành động |
|---|---|---|---|---|
| WIF | REVIEW | LST-02 | Từng được đưa vào nhóm cần kiểm tra Monitoring Tag | Xác minh tag hiện hành trên Binance, pair, orderbook và announcement |
| TIA | REVIEW | TOK-01/TOK-02/TOK-03 | Lịch unlock dày trong các giai đoạn trước | Tính lại unlock 7D/30D/90D theo % circulating và allocation |
| ONDO | REVIEW | TOK-06/TOK-04 | Circulating/vesting từng là rủi ro đáng chú ý | Xác minh circulating, FDV/MC, cliff team/private và value capture |
| ARB | REVIEW | TOK-02/TOK-07 | Unlock định kỳ và FDV từng cao | Tính lại unlock, inflation, FDV/MC và adoption/value capture |
| SUI | REVIEW | TOK-02/TOK-07 | Monthly unlock và FDV từng cần theo dõi | Xác minh lịch unlock, circulating và khả năng hấp thụ của volume |
| STRK | REVIEW | TOK-02/TOK-04 | Vesting/team-private supply từng gây áp lực | Xác minh cliff/linear unlock, allocation và structural liquidity |
| APT | REVIEW | TOK-02/TOK-07 | Unlock định kỳ từng là rủi ro | Xác minh unlock 7D/30D/90D, FDV/MC và product metrics |

Quy tắc sử dụng danh sách khởi tạo:
- Không được ghi WIF là EXCLUDE hoặc TIA là BLOCKED chỉ dựa vào file này.
- Phải cập nhật trạng thái bằng dữ liệu hiện hành.
- Nếu không truy cập được nguồn cần thiết, giữ `REVIEW` và không gọi BUY_SETUP.
- Có thể xóa một mục khỏi danh sách khởi tạo ở phiên bản sau nếu đã `CLEARED` ổn định và không còn lý do theo dõi đặc biệt.

---

## 9. Điều kiện thêm mới vào Risk Register
Tự động tạo record khi phát hiện một trong các điều kiện:
- Monitoring Tag, delist, suspend, deposit/withdrawal freeze.
- Hack/exploit/bridge issue.
- Migration/rebrand/token swap chưa rõ.
- Lawsuit/regulatory action nghiêm trọng.
- Team dump, treasury transfer hoặc exchange inflow bất thường.
- Unlock conflict hoặc vượt ngưỡng V8.1.
- Price/MC/FDV/supply/mapping conflict.
- Fake Volume Risk HIGH.
- Orderbook quá mỏng hoặc structural liquidity không đạt.
- Circulating thấp/FDV cao vượt ngưỡng.
- Holder/MM risk cao.
- Product ngừng hoạt động, usage/economics suy giảm kéo dài.
- Overhead Supply cực cao kèm narrative/product yếu.
- Dữ liệu execution quan trọng không thể xác minh qua nhiều lần quét.

Không thêm mới chỉ vì:
- Giá giảm mạnh.
- RSI thấp.
- Coin không tăng cùng thị trường trong một vài ngày.
- Có ý kiến tiêu cực trên mạng xã hội nhưng không có bằng chứng.
- Một ví lớn chuyển token nhưng chưa xác định đó là ví sàn, custody, bridge hoặc treasury.

---

## 10. Cấu trúc record bắt buộc
Mỗi mục trong Risk Register phải có:

| Trường | Bắt buộc | Mô tả |
|---|:---:|---|
| `ticker` | Có | Ticker chuẩn |
| `project_name` | Có | Tên dự án |
| `chain_contract` | Khi cần | Chain + contract để tránh trùng ticker |
| `status` | Có | REVIEW/WATCH_RISK/BLOCKED/EXCLUDE/CLEARED |
| `severity` | Có | S0–S4 |
| `risk_codes` | Có | Một hoặc nhiều mã rủi ro |
| `reason` | Có | Mô tả ngắn, kiểm chứng được |
| `evidence` | Có | Dữ liệu/sự kiện hỗ trợ |
| `source_primary` | Có | Nguồn chính |
| `source_secondary` | Khi cần | Nguồn đối chiếu |
| `verified_at` | Có | Ngày giờ + múi giờ |
| `data_freshness` | Có | LIVE/FRESH/STALE |
| `confidence` | Có | HIGH/MEDIUM/LOW |
| `execution_effect` | Có | Không mua/không Top 3/giảm tỷ trọng/... |
| `score_effect` | Có | Nhóm điểm/hard cap bị ảnh hưởng |
| `clear_conditions` | Có | Điều kiện gỡ cụ thể |
| `next_review_at` | Có | Thời điểm xác minh lại |
| `history` | Có | Nhật ký thay đổi trạng thái |

Mẫu record:

```yaml
ticker: ABC
project_name: Example Protocol
chain_contract: Ethereum / 0x...
status: BLOCKED
severity: S3
risk_codes: [TOK-01, DAT-05]
reason: Unlock 7D vượt 1% circulating và hai nguồn đang mâu thuẫn.
evidence:
  unlock_7d_pct_circulating: 1.35
  allocation: private
  source_conflict: true
source_primary: Tokenomist
source_secondary: Official tokenomics / CoinGecko Unlocks
verified_at: 2026-08-05T21:30:00+07:00
data_freshness: FRESH
confidence: MEDIUM
execution_effect: Không BUY_SETUP, không BUY NOW, không Top 3.
score_effect: Tokenomics bị hạ; Opportunity không được dùng để vượt BLOCKED.
clear_conditions:
  - Mapping contract thống nhất.
  - Hai nguồn unlock khớp nhau.
  - Sự kiện unlock đã qua và được hấp thụ.
  - Có tối thiểu 2–4 nến 4H xác nhận.
next_review_at: 2026-08-06T08:00:00+07:00
history:
  - 2026-08-05: Created as BLOCKED.
```

---

## 11. Freshness và lịch xác minh lại

| Nhóm rủi ro | Freshness tối đa cho FULL_SCAN | Trước BUY NOW |
|---|---:|---:|
| Listing/Monitoring/Delist | Trong ngày quét | Xác minh lại ngay trước lệnh |
| Security incident | Trong ngày quét | Xác minh lại trước lệnh |
| Unlock 7D/30D/90D | Trong ngày quét | Xác minh lại trước lệnh |
| Orderbook/spread/depth | <=60 phút | Live hoặc <=5 phút |
| Fake volume/volume distribution | <=6 giờ | <=60 phút |
| Holder/treasury transfer | <=24 giờ | Xác minh lại nếu có sự kiện |
| MC/FDV/circulating | <=24 giờ | <=6 giờ nếu giá biến động mạnh |
| Product metrics | Theo cadence chính thức, ưu tiên <=30 ngày | Không cần live |
| Legal/governance | Trong ngày quét nếu có sự kiện | Xác minh lại trước lệnh |

Nếu quá freshness:
- Chuyển về `REVIEW` hoặc hạ Confidence.
- Không giữ `CLEARED` cho execution chỉ dựa trên lần xác minh cũ.
- Không tự động chuyển thành BLOCKED nếu chưa có dấu hiệu mới; phải ghi rõ `STALE`.

---

## 12. Điều kiện gỡ cảnh báo theo nhóm

### 12.1. Listing/Monitoring
- Binance hoặc sàn chính thức xác nhận tag/cảnh báo đã gỡ.
- Pair hoạt động bình thường.
- Deposit/withdrawal bình thường nếu liên quan.
- Orderbook và volume phục hồi.
- Có ít nhất 2–4 nến 4H xác nhận sau khi giao dịch bình thường.

### 12.2. Unlock
- Sự kiện lớn đã qua.
- Không còn conflict nguồn.
- Exchange inflow không bất thường.
- Price/volume/orderbook cho thấy hấp thụ chấp nhận được.
- Lịch 7D/30D/90D mới không vượt Hard Rule.

### 12.3. Security
- Có thông báo chính thức/post-mortem.
- Lỗ hổng đã vá hoặc module bị cô lập.
- Protocol/sản phẩm hoạt động ổn định.
- Không còn dòng tiền bất thường.
- Không phát sinh sự cố lặp lại trong cửa sổ quan sát phù hợp.

### 12.4. Liquidity/Fake Volume
- Binance volume/tổng volume hợp lý hơn.
- Spread/depth/slippage đạt ngưỡng.
- Volume và depth tăng tương xứng.
- Không còn lệch giá bất thường giữa sàn.
- Kết quả ổn định qua nhiều lần kiểm tra, không chỉ một thời điểm.

### 12.5. Holder/Treasury/MM
- Ví đã được nhận diện đúng.
- Transfer có giải thích chính thức và khớp on-chain.
- Không tiếp tục exchange inflow bất thường.
- Market structure ổn định lại.
- Confidence ít nhất MEDIUM.

### 12.6. Product/Team/Governance
- Sản phẩm hoạt động lại hoặc metric phục hồi.
- Team có cập nhật chính thức và thực thi được kiểm chứng.
- Governance/legal issue đã được giải quyết hoặc tác động được xác định rõ.
- Luận điểm đầu tư không còn phụ thuộc vào tin đồn.

---

## 13. Quy trình quét blacklist hằng ngày

### Bước 1 — Đọc danh sách hiện tại
- Tải tất cả record `REVIEW`, `WATCH_RISK`, `BLOCKED`, `EXCLUDE` và `CLEARED` gần đây.
- Xác định record đã stale.

### Bước 2 — Xác minh listing/security
- Kiểm tra Binance Spot pair.
- Kiểm tra Monitoring Tag, delist, suspension.
- Kiểm tra security incident và announcement mới.

### Bước 3 — Xác minh tokenomics
- Map đúng token/contract.
- Tính unlock 7D/30D/90D.
- Kiểm tra FDV/MC, circulating, inflation và allocation.

### Bước 4 — Xác minh thanh khoản
- Tổng volume.
- Binance volume.
- Spread/depth/slippage.
- Fake Volume Risk.

### Bước 5 — Xác minh holder/treasury/MM
- Chỉ thực hiện khi có dữ liệu đủ tin cậy hoặc dấu hiệu bất thường.
- Không kết luận từ holder list chưa gắn nhãn.

### Bước 6 — Cập nhật trạng thái
- Áp dụng trạng thái nghiêm trọng nhất.
- Ghi `verified_at`, source, confidence và next review.
- Ghi rõ thay đổi so với lần trước.

### Bước 7 — Đồng bộ execution
- BLOCKED/EXCLUDE: không Top 3, không BUY_SETUP.
- WATCH_RISK: hạ hành động/tỷ trọng theo đúng risk code.
- REVIEW: không kết luận an toàn nếu dữ liệu execution chưa đủ.
- CLEARED: quay lại checklist đầy đủ; không tự động BUY.

---

## 14. Quy tắc tích hợp với Quality, Entry và Opportunity Score

### 14.1. Không chấm điểm bù Hard Rule
Ví dụ:
- Product 24/24 không thể bù unlock 7D >1%.
- Entry 90/100 không thể bù orderbook không live.
- Quality AA không thể bù security incident chưa xử lý.

### 14.2. Tránh phạt trùng
- Nếu `TOK-01` đã BLOCKED, vẫn chấm Tokenomics theo dữ liệu thực nhưng không trừ thêm điểm tùy ý ngoài rubric/hard cap.
- Nếu `LIQ-07` Fake Volume Risk HIGH, áp hard cap và execution block theo checklist; không tự thêm penalty không được định nghĩa.
- Nếu coin EXCLUDE do không có Binance Spot, không cần chấm Entry đầy đủ.

### 14.3. Cách ghi trong báo cáo
Mỗi coin có rủi ro phải hiển thị:
- Blacklist Status.
- Severity.
- Risk Codes.
- Block reason.
- Điều kiện gỡ.
- Thời điểm xác minh.
- Confidence.

Không được chỉ ghi chung chung “rủi ro cao”.

---


## 14A. Risk Register và Score Status
Mỗi record liên quan dữ liệu phải ghi thêm:
- Data status: PASS/UNKNOWN/CONFLICT/STALE/N/A.
- Score impact: FINAL → PROVISIONAL/RANGE/NOT_SCORED.
- Scan mode impact: có buộc hạ FULL_SCAN_EXECUTION hay không.

Quy tắc:
- `DAT-10` cấm dùng dữ liệu recap/stale để cấp execution.
- `DAT-09` buộc tách Protocol Quality và Token Value Capture trong báo cáo.
- `LIQ-09` làm Entry tối đa PROVISIONAL; nếu đồng thời unlock/RR thiếu thì Entry RANGE/NOT_SCORED.

## 15. Quy tắc xử lý thay đổi trạng thái

### 15.1. Nâng mức rủi ro
Ví dụ:
- REVIEW → WATCH_RISK khi xác minh FDV/MC cao.
- WATCH_RISK → BLOCKED khi unlock vào cửa sổ 7D.
- BLOCKED → EXCLUDE khi delist được xác nhận hoặc sự cố trở thành rủi ro cấu trúc.

Bắt buộc ghi:
- Dữ liệu mới.
- Nguồn.
- Thời điểm.
- Tác động lên execution.

### 15.2. Hạ mức rủi ro
Ví dụ:
- BLOCKED → WATCH_RISK sau khi sự kiện qua nhưng cần quan sát.
- WATCH_RISK → CLEARED khi các điều kiện gỡ đều đạt.
- EXCLUDE → REVIEW chỉ khi có thay đổi cấu trúc lớn và bằng chứng chính thức.

Không chuyển thẳng BLOCKED → CLEARED sau sự kiện lớn nếu chưa qua cửa sổ quan sát.

### 15.3. Lưu lịch sử
Không xóa record cũ. Chuyển trạng thái và lưu history để:
- Giải thích vì sao thứ hạng thay đổi.
- Tránh lặp lại sai sót.
- Phân tích khả năng hấp thụ unlock/sự cố trong tương lai.

---

## 16. Mẫu bảng Risk Register dùng trong báo cáo

| Ticker | Status | Severity | Risk codes | Lý do | Verified at | Confidence | Execution | Clear condition |
|---|---|---:|---|---|---|---|---|---|
| ABC | BLOCKED | S3 | TOK-01 | Unlock 7D >1% circulating | YYYY-MM-DD HH:mm TZ | HIGH | Không mua | Qua unlock + hấp thụ 2–4 nến 4H |
| XYZ | WATCH_RISK | S2 | LIQ-02, LIQ-05 | Binance volume thấp, depth mỏng | YYYY-MM-DD HH:mm TZ | MEDIUM | Vị thế nhỏ/Watch | Volume và depth phục hồi |
| DEF | REVIEW | S1 | DAT-06 | Dữ liệu cũ | YYYY-MM-DD HH:mm TZ | LOW | Chưa kết luận | Xác minh lại nguồn live |

---

## 17. Các lỗi AI bị cấm
- Dùng blacklist cũ như dữ liệu hiện tại.
- Gọi coin “an toàn” vì đã hết unlock.
- Gọi coin “scam” khi chưa có bằng chứng.
- Nhầm ticker/contract.
- Kết luận holder concentration trước khi loại ví sàn/burn/bridge.
- Dùng tổng volume để bỏ qua Binance volume và orderbook.
- Gỡ BLOCKED chỉ vì giá tăng.
- Đưa coin BLOCKED/EXCLUDE vào Top 3.
- Không ghi ngày xác minh.
- Không ghi nguồn và điều kiện gỡ.
- Đánh giá coin tốt/xấu chỉ dựa trên một rủi ro tạm thời.
- Bịa lý do, lịch unlock, ví team hoặc sự kiện.

---

## 18. Câu lệnh sử dụng
- `Quét lại blacklist V8.1 trước khi chọn Top 3.`
- `Xác minh Monitoring Tag, delist, security, unlock và orderbook của toàn bộ shortlist.`
- `Cập nhật trạng thái REVIEW/WATCH_RISK/BLOCKED/EXCLUDE/CLEARED và nêu điều kiện gỡ.`
- `Không dùng trạng thái blacklist cũ nếu chưa xác minh trong ngày quét.`
- `Quét riêng unlock 7D/30D/90D và fake volume của các coin tôi theo dõi.`
- `So sánh blacklist risk của RUNE, SONIC và AERO; không kết luận mua nếu thiếu dữ liệu live.`

---

## 19. Bảo trì file
- Thêm coin mới: bổ sung vào Risk Register, không chỉ thêm ticker trần.
- Cập nhật ngưỡng Hard Rule: sửa đồng bộ `00_CONTEXT_V8_1.md`, `01_CHECKLIST_V8_1.md` và file này.
- Cập nhật cách trình bày: sửa `03_OUTPUT_V8_1.md`.
- Cập nhật rubric chấm điểm: sửa `04_PROJECT_SCORING_GUIDE_V8_1.md`.
- Không lưu trạng thái live lâu dài trong phần “Danh sách khởi tạo” mà không có `verified_at`.
- Khi phát hành V8.x, ghi rõ thay đổi và giữ lịch sử phiên bản.

---

## 20. Kết luận vận hành
1. Blacklist V8.1 là **Risk Register động**, không phải danh sách vĩnh viễn.
2. Hard Rule thắng mọi điểm số.
3. `BLOCKED` là chặn tạm thời; `EXCLUDE` là loại cấu trúc.
4. Mỗi record phải có nguồn, thời điểm, confidence và điều kiện gỡ.
5. Unlock hết chỉ giảm dilution risk; không tự động giảm holder/MM risk.
6. Coin không nằm trong blacklist vẫn phải qua toàn bộ checklist.
7. Không có dữ liệu fresh thì giữ `REVIEW` hoặc hạ Confidence, không được đoán.

## 21. Phiên bản
**COIN SPOT AI SPECIFICATION V8.1 PROFESSIONAL — EXECUTION INTEGRITY**

Blacklist & Risk Register chính thức, đồng bộ với Scan Mode, Score Status, Data Coverage và Hard Rule của bộ V8.1.
