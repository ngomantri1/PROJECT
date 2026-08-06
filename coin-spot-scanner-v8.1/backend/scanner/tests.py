from django.test import TestCase
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
