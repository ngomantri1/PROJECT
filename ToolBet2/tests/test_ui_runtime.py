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

    def test_overlay_reinstall_snapshot_keeps_operator_run_latch(self):
        overlay = GameOverlay()
        overlay.set_run_enabled(True)
        overlay.set_betting_ui(
            auto_bet=False,
            stop_loss=0,
            take_profit=0,
        )

        snapshot = overlay._build_ui_snapshot()

        self.assertTrue(snapshot.state["run_enabled"])
        self.assertFalse(snapshot.state.get("auto_bet", False))

    def test_overlay_workspace_starts_locked_until_initial_table_snapshot(self):
        overlay = GameOverlay()

        self.assertTrue(overlay._build_ui_snapshot().state["workspace_loading"])

        overlay.set_workspace_loading(False)
        self.assertFalse(overlay._build_ui_snapshot().state["workspace_loading"])


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

        initial_scroll = await self.page.locator(".tbv2-scroll").evaluate(
            """(node) => {
              node.style.height = '100px';
              node.style.overflowY = 'scroll';
              node.scrollTop = 80;
              return node.scrollTop;
            }"""
        )
        self.assertGreater(initial_scroll, 0)
        self.assertTrue(await runtime.install(self.page, snapshot))
        self.assertEqual(
            initial_scroll,
            await self.page.locator(".tbv2-scroll").evaluate("(node) => node.scrollTop"),
        )

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

    async def test_workspace_loading_locks_controls_then_unlocks_with_snapshot(self):
        tab = {
            "id": "tab-1",
            "name": "Chiáº¿n lÆ°á»£c 1",
            "enabled": True,
            "running": True,
            "strategy_id": SIMULATION_STRATEGIES[0]["id"],
            "money_manager_id": MONEY_MANAGER_OPTIONS[0]["id"],
            "stakes": [10, 100],
            "status": {},
        }
        workspace = {
            "selected_tab_id": "tab-1",
            "strategies": list(SIMULATION_STRATEGIES),
            "money_managers": list(MONEY_MANAGER_OPTIONS),
            "tabs": [tab],
        }
        runtime = BrowserUiRuntime(enabled=True)
        loading = UiSnapshot(
            revision=1,
            state={
                "runtime_session_id": "loading-session",
                "workspace_loading": True,
                "strategy_tabs": workspace,
            },
            tabs=[tab],
        )
        self.assertTrue(await runtime.install(self.page, loading))
        self.assertTrue(await self.page.locator(".tbv2-loading-cover").is_visible())
        self.assertEqual(
            "true",
            await self.page.locator(".tbv2-tabs").get_attribute("aria-busy"),
        )
        self.assertTrue(
            await self.page.locator(".tbv2-tabs").evaluate("node => node.inert")
        )

        await self.page.evaluate(
            """() => {
              window.__toolbetUiLocal.workspaceLoadingSince = Date.now() - 16000;
              window.__toolbetUiLocal.workspaceLoadingTimer = null;
            }"""
        )
        timed_out = UiSnapshot(
            revision=2,
            state={**loading.state, "workspace_loading": True},
            tabs=[tab],
        )
        self.assertTrue(await runtime.update(self.page, timed_out))
        self.assertIn(
            "Chưa nhận được dữ liệu bàn",
            await self.page.locator('[data-bind="workspace-loading-message"]').inner_text(),
        )

        ready = UiSnapshot(
            revision=3,
            state={**loading.state, "workspace_loading": False, "table": "Baccarat C01"},
            tabs=[tab],
        )
        self.assertTrue(await runtime.update(self.page, ready))
        self.assertFalse(await self.page.locator(".tbv2-loading-cover").is_visible())
        self.assertEqual(
            "false",
            await self.page.locator(".tbv2-tabs").get_attribute("aria-busy"),
        )
        self.assertFalse(
            await self.page.locator(".tbv2-tabs").evaluate("node => node.inert")
        )
        self.assertEqual(
            [],
            await self.page.locator(".tbv2-tab[data-tab-id='tab-1']").evaluate(
                "node => [...node.parentElement.closest('[inert]') ? [node.parentElement.closest('[inert]')] : []].map(item => item.tagName)"
            ),
        )

    async def test_tab_selection_is_immediate_and_does_not_save_workspace(self):
        first = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": "follow_last",
            "money_manager_id": "IncreaseWhenLose",
            "stakes": [10],
            "status": {"current": {"stake": 10}},
        }
        second = {
            "id": "tab-2",
            "name": "Chiến lược 2",
            "enabled": True,
            "strategy_id": "follow_last",
            "money_manager_id": "IncreaseWhenLose",
            "stakes": [120],
            "status": {"current": {"stake": 120}},
        }
        received = []

        async def save_strategy_tabs(payload):
            received.append(payload)
            return {"ok": False, "error": "selection must not save"}

        await self.page.expose_function("toolbetSaveStrategyTabs", save_strategy_tabs)
        snapshot = UiSnapshot(
            revision=1,
            state={
                "strategy_tabs": {
                    "selected_tab_id": "tab-2",
                    "strategies": list(SIMULATION_STRATEGIES),
                    "money_managers": list(MONEY_MANAGER_OPTIONS),
                    "tabs": [first, second],
                },
            },
            tabs=[first, second],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))
        self.assertEqual("120", await self.page.locator("#tbv2-stakes").input_value())
        self.assertFalse(
            await self.page.locator(".tbv2-tabs").evaluate("node => node.inert")
        )

        await self.page.locator(".tbv2-tab[data-tab-id='tab-1']").click()

        self.assertEqual(
            "tab-1",
            await self.page.evaluate("() => window.__toolbetUiLocal.selectedId"),
        )
        self.assertEqual("10", await self.page.locator("#tbv2-stakes").input_value())
        self.assertTrue(
            await self.page.locator(".tbv2-tab[data-tab-id='tab-1']").evaluate(
                "node => node.classList.contains('active')"
            )
        )
        self.assertEqual([], received)

    async def test_initial_install_and_dom_reinstall_render_all_catalogues(self):
        overlay = GameOverlay()
        overlay.set_run_enabled(True)
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
        self.assertTrue(
            await self.page.get_by_role("button", name="Dừng chạy thật").is_visible()
        )
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
        self.assertTrue(
            await self.page.get_by_role("button", name="Dừng chạy thật").is_visible()
        )
        self.assertEqual(
            len(SIMULATION_STRATEGIES),
            await self.page.locator("#tbv2-strategy option").count(),
        )
        self.assertEqual(
            len(MONEY_MANAGER_OPTIONS),
            await self.page.locator("#tbv2-progression option").count(),
        )

    async def test_runtime_workspace_is_reported_present_without_legacy_panels(self):
        overlay = GameOverlay()
        overlay.configure_ui_runtime(
            runtime_v2_enabled=True, legacy_overlay_enabled=False
        )
        overlay.set_strategy_tabs(
            {
                "selected_tab_id": "tab-1",
                "strategies": list(SIMULATION_STRATEGIES),
                "money_managers": list(MONEY_MANAGER_OPTIONS),
                "tabs": [{"id": "tab-1", "name": "Chiến lược 1"}],
            }
        )
        self.assertTrue(
            await overlay._ui_runtime.install(self.page, overlay._build_ui_snapshot())
        )

        self.assertTrue(await overlay._panels_present(self.page))

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
        self.assertEqual(
            0,
            await self.page.locator(".tbv2-config-card .tbv2-message").count(),
        )

    async def test_realtime_update_patches_regions_without_rebuilding_form(self):
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "running": True,
            "strategy_id": SIMULATION_STRATEGIES[0]["id"],
            "money_manager_id": MONEY_MANAGER_OPTIONS[0]["id"],
            "stakes": [0, 100],
            "status": {},
            "history": [],
            "win_loss_history": [],
            "bet_history": [],
            "bet_history_pagination": {
                "page": 1, "page_size": 10, "total": 0, "page_count": 1,
            },
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
                "click_in_progress": False,
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
            "win_loss_history": [
                {"outcome": "loss", "side": "player", "stake": 100, "profit": -100, "round": 2},
                {"outcome": "win", "side": "banker", "stake": 100, "profit": 95, "round": 3},
            ],
            "bet_history": [
                {
                    "bet_id": 102, "placed_at": "2026-08-05T21:45:05",
                    "table_name": "Baccarat C02", "shoe": 7, "round": 3,
                    "side": "banker", "stake": 100,
                    "execution_mode": "virtual", "placement_status": "virtual",
                    "outcome": "win", "profit": 95,
                    "reason": "Tín hiệu mới", "signal_id": "signal-3",
                    "stake_index": 1,
                },
                {
                    "bet_id": 103, "placed_at": "2026-08-05T21:46:05",
                    "table_name": "Baccarat C02", "shoe": 7, "round": 4,
                    "side": "player", "stake": 120,
                    "execution_mode": "real", "placement_status": "placed",
                    "outcome": None, "profit": None,
                    "reason": "Tín hiệu mới", "signal_id": "signal-4",
                    "stake_index": 2,
                },
            ],
            "bet_history_pagination": {
                "page": 1, "page_size": 10, "total": 2, "page_count": 1,
            },
        }
        updated_workspace = {**strategy_tabs, "tabs": [updated_tab]}
        realtime = UiSnapshot(
            revision=2,
            state={
                "runtime_session_id": "same-session",
                "table": "Baccarat C02",
                "click_in_progress": True,
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
        self.assertEqual(
            3,
            await self.page.locator(".tbv2-status-grid").evaluate(
                "node => getComputedStyle(node).gridTemplateColumns.split(' ').length"
            ),
        )
        self.assertIn(
            "tbv2-result-banker",
            await self.page.locator('[data-bind="status-side"]').get_attribute("class"),
        )
        self.assertIn(
            "tbv2-result-banker",
            await self.page.locator('[data-bind="status-last-result"]').get_attribute("class"),
        )
        self.assertEqual(2, await self.page.locator(".tbv2-road .tbv2-dot").count())
        self.assertEqual(1, await self.page.locator(".tbv2-road .tbv2-dot-latest").count())
        self.assertTrue(
            await self.page.locator(".tbv2-road .tbv2-dot:last-child").evaluate(
                "node => node.classList.contains('tbv2-dot-latest')"
            )
        )
        self.assertEqual(
            "2/1/0",
            await self.page.locator('[data-bind="stats-results"]').inner_text(),
        )
        self.assertEqual(
            ["Thua", "Thắng"],
            await self.page.locator('[data-bind="win-loss-history"] .tbv2-win-loss').all_inner_texts(),
        )
        self.assertEqual(
            1,
            await self.page.locator('[data-bind="win-loss-history"] .tbv2-win-loss-latest').count(),
        )
        self.assertEqual(
            ["Thắng", "Đang chờ"],
            await self.page.locator(
                '[data-bind="bet-history-body"] .tbv2-bet-outcome'
            ).all_inner_texts(),
        )
        self.assertEqual(
            "Mô phỏng",
            await self.page.locator(
                '[data-bind="bet-history-body"] .tbv2-bet-mode.virtual'
            ).inner_text(),
        )
        self.assertEqual(
            2,
            await self.page.locator(
                '[data-bind="bet-history-body"] .tbv2-bet-row-new'
            ).count(),
        )
        self.assertEqual(
            "Trang 1/1 · 2 cược",
            await self.page.locator(
                '[data-bind="bet-history-page-label"]'
            ).inner_text(),
        )

        self.assertIn(
            "cấu hình mới",
            await self.page.locator('[data-bind="lifecycle-message"]').inner_text(),
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

        await self.page.locator("#tbv2-strategy").select_option("follow_last")
        await self.page.locator("#tbv2-progression").select_option(
            "IncreaseWhenLose"
        )
        await self.page.locator("#tbv2-stakes").fill("0-100-110-120-130")
        self.assertEqual(
            "follow_last",
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
        await self.page.locator("#tbv2-stakes").fill("10-100-120")
        await self.page.wait_for_function(
            "() => window.__toolbetUiSnapshot.tabs[0].stakes[0] === 10"
        )

        self.assertEqual(1, len(received))
        saved_tab = received[0]["tabs"][0]
        self.assertEqual("Chiến lược 1", saved_tab["name"])
        self.assertEqual("IncreaseWhenLose", saved_tab["money_manager_id"])
        self.assertEqual("simulation", saved_tab["mode"])
        self.assertNotIn("status", saved_tab)
        self.assertNotIn("history", saved_tab)
        self.assertNotIn("auto_bet", received[0])
        self.assertEqual(
            0,
            await self.page.get_by_role("button", name="Lưu cấu hình").count(),
        )

    async def test_tab_name_is_edited_in_place_and_escape_cancels(self):
        received = []

        async def save_strategy_tabs(payload):
            received.append(payload)
            return {"ok": True, "strategy_tabs": {"tabs": payload["tabs"]}}

        await self.page.expose_function("toolbetSaveStrategyTabs", save_strategy_tabs)
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": "follow_last",
            "money_manager_id": "IncreaseWhenLose",
            "stakes": [10],
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
                },
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))

        name = self.page.locator(".tbv2-tab-name")
        await name.dblclick()
        editor = self.page.locator(".tbv2-tab-name-edit")
        self.assertEqual(1, await editor.count())
        await editor.fill("Tab da doi")
        await editor.press("Enter")
        await self.page.wait_for_function(
            "() => window.__toolbetUiSnapshot.tabs[0].name === 'Tab da doi'"
        )
        self.assertEqual("Tab da doi", received[0]["tabs"][0]["name"])

        renamed = self.page.locator(".tbv2-tab-name")
        await renamed.dblclick()
        editor = self.page.locator(".tbv2-tab-name-edit")
        await editor.fill("Khong luu")
        await editor.press("Escape")
        self.assertEqual(1, len(received))
        self.assertEqual(
            "Tab da doi", await self.page.locator(".tbv2-tab-name").inner_text()
        )

    async def test_simulation_checkbox_persists_live_mode_immediately(self):
        received = []

        async def save_strategy_tabs(payload):
            received.append(payload)
            return {
                "ok": True,
                "strategy_tabs": {
                    "mode": "live",
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
            "id": "tab-live-save",
            "name": "Chiến lược Live",
            "enabled": True,
            "strategy_id": "follow_last",
            "stakes": [20, 100],
            "progression_mode": "loss_up_win_reset",
            "money_manager_id": "IncreaseWhenLose",
            "stake_chains": [],
            "stop_loss": 0,
            "take_profit": 0,
            "mode": "simulation",
            "run_profit": -120,
            "status": {"pnl": -999},
        }
        snapshot = UiSnapshot(
            revision=9,
            state={
                "strategy_tabs": {
                    "mode": "simulation",
                    "selected_tab_id": tab["id"],
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
        self.assertEqual(
            ["tbv2-run-toggle", "tbv2-simulation-only", None],
            await self.page.locator(".tbv2-run-actions > *").evaluate_all(
                "nodes => nodes.map(node => node.id || node.querySelector('input')?.id)"
            ),
        )
        self.assertEqual("Mô phỏng", await self.page.locator(".tbv2-run-actions label").inner_text())
        self.assertEqual(
            "-120",
            await self.page.locator("[data-bind='status-profit']").inner_text(),
        )
        self.assertEqual(
            "Không click chip",
            await self.page.locator(".tbv2-execution-badge").inner_text(),
        )

        await self.page.locator("#tbv2-simulation-only").uncheck()
        self.assertEqual("LIVE", await self.page.locator(".tbv2-execution-badge").inner_text())
        self.assertIn(
            "live",
            await self.page.locator(".tbv2-execution-badge").get_attribute("class"),
        )
        await self.page.wait_for_timeout(100)

        self.assertEqual(1, len(received))
        self.assertEqual("live", received[0]["tabs"][0]["mode"])
        self.assertFalse(
            await self.page.locator("#tbv2-simulation-only").is_checked()
        )
        self.assertEqual(
            "-120",
            await self.page.locator("[data-bind='status-profit']").inner_text(),
        )

    async def test_multi_chain_uses_one_stake_chain_per_line(self):
        received = []

        async def save_strategy_tabs(payload):
            received.append(payload)
            return {"ok": True, "strategy_tabs": {"tabs": payload["tabs"]}}

        await self.page.expose_function("toolbetSaveStrategyTabs", save_strategy_tabs)
        tab = {
            "id": "tab-1",
            "name": "Strategy 1",
            "enabled": True,
            "strategy_id": SIMULATION_STRATEGIES[0]["id"],
            "money_manager_id": "MultiChain",
            "stakes": [10, 20],
            "stake_chains": [[10, 20], [50, 100]],
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
                },
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))
        stakes = self.page.locator("#tbv2-stakes")
        self.assertEqual("TEXTAREA", await stakes.evaluate("(node) => node.tagName"))
        self.assertEqual("10-20\n50-100", await stakes.input_value())
        self.assertEqual(
            "Chu\u1ed7i ti\u1ec1n (m\u1ed7i d\u00f2ng m\u1ed9t chu\u1ed7i)".upper(),
            await self.page.locator("#tbv2-stakes")
            .locator("xpath=ancestor::label[1]//span")
            .inner_text(),
        )
        self.assertGreaterEqual(
            (await stakes.bounding_box())["height"],
            60,
        )

        await stakes.fill("1-2-3\n10-20-30")
        await self.page.wait_for_function(
            "() => window.__toolbetUiSnapshot.tabs[0].stakes.join('-') === '1-2-3'"
        )

        self.assertEqual(1, len(received))
        saved_tab = received[0]["tabs"][0]
        self.assertEqual("MultiChain", saved_tab["money_manager_id"])
        self.assertEqual([1, 2, 3], saved_tab["stakes"])
        self.assertEqual([[1, 2, 3], [10, 20, 30]], saved_tab["stake_chains"])

    async def test_start_action_stays_visible_for_a_simulation_tab(self):
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": "follow_last",
            "stakes": [0, 100],
            "money_manager_id": "IncreaseWhenLose",
            "stake_chains": [],
            "mode": "simulation",
            "status": {},
        }
        snapshot = UiSnapshot(
            revision=1,
            state={
                "auto_bet": False,
                "strategy_tabs": {
                    "selected_tab_id": "tab-1",
                    "strategies": list(SIMULATION_STRATEGIES),
                    "money_managers": list(MONEY_MANAGER_OPTIONS),
                    "tabs": [tab],
                },
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))

        toggle = self.page.locator("#tbv2-run-toggle")
        self.assertTrue(await toggle.is_visible())
        await self.page.locator("#tbv2-simulation-only").uncheck()
        self.assertTrue(await toggle.is_visible())

    async def test_long_strategy_configuration_values_have_tooltips(self):
        tab = {
            "id": "tab-1",
            "name": "Strategy 1",
            "enabled": True,
            "strategy_id": "follow_last",
            "money_manager_id": "IncreaseWhenLose",
            "stakes": [10, 100, 120, 140, 160, 200, 250],
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
                },
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))

        for selector in ("#tbv2-strategy", "#tbv2-progression"):
            self.assertEqual(
                await self.page.locator(f"{selector} option:checked").inner_text(),
                await self.page.locator(selector).get_attribute("title"),
            )
        stakes = self.page.locator("#tbv2-stakes")
        self.assertEqual(await stakes.input_value(), await stakes.get_attribute("title"))

        await stakes.fill("10-100-120-140-160-200-250-300")
        self.assertEqual(await stakes.input_value(), await stakes.get_attribute("title"))

    async def test_workspace_lifecycle_action_uses_typed_command_bridge(self):
        received = []

        async def ui_command(command):
            received.append(command)
            return {
                "ok": True,
                "data": {
                    "tab_id": "tab-1",
                    "running": True,
                    "run_enabled": True,
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
                "run_enabled": False,
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
            "() => window.ToolBetUi.snapshot().state.run_enabled === true"
        )
        self.assertEqual(1, len(received))
        self.assertEqual("set_run_state", received[0]["type"])
        self.assertTrue(received[0]["payload"]["running"])
        self.assertEqual("tab-1", received[0]["payload"]["tab_id"])
        self.assertTrue(
            await self.page.locator(".tbv2-tab[data-tab-id='tab-1']").evaluate(
                "node => node.classList.contains('running')"
            )
        )

    async def test_statistics_reset_button_uses_typed_command_and_updates_values(self):
        received = []

        async def ui_command(command):
            received.append(command)
            return {
                "ok": True,
                "data": {
                    "tab_id": "tab-1",
                    "status": {
                        "wins": 0,
                        "losses": 0,
                        "pushes": 0,
                        "signals": 0,
                        "virtual_bets": 0,
                        "statistics_profit": 0,
                    },
                },
            }

        await self.page.expose_function("toolbetUiCommand", ui_command)
        tab = {
            "id": "tab-1",
            "name": "Chiáº¿n lÆ°á»£c 1",
            "enabled": True,
            "strategy_id": "follow_last",
            "stakes": [10],
            "run_profit": -120,
            "status": {
                "wins": 4,
                "losses": 3,
                "pushes": 1,
                "signals": 8,
                "virtual_bets": 7,
                "statistics_profit": 45,
            },
        }
        snapshot = UiSnapshot(
            revision=1,
            state={
                "strategy_tabs": {
                    "selected_tab_id": "tab-1",
                    "strategies": list(SIMULATION_STRATEGIES),
                    "money_managers": list(MONEY_MANAGER_OPTIONS),
                    "tabs": [tab],
                },
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))

        await self.page.get_by_role("button", name="Reset thống kê").click()

        self.assertEqual(1, len(received))
        self.assertEqual("reset_tab_statistics", received[0]["type"])
        self.assertEqual({"tab_id": "tab-1"}, received[0]["payload"])
        self.assertEqual("0/0/0", await self.page.locator("[data-bind='stats-results']").inner_text())
        self.assertEqual("0", await self.page.locator("[data-bind='stats-pnl']").inner_text())
        self.assertEqual("-120", await self.page.locator("[data-bind='status-profit']").inner_text())

    async def test_runtime_refresh_keeps_tab_id_for_start_stop_start(self):
        received = []

        async def ui_command(command):
            received.append(command)
            running = bool(command["payload"]["running"])
            return {
                "ok": True,
                "data": {
                    "tab_id": command["payload"]["tab_id"],
                    "running": running,
                    "run_enabled": running,
                },
            }

        await self.page.expose_function("toolbetUiCommand", ui_command)
        tab = {
            "id": "tab-1",
            "name": "Chiến lược 1",
            "enabled": True,
            "strategy_id": "legacy_patterns",
            "stakes": [0, 100],
            "mode": "live",
            "lifecycle": {"mode": "live"},
            "status": {},
        }
        snapshot = UiSnapshot(
            revision=9,
            state={
                "run_enabled": False,
                "strategy_tabs": {
                    "selected_tab_id": "tab-1",
                    "strategies": [
                        {"id": "legacy_patterns", "label": "Mẫu ToolBet v2"}
                    ],
                    "tabs": [tab],
                },
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))

        await self.page.locator("#tbv2-run-toggle").click()
        self.assertEqual("tab-1", received[-1]["payload"]["tab_id"])
        self.assertTrue(received[-1]["payload"]["running"])

        running_tab = {**tab, "running": True}
        refreshed = UiSnapshot(
            revision=10,
            state={**snapshot.state, "run_enabled": True},
            tabs=[running_tab],
        )
        self.assertTrue(await runtime.update(self.page, refreshed))
        toggle = self.page.get_by_role("button", name="Dừng chạy thật")
        self.assertTrue(await toggle.is_visible())
        await toggle.click()

        self.assertEqual(2, len(received))
        self.assertEqual("set_run_state", received[1]["type"])
        self.assertEqual("tab-1", received[1]["payload"]["tab_id"])
        self.assertFalse(received[1]["payload"]["running"])

        stopped_tab = {**tab, "running": False}
        stopped = UiSnapshot(
            revision=11,
            state={**snapshot.state, "run_enabled": False},
            tabs=[stopped_tab],
        )
        self.assertTrue(await runtime.update(self.page, stopped))
        await self.page.locator("#tbv2-run-toggle").click()

        self.assertEqual(3, len(received))
        self.assertEqual("tab-1", received[2]["payload"]["tab_id"])
        self.assertTrue(received[2]["payload"]["running"])

    async def test_run_command_error_is_shown_next_to_the_toggle(self):
        async def ui_command(_command):
            return {"ok": False, "error": "Tab đang bị chặn"}

        await self.page.expose_function("toolbetUiCommand", ui_command)
        tab = {
            "id": "tab-1",
            "name": "Strategy 1",
            "enabled": True,
            "strategy_id": "follow_last",
            "stakes": [10],
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
                },
            },
            tabs=[tab],
        )
        runtime = BrowserUiRuntime(enabled=True)
        self.assertTrue(await runtime.install(self.page, snapshot))

        await self.page.locator("#tbv2-run-toggle").click()

        feedback = self.page.locator("[data-bind='lifecycle-message']")
        self.assertEqual("Tab đang bị chặn", await feedback.inner_text())
        self.assertTrue(await feedback.evaluate("node => node.classList.contains('error')"))

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
