from __future__ import annotations

import unittest
from unittest.mock import patch

from src.browser import BrowserManager, cdp_port_open, wait_for_cdp_port


class _ConnectedBrowser:
    def is_connected(self):
        return True


class _DisconnectedBrowser:
    def is_connected(self):
        return False


class _Context:
    pages = []


class BrowserStartupTests(unittest.IsolatedAsyncioTestCase):
    def test_closed_local_cdp_port_is_probed_only_once(self):
        with patch(
            "src.browser.socket.create_connection", side_effect=OSError
        ) as connect:
            self.assertFalse(cdp_port_open("http://localhost:9222"))

        connect.assert_called_once_with(("127.0.0.1", 9222), timeout=0.2)

    def test_is_connected_returns_true_for_live_browser_and_context(self):
        manager = BrowserManager()
        manager._browser = _ConnectedBrowser()
        manager._context = _Context()

        self.assertIs(manager.is_connected(), True)

    def test_is_connected_returns_false_for_disconnected_browser(self):
        manager = BrowserManager()
        manager._browser = _DisconnectedBrowser()
        manager._context = _Context()

        self.assertIs(manager.is_connected(), False)

    async def test_wait_for_cdp_port_retries_until_chrome_is_ready(self):
        with patch("src.browser.cdp_port_open", side_effect=[False, False, True]) as probe:
            ready = await wait_for_cdp_port(
                "http://127.0.0.1:9222", wait_sec=1, interval_sec=0.05
            )

        self.assertTrue(ready)
        self.assertEqual(3, probe.call_count)

    async def test_wait_for_cdp_port_returns_false_after_timeout(self):
        with patch("src.browser.cdp_port_open", return_value=False):
            ready = await wait_for_cdp_port(
                "http://127.0.0.1:9222", wait_sec=0, interval_sec=0.05
            )

        self.assertFalse(ready)

    async def test_ensure_cdp_launches_before_waiting_for_readiness(self):
        manager = BrowserManager(cdp_url="http://localhost:9222")
        with (
            patch(
                "src.browser.cdp_port_open", side_effect=[False, True]
            ) as probe,
            patch("src.browser.launch_chrome_cdp", return_value=True) as launch,
        ):
            ready = await manager.ensure_chrome_cdp(wait_sec=1)

        self.assertTrue(ready)
        launch.assert_called_once()
        self.assertEqual(2, probe.call_count)
