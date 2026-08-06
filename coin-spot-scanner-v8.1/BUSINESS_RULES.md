# BUSINESS_RULES.md

## Evidence Convention

- **Confirmed: User/Document** means the V8.1 specification in `docs/specification/` or the approved implementation plan states the rule.
- **Enforced: Backend/Database** means the named current source enforces it. Enforcement in the frontend alone is not sufficient.
- **Covered: Test** is limited to the four tests in `backend/scanner/tests.py` unless a rule states otherwise.
- A missing status is not evidence of completion. The current baseline has no runtime/full-suite verification recorded by this context pass.

Tài liệu này mô tả **rule đang tồn tại trong source 0.1.0**, không thay thế đặc tả đầy đủ trong `docs/specification/`.

# Core Business Rules

## Integrity invariants

### No fabricated BUY_SETUP

- Rule: A `BUY_SETUP` requires live orderbook, 4H kline, unlock, stop/invalidation, and RR evidence; `UNKNOWN` cannot be treated as `PASS`.
- Applies: every execution conclusion and report.
- Evidence: `docs/specification/README_V8_1.md`; `backend/rules/v8_1/defaults.json` locked rules; `ScanOrchestrator.step_scoring_validation()` and `_validation_gate()`.
- Status: Confirmed: User/Document; Enforced: Backend baseline; Covered: no direct regression test.
- Current implementation: unlock is deliberately `UNKNOWN`, stop/RR are `None`, so all candidates remain `WATCH_ONLY` and `buy_setup=0`.

### Full-scan accounting and score separation

- Rule: `FULL_SCAN` requires Universe Accounting; Hard Rules override scores; Quality, Entry, and Opportunity remain separate and score status must be explicit.
- Evidence: `docs/specification/00_CONTEXT_V8_1.md`; `defaults.json`; `Candidate` score/status fields; `_validation_gate()`.
- Status: Confirmed: User/Document; Enforced: partial baseline; Covered: no direct regression test.
- Gap: the baseline only calculates a `RANGE` Quality proxy and always validates its output as `FULL_SCAN_RESEARCH`.

## Quy trình sáu bước

Thứ tự cố định:

1. `UNIVERSE_SCAN`
2. `MARKET_REGIME`
3. `RESEARCH_SHORTLIST`
4. `EXECUTION_VERIFICATION`
5. `SCORING_VALIDATION`
6. `INVESTMENT_RESULTS`

Source: `backend/scanner/services.py` — `STEP_DEFINITIONS`.

Nếu request chạy một bước riêng, backend thêm toàn bộ prerequisite đến sequence của bước đó.

Source: `backend/scanner/tasks.py` — `create_scan_run()`.

## Không chạy đồng thời từ API start

Nếu tồn tại bất kỳ `ScanRun` ở trạng thái `QUEUED` hoặc `RUNNING`, endpoint start trả HTTP 409.

Source: `backend/scanner/views.py` — `ScanRunViewSet.start()`.

## Profile snapshot

Mỗi Scan Run lưu bản sao `profile.config` vào `profile_snapshot`; orchestrator đọc snapshot này thay vì đọc config live.

Source: `backend/scanner/tasks.py` — `create_scan_run()`.

# Conditions / Decisions

## Universe eligibility

Một coin được giữ lại khi logic hiện tại thỏa tất cả:

- Không bị `excluded_token()` loại.
- Có symbol base trong map Binance Spot/USDT nếu `require_binance_spot_usdt=true`.
- Market cap nằm trong `[market_cap_min_usd, market_cap_max_usd]`.
- Total volume không thấp hơn `liquidity.volume_min_usd`.

Source: `backend/scanner/orchestrator.py` — `step_universe_scan()`.

### Token exclusions đang implement

- Stablecoin: symbol thuộc `STABLE_SYMBOLS` hoặc tên chứa một số từ khóa stablecoin.
- Wrapped: symbol bắt đầu `W` và name bắt đầu `wrapped`.
- Leveraged: symbol kết thúc bằng `UP`, `DOWN`, `BULL`, `BEAR`.

Source: `backend/scanner/services.py` — `excluded_token()`.

`bridged`, `lst`, `tokenized_stock`, `index` có trong default config nhưng chưa có nhánh xử lý tương ứng trong function hiện tại.

## Binance Spot validity

Pair chỉ được map khi:

- `quoteAsset == USDT`.
- `status == TRADING`.
- Nếu Binance trả `permissions`, pair phải có `SPOT` trong permissions hoặc flattened permission sets.

Source: `backend/scanner/services.py` — `valid_binance_usdt_symbols()`.

## Market Regime baseline

Hệ thống kiểm tra bốn boolean:

- BTC D1 trên SMA20.
- BTC 4H trên SMA20.
- ETH D1 trên SMA20.
- ETH 4H trên SMA20.

Decision hiện tại:

- 4/4 positive → `THUẬN LỢI`.
- 2–3 positive → `TRUNG TÍNH`.
- 0–1 positive → `XẤU`.

Kết quả luôn `PROVISIONAL`, Confidence `MEDIUM`, completeness `5/9` và ghi thiếu ETH/BTC, TOTAL3/proxy, breadth MA20, alt volume 7D.

Source: `backend/scanner/orchestrator.py` — `step_market_regime()`.

## Research Shortlist

- Chọn tối đa `research_shortlist_count`.
- Sort theo `quality_score_high` giảm dần, sau đó `volume_24h_usd` giảm dần.
- Candidate được chuyển từ `RESEARCH_POOL` sang `RESEARCH_SHORTLIST` và rank lại từ 1.

Source: `backend/scanner/orchestrator.py` — `step_research_shortlist()`.

## Execution Verification

