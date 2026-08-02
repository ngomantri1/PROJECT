from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse
from typing import Any

import yaml
from pydantic import BaseModel


class Credentials(BaseModel):
    username: str = ""
    password: str = ""
    site_id: str = ""


def _default_path(path: str | Path | None = None) -> Path:
    return Path(path or "credentials.yaml")


def _site_id_from(raw: str | None) -> str:
    """Map URL/id → site id (vipbet389 / 222b). Fallback vipbet389."""
    from src.sites import resolve_site

    try:
        return resolve_site(raw or "").info.id
    except Exception:
        return "vipbet389"


def _empty_store() -> dict[str, Any]:
    return {"active_site": "", "sites": {}}


def _read_raw(path: Path) -> dict[str, Any]:
    if not path.exists():
        example = Path("credentials.example.yaml")
        if example.exists() and path.name == "credentials.yaml":
            path = example
        else:
            return _empty_store()
    with path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    if not isinstance(raw, dict):
        return _empty_store()
    return raw


def _normalize_store(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Ho tro 2 format:
      Cu:  {username, password}
      Moi: {active_site, sites: {site_id: {username, password}}}
    """
    sites_raw = raw.get("sites")
    sites: dict[str, dict[str, str]] = {}
    if isinstance(sites_raw, dict):
        for key, val in sites_raw.items():
            sid = _site_id_from(str(key))
            if isinstance(val, dict):
                user = str(val.get("username") or "").strip()
                pwd = str(val.get("password") or "")
            else:
                continue
            if user or pwd:
                sites[sid] = {"username": user, "password": pwd}

    # Legacy flat keys → gan vao active/default site (khong mat du lieu)
    legacy_user = str(raw.get("username") or "").strip()
    legacy_pwd = str(raw.get("password") or "")
    active = str(raw.get("active_site") or "").strip()
    if active:
        try:
            active = _site_id_from(active)
        except Exception:
            active = ""

    if legacy_user or legacy_pwd:
        target = active or _site_id_from(None)
        if target not in sites:
            sites[target] = {
                "username": legacy_user,
                "password": legacy_pwd,
            }
        elif not sites[target].get("username") and legacy_user:
            sites[target]["username"] = legacy_user
            if legacy_pwd:
                sites[target]["password"] = legacy_pwd
        if not active:
            active = target

    if not active and sites:
        active = next(iter(sites.keys()))

    return {"active_site": active or "", "sites": sites}


def load_credentials_store(path: str | Path = "credentials.yaml") -> dict[str, Any]:
    return _normalize_store(_read_raw(_default_path(path)))


def list_site_credentials(path: str | Path = "credentials.yaml") -> dict[str, Credentials]:
    store = load_credentials_store(path)
    out: dict[str, Credentials] = {}
    for sid, data in (store.get("sites") or {}).items():
        out[sid] = Credentials(
            username=str(data.get("username") or ""),
            password=str(data.get("password") or ""),
            site_id=sid,
        )
    return out


def accounts_for_panel(path: str | Path = "credentials.yaml") -> dict[str, dict[str, str]]:
    """Map site_id -> {username, password} de panel doi web tu dien."""
    return {
        sid: {"username": c.username, "password": c.password}
        for sid, c in list_site_credentials(path).items()
    }


def load_credentials(
    path: str | Path = "credentials.yaml",
    site: str | None = None,
) -> Credentials:
    """Doc TK/MK theo web. site=None → active_site trong file."""
    store = load_credentials_store(path)
    sites: dict = store.get("sites") or {}
    if site:
        sid = _site_id_from(site)
    else:
        sid = str(store.get("active_site") or "") or (
            next(iter(sites.keys())) if sites else _site_id_from(None)
        )
        if sid and sid not in sites and sites:
            # active chua co TK — lay site dau co du lieu
            sid = next(iter(sites.keys()))
    data = sites.get(sid) or {}
    return Credentials(
        username=str(data.get("username") or ""),
        password=str(data.get("password") or ""),
        site_id=sid,
    )


def save_credentials(
    username: str,
    password: str,
    path: str | Path = "credentials.yaml",
    site: str | None = None,
) -> None:
    """Ghi TK/MK cho 1 web — giu nguyen cac web khac."""
    p = _default_path(path)
    store = load_credentials_store(p if p.exists() else path)
    sid = _site_id_from(site or store.get("active_site") or None)
    sites = dict(store.get("sites") or {})
    sites[sid] = {
        "username": (username or "").strip(),
        "password": password or "",
    }
    payload = {
        "active_site": sid,
        "sites": sites,
    }
    header = (
        "# Tai khoan theo tung web (khong commit file nay)\n"
        "# active_site: web vua dung\n"
        "# sites.<id>.username / password: TK rieng tung web\n"
    )
    p.write_text(
        header + yaml.safe_dump(payload, allow_unicode=True, default_flow_style=False, sort_keys=False),
        encoding="utf-8",
    )


def normalize_site_url(raw: str, default: str = "") -> str:
    """Chuan hoa URL — chi chap nhan web trong allowlist SiteAdapter."""
    from src.sites import resolve_site

    text = (raw or "").strip()
    if not text:
        if default:
            return resolve_site(default).info.home()
        return resolve_site("vipbet389").info.home()
    return resolve_site(text).info.home()


def site_host(url: str) -> str:
    return (urlparse(normalize_site_url(url)).netloc or "").lower()


def casino_url_from_site(site_url: str) -> str:
    from src.sites import resolve_site

    return resolve_site(site_url).info.casino_url()
