from __future__ import annotations

import logging

from playwright.async_api import Page

from src.sites.base import SiteInfo

logger = logging.getLogger(__name__)

# Affiliate — chi dung khi can; login/home KHONG gan invite (tranh popup Dang ky)
INVITE_CODE = "5640979"
HOME_URL = "https://dly8829.com/home/#/"
HOME_WITH_INVITE = f"https://dly8829.com/?inviteCode={INVITE_CODE}"
CASINO_LIVE_URL = f"https://dly8829.com/home/#/live?tabName=live"

INFO = SiteInfo(
    id="dly8829",
    label="dly8829.com (EE88)",
    hosts=("dly8829.com", "www.dly8829.com"),
    home_url="https://dly8829.com",
    # Path shell; casino that = #/live (casino_url_full)
    casino_path="/home/",
    game_iframe_id="iframe_game",
    shell_mode="provider_tab",  # SEXY CASINO mo tab/provider AE
    ae_launch_code="SEXY",
    casino_url_full=CASINO_LIVE_URL,
)


class SiteDly8829:
    """Nhanh dly8829 (EE88): login dialog Element UI + #/live + SEXY CASINO.

    Dau hieu DA LOGIN (khac 222b/vipbet):
      - Khong con button.btn-login hien
      - Co Dang xuat / user header (so du)
    KHONG dung selector #userName (222b) hay plyr* (vipbet).
    """

    info = INFO

    async def is_logged_in(self, page: Page) -> bool:
        from src.auth_flows import is_logged_in_dly8829

        return await is_logged_in_dly8829(page)

    async def login(
        self,
        page: Page,
        username: str,
        password: str,
        *,
        max_retries: int = 3,
    ) -> bool:
        from src.auth_flows import login_flow_dly8829

        await self.ensure_home(page)
        return await login_flow_dly8829(
            page, username, password, max_retries=max_retries
        )

    async def ensure_home(self, page: Page) -> None:
        # Khong dung inviteCode o day — EE88 tu mo popup Dang ky khi co invite
        if self.info.matches_url(page.url or "") and "inviteCode=" not in (page.url or ""):
            return
        await page.goto(HOME_URL, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(1500)

    async def ensure_casino(self, page: Page) -> None:
        u = (page.url or "").lower()
        if self.info.matches_url(u) and ("#/live" in u or "tabname=live" in u):
            return
        await page.goto(CASINO_LIVE_URL, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2500)

    async def reload_shell(self, page: Page, *, prefer_casino: bool = True) -> None:
        target = CASINO_LIVE_URL if prefer_casino else HOME_URL
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
        from src.ae_sexy import enter_ae_sexy_hall_sexy_card

        return await enter_ae_sexy_hall_sexy_card(
            page,
            table_name,
            casino_url=CASINO_LIVE_URL,
            site_id=self.info.id,
            force_relaunch=force_relaunch or _from_recovery,
        )
