from __future__ import annotations

import asyncio
import logging

from playwright.async_api import Page

from src.tool_auth import ToolAuthService, ToolSession


logger = logging.getLogger(__name__)

PANEL_ID = "toolbet-tool-login-panel"

INSTALL_SCRIPT = """
(opts) => {
  const ID = 'toolbet-tool-login-panel';
  document.getElementById(ID)?.remove();
  const root = document.createElement('main');
  root.id = ID;
  root.innerHTML = `
    <style>
      #${ID} { position:fixed; inset:0; z-index:2147483647; display:grid; place-items:center;
        font-family:"Segoe UI",system-ui,sans-serif; color:#102033;
        background:linear-gradient(135deg,#edf3fa,#dbe6f2); }
      #${ID} .tb-auth-card { width:min(420px,calc(100vw - 32px)); box-sizing:border-box;
        border-radius:16px; padding:28px; background:#fff; box-shadow:0 18px 55px rgba(28,50,79,.18); }
      #${ID} h1 { margin:0; font-size:24px; } #${ID} p { color:#607086; line-height:1.45; }
      #${ID} label { display:block; margin:14px 0 6px; color:#1769dd; font-size:12px; font-weight:700; text-transform:uppercase; }
      #${ID} input { width:100%; box-sizing:border-box; padding:11px 12px; border:1px solid #c8d2df; border-radius:6px; font-size:15px; }
      #${ID} input:focus { outline:2px solid #9fc5ff; border-color:#2878e8; }
      #${ID} button { width:100%; margin-top:20px; padding:12px; border:0; border-radius:9px; background:#2878e8; color:#fff; font-size:16px; font-weight:700; cursor:pointer; }
      #${ID} button:disabled { opacity:.6; cursor:wait; } #${ID} .tb-error { min-height:18px; margin-top:12px; color:#d13232; font-size:13px; }
      #${ID} label.tb-remember { display:flex; align-items:center; gap:8px; margin:12px 0 0; color:#607086; font-size:13px; font-weight:400; text-transform:none; }
      #${ID} .tb-remember input { width:16px; height:16px; }
      #${ID} .tb-live { display:inline-block; margin-left:8px; padding:3px 8px; border-radius:12px; color:#1769dd; background:#eaf3ff; font-size:11px; font-weight:700; }
    </style>
    <section class="tb-auth-card" aria-label="Đăng nhập ToolBet">
      <h1>Đăng nhập Tool <span class="tb-live">${opts.mode || 'LOCAL'}</span></h1>
      <p>Đăng nhập ToolBet trước. Sau khi hợp lệ, bạn mới có thể đăng nhập tài khoản Game.</p>
      <label for="tb-tool-user">Tên đăng nhập Tool</label>
      <input id="tb-tool-user" autocomplete="username" />
      <label for="tb-tool-pass">Mật khẩu Tool</label>
      <input id="tb-tool-pass" type="password" autocomplete="current-password" />
      <label class="tb-remember"><input id="tb-tool-remember" type="checkbox" /> Ghi nhớ đăng nhập trên thiết bị này</label>
      <div class="tb-error" id="tb-tool-error"></div>
      <button id="tb-tool-submit" type="button">Đăng nhập Tool</button>
    </section>`;
  document.documentElement.appendChild(root);
  const user = root.querySelector('#tb-tool-user'); const pass = root.querySelector('#tb-tool-pass');
  const button = root.querySelector('#tb-tool-submit'); const error = root.querySelector('#tb-tool-error');
  const remember = root.querySelector('#tb-tool-remember');
  user.value = opts.username || '';
  pass.value = opts.password || '';
  remember.checked = Boolean(opts.remember);
  const submit = async () => {
    error.textContent = '';
    const payload = { username:(user.value || '').trim(), password:pass.value || '', remember:remember.checked };
    if (!payload.username || !payload.password) { error.textContent = 'Nhập tên đăng nhập và mật khẩu Tool.'; return; }
    button.disabled = true; button.textContent = 'Đang kiểm tra...';
    try {
      const result = await window.toolbetSubmitToolLogin(payload);
      if (!result || !result.ok) { error.textContent = (result && result.error) || 'Đăng nhập Tool không hợp lệ.'; button.disabled=false; button.textContent='Đăng nhập Tool'; return; }
      button.textContent = 'Đã xác thực — mở đăng nhập Game...';
    } catch (e) { error.textContent = String(e && e.message ? e.message : e); button.disabled=false; button.textContent='Đăng nhập Tool'; }
  };
  button.addEventListener('click', submit);
  root.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
  setTimeout(() => (user.value ? pass : user).focus(), 50);
}
"""


async def prompt_tool_login_panel(page: Page, auth: ToolAuthService) -> ToolSession:
    """Show Tool login and resolve only after a valid Tool session exists."""

    loop = asyncio.get_running_loop()
    future: asyncio.Future[ToolSession] = loop.create_future()

    async def _submit(payload: dict) -> dict:
        username = str((payload or {}).get("username") or "").strip()
        password = str((payload or {}).get("password") or "")
        session = auth.authenticate(username, password)
        if session is None:
            return {
                "ok": False,
                "error": auth.last_error
                or "Tài khoản Tool hoặc mật khẩu không đúng.",
            }
        if not future.done():
            if bool((payload or {}).get("remember")):
                auth.remember_credentials(username, password)
            else:
                auth.clear_remembered_credentials()
            future.set_result(session)
        return {
            "ok": True,
            "username": session.username,
            "license": auth.license_status(),
        }

    try:
        await page.expose_function("toolbetSubmitToolLogin", _submit)
    except Exception as exc:
        if "already registered" not in str(exc).lower():
            raise

    saved = auth.remembered_credentials()
    await page.evaluate(
        INSTALL_SCRIPT,
        {
            "username": saved.get("username") or auth.suggested_username,
            "password": saved.get("password", ""),
            # Remember is opt-out because this login is explicitly requested
            # to be restored on the next launch.
            "remember": True,
            "mode": "LICENSE" if auth.license_enabled else "LOCAL",
        },
    )
    logger.info("Chờ đăng nhập tài khoản Tool...")
    session = await future
    await page.evaluate(
        "() => document.getElementById('toolbet-tool-login-panel')?.remove()"
    )
    logger.info("Đăng nhập Tool thành công")
    return session
