from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from playwright.async_api import Page

from src.credentials import accounts_for_panel
from src.sites import list_sites_for_panel, resolve_site

logger = logging.getLogger(__name__)

PANEL_ID = "toolbet-login-panel"


@dataclass
class LoginFormResult:
    site_url: str
    username: str
    password: str
    site_id: str = ""


INSTALL_SCRIPT = """
(opts) => {
  const ID = 'toolbet-login-panel';
  const old = document.getElementById(ID);
  if (old) old.remove();

  const sites = opts.sites || [];
  const optionsHtml = sites.map(s => {
    const sel = s.id === opts.site_id ? ' selected' : '';
    return `<option value="${s.id}"${sel}>${s.label}</option>`;
  }).join('');

  const root = document.createElement('div');
  root.id = ID;
  root.innerHTML = `
    <style>
      #toolbet-login-panel {
        position: fixed; inset: 0; z-index: 2147483646;
        display: flex; align-items: center; justify-content: center;
        font-family: "Segoe UI", Tahoma, sans-serif;
        background:
          radial-gradient(ellipse at 20% 10%, rgba(40, 90, 70, 0.45), transparent 50%),
          radial-gradient(ellipse at 80% 90%, rgba(30, 50, 80, 0.4), transparent 45%),
          linear-gradient(160deg, #0f1419 0%, #1a2420 45%, #121820 100%);
        color: #e8efe9;
      }
      #toolbet-login-panel .tb-box {
        width: min(420px, 92vw);
        padding: 28px 28px 22px;
        border: 1px solid rgba(180, 210, 190, 0.18);
        background: rgba(18, 26, 22, 0.92);
        box-shadow: 0 18px 50px rgba(0,0,0,0.45);
      }
      #toolbet-login-panel .tb-brand {
        font-size: 22px; font-weight: 700; letter-spacing: 0.04em;
        color: #9fd4b0; margin: 0 0 6px;
      }
      #toolbet-login-panel .tb-sub {
        margin: 0 0 22px; font-size: 13px; color: #9aaba0; line-height: 1.4;
      }
      #toolbet-login-panel label {
        display: block; font-size: 12px; color: #b7c8bc; margin: 0 0 6px;
      }
      #toolbet-login-panel .tb-field { margin-bottom: 14px; }
      #toolbet-login-panel input,
      #toolbet-login-panel select {
        width: 100%; box-sizing: border-box;
        padding: 10px 12px; font-size: 14px;
        border: 1px solid rgba(180, 210, 190, 0.28);
        background: rgba(8, 12, 10, 0.75); color: #eef6f0;
        outline: none;
      }
      #toolbet-login-panel select {
        cursor: pointer;
        appearance: auto;
      }
      #toolbet-login-panel select option {
        background: #1a2420; color: #eef6f0;
      }
      #toolbet-login-panel input:focus,
      #toolbet-login-panel select:focus {
        border-color: #6fbf8a;
      }
      #toolbet-login-panel .tb-hint {
        margin-top: 6px; font-size: 11px; color: #7f9488;
      }
      #toolbet-login-panel .tb-err {
        min-height: 18px; margin: 4px 0 10px;
        font-size: 12px; color: #ff9b9b;
      }
      #toolbet-login-panel button {
        width: 100%; padding: 11px 14px; margin-top: 4px;
        border: 1px solid #5ea876; background: #2d6b45;
        color: #f3fff7; font-size: 15px; font-weight: 600; cursor: pointer;
      }
      #toolbet-login-panel button:hover { background: #358352; }
      #toolbet-login-panel button:disabled {
        opacity: 0.55; cursor: wait;
      }
    </style>
    <div class="tb-box">
      <div class="tb-brand">ToolBet</div>
      <p class="tb-sub">Chon web duoc ho tro, nhap tai khoan / mat khau truoc khi vao trang va sanh.</p>
      <div class="tb-field">
        <label for="tb-web">Web</label>
        <select id="tb-web">${optionsHtml}</select>
        <div class="tb-hint">Chi cac web trong danh sach moi duoc he thong ho tro.</div>
      </div>
      <div class="tb-field">
        <label for="tb-user">Tai khoan</label>
        <input id="tb-user" type="text" autocomplete="username" placeholder="Tai khoan" />
      </div>
      <div class="tb-field">
        <label for="tb-pass">Mat khau</label>
        <input id="tb-pass" type="password" autocomplete="current-password" placeholder="Mat khau" />
      </div>
      <div class="tb-err" id="tb-err"></div>
      <button id="tb-go" type="button">Vao web &amp; sanh</button>
    </div>
  `;
  document.documentElement.appendChild(root);

  const web = root.querySelector('#tb-web');
  const user = root.querySelector('#tb-user');
  const pass = root.querySelector('#tb-pass');
  const err = root.querySelector('#tb-err');
  const go = root.querySelector('#tb-go');

  user.value = opts.username || '';
  pass.value = opts.password || '';

  const accounts = opts.accounts || {};
  const fillForSite = (siteId) => {
    const acc = accounts[siteId] || {};
    user.value = acc.username || '';
    pass.value = acc.password || '';
  };

  web.addEventListener('change', () => {
    fillForSite((web.value || '').trim());
    err.textContent = '';
    if (!user.value) user.focus();
    else pass.focus();
  });

  async function submit() {
    err.textContent = '';
    const payload = {
      site_id: (web.value || '').trim(),
      username: (user.value || '').trim(),
      password: pass.value || '',
    };
    if (!payload.site_id) {
      err.textContent = 'Chon web.';
      web.focus();
      return;
    }
    if (!payload.username || !payload.password) {
      err.textContent = 'Nhap day du tai khoan va mat khau.';
      return;
    }
    go.disabled = true;
    go.textContent = 'Dang luu...';
    try {
      const res = await window.toolbetSubmitLogin(payload);
      if (!res || !res.ok) {
        err.textContent = (res && res.error) || 'Khong luu duoc.';
        go.disabled = false;
        go.textContent = 'Vao web & sanh';
        return;
      }
      go.textContent = 'Da luu — dang vao...';
    } catch (e) {
      err.textContent = String(e && e.message ? e.message : e);
      go.disabled = false;
      go.textContent = 'Vao web & sanh';
    }
  }

  go.addEventListener('click', submit);
  root.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      submit();
    }
  });

  setTimeout(() => {
    if (!user.value) user.focus();
    else pass.focus();
  }, 50);
}
"""


