from __future__ import annotations

from urllib.parse import urlparse
from weakref import WeakKeyDictionary

from src.sites.base import SiteAdapter, SiteInfo
from src.sites.dly8829 import SiteDly8829
from src.sites.site_222b import Site222b
from src.sites.vipbet389 import Vipbet389Site

_REGISTRY: list[SiteAdapter] = [
    Vipbet389Site(),
    Site222b(),
    SiteDly8829(),
]

_BY_ID: dict[str, SiteAdapter] = {s.info.id: s for s in _REGISTRY}

# Site dang chon trong session (panel) — uu tien hon doc lai config.yaml
_ACTIVE_SITE_ID: str | None = None

# Tab Playwright → site_id (CDN AE SEXY khong co host vipbet/222b)
_PAGE_SITE: WeakKeyDictionary = WeakKeyDictionary()


def set_active_site(site_id_or_url: str | None) -> SiteAdapter:
    """Gan web dang chay (goi sau panel / doi site)."""
    global _ACTIVE_SITE_ID
    site = resolve_site(site_id_or_url)
    _ACTIVE_SITE_ID = site.info.id
    return site


def bind_page_site(page, site_id_or_url: str | None) -> None:
    """Gan tab (ke ca CDN AE) thuoc web nao — tranh dung nham tab khi mo 2 web."""
    if page is None:
        return
    try:
        site = resolve_site(site_id_or_url) if site_id_or_url else get_active_site()
        _PAGE_SITE[page] = site.info.id
    except Exception:
        pass


def page_site_id(page) -> str | None:
    try:
        return _PAGE_SITE.get(page)
    except Exception:
        return None


def list_sites() -> list[SiteAdapter]:
    return list(_REGISTRY)


def list_sites_for_panel() -> list[dict[str, str]]:
    """Options cho <select> tren panel login."""
    return [
        {
            "id": s.info.id,
            "label": s.info.label,
            "url": s.info.home(),
        }
        for s in _REGISTRY
    ]


def get_site(site_id: str) -> SiteAdapter:
    key = (site_id or "").strip().lower()
    if key not in _BY_ID:
        known = ", ".join(_BY_ID)
        raise ValueError(f"Web khong duoc ho tro: {site_id!r}. Chi chap nhan: {known}")
    return _BY_ID[key]


def resolve_site(url_or_id: str | None) -> SiteAdapter:
    """Tim site theo id hoac URL/host. Raise neu khong nam allowlist."""
    raw = (url_or_id or "").strip()
    if not raw:
        if _ACTIVE_SITE_ID and _ACTIVE_SITE_ID in _BY_ID:
            return _BY_ID[_ACTIVE_SITE_ID]
        return _REGISTRY[0]
    low = raw.lower()
    if low in _BY_ID:
        return _BY_ID[low]
    # URL / host
    host = low
    if "://" in low:
        host = urlparse(low).netloc.lower()
    host = host.split("/")[0]
    for site in _REGISTRY:
        if site.info.matches_host(host) or site.info.matches_url(
            low if "://" in low else f"https://{host}/"
        ):
            return site
    known = ", ".join(s.info.label for s in _REGISTRY)
    raise ValueError(f"Web khong duoc ho tro: {url_or_id!r}. Chi chap nhan: {known}")


def resolve_site_from_page(page) -> SiteAdapter | None:
    """Site cua tab: binding CDN > host shell > None (roi get_active_site)."""
    bound = page_site_id(page)
    if bound and bound in _BY_ID:
        return _BY_ID[bound]
    try:
        url = page.url or ""
    except Exception:
        return None
    if not url or url.startswith("about:") or url.startswith("chrome:"):
        return None
    try:
        return resolve_site(url)
    except ValueError:
        return None


def page_matches_site(page, site: SiteAdapter | str | None = None) -> bool:
    """True neu tab thuoc site (shell host hoac da bind CDN)."""
    if site is None:
        target = get_active_site()
    elif isinstance(site, str):
        target = resolve_site(site)
    else:
        target = site
    tid = target.info.id
    bound = page_site_id(page)
    if bound:
        return bound == tid
    try:
        url = page.url or ""
    except Exception:
        return False
    if not url or url.startswith("about:") or url.startswith("chrome:"):
        return False
    try:
        resolved = resolve_site(url)
        return resolved.info.id == tid
    except ValueError:
        # CDN AE — chua bind: chi chap nhan neu dang active site (caller nen bind)
        from src.ae_sexy import is_ae_sexy_url

        return bool(is_ae_sexy_url(url) and get_active_site().info.id == tid)


def foreign_shell_page(page, site: SiteAdapter | str | None = None) -> bool:
    """True neu tab la shell cua WEB KHAC (khong phai CDN AE)."""
    if site is None:
        target = get_active_site()
    elif isinstance(site, str):
        target = resolve_site(site)
    else:
        target = site
    try:
        url = (page.url or "").lower()
    except Exception:
        return False
    if not url or url.startswith("about:"):
        return False
    try:
        other = resolve_site(url)
    except ValueError:
        return False
    return other.info.id != target.info.id


def get_active_site() -> SiteAdapter:
    """Site dang chon: session panel > config.site.url > vipbet389."""
    global _ACTIVE_SITE_ID
    if _ACTIVE_SITE_ID and _ACTIVE_SITE_ID in _BY_ID:
        return _BY_ID[_ACTIVE_SITE_ID]
    try:
        from src.config import load_config

        site = resolve_site(load_config().site.url)
        _ACTIVE_SITE_ID = site.info.id
        return site
    except Exception:
        return _REGISTRY[0]


def allowed_hosts() -> tuple[str, ...]:
    hosts: list[str] = []
    for s in _REGISTRY:
        hosts.extend(s.info.hosts)
    return tuple(hosts)


__all__ = [
    "SiteAdapter",
    "SiteInfo",
    "list_sites",
    "list_sites_for_panel",
    "get_site",
    "resolve_site",
    "resolve_site_from_page",
    "get_active_site",
    "set_active_site",
    "bind_page_site",
    "page_site_id",
    "page_matches_site",
    "foreign_shell_page",
    "allowed_hosts",
]
