(() => {
  if (window.__wsBetTotalsProbe && typeof window.__wsBetTotalsProbe.stop === 'function') {
    window.__wsBetTotalsProbe.stop();
  }

  const state = {
    installedAt: Date.now(),
    sockets: new Set(),
    logs: [],
    last: null,
    panel: null,
    orig: {}
  };

  function now() {
    return new Date().toLocaleTimeString();
  }

  function ensurePanel() {
    if (state.panel) return;
    const d = document.createElement('div');
    d.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:12px',
      'z-index:2147483647',
      'min-width:360px',
      'max-width:640px',
      'padding:10px 12px',
      'background:rgba(0,0,0,.84)',
      'color:#9ff7c2',
      'font:12px/1.45 Consolas,Menlo,monospace',
      'white-space:pre-wrap',
      'border:1px solid rgba(120,255,180,.45)',
      'border-radius:8px',
      'box-shadow:0 8px 28px rgba(0,0,0,.35)'
    ].join(';');
    document.body.appendChild(d);
    state.panel = d;
    render();
  }

  function render() {
    ensurePanel();
    const x = state.last;
    const lines = ['WS bet totals probe'];
    lines.push('Installed: ' + new Date(state.installedAt).toLocaleTimeString());
    lines.push('Sockets: ' + state.sockets.size);
    lines.push('');
    if (x) {
      lines.push('CHẴN: ' + fmt(x.CHAN));
      lines.push('LẺ  : ' + fmt(x.LE));
      lines.push('TÀI : ' + fmt(x.TAI));
      lines.push('XỈU : ' + fmt(x.XIU));
      lines.push('status=' + (x.status || '-'));
      lines.push('timeBet=' + (x.timeBet ?? '-'));
      lines.push('timeBetCountdown=' + (x.timeBetCountdown ?? '-'));
      lines.push('sessionId=' + (x.sessionId ?? '-'));
      lines.push('roundId=' + (x.roundId || '-'));
      lines.push('source=' + (x.url || '-'));
      lines.push('at=' + (x.at || '-'));
    } else {
      lines.push('Chưa thấy packet totals.');
      lines.push('Nếu paste sau khi socket đã mở, hãy dùng Snippets rồi reload trang.');
    }
    lines.push('');
    lines.push('API:');
    lines.push('- __wsBetTotalsProbe.last()');
    lines.push('- __wsBetTotalsProbe.logs()');
    lines.push('- __wsBetTotalsProbe.stop()');
    state.panel.textContent = lines.join('\n');
  }

  function fmt(v) {
    if (v == null) return '--';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return String(n);
  }

  function pushLog(kind, data) {
    state.logs.unshift(Object.assign({ kind, at: now() }, data || {}));
    if (state.logs.length > 100) state.logs.length = 100;
  }

  function pickTotals(obj, url) {
    const bs = obj && Array.isArray(obj.bs) ? obj.bs : null;
    if (!bs) return null;

    let CHAN = null, LE = null, TAI = null, XIU = null;
    for (const it of bs) {
      if (!it || typeof it !== 'object') continue;
      const eid = String(it.eid || '').toUpperCase();
      const v = Number(it.v);
      if (!Number.isFinite(v)) continue;
      if (eid === 'EVEN') CHAN = v;
      else if (eid === 'ODD') LE = v;
      else if (eid === 'BIG') TAI = v;
      else if (eid === 'SMALL') XIU = v;
    }

    if (CHAN == null && LE == null && TAI == null && XIU == null) return null;
    return {
      CHAN, LE, TAI, XIU,
      status: obj.status || '',
      timeBet: obj.timeBet ?? null,
      timeBetCountdown: obj.timeBetCountdown ?? null,
      sessionId: obj.sessionId ?? obj.sid ?? null,
      roundId: obj.roundId || '',
      url,
      at: now()
    };
  }

  function inspectPayload(raw, url) {
    if (raw == null) return null;
    let s = '';
    if (typeof raw === 'string') s = raw.trim();
    else if (raw instanceof ArrayBuffer) return null;
    else if (raw && typeof raw.data === 'string') s = String(raw.data).trim();
    else return null;

    if (!s) return null;

    // socket.io style: 42["event",{...}] or [5,{...}]
    let m = s.match(/^\s*\[\s*\d+\s*,\s*(\{.*\})\s*\]\s*$/s);
    if (m) {
      try {
        return pickTotals(JSON.parse(m[1]), url);
      } catch (_) {}
    }

    m = s.match(/^\s*\d+\s*(\{.*\})\s*$/s);
    if (m) {
      try {
        return pickTotals(JSON.parse(m[1]), url);
      } catch (_) {}
    }

    try {
      const obj = JSON.parse(s);
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item && typeof item === 'object') {
            const hit = pickTotals(item, url);
            if (hit) return hit;
          }
        }
      } else if (obj && typeof obj === 'object') {
        const hit = pickTotals(obj, url);
        if (hit) return hit;
      }
    } catch (_) {}

    const idx = s.indexOf('"bs"');
    if (idx >= 0) {
      const objMatches = s.match(/\{[\s\S]*\}/);
      if (objMatches) {
        try {
          return pickTotals(JSON.parse(objMatches[0]), url);
        } catch (_) {}
      }
    }
    return null;
  }

  function shouldWatch(url) {
    const s = String(url || '').toLowerCase();
    return s.includes('livecasino') && s.includes('/websocket');
  }

  function attach(ws) {
    if (!ws || ws.__betTotalsHooked) return;
    ws.__betTotalsHooked = true;
    state.sockets.add(ws);
    const url = String(ws.url || '');
    pushLog('ws.attach', { url });

    ws.addEventListener('message', ev => {
      try {
        if (!shouldWatch(url)) return;
        const hit = inspectPayload(ev.data, url);
        if (!hit) return;
        state.last = hit;
        pushLog('ws.totals', hit);
        render();
        console.log('[ws-bet-totals]', hit);
      } catch (err) {
        pushLog('ws.err', { url, err: String(err && err.message || err) });
      }
    });
  }

  function install() {
    ensurePanel();
    const NativeWS = window.WebSocket;
    state.orig.WebSocket = NativeWS;

    function WrappedWebSocket(url, protocols) {
      const ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      attach(ws);
      return ws;
    }

    WrappedWebSocket.prototype = NativeWS.prototype;
    Object.setPrototypeOf(WrappedWebSocket, NativeWS);
    window.WebSocket = WrappedWebSocket;

    pushLog('install', { note: 'WebSocket wrapped' });
    render();
  }

  function stop() {
    try {
      if (state.orig.WebSocket) window.WebSocket = state.orig.WebSocket;
    } catch (_) {}
    try {
      if (state.panel) state.panel.remove();
    } catch (_) {}
    state.panel = null;
  }

  window.__wsBetTotalsProbe = {
    last() { return state.last; },
    logs() { console.table(state.logs); return state.logs.slice(); },
    stop
  };

  install();
  console.log('[ws-bet-totals-probe] installed');
  console.log('[ws-bet-totals-probe] IMPORTANT: paste as DevTools Snippet, then reload the page/game so the websocket is created after the hook.');
})();
