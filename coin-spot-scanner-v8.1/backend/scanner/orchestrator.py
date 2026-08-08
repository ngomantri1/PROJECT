from __future__ import annotations
from datetime import timedelta, timezone as datetime_timezone
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import Candidate, MarketRegimeGlobalSnapshot, Notification, ScanRun, ScanStepRun, StepSchedule
from .market_regime import (
    analyze_breadth_and_volume, analyze_eth_btc, analyze_global, analyze_history, analyze_kline_group,
    analyze_coinpaprika_global, classify_regime, combine_timeframe_evidence, compute_completeness, evidence, freshness_limit, iso_time, parse_cmc_history, universe_hash,
)
from .services import (
    DataSourceError, PublicMarketClient, STEP_DEFINITIONS, depth_metrics,
    excluded_token, kline_summary, research_prefilter, valid_binance_usdt_symbols,
)
from .research import build_defillama_indexes, binance_ticker_map, build_research_evidence, match_defillama
from .unlock import UnlockEvidenceService
from .unlock.factory import build_unlock_providers

class ScanOrchestrator:
    STEP_MESSAGE_MAX_LENGTH = ScanStepRun._meta.get_field("message").max_length or 300

    def __init__(self, run: ScanRun):
        self.run = run
        self.config = run.profile_snapshot
        self.client = PublicMarketClient()
        self.unlock_service = UnlockEvidenceService(providers=build_unlock_providers())

    @classmethod
    def _compact_step_message(cls, message) -> str:
        """Keep the DB-facing step summary inside the ScanStepRun.message contract.

        Detailed provider/parser errors belong in step.payload/provider_status (JSON)
        or Notification.message (TextField), not in the bounded 300-char summary.
        """
        value = str(message or "")
        limit = int(cls.STEP_MESSAGE_MAX_LENGTH)
        if len(value) <= limit:
            return value
        if limit <= 1:
            return value[:limit]
        return value[: limit - 1].rstrip() + "…"

    def execute(self):
        self.run.status = ScanRun.STATUS_RUNNING
        self.run.started_at = timezone.now()
        self.run.save(update_fields=["status", "started_at"])
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

            final_state = validation["final_pipeline_state"]
            if final_state == "PARTIAL_COMPLETED":
                self.run.status = ScanRun.STATUS_PARTIAL
            elif final_state == "COMPLETED_WITH_WARNINGS":
                self.run.status = ScanRun.STATUS_WARNINGS
            else:
                self.run.status = ScanRun.STATUS_COMPLETED

            # progress là độ hoàn thành workflow 6 bước, không phải chỉ là việc
            # Celery đã dừng xử lý.  B4-only vì vậy kết thúc ở 67%, không giả 100%.
            self.run.progress = validation["workflow_progress_pct"]
            self.run.current_step = ""
            self.run.finished_at = timezone.now()
            self.run.save()

            level = "SUCCESS" if self.run.status == ScanRun.STATUS_COMPLETED else "WARNING"
            Notification.objects.create(
                level=level,
                title=self._final_notification_title(validation),
                message=validation["summary"],
                scan_run=self.run,
            )
        except Exception as exc:
            self.run.status = ScanRun.STATUS_FAILED
            self.run.error_message = str(exc)
            self.run.finished_at = timezone.now()
            self.run.save(update_fields=["status", "error_message", "finished_at"])
            Notification.objects.create(level="ERROR", title="Quét thất bại", message=str(exc), scan_run=self.run)
            raise
        finally:
            self.client.close()

    def _run_scope(self):
        all_steps = [key for _, key, _ in STEP_DEFINITIONS]
        scope = dict((self.run.results or {}).get("run_scope") or {})
        planned = list(self.run.requested_steps or all_steps)
        explicit = scope.get("explicit_requested_steps") or list(planned)
        prerequisites = scope.get("prerequisite_steps") or [key for key in planned if key not in explicit]
        return {
            "all_steps": all_steps,
            "explicit_requested_steps": explicit,
            "planned_steps": planned,
            "prerequisite_steps": prerequisites,
            "prerequisite_expanded": bool(prerequisites),
            "request_scope": "FULL_PIPELINE" if set(explicit) == set(all_steps) else "STEP_RUN",
        }

    def _lifecycle_snapshot(self):
        scope = self._run_scope()
        step_rows = list(self.run.steps.all().order_by("sequence"))
        completed_statuses = {ScanStepRun.STATUS_COMPLETED, ScanStepRun.STATUS_WARNINGS}
        completed = [row.step_key for row in step_rows if row.status in completed_statuses]
        warning_steps = [row.step_key for row in step_rows if row.status == ScanStepRun.STATUS_WARNINGS]
        skipped = [row.step_key for row in step_rows if row.status == ScanStepRun.STATUS_SKIPPED]
        failed = [row.step_key for row in step_rows if row.status == ScanStepRun.STATUS_FAILED]
        all_steps = scope["all_steps"]
        full_pipeline_completed = set(all_steps).issubset(set(completed))
        workflow_progress = round(len(completed) / len(all_steps) * 100) if all_steps else 100
        return {
            **scope,
            "completed_steps": completed,
            "warning_steps": warning_steps,
            "skipped_steps": skipped,
            "failed_steps": failed,
            "workflow_progress_pct": workflow_progress,
            "processing_progress_pct": 100,
            "full_pipeline_completed": full_pipeline_completed,
            "completion_scope": "FULL_PIPELINE" if full_pipeline_completed else "PARTIAL_PIPELINE",
        }

    def _final_notification_title(self, validation):
        scope = validation.get("request_scope")
        explicit = validation.get("explicit_requested_steps") or []
        skipped = validation.get("skipped_steps") or []
        has_warnings = validation.get("final_pipeline_state") != "COMPLETED"

        if scope == "STEP_RUN" and explicit:
            max_sequence = max((seq for seq, key, _ in STEP_DEFINITIONS if key in explicit), default=0)
            base = f"Bước {max_sequence} hoàn tất"
            if has_warnings:
                base += " có cảnh báo"
            if skipped:
                skipped_sequences = [seq for seq, key, _ in STEP_DEFINITIONS if key in skipped]
                if skipped_sequences:
                    first, last = min(skipped_sequences), max(skipped_sequences)
                    suffix = f"Bước {first}" if first == last else f"Bước {first}–{last}"
                    base += f" — {suffix} chưa chạy"
            return base
        if validation.get("final_pipeline_state") == "PARTIAL_COMPLETED":
            return "Pipeline hoàn tất một phần"
        if validation.get("final_pipeline_state") == "COMPLETED_WITH_WARNINGS":
            return "Quét hoàn tất có cảnh báo"
        return "Quét đã hoàn tất"

    def _step(self, key):
        return self.run.steps.get(step_key=key)

    def _skip_step(self, key):
        step = self._step(key)
        step.status = ScanStepRun.STATUS_SKIPPED
        step.progress = 100
        step.message = self._compact_step_message("Không thuộc phạm vi lần chạy này")
        step.finished_at = timezone.now()
        step.save()

    def _run_step(self, sequence, key):
        step = self._step(key)
        step.status = ScanStepRun.STATUS_RUNNING
        step.progress = 5
        step.started_at = timezone.now()
        step.message = self._compact_step_message("Đang thực hiện")
        step.save()
        self.run.current_step = key
        self.run.progress = int((sequence - 1) / 6 * 100)
        self.run.save(update_fields=["current_step","progress"])
        handler = getattr(self, f"step_{key.lower()}")
        try:
            payload, has_warning = handler(step)
            step.payload = payload
            step.status = ScanStepRun.STATUS_WARNINGS if has_warning else ScanStepRun.STATUS_COMPLETED
            step_message = self._compact_step_message(payload.get("message", "Hoàn tất"))
            step.message = step_message
            step.progress = 100
            step.finished_at = timezone.now()
            step.save()
            if has_warning:
                Notification.objects.create(
                    level="WARNING", title=f"Bước {sequence} cần lưu ý", message=step_message or "Hoàn tất có cảnh báo",
                    scan_run=self.run, step_key=key,
                )
            schedule = StepSchedule.objects.filter(profile=self.run.profile, step_key=key).first()
            if schedule:
                schedule.last_run_at = timezone.now()
                schedule.next_run_at = timezone.now() + timedelta(minutes=schedule.interval_minutes)
                schedule.save(update_fields=["last_run_at","next_run_at"])
        except Exception as exc:
            step.status = ScanStepRun.STATUS_FAILED
            step.message = self._compact_step_message(exc)
            step.finished_at = timezone.now()
            step.save()
            Notification.objects.create(level="ERROR", title=f"Bước {sequence} thất bại", message=str(exc), scan_run=self.run, step_key=key)
            raise

    @staticmethod
    def _daily_observed_at(observed_at):
        observed = observed_at.astimezone(datetime_timezone.utc)
        return observed.replace(hour=0, minute=0, second=0, microsecond=0)

    def _upsert_global_snapshot(self, point, fetched_at):
        """Persist one auditable snapshot per provider UTC day; never merge providers."""
        from decimal import Decimal
        from hashlib import sha256
        import json
        observed_at = self._daily_observed_at(point["observed_at"])
        normalized = {**point, "observed_at": observed_at}
        MarketRegimeGlobalSnapshot.objects.update_or_create(
            provider=normalized["provider"], observed_at=observed_at,
            defaults={
                "fetched_at": fetched_at,
                "btc_dominance_pct": Decimal(str(normalized["btc_dominance_pct"])),
                "eth_dominance_pct": Decimal(str(normalized["eth_dominance_pct"])) if normalized["eth_dominance_pct"] is not None else None,
                "total_market_cap_usd": Decimal(str(normalized["total_market_cap_usd"])),
                "total3_proxy_usd": Decimal(str(normalized["total3_proxy_usd"])) if normalized["total3_proxy_usd"] is not None else None,
                "source_endpoint": normalized["source_endpoint"],
                "payload_hash": sha256(json.dumps(normalized, default=str, sort_keys=True).encode()).hexdigest(),
            },
        )

    def step_universe_scan(self, step):
        cfg = self.config["universe"]
        markets = self.client.coingecko_markets(int(cfg["top_count"]))
        exchange_info = self.client.binance_exchange_info()
        binance = valid_binance_usdt_symbols(exchange_info)
        accounting = {
            "initial_count": len(markets),
            "binance_spot_eligible": 0,
            "excluded_token_type": 0,
            "excluded_market_cap": 0,
            "failed_liquidity_prefilter": 0,
            "excluded_supply_prefilter": 0,
            "blocked_supply_prefilter": 0,
            "failed_supply_unlock_prefilter": 0,
            "research_pool": 0,
        }
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

            prefilter = research_prefilter(
                row,
                {**cfg, **self.config["liquidity"], **self.config["tokenomics"]},
            )
            if prefilter["decision"] == "EXCLUDE":
                accounting["excluded_supply_prefilter"] += 1
                accounting["failed_supply_unlock_prefilter"] += 1
                continue

            action = "BLOCKED" if prefilter["decision"] == "BLOCKED" else "WATCH_ONLY"
            if action == "BLOCKED":
                accounting["blocked_supply_prefilter"] += 1
                accounting["failed_supply_unlock_prefilter"] += 1

            created.append(Candidate(
                scan_run=self.run, coingecko_id=row.get("id", ""), symbol=symbol, name=row.get("name", symbol),
                binance_pair=f"{symbol}USDT", stage="RESEARCH_POOL", rank=int(row.get("market_cap_rank") or 0),
                market_cap_usd=Decimal(str(mc)), fdv_usd=Decimal(str(row.get("fully_diluted_valuation") or 0)) if row.get("fully_diluted_valuation") else None,
                volume_24h_usd=Decimal(str(vol)), price_usd=Decimal(str(row.get("current_price") or 0)),
                quality_score_low=None, quality_score_high=None, quality_status="NOT_SCORED",
                action=action,
                risk_codes=sorted(set(["DAT-07", "DAT-09"] + prefilter.get("risk_codes", []))),
                details={
                    "market_source": "CoinGecko",
                    "market_snapshot": row,
                    "research_prefilter": prefilter,
                    "quality_evidence": {
                        "status": "E0",
                        "missing": prefilter["missing"],
                        "note": "Không tạo Quality Score từ market proxy; cần Product/Token Value/Unlock evidence.",
                    },
                    "data_status": {"unlock": "UNKNOWN", "product": "UNKNOWN", "token_value_capture": "UNKNOWN"},
                },
            ))
        Candidate.objects.bulk_create(created, batch_size=200)
        accounting["research_pool"] = sum(1 for candidate in created if candidate.action != "BLOCKED")
        self.run.counters = {**self.run.counters, **accounting}
        self.run.save(update_fields=["counters"])
        return {"message":f"Đã tạo research pool gồm {len(created)} coin", "universe_accounting":accounting}, False

    def step_market_regime(self, step):
        fetched_at = timezone.now()

        def fetch(symbol, interval, limit=220):
            try:
                return self.client.binance_klines(symbol, interval, limit), None
            except DataSourceError as exc:
                return [], str(exc)

        btc_d1_rows, btc_d1_error = fetch("BTCUSDT", "1d")
        btc_4h_rows, btc_4h_error = fetch("BTCUSDT", "4h")
        eth_d1_rows, eth_d1_error = fetch("ETHUSDT", "1d")
        eth_4h_rows, eth_4h_error = fetch("ETHUSDT", "4h")
        try:
            global_data = self.client.coingecko_global()
            global_error = None
        except DataSourceError as exc:
            global_data, global_error = {}, str(exc)

        if global_error:
            try:
                global_data = self.client.coinpaprika_global()
                global_error = None
                btc_dom, total3, snapshot = analyze_coinpaprika_global(global_data, fetched_at=fetched_at)
            except DataSourceError:
                btc_dom, total3, snapshot = analyze_global({}, fetched_at=fetched_at)
        else:
            btc_dom = total3 = snapshot = None

        market_cfg = {"batch_concurrency": 4, "breadth_min_coverage_pct": 60, "volume_min_coverage_pct": 60, "history_min_points": 50, **self.config.get("market_regime", {})}
        groups = {
            "btc_d1": analyze_kline_group("BTC D1", btc_d1_rows, provider="Binance", endpoint="/api/v3/klines", symbol="BTCUSDT", fetched_at=fetched_at, freshness_limit=freshness_limit(market_cfg, "1d")),
            "btc_4h": analyze_kline_group("BTC 4H", btc_4h_rows, provider="Binance", endpoint="/api/v3/klines", symbol="BTCUSDT", fetched_at=fetched_at, freshness_limit=freshness_limit(market_cfg, "4h")),
            "eth_d1_4h": evidence("ETH D1/4H", value={"d1": eth_d1_rows, "4h": eth_4h_rows}, signal="UNKNOWN", status="UNKNOWN", provider="Binance", endpoint="/api/v3/klines", symbols=["ETHUSDT"], fetched_at=iso_time(fetched_at)),
        }
        eth_group = groups["eth_d1_4h"]
        eth_d1_evidence = analyze_kline_group("ETH D1", eth_d1_rows, provider="Binance", endpoint="/api/v3/klines", symbol="ETHUSDT", fetched_at=fetched_at, freshness_limit=freshness_limit(market_cfg, "1d"))
        eth_4h_evidence = analyze_kline_group("ETH 4H", eth_4h_rows, provider="Binance", endpoint="/api/v3/klines", symbol="ETHUSDT", fetched_at=fetched_at, freshness_limit=freshness_limit(market_cfg, "4h"))
        eth_group.update(combine_timeframe_evidence("ETH D1/4H", eth_d1_evidence, eth_4h_evidence, symbol="ETHUSDT"))
        if eth_d1_error or eth_4h_error:
            eth_group["error"] = eth_d1_error or eth_4h_error
        if btc_dom is None:
            btc_dom, total3, snapshot = analyze_global(global_data, fetched_at=fetched_at)
        if global_error:
            btc_dom["error"] = global_error
            btc_dom["status"] = "UNKNOWN"
            total3["error"] = global_error
            total3["status"] = "UNKNOWN"
        cmc_rows = self.client.cmc_global_history(int(market_cfg.get("history_request_points", 90)))
        cmc_points = parse_cmc_history(cmc_rows) if cmc_rows is not None else []
        if cmc_points:
            snapshot = cmc_points[-1]
            for point in cmc_points:
                self._upsert_global_snapshot(point, fetched_at)
        if snapshot:
            if not cmc_points:
                self._upsert_global_snapshot(snapshot, fetched_at)
            history = list(MarketRegimeGlobalSnapshot.objects.filter(provider=snapshot["provider"]).order_by("observed_at"))
            points = [{"observed_at": x.observed_at, "btc_dominance_pct": x.btc_dominance_pct, "total3_proxy_usd": x.total3_proxy_usd} for x in history]
            btc_dom = analyze_history("BTC Dominance", points, "btc_dominance_pct", provider=snapshot["provider"], freshness=freshness_limit(market_cfg, "global_daily"), min_points=int(market_cfg["history_min_points"]), fetched_at=fetched_at, alt_perspective=True)
            total3 = analyze_history("TOTAL3_PROXY", points, "total3_proxy_usd", provider=snapshot["provider"], freshness=freshness_limit(market_cfg, "global_daily"), min_points=int(market_cfg["history_min_points"]), fetched_at=fetched_at)
        groups["btc_dominance"], groups["total3_proxy"] = btc_dom, total3
        eth_btc_d1, eth_btc_d1_error = fetch("ETHBTC", "1d")
        eth_btc_4h, eth_btc_4h_error = fetch("ETHBTC", "4h")
        groups["eth_btc"] = analyze_eth_btc(eth_btc_d1, eth_btc_4h, fetched_at=fetched_at, d1_freshness=freshness_limit(market_cfg, "1d"), h4_freshness=freshness_limit(market_cfg, "4h"))
        if eth_btc_d1_error or eth_btc_4h_error:
            groups["eth_btc"]["error"] = eth_btc_d1_error or eth_btc_4h_error

        candidates = list(Candidate.objects.filter(scan_run=self.run, stage="RESEARCH_POOL").exclude(symbol__in=["BTC", "ETH"]).order_by("rank"))
        dataset, fetch_errors = {}, []
        with ThreadPoolExecutor(max_workers=max(1, min(int(market_cfg["batch_concurrency"]), 5))) as pool:
            futures = {pool.submit(self.client.binance_klines, candidate.binance_pair, "1d", 30): candidate.binance_pair for candidate in candidates if candidate.binance_pair}
            for future in as_completed(futures):
                symbol = futures[future]
                try:
                    dataset[symbol] = future.result()
                except DataSourceError as exc:
                    fetch_errors.append({"symbol": symbol, "error": str(exc)})
        requested_symbols = [candidate.binance_pair for candidate in candidates if candidate.binance_pair]
        breadth, volume = analyze_breadth_and_volume(dataset, eligible_symbols=requested_symbols, fetched_at=fetched_at, breadth_min_coverage_pct=float(market_cfg["breadth_min_coverage_pct"]), volume_min_coverage_pct=float(market_cfg["volume_min_coverage_pct"]))
        breadth["notes"] = fetch_errors[:20] + breadth.get("notes", [])
        volume["notes"] = fetch_errors[:20] + volume.get("notes", [])
        groups["breadth_ma20"], groups["alt_volume_7d"] = breadth, volume
        groups["macro_event_risk"] = evidence("Macro/event risk", signal="UNKNOWN", status="UNKNOWN", notes=["Chưa có manual evidence override hoặc provider được cấu hình"])
        completeness = compute_completeness(groups)
        regime, reasons = classify_regime(groups, completeness)
        payload = {
            "schema_version": "market_regime.v2", "regime": regime, "status": completeness["status"], "confidence": completeness["confidence"],
            "generated_at": iso_time(fetched_at), "universe": {"basis": "CURRENT_SCAN_RESEARCH_POOL", "count": len(candidates), "requested_count": len(requested_symbols), "fetched_count": len(dataset), "eligible_count": len(requested_symbols), "failed_count": len(fetch_errors), "universe_hash": universe_hash(requested_symbols)},
            "completeness": completeness, "groups": groups, "hard_rules": reasons, "provider_stats": {"binance": {"symbols_fetched": len(dataset), "symbols_failed": len(fetch_errors), **getattr(self.client, "request_stats", {})}, "cmc_history": getattr(self.client, "request_stats", {}).get("cmc_history", "DISABLED_NO_KEY" if not cmc_rows else "AVAILABLE")},
        }
        payload["message"] = f"Market Regime: {regime} — {payload['status']} ({completeness['pass_count']}/{completeness['total_count']})"
        results = dict(self.run.results)
        results["market_regime"] = payload
        self.run.results = results
        self.run.save(update_fields=["results"])
        return payload, payload["status"] != "FINAL"

    def step_research_shortlist(self, step):
        count = int(self.config["universe"]["research_shortlist_count"])
        pool = list(
            Candidate.objects.filter(scan_run=self.run, stage="RESEARCH_POOL")
            .exclude(action__in=["BLOCKED", "EXCLUDE"])
        )
        fetched_at = timezone.now()
        provider_status: dict[str, dict] = {}

        # Binance 24h ticker is one bulk request and gives actual Binance quote
        # volume for Structural Liquidity prioritisation.  A source failure must
        # degrade evidence, never fail the whole Research step.
        try:
            tickers = binance_ticker_map(self.client.binance_24h_tickers())
            provider_status["binance_24h"] = {"status": "PASS", "count": len(tickers)}
        except DataSourceError as exc:
            tickers = {}
            provider_status["binance_24h"] = {"status": "UNAVAILABLE", "error": str(exc)}

        protocols_payload: list[dict] = []
        chains_payload: list[dict] = []
        fees_payload: dict = {}
        revenue_payload: dict = {}
        dex_payload: dict = {}

        if settings.RESEARCH_DEFILLAMA_ENABLED:
            research_sources = [
                ("defillama_protocols", self.client.defillama_protocols),
                ("defillama_chains", self.client.defillama_chains),
                ("defillama_fees", self.client.defillama_fees_overview),
                ("defillama_revenue", lambda: self.client.defillama_fees_overview(data_type="dailyRevenue")),
                ("defillama_dex", self.client.defillama_dex_overview),
            ]
            loaded: dict[str, object] = {}
            for source_key, loader in research_sources:
                try:
                    payload = loader()
                    loaded[source_key] = payload
                    row_count = len(payload) if isinstance(payload, list) else len(payload.get("protocols", [])) if isinstance(payload, dict) and isinstance(payload.get("protocols"), list) else None
                    provider_status[source_key] = {"status": "PASS", "count": row_count}
                except DataSourceError as exc:
                    loaded[source_key] = [] if source_key in {"defillama_protocols", "defillama_chains"} else {}
                    provider_status[source_key] = {"status": "UNAVAILABLE", "error": str(exc)}
            protocols_payload = loaded["defillama_protocols"] if isinstance(loaded["defillama_protocols"], list) else []
            chains_payload = loaded["defillama_chains"] if isinstance(loaded["defillama_chains"], list) else []
            fees_payload = loaded["defillama_fees"] if isinstance(loaded["defillama_fees"], dict) else {}
            revenue_payload = loaded["defillama_revenue"] if isinstance(loaded["defillama_revenue"], dict) else {}
            dex_payload = loaded["defillama_dex"] if isinstance(loaded["defillama_dex"], dict) else {}
        else:
            provider_status["defillama"] = {"status": "SKIPPED_DISABLED"}

        indexes = build_defillama_indexes(
            protocols_payload, chains_payload, fees_payload, revenue_payload, dex_payload
        )

        product_pass = 0
        valuation_proxy_pass = 0
        for candidate in pool:
            details = dict(candidate.details or {})
            prefilter = details.get("research_prefilter", {})
            evidence = build_research_evidence(
                candidate,
                prefilter,
                tickers.get(candidate.binance_pair),
                match_defillama(candidate, indexes),
                indexes,
                fetched_at.isoformat(),
            )
            details["research_evidence"] = evidence
            data_status = dict(details.get("data_status") or {})
            data_status["product"] = evidence["product"]["status"]
            data_status["structural_liquidity"] = evidence["structural_liquidity"]["status"]
            data_status["valuation_proxy"] = evidence["valuation_proxy"]["status"]
            # Protocol activity is deliberately not reused as Token Value Capture.
            data_status["token_value_capture"] = "UNKNOWN"
            details["data_status"] = data_status
            missing = list((details.get("quality_evidence") or {}).get("missing") or [])
            if evidence["product"]["status"] == "PASS":
                product_pass += 1
                missing = [item for item in missing if item != "product_metrics"]
                if "product_quality_full" not in missing:
                    missing.append("product_quality_full")
            if evidence["valuation_proxy"]["status"] == "PASS":
                valuation_proxy_pass += 1
            details["quality_evidence"] = {
                "status": "PARTIAL_EVIDENCE",
                "missing": missing,
                "note": (
                    "Đã bổ sung research evidence định lượng khi nguồn hỗ trợ, nhưng chưa đủ 7 nhóm "
                    "để chấm Quality V8.1. Protocol activity không được coi là Token Value Capture."
                ),
            }
            candidate.details = details

        if pool:
            Candidate.objects.bulk_update(pool, ["details"], batch_size=100)

        def research_sort_key(candidate):
            evidence = (candidate.details or {}).get("research_evidence", {})
            key = evidence.get("sort_key")
            if isinstance(key, list) and len(key) >= 11:
                return tuple(key)
            prefilter = (candidate.details or {}).get("research_prefilter", {})
            legacy = prefilter.get("sort_key")
            if isinstance(legacy, list) and len(legacy) >= 7:
                return tuple(list(legacy) + [9, 9, 9, 9, 9])
            return (9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 0, -float(candidate.volume_24h_usd or 0))

        pool.sort(key=research_sort_key)
        qs = pool[:count]
        for idx, candidate in enumerate(qs, 1):
            candidate.stage = "RESEARCH_SHORTLIST"
            candidate.rank = idx
            candidate.quality_score_low = None
            candidate.quality_score_high = None
            candidate.quality_status = "NOT_SCORED"
            candidate.save(update_fields=["stage", "rank", "quality_score_low", "quality_score_high", "quality_status"])

        self.run.counters = {
            **self.run.counters,
            "research_shortlist": len(qs),
            "research_product_evidence_pass": sum(
                1 for candidate in qs
                if (candidate.details or {}).get("research_evidence", {}).get("product", {}).get("status") == "PASS"
            ),
        }
        self.run.save(update_fields=["counters"])

        selected_product_pass = int(self.run.counters.get("research_product_evidence_pass", 0))
        selection_mode = "RESEARCH_EVIDENCE_PRIORITY" if product_pass or valuation_proxy_pass else "PREFILTER_ONLY_FALLBACK"
        unavailable = [key for key, value in provider_status.items() if value.get("status") == "UNAVAILABLE"]
        if unavailable:
            message = (
                f"Đã chọn {len(qs)} candidate; {selected_product_pass}/{len(qs)} có Product/Usage evidence. "
                f"Mode: {selection_mode}. {len(unavailable)} nguồn research không khả dụng; "
                "đã fallback an toàn. Quality vẫn NOT_SCORED; xem provider_status để biết chi tiết."
            )
        else:
            message = (
                f"Đã chọn {len(qs)} candidate theo Research Evidence Priority; "
                f"{selected_product_pass}/{len(qs)} có Product/Usage evidence. "
                "Quality vẫn NOT_SCORED vì chưa đủ toàn bộ evidence V8.1."
            )

        return {
            "message": message,
            "count": len(qs),
            "selection_mode": selection_mode,
            "quality_status": "NOT_SCORED",
            "product_evidence_pass": selected_product_pass,
            "provider_degraded": bool(unavailable),
            "unavailable_sources": unavailable,
            "provider_status": provider_status,
            "critical_missing": [
                "product_quality_full",
                "token_value_capture",
                "unlock_7d_30d_90d",
                "valuation_x2_x3_full",
                "moat",
                "team_security",
                "verified_catalysts",
            ],
        }, True

    def step_execution_verification(self, step):
        count = int(self.config["universe"]["execution_verification_count"])
        candidates = list(Candidate.objects.filter(scan_run=self.run, stage="RESEARCH_SHORTLIST").order_by("rank")[:count])
        verified = 0
        failed = 0
        excluded = 0
        unlock_statuses = set()
        liquidity = self.config["liquidity"]
        for candidate in candidates:
            details = dict(candidate.details)
            excluded_from_universe, exclusion_reason = excluded_token(
                details.get("market_snapshot", {}), self.config["universe"]
            )
            if excluded_from_universe:
                details["execution"] = {
                    "status": "BLOCKED",
                    "blockers": [f"UNIVERSE_EXCLUDED_{exclusion_reason}"],
                    "reason": "Candidate does not satisfy configured Universe exclusions",
                }
                candidate.action = "WATCH_ONLY"
                candidate.risk_codes = sorted(set(candidate.risk_codes + [f"UNIVERSE_{exclusion_reason}"]))
                candidate.details = details
                candidate.save(update_fields=["action", "risk_codes", "details"])
                excluded += 1
                continue
            try:
                fetched_at = timezone.now()
                depth = depth_metrics(
                    self.client.binance_depth(candidate.binance_pair),
                    liquidity["order_sizes_vnd"],
                    liquidity["vnd_per_usd"],
                    spread_max_pct=float(liquidity["spread_max_main_pct"]),
                    slippage_max_pct=float(liquidity["slippage_max_pct"]),
                    fetched_at=fetched_at,
                )
                d1 = kline_summary(self.client.binance_klines(candidate.binance_pair, "1d"), now=fetched_at, freshness_seconds=30 * 60 * 60)
                h4 = kline_summary(self.client.binance_klines(candidate.binance_pair, "4h"), now=fetched_at, freshness_seconds=6 * 60 * 60)
                market_blockers = []
                for evidence_name, evidence_payload in (("ORDERBOOK", depth), ("KLINE_D1", d1), ("KLINE_4H", h4)):
                    if evidence_payload.get("status") != "PASS":
                        market_blockers.append(f"{evidence_name}_{evidence_payload.get('status', 'UNKNOWN')}")
                        market_blockers.extend(evidence_payload.get("blockers", []))
                unlock = self.unlock_service.collect(candidate, self.config["tokenomics"], fetched_at)
                unlock_statuses.add(unlock.get("status", "UNKNOWN"))
                details["execution"] = {"orderbook":depth,"d1":d1,"h4":h4,"unlock":unlock,"stop":None,"rr":None}
                details.setdefault("data_status", {})["unlock"] = unlock.get("status", "UNKNOWN")
                execution = details["execution"]
                execution["status"] = "PROVISIONAL" if not market_blockers else "UNKNOWN"
                if unlock.get("status") == "PASS" and unlock.get("risk_status") == "BLOCKED":
                    unlock_blocker = ["UNLOCK_RISK_BLOCKED"]
                elif unlock.get("status") == "PASS" and unlock.get("risk_status") == "WATCH_RISK":
                    unlock_blocker = ["UNLOCK_RISK_WATCH"]
                elif unlock.get("status") == "PASS" and unlock.get("risk_status") == "CLEAR":
                    unlock_blocker = []
                else:
                    unlock_blocker = [f"UNLOCK_{unlock.get('status', 'UNKNOWN')}" if unlock.get("status") in {"UNKNOWN", "STALE", "CONFLICT"} else "UNLOCK_EVIDENCE_INSUFFICIENT"]
                execution["blockers"] = sorted(set(market_blockers + unlock_blocker + ["STOP_MISSING", "RR_MISSING"]))
                execution["fetched_at"] = fetched_at.isoformat()
                candidate.stage = "EXECUTION_VERIFICATION"
                candidate.entry_status = "NOT_SCORED"
                candidate.action = "BLOCKED" if unlock.get("risk_status") == "BLOCKED" or unlock.get("status") == "CONFLICT" else "WATCH_ONLY"
                candidate.risk_codes = sorted(set(candidate.risk_codes + unlock.get("risk_codes", [])))
                candidate.details = details
                candidate.save()
                if not market_blockers:
                    verified += 1
            except (DataSourceError, KeyError, TypeError, ValueError) as exc:
                details["execution_error"] = {"type": type(exc).__name__, "message": str(exc)}
                candidate.details = details
                candidate.save(update_fields=["details"])
                failed += 1
        self.run.counters = {**self.run.counters, "execution_verification":verified}
        self.run.save(update_fields=["counters"])
        return {
            "message": (
                f"Đã xác minh market evidence cho {verified}/{len(candidates)} coin; {excluded} coin bị chặn theo Universe; "
                f"unlock statuses: {', '.join(sorted(unlock_statuses)) if unlock_statuses else 'NONE'}"
            ),
            "requested": len(candidates),
            "verified": verified,
            "failed": failed,
            "excluded": excluded,
            "critical_missing": (["unlock_7d_30d_90d"] if unlock_statuses - {"PASS", "PROVISIONAL"} else []) + ["stop", "rr"],
            "provider_stats": {"binance": dict(getattr(self.client, "request_stats", {}))},
        }, True

    def step_scoring_validation(self, step):
        candidates = Candidate.objects.filter(scan_run=self.run, stage="EXECUTION_VERIFICATION")
        for c in candidates:
            c.entry_status = "NOT_SCORED"
            c.opportunity_status = "NOT_SCORED"
            c.opportunity_score = None
            if c.action not in {"BLOCKED", "EXCLUDE"}:
                c.action = "WATCH_ONLY"
            c.save(update_fields=["entry_status","opportunity_status","opportunity_score","action"])
        self.run.counters = {**self.run.counters, "buy_setup":0}
        self.run.save(update_fields=["counters"])
        missing = ["Product/Token Value Quality evidence", "stop", "RR"]
        if any((c.details or {}).get("execution", {}).get("unlock", {}).get("status") != "PASS" for c in candidates):
            missing.insert(1, "unlock")
        shortlist_step = self.run.steps.filter(step_key="RESEARCH_SHORTLIST").first()
        research_selection_mode = (shortlist_step.payload or {}).get("selection_mode", "UNKNOWN") if shortlist_step else "UNKNOWN"
        return {
            "message": f"Validation Gate: BUY_SETUP = 0 vì còn thiếu {', '.join(missing)}; không tạo dữ liệu giả",
            "buy_setup": 0,
            "capital_plan": {"usdt_pct":100,"deployed_pct":0},
            "hard_rule_wins": True,
            "research_selection_mode": research_selection_mode,
            "critical_missing": missing,
        }, True

    def step_investment_results(self, step):
        rows = []
        for c in Candidate.objects.filter(scan_run=self.run, stage__in=["RESEARCH_SHORTLIST","EXECUTION_VERIFICATION"]).order_by("rank")[:15]:
            rows.append({
                "rank": c.rank,
                "symbol": c.symbol,
                "pair": c.binance_pair,
                "name": c.name,
                "market_cap_usd": float(c.market_cap_usd or 0),
                "volume_24h_usd": float(c.volume_24h_usd or 0),
                "research_prefilter": (c.details or {}).get("research_prefilter", {}),
                "research_evidence": (c.details or {}).get("research_evidence", {}),
                "quality_range": None if c.quality_score_low is None or c.quality_score_high is None else [float(c.quality_score_low), float(c.quality_score_high)],
                "quality_status": c.quality_status,
                "entry_status": c.entry_status,
                "opportunity_status": c.opportunity_status,
                "action": c.action,
                "risk_codes": c.risk_codes,
            })
        results = dict(self.run.results)
        results["ranking"] = rows
        results["executive_decision"] = {"should_buy":"KHÔNG","statement":"CHƯA NÊN MUA SPOT — TIẾP TỤC GIỮ USDT.","usdt_pct":100,"buy_setup_count":0}
        self.run.results = results
        self.run.save(update_fields=["results"])
        return {"message":f"Đã tạo danh sách kết quả gồm {len(rows)} coin", "count":len(rows)}, True

    def _validation_gate(self):
        critical_fields = ["orderbook_live", "kline_4h", "unlock_7d_30d_90d", "stop", "rr"]
        lifecycle = self._lifecycle_snapshot()
        buy_setup = int(self.run.counters.get("buy_setup", 0))
        errors = []
        warnings = []
        block_reasons = []
        critical_missing = []

        if "UNIVERSE_SCAN" in lifecycle["planned_steps"] and not self.run.counters.get("initial_count"):
            errors.append("Universe Accounting chưa đầy đủ")

        market_regime = (self.run.results or {}).get("market_regime", {})
        if "MARKET_REGIME" in lifecycle["planned_steps"] and market_regime.get("status") != "FINAL":
            reason = f"Market Regime {market_regime.get('status', 'UNKNOWN')} chưa FINAL"
            warnings.append(reason)
            block_reasons.append(reason)

        shortlist_step = self.run.steps.filter(step_key="RESEARCH_SHORTLIST").first()
        if shortlist_step and shortlist_step.status in {ScanStepRun.STATUS_COMPLETED, ScanStepRun.STATUS_WARNINGS}:
            selection_mode = shortlist_step.payload.get("selection_mode") or "UNKNOWN"
            if selection_mode != "QUALITY_RANKING_V8_1":
                warnings.append(f"Research Shortlist là {selection_mode}, chưa phải Quality ranking V8.1")
            for item in shortlist_step.payload.get("critical_missing", []):
                if item not in critical_missing:
                    critical_missing.append(item)
        if any(c.quality_status != "FINAL" for c in Candidate.objects.filter(scan_run=self.run, stage__in=["RESEARCH_SHORTLIST", "EXECUTION_VERIFICATION"])):
            warnings.append("Quality chưa FINAL do Product/Token Value/Unlock/Valuation evidence chưa đủ")

        execution_step = self.run.steps.filter(step_key="EXECUTION_VERIFICATION").first()
        execution_ran = bool(execution_step and execution_step.status in {ScanStepRun.STATUS_COMPLETED, ScanStepRun.STATUS_WARNINGS})
        if execution_ran:
            for item in execution_step.payload.get("critical_missing", []):
                if item not in critical_missing:
                    critical_missing.append(item)

            execution_candidates = Candidate.objects.filter(scan_run=self.run, stage="EXECUTION_VERIFICATION")
            if execution_candidates.exists():
                if any((c.details or {}).get("execution", {}).get("unlock", {}).get("status") != "PASS" for c in execution_candidates):
                    block_reasons.append("Unlock 7D/30D/90D chưa PASS cho toàn bộ execution candidate")
                if any((c.details or {}).get("execution", {}).get("h4", {}).get("status") != "PASS" for c in execution_candidates):
                    block_reasons.append("Kline 4H chưa PASS cho toàn bộ execution candidate")
                if any((c.details or {}).get("execution", {}).get("orderbook", {}).get("status") != "PASS" for c in execution_candidates):
                    block_reasons.append("Orderbook live chưa PASS cho toàn bộ execution candidate")
                if any((c.details or {}).get("execution", {}).get("stop") is None for c in execution_candidates):
                    block_reasons.append("Stop/invalidation chưa có")
                if any((c.details or {}).get("execution", {}).get("rr") is None for c in execution_candidates):
                    block_reasons.append("RR chưa có")
            else:
                block_reasons.append("Không có execution candidate đã xác minh")
        elif "EXECUTION_VERIFICATION" in lifecycle["planned_steps"]:
            block_reasons.append("Execution Verification chưa hoàn tất")

        # B5/B6 bị SKIPPED do nằm ngoài phạm vi phải được mô tả là partial run,
        # không được biến thành false-success full pipeline.
        if lifecycle["skipped_steps"]:
            skipped_labels = [
                f"B{seq}" for seq, key, _ in STEP_DEFINITIONS if key in lifecycle["skipped_steps"]
            ]
            warnings.append(f"Các bước {', '.join(skipped_labels)} chưa chạy trong phạm vi lần này")

        block_reasons = list(dict.fromkeys(block_reasons))
        critical_missing = list(dict.fromkeys(critical_missing))
        execution_eligible = execution_ran and not block_reasons and not critical_missing

        if buy_setup > 0 and not execution_eligible:
            errors.append("BUY_SETUP > 0 trong khi critical execution evidence chưa đủ")

        validated_mode = "FULL_SCAN_EXECUTION" if lifecycle["full_pipeline_completed"] and execution_eligible else "FULL_SCAN_RESEARCH"
        mode_downgraded = self.run.mode_requested == "FULL_SCAN_EXECUTION" and validated_mode != "FULL_SCAN_EXECUTION"
        if mode_downgraded:
            warnings.append("FULL_SCAN_EXECUTION đã được hạ xuống FULL_SCAN_RESEARCH do Execution Gate chưa đạt")

        has_warnings = bool(warnings or errors or lifecycle["warning_steps"])
        if lifecycle["full_pipeline_completed"]:
            final_pipeline_state = "COMPLETED_WITH_WARNINGS" if has_warnings else "COMPLETED"
        else:
            final_pipeline_state = "PARTIAL_COMPLETED"

        completed_sequences = [seq for seq, key, _ in STEP_DEFINITIONS if key in lifecycle["completed_steps"]]
        if lifecycle["full_pipeline_completed"]:
            scope_text = "Đã xử lý đủ 6 bước"
        elif completed_sequences:
            contiguous = completed_sequences == list(range(1, max(completed_sequences) + 1))
            if contiguous:
                scope_text = f"Bước 1–{max(completed_sequences)} đã chạy xong"
            else:
                scope_text = "Các bước đã chạy: " + ", ".join(f"B{seq}" for seq in completed_sequences)
        else:
            scope_text = "Chưa có bước nào hoàn tất"

        skipped_text = ""
        if lifecycle["skipped_steps"]:
            skipped_sequences = [seq for seq, key, _ in STEP_DEFINITIONS if key in lifecycle["skipped_steps"]]
            skipped_text = " Bước chưa chạy: " + ", ".join(f"B{seq}" for seq in skipped_sequences) + "."

        reason_text = ""
        if block_reasons or critical_missing:
            combined = block_reasons + [f"Thiếu {item}" for item in critical_missing if item not in {"stop", "rr"}]
            combined = list(dict.fromkeys(combined))
            if combined:
                reason_text = " Chưa đủ điều kiện Execution: " + "; ".join(combined) + "."

        capital_text = "Không có BUY_SETUP hợp lệ; giữ 100% USDT." if buy_setup == 0 else f"BUY_SETUP hợp lệ: {buy_setup}."
        summary = f"{scope_text}.{skipped_text} Mode xác thực: {validated_mode}.{reason_text} {capital_text}"
        summary = " ".join(summary.split())

        return {
            "passed": not errors,
            "errors": errors,
            "warnings": list(dict.fromkeys(warnings)),
            "validated_mode": validated_mode,
            "summary": summary,
            "critical_fields": critical_fields,
            "critical_missing": critical_missing,
            "execution_eligible": execution_eligible,
            "execution_block_reason": "; ".join(block_reasons) if block_reasons else None,
            "execution_block_reasons": block_reasons,
            "mode_downgraded": mode_downgraded,
            "downgrade_reason": "; ".join(block_reasons + [f"Thiếu {item}" for item in critical_missing]) if mode_downgraded else None,
            "final_pipeline_state": final_pipeline_state,
            **lifecycle,
        }
