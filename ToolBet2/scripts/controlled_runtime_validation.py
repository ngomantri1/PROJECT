"""Run a safe, local browser validation of the table-selection UI flow.

This runner deliberately uses a headless browser, a temporary SQLite file,
and synthetic snapshots. It never reads runtime credentials, config.yaml,
data/toolbet.db, or a Chrome CDP profile.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory

from playwright.async_api import async_playwright

from src.database import init_db
from src.db_store import GameDataStore
from src.ui_contracts import UiSnapshot
from src.ui_runtime import BrowserUiRuntime


def _snapshot(*, phase: str, message: str = "", revision: int | None = None) -> UiSnapshot:
    tab = {"id": "test-tab", "name": "Controlled test", "status": {}}
    workspace = {
        "selected_tab_id": tab["id"],
        "strategies": [],
        "money_managers": [],
        "tabs": [tab],
    }
    return UiSnapshot(
        revision=revision if revision is not None else (1 if phase == "waiting_manual" else 2),
        state={
            "runtime_session_id": "controlled-runtime-validation",
            "strategy_tabs": workspace,
            "table_selection": {
                "phase": phase,
                "available_tables": ["Baccarat C09", "Baccarat C12"],
                "deadline_epoch_ms": 4102444800000 if phase == "waiting_manual" else 0,
                "message": message,
            },
        },
        tabs=[tab],
    )


async def _run() -> None:
    with TemporaryDirectory(prefix="toolbet2-controlled-") as temp_dir:
        factory = init_db(str(Path(temp_dir) / "selection.sqlite"))
        store = GameDataStore(factory, "ae_sexy")
        received: list[dict] = []
        runtime = BrowserUiRuntime(enabled=True)
        waiting = _snapshot(phase="waiting_manual", message="Waiting for table")
        try:
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=True)
                try:
                    page = await browser.new_page(viewport={"width": 1280, "height": 720})
                    await page.goto("data:text/html,<html><body></body></html>")

                    async def command_handler(command: dict) -> dict:
                        received.append(command)
                        command_type = command.get("type")
                        if command_type == "select_table":
                            selected = command["payload"]["table_name"]
                            store.save_last_confirmed_table(selected)
                            return {"ok": True}
                        if command_type == "change_table":
                            return {"ok": True}
                        return {"ok": False, "error": "unsupported controlled command"}

                    await page.expose_function("toolbetUiCommand", command_handler)
                    if not await runtime.install(page, waiting):
                        raise AssertionError("controlled UI install failed")

                    card = page.locator("#tbv2-table-selection")
                    assert await card.is_visible()
                    assert "Còn" in await card.locator(
                        '[data-bind="table-countdown"]'
                    ).inner_text()

                    await page.locator('[data-table-name="Baccarat C12"]').click()
                    assert received[-1]["type"] == "select_table"
                    assert store.get_last_confirmed_table() == "Baccarat C12"
                    await runtime.update(
                        page, _snapshot(phase="ready", message="Ready Baccarat C12")
                    )
                    actual_phase = await page.evaluate(
                        "() => window.ToolBetUi.snapshot().state.table_selection.phase"
                    )
                    assert actual_phase == "ready"

                    await page.reload()
                    assert not await runtime.present(page)
                    await runtime.update(
                        page, _snapshot(phase="ready", message="Ready Baccarat C12")
                    )
                    await page.locator(".tbv2-change-table").click()
                    assert received[-1]["type"] == "change_table"
                    await runtime.update(
                        page,
                        _snapshot(
                            phase="waiting_manual",
                            message="Waiting for table",
                            revision=3,
                        ),
                    )
                    assert await card.is_visible()
                    assert (
                        await page.evaluate(
                            "() => window.ToolBetUi.snapshot().state.table_selection.phase"
                        )
                        == "waiting_manual"
                    )

                    for width, height in (
                        (1024, 768),
                        (1280, 720),
                        (1920, 1080),
                        (390, 844),
                    ):
                        await page.set_viewport_size({"width": width, "height": height})
                        bounds = await page.locator("#toolbet-ui-v2").bounding_box()
                        assert bounds is not None
                        assert bounds["x"] >= 0
                        assert bounds["y"] >= 0
                        assert bounds["x"] + bounds["width"] <= width + 0.5
                        assert bounds["y"] + bounds["height"] <= height + 0.5
                finally:
                    await browser.close()
        finally:
            factory.kw["bind"].dispose()

    print("controlled runtime validation: PASS")
    print("manual selection -> TABLE_READY persistence -> reload -> change table: PASS")
    print("viewport bounds: 1024x768, 1280x720, 1920x1080, 390x844: PASS")


if __name__ == "__main__":
    asyncio.run(_run())
