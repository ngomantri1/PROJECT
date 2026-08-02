from __future__ import annotations

import logging

from playwright.async_api import Page

from src.sites.base import SiteInfo

logger = logging.getLogger(__name__)

INFO = SiteInfo(
    id="222b",
    label="222b.app (123B)",
    hosts=("222b.app", "www.222b.app"),
    home_url="https://www.222b.app",
    casino_path="/home/live.html",
    game_iframe_id="iframe_game",  # khong dung tren shell; game o tab provider
    shell_mode="provider_tab",
    ae_launch_code="AWC_S",  # SEXY CASINO
)


class Site222b:
    """Nhanh 222b: login #userName + live.html + goGame(AWC_S) mo tab AE SEXY.

    Dau hieu DA LOGIN (khac vipbet):
      - a.btn-logout / text Dang xuat (KHONG dung Nap tien — guest cung co)
    KHONG dung plyr* (do la vipbet).
    """

    info = INFO

    async def is_logged_in(self, page: Page) -> bool:
        from src.auth_flows import is_logged_in_222b

        return await is_logged_in_222b(page)

    async def login(
        self,
        page: Page,
        username: str,
        password: str,
        *,
        max_retries: int = 3,
    ) -> bool:
        from src.auth_flows import login_flow_222b

        await self.ensure_home(page)
        return await login_flow_222b(page, username, password, max_retries=max_retries)

    async def ensure_home(self, page: Page) -> None:
        if self.info.matches_url(page.url or ""):
            return
        await page.goto(self.info.home() + "home/", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(1500)

    async def ensure_casino(self, page: Page) -> None:
        if self.info.is_casino_url(page.url or ""):
            return
        await page.goto(self.info.casino_url(), wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2000)

    async def reload_shell(self, page: Page, *, prefer_casino: bool = True) -> None:
        if prefer_casino:
            await page.goto(self.info.casino_url(), wait_until="domcontentloaded", timeout=60000)
        else:
            await page.goto(self.info.home() + "home/", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2000)

    async def enter_ae_sexy_hall(
        self,
        page: Page,
        table_name: str = "",
        *,
        _from_recovery: bool = False,
        force_relaunch: bool = False,
    ) -> bool:
        from src.ae_sexy import enter_ae_sexy_hall_provider_tab

        return await enter_ae_sexy_hall_provider_tab(
            page,
            table_name,
            launch_code=self.info.ae_launch_code or "AWC_S",
            casino_url=self.info.casino_url(),
            force_relaunch=force_relaunch or _from_recovery,
            site_id=self.info.id,
        )
