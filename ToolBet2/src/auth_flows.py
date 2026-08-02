from __future__ import annotations

"""
Luong login theo TUNG WEB — khong tron selector.

  vipbet389: form header (username/password/confirmCode) + dau hieu da login = plyr* / so du
  222b:      #userName/#userPwd + dau hieu da login = Dang xuat (btn-logout)
  dly8829:   Vue dialog (Tai khoan/MK + captcha khi can) + SEXY CASINO card

OCR captcha dung chung; moi site doc anh / fill form rieng.
Them web moi: them SiteAdapter + login_flow_* + is_logged_in_* rieng.
"""

import base64
import logging
import re
from functools import lru_cache

from playwright.async_api import Page

logger = logging.getLogger(__name__)

# ─── vipbet389 (KHONG dung Dang xuat/Nap tien — do la 222b) ───
VIPBET_USERNAME = 'input[name="username"]'
VIPBET_PASSWORD = 'input[name="password"]'
VIPBET_CAPTCHA = 'input[name="confirmCode"]'
VIPBET_CAPTCHA_IMG = (
    'img[alt="captcha"], img[src*="code"], img[src*="captcha"], .captcha img, img.captcha'
)
VIPBET_LOGIN_BTN = (
    'button:has-text("Đăng nhập"), input[type="submit"][value*="Đăng nhập"]'
)

# ─── 222b ───
# CHI Dang xuat = da login. KHONG dung Nap tien/btn-recharge (trang guest cung co).
B222_LOGGED_IN = [
    "a.btn-logout",
    ".btn-logout",
    "a:has-text('Đăng xuất')",
    "button:has-text('Đăng xuất')",
]
# Live DOM dung #userName; giu #userId lam fallback neu layout cu.
B222_USERNAME = "#userName, #userId"
B222_PASSWORD = "#userPwd"
B222_CAPTCHA = "#loginVcode"
B222_LOGIN_BTN = (
    "form.player-login button.button-orange, button.player-info-button.button-orange"
)


@lru_cache(maxsize=1)
def _ocr() -> object | None:
    try:
        import ddddocr

        return ddddocr.DdddOcr(show_ad=False)
    except Exception as exc:
        logger.warning("Khong load duoc ddddocr: %s", exc)
        return None


async def _any_visible(page: Page, selectors: list[str], timeout: int = 1200) -> bool:
    for sel in selectors:
        try:
            if await page.locator(sel).first.is_visible(timeout=timeout):
                return True
        except Exception:
            continue
    return False


async def _ocr_image_bytes(data: bytes) -> str:
    engine = _ocr()
    if not engine:
        return ""
    try:
        text = engine.classification(data)
    except Exception as exc:
        logger.debug("OCR captcha loi: %s", exc)
        return ""
    return re.sub(r"[^a-zA-Z0-9]", "", str(text or "")).strip()


def _ocr_captcha_variants(data: bytes, *, prefer_len: int = 4) -> str:
    """OCR nhieu bien the anh — EE88 captcha nhieu noise / gach ngang.

    Chi giu ASCII a-z0-9; vote da so theo do dai prefer_len.
    """
    engine = _ocr()
    if not engine:
        return ""
    from collections import Counter

    candidates: list[str] = []

    def _clean(text: object) -> str:
        return "".join(
            c for c in str(text or "") if c.isascii() and c.isalnum()
        ).lower()

    def _add(raw: bytes) -> None:
        try:
            t = _clean(engine.classification(raw))
        except Exception:
            return
        if t:
            candidates.append(t)

    _add(data)
    try:
        import io

        from PIL import Image, ImageEnhance, ImageOps

        im = Image.open(io.BytesIO(data))
        if im.mode in ("P", "RGBA"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1] if im.mode == "RGBA" else None)
            rgb = bg
        else:
            rgb = im.convert("RGB")
        gray = ImageOps.autocontrast(ImageOps.grayscale(rgb))
        variants: list[Image.Image] = [
            rgb,
            gray,
            ImageOps.invert(gray),
            ImageEnhance.Contrast(gray).enhance(2.5),
        ]
        for thr in (120, 140, 160, 180):
            bw = gray.point(lambda x, t=thr: 255 if x > t else 0)
            variants.append(bw)
            variants.append(ImageOps.invert(bw))
        for img in variants:
            for scale in (1, 2, 3):
                work = img
                if scale > 1:
                    work = img.resize(
                        (img.width * scale, img.height * scale),
                        Image.Resampling.LANCZOS,
                    )
                buf = io.BytesIO()
                work.save(buf, format="PNG")
                _add(buf.getvalue())
    except Exception as exc:
        logger.debug("OCR variants preprocess: %s", exc)

    if not candidates:
        return ""

    # Vote trong nhom dung do dai; fallback gan prefer_len
    preferred = [t for t in candidates if len(t) == prefer_len]
    pool = preferred or [
        t for t in candidates if 3 <= len(t) <= 6
    ] or candidates
    best, _ = Counter(pool).most_common(1)[0]
    if not (3 <= len(best) <= 8):
        return ""
    return best


# ═══════════════════════════════════════════════════════════
# vipbet389 — dau hieu login: plyr* + so du (khong phai logout 222b)
# ═══════════════════════════════════════════════════════════


