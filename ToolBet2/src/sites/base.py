from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol
from urllib.parse import urlparse

from playwright.async_api import Page

ShellMode = Literal["casino_iframe", "provider_tab"]


@dataclass(frozen=True)
class SiteInfo:
    """Thong tin web duoc he thong ho tro."""

    id: str
    label: str
    hosts: tuple[str, ...]
    home_url: str
    casino_path: str = "/casino"
    game_iframe_id: str = "iframe_game"
    # casino_iframe: game nam trong #iframe_game tren trang casino (vipbet)
    # provider_tab: goGame mo tab AE SEXY rieng (222b)
    shell_mode: ShellMode = "casino_iframe"
    ae_launch_code: str = ""  # vd AWC_S cho 222b
    # SPA hash route (vd dly8829 #/live) — uu tien hon casino_path khi set
    casino_url_full: str = ""

    def home(self) -> str:
        return self.home_url.rstrip("/") + "/"

    def casino_url(self) -> str:
        if (self.casino_url_full or "").strip():
            return self.casino_url_full.strip()
        base = self.home_url.rstrip("/")
        path = self.casino_path if self.casino_path.startswith("/") else f"/{self.casino_path}"
        return f"{base}{path}"

    def game_iframe_selector(self) -> str:
        return f"#{self.game_iframe_id}"

    def matches_host(self, host: str) -> bool:
        h = (host or "").lower().strip().lstrip(".")
        if h.startswith("www."):
            h = h[4:]
        for cand in self.hosts:
            c = cand.lower()
            if c.startswith("www."):
                c = c[4:]
            if h == c or h.endswith("." + c):
                return True
        return False

    def matches_url(self, url: str) -> bool:
        try:
            host = urlparse(url or "").netloc.lower()
        except Exception:
            return False
        return self.matches_host(host)

    def is_casino_url(self, url: str) -> bool:
        u = (url or "").lower()
        if not self.matches_url(u):
            return False
        # SPA live casino (EE88/dly8829)
        if "#/live" in u or "tabname=live" in u:
            return True
        full = (self.casino_url_full or "").strip().lower()
        if full and full.rstrip("/") in u.rstrip("/"):
            return True
        path = urlparse(u).path.lower()
        needle = self.casino_path.lower().rstrip("/")
        # Bo hash khoi needle neu co (vd /home/#/live → chi can /home)
        if "#" in needle:
            needle = needle.split("#", 1)[0].rstrip("/")
        return bool(needle) and needle in path


class SiteAdapter(Protocol):
    """Moi web = 1 adapter rieng: login markers / captcha / vao AE SEXY / reload.

    Them web moi: tao src/sites/<id>.py implement Protocol nay, dang ky trong __init__.
    Khong dung chung selector login giua cac web (vd Dang xuat chi dung cho 222b).
    """

    info: SiteInfo

    async def is_logged_in(self, page: Page) -> bool: ...

    async def login(
        self,
        page: Page,
        username: str,
        password: str,
        *,
        max_retries: int = 3,
    ) -> bool: ...

    async def ensure_home(self, page: Page) -> None: ...

    async def ensure_casino(self, page: Page) -> None: ...

    async def reload_shell(self, page: Page, *, prefer_casino: bool = True) -> None: ...

    async def enter_ae_sexy_hall(
        self,
        page: Page,
        table_name: str = "",
        *,
        _from_recovery: bool = False,
        force_relaunch: bool = False,
    ) -> bool: ...
