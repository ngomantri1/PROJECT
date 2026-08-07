from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path

from playwright.async_api import async_playwright

from src.tool_auth import ToolAuthService
from src.tool_login_panel import prompt_tool_login_panel


class ToolAuthServiceTests(unittest.TestCase):
    def test_game_access_is_blocked_without_valid_tool_session(self):
        with tempfile.TemporaryDirectory() as temp:
            auth = ToolAuthService(
                store_path=Path(temp) / "accounts.json",
                remembered_credentials_path=Path(temp) / "login.bin",
                bootstrap_username="operator",
                bootstrap_password="secret-pass",
            )

            with self.assertRaises(PermissionError):
                auth.require_session()
            self.assertIsNone(auth.authenticate("operator", "wrong"))
            session = auth.authenticate("operator", "secret-pass")

            self.assertIsNotNone(session)
            self.assertEqual("operator", auth.require_session().username)
            auth.logout()
            with self.assertRaises(PermissionError):
                auth.require_session()

    def test_store_contains_hash_not_plaintext_password(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "accounts.json"
            auth = ToolAuthService(
                store_path=path,
                bootstrap_username="operator",
                bootstrap_password="secret-pass",
            )

            self.assertIsNotNone(auth.authenticate("operator", "secret-pass"))
            saved = path.read_text(encoding="utf-8")

            self.assertIn("password_hash", saved)
            self.assertNotIn("secret-pass", saved)

    def test_disabled_auth_still_provides_a_single_gate_session(self):
        auth = ToolAuthService(enabled=False)

        auth.authenticate("", "")

        self.assertEqual("disabled-auth", auth.require_session().username)


class ToolLoginPanelBrowserTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page()
        await self.page.set_content("<!doctype html><html><body></body></html>")
        self.temp = tempfile.TemporaryDirectory()

    async def asyncTearDown(self):
        self.temp.cleanup()
        await self.browser.close()
        await self.playwright.stop()

    async def test_tool_login_stays_before_game_login_until_authenticated(self):
        auth = ToolAuthService(
            store_path=Path(self.temp.name) / "accounts.json",
            remembered_credentials_path=Path(self.temp.name) / "login.bin",
            bootstrap_username="operator",
            bootstrap_password="secret-pass",
        )
        pending = asyncio.create_task(prompt_tool_login_panel(self.page, auth))
        await self.page.locator("#toolbet-tool-login-panel").wait_for()

        self.assertEqual(0, await self.page.locator("#toolbet-login-panel").count())
        await self.page.locator("#tb-tool-user").fill("operator")
        await self.page.locator("#tb-tool-pass").fill("wrong")
        await self.page.locator("#tb-tool-submit").click()
        await self.page.locator("#tb-tool-error").wait_for()
        self.assertFalse(pending.done())

        await self.page.locator("#tb-tool-pass").fill("secret-pass")
        await self.page.locator("#tb-tool-submit").click()
        session = await asyncio.wait_for(pending, timeout=3)

        self.assertEqual("operator", session.username)
        self.assertTrue(auth.is_authenticated())
        self.assertEqual(0, await self.page.locator("#toolbet-tool-login-panel").count())
