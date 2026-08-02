from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sqlalchemy import inspect

from src.database import init_db
from src.strategy_tab_store import StrategyTabStore
from src.strategy_tabs import SimulationTabConfig, StrategyTabsConfig


class StrategyTabStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "toolbet.db"
        self.session_factory = init_db(str(self.db_path))
        self.engine = self.session_factory.kw["bind"]
        self.store = StrategyTabStore(self.session_factory)

    def tearDown(self):
        self.engine.dispose()
        self.temp.cleanup()

    def test_schema_contains_config_runtime_and_history_tables(self):
        names = set(inspect(self.engine).get_table_names())

        self.assertIn("strategy_tabs", names)
        self.assertIn("strategy_tab_runtime", names)
        self.assertIn("strategy_tab_history", names)
        self.assertIn("strategy_money_configs", names)

    def test_imports_fallback_once_then_sqlite_is_authoritative(self):
        fallback = StrategyTabsConfig(
            selected_tab_id="alpha",
            tabs=[SimulationTabConfig(id="alpha", name="Từ YAML")],
        )
        imported = self.store.load_or_import(fallback)
        changed = imported.model_copy(deep=True)
        changed.tabs[0].name = "Từ SQLite"
        changed.tabs[0].strategy_id = "smart_prev"
        changed.tabs[0].money_manager_id = "IncreaseWhenWin"
        changed.tabs[0].stakes = [10, 100, 110]
        self.store.save_config(changed)

        reloaded = self.store.load_or_import(
            StrategyTabsConfig(tabs=[SimulationTabConfig(id="other", name="Khác")])
        )

        self.assertEqual("alpha", reloaded.tabs[0].id)
        self.assertEqual("Từ SQLite", reloaded.tabs[0].name)
        self.assertEqual("smart_prev", reloaded.tabs[0].strategy_id)
        self.assertEqual("IncreaseWhenWin", reloaded.tabs[0].money_manager_id)
        self.assertEqual([10, 100, 110], reloaded.tabs[0].stakes)

    def test_each_tab_has_independent_runtime_and_history(self):
        config = StrategyTabsConfig(
            selected_tab_id="one",
            tabs=[
                SimulationTabConfig(id="one", name="Một"),
                SimulationTabConfig(id="two", name="Hai"),
            ],
        )
        self.store.save_config(config)
        self.store.record_overlay(
            {
                "tabs": [
                    {
                        "id": "one",
                        "status": {
                            "history_size": 12,
                            "signals": 5,
                            "virtual_bets": 4,
                            "wins": 3,
                            "losses": 1,
                            "pushes": 0,
                            "pnl": 200,
                            "current": {"side": "player"},
                        },
                    },
                    {
                        "id": "two",
                        "status": {
                            "history_size": 12,
                            "signals": 6,
                            "virtual_bets": 5,
                            "wins": 1,
                            "losses": 4,
                            "pushes": 0,
                            "pnl": -300,
                            "current": {"side": "banker"},
                        },
                    },
                ]
            },
            table_name="Baccarat C01",
        )

        history = self.store.history_for_tabs(["one", "two"])

        self.assertEqual(200, history["one"][0]["pnl"])
        self.assertEqual("player", history["one"][0]["current"]["side"])
        self.assertEqual(-300, history["two"][0]["pnl"])
        self.assertEqual("banker", history["two"][0]["current"]["side"])

    def test_duplicate_history_point_is_not_appended_twice(self):
        self.store.save_config(
            StrategyTabsConfig(tabs=[SimulationTabConfig(id="one")])
        )
        payload = {"tabs": [{"id": "one", "status": {"history_size": 8}}]}

        self.store.record_overlay(payload, table_name="C01")
        self.store.record_overlay(payload, table_name="C01")

        self.assertEqual(1, len(self.store.history_for_tabs(["one"])["one"]))

    def test_stake_chains_are_independent_per_tab_and_money_manager(self):
        base = StrategyTabsConfig(
            selected_tab_id="one",
            tabs=[
                SimulationTabConfig(
                    id="one",
                    money_manager_id="IncreaseWhenLose",
                    stakes=[10, 20],
                )
            ],
        )
        self.store.save_config(base)
        changed = base.model_copy(deep=True)
        changed.tabs[0].money_manager_id = "MultiChain"
        changed.tabs[0].stakes = [30, 60]
        changed.tabs[0].stake_chains = [[30, 60], [100, 200]]
        self.store.save_config(changed)

        configs = self.store.money_configs_for_tabs(["one"])

        self.assertEqual(
            [10, 20], configs["one"]["IncreaseWhenLose"]["stakes"]
        )
        self.assertEqual(
            [[30, 60], [100, 200]],
            configs["one"]["MultiChain"]["stake_chains"],
        )