async def vipbet_login_form_visible(page: Page) -> bool:
    """Form header con hien = CHUA login."""
    try:
        return bool(
            await page.evaluate(
                """() => {
          const user = document.querySelector('input[name="username"]');
          const pass = document.querySelector('input[name="password"]');
          const code = document.querySelector('input[name="confirmCode"]');
          const btn = [...document.querySelectorAll('button, input[type="submit"]')]
            .find(el => /đăng\\s*nhập/i.test((el.textContent || el.value || '').trim()));
          const vis = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            return r.width > 2 && r.height > 2
              && st.visibility !== 'hidden' && st.display !== 'none';
          };
          return vis(user) || vis(pass) || vis(code) || vis(btn);
        }"""
            )
        )
    except Exception:
        return await _any_visible(
            page,
            [VIPBET_USERNAME, VIPBET_PASSWORD, VIPBET_CAPTCHA, 'button:has-text("Đăng nhập")'],
            timeout=800,
        )


async def vipbet_session_markers(page: Page) -> bool:
    """Vipbet da login: ID plyr* va/hoac so du goc phai header."""
    try:
        return bool(
            await page.evaluate(
                """() => {
          const body = (document.body && document.body.innerText) || '';
          if (/\\bplyr[a-z0-9]+\\b/i.test(body)) return true;

          const header = document.querySelector(
            'header, .header, .top-bar, .navbar, #header, .header-top, .member-info, .user-info'
          );
          const scope = header || document.body;
          if (!scope) return false;
          const ht = (scope.innerText || '').slice(0, 2500);
          if (/\\bplyr[a-z0-9]+\\b/i.test(ht)) return true;

          const hasMoney = /\\d{1,3}(,\\d{3})+(\\.\\d{1,2})?/.test(ht)
            || /\\d+\\.\\d{2}\\s*(VND|USD|K)?/i.test(ht);
          if (hasMoney && !/đăng\\s*nhập/i.test(ht)) {
            const moneyEl = [...scope.querySelectorAll('span,div,b,strong,em,p,a')]
              .find(el => /^\\s*\\d{1,3}(,\\d{3})+(\\.\\d{1,2})?\\s*$/.test((el.textContent || '').trim()));
            if (moneyEl) {
              const r = moneyEl.getBoundingClientRect();
              if (r.top < 120 && r.width > 10) return true;
            }
          }
          return false;
        }"""
            )
        )
    except Exception:
        return False


async def is_logged_in_vipbet(page: Page) -> bool:
    """Vipbet: form an + (plyr/so du | sanh AE SEXY dang mo)."""
    if await vipbet_login_form_visible(page):
        return False
    if await vipbet_session_markers(page):
        return True
    # Iframe AE SEXY (sanh/ban) chi mo khi da login web vipbet
    try:
        from src.ae_sexy import _game_launched, _get_shell_mode, _list_tables_in_frames

        mode = await _get_shell_mode(page)
        if mode in ("lobby", "room"):
            return True
        if await _game_launched(page) and len(await _list_tables_in_frames(page)) >= 1:
            return True
    except Exception:
        pass
    return False


async def _read_captcha_vipbet(page: Page) -> str:
    try:
        src = await page.evaluate(
            """() => {
          const img = document.querySelector('img[alt="captcha"]')
            || document.querySelector('img[src*="code"]')
            || document.querySelector('.captcha img')
            || document.querySelector('img.captcha');
          return img ? (img.src || img.getAttribute('src') || '') : '';
        }"""
        )
    except Exception:
        src = ""
    if src:
        m = re.search(r"code(\d{3,6})\.(?:png|jpe?g|gif|webp)", src, re.I)
        if m:
            return m.group(1)
        m = re.search(r"[?&](?:code|c|v)=(\d{3,6})", src, re.I)
        if m:
            return m.group(1)

    loc = page.locator(VIPBET_CAPTCHA_IMG).first
    try:
        if await loc.count() and await loc.is_visible(timeout=2500):
            text = await _ocr_image_bytes(await loc.screenshot(type="png"))
            digits = re.sub(r"\D+", "", text or "")
            if 3 <= len(digits) <= 6:
                return digits
    except Exception as exc:
        logger.debug("OCR screenshot captcha vipbet: %s", exc)

    if src:
        try:
            if src.startswith("data:image"):
                text = await _ocr_image_bytes(base64.b64decode(src.split(",", 1)[-1]))
            else:
                resp = await page.context.request.get(src)
                if not resp.ok:
                    return ""
                text = await _ocr_image_bytes(await resp.body())
            digits = re.sub(r"\D+", "", text or "")
            if 3 <= len(digits) <= 6:
                return digits
        except Exception as exc:
            logger.debug("OCR fetch captcha vipbet: %s", exc)
    return ""


async def _refresh_captcha_vipbet(page: Page) -> None:
    try:
        refreshed = await page.evaluate(
            """() => {
            const img = document.querySelector('img[alt="captcha"]')
              || document.querySelector('img[src*="code"]')
              || document.querySelector('.captcha img');
            if (!img) return false;
            let node = img.parentElement;
            for (let i = 0; i < 5 && node; i++) {
                const btn = node.querySelector('button, [role="button"], svg, a');
                if (btn) { btn.click(); return true; }
                node = node.parentElement;
            }
            img.click();
            return true;
        }"""
        )
        if refreshed:
            await page.wait_for_timeout(900)
    except Exception as exc:
        logger.debug("Refresh captcha vipbet: %s", exc)


