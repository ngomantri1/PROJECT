from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from .models import ChecklistProfile, ScanRun, ScanStepRun, Candidate, Notification, UnlockOfficialSchedule
from .services import DataSourceError, checksum_json, default_config, depth_metrics, excluded_token, kline_summary, provisional_quality, research_prefilter
from .unlock.service import UnlockEvidenceService
from .unlock.calculator import calculate_windows
from .unlock.reconciliation import reconcile_events
from .unlock.service import OfficialScheduleProvider
from .unlock.providers import PublicWebUnlockProvider
from .unlock.web import parse_public_unlock_html, parse_public_unlock_document, discover_unlock_links
from .orchestrator import ScanOrchestrator
from .research import build_defillama_indexes, binance_ticker_map, build_research_evidence, match_defillama
from .tasks import create_scan_run
from .market_regime import (
    analyze_breadth_and_volume, analyze_global, analyze_kline_group,
    analyze_history, classify_regime, combine_timeframe_evidence, compute_completeness, freshness_limit, parse_closed_klines, total3_proxy,
)
from datetime import datetime, timedelta, timezone

class IntegrityTests(TestCase):
    @staticmethod
    def _rows(count=60, *, trend=1.0, now=None):
        now = now or datetime.now(timezone.utc)
        rows = []
        for index in range(count):
            close = 100 + index * trend
            close_time = int((now - timedelta(days=count - index)).timestamp() * 1000)
            rows.append([close_time - 86_000_000, close, close + 1, close - 1, close, 1000, close_time, close * 1000])
        return rows

    def test_closed_kline_parser_excludes_open_and_malformed_rows(self):
        now = datetime.now(timezone.utc)
        rows = self._rows(2, now=now) + [[0, "bad"]]
        rows.append([int(now.timestamp() * 1000), 1, 2, 1, 1, 1, int((now + timedelta(hours=1)).timestamp() * 1000)])
        self.assertEqual(len(parse_closed_klines(rows, now=now)), 2)

    def test_kline_group_marks_insufficient_data_unknown(self):
        result = analyze_kline_group("BTC D1", self._rows(20), provider="Binance", endpoint="/klines", symbol="BTCUSDT", freshness_limit=10 * 86400)
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["signal"], "UNKNOWN")

    def test_global_snapshot_is_transparent_about_missing_history(self):
        btc, total3, _snapshot = analyze_global({"market_cap_percentage": {"btc": 50, "eth": 10}, "total_market_cap": {"usd": 1000}})
        self.assertEqual(btc["status"], "UNKNOWN")
        self.assertEqual(total3["value"]["total3_proxy_usd"], 400.0)

    def test_breadth_and_volume_are_derived_from_same_dataset(self):
        dataset = {f"COIN{i}USDT": self._rows(30) for i in range(3)}
        breadth, volume = analyze_breadth_and_volume(dataset)
        self.assertEqual(breadth["value"]["eligible"], 3)
        self.assertEqual(volume["value"]["sample_count"], 3)

    def test_quote_volume_is_parsed_and_coverage_uses_requested_universe(self):
        dataset = {f"COIN{i}USDT": self._rows(30) for i in range(30)}
        breadth, volume = analyze_breadth_and_volume(dataset, eligible_symbols=[f"COIN{i}USDT" for i in range(60)])
        self.assertEqual(breadth["value"]["coverage_pct"], 50)
        self.assertEqual(volume["value"]["coverage_pct"], 50)
        self.assertEqual((breadth["status"], volume["status"]), ("UNKNOWN", "UNKNOWN"))
        self.assertEqual(parse_closed_klines(self._rows(1))[0]["quote_volume"], 100000.0)

    def test_freshness_v2_and_legacy_snapshot_are_timeframe_safe(self):
        self.assertEqual(freshness_limit({"freshness_seconds": 21600}, "1d"), 108000)
        self.assertEqual(freshness_limit({"freshness_seconds": {"1d": 1, "4h": 2}}, "1d"), 1)
        self.assertEqual(freshness_limit({"freshness_seconds": {"1d": 1, "4h": 2}}, "4h"), 2)

    def test_timeframe_signal_matrix_is_deterministic(self):
        make = lambda signal, status="PASS": {"signal": signal, "status": status, "fetched_at": "x"}
        self.assertEqual(combine_timeframe_evidence("x", make("BULLISH"), make("BULLISH"))["signal"], "BULLISH")
        self.assertEqual(combine_timeframe_evidence("x", make("BULLISH"), make("BEARISH"))["status"], "CONFLICT")
        self.assertEqual(combine_timeframe_evidence("x", make("BULLISH"), make("NEUTRAL"))["signal"], "NEUTRAL")
        self.assertEqual(combine_timeframe_evidence("x", make("BULLISH", "STALE"), make("BULLISH"))["status"], "UNKNOWN")

    def test_btc_dominance_maps_raw_trend_to_altcoin_impact(self):
        now = datetime.now(timezone.utc)
        points = [{"observed_at": now - timedelta(days=59-i), "btc": 40+i*.1} for i in range(60)]
        result = analyze_history("BTC Dominance", points, "btc", provider="CoinGecko", freshness=129600, fetched_at=now, alt_perspective=True)
        self.assertEqual(result["value"]["trend"], "RISING")
        self.assertEqual(result["signal"], "BEARISH")
        self.assertEqual(total3_proxy(1000, 50, 10), 400)

    def test_history_resamples_same_day_before_minimum_daily_gate(self):
        now = datetime.now(timezone.utc)
        points = [{"observed_at": now + timedelta(minutes=index), "btc": 50 + index} for index in range(50)]
        result = analyze_history("BTC Dominance", points, "btc", provider="CoinGecko", freshness=129600, fetched_at=now, alt_perspective=True)
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["value"]["count"], 1)

    def test_completeness_final_requires_all_groups(self):
        groups = {key: {"status": "PASS", "signal": "NEUTRAL"} for key in ("btc_d1", "btc_4h", "eth_d1_4h", "btc_dominance", "eth_btc", "total3_proxy", "breadth_ma20", "alt_volume_7d", "macro_event_risk")}
        result = compute_completeness(groups)
        self.assertEqual((result["status"], result["confidence"]), ("FINAL", "HIGH"))

    def test_completeness_missing_core_is_provisional_and_regime_not_favorable(self):
        groups = {key: {"status": "UNKNOWN", "signal": "UNKNOWN"} for key in ("btc_d1", "btc_4h", "eth_d1_4h", "btc_dominance", "eth_btc", "total3_proxy", "breadth_ma20", "alt_volume_7d", "macro_event_risk")}
        completeness = compute_completeness(groups)
        regime, _ = classify_regime(groups, completeness)
        self.assertEqual(completeness["status"], "PROVISIONAL")
        self.assertEqual(regime, "TRUNG TÍNH")
    def test_default_weights_equal_100(self):
        cfg = default_config()
        self.assertEqual(sum(cfg["quality_weights"].values()), 100)
        self.assertEqual(sum(cfg["entry_weights"].values()), 100)

    def test_opportunity_exponents_equal_one(self):
        cfg = default_config()
        self.assertAlmostEqual(cfg["opportunity"]["quality_exponent"] + cfg["opportunity"]["entry_exponent"], 1.0)

    def test_depth_metrics(self):
        data = {"bids":[["99","10"],["98","10"]], "asks":[["101","10"],["102","10"]]}
        result = depth_metrics(data, [5_000_000], 26_000)
        self.assertEqual(result["status"], "PASS")
        self.assertGreater(result["spread_pct"], 0)

    def test_depth_metrics_blocks_spread_above_execution_limit(self):
        data = {"bids": [["99", "10"]], "asks": [["101", "10"]]}
        result = depth_metrics(data, [5_000_000], 26_000, spread_max_pct=0.5, slippage_max_pct=0.5)
        self.assertEqual(result["status"], "FAIL")
        self.assertIn("SPREAD_ABOVE_LIMIT", result["blockers"])

    def test_execution_kline_summary_uses_closed_candles_and_marks_stale(self):
        now = datetime.now(timezone.utc)
        rows = self._rows(20, now=now)
        rows.append([0, 1, 2, 1, 1, 1, int((now + timedelta(hours=1)).timestamp() * 1000)])
        result = kline_summary(rows, now=now, freshness_seconds=1)
        self.assertEqual(result["closed_candles"], 20)
        self.assertEqual(result["status"], "STALE")

    def test_tokenized_stock_is_excluded_when_rule_is_enabled(self):
        row = {"symbol": "SNDKB", "name": "SanDisk (bStocks Tokenized Stock)"}
        excluded, reason = excluded_token(row, default_config()["universe"])
        self.assertTrue(excluded)
        self.assertEqual(reason, "TOKENIZED_STOCK")

    def test_unlock_risk_precedence_blocked_wins(self):
        windows = {"7": {"pct_circulating": 2}, "30": {"pct_circulating": 4}, "90": {"pct_circulating": 9}}
        status, codes = UnlockEvidenceService._risk(windows, 100, default_config()["tokenomics"])
        self.assertEqual(status, "BLOCKED")
        self.assertEqual(codes, ["TOK-01", "TOK-02", "TOK-03"])

    def test_unlock_risk_watch_without_seven_day_block(self):
        windows = {"7": {"pct_circulating": .5}, "30": {"pct_circulating": 4}, "90": {"pct_circulating": 9}}
        status, codes = UnlockEvidenceService._risk(windows, 100, default_config()["tokenomics"])
        self.assertEqual(status, "WATCH_RISK")
        self.assertEqual(codes, ["TOK-02", "TOK-03"])

    def test_linear_calculator_uses_exact_window_overlap(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        schedule = [{"total_tokens": 1000, "start_date": now, "end_date": now + timedelta(days=100)}]
        result = calculate_windows([], schedule, now)
        self.assertEqual(result["7"], 70)
        self.assertEqual(result["30"], 300)
        self.assertEqual(result["90"], 900)

    def test_reconciliation_deduplicates_same_family(self):
        event = {"event_date": "2026-01-02", "token_amount": "10", "allocation": "TEAM", "event_type": "CLIFF"}
        result = reconcile_events([{"events": [event], "source": {"provider": "A", "source_family": "OFFICIAL"}}, {"events": [event], "source": {"provider": "B", "source_family": "OFFICIAL"}}])
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(len(result["events"]), 1)

    def test_reconciliation_flags_independent_amount_conflict(self):
        base = {"event_date": "2026-01-02", "allocation": "TEAM", "event_type": "CLIFF"}
        result = reconcile_events([{"events": [{**base, "token_amount": "10"}], "source": {"provider": "A", "source_family": "OFFICIAL"}}, {"events": [{**base, "token_amount": "12"}], "source": {"provider": "B", "source_family": "ONCHAIN"}}])
        self.assertEqual(result["status"], "CONFLICT")

    def test_official_schedule_provider_passes_complete_verified_schedule(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        profile = ChecklistProfile.objects.create(name="Unlock fixture", slug="unlock-fixture", config=default_config())
        run = ScanRun.objects.create(profile=profile, profile_snapshot=profile.config)
        candidate = Candidate.objects.create(scan_run=run, coingecko_id="fixture-coin", symbol="FIX", name="Fixture Coin", binance_pair="FIXUSDT", details={"market_snapshot": {"circulating_supply": 1000}})
        UnlockOfficialSchedule.objects.create(coingecko_id="fixture-coin", symbol="FIX", project_name="Fixture Coin", source_url="https://example.com/tokenomics", verified_at=now, schedule_payload={"schema_version": "unlock.schedule.v1", "coverage_end": "2026-12-31T00:00:00Z", "events": [{"event_date": "2026-01-03T00:00:00Z", "token_amount": "20", "allocation": "TEAM", "event_type": "CLIFF"}]})
        result = OfficialScheduleProvider().fetch(UnlockEvidenceService.identity(candidate), now)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["events"][0]["token_amount"], "20")

    def test_official_schedule_provider_rejects_insufficient_coverage(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        profile = ChecklistProfile.objects.create(name="Coverage fixture", slug="coverage-fixture", config=default_config())
        run = ScanRun.objects.create(profile=profile, profile_snapshot=profile.config)
        candidate = Candidate.objects.create(scan_run=run, coingecko_id="short-coin", symbol="SH", name="Short Coin", binance_pair="SHUSDT", details={"market_snapshot": {"circulating_supply": 1000}})
        UnlockOfficialSchedule.objects.create(coingecko_id="short-coin", symbol="SH", project_name="Short Coin", source_url="https://example.com/tokenomics", verified_at=now, schedule_payload={"schema_version": "unlock.schedule.v1", "coverage_end": "2026-01-30T00:00:00Z", "events": []})
        result = OfficialScheduleProvider().fetch(UnlockEvidenceService.identity(candidate), now)
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["source"]["status"], "INSUFFICIENT_COVERAGE")

    def test_unlock_service_end_to_end_pass_and_risk(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        profile = ChecklistProfile.objects.create(name="E2E fixture", slug="e2e-fixture", config=default_config())
        run = ScanRun.objects.create(profile=profile, profile_snapshot=profile.config)
        candidate = Candidate.objects.create(scan_run=run, coingecko_id="e2e-coin", symbol="E2E", name="E2E Coin", binance_pair="E2EUSDT", details={"market_snapshot": {"circulating_supply": 1000}})
        UnlockOfficialSchedule.objects.create(coingecko_id="e2e-coin", symbol="E2E", project_name="E2E Coin", source_url="https://example.com/e2e", verified_at=now, schedule_payload={"schema_version": "unlock.schedule.v1", "coverage_end": "2026-12-31T00:00:00Z", "events": [{"event_date": "2026-01-03T00:00:00Z", "token_amount": "20", "allocation": "TEAM", "event_type": "CLIFF"}]})
        result = UnlockEvidenceService(providers=(OfficialScheduleProvider(),)).collect(candidate, default_config()["tokenomics"], now)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["unlock_7d"]["tokens"], "20")
        self.assertEqual(result["risk_status"], "BLOCKED")
        self.assertIn("TOK-01", result["risk_codes"])

    def test_verified_schedule_requires_schema_and_source(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        row = UnlockOfficialSchedule(coingecko_id="bad", symbol="BAD", project_name="Bad", verified_at=now, verification_state="MANUAL_VERIFIED", schedule_payload={})
        with self.assertRaises(ValidationError):
            row.full_clean()

    def test_schedule_rejects_reversed_coverage(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        row = UnlockOfficialSchedule(coingecko_id="bad2", symbol="BAD", project_name="Bad", source_url="https://example.com", verified_at=now, coverage_start=now, coverage_end=now - timedelta(days=1), schedule_payload={"schema_version": "unlock.schedule.v1"})
        with self.assertRaises(ValidationError):
            row.full_clean()

    def test_public_web_parser_accepts_explicit_unlock_table_only(self):
        html = "<table><tr><th>Date</th><th>Token Amount</th></tr><tr><td>2026-04-01</td><td>12,500</td></tr></table>"
        events = parse_public_unlock_html(html)
        self.assertEqual(events[0]["token_amount"], "12500")
        self.assertEqual(events[0]["event_type"], "CLIFF")

    def test_public_web_parser_accepts_explicit_embedded_json(self):
        html = '<script type="application/ld+json">{"events":[{"date":"2026-05-01T00:00:00Z","tokens":"25"}]}</script>'
        self.assertEqual(parse_public_unlock_document(html)[0]["token_amount"], "25")

    def test_public_web_discovery_keeps_only_unlock_related_links(self):
        html = '<a href="https://project.example/tokenomics">Tokenomics</a><a href="https://project.example/about">About</a>'
        self.assertEqual(discover_unlock_links(html), ["https://project.example/tokenomics"])

    def test_public_web_provider_requires_90_day_horizon(self):
        class FixtureCrawler:
            def fetch(self, url):
                return {"status": "FETCHED", "url": url}

            def parse(self, result):
                return [{"event_date": "2026-04-01T00:00:00+00:00", "token_amount": "10", "allocation": "TEAM", "event_type": "CLIFF"}]

        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        profile = ChecklistProfile.objects.create(name="Web fixture", slug="web-fixture", config=default_config())
        run = ScanRun.objects.create(profile=profile, profile_snapshot=profile.config)
        candidate = Candidate.objects.create(scan_run=run, coingecko_id="web-coin", symbol="WEB", name="Web Coin", binance_pair="WEBUSDT", details={"market_snapshot": {"circulating_supply": 1000}, "unlock_urls": ["https://example.com/unlock"]})
        result = PublicWebUnlockProvider(crawler=FixtureCrawler()).fetch(UnlockEvidenceService.identity(candidate), now)
        self.assertEqual(result["status"], "PROVISIONAL")
        self.assertEqual(result["source"]["source_family"], "PUBLIC_WEB")


    def test_research_prefilter_prefers_configured_market_cap_band_without_calling_it_quality(self):
        cfg = {**default_config()["universe"], **default_config()["liquidity"], **default_config()["tokenomics"]}
        row = {
            "market_cap": 250_000_000,
            "total_volume": 30_000_000,
            "fully_diluted_valuation": 300_000_000,
            "circulating_supply": 800_000_000,
            "total_supply": 1_000_000_000,
        }
        result = research_prefilter(row, cfg)
        self.assertEqual(result["decision"], "ELIGIBLE")
        self.assertEqual(result["market_cap_priority"], "PRIORITY_A")
        self.assertEqual(result["fdv_band"], "GOOD")
        low, high, evidence = provisional_quality(row, cfg)
        self.assertIsNone(low)
        self.assertIsNone(high)
        self.assertEqual(evidence["note"], "Research prefilter only; not a V8.1 Quality Score.")

    def test_research_prefilter_does_not_invent_tok08_without_unlock_evidence(self):
        cfg = {**default_config()["universe"], **default_config()["liquidity"], **default_config()["tokenomics"]}
        row = {
            "market_cap": 200_000_000,
            "total_volume": 30_000_000,
            "fully_diluted_valuation": 1_200_000_000,
            "circulating_supply": 500_000_000,
            "total_supply": 1_000_000_000,
        }
        result = research_prefilter(row, cfg)
        self.assertEqual(result["decision"], "ELIGIBLE")
        self.assertEqual(result["fdv_band"], "EXCLUDE")
        self.assertIn("TOK-07", result["risk_codes"])
        self.assertNotIn("TOK-08", result["risk_codes"])

    def test_research_prefilter_dilution_risk_outranks_market_cap_preference(self):
        cfg = {**default_config()["universe"], **default_config()["liquidity"], **default_config()["tokenomics"]}
        preferred_but_diluted = research_prefilter({
            "market_cap": 200_000_000,
            "total_volume": 40_000_000,
            "fully_diluted_valuation": 1_200_000_000,
            "circulating_supply": 500_000_000,
            "total_supply": 1_000_000_000,
        }, cfg)
        supplementary_but_clean = research_prefilter({
            "market_cap": 600_000_000,
            "total_volume": 40_000_000,
            "fully_diluted_valuation": 720_000_000,
            "circulating_supply": 800_000_000,
            "total_supply": 1_000_000_000,
        }, cfg)
        self.assertLess(tuple(supplementary_but_clean["sort_key"]), tuple(preferred_but_diluted["sort_key"]))

    def test_research_prefilter_blocks_circulating_below_fifteen_percent(self):
        cfg = {**default_config()["universe"], **default_config()["liquidity"], **default_config()["tokenomics"]}
        row = {
            "market_cap": 200_000_000,
            "total_volume": 30_000_000,
            "fully_diluted_valuation": 250_000_000,
            "circulating_supply": 100_000_000,
            "total_supply": 1_000_000_000,
        }
        result = research_prefilter(row, cfg)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertIn("TOK-05", result["risk_codes"])

    def test_defillama_match_prefers_exact_gecko_id(self):
        indexes = build_defillama_indexes(
            [{"name": "Protocol One", "symbol": "ONE", "gecko_id": "protocol-one", "tvl": 1000000, "category": "Dexes"}],
            [], {}, {}, {},
        )
        candidate = Candidate(coingecko_id="protocol-one", symbol="ONE", name="Protocol One", binance_pair="ONEUSDT")
        match = match_defillama(candidate, indexes)
        self.assertEqual(match["protocol_match_method"], "GECKO_ID")
        self.assertEqual(match["protocol"]["name"], "Protocol One")

    def test_defillama_ambiguous_symbol_name_is_not_mapped(self):
        protocols = [
            {"name": "Same", "symbol": "SAME", "tvl": 1},
            {"name": "Same", "symbol": "SAME", "tvl": 2},
        ]
        indexes = build_defillama_indexes(protocols, [], {}, {}, {})
        candidate = Candidate(coingecko_id="no-match", symbol="SAME", name="Same", binance_pair="SAMEUSDT")
        match = match_defillama(candidate, indexes)
        self.assertIsNone(match["protocol"])

    def test_binance_ticker_map_uses_quote_volume(self):
        mapped = binance_ticker_map([{"symbol": "AAAUSDT", "quoteVolume": "25000000"}])
        self.assertEqual(mapped["AAAUSDT"]["quoteVolume"], "25000000")

    def test_research_evidence_prioritizes_quantitative_product_activity_without_creating_quality(self):
        protocols = [
            {"name": "Useful Protocol", "symbol": "USE", "gecko_id": "useful-protocol", "tvl": 100_000_000, "mcap": 200_000_000, "category": "Dexes", "slug": "useful-protocol"},
            {"name": "Peer A", "symbol": "PA", "gecko_id": "peer-a", "tvl": 50_000_000, "mcap": 150_000_000, "category": "Dexes"},
            {"name": "Peer B", "symbol": "PB", "gecko_id": "peer-b", "tvl": 80_000_000, "mcap": 160_000_000, "category": "Dexes"},
        ]
        fees = {"protocols": [{"name": "Useful Protocol", "slug": "useful-protocol", "total30d": 2_000_000}]}
        dex = {"protocols": [{"name": "Useful Protocol", "slug": "useful-protocol", "total30d": 50_000_000}]}
        indexes = build_defillama_indexes(protocols, [], fees, {}, dex)
        cfg = {**default_config()["universe"], **default_config()["liquidity"], **default_config()["tokenomics"]}
        snapshot = {
            "market_cap": 200_000_000, "total_volume": 25_000_000,
            "fully_diluted_valuation": 220_000_000,
            "circulating_supply": 900_000_000, "total_supply": 1_000_000_000,
        }
        prefilter = research_prefilter(snapshot, cfg)
        candidate = Candidate(coingecko_id="useful-protocol", symbol="USE", name="Useful Protocol", binance_pair="USEUSDT", market_cap_usd=200_000_000, volume_24h_usd=25_000_000)
        evidence = build_research_evidence(
            candidate, prefilter, {"symbol": "USEUSDT", "quoteVolume": "60000000", "count": 1000},
            match_defillama(candidate, indexes), indexes, "2026-08-08T00:00:00Z",
        )
        self.assertEqual(evidence["product"]["status"], "PASS")
        self.assertEqual(evidence["product"]["evidence_level"], "E2")
        self.assertEqual(evidence["priority_tier"], "EVIDENCE_A")
        self.assertEqual(evidence["quality_status"], "NOT_SCORED")
        self.assertEqual(evidence["token_value_capture"]["status"], "UNKNOWN")

    def test_research_evidence_falls_back_without_product_source(self):
        indexes = build_defillama_indexes([], [], {}, {}, {})
        cfg = {**default_config()["universe"], **default_config()["liquidity"], **default_config()["tokenomics"]}
        snapshot = {
            "market_cap": 200_000_000, "total_volume": 100_000_000,
            "fully_diluted_valuation": 220_000_000,
            "circulating_supply": 900_000_000, "total_supply": 1_000_000_000,
        }
        prefilter = research_prefilter(snapshot, cfg)
        candidate = Candidate(coingecko_id="meme", symbol="MEME", name="Meme", binance_pair="MEMEUSDT", market_cap_usd=200_000_000, volume_24h_usd=100_000_000)
        evidence = build_research_evidence(
            candidate, prefilter, {"symbol": "MEMEUSDT", "quoteVolume": "120000000"},
            match_defillama(candidate, indexes), indexes, "2026-08-08T00:00:00Z",
        )
        self.assertEqual(evidence["product"]["status"], "UNKNOWN")
        self.assertEqual(evidence["product"]["evidence_level"], "E0")
        self.assertEqual(evidence["priority_tier"], "PREFILTER_C")
        self.assertEqual(evidence["quality_status"], "NOT_SCORED")

    def test_research_sort_key_prefers_real_product_evidence_over_clean_prefilter_only_candidate(self):
        protocols = [{
            "name": "Useful Protocol", "symbol": "USE", "gecko_id": "useful-protocol",
            "tvl": 100_000_000, "mcap": 200_000_000, "category": "Dexes", "slug": "useful-protocol"
        }]
        fees = {"protocols": [{"name": "Useful Protocol", "slug": "useful-protocol", "total30d": 2_000_000}]}
        indexes = build_defillama_indexes(protocols, [], fees, {}, {})
        cfg = {**default_config()["universe"], **default_config()["liquidity"], **default_config()["tokenomics"]}

        product_snapshot = {
            "market_cap": 300_000_000, "total_volume": 30_000_000,
            "fully_diluted_valuation": 500_000_000,
            "circulating_supply": 700_000_000, "total_supply": 1_000_000_000,
        }
        no_product_snapshot = {
            "market_cap": 200_000_000, "total_volume": 100_000_000,
            "fully_diluted_valuation": 220_000_000,
            "circulating_supply": 950_000_000, "total_supply": 1_000_000_000,
        }
        product_candidate = Candidate(coingecko_id="useful-protocol", symbol="USE", name="Useful Protocol", binance_pair="USEUSDT", market_cap_usd=300_000_000, volume_24h_usd=30_000_000)
        no_product_candidate = Candidate(coingecko_id="meme", symbol="MEME", name="Meme", binance_pair="MEMEUSDT", market_cap_usd=200_000_000, volume_24h_usd=100_000_000)

        product_evidence = build_research_evidence(
            product_candidate, research_prefilter(product_snapshot, cfg),
            {"symbol": "USEUSDT", "quoteVolume": "30000000"},
            match_defillama(product_candidate, indexes), indexes, "2026-08-08T00:00:00Z",
        )
        no_product_evidence = build_research_evidence(
            no_product_candidate, research_prefilter(no_product_snapshot, cfg),
            {"symbol": "MEMEUSDT", "quoteVolume": "100000000"},
            match_defillama(no_product_candidate, indexes), indexes, "2026-08-08T00:00:00Z",
        )
        self.assertLess(tuple(product_evidence["sort_key"]), tuple(no_product_evidence["sort_key"]))

    def test_step_message_guard_enforces_database_max_length(self):
        limit = ScanStepRun._meta.get_field("message").max_length
        message = ScanOrchestrator._compact_step_message("x" * (limit + 200))
        self.assertLessEqual(len(message), limit)
        self.assertTrue(message.endswith("…"))

    @override_settings(RESEARCH_DEFILLAMA_ENABLED=True)
    def test_research_shortlist_multiple_provider_failures_fall_back_without_step_failure(self):
        class FailingResearchClient:
            def close(self):
                return None

            def binance_24h_tickers(self):
                return [{"symbol": "AAAUSDT", "quoteVolume": "25000000", "count": 1234}]

            @staticmethod
            def _fail(name):
                raise DataSourceError(f"{name}: " + ("provider unavailable; " * 40))

            def defillama_protocols(self):
                return self._fail("protocols")

            def defillama_chains(self):
                return self._fail("chains")

            def defillama_fees_overview(self, *, data_type=None):
                return self._fail("revenue" if data_type else "fees")

            def defillama_dex_overview(self):
                return self._fail("dex")

        config = default_config()
        profile = ChecklistProfile.objects.create(name="Research fallback", slug="research-fallback", config=config)
        run = ScanRun.objects.create(profile=profile, profile_snapshot=config, requested_steps=["RESEARCH_SHORTLIST"])
        step = ScanStepRun.objects.create(scan_run=run, step_key="RESEARCH_SHORTLIST", sequence=3)
        snapshot = {
            "market_cap": 200_000_000,
            "total_volume": 30_000_000,
            "fully_diluted_valuation": 240_000_000,
            "circulating_supply": 900_000_000,
            "total_supply": 1_000_000_000,
        }
        prefilter_cfg = {**config["universe"], **config["liquidity"], **config["tokenomics"]}
        Candidate.objects.create(
            scan_run=run, coingecko_id="aaa", symbol="AAA", name="AAA Protocol",
            binance_pair="AAAUSDT", stage="RESEARCH_POOL", market_cap_usd=200_000_000,
            volume_24h_usd=30_000_000, details={
                "market_snapshot": snapshot,
                "research_prefilter": research_prefilter(snapshot, prefilter_cfg),
                "quality_evidence": {"missing": ["product_metrics", "token_value_capture", "unlock", "valuation"]},
                "data_status": {},
            },
        )

        orchestrator = ScanOrchestrator(run)
        orchestrator.client.close()
        orchestrator.client = FailingResearchClient()
        orchestrator._run_step(3, "RESEARCH_SHORTLIST")

        step.refresh_from_db()
        candidate = Candidate.objects.get(scan_run=run, symbol="AAA")
        self.assertEqual(step.status, ScanStepRun.STATUS_WARNINGS)
        self.assertLessEqual(len(step.message), ScanStepRun._meta.get_field("message").max_length)
        self.assertEqual(step.payload["selection_mode"], "PREFILTER_ONLY_FALLBACK")
        self.assertTrue(step.payload["provider_degraded"])
        self.assertEqual(len(step.payload["unavailable_sources"]), 5)
        for key in ("defillama_protocols", "defillama_chains", "defillama_fees", "defillama_revenue", "defillama_dex"):
            self.assertEqual(step.payload["provider_status"][key]["status"], "UNAVAILABLE")
            self.assertGreater(len(step.payload["provider_status"][key]["error"]), 300)
        self.assertEqual(candidate.stage, "RESEARCH_SHORTLIST")
        self.assertEqual(candidate.quality_status, "NOT_SCORED")
        self.assertEqual(candidate.details["research_evidence"]["product"]["status"], "UNKNOWN")
        self.assertEqual(Notification.objects.filter(scan_run=run, step_key="RESEARCH_SHORTLIST").count(), 1)

    def test_checksum_is_stable(self):
        self.assertEqual(checksum_json({"a":1,"b":2}), checksum_json({"b":2,"a":1}))

    def test_dashboard_keeps_latest_successful_run_separate_from_failed_run(self):
        profile = ChecklistProfile.objects.create(
            name="Test profile", slug="test-profile", config=default_config(), is_active=True
        )
        successful = ScanRun.objects.create(profile=profile, profile_snapshot=profile.config, status=ScanRun.STATUS_COMPLETED)
        failed = ScanRun.objects.create(profile=profile, profile_snapshot=profile.config, status=ScanRun.STATUS_FAILED)

        response = APIClient().get("/api/dashboard/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["latest_run"]["id"], str(failed.id))
        self.assertEqual(response.data["latest_successful_run"]["id"], str(successful.id))

    def test_dashboard_returns_no_successful_run_when_only_failed_runs_exist(self):
        profile = ChecklistProfile.objects.create(
            name="Failed profile", slug="failed-profile", config=default_config(), is_active=True
        )
        ScanRun.objects.create(profile=profile, profile_snapshot=profile.config, status=ScanRun.STATUS_FAILED)

        response = APIClient().get("/api/dashboard/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["latest_successful_run"])

    def test_notification_history_returns_newest_first(self):
        profile = ChecklistProfile.objects.create(name="Notification profile", slug="notification-profile", config=default_config())
        run = ScanRun.objects.create(profile=profile, profile_snapshot=profile.config)
        from .models import Notification
        first = Notification.objects.create(title="First", scan_run=run)
        second = Notification.objects.create(title="Second", scan_run=run)
        response = APIClient().get("/api/notifications/?limit=2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [second.id, first.id])


class PipelineLifecycleTests(TestCase):
    class StubOrchestrator(ScanOrchestrator):
        """Network-free orchestration fixture for lifecycle/status semantics."""

        def _run_step(self, sequence, key):
            step = self._step(key)
            step.status = ScanStepRun.STATUS_RUNNING
            step.progress = 5
            step.started_at = datetime.now(timezone.utc)
            step.save()

            payload = {"message": f"Stub {key}"}
            has_warning = False
            if key == "UNIVERSE_SCAN":
                self.run.counters = {**self.run.counters, "initial_count": 500, "research_pool": 50}
                self.run.save(update_fields=["counters"])
            elif key == "MARKET_REGIME":
                results = dict(self.run.results)
                results["market_regime"] = {"status": "PROVISIONAL", "regime": "TRUNG TÍNH"}
                self.run.results = results
                self.run.save(update_fields=["results"])
                has_warning = True
            elif key == "RESEARCH_SHORTLIST":
                payload.update({
                    "selection_mode": "PREFILTER_ONLY",
                    "critical_missing": ["product_metrics", "token_value_capture", "unlock_7d_30d_90d", "valuation_peers"],
                })
                has_warning = True
            elif key == "EXECUTION_VERIFICATION":
                payload.update({"critical_missing": ["unlock_7d_30d_90d", "stop", "rr"]})
                has_warning = True
            elif key == "SCORING_VALIDATION":
                self.run.counters = {**self.run.counters, "buy_setup": 0}
                self.run.save(update_fields=["counters"])
                has_warning = True
            elif key == "INVESTMENT_RESULTS":
                results = dict(self.run.results)
                results["executive_decision"] = {"should_buy": "KHÔNG", "usdt_pct": 100, "buy_setup_count": 0}
                self.run.results = results
                self.run.save(update_fields=["results"])
                has_warning = True

            step.payload = payload
            step.status = ScanStepRun.STATUS_WARNINGS if has_warning else ScanStepRun.STATUS_COMPLETED
            step.progress = 100
            step.finished_at = datetime.now(timezone.utc)
            step.save()

    def setUp(self):
        self.profile = ChecklistProfile.objects.create(
            name="Lifecycle profile",
            slug="lifecycle-profile",
            config=default_config(),
            is_active=True,
        )

    def test_b4_only_is_partial_and_never_claims_full_scan_success(self):
        run = create_scan_run(self.profile, ["EXECUTION_VERIFICATION"], "FULL_SCAN_EXECUTION")
        self.assertEqual(run.requested_steps, ["UNIVERSE_SCAN", "MARKET_REGIME", "RESEARCH_SHORTLIST", "EXECUTION_VERIFICATION"])
        self.assertEqual(run.mode_requested, "FULL_SCAN_RESEARCH")
        self.assertEqual(run.results["run_scope"]["explicit_requested_steps"], ["EXECUTION_VERIFICATION"])
        self.assertEqual(run.results["run_scope"]["prerequisite_steps"], ["UNIVERSE_SCAN", "MARKET_REGIME", "RESEARCH_SHORTLIST"])

        self.StubOrchestrator(run).execute()
        run.refresh_from_db()

        self.assertEqual(run.status, ScanRun.STATUS_PARTIAL)
        self.assertEqual(run.progress, 67)
        self.assertEqual(run.validation["processing_progress_pct"], 100)
        self.assertEqual(run.validation["workflow_progress_pct"], 67)
        self.assertEqual(run.validation["completion_scope"], "PARTIAL_PIPELINE")
        self.assertEqual(run.validation["skipped_steps"], ["SCORING_VALIDATION", "INVESTMENT_RESULTS"])
        self.assertEqual(run.mode_validated, "FULL_SCAN_RESEARCH")
        self.assertEqual(run.steps.get(step_key="SCORING_VALIDATION").status, ScanStepRun.STATUS_SKIPPED)
        self.assertEqual(run.steps.get(step_key="INVESTMENT_RESULTS").status, ScanStepRun.STATUS_SKIPPED)

        notification = Notification.objects.filter(scan_run=run, step_key="").first()
        self.assertIsNotNone(notification)
        self.assertIn("Bước 4 hoàn tất", notification.title)
        self.assertIn("Bước 5–6 chưa chạy", notification.title)
        self.assertNotEqual(notification.title, "Quét đã hoàn tất")
        self.assertIn("Mode xác thực: FULL_SCAN_RESEARCH", notification.message)

    def test_full_request_runs_b5_b6_and_finishes_at_100_with_warning_semantics(self):
        run = create_scan_run(self.profile, None, "FULL_SCAN_EXECUTION")
        self.StubOrchestrator(run).execute()
        run.refresh_from_db()

        self.assertEqual(len(run.requested_steps), 6)
        self.assertEqual(run.progress, 100)
        self.assertEqual(run.validation["completion_scope"], "FULL_PIPELINE")
        self.assertEqual(run.validation["skipped_steps"], [])
        self.assertIn(run.steps.get(step_key="SCORING_VALIDATION").status, {ScanStepRun.STATUS_COMPLETED, ScanStepRun.STATUS_WARNINGS})
        self.assertIn(run.steps.get(step_key="INVESTMENT_RESULTS").status, {ScanStepRun.STATUS_COMPLETED, ScanStepRun.STATUS_WARNINGS})
        self.assertEqual(run.status, ScanRun.STATUS_WARNINGS)
        self.assertTrue(run.validation["mode_downgraded"])
        self.assertEqual(run.mode_validated, "FULL_SCAN_RESEARCH")

        notification = Notification.objects.filter(scan_run=run, step_key="").first()
        self.assertEqual(notification.title, "Quét hoàn tất có cảnh báo")
        self.assertNotEqual(notification.title, "Quét đã hoàn tất")
