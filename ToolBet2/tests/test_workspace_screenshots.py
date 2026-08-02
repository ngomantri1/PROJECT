from __future__ import annotations

import io
import os
import unittest
from pathlib import Path

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

from src.capital_managers import MONEY_MANAGER_OPTIONS
from src.ui_contracts import UiSnapshot
from src.ui_runtime import BrowserUiRuntime


SNAPSHOT_DIR = Path(__file__).with_name("snapshots")
CASES = (
    ("workspace_1280x720.png", 1280, 720, 1.0),
    ("workspace_1920x1080_dpi125.png", 1920, 1080, 1.25),
    ("workspace_390x844_dpi2.png", 390, 844, 2.0),
)


def _snapshot() -> UiSnapshot:
    strategies = [
        {"id": "legacy_patterns", "label": "Mẫu ToolBet v2 hiện tại"},
        {"id": "follow_last", "label": "Bám kết quả trước"},
        {"id": "reverse_last", "label": "Đảo kết quả trước"},
    ]
    history = [
        {"history_size": 20 + index, "wins": 8 + index, "losses": 5,
         "pushes": 1, "virtual_bets": 14 + index, "pnl": 120 + index * 20}
        for index in range(4)
    ]
    tabs = [
        {
            "id": "tab-one", "name": "Chiến lược 1", "enabled": True,
            "strategy_id": "follow_last", "stakes": [10, 100, 120, 140, 160],
            "progression_mode": "loss_up_win_reset", "stop_loss": 500,
            "money_manager_id": "IncreaseWhenLose", "stake_chains": [],
            "take_profit": 2000, "history": history,
            "status": {
                "history_size": 24, "signals": 18, "virtual_bets": 17,
                "wins": 11, "losses": 5, "pushes": 1, "pnl": 540,
                "current": {"side": "player", "stake": 120, "level": 3,
                            "total_levels": 5, "reason": "Bám Tay con của ván trước",
                            "risk": {"allowed": True, "reason": "Mô phỏng hợp lệ"}},
            },
        },
        {
            "id": "tab-two", "name": "Đảo cầu", "enabled": True,
            "strategy_id": "reverse_last", "stakes": [0, 100, 200],
            "progression_mode": "win_up_loss_reset", "stop_loss": 300,
            "money_manager_id": "MultiChain",
            "stake_chains": [[0, 100, 200], [300, 500, 800]],
            "take_profit": 1000, "history": [], "status": {},
        },
    ]
    dots = [
        {"side": side, "label": side}
        for side in ("banker", "player", "banker", "banker", "tie", "player",
                     "player", "banker", "player", "banker", "banker", "player")
    ]
    return UiSnapshot(
        revision=12,
        state={
            "table": "Baccarat C03", "history_dots": dots,
            "strategy_tabs": {
                "mode": "simulation", "selected_tab_id": "tab-one",
                "strategies": strategies,
                "money_managers": list(MONEY_MANAGER_OPTIONS),
                "tabs": tabs,
            },
        },
        tabs=tabs,
    )


class WorkspaceScreenshotRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)

    async def asyncTearDown(self):
        await self.browser.close()
        await self.playwright.stop()

    async def test_workspace_matches_reference_snapshots(self):
        update = os.environ.get("UPDATE_TOOLBET_SNAPSHOTS") == "1"
        if update:
            SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        for filename, width, height, scale in CASES:
            context = await self.browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=scale,
            )
            page = await context.new_page()
            await page.set_content(
                "<!doctype html><html><body style='margin:0;background:#172033'></body></html>"
            )
            runtime = BrowserUiRuntime(enabled=True)
            self.assertTrue(await runtime.install(page, _snapshot()))
            self.assertTrue(await page.locator("#toolbet-ui-v2 .tbv2-config-card").is_visible())
            actual = await page.locator("#toolbet-ui-v2").screenshot()
            expected_path = SNAPSHOT_DIR / filename
            if update:
                expected_path.write_bytes(actual)
            self.assertTrue(expected_path.exists(), f"Missing baseline: {expected_path}")
            expected_image = Image.open(expected_path).convert("RGBA")
            actual_image = Image.open(io.BytesIO(actual)).convert("RGBA")
            self.assertEqual(expected_image.size, actual_image.size)
            diff = ImageChops.difference(expected_image, actual_image)
            changed = sum(
                1
                for pixel in diff.get_flattened_data()
                if pixel != (0, 0, 0, 0)
            )
            ratio = changed / max(1, expected_image.width * expected_image.height)
            self.assertLessEqual(ratio, 0.01, f"{filename} changed {ratio:.2%}")
            await context.close()
