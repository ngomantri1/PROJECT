from __future__ import annotations

import os
import subprocess
import unittest

from scripts.strategy_golden_vectors import DEFAULT_CASES, evaluate_cases, load_cases


ROOT = DEFAULT_CASES.parents[2]
CSPROJ = ROOT / "tests" / "golden_vectors" / "strategies_csharp" / "StrategyGolden.csproj"


class StrategyGoldenVectorTests(unittest.TestCase):
    def test_python_strategy_vectors_cover_side_stake_level_and_pnl(self):
        result = evaluate_cases(load_cases())
        self.assertEqual(8, len(result))
        self.assertEqual("P", result["dual-ai-tie"][0]["side"])
        for rows in result.values():
            self.assertTrue(rows)
            for row in rows:
                self.assertIn(row["side"], ("B", "P"))
                self.assertGreaterEqual(row["stake"], 0)
                self.assertGreaterEqual(row["level_index"], 0)
                self.assertIn("pnl", row)

    @unittest.skipUnless(
        os.environ.get("TOOLBET_GOLDEN_CSHARP") == "1",
        "Set TOOLBET_GOLDEN_CSHARP=1 to run the C# reference assembly",
    )
    def test_csharp_reference_strategies_match_python_vectors(self):
        expected = evaluate_cases(load_cases())
        completed = subprocess.run(
            ["dotnet", "run", "--project", str(CSPROJ), "--", str(DEFAULT_CASES)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=True,
        )
        import json

        self.assertEqual(expected, json.loads(completed.stdout))