async def login_flow_vipbet(
    page: Page,
    username: str,
    password: str,
    *,
    max_retries: int = 5,
) -> bool:
    if await is_logged_in_vipbet(page):
        logger.info("Da login vipbet san (plyr/so du/sanh)")
        return True

    if not await vipbet_login_form_visible(page):
        logger.warning("Chua thay form login vipbet — cho them...")
        await page.wait_for_timeout(2500)
        if await is_logged_in_vipbet(page):
            logger.info("Da login vipbet san (plyr/so du/sanh)")
            return True
        if not await vipbet_login_form_visible(page):
            logger.error(
                "Khong thay form dang nhap vipbet (va khong thay plyr/so du)"
            )
            return False

    for attempt in range(1, max_retries + 1):
        try:
            if await is_logged_in_vipbet(page):
                logger.info("Dang nhap vipbet thanh cong: %s", username)
                return True
            if not await vipbet_login_form_visible(page):
                logger.error("Khong thay form dang nhap vipbet")
                return False

            if attempt > 1:
                await _refresh_captcha_vipbet(page)

            captcha = await _read_captcha_vipbet(page)
            if not captcha:
                await _refresh_captcha_vipbet(page)
                await page.wait_for_timeout(500)
                captcha = await _read_captcha_vipbet(page)
            if not captcha:
                logger.error(
                    "Khong doc duoc captcha vipbet (lan %d) — thu OCR/refresh", attempt
                )
                continue

            logger.info("Ma xac minh vipbet: %s (lan %d)", captcha, attempt)
            await page.locator(VIPBET_USERNAME).first.fill(username)
            await page.locator(VIPBET_PASSWORD).first.fill(password)
            await page.locator(VIPBET_CAPTCHA).first.fill(captcha)
            await page.locator(VIPBET_LOGIN_BTN).first.click()
            await page.wait_for_timeout(3500)

            if await is_logged_in_vipbet(page):
                logger.info("Dang nhap vipbet thanh cong: %s", username)
                return True
            logger.warning(
                "Dang nhap vipbet that bai lan %d (sai captcha/MK?)",
                attempt,
            )
            await _refresh_captcha_vipbet(page)
        except Exception as exc:
            logger.error("Loi dang nhap vipbet lan %d: %s", attempt, exc)

    return False


# ═══════════════════════════════════════════════════════════
# 222b — dau hieu login: Dang xuat / Nap tien
# ═══════════════════════════════════════════════════════════


async def is_logged_in_222b(page: Page) -> bool:
    """222b: chi coi la login khi co Dang xuat HIEN.

    Khong dung Nap tien / Rut tien / btn-recharge — trang guest live.html van co.
    Form #userName/#userPwd hien hoac popup 'Vui long dang nhap truoc' = CHUA login.
    """
    try:
        hit = await page.evaluate(
            """() => {
          const isVis = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return false;
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0)
              return false;
            return true;
          };
          const text = (document.body && document.body.innerText) || '';
          if (/vui\\s*lòng\\s*đăng\\s*nhập\\s*trước/i.test(text))
            return { logged: false, why: 'need-login-modal' };

          const user = document.querySelector('#userName, #userId');
          const pwd = document.querySelector('#userPwd');
          if (isVis(user) || isVis(pwd))
            return { logged: false, why: 'login-form' };

          const loginBtn = document.querySelector(
            'form.player-login button.button-orange, button.player-info-button.button-orange'
          );
          if (isVis(loginBtn))
            return { logged: false, why: 'login-btn' };

          // Placeholder form "Ten dang nhap" + captcha = guest header
          if (/tên\\s*đăng\\s*nhập/i.test(text) && /mật\\s*khẩu/i.test(text)
              && document.querySelector('#loginVcode, #imgCode, img.imgCode'))
            return { logged: false, why: 'guest-header' };

          const logout = document.querySelector(
            'a.btn-logout, .btn-logout, a[href*="logout"], [onclick*="logout"]'
          );
          if (isVis(logout))
            return { logged: true, why: 'logout-btn' };

          for (const el of document.querySelectorAll('a, button, span, li, div')) {
            const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
            if (!/^đăng\\s*xuất$/i.test(t) && t.toLowerCase() !== 'logout') continue;
            if (isVis(el)) return { logged: true, why: 'logout-text' };
          }
          return { logged: false, why: 'no-logout' };
        }"""
        )
        if isinstance(hit, dict):
            if hit.get("logged"):
                logger.debug("222b login OK (%s)", hit.get("why"))
                return True
            logger.debug("222b chua login (%s)", hit.get("why"))
            return False
    except Exception as exc:
        logger.debug("is_logged_in_222b evaluate: %s", exc)

    # Fallback Playwright: chi nut Dang xuat visible
    try:
        if await page.locator(B222_USERNAME).first.is_visible(timeout=500):
            return False
    except Exception:
        pass
    return await _any_visible(page, B222_LOGGED_IN, timeout=600)


async def _read_captcha_222b(page: Page) -> str:
    src = await page.evaluate(
        """() => {
          const img = document.querySelector('#imgCode.imgCode')
            || document.querySelector('img.imgCode:not(.imgCode_forgetPwd)');
          return img ? (img.src || '') : '';
        }"""
    )
    if not src:
        return ""
    if src.startswith("data:image"):
        try:
            return await _ocr_image_bytes(base64.b64decode(src.split(",", 1)[-1]))
        except Exception:
            return ""
    try:
        resp = await page.context.request.get(src)
        if resp.ok:
            return await _ocr_image_bytes(await resp.body())
    except Exception as exc:
        logger.debug("Tai anh captcha 222b: %s", exc)
    return ""


async def _refresh_captcha_222b(page: Page) -> None:
    try:
        ok = await page.evaluate(
            """() => {
              if (typeof changeImgCode === 'function') { changeImgCode(); return true; }
              const img = document.querySelector('#imgCode.imgCode')
                || document.querySelector('img.imgCode:not(.imgCode_forgetPwd)');
              if (img) { img.click(); return true; }
              return false;
            }"""
        )
        if ok:
            await page.wait_for_timeout(900)
    except Exception as exc:
        logger.debug("Refresh captcha 222b: %s", exc)


