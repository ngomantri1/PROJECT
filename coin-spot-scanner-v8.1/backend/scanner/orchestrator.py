from __future__ import annotations
from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import Candidate, Notification, ScanRun, ScanStepRun, StepSchedule
from .services import (
    DataSourceError, PublicMarketClient, STEP_DEFINITIONS, depth_metrics,
    excluded_token, kline_summary, provisional_quality, valid_binance_usdt_symbols,
)

class ScanOrchestrator:
    def __init__(self, run: ScanRun):
        self.run = run
        self.config = run.profile_snapshot
        self.client = PublicMarketClient()

    def execute(self):
        self.run.status = ScanRun.STATUS_RUNNING
        self.run.started_at = timezone.now()
        self.run.save(update_fields=["status","started_at"])
        warnings = []
        try:
            requested = self.run.requested_steps or [key for _, key, _ in STEP_DEFINITIONS]
            for sequence, key, _ in STEP_DEFINITIONS:
                if key not in requested:
                    self._skip_step(key)
                    continue
                self._run_step(sequence, key)
            validation = self._validation_gate()
            self.run.validation = validation
            self.run.mode_validated = validation["validated_mode"]
            if validation["errors"]:
                self.run.status = ScanRun.STATUS_WARNINGS
                warnings.extend(validation["errors"])
            else:
                self.run.status = ScanRun.STATUS_COMPLETED
            self.run.progress = 100
            self.run.current_step = ""
            self.run.finished_at = timezone.now()
            self.run.save()
            Notification.objects.create(level="SUCCESS" if not warnings else "WARNING", title="Quét đã hoàn tất", message=validation["summary"], scan_run=self.run)
        except Exception as exc:
            self.run.status = ScanRun.STATUS_FAILED
            self.run.error_message = str(exc)
            self.run.finished_at = timezone.now()
            self.run.save(update_fields=["status","error_message","finished_at"])
            Notification.objects.create(level="ERROR", title="Quét thất bại", message=str(exc), scan_run=self.run)
            raise

    def _step(self, key):
        return self.run.steps.get(step_key=key)

    def _skip_step(self, key):
        step = self._step(key)
        step.status = ScanStepRun.STATUS_SKIPPED
        step.progress = 100
        step.message = "Không thuộc phạm vi lần chạy này"
        step.finished_at = timezone.now()
        step.save()

    def _run_step(self, sequence, key):
        step = self._step(key)
        step.status = ScanStepRun.STATUS_RUNNING
        step.progress = 5
        step.started_at = timezone.now()
        step.message = "Đang thực hiện"
        step.save()
        self.run.current_step = key
        self.run.progress = int((sequence - 1) / 6 * 100)
        self.run.save(update_fields=["current_step","progress"])
        handler = getattr(self, f"step_{key.lower()}")
        try:
            payload, has_warning = handler(step)
            step.payload = payload
            step.status = ScanStepRun.STATUS_WARNINGS if has_warning else ScanStepRun.STATUS_COMPLETED
            step.message = payload.get("message", "Hoàn tất")
            step.progress = 100
            step.finished_at = timezone.now()
            step.save()
            schedule = StepSchedule.objects.filter(profile=self.run.profile, step_key=key).first()
            if schedule:
                schedule.last_run_at = timezone.now()
                schedule.next_run_at = timezone.now() + timedelta(minutes=schedule.interval_minutes)
                schedule.save(update_fields=["last_run_at","next_run_at"])
        except Exception as exc:
            step.status = ScanStepRun.STATUS_FAILED
            step.message = str(exc)[:300]
            step.finished_at = timezone.now()
            step.save()
            raise

    def step_universe_scan(self, step):
        cfg = self.config["universe"]
        markets = self.client.coingecko_markets(int(cfg["top_count"]))
        exchange_info = self.client.binance_exchange_info()
        binance = valid_binance_usdt_symbols(exchange_info)
        accounting = {"initial_count":len(markets),"binance_spot_eligible":0,"excluded_token_type":0,"excluded_market_cap":0,"failed_liquidity_prefilter":0,"research_pool":0}
        Candidate.objects.filter(scan_run=self.run).delete()
        created = []
        for row in markets:
            excluded, _reason = excluded_token(row, cfg)
            if excluded:
                accounting["excluded_token_type"] += 1
                continue
            symbol = str(row.get("symbol", "")).upper()
            if cfg.get("require_binance_spot_usdt") and symbol not in binance:
                continue
            accounting["binance_spot_eligible"] += 1
            mc = float(row.get("market_cap") or 0)
            if mc < cfg["market_cap_min_usd"] or mc > cfg["market_cap_max_usd"]:
                accounting["excluded_market_cap"] += 1
                continue
            vol = float(row.get("total_volume") or 0)
            if vol < self.config["liquidity"]["volume_min_usd"]:
                accounting["failed_liquidity_prefilter"] += 1
                continue
            low, high, evidence = provisional_quality(row, {**cfg, **self.config["liquidity"]})
            created.append(Candidate(
                scan_run=self.run, coingecko_id=row.get("id", ""), symbol=symbol, name=row.get("name", symbol),
                binance_pair=f"{symbol}USDT", stage="RESEARCH_POOL", rank=int(row.get("market_cap_rank") or 0),
                market_cap_usd=Decimal(str(mc)), fdv_usd=Decimal(str(row.get("fully_diluted_valuation") or 0)) if row.get("fully_diluted_valuation") else None,
                volume_24h_usd=Decimal(str(vol)), price_usd=Decimal(str(row.get("current_price") or 0)),
                quality_score_low=Decimal(str(low)), quality_score_high=Decimal(str(high)), quality_status="RANGE",
                action="WATCH_ONLY", risk_codes=["DAT-07","DAT-09"],
                details={"market_source":"CoinGecko","market_snapshot":row,"quality_evidence":evidence,"data_status":{"unlock":"UNKNOWN","product":"UNKNOWN","token_value_capture":"UNKNOWN"}},
            ))
        Candidate.objects.bulk_create(created, batch_size=200)
        accounting["research_pool"] = len(created)
        self.run.counters = {**self.run.counters, **accounting}
        self.run.save(update_fields=["counters"])
        return {"message":f"Đã tạo research pool gồm {len(created)} coin", "universe_accounting":accounting}, False

    def step_market_regime(self, step):
        btc_d1 = kline_summary(self.client.binance_klines("BTCUSDT", "1d"))
        btc_4h = kline_summary(self.client.binance_klines("BTCUSDT", "4h"))
        eth_d1 = kline_summary(self.client.binance_klines("ETHUSDT", "1d"))
        eth_4h = kline_summary(self.client.binance_klines("ETHUSDT", "4h"))
        global_data = self.client.coingecko_global()
        positive = sum([btc_d1["above_sma20"], btc_4h["above_sma20"], eth_d1["above_sma20"], eth_4h["above_sma20"]])
        regime = "THUẬN LỢI" if positive >= 4 else "TRUNG TÍNH" if positive >= 2 else "XẤU"
        payload = {"message":f"Market Regime: {regime} — PROVISIONAL", "regime":regime,"status":"PROVISIONAL","confidence":"MEDIUM","completeness":"5/9","btc_d1":btc_d1,"btc_4h":btc_4h,"eth_d1":eth_d1,"eth_4h":eth_4h,"btc_dominance":global_data.get("market_cap_percentage",{}).get("btc"),"missing":["ETH/BTC trend","TOTAL3/proxy","breadth MA20","alt volume 7D"]}
        results = dict(self.run.results)
        results["market_regime"] = payload
        self.run.results = results
        self.run.save(update_fields=["results"])
        return payload, True

    def step_research_shortlist(self, step):
        count = int(self.config["universe"]["research_shortlist_count"])
        qs = list(Candidate.objects.filter(scan_run=self.run, stage="RESEARCH_POOL").order_by("-quality_score_high", "-volume_24h_usd")[:count])
        for idx, c in enumerate(qs, 1):
            c.stage = "RESEARCH_SHORTLIST"
            c.rank = idx
            c.save(update_fields=["stage","rank"])
        self.run.counters = {**self.run.counters, "research_shortlist":len(qs)}
        self.run.save(update_fields=["counters"])
        return {"message":f"Đã chọn {len(qs)} coin vào Research Shortlist", "count":len(qs), "score_status":"RANGE"}, True

    def step_execution_verification(self, step):
        count = int(self.config["universe"]["execution_verification_count"])
        candidates = list(Candidate.objects.filter(scan_run=self.run, stage="RESEARCH_SHORTLIST").order_by("rank")[:count])
        verified = 0
        for candidate in candidates:
            details = dict(candidate.details)
            try:
                depth = depth_metrics(self.client.binance_depth(candidate.binance_pair), self.config["liquidity"]["order_sizes_vnd"], self.config["liquidity"]["vnd_per_usd"])
                d1 = kline_summary(self.client.binance_klines(candidate.binance_pair, "1d"))
                h4 = kline_summary(self.client.binance_klines(candidate.binance_pair, "4h"))
                details["execution"] = {"orderbook":depth,"d1":d1,"h4":h4,"unlock":{"status":"UNKNOWN","reason":"Chưa cấu hình adapter unlock đa nguồn"},"stop":None,"rr":None}
                candidate.stage = "EXECUTION_VERIFICATION"
                candidate.entry_status = "NOT_SCORED"
                candidate.action = "WATCH_ONLY"
                candidate.risk_codes = sorted(set(candidate.risk_codes + ["DAT-07"]))
                candidate.details = details
                candidate.save()
                verified += 1
            except DataSourceError as exc:
                details["execution_error"] = str(exc)
                candidate.details = details
                candidate.save(update_fields=["details"])
        self.run.counters = {**self.run.counters, "execution_verification":verified}
        self.run.save(update_fields=["counters"])
        return {"message":f"Đã kiểm tra market execution cho {verified}/{len(candidates)} coin; unlock vẫn UNKNOWN", "verified":verified,"critical_missing":["unlock_7d_30d_90d","stop","rr"]}, True

    def step_scoring_validation(self, step):
        candidates = Candidate.objects.filter(scan_run=self.run, stage="EXECUTION_VERIFICATION")
        for c in candidates:
            c.entry_status = "NOT_SCORED"
            c.opportunity_status = "NOT_SCORED"
            c.opportunity_score = None
            c.action = "WATCH_ONLY"
            c.save(update_fields=["entry_status","opportunity_status","opportunity_score","action"])
        self.run.counters = {**self.run.counters, "buy_setup":0}
        self.run.save(update_fields=["counters"])
        return {"message":"Validation Gate: BUY_SETUP = 0 vì thiếu unlock/stop/RR; không tạo dữ liệu giả", "buy_setup":0,"capital_plan":{"usdt_pct":100,"deployed_pct":0},"hard_rule_wins":True}, True

    def step_investment_results(self, step):
        rows = []
        for c in Candidate.objects.filter(scan_run=self.run, stage__in=["RESEARCH_SHORTLIST","EXECUTION_VERIFICATION"]).order_by("rank")[:15]:
            rows.append({"rank":c.rank,"symbol":c.symbol,"pair":c.binance_pair,"name":c.name,"market_cap_usd":float(c.market_cap_usd or 0),"volume_24h_usd":float(c.volume_24h_usd or 0),"quality_range":[float(c.quality_score_low or 0),float(c.quality_score_high or 0)],"quality_status":c.quality_status,"entry_status":c.entry_status,"opportunity_status":c.opportunity_status,"action":c.action,"risk_codes":c.risk_codes})
        results = dict(self.run.results)
        results["ranking"] = rows
        results["executive_decision"] = {"should_buy":"KHÔNG","statement":"CHƯA NÊN MUA SPOT — TIẾP TỤC GIỮ USDT.","usdt_pct":100,"buy_setup_count":0}
        self.run.results = results
        self.run.save(update_fields=["results"])
        return {"message":f"Đã tạo danh sách kết quả gồm {len(rows)} coin", "count":len(rows)}, True

    def _validation_gate(self):
        critical = ["orderbook_live", "kline_4h", "unlock_7d_30d_90d", "stop", "rr"]
        buy_setup = int(self.run.counters.get("buy_setup", 0))
        errors = []
        if not self.run.counters.get("initial_count"):
            errors.append("Universe Accounting chưa đầy đủ")
        if buy_setup > 0:
            errors.append("Baseline không cho phép BUY_SETUP khi unlock chưa được xác minh")
        return {"passed":not errors,"errors":errors,"warnings":["Product/unlock evidence chưa hoàn thiện","Entry Score NOT_SCORED"],"validated_mode":"FULL_SCAN_RESEARCH","summary":"Không có BUY_SETUP hợp lệ; giữ 100% USDT.","critical_fields":critical}
