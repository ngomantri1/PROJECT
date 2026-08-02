from __future__ import annotations

import logging

from playwright.async_api import Page

from src.sites.base import SiteInfo

logger = logging.getLogger(__name__)

INFO = SiteInfo(
    id="vipbet389",
    label="vipbet389.com",
    hosts=("vipbet389.com", "www.vipbet389.com"),
    home_url="https://vipbet389.com",
    casino_path="/casino",
    game_iframe_id="iframe_game",
    shell_mode="casino_iframe",
)


class Vipbet389Site:
    """Nhanh vipbet389: login header (plyr/so du) + /casino + #iframe_game + AE SEXY.

    Dau hieu DA LOGIN (khac 222b):
      - ID plyr* tren header + so du
      - HOAC sanh/ban AE SEXY dang mo trong #iframe_game
    KHONG dung nut Dang xuat / Nap tien (do la 222b).
    """

    info = INFO

    async def is_logged_in(self, page: Page) -> bool:
        from src.auth_flows import is_logged_in_vipbet

        return await is_logged_in_vipbet(page)

    async def login(
        self,
        page: Page,
        username: str,
        password: str,
        *,
        max_retries: int = 3,
    ) -> bool:
        from src.auth_flows import login_flow_vipbet

        await self.ensure_home(page)
        return await login_flow_vipbet(page, username, password, max_retries=max_retries)

    async def ensure_home(self, page: Page) -> None:
        if self.info.matches_url(page.url or ""):
            return
        await page.goto(self.info.home(), wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(1200)

    async def ensure_casino(self, page: Page) -> None:
        if self.info.is_casino_url(page.url or ""):
            return
        await page.goto(self.info.casino_url(), wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2000)

    async def reload_shell(self, page: Page, *, prefer_casino: bool = True) -> None:
        target = self.info.casino_url() if prefer_casino else self.info.home()
        await page.goto(target, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2000)

    async def enter_ae_sexy_hall(
        self,
        page: Page,
        table_name: str = "",
        *,
        _from_recovery: bool = False,
        force_relaunch: bool = False,
    ) -> bool:
        from src.ae_sexy import enter_ae_sexy_hall_casino_iframe

        return await enter_ae_sexy_hall_casino_iframe(
            page,
            table_name,
            _from_recovery=_from_recovery,
            force_relaunch=force_relaunch,
            casino_url=self.info.casino_url(),
        )
