(() => {
  const CW2 = {};
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function log(...args) {
    console.log('[cw2]', ...args);
  }

  function NORM(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  }

  function normalizeSide(raw) {
    const s = NORM(raw).replace(/[^A-Z0-9]+/g, '_');
    if (!s) return 'PLAYER';
    if (s === 'BANKER' || s === 'B' || s === 'NHA_CAI') return 'BANKER';
    if (s === 'PLAYER' || s === 'P' || s === 'TAY_CON') return 'PLAYER';
    if (s === 'TIE' || s === 'T' || s === 'HOA') return 'TIE';
    return 'PLAYER';
  }

  function findGameFrame() {
    const frames = Array.from(document.querySelectorAll('iframe'));
    for (let i = 0; i < frames.length; i++) {
      try {
        const w = frames[i].contentWindow;
        const href = String(w.location.href || '');
        if (/singleBacTable\.jsp/i.test(href)) return w;
      } catch (_) {}
    }
    return null;
  }

  function domVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || '1') > 0.05;
  }

  function domTextOf(el) {
    try {
      return String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (_) {
      return '';
    }
  }

  function parseDomChipValue(txt) {
    if (!txt) return null;
    const s = NORM(txt);
    let m = s.match(/(\d+)\s*(K|M)\b/);
    if (m) {
      let v = +m[1];
      v *= (m[2] === 'K' ? 1000 : 1000000);
      return v >= 1000 ? Math.floor(v / 1000) : v;
    }
    m = s.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d{1,9})/);
    if (!m) return null;
    const n = parseInt(m[1].replace(/[^\d]/g, ''), 10);
    if (!isFinite(n) || n <= 0) return null;
    return n >= 1000 ? Math.floor(n / 1000) : n;
  }

  function domChipValueFromIdOrClass(el) {
    let raw = '';
    try {
      raw = String(el.id || '') + ' ' + String(el.className || '');
    } catch (_) {}
    const m = NORM(raw).match(/(?:^|[_\-\s])(50K|20K|10K|5K|2K|1K|500|200|100|50|20|10)(?:$|[_\-\s])/i);
    return m ? parseDomChipValue(m[1]) : null;
  }

  function minimalClick(el) {
    if (!el) return false;
    try {
      el.click();
      return true;
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      return true;
    } catch (_) {}
    return false;
  }

  function collectPopupChips(doc) {
    const nodes = Array.from(doc.querySelectorAll("[id^='Chips_'], [id^='iChips_']"));
    const out = {};
    for (const li of nodes) {
      if (!domVisible(li)) continue;
      const rect = li.getBoundingClientRect();
      const val = parseDomChipValue(domTextOf(li)) || domChipValueFromIdOrClass(li);
      if (!val) continue;
      const key = String(val);
      out[key] = { el: li, val, rect };
    }
    return out;
  }

  function collectBarChips(doc) {
    const nodes = Array.from(doc.querySelectorAll(".list_select_chips3d > div, .list_select_chips3d > li, .chips3d"));
    const out = {};
    for (const el of nodes) {
      if (!domVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < doc.defaultView.innerHeight * 0.72) continue;
      const val = parseDomChipValue(domTextOf(el)) || domChipValueFromIdOrClass(el);
      if (!val) continue;
      const key = String(val);
      if (!out[key]) out[key] = { el, val, rect };
    }
    return out;
  }

  function scanChips(doc) {
    const a = collectPopupChips(doc);
    if (Object.keys(a).length) return a;
    return collectBarChips(doc);
  }

  function betSideOfText(text) {
    const s = NORM(text || '');
    if (/PLAYER|TAY CON|闲/.test(s)) return 'PLAYER';
    if (/BANKER|NHA CAI|庄/.test(s)) return 'BANKER';
    if (/TIE|HOA|和/.test(s)) return 'TIE';
    return null;
  }

  function findBetTarget(doc, side) {
    const want = normalizeSide(side);
    const all = Array.from(doc.querySelectorAll("li[id^='betBox'], .zone_bet_bottom > li, .zone_bet_bottom li, .zone_bet_bottom > div, .zone_bet_bottom div"));
    let best = null;

    for (const el of all) {
      if (!domVisible(el)) continue;
      const txt = domTextOf(el);
      const sideHit = betSideOfText(txt);
      if (sideHit !== want) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < doc.defaultView.innerHeight * 0.60) continue;
      if (rect.width < 50 || rect.height < 30) continue;

      const area = rect.width * rect.height;
      if (!best || area > best.area) {
        best = { el, rect, text: txt, area };
      }
    }
    return best;
  }

  function findConfirm(doc) {
    const all = Array.from(doc.querySelectorAll("button#confirm, .btn_confirm, .list_btn_confirm button, .list_btn_confirm *"));
    let best = null;

    for (const el of all) {
      if (!domVisible(el)) continue;
      const txt = domTextOf(el);
      const s = NORM(txt);
      if (!(s.includes('XAC NHAN') || s === 'CONFIRM' || s === 'OK')) continue;

      const cls = String(el.className || '');
      const disabled =
        el.disabled ||
        el.getAttribute('disabled') != null ||
        el.getAttribute('aria-disabled') === 'true' ||
        /\bdisabled\b/i.test(cls);

      const rect = el.getBoundingClientRect();
      if (rect.top < doc.defaultView.innerHeight * 0.70) continue;

      const area = rect.width * rect.height;
      if (!best || area > best.area) {
        best = { el, rect, text: txt, disabled, area };
      }
    }
    return best;
  }

  function makePlan(units, availableKeys) {
    let remain = units;
    const denoms = availableKeys.map(Number).filter(x => x > 0).sort((a, b) => b - a);
    const plan = [];

    for (const d of denoms) {
      while (remain >= d) {
        plan.push(d);
        remain -= d;
      }
    }
    return remain === 0 ? plan : null;
  }

  CW2.scan = function () {
    const w = findGameFrame();
    if (!w) return log('frame not found'), null;
    const map = scanChips(w.document);
    log('frame=', w.location.href);
    log('chips=', Object.keys(map).sort((a, b) => (+a) - (+b)));
    console.log(map);
    return map;
  };

  CW2.focus = async function (chipUnits) {
    const w = findGameFrame();
    if (!w) return false;
    const map = scanChips(w.document);
    const info = map[String(chipUnits)];
    if (!info) {
      log('chip not found', chipUnits, 'have=', Object.keys(map));
      return false;
    }
    const ok = minimalClick(info.el);
    await sleep(120);
    log('focus', chipUnits, '=>', ok);
    return ok;
  };

  CW2.bet = async function (side, amount) {
    const w = findGameFrame();
    if (!w) {
      log('frame not found');
      return { ok: false, error: 'frame not found' };
    }
    const doc = w.document;
    const units = Math.floor((Number(amount) || 0) / 1000);
    if (!units) return { ok: false, error: 'bad amount' };

    const target = findBetTarget(doc, side);
    if (!target) {
      log('target not found', side);
      return { ok: false, error: 'target not found' };
    }

    let chips = scanChips(doc);
    const plan = makePlan(units, Object.keys(chips));
    if (!plan) {
      log('cannot make plan', { amount, units, availUnits: Object.keys(chips) });
      return { ok: false, error: 'cannot make plan' };
    }

    log('BET START', { side, amount, units, plan });

    for (let i = 0; i < plan.length; i++) {
      const u = plan[i];
      chips = scanChips(doc);
      const chip = chips[String(u)];
      if (!chip) {
        log('chip missing', u);
        return { ok: false, error: 'chip missing ' + u };
      }

      minimalClick(chip.el);
      await sleep(85);

      minimalClick(target.el);
      await sleep(70);

      if (i < plan.length - 1) {
        await sleep(75);
      }
    }

    const confirm = findConfirm(doc);
    if (!confirm) {
      log('confirm not found');
      return { ok: false, error: 'confirm not found' };
    }
    if (confirm.disabled) {
      log('confirm disabled');
      return { ok: false, error: 'confirm disabled' };
    }

    minimalClick(confirm.el);
    await sleep(20);

    log('DONE', { side, amount, units });
    return { ok: true, side, amount, units };
  };

  window.__cw2_scan = CW2.scan;
  window.__cw2_focus = CW2.focus;
  window.__cw2_bet = CW2.bet;

  log('ready');
})();
