from django.test import TestCase
from rest_framework.test import APIClient
from .models import ChecklistProfile, ScanRun
from .services import checksum_json, default_config, depth_metrics

class IntegrityTests(TestCase):
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