async def _ensure_222b_login_form(page: Page) -> bool:
    """Dam bao form #userName/#userPwd dang hien (sau logout form co the an/can mo)."""
    async def _form_ready() -> bool:
        try:
            return bool(
                await page.evaluate(
                    """() => {
                      const u = document.querySelector('#userName, #userId');
                      const p = document.querySelector('#userPwd');
                      if (!u || !p) return false;
                      const ru = u.getBoundingClientRect();
                      const rp = p.getBoundingClientRect();
                      return ru.width > 20 && ru.height > 10 && rp.width > 20 && rp.height > 10;
                    }"""
                )
            )
        except Exception:
            return False

    if await _form_ready():
        return True

    # Ve trang co header login
    try:
        url = (page.url or "").lower()
    except Exception:
        url = ""
    if "222b" not in url:
        try:
            await page.goto(
                "https://www.222b.app/home/live.html",
                wait_until="domcontentloaded",
                timeout=60000,
            )
            await page.wait_for_timeout(2000)
        except Exception as exc:
            logger.debug("goto live.html: %s", exc)
    if await _form_ready():
        return True

    # Mo form: click vung login header (khong bam nut submit)
    try:
        await page.evaluate(
            """() => {
              const form = document.querySelector('form.player-login');
              if (form) {
                form.style.display = '';
                form.style.visibility = 'visible';
                form.style.opacity = '1';
              }
              const box = document.querySelector('.player-login, .player-info, .header-login');
              if (box) {
                box.style.display = '';
                box.style.visibility = 'visible';
              }
              // Mot so layout an input — click placeholder khu vuc dang nhap
              const tip = [...document.querySelectorAll('a,span,div,button')].find(el => {
                const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
                return /^đăng\\s*nhập$/i.test(t);
              });
              // Chi click neu form chua hien
              const u = document.querySelector('#userName, #userId');
              const r = u && u.getBoundingClientRect();
              if (tip && !(r && r.width > 20)) tip.click();
            }"""
        )
        await page.wait_for_timeout(800)
    except Exception as exc:
        logger.debug("mo form 222b: %s", exc)

    if await _form_ready():
        return True

    # Thu live.html lai
    try:
        await page.goto(
            "https://www.222b.app/home/live.html",
            wait_until="domcontentloaded",
            timeout=60000,
        )
        await page.wait_for_timeout(2500)
    except Exception:
        pass
    return await _form_ready()


async def login_flow_222b(
    page: Page,
    username: str,
    password: str,
    *,
    max_retries: int = 3,
) -> bool:
    if await is_logged_in_222b(page):
        logger.info("Da login 222b san (Dang xuat)")
        return True

    for attempt in range(1, max_retries + 1):
        try:
            if not await _ensure_222b_login_form(page):
                if await is_logged_in_222b(page):
                    return True
                logger.error("Khong thay form dang nhap 222b")
                return False

            user_loc = page.locator(B222_USERNAME).first
            # Co the Playwright coi an — van fill bang JS neu can
            try:
                visible = await user_loc.is_visible(timeout=2000)
            except Exception:
                visible = False

            if attempt > 1:
                await _refresh_captcha_222b(page)

            captcha = await _read_captcha_222b(page)
            if not captcha:
                await _refresh_captcha_222b(page)
                captcha = await _read_captcha_222b(page)
            if not captcha:
                logger.error("Khong doc duoc captcha 222b (can ddddocr)")
                continue

            logger.info("Ma xac minh 222b: %s (lan %d)", captcha, attempt)
            if visible:
                await user_loc.fill(username)
                await page.locator(B222_PASSWORD).first.fill(password)
                await page.locator(B222_CAPTCHA).first.fill(captcha)
            else:
                await page.evaluate(
                    """([u, p, c]) => {
                      const set = (sel, val) => {
                        const el = document.querySelector(sel);
                        if (!el) return false;
                        el.focus();
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                      };
                      set('#userName, #userId', u);
                      set('#userPwd', p);
                      set('#loginVcode', c);
                    }""",
                    [username, password, captcha],
                )

            clicked = await page.evaluate(
                """() => {
                  if (typeof loginForm === 'function') { loginForm(); return 'loginForm'; }
                  const btn = document.querySelector('form.player-login button.button-orange')
                    || document.querySelector('button.player-info-button.button-orange');
                  if (btn) { btn.click(); return 'button'; }
                  return '';
                }"""
            )
            if not clicked:
                await page.locator(B222_LOGIN_BTN).first.click(force=True)
            await page.wait_for_timeout(3500)

            if await is_logged_in_222b(page):
                logger.info("Dang nhap 222b thanh cong: %s", username)
                return True
            logger.warning("Dang nhap 222b that bai lan %d", attempt)
            await _refresh_captcha_222b(page)
        except Exception as exc:
            logger.error("Loi dang nhap 222b lan %d: %s", attempt, exc)

    return False


# ═══════════════════════════════════════════════════════════
# dly8829 (EE88) — Vue dialog Element UI + captcha khi can
# ═══════════════════════════════════════════════════════════

DLY_LOGIN_BTN_HEADER = "button.btn-login"
DLY_LOGIN_SUBMIT = (
    ".login .el-dialog button.loginBtn, "
    ".el-dialog[aria-label*='Đăng nhập'] button.loginBtn, "
    "button.loginBtn.el-button--primary"
)


