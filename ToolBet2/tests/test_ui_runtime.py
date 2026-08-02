from __future__ import annotations

import unittest

from playwright.async_api import async_playwright
from pydantic import ValidationError

from src.capital_managers import MONEY_MANAGER_OPTIONS
from src.config import AppConfig
from src.overlay import GameOverlay
from src.strategy_tabs import SIMULATION_STRATEGIES
from src.ui_assets import load_ui_assets
from src.ui_contracts import UiCommand, UiCommandType, UiScreen, UiSnapshot
from src.ui_runtime import BrowserUiRuntime


class UiContractTests(unittest.TestCase):
    def test_snapshot_serializes_as_versioned_json_payload(self):
        snapshot = UiSnapshot(
            revision=4,
            screen=UiScreen.WORKSPACE,
            state={"table_name": "Baccarat C01"},
            tabs=[{"id": "tab-1", "name": "Chiến lược 1"}],
        )

        payload = snapshot.to_payload()

        self.assertEqual(1, payload["version"])
        self.assertEqual("workspace", payload["screen"])
        self.assertEqual("tab-1", payload["tabs"][0]["id"])

    def test_command_rejects_unknown_command_type(self):
        with self.assertRaises(ValidationError):
            UiCommand.model_validate({"type": "click_anything", "payload": {}})

    def test_command_gets_stable_identifier(self):
        command = UiCommand(type=UiCommandType.START_SIMULATION)

        self.assertTrue(command.command_id)
        self.assertEqual(1, command.version)

    def test_assets_are_loaded_from_separate_files(self):
        assets = load_ui_assets()

        self.assertIn("--tbv2-bg", assets.theme_css)
        self.assertIn(".tbv2-card", assets.components_css)
        self.assertIn("window.ToolBetUi", assets.bridge_js)

    def test_phase_c_workspace_is_default_and_legacy_is_rollback(self):
        config = AppConfig()

        self.assertTrue(config.ui.runtime_v2_enabled)
        self.assertFalse(config.ui.legacy_overlay_enabled)

    def test_overlay_initial_snapshot_keeps_workspace_catalogues(self):
        overlay = GameOverlay()
        overlay.set_strategy_tabs(
            {
                "selected_tab_id": "tab-1",
                "strategies": list(SIMULATION_STRATEGIES),
                "money_managers": list(MONEY_MANAGER_OPTIONS),
                "tabs": [{"id": "tab-1", "name": "Chiến lược 1"}],
            }
        )

        snapshot = overlay._build_ui_snapshot()
        catalogues = snapshot.state["strategy_tabs"]

        self.assertEqual(
            len(SIMULATION_STRATEGIES), len(catalogues["strategies"])
        )
        self.assertEqual(
            len(MONEY_MANAGER_OPTIONS), len(catalogues["money_managers"])
        )
        self.assertEqual("tab-1", snapshot.tabs[0]["id"])

    def test_overlay_enriches_raw_persisted_tabs_with_catalogues(self):
        overlay = GameOverlay()
        overlay.set_strategy_tabs(
            {
                "selected_tab_id": "tab-1",
                "tabs": [
                    {
                        "id": "tab-1",
                        "name": "Chiến lược đã lưu",
                        "strategy_id": "smart_prev",
                        "money_manager_id": "IncreaseWhenWin",
                        "stakes": [10, 100, 110],
                    }
                ],
            }
        )

        snapshot = overlay._build_ui_snapshot()
        workspace = snapshot.state["strategy_tabs"]

        self.assertTrue(workspace["strategies"])
        self.assertTrue(workspace["money_managers"])
        self.assertEqual("smart_prev", workspace["tabs"][0]["strategy_id"])
        self.assertEqual(
            "IncreaseWhenWin", workspace["tabs"][0]["money_manager_id"]
        )


class BrowserUiRuntimeFixtureTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page(viewport={"width": 1280, "height": 720})
        await self.page.goto("data:text/html,<html><head></head><body></body></html>")

    async def asyncTearDown(self):
        await self.browser.close()
        await self.playwright.stop()

    async def test_inject_dom_delete_reload_and_responsive_keep_state(self):
        runtime = BrowserUiRuntime(enabled=True)
        snapshot = UiSnapshot(
            revision=7,
            state={"table_name": "Baccarat C03", "simulation": {"pnl": 120}},
            tabs=[{"id": "tab-1", "name": "Chiến lược 1"}],
        )

        self.assertTrue(await runtime.install(self.page, snapshot))
        self.assertTrue(await runtime.present(self.page))

        await self.page.evaluate(
            """() => {
              document.getElementById('toolbet-ui-v2')?.remove();
              document.getElementById('toolbet-ui-v2-theme')?.remove();
              document.getElementById('toolbet-ui-v2-components')?.remove();
            }"""
        )
        self.assertFalse(await runtime.present(self.page))
        self.assertTrue(await runtime.update(self.page, snapshot))
        restored = await self.page.evaluate("() => window.ToolBetUi.snapshot()")
        self.assertEqual("Baccarat C03", restored["state"]["table_name"])
        self.assertEqual("tab-1", restored["tabs"][0]["id"])

        await self.page.reload()
        self.assertFalse(await runtime.present(self.page))
        self.assertTrue(await runtime.update(self.page, snapshot))
        restored_after_reload = await self.page.evaluate(
            "() => window.ToolBetUi.snapshot()"
        )
        self.assertEqual(7, restored_after_reload["revision"])
        self.assertEqual(120, restored_after_reload["state"]["simulation"]["pnl"])

        for width, height in ((360, 640), (1366, 768)):
            await self.page.set_viewport_size({"width": width, "height": height})
            bounds = await self.page.locator("#toolbet-ui-v2").bounding_box()
            self.assertIsNotNone(bounds)
            self.assertGreaterEqual(bounds["x"], 0)
            self.assertLessEqual(bounds["x"] + bounds["width"], width + 0.5)
            self.assertLessEqual(bounds["y"] + bounds["height"], height + 0.5)

        await runtime.remove(self.page)
        self.assertFalse(await runtime.present(self.page))

    async def test_initial_install_and_dom_reinstall_render_all_catalogues(self):
        overlay = GameOverlay()
        overlay.set_strategy_tabs(
            {
                "selected_tab_id": "tab-1",
                "strategies": list(SIMULATION_STRATEGIES),
                "money_managers": list(MONEY_MANAGER_OPTIONS),
                "tabs": [
                    {
                        "id": "tab-1",
                        "name": "Chiến lược 1",
                        "enabled": True,
                        "strategy_id": SIMULATION_STRATEGIES[0]["id"],
                        "money_manager_id": MONEY_MANAGER_OPTIONS[0]["id"],
                        "stakes": [0, 100],
                        "status": {},
                    }
                ],
            }
        )
        runtime = BrowserUiRuntime(enabled=True)

        snapshot = overlay._build_ui_snapshot()
        self.assertTrue(await runtime.install(self.page, snapshot))
        self.assertEqual(
            len(SIMULATION_STRATEGIES),
            await self.page.locator("#tbv2-strategy option").count(),
        )
        self.assertEqual(
            len(MONEY_MANAGER_OPTIONS),
            await self.page.locator("#tbv2-progression option").count(),
        )

        await self.page.locator("#toolbet-ui-v2").evaluate("(node) => node.remove()")
        self.assertTrue(await runtime.update(self.page, overlay._build_ui_snapshot()))
        self.assertEqual(
            len(SIMULATION_STRATEGIES),
            await self.page.locator("#tbv2-strategy option").count(),
        )
        self.assertEqual(
            len(MONEY_MANAGER_OPTIONS),
            await self.page.locator("#tbv2-progression option").count(),
        )

    async def test_realtime_update_preserves_unsaved_form_scroll_and_focus(self):
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": SIMULATION_STRATEGIES[0]["id"],
            "money_manager_id": MONEY_MANAGER_OPTIONS[0]["id"],
            "stakes": [0, 100, 110],
            "stop_loss": 0,
            "take_profit": 0,
            "status": {},
        }
        strategy_tabs = {
            "selected_tab_id": "tab-1",
            "strategies": list(SIMULATION_STRATEGIES),
            "money_managers": list(MONEY_MANAGER_OPTIONS),
            "tabs": [tab],
        }
        runtime = BrowserUiRuntime(enabled=True)
        initial = UiSnapshot(
            revision=1,
            state={"table": "Baccarat C01", "strategy_tabs": strategy_tabs},
            tabs=[tab],
        )
        self.assertTrue(await runtime.install(self.page, initial))

        strategy_id = SIMULATION_STRATEGIES[1]["id"]
        manager_id = MONEY_MANAGER_OPTIONS[1]["id"]
        await self.page.locator("#tbv2-strategy").select_option(strategy_id)
        await self.page.locator("#tbv2-progression").select_option(manager_id)
        await self.page.locator("#tbv2-stakes").fill("10-20-40-80")
        await self.page.locator("#tbv2-tp").fill("900")
        await self.page.locator("#tbv2-sl").fill("300")
        await self.page.locator("#tbv2-stakes").focus()
        await self.page.locator(".tbv2-scroll").evaluate(
            "(node) => { node.scrollTop = 240; }"
        )
        scroll_before = await self.page.locator(".tbv2-scroll").evaluate(
            "(node) => node.scrollTop"
        )

        updated_tab = {**tab, "status": {"signals": 1, "virtual_bets": 1}}
        updated_tabs = {**strategy_tabs, "tabs": [updated_tab]}
        realtime = UiSnapshot(
            revision=2,
            state={"table": "Baccarat C02", "strategy_tabs": updated_tabs},
            tabs=[updated_tab],
        )
        self.assertTrue(await runtime.update(self.page, realtime))

        self.assertEqual(
            strategy_id,
            await self.page.locator("#tbv2-strategy").input_value(),
        )
        self.assertEqual(
            manager_id,
            await self.page.locator("#tbv2-progression").input_value(),
        )
        self.assertEqual(
            "10-20-40-80",
            await self.page.locator("#tbv2-stakes").input_value(),
        )
        self.assertEqual("900", await self.page.locator("#tbv2-tp").input_value())
        self.assertEqual("300", await self.page.locator("#tbv2-sl").input_value())
        self.assertEqual(
            "tbv2-stakes",
            await self.page.evaluate("() => document.activeElement?.id"),
        )
        self.assertEqual(
            scroll_before,
            await self.page.locator(".tbv2-scroll").evaluate(
                "(node) => node.scrollTop"
            ),
        )
        self.assertIn(
            "Đang chờ lưu tự động",
            await self.page.locator(".tbv2-config-card .tbv2-message").inner_text(),
        )

    async def test_realtime_update_patches_regions_without_rebuilding_form(self):
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": SIMULATION_STRATEGIES[0]["id"],
            "money_manager_id": MONEY_MANAGER_OPTIONS[0]["id"],
            "stakes": [0, 100],
            "status": {},
            "history": [],
        }
        strategy_tabs = {
            "selected_tab_id": "tab-1",
            "strategies": list(SIMULATION_STRATEGIES),
            "money_managers": list(MONEY_MANAGER_OPTIONS),
            "tabs": [tab],
        }
        runtime = BrowserUiRuntime(enabled=True)
        initial = UiSnapshot(
            revision=1,
            state={
                "runtime_session_id": "same-session",
                "table": "Baccarat C01",
                "history_dots": [],
                "strategy_tabs": strategy_tabs,
            },
            tabs=[tab],
        )
        self.assertTrue(await runtime.install(self.page, initial))
        await self.page.evaluate(
            """() => {
              window.__toolbetConfigNode = document.querySelector(
                '.tbv2-config-card'
              );
              window.__toolbetStrategyInput = document.querySelector(
                '#tbv2-strategy'
              );
              window.__toolbetRoadNode = document.querySelector('.tbv2-road');
            }"""
        )

        updated_tab = {
            **tab,
            "status": {
                "wins": 2,
                "losses": 1,
                "signals": 3,
                "virtual_bets": 3,
                "pnl": 80,
                "current": {
                    "side": "banker",
                    "stake": 100,
                    "level": 2,
                    "total_levels": 2,
                    "reason": "Tín hiệu mới",
                    "risk": {"allowed": True},
                },
            },
            "history": [
                {
                    "history_size": 3,
                    "wins": 2,
                    "losses": 1,
                    "pushes": 0,
                    "virtual_bets": 3,
                    "pnl": 80,
                }
            ],
        }
        updated_workspace = {**strategy_tabs, "tabs": [updated_tab]}
        realtime = UiSnapshot(
            revision=2,
            state={
                "runtime_session_id": "same-session",
                "table": "Baccarat C02",
                "history_dots": [
                    {"side": "player", "label": "xanh"},
                    {"side": "banker", "label": "đỏ"},
                ],
                "strategy_tabs": updated_workspace,
            },
            tabs=[updated_tab],
        )

        self.assertTrue(await runtime.update(self.page, realtime))
        identities = await self.page.evaluate(
            """() => ({
              config: window.__toolbetConfigNode === document.querySelector(
                '.tbv2-config-card'
              ),
              strategy: window.__toolbetStrategyInput === document.querySelector(
                '#tbv2-strategy'
              ),
              road: window.__toolbetRoadNode === document.querySelector(
                '.tbv2-road'
              ),
            })"""
        )
        self.assertEqual(
            {"config": True, "strategy": True, "road": True},
            identities,
        )
        self.assertEqual(
            "Baccarat C02",
            await self.page.locator('[data-bind="status-table"]').inner_text(),
        )
        self.assertEqual(
            "100",
            await self.page.locator('[data-bind="status-stake"]').inner_text(),
        )
        self.assertEqual(2, await self.page.locator(".tbv2-road .tbv2-dot").count())
        self.assertEqual(
            "2",
            await self.page.locator('[data-bind="stats-wins"]').inner_text(),
        )

    async def test_older_revision_cannot_overwrite_newer_snapshot(self):
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "strategy_id": SIMULATION_STRATEGIES[0]["id"],
            "money_manager_id": MONEY_MANAGER_OPTIONS[0]["id"],
            "stakes": [0, 100],
            "status": {},
        }
        workspace = {
            "selected_tab_id": "tab-1",
            "strategies": list(SIMULATION_STRATEGIES),
            "money_managers": list(MONEY_MANAGER_OPTIONS),
            "tabs": [tab],
        }
        runtime = BrowserUiRuntime(enabled=True)
        newer = UiSnapshot(
            revision=20,
            state={
                "runtime_session_id": "revision-session",
                "table": "NEWER C20",
                "strategy_tabs": workspace,
            },
            tabs=[tab],
        )
        older = UiSnapshot(
            revision=19,
            state={
                "runtime_session_id": "revision-session",
                "table": "OLDER C19",
                "strategy_tabs": workspace,
            },
            tabs=[tab],
        )
        self.assertTrue(await runtime.install(self.page, newer))

        # Python runtime rejects stale work before crossing CDP.
        self.assertTrue(await runtime.update(self.page, older))
        self.assertEqual(
            "NEWER C20",
            await self.page.locator('[data-bind="status-table"]').inner_text(),
        )

        # Browser bridge also protects against an out-of-order direct delivery.
        self.assertTrue(
            await self.page.evaluate(
                "snapshot => window.ToolBetUi.update(snapshot)",
                older.to_payload(),
            )
        )
        browser_snapshot = await self.page.evaluate(
            "() => window.ToolBetUi.snapshot()"
        )
        self.assertEqual(20, browser_snapshot["revision"])
        self.assertEqual("NEWER C20", browser_snapshot["state"]["table"])

    async def test_workspace_can_be_dragged_and_keeps_position_on_update(self):
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": SIMULATION_STRATEGIES[0]["id"],
            "money_manager_id": MONEY_MANAGER_OPTIONS[0]["id"],
            "stakes": [0, 100],
            "status": {},
        }
        snapshot = UiSnapshot(
            revision=1,
            state={
                "strategy_tabs": {
                    "selected_tab_id": "tab-1",
                    "strategies": list(SIMULATION_STRATEGIES),
                    "money_managers": list(MONEY_MANAGER_OPTIONS),
                    "tabs": [tab],
                }
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))
        before = await self.page.locator("#toolbet-ui-v2").bounding_box()
        header = await self.page.locator(".tbv2-header").bounding_box()
        self.assertIsNotNone(before)
        self.assertIsNotNone(header)

        await self.page.mouse.move(header["x"] + 30, header["y"] + 20)
        await self.page.mouse.down()
        await self.page.mouse.move(header["x"] + 260, header["y"] + 20)
        await self.page.mouse.up()
        moved = await self.page.locator("#toolbet-ui-v2").bounding_box()
        self.assertGreater(moved["x"], before["x"] + 100)

        self.assertTrue(await runtime.update(self.page, snapshot))
        after_update = await self.page.locator("#toolbet-ui-v2").bounding_box()
        self.assertAlmostEqual(moved["x"], after_update["x"], delta=1)

        await self.page.locator(".tbv2-brand").dblclick()
        reset = await self.page.locator("#toolbet-ui-v2").bounding_box()
        self.assertAlmostEqual(10, reset["x"], delta=1)

    async def test_table_history_stays_visible_during_same_table_empty_snapshot(self):
        tab = {"id": "tab-1", "name": "Chiến lược 1", "status": {}}
        initial = UiSnapshot(
            revision=1,
            state={
                "table": "Baccarat C02",
                "table_id": "C02",
                "history_dots": [
                    {"side": "player", "label": "xanh"},
                    {"side": "banker", "label": "đỏ"},
                ],
                "strategy_tabs": {"tabs": [tab]},
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, initial))
        self.assertEqual(2, await self.page.locator(".tbv2-road .tbv2-dot").count())
        self.assertEqual(
            "Baccarat C02",
            await self.page.locator('[data-bind="status-table"]').inner_text(),
        )

        empty_same_table = UiSnapshot(
            revision=2,
            state={
                "table": "Baccarat C02",
                "table_id": "C02",
                "history_dots": [],
                "strategy_tabs": {"tabs": [tab]},
            },
            tabs=[tab],
        )
        self.assertTrue(await runtime.update(self.page, empty_same_table))
        self.assertEqual(2, await self.page.locator(".tbv2-road .tbv2-dot").count())
        self.assertIn(
            "Nhà cái",
            await self.page.locator(".tbv2-status-grid").inner_text(),
        )

        missing_table = UiSnapshot(
            revision=3,
            state={
                "table": "",
                "table_id": "",
                "history_dots": [],
                "strategy_tabs": {"tabs": [tab]},
            },
            tabs=[tab],
        )
        self.assertTrue(await runtime.update(self.page, missing_table))
        self.assertEqual(
            "Baccarat C02",
            await self.page.locator('[data-bind="status-table"]').inner_text(),
        )

        empty_new_table = UiSnapshot(
            revision=4,
            state={
                "table": "Baccarat C03",
                "table_id": "C03",
                "history_dots": [],
                "strategy_tabs": {"tabs": [tab]},
            },
            tabs=[tab],
        )
        self.assertTrue(await runtime.update(self.page, empty_new_table))
        self.assertEqual(0, await self.page.locator(".tbv2-road .tbv2-dot").count())

    async def test_new_runtime_session_discards_old_draft_and_restores_sqlite_values(self):
        tab_id = "persisted-tab"
        persisted_tab = {
            "id": tab_id,
            "name": "Chiến lược đã lưu",
            "enabled": True,
            "strategy_id": "smart_prev",
            "money_manager_id": "IncreaseWhenWin",
            "stakes": [10, 100, 110],
            "status": {},
        }
        workspace = {
            "selected_tab_id": tab_id,
            "strategies": list(SIMULATION_STRATEGIES),
            "money_managers": list(MONEY_MANAGER_OPTIONS),
            "tabs": [persisted_tab],
        }
        runtime = BrowserUiRuntime(enabled=True)
        old_session = UiSnapshot(
            revision=1,
            state={
                "runtime_session_id": "old-session",
                "strategy_tabs": workspace,
            },
            tabs=[persisted_tab],
        )
        self.assertTrue(await runtime.install(self.page, old_session))

        await self.page.locator("#tbv2-strategy").select_option("legacy_patterns")
        await self.page.locator("#tbv2-progression").select_option(
            "IncreaseWhenLose"
        )
        await self.page.locator("#tbv2-stakes").fill("0-100-110-120-130")
        self.assertEqual(
            "legacy_patterns",
            await self.page.locator("#tbv2-strategy").input_value(),
        )

        restarted_session = UiSnapshot(
            revision=1,
            state={
                "runtime_session_id": "new-session",
                "strategy_tabs": workspace,
            },
            tabs=[persisted_tab],
        )
        self.assertTrue(await runtime.install(self.page, restarted_session))

        self.assertEqual(
            "smart_prev",
            await self.page.locator("#tbv2-strategy").input_value(),
        )
        self.assertEqual(
            "IncreaseWhenWin",
            await self.page.locator("#tbv2-progression").input_value(),
        )
        self.assertEqual(
            "10-100-110",
            await self.page.locator("#tbv2-stakes").input_value(),
        )
        self.assertEqual(
            {},
            await self.page.evaluate("() => window.__toolbetUiLocal.drafts"),
        )

    async def test_missing_catalogue_does_not_replace_persisted_id_with_default(self):
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "strategy_id": "smart_prev",
            "money_manager_id": "IncreaseWhenWin",
            "stakes": [10, 100],
            "status": {},
        }
        snapshot = UiSnapshot(
            revision=1,
            state={
                "strategy_tabs": {
                    "selected_tab_id": "tab-1",
                    "strategies": [
                        {"id": "legacy_patterns", "label": "Mẫu mặc định"}
                    ],
                    "money_managers": [],
                    "tabs": [tab],
                }
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))

        self.assertEqual(
            "smart_prev",
            await self.page.locator("#tbv2-strategy").input_value(),
        )
        self.assertEqual(
            "IncreaseWhenWin",
            await self.page.locator("#tbv2-progression").input_value(),
        )
        self.assertIn(
            "Đang tải",
            await self.page.locator("#tbv2-strategy option:checked").inner_text(),
        )

    async def test_workspace_auto_save_bridge_sends_simulation_tab_config(self):
        received = []

        async def save_strategy_tabs(payload):
            received.append(payload)
            return {
                "ok": True,
                "strategy_tabs": {
                    "mode": "simulation",
                    "selected_tab_id": payload["selected_tab_id"],
                    "strategies": [
                        {"id": "follow_last", "label": "Bám kết quả trước"}
                    ],
                    "money_managers": list(MONEY_MANAGER_OPTIONS),
                    "tabs": payload["tabs"],
                },
            }

        await self.page.expose_function(
            "toolbetSaveStrategyTabs", save_strategy_tabs
        )
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": "follow_last",
            "stakes": [0, 100, 120],
            "progression_mode": "loss_up_win_reset",
            "money_manager_id": "IncreaseWhenLose",
            "stake_chains": [],
            "stop_loss": 500,
            "take_profit": 2000,
            "status": {"virtual_bets": 4},
            "history": [{"history_size": 4}],
        }
        snapshot = UiSnapshot(
            revision=8,
            state={
                "table": "Baccarat C03",
                "strategy_tabs": {
                    "mode": "simulation",
                    "selected_tab_id": "tab-1",
                    "strategies": [
                        {"id": "follow_last", "label": "Bám kết quả trước"}
                    ],
                    "money_managers": list(MONEY_MANAGER_OPTIONS),
                    "tabs": [tab],
                },
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))
        await self.page.locator("#tbv2-name").fill("Tab đã lưu")
        await self.page.wait_for_function(
            "() => window.__toolbetUiSnapshot.tabs[0].name === 'Tab đã lưu'"
        )

        self.assertEqual(1, len(received))
        saved_tab = received[0]["tabs"][0]
        self.assertEqual("Tab đã lưu", saved_tab["name"])
        self.assertEqual("IncreaseWhenLose", saved_tab["money_manager_id"])
        self.assertEqual("simulation", saved_tab["mode"])
        self.assertNotIn("status", saved_tab)
        self.assertNotIn("history", saved_tab)
        self.assertNotIn("auto_bet", received[0])
        self.assertEqual(
            0,
            await self.page.get_by_role("button", name="Lưu cấu hình").count(),
        )

    async def test_workspace_lifecycle_action_uses_typed_command_bridge(self):
        received = []

        async def ui_command(command):
            received.append(command)
            return {
                "ok": True,
                "data": {
                    "tab_id": "tab-1",
                    "running": True,
                    "auto_bet": True,
                },
            }

        await self.page.expose_function("toolbetUiCommand", ui_command)
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": "legacy_patterns",
            "stakes": [0, 100],
            "progression_mode": "loss_up_win_reset",
            "stop_loss": 0,
            "take_profit": 0,
            "mode": "live",
            "lifecycle": {"mode": "live"},
            "status": {},
        }
        snapshot = UiSnapshot(
            revision=9,
            state={
                "auto_bet": False,
                "strategy_tabs": {
                    "selected_tab_id": "tab-1",
                    "strategies": [
                        {"id": "legacy_patterns", "label": "Mẫu ToolBet v2"}
                    ],
                    "tabs": [tab],
                }
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))
        await self.page.get_by_role(
            "button", name="Bắt đầu chạy thật"
        ).click()
        await self.page.wait_for_function(
            "() => window.ToolBetUi.snapshot().state.auto_bet === true"
        )
        self.assertEqual(1, len(received))
        self.assertEqual("set_run_state", received[0]["type"])
        self.assertTrue(received[0]["payload"]["running"])

    async def test_license_status_and_tool_logout_use_typed_command(self):
        received = []

        async def ui_command(command):
            received.append(command)
            return {"ok": True, "data": {"screen": "tool_login"}}

        await self.page.expose_function("toolbetUiCommand", ui_command)
        await self.page.evaluate("window.confirm = () => true")
        snapshot = UiSnapshot(
            revision=10,
            state={
                "license": {
                    "allowed": True,
                    "status": "valid",
                    "reason": "License hợp lệ",
                    "username": "operator",
                    "plan": "pilot",
                },
                "strategy_tabs": {
                    "selected_tab_id": "tab-1",
                    "strategies": [],
                    "money_managers": [],
                    "tabs": [
                        {
                            "id": "tab-1",
                            "name": "Chiến lược 1",
                            "enabled": True,
                            "stakes": [0],
                            "status": {},
                        }
                    ],
                },
            },
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))

        await self.page.get_by_role("button", name="Thoát Tool").click()
        await self.page.wait_for_function(
            "() => document.querySelector('.tbv2-license') !== null"
        )

        self.assertEqual("tool_logout", received[0]["type"])