- Chọn tối đa `execution_verification_count` coin đầu shortlist.
- Lấy Binance depth, D1 và 4H.
- Lưu orderbook metrics và kline summaries.
- Unlock luôn `UNKNOWN` với reason “Chưa cấu hình adapter unlock đa nguồn”.
- Stop và RR là `None`.
- Entry status là `NOT_SCORED`; action là `WATCH_ONLY`.

Source: `backend/scanner/orchestrator.py` — `step_execution_verification()`.

## Baseline scoring/integrity decision

Trong bản hiện tại:

- Mọi candidate execution có `entry_status=NOT_SCORED`.
- `opportunity_status=NOT_SCORED`.
- `opportunity_score=None`.
- `action=WATCH_ONLY`.
- `buy_setup=0`.
- Capital plan: `usdt_pct=100`, `deployed_pct=0`.

Source: `backend/scanner/orchestrator.py` — `step_scoring_validation()`.

## Final executive decision

Output hiện luôn ghi:

- `should_buy=KHÔNG`.
- `CHƯA NÊN MUA SPOT — TIẾP TỤC GIỮ USDT.`
- `usdt_pct=100`.
- `buy_setup_count=0`.

Source: `backend/scanner/orchestrator.py` — `step_investment_results()`.

# Validation Rules

## Profile config

Serializer chặn save khi:

- Tổng `quality_weights` khác 100.
- Tổng `entry_weights` khác 100.
- Quality exponent + Entry exponent khác 1.
- MC min lớn hơn MC max.
- Execution Verification count lớn hơn Research Shortlist count.

Default profile không được đổi `config` hoặc `name` qua serializer.

Source: `backend/scanner/serializers.py` — `ChecklistProfileSerializer.validate_config()`, `validate()`.

## Scan Validation Gate

Gate hiện tại:

- Báo lỗi nếu không có `initial_count` trong counters.
- Báo lỗi nếu baseline có `buy_setup > 0`.
- Luôn trả `validated_mode=FULL_SCAN_RESEARCH`.
- Luôn cảnh báo Product/unlock evidence chưa hoàn thiện và Entry NOT_SCORED.

Source: `backend/scanner/orchestrator.py` — `_validation_gate()`.

# Calculation Rules

## SMA

SMA là trung bình `period` close cuối; không đủ số điểm thì trả `None`.

Source: `backend/scanner/services.py` — `sma()`.

## ATR14

True Range = max của:

- high - low.
- |high - previous close|.
- |low - previous close|.

ATR14 là trung bình 14 True Range cuối.

Source: `backend/scanner/services.py` — `true_range()`, `atr_from_klines()`.

## Spread/depth/slippage

- Mid = `(best_bid + best_ask) / 2`.
- Spread % = `(best_ask - best_bid) / mid × 100`.
- Depth cộng notional trong ±0.5% và ±1% quanh mid.
- Buy slippage mô phỏng ăn lần lượt asks cho quy mô VND quy đổi bằng `vnd_per_usd`.

Source: `backend/scanner/services.py` — `depth_metrics()`.

## Provisional Quality Range

Đây là proxy baseline, không phải Quality Score đầy đủ V8.1:

- Market cap fit subscore: 8 trong vùng min → preferred max, ngoài vùng là 6.
- Liquidity proxy: 8 nếu volume ≥ 2× basic; 7 nếu ≥ basic; còn lại 5.
- Tokenomics proxy: dựa FDV/MC với các mốc 1.5 và 2.5; không có FDV là 5.
- Base = `(market_fit×0.30 + liquidity×0.35 + tokenomics×0.35) × 10`.
- Low = max(35, base - 14).
- High = min(82, base + 3).
- Status lưu là `RANGE`.

Source: `backend/scanner/services.py` — `provisional_quality()`.

# State / Status Rules

## ScanRun

- `QUEUED`, `RUNNING`, `PAUSED`, `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `FAILED`, `CANCELLED`.

## ScanStepRun

- `WAITING`, `RUNNING`, `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `FAILED`, `STALE`, `SKIPPED`.

## Score status trong Candidate

String mặc định:

- Quality: `NOT_SCORED`, chuyển thành `RANGE` ở Universe step.
- Entry: `NOT_SCORED`.
- Opportunity: `NOT_SCORED`.

## Total Scan Policy

Các giá trị được lưu:

- `ALWAYS_REFRESH`.
- `REFRESH_IF_STALE`.
- `USE_LATEST_VALID`.

Status: **Chưa được enforcement đầy đủ**. Orchestrator hiện chạy handler mỗi lần step được requested và chưa dùng cache/freshness theo policy.

# Important Edge Cases

- CoinGecko/Binance lỗi làm step fail và toàn run fail; không có fallback source.
- Binance symbol mapping chỉ dùng base symbol, chưa xác minh chain/contract.
- Nếu depth không có bids/asks, `depth_metrics()` trả `{status: UNKNOWN}`.
- Một execution candidate lỗi riêng chỉ ghi `execution_error`; loop tiếp tục với coin khác.
- Universe step xóa toàn bộ Candidate của run trước khi tạo lại.
- Step bị loại khỏi requested steps được đánh `SKIPPED`.

# Data Meaning

- `profile_snapshot`: config bất biến của lần scan.
- `counters`: Universe Accounting và số lượng từng stage.
- `results`: Market Regime, ranking và executive decision.
- `validation`: output Validation Gate.
- `Candidate.stage`: `RESEARCH_POOL`, `RESEARCH_SHORTLIST`, `EXECUTION_VERIFICATION` trong source hiện tại.
- `risk_codes`: baseline dùng `DAT-07`, `DAT-09`; chưa có Risk Register model đầy đủ.
- `details`: raw market snapshot, proxy evidence và execution data.