async def is_logged_in_dly8829(page: Page) -> bool:
    """dly8829: da login khi KHONG con btn-login hien + co Dang xuat / user.

    Khong dung #userName (222b) hay plyr* (vipbet).
    """
    try:
        hit = await page.evaluate(
            """() => {
          const isVis = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return false;
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0)
              return false;
            return true;
          };
          const headerLogin = document.querySelector('button.btn-login');
          if (isVis(headerLogin))
            return { logged: false, why: 'btn-login' };

          const loginDlg = [...document.querySelectorAll('.el-dialog')].find(d => {
            if (!isVis(d)) return false;
            const title = ((d.querySelector('.el-dialog__title') || {}).textContent || '');
            return /đăng\\s*nhập/i.test(title);
          });
          if (loginDlg)
            return { logged: false, why: 'login-dialog' };

          for (const el of document.querySelectorAll('a, button, span, li, div')) {
            const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
            if (!/^đăng\\s*xuất$/i.test(t) && t.toLowerCase() !== 'logout') continue;
            if (isVis(el)) return { logged: true, why: 'logout-text' };
          }

          // Header user / so du (sau login EE88)
          const userBits = document.querySelector(
            '.userInfo, .user-info, .header-user, [class*="userName"], [class*="UserName"], [class*="balance"], [class*="Balance"]'
          );
          if (isVis(userBits))
            return { logged: true, why: 'user-header' };

          const text = (document.body && document.body.innerText) || '';
          // Co username-ish + Nap tien, khong con 'Dang nhap' button text trong header zone
          if (/nạp\\s*tiền/i.test(text) && /rút\\s*tiền/i.test(text)
              && !document.querySelector('button.btn-login'))
            return { logged: true, why: 'wallet-header' };

          return { logged: false, why: 'no-marker' };
        }"""
        )
        if isinstance(hit, dict):
            if hit.get("logged"):
                logger.debug("dly8829 login OK (%s)", hit.get("why"))
                return True
            logger.debug("dly8829 chua login (%s)", hit.get("why"))
            return False
    except Exception as exc:
        logger.debug("is_logged_in_dly8829 evaluate: %s", exc)
    return False


async def _dly8829_visible_dialog_title(page: Page) -> str:
    try:
        return str(
            await page.evaluate(
                """() => {
                  const wrap = [...document.querySelectorAll('.el-dialog__wrapper')].find(
                    w => getComputedStyle(w).display !== 'none'
                  );
                  if (!wrap) return '';
                  return ((wrap.querySelector('.el-dialog__title') || {}).textContent || '')
                    .replace(/\\s+/g, ' ').trim();
                }"""
            )
            or ""
        )
    except Exception:
        return ""


async def _dly8829_switch_register_to_login(page: Page) -> bool:
    """EE88: invite/userLogin mo Dang ky — bat buoc bam 'Dang nhap ngay'."""
    try:
        switched = await page.evaluate(
            """() => {
              const wrap = [...document.querySelectorAll('.el-dialog__wrapper')].find(w => {
                if (getComputedStyle(w).display === 'none') return false;
                const title = ((w.querySelector('.el-dialog__title') || {}).textContent || '');
                return /đăng\\s*ký/i.test(title);
              });
              if (!wrap) return 'no-register';
              const el = wrap.querySelector('a.loginDialogShow, .loginDialogShow')
                || [...wrap.querySelectorAll('a,span,div,button')].find(e =>
                  /đã có tài khoản|đăng nhập ngay/i.test(
                    (e.textContent || '').replace(/\\s+/g, ' ').trim()
                  )
                );
              if (!el) return 'no-link';
              el.click();
              return 'switched';
            }"""
        )
        if switched == "switched":
            await page.wait_for_timeout(800)
            logger.info("dly8829: chuyen popup Dang ky → Dang nhap")
            return True
        return False
    except Exception as exc:
        logger.debug("dly8829 switch register→login: %s", exc)
        return False


