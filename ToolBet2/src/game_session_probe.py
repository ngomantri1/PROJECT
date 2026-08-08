"""Existing Game session contract and operator choice card."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from playwright.async_api import Page


@dataclass(frozen=True)
class ExistingGameSession:
    found: bool
    site_id: str = ""
    site_url: str = ""
    phase: str = ""
    table_name: str = ""


_INSTALL_SCRIPT = """
(session) => {
  const id = 'toolbet-existing-game-session';
  document.getElementById(id)?.remove();
  const root = document.createElement('main');
  root.id = id;
  root.innerHTML = `
    <style>
      #${id}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;
        font-family:"Segoe UI",system-ui,sans-serif;color:#f4f7fb;background:rgba(3,9,18,.72)}
      #${id} .card{width:min(520px,calc(100vw - 32px));padding:28px;border:1px solid #27364d;
        border-radius:16px;background:#0f1b2d;box-shadow:0 20px 70px rgba(0,0,0,.5)}
      #${id} h1{margin:0 0 8px;font-size:21px} #${id} p{color:#8fa2ba;line-height:1.45}
      #${id} .status{margin:18px 0;padding:14px;border:1px solid #27364d;border-radius:10px;background:#142238}
      #${id} .row{display:flex;justify-content:space-between;gap:16px;padding:5px 0;font-size:13px}
      #${id} .row span{color:#8fa2ba} #${id} .row strong{color:#f4f7fb;text-align:right}
      #${id} .actions{display:flex;gap:10px;margin-top:18px} #${id} button{flex:1;padding:11px 14px;
        border-radius:8px;border:1px solid #27364d;background:#142238;color:#f4f7fb;font-weight:700;cursor:pointer}
      #${id} button.primary{border:0;background:#2878ff} #${id} button:hover{filter:brightness(1.12)}
    </style>
    <section class="card" aria-label="Phiên Game hiện tại">
      <h1>Đã phát hiện phiên Game hiện tại</h1>
      <p>Phiên Game vẫn còn hợp lệ. Bạn có thể tiếp tục phiên đang mở hoặc đổi tài khoản Game.</p>
      <div class="status">
        <div class="row"><span>Trang web</span><strong id="site"></strong></div>
        <div class="row"><span>Trạng thái</span><strong id="phase"></strong></div>
        <div class="row"><span>Bàn hiện tại</span><strong id="table"></strong></div>
      </div>
      <div class="actions">
        <button class="primary" id="continue" type="button">Tiếp tục phiên hiện tại</button>
        <button id="change" type="button">Đổi tài khoản Game</button>
      </div>
    </section>`;
  document.documentElement.appendChild(root);
  root.querySelector('#site').textContent = session.site_url || session.site_id || 'AE SEXY';
  root.querySelector('#phase').textContent = session.phase || 'Đã phát hiện';
  root.querySelector('#table').textContent = session.table_name || 'Chưa xác định';
  const choose = value => window.toolbetChooseGameSession(value);
  root.querySelector('#continue').addEventListener('click', () => choose('continue'));
  root.querySelector('#change').addEventListener('click', () => choose('change'));
}
"""


async def prompt_existing_game_session(
    page: Page, session: ExistingGameSession
) -> str:
    """Return ``continue`` or ``change`` after an explicit operator choice."""

    loop = asyncio.get_running_loop()
    future: asyncio.Future[str] = loop.create_future()

    async def _choose(value: str) -> dict:
        choice = str(value or "").strip().lower()
        if choice not in {"continue", "change"}:
            return {"ok": False, "error": "Lựa chọn phiên Game không hợp lệ"}
        if not future.done():
            future.set_result(choice)
        return {"ok": True, "choice": choice}

    try:
        await page.expose_function("toolbetChooseGameSession", _choose)
    except Exception as exc:
        if "already registered" not in str(exc).lower():
            raise
    await page.evaluate(_INSTALL_SCRIPT, {
        "site_id": session.site_id,
        "site_url": session.site_url,
        "phase": session.phase,
        "table_name": session.table_name,
    })
    choice = await future
    await page.evaluate(
        "() => document.getElementById('toolbet-existing-game-session')?.remove()"
    )
    return choice
