from __future__ import annotations

import tempfile
import unittest
import sqlite3
from pathlib import Path

from sqlalchemy import inspect

from src.capital_managers import create_money_manager
from src.database import init_db
from src.models import BetSide
from src.money_state_store import MoneyStateStore
from src.strategy_tab_store import StrategyTabStore
from src.strategy_tabs import SimulationTabConfig, StrategyTabsConfig


class MoneyStateStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "toolbet.db"
        self.session_factory = init_db(str(self.db_path))
        self.engine = self.session_factory.kw["bind"]
        StrategyTabStore(self.session_factory).save_config(
            StrategyTabsConfig(
                tabs=[SimulationTabConfig(id="tab-one")]
            )
        )
        self.store = MoneyStateStore(self.session_factory)

    def tearDown(self):
        self.engine.dispose()
        self.temp.cleanup()

    def test_schema_has_tab_manager_state_table(self):
        self.assertIn(
            "strategy_money_states",
            set(inspect(self.engine).get_table_names()),
        )

    def test_old_money_state_schema_gets_additive_recovery_columns(self):
        old_path = Path(self.temp.name) / "old-toolbet.db"
        connection = sqlite3.connect(old_path)
        try:
            connection.execute(
                "CREATE TABLE strategy_money_states ("
                "id INTEGER PRIMARY KEY, tab_id VARCHAR(64), "
                "manager_id VARCHAR(64), config_fingerprint VARCHAR(64), "
                "state_json TEXT, updated_at DATETIME)"
            )
            connection.commit()
        finally:
            connection.close()

        old_factory = init_db(str(old_path))
        try:
            columns = {
                item["name"]
                for item in inspect(old_factory.kw["bind"]).get_columns(
                    "strategy_money_states"
                )
            }
            self.assertIn("settled_state_json", columns)
            self.assertIn("recovery_epoch", columns)
        finally:
            old_factory.kw["bind"].dispose()

    def test_restart_restores_same_next_quote_and_result(self):
        first = create_money_manager("Victor2", [10, 20, 40])
        first.apply_result(BetSide.PLAYER, BetSide.BANKER)
        first.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        self.store.save("tab-one", first)

        restarted = create_money_manager("Victor2", [10, 20, 40])
        self.assertTrue(self.store.restore("tab-one", restarted))
        self.assertEqual(first.quote(), restarted.quote())

        expected = first.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        actual = restarted.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        self.assertEqual(expected, actual)

    def test_state_is_independent_per_manager_and_config(self):
        lose = create_money_manager("IncreaseWhenLose", [10, 20])
        lose.apply_result(BetSide.PLAYER, BetSide.BANKER)
        self.store.save("tab-one", lose)

        other = create_money_manager("IncreaseWhenWin", [10, 20])
        changed = create_money_manager("IncreaseWhenLose", [10, 30])

        self.assertFalse(self.store.restore("tab-one", other))
        self.assertFalse(self.store.restore("tab-one", changed))

    def test_recovery_epoch_restores_last_settled_without_fake_outcome(self):
        manager = create_money_manager("IncreaseWhenLose", [10, 20, 40])
        manager.apply_result(BetSide.PLAYER, BetSide.BANKER)
        self.store.save("tab-one", manager, settled=True)
        settled_quote = manager.quote()

        manager.apply_result(BetSide.PLAYER, BetSide.BANKER)
        self.store.save("tab-one", manager, settled=False)
        self.assertNotEqual(settled_quote, manager.quote())

        epoch = self.store.recover_from_last_settled(
            "tab-one", manager, bet_id=27, reason="uncertain old click"
        )

        self.assertEqual(1, epoch)
        self.assertEqual(settled_quote, manager.quote())
        self.assertEqual({"tab-one": 1}, self.store.recovery_epochs())


if __name__ == "__main__":
    unittest.main()