async def _ensure_dly8829_login_dialog(page: Page) -> bool:
    """Mo dung dialog Dang nhap (KHONG o lai Dang ky)."""

    async def _dialog_ready() -> bool:
        try:
            return bool(
                await page.evaluate(
                    """() => {
                      const wrap = [...document.querySelectorAll('.el-dialog__wrapper')].find(w => {
                        if (getComputedStyle(w).display === 'none') return false;
                        const title = ((w.querySelector('.el-dialog__title') || {}).textContent || '')
                          .replace(/\\s+/g, ' ').trim();
                        // Chi title Dang nhap — khong nham Dang ky (co chu 'Dang nhap ngay')
                        return /^đăng\\s*nhập\\s*$/i.test(title);
                      });
                      if (!wrap) return false;
                      const user = [...wrap.querySelectorAll('input')].find(
                        i => i.type === 'text' || /tài khoản/i.test(i.placeholder || '')
                      );
                      const pwd = wrap.querySelector('input[type=password]');
                      // Form login ~2 field; register co nhieu hon
                      const inputs = wrap.querySelectorAll(
                        'input[type=text], input[type=password]'
                      ).length;
                      return !!(user && pwd && inputs <= 3);
                    }"""
                )
            )
        except Exception:
            return False

    # Neu dang o Dang ky (invite auto) → chuyen ngay
    title = await _dly8829_visible_dialog_title(page)
    if re.search(r"đăng\s*ký", title or "", re.I):
        await _dly8829_switch_register_to_login(page)
    if await _dialog_ready():
        return True

    # Dong thong bao khac (giu register de switch)
    try:
        await page.evaluate(
            """() => {
              [...document.querySelectorAll('.el-dialog__wrapper')].forEach(w => {
                if (getComputedStyle(w).display === 'none') return;
                const title = ((w.querySelector('.el-dialog__title') || {}).textContent || '');
                if (/đăng\\s*nhập/i.test(title) || /đăng\\s*ký/i.test(title)) return;
                const btn = w.querySelector('.el-dialog__headerbtn');
                if (btn) btn.click();
              });
            }"""
        )
        await page.wait_for_timeout(300)
    except Exception:
        pass

    title = await _dly8829_visible_dialog_title(page)
    if re.search(r"đăng\s*ký", title or "", re.I):
        await _dly8829_switch_register_to_login(page)
        if await _dialog_ready():
            return True

    # Mo login: click header btn-login (co the van ra Dang ky)
    try:
        await page.evaluate(
            """() => {
              const b = document.querySelector('button.btn-login');
              let cur = b && b.__vue__;
              for (let i = 0; i < 12 && cur; i++) {
                if (typeof cur.userLogin === 'function') {
                  cur.userLogin();
                  return;
                }
                cur = cur.$parent;
              }
              if (b) b.click();
            }"""
        )
        await page.wait_for_timeout(700)
    except Exception as exc:
        logger.debug("dly8829 userLogin: %s", exc)

    if await _dialog_ready():
        return True

    # Bat buoc switch neu van dang ky
    await _dly8829_switch_register_to_login(page)
    if await _dialog_ready():
        return True

    # Lan cuoi: dong Dang ky roi click lai Dang nhap
    try:
        await page.evaluate(
            """() => {
              [...document.querySelectorAll('.el-dialog__wrapper')].forEach(w => {
                if (getComputedStyle(w).display === 'none') return;
                const title = ((w.querySelector('.el-dialog__title') || {}).textContent || '');
                if (!/đăng\\s*ký/i.test(title)) return;
                const btn = w.querySelector('.el-dialog__headerbtn');
                if (btn) btn.click();
              });
            }"""
        )
        await page.wait_for_timeout(400)
        await page.evaluate(
            """() => {
              const b = document.querySelector('button.btn-login');
              if (b) b.click();
            }"""
        )
        await page.wait_for_timeout(700)
        await _dly8829_switch_register_to_login(page)
    except Exception:
        pass

    return await _dialog_ready()


async def _dly8829_login_wrap(page: Page):
    """Locator dialog Dang nhap that — tranh nham Dang ky (co text 'Dang nhap ngay')."""
    return page.locator(".el-dialog__wrapper").filter(
        has=page.locator(".el-dialog__title", has_text=re.compile(r"^Đăng\s*nhập\s*$", re.I))
    ).first


async def _dly8829_header_login_ready(page: Page) -> bool:
    """Form login header (co Tai khoan + MK + captcha) — khong can dialog."""
    try:
        return bool(
            await page.evaluate(
                """() => {
                  const vis = (el) => {
                    if (!el) return false;
                    const r = el.getBoundingClientRect();
                    const s = getComputedStyle(el);
                    return r.width > 2 && r.height > 2
                      && s.display !== 'none' && s.visibility !== 'hidden';
                  };
                  const user = [...document.querySelectorAll('input')].find(
                    i => vis(i) && (i.type === 'text' || /tài khoản/i.test(i.placeholder || ''))
                      && !/mã|xác nhận/i.test(i.placeholder || '')
                  );
                  const pwd = [...document.querySelectorAll('input[type=password]')].find(vis);
                  const cap = [...document.querySelectorAll('input')].find(
                    i => vis(i) && /mã\\s*xác\\s*nhận|nhấp vào hình/i.test(i.placeholder || '')
                  );
                  return !!(user && pwd && cap);
                }"""
            )
        )
    except Exception:
        return False


_DLY8829_CAPTCHA_IMG_JS = """() => {
  const vis = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2
      && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const cap = [...document.querySelectorAll('input')].find(i => {
    if (!vis(i)) return false;
    return /mã\\s*xác\\s*nhận|nhấp vào hình/i.test(i.placeholder || '');
  });
  if (!cap) return null;
  const cr = cap.getBoundingClientRect();
  const icy = (cr.top + cr.bottom) / 2;
  // Anh that nam BEN PHAI o input (tranh badge 'kho bau' / promo phia tren)
  const imgs = [...document.querySelectorAll('img')].filter(im => {
    if (!vis(im)) return false;
    const r = im.getBoundingClientRect();
    const cy = (r.top + r.bottom) / 2;
    return Math.abs(cy - icy) < 28
      && r.left >= cr.right - 10
      && r.width >= 70 && r.width <= 200
      && r.height >= 22 && r.height <= 50;
  });
  imgs.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  if (imgs[0]) return imgs[0];
  // Fallback: el-form-item gan input
  const inForm = cap.closest('.el-form-item, .el-form-item__content, form, .login');
  if (inForm) {
    const formImgs = [...inForm.querySelectorAll('img')].filter(im => {
      if (!vis(im)) return false;
      const r = im.getBoundingClientRect();
      return r.width >= 70 && r.width <= 200 && r.height >= 22 && r.height <= 50;
    });
    if (formImgs[0]) return formImgs[0];
  }
  return null;
}"""


async def _dly8829_dismiss_blocking_popups(page: Page) -> None:
    """An popup van-like che form login (Rewards / filter) — tranh OCR/click nham."""
    try:
        await page.evaluate(
            """() => {
              for (const wrap of document.querySelectorAll('.van-like-popup-wrapper')) {
                const st = getComputedStyle(wrap);
                const r = wrap.getBoundingClientRect();
                if (st.display === 'none' || r.width < 2) continue;
                wrap.style.display = 'none';
                wrap.style.pointerEvents = 'none';
              }
              // click nut Dong / Huy neu con
              for (const el of document.querySelectorAll(
                '.van-like-popup-wrapper .popup-content div, .van-like-popup-wrapper img'
              )) {
                const t = (el.textContent || '').trim();
                if (/^(đóng|hủy|huỷ|close)$/i.test(t)) el.click();
              }
            }"""
        )
    except Exception:
        pass


