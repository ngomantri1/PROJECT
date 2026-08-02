from __future__ import annotations

import logging

from playwright.async_api import Page

logger = logging.getLogger(__name__)


async def is_logged_in(page: Page) -> bool:
    """Kiem tra login theo site cua tab (hoac active session)."""
    from src.sites import get_active_site, resolve_site_from_page

    site = resolve_site_from_page(page) or get_active_site()
    return await site.is_logged_in(page)


async def login_site(
    page: Page,
    username: str,
    password: str,
    max_retries: int = 3,
    site_url: str | None = None,
) -> bool:
    """Dang nhap qua SiteAdapter cua web dang chon."""
    from src.sites import bind_page_site, get_active_site, resolve_site

    site = resolve_site(site_url) if site_url else get_active_site()
    bind_page_site(page, site.info.id)
    logger.info("Login nhanh site=%s (%s)", site.info.id, site.info.label)
    return await site.login(page, username, password, max_retries=max_retries)


async def login_vipbet389(
    page: Page,
    username: str,
    password: str,
    max_retries: int = 3,
    site_url: str | None = None,
) -> bool:
    """Alias cu — dispatch moi web qua login_site."""
    return await login_site(
        page, username, password, max_retries=max_retries, site_url=site_url
    )


async def login(page: Page, username: str, password: str, site_url: str | None = None) -> bool:
    return await login_site(page, username, password, site_url=site_url)
