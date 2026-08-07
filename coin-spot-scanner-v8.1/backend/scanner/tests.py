from django.test import TestCase
from rest_framework.test import APIClient
from .models import ChecklistProfile, ScanRun
from .services import checksum_json, default_config, depth_metrics
from .market_regime import (
    analyze_breadth_and_volume, analyze_global, analyze_kline_group,
    classify_regime, compute_completeness, parse_closed_klines,
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
            rows.append([close_time - 86_000_000, close, close + 1, close - 1, close, 1000, close_time])
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
        btc, total3 = analyze_global({"market_cap_percentage": {"btc": 50, "eth": 10}, "total_market_cap": {"usd": 1000}})
        self.assertEqual(btc["status"], "UNKNOWN")
        self.assertEqual(total3["value"]["total3_proxy_usd"], 400.0)

    def test_breadth_and_volume_are_derived_from_same_dataset(self):
        dataset = {f"COIN{i}USDT": self._rows(30) for i in range(3)}
        breadth, volume = analyze_breadth_and_volume(dataset)
        self.assertEqual(breadth["value"]["eligible"], 3)
        self.assertEqual(volume["value"]["sample_count"], 3)

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