async def _dly8829_captcha_img_handle(page: Page):
    """Anh captcha nam BEN PHAI o 'Nhap ma xac nhan' (header/dialog)."""
    handle = await page.evaluate_handle(_DLY8829_CAPTCHA_IMG_JS)
    return handle.as_element()


async def _dly8829_captcha_src(page: Page) -> str:
    try:
        js = (
            "() => { const pick = "
            + _DLY8829_CAPTCHA_IMG_JS
            + "; const img = pick();"
            " if (img && img.src) return img.src;"
            " const v = document.querySelector('.login') && document.querySelector('.login').__vue__;"
            " if (v && v.captchaImg) return v.captchaImg;"
            " return ''; }"
        )
        return (await page.evaluate(js)) or ""
    except Exception:
        return ""


async def _read_captcha_dly8829(page: Page) -> str:
    """OCR captcha EE88 — uu tien data:image src (tranh screenshot bi overlay)."""
    await _dly8829_dismiss_blocking_popups(page)

    src = await _dly8829_captcha_src(page)
    if src:
        try:
            if src.startswith("data:image"):
                raw = base64.b64decode(src.split(",", 1)[-1])
            else:
                resp = await page.context.request.get(src)
                raw = await resp.body() if resp.ok else b""
            if raw:
                text = _ocr_captcha_variants(raw, prefer_len=4)
                if text:
                    return text
        except Exception as exc:
            logger.debug("OCR src captcha dly8829: %s", exc)

    try:
        el = await _dly8829_captcha_img_handle(page)
        if el:
            shot = await el.screenshot(type="png")
            text = _ocr_captcha_variants(shot, prefer_len=4)
            if text:
                return text
    except Exception as exc:
        logger.debug("OCR screenshot captcha dly8829: %s", exc)
    return ""


async def _refresh_captcha_dly8829(page: Page) -> None:
    try:
        await _dly8829_dismiss_blocking_popups(page)
        old_src = await _dly8829_captcha_src(page)
        js = (
            "() => { const pick = "
            + _DLY8829_CAPTCHA_IMG_JS
            + "; const img = pick();"
            " if (img) { img.click(); return 'img'; }"
            " const v = document.querySelector('.login') && document.querySelector('.login').__vue__;"
            " if (v && typeof v.getCaptcha === 'function') {"
            "   v.needCaptcha = true; v.getCaptcha();"
            "   if (v.$forceUpdate) v.$forceUpdate(); return 'vue';"
            " } return ''; }"
        )
        clicked = await page.evaluate(js)
        if clicked:
            for _ in range(10):
                await page.wait_for_timeout(200)
                new_src = await _dly8829_captcha_src(page)
                if new_src and new_src != old_src:
                    break
    except Exception as exc:
        logger.debug("Refresh captcha dly8829: %s", exc)


