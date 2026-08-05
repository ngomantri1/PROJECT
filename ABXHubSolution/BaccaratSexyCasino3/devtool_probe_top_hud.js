(() => {
  const ROOT_ID = '__abx_top_hud_probe__';

  function collapse(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function norm(s) {
    try {
      return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (_) {
      return String(s || '').toLowerCase();
    }
  }

  function moneyOf(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().toUpperCase();
    let mul = 1;
    if (/[KMB]$/.test(s)) {
      if (/K$/.test(s)) mul = 1e3;
      else if (/M$/.test(s)) mul = 1e6;
      else mul = 1e9;
      s = s.slice(0, -1).replace(/,/g, '').replace(/[^\d.]/g, '');
      const v = parseFloat(s);
      return Number.isFinite(v) ? Math.round(v * mul) : null;
    }
    if (!/^\$?\s*[\d.,]+$/.test(s.replace(/[^\d.,$]/g, ''))) {
      s = s.replace(/[^\d.,]/g, '');
    }
    if (!s) return null;
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      s = s.replace(/,/g, '');
    } else if (hasComma && !hasDot) {
      s = s.replace(/,/g, '.');
    }
    const v = parseFloat(s);
    if (Number.isFinite(v)) {
      if (hasDot || hasComma) return v;
      return parseInt(String(v), 10);
    }
    return null;
  }

  function balanceOf(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().toUpperCase();
    if (!s) return null;
    s = s.replace(/[₫$€£¥]/g, '').replace(/\s+/g, '');
    if (/[KMB]$/.test(s)) return moneyOf(s);
    if (/^\d+\.\d{1,2}$/.test(s)) {
      const v = parseFloat(s);
      return Number.isFinite(v) ? v : null;
    }
    if (/^\d+,\d{1,2}$/.test(s)) {
      const v = parseFloat(s.replace(',', '.'));
      return Number.isFinite(v) ? v : null;
    }
    if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
      const v = parseFloat(s.replace(/,/g, ''));
      return Number.isFinite(v) ? v : null;
    }
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
      const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(v) ? v : null;
    }
    return moneyOf(s);
  }

  function fmt(v) {
    if (v == null) return '--';
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return String(v);
  }

  function visible(el) {
    try {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (!r || r.width < 4 || r.height < 4) return false;
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || window;
      const cs = view.getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    } catch (_) {
      return false;
    }
  }

  function cssPath(el) {
    try {
      const out = [];
      let cur = el;
      let depth = 0;
      while (cur && cur.nodeType === 1 && depth < 10) {
        let part = cur.nodeName.toLowerCase();
        if (cur.id) {
          part += '#' + cur.id;
          out.unshift(part);
          break;
        }
        if (cur.className && typeof cur.className === 'string') {
          const cls = cur.className.trim().split(/\s+/).slice(0, 2).join('.');
          if (cls) part += '.' + cls;
        }
        out.unshift(part);
        cur = cur.parentElement;
        depth++;
      }
      return out.join(' > ');
    } catch (_) {
      return '';
    }
  }

  function removeOverlay() {
    try {
      const old = document.getElementById(ROOT_ID);
      if (old) old.remove();
    } catch (_) {}
  }

  function makeOverlay() {
    removeOverlay();
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    document.documentElement.appendChild(root);
    return root;
  }

  function drawBox(root, item, color, label) {
    if (!root || !item) return;
    const box = document.createElement('div');
    box.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'border:2px solid ' + color,
      'background:' + color + '22',
      'left:' + Math.round(item.x) + 'px',
      'top:' + Math.round(item.y) + 'px',
      'width:' + Math.max(6, Math.round(item.w)) + 'px',
      'height:' + Math.max(6, Math.round(item.h)) + 'px',
      'box-sizing:border-box'
    ].join(';');
    root.appendChild(box);

    const tag = document.createElement('div');
    tag.textContent = label;
    tag.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'left:' + Math.round(item.x) + 'px',
      'top:' + Math.max(0, Math.round(item.y) - 18) + 'px',
      'background:' + color,
      'color:#fff',
      'padding:1px 4px',
      'font:12px Consolas, monospace',
      'border-radius:3px'
    ].join(';');
    root.appendChild(tag);
  }

  function walkContexts(rootWin, source, offX, offY, out, seen) {
    try {
      if (!rootWin || seen.includes(rootWin)) return;
      seen.push(rootWin);
      const doc = rootWin.document;
      if (doc && doc.documentElement) {
        out.push({
          win: rootWin,
          doc,
          source,
          href: String(rootWin.location && rootWin.location.href || ''),
          offX: offX || 0,
          offY: offY || 0
        });
      }
    } catch (_) {
      return;
    }
    try {
      for (let i = 0; i < rootWin.frames.length; i++) {
        const child = rootWin.frames[i];
        const fe = child.frameElement;
        const fr = fe && fe.getBoundingClientRect ? fe.getBoundingClientRect() : { left: 0, top: 0 };
        walkContexts(child, source + '/frame[' + i + ']', (offX || 0) + (fr.left || 0), (offY || 0) + (fr.top || 0), out, seen);
      }
    } catch (_) {}
  }

  function collectTopTexts(ctx) {
    const out = [];
    const seen = Object.create(null);
    const view = ctx.win;
    const doc = ctx.doc;
    const topBand = Math.max(140, (view.innerHeight || 900) * 0.2);
    const maxX = (view.innerWidth || 1600) * 0.98;
    const all = doc.querySelectorAll('span,div,p,li,a,b,strong,label');
    for (let i = 0; i < all.length && i < 5000; i++) {
      const el = all[i];
      if (!visible(el)) continue;
      const txt = collapse(el.innerText || el.textContent || '');
      if (!txt || txt.length > 120) continue;
      const n = norm(txt);
      if (/canvas watch|scan200|copylog|clearlog/.test(n)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.top > topBand) continue;
      if (r.left < 0 || r.left > maxX) continue;
      if (r.width > (view.innerWidth || 1600) * 0.8 || r.height > topBand * 0.8) continue;
      const key = txt + '|' + Math.round(r.left) + '|' + Math.round(r.top) + '|' + Math.round(r.width) + '|' + Math.round(r.height);
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({
        source: ctx.source,
        href: ctx.href,
        text: txt,
        norm: n,
        x: (ctx.offX || 0) + r.left,
        y: (ctx.offY || 0) + r.top,
        w: r.width,
        h: r.height,
        element: el,
        tail: cssPath(el),
        money: balanceOf(txt)
      });
    }
    out.sort((a, b) => a.y - b.y || a.x - b.x || a.text.localeCompare(b.text));
    return out;
  }

  function pickBestAccount(rows) {
    const accounts = rows
      .filter(t => /^(plyr|player|user|usr)[a-z0-9_]{3,}$/i.test(t.text))
      .map(t => {
        let score = 100;
        if (t.y <= 30) score += 20;
        if (t.x >= 150) score += 10;
        if (/frame\[0\]/.test(t.source)) score += 10;
        return { ...t, score };
      })
      .sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
    return {
      best: accounts[0] || null,
      candidates: accounts.slice(0, 10)
    };
  }

  function pickBestBalance(rows, account) {
    const balances = [];
    for (const t of rows) {
      const n = norm(t.text);
      const mv = t.money;
      const hasLabel = /so du|sodu|balance/.test(n);
      if (!hasLabel && mv == null) continue;
      let score = 0;
      if (hasLabel) score += 100;
      if (mv != null) score += 30;
      if (/0\.00|0,00/.test(t.text)) score += 30;
      if (/^\d+(?:[.,]\d+)?(?:[KMB])?$/.test(t.text.trim()) && t.text.trim().length <= 10) score += 10;
      if (account && t.source === account.source) score += 20;
      if (account) {
        const dy = Math.abs((t.y + t.h / 2) - (account.y + account.h / 2));
        const dx = t.x - (account.x + account.w);
        if (dy <= 16) score += 50;
        else if (dy <= 28) score += 20;
        if (dx >= -80 && dx <= 520) score += 60;
        else if (dx >= -160 && dx <= 700) score += 15;
        if (dx >= 0) score += 10;
      }
      balances.push({ ...t, score });
    }
    balances.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
    return {
      best: balances[0] || null,
      candidates: balances.slice(0, 20)
    };
  }

  function pickHud(texts) {
    const accountPick = pickBestAccount(texts);
    const account = accountPick.best;
    const balancePick = pickBestBalance(texts, account);
    const balance = balancePick.best;

    return {
      account,
      balance,
      accountCandidates: accountPick.candidates,
      balanceCandidates: balancePick.candidates
    };
  }

  function run() {
    const contexts = [];
    walkContexts(window.top || window, 'top', 0, 0, contexts, []);
    const rowsByContext = contexts.map(ctx => ({
      source: ctx.source,
      href: ctx.href,
      rows: collectTopTexts(ctx)
    }));

    const allRows = rowsByContext.flatMap(x => x.rows);
    const hud = pickHud(allRows);
    const overlay = makeOverlay();
    if (hud.account) drawBox(overlay, hud.account, '#0bf', 'ACCOUNT');
    if (hud.balance) drawBox(overlay, hud.balance, '#f80', 'BALANCE');

    const contextSummary = rowsByContext.map(x => ({
      source: x.source,
      href: x.href,
      rows: x.rows.length,
      sample: x.rows.slice(0, 8).map(r => r.text).join(' | ')
    }));

    console.log('[ABX HUD PROBE] account=', hud.account ? {
      source: hud.account.source,
      text: hud.account.text,
      x: Math.round(hud.account.x),
      y: Math.round(hud.account.y),
      tail: hud.account.tail
    } : null);
    console.log('[ABX HUD PROBE] balance=', hud.balance ? {
      source: hud.balance.source,
      text: hud.balance.text,
      money: hud.balance.money,
      fmt: fmt(hud.balance.money),
      x: Math.round(hud.balance.x),
      y: Math.round(hud.balance.y),
      tail: hud.balance.tail
    } : null);
    console.log('[ABX HUD PROBE] contexts=');
    console.table(contextSummary);
    console.log('[ABX HUD PROBE] accountCandidates=');
    console.table(hud.accountCandidates.map(x => ({
      source: x.source,
      text: x.text,
      score: x.score,
      x: Math.round(x.x),
      y: Math.round(x.y),
      tail: x.tail
    })));
    console.log('[ABX HUD PROBE] balanceCandidates=');
    console.table(hud.balanceCandidates.map(x => ({
      source: x.source,
      text: x.text,
      money: x.money,
      fmt: fmt(x.money),
      score: x.score,
      x: Math.round(x.x),
      y: Math.round(x.y),
      tail: x.tail
    })));

    window.__abx_probe_top_hud_result = {
      account: hud.account,
      balance: hud.balance,
      accountCandidates: hud.accountCandidates,
      balanceCandidates: hud.balanceCandidates,
      contexts: contextSummary
    };
    return window.__abx_probe_top_hud_result;
  }

  window.__abx_probe_top_hud = run;
  run();
})();
