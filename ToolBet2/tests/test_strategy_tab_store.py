from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from sqlalchemy import inspect

from main import HistoryWatcher
from src.capital_managers import MONEY_MANAGER_OPTIONS, create_money_manager
from src.money_state_store import MoneyStateStore
from src.database import StrategyMoneyConfigRecord, init_db
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
        changed.tabs[0].strategy_input = "BPP-BP"
        changed.tabs[0].money_manager_id = "IncreaseWhenWin"
        changed.tabs[0].stakes = [10, 100, 110]
        self.store.save_config(changed)

        reloaded = self.store.load_or_import(
            StrategyTabsConfig(tabs=[SimulationTabConfig(id="other", name="Khác")])
        )

        self.assertEqual("alpha", reloaded.tabs[0].id)
        self.assertEqual("Từ SQLite", reloaded.tabs[0].name)
        self.assertEqual("smart_prev", reloaded.tabs[0].strategy_id)
        self.assertEqual("BPP-BP", reloaded.tabs[0].strategy_input)
        self.assertEqual("IncreaseWhenWin", reloaded.tabs[0].money_manager_id)
        self.assertEqual([10, 100, 110], reloaded.tabs[0].stakes)

    def test_fresh_yaml_config_does_not_replace_saved_sqlite_tabs(self):
        saved = StrategyTabsConfig(
            selected_tab_id="saved",
            tabs=[
                SimulationTabConfig(
                    id="saved",
                    name="Đã lưu SQLite",
                    strategy_id="smart_prev",
                    money_manager_id="IncreaseWhenWin",
                    stakes=[25, 50, 100],
                )
            ],
        )
        self.store.save_config(saved)

        # update_site_url() constructs a fresh AppConfig from config.yaml.  Its
        # default strategy tabs must never overwrite the persisted workspace.
        after_site_update = self.store.load_or_import(StrategyTabsConfig())

        self.assertEqual("saved", after_site_update.selected_tab_id)
        self.assertEqual("smart_prev", after_site_update.tabs[0].strategy_id)
        self.assertEqual(
            "IncreaseWhenWin", after_site_update.tabs[0].money_manager_id
        )
        self.assertEqual([25, 50, 100], after_site_update.tabs[0].stakes)

    def test_workspace_rehydrates_sqlite_only_when_overlay_is_installed(self):
        saved = StrategyTabsConfig(
            selected_tab_id="saved",
            tabs=[
                SimulationTabConfig(
                    id="saved",
                    name="Đã lưu SQLite",
                    stakes=[10, 20, 40],
                )
            ],
        )
        self.store.save_config(saved)
        watcher = HistoryWatcher.__new__(HistoryWatcher)
        watcher.config = SimpleNamespace(strategy_tabs=StrategyTabsConfig())
        watcher.strategy_tab_store = self.store
        watcher.strategy_lifecycle = Mock()
        watcher.strategy_lifecycle.tabs_in_mode.return_value = []
        watcher.betting_session = SimpleNamespace(
            state=SimpleNamespace(auto_bet=False)
        )
        watcher._sync_live_money_managers = Mock()
        watcher._overlay_strategy_tabs_payload = Mock(return_value={"tabs": []})
        watcher.overlay = Mock()

        watcher._reload_workspace_for_overlay()

        self.assertEqual("saved", watcher.config.strategy_tabs.selected_tab_id)
        self.assertEqual([10, 20, 40], watcher.config.strategy_tabs.tabs[0].stakes)
        watcher._sync_live_money_managers.assert_called_once_with()
        watcher.overlay.set_strategy_tabs.assert_called_once_with({"tabs": []})

    def test_live_manager_is_rebuilt_when_stakes_change(self):
        tab = SimulationTabConfig(
            id="live-one",
            mode="live",
            money_manager_id="IncreaseWhenWin",
            stakes=[10, 100, 110],
        ).normalized()
        watcher = HistoryWatcher.__new__(HistoryWatcher)
        watcher.strategy_lifecycle = Mock()
        watcher.strategy_lifecycle.tabs_in_mode.return_value = [tab]
        watcher.money_state_store = Mock(spec=MoneyStateStore)
        watcher.money_state_store.restore.return_value = False
        stale = create_money_manager("IncreaseWhenWin", [20, 100, 110])
        watcher._live_money_managers = {tab.id: stale}

        watcher._sync_live_money_managers()

        refreshed = watcher._live_money_managers[tab.id]
        self.assertIsNot(stale, refreshed)
        self.assertEqual(10, refreshed.quote().stake)
        watcher.money_state_store.restore.assert_called_once_with(tab.id, refreshed)
        watcher.money_state_store.save.assert_called_once_with(tab.id, refreshed)

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

    def test_statistics_reset_anchor_is_durable_and_tab_scoped(self):
        self.store.save_config(
            StrategyTabsConfig(
                selected_tab_id="one",
                tabs=[
                    SimulationTabConfig(id="one"),
                    SimulationTabConfig(id="two"),
                ],
            )
        )
        status = {
            "signals": 9,
            "virtual_bets": 7,
            "wins": 4,
            "losses": 2,
            "pushes": 1,
            "current": {"side": "player"},
        }

        self.store.reset_statistics("one", status)
        baselines = self.store.statistics_baselines_for_tabs(["one", "two"])
        visible = self.store.apply_statistics_baseline(status, baselines["one"])

        self.assertEqual({}, baselines["two"])
        self.assertEqual(0, baselines["one"]["reset_after_allocation_id"])
        self.assertEqual(0, baselines["one"]["reset_after_signal_id"])
        self.assertEqual(9, visible["signals"])
        self.assertEqual(7, visible["virtual_bets"])
        self.assertEqual(4, visible["wins"])
        self.assertEqual(2, visible["losses"])
        self.assertEqual(1, visible["pushes"])
        self.assertEqual({"side": "player"}, visible["current"])

    def test_history_page_returns_newest_rows_first_with_bounded_page_size(self):
        self.store.save_config(StrategyTabsConfig(tabs=[SimulationTabConfig(id="one")]))
        for size in range(1, 26):
            self.store.record_overlay(
                {"tabs": [{"id": "one", "status": {"history_size": size}}]},
                table_name="C01",
            )

        page = self.store.history_page("one", page=1, page_size=10)
        second = self.store.history_page("one", page=2, page_size=10)

        self.assertEqual(25, page["total"])
        self.assertEqual(3, page["page_count"])
        self.assertEqual(25, page["items"][0]["history_size"])
        self.assertEqual(16, page["items"][-1]["history_size"])
        self.assertEqual(15, second["items"][0]["history_size"])

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

    def test_each_money_manager_keeps_its_own_stake_chain(self):
        config = StrategyTabsConfig(
            selected_tab_id="one",
            tabs=[
                SimulationTabConfig(
                    id="one",
                    money_manager_id="IncreaseWhenLose",
                    stakes=[1],
                )
            ],
        )
        self.store.save_config(config)
        config.tabs[0].money_manager_id = "IncreaseWhenWin"
        config.tabs[0].stakes = [2]
        self.store.save_config(config)
        config.tabs[0].money_manager_id = "Victor2"
        config.tabs[0].stakes = [3]
        self.store.save_config(config)

        money_configs = self.store.money_configs_for_tabs(["one"])["one"]

        self.assertEqual(
            {option["id"] for option in MONEY_MANAGER_OPTIONS},
            set(money_configs),
        )
        self.assertEqual([1], money_configs["IncreaseWhenLose"]["stakes"])
        self.assertEqual([2], money_configs["IncreaseWhenWin"]["stakes"])
        self.assertEqual([3], money_configs["Victor2"]["stakes"])
        self.assertEqual([0], money_configs["ReverseFibo"]["stakes"])
        self.assertEqual([[0]], money_configs["MultiChain"]["stake_chains"])

    def test_load_seeds_missing_money_managers_for_legacy_workspace(self):
        self.store.save_config(
            StrategyTabsConfig(
                selected_tab_id="one",
                tabs=[
                    SimulationTabConfig(
                        id="one",
                        money_manager_id="IncreaseWhenLose",
                        stakes=[1],
                    )
                ],
            )
        )
        session = self.session_factory()
        try:
            session.query(StrategyMoneyConfigRecord).filter(
                StrategyMoneyConfigRecord.tab_id == "one",
                StrategyMoneyConfigRecord.manager_id != "IncreaseWhenLose",
            ).delete(synchronize_session=False)
            session.commit()
        finally:
            session.close()

        self.store.load_or_import(StrategyTabsConfig())
        money_configs = self.store.money_configs_for_tabs(["one"])["one"]

        self.assertEqual(
            {option["id"] for option in MONEY_MANAGER_OPTIONS},
            set(money_configs),
        )
        self.assertEqual([1], money_configs["IncreaseWhenLose"]["stakes"])
        self.assertEqual([0], money_configs["ReverseFibo"]["stakes"])
