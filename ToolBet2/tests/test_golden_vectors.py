from __future__ import annotations

import json
import os
import subprocess
import unittest
from pathlib import Path

from scripts.golden_vectors import DEFAULT_CASES, evaluate_cases, load_cases


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = ROOT / "tests" / "golden_vectors" / "expected.json"
CSPROJ = ROOT / "tests" / "golden_vectors" / "csharp" / "GoldenVectors.csproj"


class GoldenVectorTests(unittest.TestCase):
    def test_python_money_manager_matches_checked_in_reference_vectors(self):
        expected = json.loads(EXPECTED.read_text(encoding="utf-8"))
        self.assertEqual(expected, evaluate_cases(load_cases()))

    @unittest.skipUnless(
        os.environ.get("TOOLBET_GOLDEN_CSHARP") == "1",
        "Set TOOLBET_GOLDEN_CSHARP=1 to compile and run the C# reference harness",
    )
    def test_csharp_reference_matches_checked_in_vectors(self):
        expected = json.loads(EXPECTED.read_text(encoding="utf-8"))
        completed = subprocess.run(
            ["dotnet", "run", "--project", str(CSPROJ), "--", str(DEFAULT_CASES)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=True,
        )
        self.assertEqual(expected, json.loads(completed.stdout))
