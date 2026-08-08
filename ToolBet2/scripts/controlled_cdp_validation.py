"""Validate the controlled table flow through an isolated Chrome CDP session.

The runner starts headless Chrome on a random loopback port with a temporary
profile. It never uses the configured CDP port, production profile, config,
credentials, or runtime database.
"""

from __future__ import annotations

import asyncio
import argparse
import socket
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.controlled_runtime_validation import _snapshot
from src.browser import BrowserManager, find_chrome_exe
from src.database import init_db
from src.db_store import GameDataStore
from src.ui_runtime import BrowserUiRuntime


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


async def _run(*, hold_seconds: int = 0) -> None:
    chrome = find_chrome_exe()
    if not chrome:
        raise RuntimeError("chrome.exe was not found; CDP validation was not run")

    port = _free_port()
    with TemporaryDirectory(prefix="toolbet2-cdp-") as temp_dir:
        profile = Path(temp_dir) / "profile"
        process = subprocess.Popen(
            [
                chrome,
                f"--remote-debugging-port={port}",
                f"--user-data-dir={profile}",
                "--headless=new",
                "--no-first-run",
                "--no-default-browser-check",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )
        manager = BrowserManager(
            cdp_url=f"http://127.0.0.1:{port}",
            profile_dir=profile,
        )
        factory = init_db(str(Path(temp_dir) / "selection.sqlite"))
        store = GameDataStore(factory, "ae_sexy")
        runtime = BrowserUiRuntime(enabled=True)
        received: list[dict] = []
        waiting = _snapshot(phase="waiting_manual", message="Waiting for table")

        try:
            context = await manager.start()
            page = await context.new_page()
            await page.set_viewport_size({"width": 1280, "height": 720})
            await page.goto("data:text/html,<html><body></body></html>")

            async def command_handler(command: dict) -> dict:
                received.append(command)
                if command.get("type") == "select_table":
                    store.save_last_confirmed_table(command["payload"]["table_name"])
                    return {"ok": True}
                if command.get("type") == "change_table":
                    return {"ok": True}
                return {"ok": False, "error": "unsupported controlled command"}

            await page.expose_function("toolbetUiCommand", command_handler)
            assert await runtime.install(page, waiting)
            await page.locator('[data-table-name="Baccarat C12"]').click()
            assert received[-1]["type"] == "select_table"
            assert store.get_last_confirmed_table() == "Baccarat C12"

            await runtime.update(
                page, _snapshot(phase="ready", message="Ready Baccarat C12")
            )
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
            assert await page.locator("#tbv2-table-selection").is_visible()

            for width, height in (
                (1024, 768),
                (1280, 720),
                (1920, 1080),
                (390, 844),
            ):
                await page.set_viewport_size({"width": width, "height": height})
                bounds = await page.locator("#toolbet-ui-v2").bounding_box()
                assert bounds is not None
                assert bounds["x"] >= 0 and bounds["y"] >= 0
                assert bounds["x"] + bounds["width"] <= width + 0.5
                assert bounds["y"] + bounds["height"] <= height + 0.5
            if hold_seconds > 0:
                await asyncio.sleep(hold_seconds)
        finally:
            factory.kw["bind"].dispose()
            await manager._disconnect_quiet()
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)

    print("controlled Chrome CDP validation: PASS")
    print("isolated port/profile -> persistence -> reload -> change table: PASS")
    print("viewport bounds: 1024x768, 1280x720, 1920x1080, 390x844: PASS")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--hold-seconds",
        type=int,
        default=0,
        help="Keep the isolated CDP session alive for resource sampling.",
    )
    args = parser.parse_args()
    asyncio.run(_run(hold_seconds=max(0, args.hold_seconds)))