async def login_flow_dly8829(
    page: Page,
    username: str,
    password: str,
    *,
    max_retries: int = 8,
) -> bool:
    """Login EE88: form header/dialog + captcha OCR (bat buoc khi co o ma)."""
    if await is_logged_in_dly8829(page):
        logger.info("Da login dly8829 san")
        return True

    for attempt in range(1, max_retries + 1):
        try:
            dialog_ok = await _ensure_dly8829_login_dialog(page)
            header_ok = await _dly8829_header_login_ready(page)
            if not dialog_ok and not header_ok:
                if await is_logged_in_dly8829(page):
                    return True
                # Co the dang o header nhung captcha chua hien — thu click login
                try:
                    await page.locator("button.btn-login").first.click(force=True, timeout=2000)
                    await page.wait_for_timeout(600)
                    await _dly8829_switch_register_to_login(page)
                except Exception:
                    pass
                dialog_ok = await _ensure_dly8829_login_dialog(page)
                header_ok = await _dly8829_header_login_ready(page)
            if not dialog_ok and not header_ok:
                logger.error("Khong thay form dang nhap dly8829 (dialog/header)")
                return False

            # Captcha: luon OCR khi co o ma (header dang yeu cau)
            need_cap = header_ok or bool(
                await page.evaluate(
                    """() => {
                      const v = document.querySelector('.login') && document.querySelector('.login').__vue__;
                      if (v && v.needCaptcha) return true;
                      return [...document.querySelectorAll('input')].some(i => {
                        const r = i.getBoundingClientRect();
                        if (r.width < 2) return false;
                        return /mã\\s*xác\\s*nhận|nhấp vào hình/i.test(i.placeholder || '');
                      });
                    }"""
                )
            )

            captcha = ""
            if need_cap:
                if attempt > 1:
                    await _refresh_captcha_dly8829(page)
                captcha = await _read_captcha_dly8829(page)
                if not captcha:
                    await _refresh_captcha_dly8829(page)
                    captcha = await _read_captcha_dly8829(page)
                if captcha:
                    logger.info("Ma xac minh dly8829: %s (lan %d)", captcha, attempt)
                else:
                    logger.warning("dly8829 OCR captcha rong (lan %d) — thu lai", attempt)
                    await _refresh_captcha_dly8829(page)
                    continue

            # Scope fill: dialog Dang nhap neu co, khong thi toan trang (header)
            wrap = await _dly8829_login_wrap(page)
            use_dialog = bool(await wrap.count()) and dialog_ok
            scope = wrap if use_dialog else page

            user_inp = scope.locator(
                "input[placeholder*='Tài khoản']"
            ).first
            pwd_inp = scope.locator("input[type='password']").first
            await user_inp.fill(username, timeout=5000)
            await pwd_inp.fill(password, timeout=5000)

            if captcha:
                # EE88 captcha hien chu hoa — gui uppercase
                captcha = captcha.upper()
                cap_inp = scope.locator(
                    "input[placeholder*='xác nhận'], input[placeholder*='Mã xác nhận'], "
                    "input[placeholder*='mã xác nhận'], input[placeholder*='nhấp vào hình']"
                ).first
                await cap_inp.fill(captcha, timeout=5000)
                # Dong bo Vue neu co
                await page.evaluate(
                    """([u, p, c]) => {
                      const v = document.querySelector('.login') && document.querySelector('.login').__vue__;
                      if (v && v.ruleForm) {
                        v.ruleForm.username = u;
                        v.ruleForm.password = p;
                        v.ruleForm.captcha = c;
                      }
                      const setVal = (el, val) => {
                        if (!el) return;
                        const desc = Object.getOwnPropertyDescriptor(
                          window.HTMLInputElement.prototype, 'value'
                        );
                        if (desc && desc.set) desc.set.call(el, val);
                        else el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                      };
                      const inputs = [...document.querySelectorAll('input')];
                      const user = inputs.find(i => /tài khoản/i.test(i.placeholder || ''));
                      const pwd = inputs.find(i => i.type === 'password');
                      const cap = inputs.find(i =>
                        /mã\\s*xác\\s*nhận|nhấp vào hình/i.test(i.placeholder || '')
                      );
                      setVal(user, u);
                      setVal(pwd, p);
                      setVal(cap, c);
                    }""",
                    [username, password, captcha],
                )

            # Click Dang nhap — uu tien trong dialog, khong thi header btn-login / loginBtn
            clicked = False
            if use_dialog:
                try:
                    await wrap.locator("button.loginBtn").first.click(timeout=3000)
                    clicked = True
                except Exception:
                    pass
            if not clicked:
                clicked = bool(
                    await page.evaluate(
                        """() => {
                          // Header: nut Dang nhap gan form (khong phai Google)
                          const btns = [...document.querySelectorAll('button')].filter(b => {
                            const r = b.getBoundingClientRect();
                            if (r.width < 2 || r.height < 2) return false;
                            const t = (b.textContent || '').replace(/\\s+/g, ' ').trim();
                            return /^đăng\\s*nhập$/i.test(t);
                          });
                          // Uu tien loginBtn primary / button gan captcha
                          const primary = btns.find(b => /loginBtn|button-orange|el-button--primary/i.test(b.className || ''))
                            || btns.find(b => !/google/i.test(b.className || ''))
                            || btns[0];
                          if (primary) { primary.click(); return true; }
                          const v = document.querySelector('.login') && document.querySelector('.login').__vue__;
                          if (v && typeof v.submitForm === 'function') {
                            v.submitForm('ruleForm');
                            return true;
                          }
                          return false;
                        }"""
                    )
                )
            if not clicked:
                await page.locator("button.btn-login, button.loginBtn").first.click(
                    force=True, timeout=3000
                )

            await page.wait_for_timeout(3500)
            if await is_logged_in_dly8829(page):
                logger.info("Dang nhap dly8829 thanh cong: %s", username)
                return True

            toast = await _dly8829_login_toast(page)
            if toast:
                logger.warning("dly8829 login toast (lan %d): %s", attempt, toast)
            if toast and re.search(
                r"lặp lại quá thường xuyên|quá thường xuyên|thao tác.*thường xuyên|too\s*many|rate\s*limit",
                toast,
                re.I,
            ):
                # Site chan spam — dung som, khong spam them
                wait_s = 60 if attempt == 1 else 90
                logger.error(
                    "dly8829 bi gioi han tan suat login — cho %ds (lan %d/%d). "
                    "Neu van bi, dung tool ~2-3 phut roi chay lai.",
                    wait_s,
                    attempt,
                    max_retries,
                )
                if attempt >= 2:
                    logger.error("dly8829: dung login do rate-limit (tranh khoa them)")
                    return False
                await page.wait_for_timeout(wait_s * 1000)
                await _refresh_captcha_dly8829(page)
                continue

            # Sai captcha / MK — doi them de tranh rate-limit
            logger.warning(
                "Dang nhap dly8829 that bai lan %d (sai captcha/MK?)%s",
                attempt,
                f" — {toast}" if toast else "",
            )
            await page.wait_for_timeout(2500)
            await _refresh_captcha_dly8829(page)
        except Exception as exc:
            logger.error("Loi dang nhap dly8829 lan %d: %s", attempt, exc)
            await _refresh_captcha_dly8829(page)

    return False


async def _dly8829_login_toast(page: Page) -> str:
    """Doc thong bao el-message / toast sau khi bam Dang nhap."""
    try:
        return (
            await page.evaluate(
                """() => {
                  const sels = [
                    '.el-message__content', '.el-message', '.el-notification__content',
                    '.van-toast', '.toast', '[class*=\"el-message\"]'
                  ];
                  const texts = [];
                  for (const sel of sels) {
                    for (const el of document.querySelectorAll(sel)) {
                      const t = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
                      if (t && t.length < 180) texts.push(t);
                    }
                  }
                  return [...new Set(texts)].join(' | ');
                }"""
            )
            or ""
        )
    except Exception:
        return ""


# Alias cu (tranh break import)
_vipbet_login_form_visible = vipbet_login_form_visible
_vipbet_session_markers = vipbet_session_markers
