from __future__ import annotations

import io
import os
import sqlite3
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from src.release_cli import handle_release_command


class ReleaseCliStakeZeroTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "config.yaml").write_text(
            "betting:\n  auto_bet: false\ndatabase:\n  path: runtime.db\n",
            encoding="utf-8",
        )
        connection = sqlite3.connect(self.root / "runtime.db")
        connection.executescript(
            """
            CREATE TABLE bets (
                id INTEGER PRIMARY KEY,
                outcome TEXT,
                stake FLOAT,
                status TEXT,
                execution_mode TEXT
            );
            CREATE TABLE strategy_tabs (
                id TEXT PRIMARY KEY, ordinal INTEGER, active INTEGER,
                mode TEXT, money_manager_id TEXT, stakes_json TEXT,
                stake_chains_json TEXT
            );
            CREATE TABLE strategy_money_configs (
                id INTEGER PRIMARY KEY, tab_id TEXT, manager_id TEXT,
                stakes_json TEXT, stake_chains_json TEXT
            );
            INSERT INTO strategy_tabs VALUES
                ('zero', 0, 1, 'live', 'IncreaseWhenLose', '[0]', '[]');
            """
        )
        connection.commit()
        connection.close()
        self.previous_cwd = Path.cwd()
        os.chdir(self.root)

    def tearDown(self) -> None:
        os.chdir(self.previous_cwd)
        self.tmp.cleanup()

    def test_packaged_start_returns_baseline(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            code = handle_release_command(["--stake-zero-audit", "start"])

        self.assertEqual(0, code)
        self.assertIn('"baseline_bet_id": 0', output.getvalue())

    def test_packaged_finish_reports_virtual_resolved_window(self) -> None:
        connection = sqlite3.connect(self.root / "runtime.db")
        connection.execute(
            "INSERT INTO bets VALUES (1, 'win', 0, 'resolved', 'virtual')"
        )
        connection.commit()
        connection.close()
        output = io.StringIO()

        with redirect_stdout(output):
            code = handle_release_command(
                ["--stake-zero-audit", "finish", "--after-bet-id", "0"]
            )

        self.assertEqual(0, code)
        self.assertIn('"passed": true', output.getvalue())


if __name__ == "__main__":
    unittest.main()