REMOVE_SCRIPT = f"""
() => {{
  const el = document.getElementById('{PANEL_ID}');
  if (el) el.remove();
}}
"""


async def _ensure_panel_page(page: Page) -> Page:
    """Dam bao co document de inject panel (tranh about:blank loi / trang treo)."""
    try:
        url = (page.url or "").lower()
    except Exception:
        url = ""
    if not url or url in ("about:blank", "chrome://newtab/", "chrome://new-tab-page/"):
        await page.set_content(
            "<!doctype html><html><head><meta charset='utf-8'>"
            "<title>ToolBet Login</title></head><body></body></html>",
            wait_until="domcontentloaded",
        )
    return page


async def prompt_login_panel(
    page: Page,
    *,
    site_url: str = "",
    username: str = "",
    password: str = "",
) -> LoginFormResult:
    """Hien form chon Web + TK/MK tren trang Chrome, doi user bam Vao."""
    page = await _ensure_panel_page(page)
    loop = asyncio.get_running_loop()
    future: asyncio.Future[LoginFormResult] = loop.create_future()
    sites = list_sites_for_panel()

    async def _submit(payload: dict) -> dict:
        try:
            site_id = str(payload.get("site_id") or payload.get("site_url") or "").strip()
            site = resolve_site(site_id)
            user = str(payload.get("username") or "").strip()
            pwd = str(payload.get("password") or "")
            if not user or not pwd:
                return {"ok": False, "error": "Thieu tai khoan hoac mat khau."}
            result = LoginFormResult(
                site_url=site.info.home(),
                username=user,
                password=pwd,
                site_id=site.info.id,
            )
            if not future.done():
                future.set_result(result)
            return {"ok": True, "site_url": result.site_url, "site_id": site.info.id}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    try:
        await page.expose_function("toolbetSubmitLogin", _submit)
    except Exception as exc:
        if "already registered" not in str(exc).lower():
            raise
        logger.debug("toolbetSubmitLogin da dang ky: %s", exc)

    site_id = ""
    try:
        site_id = resolve_site(site_url or sites[0]["id"]).info.id
    except Exception:
        site_id = sites[0]["id"] if sites else "vipbet389"

    accounts = accounts_for_panel()
    # Uu tien TK cua web dang chon; neu panel goi kem username thi dung luon
    if not username and site_id in accounts:
        username = accounts[site_id].get("username") or ""
        password = accounts[site_id].get("password") or password

    await page.evaluate(
        INSTALL_SCRIPT,
        {
            "sites": sites,
            "site_id": site_id,
            "username": username or "",
            "password": password or "",
            "accounts": accounts,
        },
    )
    logger.info("Cho chon Web / nhap TK-MK tren panel...")
    result = await future
    try:
        await page.evaluate(REMOVE_SCRIPT)
    except Exception:
        pass
    logger.info(
        "Da nhan thong tin login: site=%s web=%s user=%s",
        result.site_id,
        result.site_url,
        result.username,
    )
    return result
